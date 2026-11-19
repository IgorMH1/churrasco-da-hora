"use client";

import React, { useState, useEffect } from "react";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../lib/services/anatel";
import {
  validatePasswordRbac,
  getNowGmt3,
  getPasswordDaysRemaining,
  hasScheduleConflict,
  MAX_LOGIN_ATTEMPTS,
  LOCKOUT_MINUTES,
} from "../lib/services/rbacAndTime";
import {
  fetchAllFromSupabase,
  saveUsersToStorage,
  saveEventsToStorage,
  setCurrentUserSession,
  UserAccount,
  EventRecord,
} from "../lib/services/storage";

type ActiveTab = "LOGIN" | "ESQUECI_SENHA" | "TROCAR_SENHA" | "AGENDE_EVENTO";

// Gera um token com validade de 15 minutos vinculado ao e-mail
function createResetToken(email: string): string {
  const payload = {
    e: email.trim().toLowerCase(),
    exp: Date.now() + 15 * 60 * 1000, // 15 minutos
  };
  return btoa(JSON.stringify(payload));
}

// Valida se o token do link pertence ao e-mail e ainda está dentro dos 15 minutos
function verifyResetToken(token: string, email: string): { valid: boolean; reason?: string } {
  try {
    const decoded = JSON.parse(atob(token)) as { e: string; exp: number };
    if (!decoded || decoded.e !== email.trim().toLowerCase()) {
      return { valid: false, reason: "O link de recuperação não corresponde a este e-mail." };
    }
    if (Date.now() > decoded.exp) {
      return { valid: false, reason: "Este link expirou (limite de 15 minutos). Solicite um novo link." };
    }
    return { valid: true };
  } catch {
    return { valid: false, reason: "Link de recuperação inválido ou corrompido." };
  }
}

export default function LoginAndPublicPortal() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("LOGIN");
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true);

  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);

  // Estados do Login
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [loginFeedback, setLoginFeedback] = useState<{ type: "error" | "success" | "warn"; text: string } | null>(null);

  // Estados do "Esqueci minha senha" (Disparo de e-mail real para o Gmail)
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [recoveryFeedback, setRecoveryFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Estados da Aba Exclusiva "TROCAR_SENHA" (Aberta ao clicar no link do Gmail)
  const [linkEmail, setLinkEmail] = useState("");
  const [linkToken, setLinkToken] = useState("");
  const [newResetPassword, setNewResetPassword] = useState("");
  const [confirmResetPassword, setConfirmResetPassword] = useState("");
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetTabFeedback, setResetTabFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  // Estados do "Agende seu evento"
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<string>("Aniversário");
  const [guestCount, setGuestCount] = useState<string>("30");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("21:00");
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setEventDate(getNowGmt3().dateStr);

    // Verifica se o usuário abriu a página através do link enviado para o Gmail
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const tabParam = params.get("tab");
      const emailParam = params.get("email");
      const tokenParam = params.get("token");

      if (tabParam === "TROCAR_SENHA" && emailParam && tokenParam) {
        setLinkEmail(emailParam.trim().toLowerCase());
        setLinkToken(tokenParam);
        setActiveTab("TROCAR_SENHA");
      }
    }

    fetchAllFromSupabase().then((cloudData) => {
      setAllUsers(cloudData.users);
      setAllEvents(cloudData.events);
      setIsLoadingCloud(false);
    });
  }, []);

  const pwCheck = validatePasswordRbac(
    activeTab === "LOGIN"
      ? password
      : activeTab === "TROCAR_SENHA"
      ? newResetPassword
      : clientPassword
  );
  const phoneCheck = validateAnatelPhone(clientPhone);

  const currentConflict = allEvents.find(
    (slot) =>
      slot.eventDate === eventDate &&
      slot.status !== "CANCELADO" &&
      hasScheduleConflict(startTime, endTime, slot.startTime, slot.endTime, 60)
  );

  const getCleanupEndTime = (end: string) => {
    const [h, m] = end.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "22:00";
    const nextH = (h + 1) % 24;
    return `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginFeedback(null);

    if (lockedUntil && Date.now() < lockedUntil) {
      const minLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
      setLoginFeedback({
        type: "error",
        text: `Conta bloqueada por segurança. Tente novamente em ${minLeft} min.`,
      });
      return;
    }

    const cloudData = await fetchAllFromSupabase();
    setAllUsers(cloudData.users);

    const foundUser = cloudData.users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!foundUser) {
      setLoginFeedback({
        type: "error",
        text: "E-mail não encontrado no Supabase. Cadastre-se em 'Agende seu evento' ou peça ao ADM para criar seu perfil.",
      });
      return;
    }

    if (foundUser.status === "INATIVO") {
      setLoginFeedback({
        type: "error",
        text: "Esta conta está marcada como INATIVA pelo Administrador.",
      });
      return;
    }

    if (!pwCheck.isValid || foundUser.password !== password) {
      const newFailures = failedAttempts + 1;
      setFailedAttempts(newFailures);

      if (newFailures >= MAX_LOGIN_ATTEMPTS) {
        const lockTime = Date.now() + LOCKOUT_MINUTES * 60 * 1000;
        setLockedUntil(lockTime);
        setLoginFeedback({
          type: "error",
          text: `Tentativa 5 de 5 · Conta bloqueada por ${LOCKOUT_MINUTES} min.`,
        });
      } else {
        setLoginFeedback({
          type: "error",
          text: `Senha incorreta ou fora do padrão RBAC. Tentativa ${newFailures} de ${MAX_LOGIN_ATTEMPTS}.`,
        });
      }
      return;
    }

    const daysRemaining = getPasswordDaysRemaining(foundUser.passwordChangedAtIso);
    if (daysRemaining <= 0) {
      setLoginFeedback({
        type: "warn",
        text: "Sua senha completou 90 dias e expirou! Use a aba 'Esqueci minha senha' para renová-la.",
      });
      return;
    }

    setFailedAttempts(0);
    setLockedUntil(null);
    setCurrentUserSession(foundUser);

    const targetRoute =
      foundUser.role === "ADM" || foundUser.role === "EQUIPE_INTERNA"
        ? "/admin"
        : foundUser.role === "CLIENTE"
        ? "/cliente"
        : "/equipe";

    setLoginFeedback({
      type: "success",
      text: `Autenticado no Supabase! Bem-vindo(a), ${foundUser.name} (${foundUser.role})...`,
    });

    setTimeout(() => {
      window.location.href = targetRoute;
    }, 600);
  };

  // ENVIO REAL DE E-MAIL PARA O GMAIL COM O LINK DA ABA DE TROCA DE SENHA
  const handleSendRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryFeedback(null);
    setIsSendingEmail(true);

    try {
      const cloudData = await fetchAllFromSupabase();
      const targetEmail = recoveryEmail.trim().toLowerCase();
      const foundUser = cloudData.users.find((u) => u.email.toLowerCase() === targetEmail);

      if (!foundUser) {
        setRecoveryFeedback({
          type: "error",
          text: "Não encontramos nenhuma conta cadastrada no Supabase com este e-mail.",
        });
        setIsSendingEmail(false);
        return;
      }

      const token = createResetToken(foundUser.email);
      const origin = typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
      const resetUrl = `${origin}/?tab=TROCAR_SENHA&email=${encodeURIComponent(
        foundUser.email
      )}&token=${encodeURIComponent(token)}`;

      const response = await fetch("/api/recover-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: foundUser.email,
          userName: foundUser.name,
          resetUrl,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setRecoveryFeedback({
          type: "error",
          text: result.error || "Não foi possível enviar o e-mail pelo Gmail. Verifique o .env.local.",
        });
        setIsSendingEmail(false);
        return;
      }

      setRecoveryFeedback({
        type: "success",
        text: `✓ E-mail real enviado com sucesso para ${foundUser.email}! Abra sua caixa de entrada do Gmail e clique no botão para acessar a aba de troca de senha.`,
      });
    } catch {
      setRecoveryFeedback({
        type: "error",
        text: "Erro de conexão ao tentar disparar o e-mail de recuperação.",
      });
    } finally {
      setIsSendingEmail(false);
    }
  };

  // SALVAR A NOVA SENHA NA ABA EXCLUSIVA ABERTA PELO LINK DO GMAIL
  const handleConfirmPasswordFromLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetTabFeedback(null);

    const tokenCheck = verifyResetToken(linkToken, linkEmail);
    if (!tokenCheck.valid) {
      setResetTabFeedback({
        type: "error",
        text: tokenCheck.reason || "Link expirado ou inválido.",
      });
      return;
    }

    if (!pwCheck.isValid) {
      setResetTabFeedback({
        type: "error",
        text: "A nova senha deve cumprir todos os requisitos RBAC (mínimo de 8 caracteres, caractere especial, maiúscula, minúscula e número).",
      });
      return;
    }

    if (newResetPassword !== confirmResetPassword) {
      setResetTabFeedback({
        type: "error",
        text: "A confirmação da senha não coincide com a nova senha digitada.",
      });
      return;
    }

    const cloudData = await fetchAllFromSupabase();
    const foundUser = cloudData.users.find((u) => u.email.toLowerCase() === linkEmail.trim().toLowerCase());

    if (!foundUser) {
      setResetTabFeedback({
        type: "error",
        text: "Conta não localizada no Supabase para este e-mail.",
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const updatedUsers = cloudData.users.map((u) =>
      u.email.toLowerCase() === linkEmail.trim().toLowerCase()
        ? { ...u, password: newResetPassword, passwordChangedAtIso: nowIso }
        : u
    );

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    // Limpa os parâmetros da URL para invalidar o uso repetido na barra de endereços
    if (typeof window !== "undefined") {
      window.history.replaceState({}, document.title, "/");
    }

    setEmail(linkEmail);
    setNewResetPassword("");
    setConfirmResetPassword("");
    setResetTabFeedback({
      type: "success",
      text: "✓ Senha alterada e salva no Supabase! Redirecionando para o Login...",
    });

    setTimeout(() => {
      setActiveTab("LOGIN");
      setLoginFeedback({
        type: "success",
        text: "✓ Sua senha foi redefinida com sucesso! Entre com a nova senha abaixo.",
      });
    }, 1200);
  };

  const handlePreSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleFeedback(null);

    if (!phoneCheck.valid) {
      setScheduleFeedback({ type: "error", text: phoneCheck.error || "Telefone inválido na regra ANATEL." });
      return;
    }
    if (!pwCheck.isValid) {
      setScheduleFeedback({
        type: "error",
        text: "A senha precisa cumprir os requisitos RBAC (mínimo de 8 caracteres e caractere especial).",
      });
      return;
    }
    if (!guestCount.trim() || Number(guestCount) <= 0) {
      setScheduleFeedback({ type: "error", text: "Informe uma quantidade de pessoas válida." });
      return;
    }
    if (endTime <= startTime) {
      setScheduleFeedback({ type: "error", text: "O horário de término deve ser maior que o início." });
      return;
    }
    if (currentConflict) {
      setScheduleFeedback({
        type: "error",
        text: `Conflito de horário com "${currentConflict.title}" (${currentConflict.startTime} às ${currentConflict.endTime} + 1h limpeza).`,
      });
      return;
    }

    const cloudData = await fetchAllFromSupabase();
    const normalizedEmail = clientEmail.trim().toLowerCase();
    const existingUser = cloudData.users.find((u) => u.email.toLowerCase() === normalizedEmail);
    const nowIso = new Date().toISOString();
    const shortId = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;

    let loggedUser: UserAccount;

    if (existingUser) {
      loggedUser = existingUser;
    } else {
      loggedUser = {
        id: shortId,
        name: clientName,
        email: normalizedEmail,
        phoneAnatel: phoneCheck.formatted || clientPhone,
        password: clientPassword,
        role: "CLIENTE",
        status: "ATIVO",
        passwordChangedAtIso: nowIso,
      };
      const updatedUsers = [loggedUser, ...cloudData.users];
      setAllUsers(updatedUsers);
      saveUsersToStorage(updatedUsers);
    }

    const formattedGuests = guestCount.includes("pessoa") ? guestCount : `${guestCount} pessoas`;

    const newEvent: EventRecord = {
      id: `EV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: eventTitle || `${eventType} (${formattedGuests})`,
      eventType,
      honoreeName: formattedGuests,
      clientName: loggedUser.name,
      clientEmail: loggedUser.email,
      responsibleAdmin: "ADM a confirmar",
      eventDate,
      startTime,
      endTime,
      status: "PENDENTE",
      supportTeam: ["A definir pelo ADM"],
      confirmedStaff: [],
    };
    const updatedEvents = [newEvent, ...cloudData.events];
    setAllEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    setCurrentUserSession(loggedUser);

    setScheduleFeedback({
      type: "success",
      text: "Conta e reserva salvas no Supabase! Abrindo sua Área do Cliente...",
    });

    setTimeout(() => {
      window.location.href = "/cliente";
    }, 900);
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">
      <header className="w-full border-b border-slate-800/80 bg-[#0A0E17]/90 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 text-lg font-bold shadow-inner">
              🔥
            </div>
            <div className="leading-tight">
              <span className="block font-extrabold text-lg tracking-tight text-white">churrasco</span>
              <span className="block text-[10px] font-bold tracking-[0.22em] text-amber-500 uppercase">
                DOS DA HORA
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
            <span className="w-2 h-2 rounded-full bg-emerald-400" />
            <span>{isLoadingCloud ? "CONECTANDO SUPABASE..." : "SUPABASE & GMAIL CONECTADOS"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <section className="lg:col-span-6 space-y-8 lg:pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-[0.14em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {activeTab === "AGENDE_EVENTO"
              ? "SEU PRÓXIMO BOM MOMENTO COMEÇA AQUI"
              : activeTab === "TROCAR_SENHA"
              ? "REDEFINIÇÃO SEGURA DE SENHA VIA LINK DO GMAIL"
              : "BONS MOMENTOS, BEM ORGANIZADOS"}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
              Os melhores <span className="text-amber-500">encontros</span> começam aqui.
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              Acesso em nuvem via Supabase com recuperação real por e-mail para Administradores, Equipe Interna, Equipe Externa e Clientes.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 max-w-lg text-xs">
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-amber-400 font-bold block">ADM</span>
              <span className="text-slate-400 text-[11px]">Gestão + Backup</span>
            </div>
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-purple-400 font-bold block">Eq. Interna</span>
              <span className="text-slate-400 text-[11px]">Visão do espaço</span>
            </div>
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-emerald-400 font-bold block">Eq. Externa</span>
              <span className="text-slate-400 text-[11px]">Escala e diárias</span>
            </div>
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-sky-400 font-bold block">Clientes</span>
              <span className="text-slate-400 text-[11px]">Reservas online</span>
            </div>
          </div>
        </section>

        <section className="lg:col-span-6 w-full max-w-xl mx-auto">
          <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-7 pb-4 border-b border-slate-800/80">
              <button
                type="button"
                onClick={() => setActiveTab("AGENDE_EVENTO")}
                className={`py-2.5 px-4 rounded-xl text-xs sm:text-sm transition-all border flex items-center justify-center gap-2 ${
                  activeTab === "AGENDE_EVENTO"
                    ? "bg-[#F59E0B] text-slate-950 border-amber-400 font-extrabold shadow-lg shadow-amber-500/20"
                    : "bg-[#0A0E17] text-amber-400 border-amber-500/40 hover:bg-amber-500/10 font-bold"
                }`}
              >
                <span>📅</span>
                <span>Agende seu evento</span>
              </button>

              <div className="grid grid-cols-2 gap-1.5 bg-[#0A0E17] p-1.5 rounded-2xl border border-slate-800">
                <button
                  type="button"
                  onClick={() => setActiveTab("LOGIN")}
                  className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm transition-all ${
                    activeTab === "LOGIN"
                      ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                      : "text-slate-400 hover:text-white font-semibold"
                  }`}
                >
                  Login
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("ESQUECI_SENHA")}
                  className={`py-2 px-3.5 rounded-xl text-xs sm:text-sm transition-all ${
                    activeTab === "ESQUECI_SENHA" || activeTab === "TROCAR_SENHA"
                      ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                      : "text-slate-400 hover:text-white font-semibold"
                  }`}
                >
                  {activeTab === "TROCAR_SENHA" ? "Nova senha" : "Esqueci minha senha"}
                </button>
              </div>
            </div>

            {/* ABA 1: LOGIN */}
            {activeTab === "LOGIN" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Que bom ter você aqui.</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Entre com sua conta (ADM, Equipe Interna, Equipe Externa ou Cliente).
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">E-mail</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition"
                    placeholder="seuemail@exemplo.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">Senha</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition"
                      placeholder="••••••••••••"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      {showPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div className="bg-[#0A0E17] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <span className="text-amber-500">🔒</span>
                    <span>RBAC de Senha</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className={pwCheck.minLength ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Tamanho mínimo (8+ caracteres)</span>
                    </div>
                    <div className={pwCheck.hasSpecial ? "text-emerald-400 font-semibold" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Caractere especial (!@#$%)</span>
                    </div>
                    <div className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Maiúscula e minúscula</span>
                    </div>
                    <div className={pwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Pelo menos 1 número</span>
                    </div>
                  </div>
                </div>

                {loginFeedback && (
                  <div
                    className={`px-4 py-3 rounded-xl text-xs font-medium border ${
                      loginFeedback.type === "success"
                        ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                        : "bg-orange-950/40 border-orange-500/30 text-orange-400"
                    }`}
                  >
                    {loginFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition flex items-center justify-between text-sm shadow-lg shadow-amber-500/10"
                >
                  <span>Entrar no sistema</span>
                  <span className="text-lg">→</span>
                </button>
              </form>
            )}

            {/* ABA 2: ESQUECI MINHA SENHA (DISPARO REAL PARA O GMAIL) */}
            {activeTab === "ESQUECI_SENHA" && (
              <div className="space-y-5">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Recuperar acesso via Gmail</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Digite seu e-mail cadastrado. Enviaremos uma mensagem real com o link direto para a aba de troca de senha.
                  </p>
                </div>

                <form onSubmit={handleSendRecoveryEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">
                      E-mail cadastrado na sua conta
                    </label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="seuemail@gmail.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSendingEmail}
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold py-4 px-6 rounded-2xl transition text-sm"
                  >
                    {isSendingEmail ? "Enviando e-mail para o Gmail..." : "Enviar link de recuperação por e-mail →"}
                  </button>
                </form>

                {recoveryFeedback && (
                  <div
                    className={`p-4 rounded-2xl text-xs border leading-relaxed ${
                      recoveryFeedback.type === "success"
                        ? "bg-emerald-950/50 border-emerald-500/30 text-emerald-300"
                        : "bg-red-950/50 border-red-500/30 text-red-300"
                    }`}
                  >
                    {recoveryFeedback.text}
                  </div>
                )}
              </div>
            )}

            {/* ABA 3: TROCAR SENHA (ABERTA PELO LINK ENVIADO AO GMAIL) */}
            {activeTab === "TROCAR_SENHA" && (
              <form onSubmit={handleConfirmPasswordFromLink} className="space-y-5">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                      LINK DE RECUPERAÇÃO VERIFICADO
                    </span>
                    <h2 className="text-2xl font-extrabold text-white mt-0.5">Criar Nova Senha</h2>
                  </div>
                  <span className="text-xs font-mono bg-[#0A0E17] border border-slate-800 px-3 py-1.5 rounded-xl text-emerald-400">
                    {linkEmail || "E-mail"}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Nova senha RBAC *
                  </label>
                  <div className="relative">
                    <input
                      type={showResetPassword ? "text" : "password"}
                      required
                      value={newResetPassword}
                      onChange={(e) => setNewResetPassword(e.target.value)}
                      placeholder="Digite sua nova senha"
                      className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowResetPassword(!showResetPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white text-xs"
                    >
                      {showResetPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">
                    Confirme a nova senha *
                  </label>
                  <input
                    type={showResetPassword ? "text" : "password"}
                    required
                    value={confirmResetPassword}
                    onChange={(e) => setConfirmResetPassword(e.target.value)}
                    placeholder="Repita sua nova senha"
                    className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none"
                  />
                </div>

                <div className="bg-[#0A0E17] border border-slate-800/90 rounded-2xl p-4 space-y-2.5">
                  <p className="text-xs font-bold text-slate-200">Requisitos obrigatórios RBAC:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                    <div className={pwCheck.minLength ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Mínimo de 8 caracteres
                    </div>
                    <div className={pwCheck.hasSpecial ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Caractere especial (!@#$%)
                    </div>
                    <div className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Letra maiúscula e minúscula
                    </div>
                    <div className={pwCheck.hasNumber ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Pelo menos 1 número
                    </div>
                  </div>
                </div>

                {resetTabFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-medium border ${
                      resetTabFeedback.type === "success"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                        : "bg-red-950/60 border-red-500 text-red-200"
                    }`}
                  >
                    {resetTabFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-4 px-6 rounded-2xl transition text-sm shadow-lg shadow-emerald-500/10"
                >
                  ✓ Salvar nova senha no Supabase e ir para o Login
                </button>
              </form>
            )}

            {/* ABA 4: AGENDE SEU EVENTO */}
            {activeTab === "AGENDE_EVENTO" && (
              <form onSubmit={handlePreSchedule} className="space-y-5">
                <h2 className="text-2xl font-extrabold text-white">Vamos planejar seu evento</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nome completo</label>
                    <input
                      type="text"
                      required
                      value={clientName}
                      onChange={(e) => setClientName(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                    <input
                      type="email"
                      required
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Telefone ANATEL</label>
                  <input
                    type="tel"
                    required
                    value={clientPhone}
                    onChange={(e) => setClientPhone(applyAnatelPhoneMask(e.target.value))}
                    placeholder="(11) 99987-6543"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm font-mono text-white"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Categoria *</label>
                    <input
                      type="text"
                      required
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      placeholder="Ex: Aniversário"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Quantidade de pessoas *</label>
                    <input
                      type="number"
                      min="1"
                      required
                      value={guestCount}
                      onChange={(e) => setGuestCount(e.target.value)}
                      placeholder="Ex: 50"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Título do evento</label>
                    <input
                      type="text"
                      required
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      placeholder="Churrasco da Família"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={eventDate}
                      onChange={(e) => setEventDate(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Início</label>
                    <input
                      type="time"
                      required
                      value={startTime}
                      onChange={(e) => setStartTime(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Término</label>
                    <input
                      type="time"
                      required
                      value={endTime}
                      onChange={(e) => setEndTime(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                {!currentConflict && (
                  <div className="px-4 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs">
                    ✓ Data disponível · Intervalo de limpeza até {getCleanupEndTime(endTime)}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">
                    Crie sua senha RBAC (mín. 8 caracteres + especial) *
                  </label>
                  <div className="relative">
                    <input
                      type={showClientPassword ? "text" : "password"}
                      required
                      value={clientPassword}
                      onChange={(e) => setClientPassword(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                    />
                    <button
                      type="button"
                      onClick={() => setShowClientPassword(!showClientPassword)}
                      className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 text-xs"
                    >
                      {showClientPassword ? "🙈" : "👁️"}
                    </button>
                  </div>
                </div>

                {scheduleFeedback && (
                  <div className="p-3.5 rounded-xl text-xs font-medium border bg-emerald-950/60 border-emerald-500 text-emerald-200">
                    {scheduleFeedback.text}
                  </div>
                )}

                <button
                  type="submit"
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition text-sm"
                >
                  Confirmar solicitação de agendamento →
                </button>
              </form>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}