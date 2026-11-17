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
  loadInitialData,
  saveUsersToStorage,
  saveEventsToStorage,
  saveClientsToStorage,
  UserAccount,
  EventRecord,
  ClientRecord,
} from "../lib/services/storage";

type ActiveTab = "LOGIN" | "ESQUECI_SENHA" | "AGENDE_EVENTO";

export default function LoginAndPublicPortal() {
  const [activeTab, setActiveTab] = useState<ActiveTab>("LOGIN");
  const [clockGmt3, setClockGmt3] = useState<string>("17/11/2026 às 14:32:08 (GMT-3)");

  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);
  const [allClients, setAllClients] = useState<ClientRecord[]>([]);

  // Estados do Login
  const [email, setEmail] = useState("adm@churrascodahora.com.br");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [loginFeedback, setLoginFeedback] = useState<{ type: "error" | "success" | "warn"; text: string } | null>(null);

  // Estados do "Esqueci minha senha"
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [recoverySent, setRecoverySent] = useState(false);

  // Estados do "Agende seu evento"
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientPassword, setClientPassword] = useState("");
  const [showClientPassword, setShowClientPassword] = useState(false);
  const [eventTitle, setEventTitle] = useState("");
  const [eventType, setEventType] = useState<EventRecord["eventType"]>("ANIVERSARIO");
  const [honoreeName, setHonoreeName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("21:00");
  const [scheduleFeedback, setScheduleFeedback] = useState<{ type: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    const data = loadInitialData();
    setAllUsers(data.users);
    setAllEvents(data.events);
    setAllClients(data.clients);

    const now = getNowGmt3();
    setClockGmt3(now.formattedPtBr);
    setEventDate(now.dateStr);

    const timer = setInterval(() => {
      setClockGmt3(getNowGmt3().formattedPtBr);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const pwCheck = validatePasswordRbac(activeTab === "LOGIN" ? password : clientPassword);
  const phoneCheck = validateAnatelPhone(clientPhone);

  // Verifica conflito em tempo real para exibir a barra verde "Data disponível"
  const currentConflict = allEvents.find(
    (slot) =>
      slot.eventDate === eventDate &&
      slot.status !== "CANCELADO" &&
      hasScheduleConflict(startTime, endTime, slot.startTime, slot.endTime, 60)
  );

  // Calcula horário final + 1h de limpeza para mostrar no aviso verde
  const getCleanupEndTime = (end: string) => {
    const [h, m] = end.split(":").map(Number);
    if (isNaN(h) || isNaN(m)) return "22:00";
    const nextH = (h + 1) % 24;
    return `${String(nextH).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();

    if (lockedUntil && Date.now() < lockedUntil) {
      const minLeft = Math.ceil((lockedUntil - Date.now()) / 60000);
      setLoginFeedback({
        type: "error",
        text: `Conta bloqueada por segurança. Tente novamente em ${minLeft} min.`,
      });
      return;
    }

    const foundUser = allUsers.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());

    if (!pwCheck.isValid || !foundUser || foundUser.password !== password) {
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
          text: `Tentativa ${newFailures} de ${MAX_LOGIN_ATTEMPTS} · Após 5 erros, bloqueio por 30 min.`,
        });
      }
      return;
    }

    const daysRemaining = getPasswordDaysRemaining(foundUser.passwordChangedAtIso);
    if (daysRemaining <= 0) {
      setLoginFeedback({
        type: "warn",
        text: "Sua senha completou 90 dias e expirou! Redefina sua senha para continuar.",
      });
      return;
    }

    setFailedAttempts(0);
    setLockedUntil(null);
    setLoginFeedback({
      type: "success",
      text: `Acesso confirmado! Redirecionando para ${foundUser.role === "ADM" ? "Painel da Família" : "Área do Cliente"}...`,
    });

    setTimeout(() => {
      window.location.href = foundUser.role === "ADM" ? "/admin" : "/cliente";
    }, 900);
  };

  const handlePreSchedule = (e: React.FormEvent) => {
    e.preventDefault();
    setScheduleFeedback(null);

    if (!phoneCheck.valid) {
      setScheduleFeedback({ type: "error", text: phoneCheck.error || "Telefone inválido na regra ANATEL." });
      return;
    }
    if (!pwCheck.isValid) {
      setScheduleFeedback({
        type: "error",
        text: "Crie uma senha forte seguindo os 4 critérios abaixo.",
      });
      return;
    }
    if (!honoreeName.trim()) {
      setScheduleFeedback({ type: "error", text: "Preencha o campo obrigatório 'Para quem é o evento?'." });
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

    const newUser: UserAccount = {
      id: `usr-${Date.now()}`,
      name: clientName,
      email: clientEmail.trim().toLowerCase(),
      phoneAnatel: phoneCheck.formatted || clientPhone,
      password: clientPassword,
      role: "CLIENTE",
      passwordChangedAtIso: new Date().toISOString(),
    };
    const updatedUsers = [...allUsers, newUser];
    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    const newClient: ClientRecord = {
      id: `cli-${Date.now()}`,
      name: clientName,
      email: clientEmail.trim().toLowerCase(),
      phoneAnatel: phoneCheck.formatted || clientPhone,
    };
    const updatedClients = [...allClients, newClient];
    setAllClients(updatedClients);
    saveClientsToStorage(updatedClients);

    const newEvent: EventRecord = {
      id: `ev-${Date.now()}`,
      title: eventTitle || `${eventType} - ${honoreeName}`,
      eventType,
      honoreeName,
      clientName,
      responsibleAdmin: "A confirmar",
      eventDate,
      startTime,
      endTime,
      status: "PENDENTE",
      supportTeam: ["A definir pelo ADM"],
    };
    const updatedEvents = [newEvent, ...allEvents];
    setAllEvents(updatedEvents);
    saveEventsToStorage(updatedEvents);

    setScheduleFeedback({
      type: "success",
      text: "Solicitação enviada! Redirecionando para sua Área do Cliente...",
    });

    setTimeout(() => {
      window.location.href = "/cliente";
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col justify-between font-sans selection:bg-amber-500 selection:text-slate-950">
      {/* BARRA SUPERIOR (IDÊNTICA AO PDF) */}
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

          <div className="hidden md:flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] text-slate-400 uppercase">
            <span>{activeTab === "AGENDE_EVENTO" ? "RESERVA ONLINE" : "ESPAÇO DE EVENTOS · FAMÍLIA DA HORA"}</span>
          </div>

          <div className="flex items-center gap-2 bg-[#111726] border border-slate-800 px-3.5 py-2 rounded-full text-xs text-slate-300 font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>{clockGmt3}</span>
          </div>
        </div>
      </header>

      {/* CONTEÚDO PRINCIPAL EM DUAS COLUNAS (HERO ESQUERDA + CARD DIREITA) */}
      <main className="max-w-7xl w-full mx-auto px-4 sm:px-8 py-8 lg:py-12 grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
        {/* COLUNA ESQUERDA: STORYTELLING DA FAMÍLIA (DINÂMICO CONFORME A ABA) */}
        <section className="lg:col-span-6 space-y-8 lg:pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[11px] font-bold tracking-[0.14em] uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
            {activeTab === "AGENDE_EVENTO"
              ? "SEU PRÓXIMO BOM MOMENTO COMEÇA AQUI"
              : "BONS MOMENTOS, BEM ORGANIZADOS"}
          </div>

          {activeTab === "LOGIN" && (
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
                Os melhores <span className="text-amber-500">encontros</span> começam aqui.
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
                Seu espaço para celebrar. Sua agenda sob controle. Organize cada detalhe e aproveite o que importa:
                estar junto de quem faz a vida ser da hora.
              </p>
            </div>
          )}

          {activeTab === "ESQUECI_SENHA" && (
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
                Um novo acesso. Os mesmos <span className="text-amber-500">bons encontros.</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
                Recupere sua conta com tranquilidade e volte a cuidar do que importa: reunir quem você gosta.
              </p>
            </div>
          )}

          {activeTab === "AGENDE_EVENTO" && (
            <div className="space-y-4">
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-extrabold tracking-tight leading-[1.08] text-white">
                Tem um encontro <span className="text-amber-500">em mente?</span>
              </h1>
              <p className="text-base sm:text-lg text-slate-400 max-w-xl leading-relaxed">
                A gente cuida do espaço. Você coleciona os bons momentos.
              </p>
            </div>
          )}

          {/* PASSOS 01, 02, 03 */}
          {activeTab !== "AGENDE_EVENTO" ? (
            <div className="grid grid-cols-3 gap-4 pt-2 border-t border-slate-800/80 max-w-lg">
              <div>
                <span className="text-xs font-bold text-amber-500">01</span>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">Escolha a data</p>
              </div>
              <div>
                <span className="text-xs font-bold text-amber-500">02</span>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">Conte com a gente</p>
              </div>
              <div>
                <span className="text-xs font-bold text-amber-500">03</span>
                <p className="text-sm font-semibold text-slate-200 mt-0.5">É só celebrar</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4 pt-2 max-w-md">
              <div className="flex items-start gap-3.5">
                <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs">
                  01
                </span>
                <div>
                  <p className="font-bold text-sm text-white">Conte sobre o evento</p>
                  <p className="text-xs text-slate-400">Data, categoria e quem vai celebrar.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs">
                  02
                </span>
                <div>
                  <p className="font-bold text-sm text-white">Envie sua solicitação</p>
                  <p className="text-xs text-slate-400">Nossa família confirma os detalhes.</p>
                </div>
              </div>
              <div className="flex items-start gap-3.5">
                <span className="px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30 text-amber-400 font-bold text-xs">
                  03
                </span>
                <div>
                  <p className="font-bold text-sm text-white">Pronto para reunir</p>
                  <p className="text-xs text-slate-400">Acompanhe tudo na sua conta.</p>
                </div>
              </div>
            </div>
          )}

          {/* CARD INFERIOR ESQUERDO */}
          <div className="max-w-lg bg-[#111726]/90 border border-slate-800/90 rounded-2xl p-5 flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 shrink-0">
              {activeTab === "ESQUECI_SENHA" ? "🛡️" : activeTab === "AGENDE_EVENTO" ? "✨" : "📅"}
            </div>
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-white">
                {activeTab === "ESQUECI_SENHA"
                  ? "Segurança em cada etapa"
                  : activeTab === "AGENDE_EVENTO"
                  ? "Tudo pronto para receber você"
                  : "Da primeira reserva ao último abraço."}
              </h3>
              <p className="text-xs text-slate-400 leading-relaxed">
                {activeTab === "ESQUECI_SENHA"
                  ? "Link válido por 15 minutos. Proteção para sua família, suas informações e todos os seus eventos."
                  : activeTab === "AGENDE_EVENTO"
                  ? "Reservamos +1h entre eventos para limpeza e preparação. Esse cuidado é por nossa conta."
                  : "Aniversários, festas em família, futebol e encontros corporativos. Tudo no mesmo lugar."}
              </p>
            </div>
          </div>
        </section>

        {/* COLUNA DIREITA: CARD DO FORMULÁRIO */}
        <section className="lg:col-span-6 w-full max-w-xl mx-auto">
          <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 sm:p-8 shadow-2xl">
            {/* NAVEGAÇÃO DE ABAS NO TOPO DO CARD */}
            <div className="grid grid-cols-3 bg-[#0A0E17] p-1.5 rounded-2xl border border-slate-800/80 mb-7">
              <button
                type="button"
                onClick={() => setActiveTab("LOGIN")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeTab === "LOGIN"
                    ? "bg-[#192236] text-amber-400 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("ESQUECI_SENHA")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeTab === "ESQUECI_SENHA"
                    ? "bg-[#192236] text-amber-400 shadow-sm border border-slate-700/60"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Esqueci minha senha
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("AGENDE_EVENTO")}
                className={`py-2.5 px-3 rounded-xl text-xs sm:text-sm font-semibold transition ${
                  activeTab === "AGENDE_EVENTO"
                    ? "bg-amber-500/15 text-amber-400 border border-amber-500/40"
                    : "text-slate-400 hover:text-slate-200"
                }`}
              >
                Agende seu evento
              </button>
            </div>

            {/* CONTEÚDO DA ABA 1: LOGIN */}
            {activeTab === "LOGIN" && (
              <form onSubmit={handleLogin} className="space-y-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-2xl sm:text-3xl font-extrabold text-white">Que bom ter você aqui.</h2>
                    <p className="text-xs sm:text-sm text-slate-400 mt-1">
                      Acesse sua conta para cuidar dos próximos encontros.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEmail("adm@churrascodahora.com.br");
                      setPassword("DaHora@2026");
                    }}
                    className="text-[11px] text-amber-400/90 hover:text-amber-300 underline shrink-0 mt-1"
                  >
                    Preencher ADM
                  </button>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">E-mail</label>
                  <div className="relative">
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none transition"
                      placeholder="marcos@exemplo.com"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✉️</span>
                  </div>
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

                {/* CAIXA DE SEGURANÇA DA SENHA (IGUAL AO PDF) */}
                <div className="bg-[#0A0E17] border border-slate-800/90 rounded-2xl p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-200">
                    <span className="text-amber-500">🔒</span>
                    <span>Segurança da senha</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <div className={pwCheck.minLength ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">8 caracteres ou mais</span>
                    </div>
                    <div className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Maiúscula e minúscula</span>
                    </div>
                    <div className={pwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">Pelo menos 1 número</span>
                    </div>
                    <div className={pwCheck.hasSpecial ? "text-emerald-400" : "text-slate-500"}>
                      ✓ <span className="text-slate-300 ml-1">1 caractere especial</span>
                    </div>
                  </div>
                </div>

                {/* AVISO DE TENTATIVAS / FEEDBACK */}
                {loginFeedback ? (
                  <div
                    className={`px-4 py-3 rounded-xl text-xs font-medium border ${
                      loginFeedback.type === "success"
                        ? "bg-emerald-950/50 border-emerald-500/40 text-emerald-300"
                        : "bg-amber-950/40 border-amber-500/30 text-amber-400"
                    }`}
                  >
                    {loginFeedback.text}
                  </div>
                ) : (
                  failedAttempts > 0 && (
                    <div className="px-4 py-2.5 rounded-xl bg-amber-950/30 border border-amber-500/20 text-amber-400 text-xs">
                      Tentativa {failedAttempts} de {MAX_LOGIN_ATTEMPTS} · Após 5 erros, bloqueio por 30 min.
                    </div>
                  )
                )}

                <p className="text-xs text-slate-400">Sua senha tem validade de 90 dias.</p>

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition flex items-center justify-between text-sm shadow-lg shadow-amber-500/10"
                >
                  <span>Entrar no sistema</span>
                  <span className="text-lg">→</span>
                </button>

                <p className="text-xs text-slate-400 pt-1">
                  Ainda não tem uma conta?{" "}
                  <button
                    type="button"
                    onClick={() => setActiveTab("AGENDE_EVENTO")}
                    className="text-slate-200 hover:text-amber-400 underline font-semibold"
                  >
                    Agende seu primeiro evento.
                  </button>
                </p>
              </form>
            )}

            {/* CONTEÚDO DA ABA 2: ESQUECI MINHA SENHA */}
            {activeTab === "ESQUECI_SENHA" && (
              <div className="space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400 text-xl">
                  ✉️
                </div>

                <div>
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                    Vamos recuperar
                    <br />
                    seu acesso.
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-2 leading-relaxed">
                    Enviaremos um link para o e-mail cadastrado.
                    <br />
                    Ele será válido por 15 minutos.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-2">E-mail cadastrado</label>
                  <div className="relative">
                    <input
                      type="email"
                      value={recoveryEmail}
                      onChange={(e) => setRecoveryEmail(e.target.value)}
                      placeholder="marcos@exemplo.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 focus:border-amber-500/70 rounded-xl px-4 py-3.5 text-sm text-white outline-none"
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm">✉️</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (recoveryEmail.includes("@")) setRecoverySent(true);
                  }}
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition flex items-center justify-between text-sm"
                >
                  <span>Enviar link de recuperação</span>
                  <span className="text-lg">→</span>
                </button>

                {recoverySent && (
                  <div className="p-4 rounded-2xl bg-emerald-950/50 border border-emerald-500/30 text-xs space-y-1">
                    <p className="font-bold text-emerald-400">✓ Link enviado! Confira sua caixa de entrada.</p>
                    <p className="text-slate-400">Se necessário, verifique também a pasta de spam.</p>
                  </div>
                )}

                <p className="text-xs text-slate-500 leading-relaxed">
                  A nova senha não pode repetir as últimas 3 utilizadas.
                  <br />
                  Envio seguro via Gmail API.
                </p>
              </div>
            )}

            {/* CONTEÚDO DA ABA 3: AGENDE SEU EVENTO */}
            {activeTab === "AGENDE_EVENTO" && (
              <form onSubmit={handlePreSchedule} className="space-y-6">
                <div>
                  <h2 className="text-2xl font-extrabold text-white">Vamos planejar seu evento</h2>
                  <p className="text-xs sm:text-sm text-slate-400 mt-1">
                    Preencha os detalhes. Nossa família confirma a sua reserva.
                  </p>
                </div>

                {/* 01 SEUS DADOS */}
                <div className="space-y-3.5">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-amber-500 uppercase">01 SEUS DADOS</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome completo</label>
                      <input
                        type="text"
                        required
                        value={clientName}
                        onChange={(e) => setClientName(e.target.value)}
                        placeholder="Marcos Oliveira"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail</label>
                      <input
                        type="email"
                        required
                        value={clientEmail}
                        onChange={(e) => setClientEmail(e.target.value)}
                        placeholder="marcos@exemplo.com"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Telefone</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
                      <input
                        type="tel"
                        required
                        value={clientPhone}
                        onChange={(e) => setClientPhone(applyAnatelPhoneMask(e.target.value))}
                        placeholder="(11) 99987-6543"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm font-mono text-white"
                      />
                      {phoneCheck.valid ? (
                        <div className="px-3.5 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                          ✓ {phoneCheck.regionUf?.replace(" - ", " · ")}
                        </div>
                      ) : clientPhone.length >= 4 ? (
                        <div className="px-3 py-2 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-[11px]">
                          {phoneCheck.error}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 02 SOBRE O ENCONTRO */}
                <div className="space-y-3.5">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-amber-500 uppercase">
                    02 SOBRE O ENCONTRO
                  </p>

                  {/* Botões de Categoria (Iguais ao PDF) */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                    {[
                      { id: "ANIVERSARIO", label: "Aniversário", icon: "🎂" },
                      { id: "FESTA", label: "Festa familiar", icon: "🎉" },
                      { id: "FUTEBOL", label: "Futebol", icon: "⚽" },
                      { id: "CORPORATIVO", label: "Corporativo", icon: "💼" },
                    ].map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setEventType(cat.id as EventRecord["eventType"])}
                        className={`py-2.5 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                          eventType === cat.id
                            ? "bg-amber-500/15 border-amber-500/50 text-amber-400"
                            : "bg-[#0A0E17] border-slate-800 text-slate-300 hover:border-slate-700"
                        }`}
                      >
                        <span>{cat.icon}</span>
                        <span>{cat.label}</span>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Para quem é o evento? *
                      </label>
                      <input
                        type="text"
                        required
                        value={honoreeName}
                        onChange={(e) => setHonoreeName(e.target.value)}
                        placeholder="Ana Clara · 15 anos"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Título do evento</label>
                      <input
                        type="text"
                        required
                        value={eventTitle}
                        onChange={(e) => setEventTitle(e.target.value)}
                        placeholder="Aniversário da Ana Clara"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-sm text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Data do evento</label>
                      <input
                        type="date"
                        required
                        value={eventDate}
                        onChange={(e) => setEventDate(e.target.value)}
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Início</label>
                      <input
                        type="time"
                        required
                        value={startTime}
                        onChange={(e) => setStartTime(e.target.value)}
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Término</label>
                      <input
                        type="time"
                        required
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                      />
                    </div>
                  </div>

                  {!currentConflict ? (
                    <div className="px-4 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-medium">
                      ✓ Data disponível · Intervalo de limpeza até {getCleanupEndTime(endTime)}
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs font-medium">
                      ✕ Horário ocupado por &quot;{currentConflict.title}&quot; ({currentConflict.startTime} às{" "}
                      {currentConflict.endTime} + 1h limpeza)
                    </div>
                  )}
                </div>

                {/* 03 CRIE SUA CONTA */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold tracking-[0.14em] text-amber-500 uppercase">03 CRIE SUA CONTA</p>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Crie uma senha</label>
                    <div className="relative">
                      <input
                        type={showClientPassword ? "text" : "password"}
                        required
                        value={clientPassword}
                        onChange={(e) => setClientPassword(e.target.value)}
                        placeholder="••••••••••••"
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

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
                    <span className={pwCheck.minLength ? "text-emerald-400" : "text-slate-500"}>✓ 8 caracteres</span>
                    <span className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                      ✓ Maiúscula e minúscula
                    </span>
                    <span className={pwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>✓ Número</span>
                    <span className={pwCheck.hasSpecial ? "text-emerald-400" : "text-slate-500"}>
                      ✓ Caractere especial
                    </span>
                  </div>
                </div>

                {scheduleFeedback && (
                  <div
                    className={`p-3.5 rounded-xl text-xs font-medium border ${
                      scheduleFeedback.type === "success"
                        ? "bg-emerald-950/60 border-emerald-500 text-emerald-200"
                        : "bg-rose-950/60 border-rose-500 text-rose-200"
                    }`}
                  >
                    {scheduleFeedback.text}
                  </div>
                )}

                <p className="text-[11px] text-slate-400">
                  Ao solicitar, você concorda com as regras de uso do espaço.
                </p>

                <button
                  type="submit"
                  className="w-full bg-[#10B981] hover:bg-emerald-400 text-slate-950 font-bold py-4 px-6 rounded-2xl transition flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-500/10"
                >
                  <span>Confirmar solicitação de agendamento</span>
                  <span>→</span>
                </button>
              </form>
            )}
          </div>
        </section>
      </main>

      {/* RODAPÉ */}
      <footer className="w-full border-t border-slate-800/60 py-5 px-4 sm:px-8 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>2026 Churrasco dos Da Hora. Feito para reunir.</span>
          <div className="flex items-center gap-4">
            <span>Acesso seguro e protegido</span>
            <span>·</span>
            <span>Horário de Brasília</span>
          </div>
        </div>
      </footer>
    </div>
  );
}