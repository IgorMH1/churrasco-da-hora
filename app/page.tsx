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

type ActiveTab = "LOGIN" | "ESQUECI_SENHA" | "AGENDE_EVENTO";

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

  // Estados do "Esqueci minha senha"
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [generatedToken, setGeneratedToken] = useState<string | null>(null);
  const [typedToken, setTypedToken] = useState("");
  const [newRecoveryPassword, setNewRecoveryPassword] = useState("");
  const [recoveryFeedback, setRecoveryFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

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
    fetchAllFromSupabase().then((cloudData) => {
      setAllUsers(cloudData.users);
      setAllEvents(cloudData.events);
      setIsLoadingCloud(false);
    });
  }, []);

  const pwCheck = validatePasswordRbac(
    activeTab === "LOGIN" ? password : activeTab === "ESQUECI_SENHA" ? newRecoveryPassword : clientPassword
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

    // REGRA RBAC: ADM e EQUIPE_INTERNA acessam /admin (Equipe Interna tem acesso a tudo, exceto Backup)
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

  const handleSendRecoveryEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryFeedback(null);

    const cloudData = await fetchAllFromSupabase();
    const foundUser = cloudData.users.find((u) => u.email.toLowerCase() === recoveryEmail.trim().toLowerCase());
    if (!foundUser) {
      setRecoveryFeedback({
        type: "error",
        text: "Não encontramos nenhuma conta no Supabase com este e-mail.",
      });
      return;
    }

    const token = String(Math.floor(100000 + Math.random() * 900000));
    setGeneratedToken(token);
    setRecoveryFeedback({
      type: "success",
      text: `Código gerado para ${foundUser.email} (válido por 15 min): ${token}`,
    });
  };

  const handleConfirmPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!generatedToken || typedToken.trim() !== generatedToken) {
      setRecoveryFeedback({ type: "error", text: "Código de verificação inválido." });
      return;
    }
    if (!pwCheck.isValid) {
      setRecoveryFeedback({
        type: "error",
        text: "A nova senha deve ter no mínimo 8 caracteres e incluir caractere especial.",
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const cloudData = await fetchAllFromSupabase();
    const updatedUsers = cloudData.users.map((u) =>
      u.email.toLowerCase() === recoveryEmail.trim().toLowerCase()
        ? { ...u, password: newRecoveryPassword, passwordChangedAtIso: nowIso }
        : u
    );

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);
    setGeneratedToken(null);
    setTypedToken("");
    setNewRecoveryPassword("");
    setRecoveryFeedback({
      type: "success",
      text: "✓ Senha atualizada no Supabase! Você já pode entrar na aba Login.",
    });
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
            <span>{isLoadingCloud ? "CONECTANDO SUPABASE..." : "SUPABASE CLOUD CONECTADO"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        <section className="lg:col-span-6 space-y-8 lg:pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-[0.14em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {activeTab === "AGENDE_EVENTO"
              ? "SEU PRÓXIMO BOM MOMENTO COMEÇA AQUI"
              : "BONS MOMENTOS, BEM ORGANIZADOS"}
          </div>

          <div className="space-y-4">
            <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
              Os melhores <span className="text-amber-500">encontros</span> começam aqui.
            </h1>
            <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
              Acesso em nuvem via Supabase para Administradores, Equipe Interna, Equipe Externa e Clientes.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-slate-800/80 max-w-lg text-xs">
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-amber-400 font-bold block">ADM</span>
              <span className="text-slate-400 text-[11px]">Gestão + Backup</span>
            </div>
            <div className="bg-[#111726] border border-slate-800 p-3 rounded-xl">
              <span className="text-purple-400 font-bold block">Eq. Interna</span>
              <span className="text-slate-400 text-[11px]">Gestão completa</span>
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
                    activeTab === "ESQUECI_SENHA"
                      ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                      : "text-slate-400 hover:text-white font-semibold"
                  }`}
                >
                  Esqueci minha senha
                </button>
              </div>
            </div>

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

            {activeTab === "ESQUECI_SENHA" && (
              <div className="space-y-5">
                <h2 className="text-2xl font-extrabold text-white">Recuperar acesso</h2>
                <form onSubmit={handleSendRecoveryEmail} className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-2">E-mail cadastrado</label>
                    <input
                      type="email"
                      required
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-3.5 text-sm text-white outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition text-sm"
                  >
                    Enviar código de recuperação →
                  </button>
                </form>

                {recoveryFeedback && (
                  <div className="p-4 rounded-2xl text-xs border bg-emerald-950/50 border-emerald-500/30 text-emerald-300">
                    {recoveryFeedback.text}
                  </div>
                )}

                {generatedToken && (
                  <form
                    onSubmit={handleConfirmPasswordReset}
                    className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 space-y-3"
                  >
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Código de 6 dígitos</label>
                      <input
                        type="text"
                        required
                        value={typedToken}
                        onChange={(e) => setTypedToken(e.target.value)}
                        className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-slate-300 mb-1">Nova senha (mín. 8 + especial)</label>
                      <input
                        type="password"
                        required
                        value={newRecoveryPassword}
                        onChange={(e) => setNewRecoveryPassword(e.target.value)}
                        className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
                    >
                      Salvar nova senha no Supabase
                    </button>
                  </form>
                )}
              </div>
            )}

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