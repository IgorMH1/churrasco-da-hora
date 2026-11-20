"use client";

import React, { useState, useEffect } from "react";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import { validatePasswordRbac, getPasswordDaysRemaining } from "../../lib/services/rbacAndTime";
import {
  fetchAllFromSupabase,
  saveEventsToStorage,
  saveUsersToStorage,
  saveStaffToStorage,
  getCurrentUserSession,
  setCurrentUserSession,
  generateGoogleCalendarUrl,
  getCorporateIdentityInfo,
  getRoleParameterRulesFromStorage,
  getEmergencyMaintenanceState,
  isFirstLoginPasswordChangeRequired,
  markIsoPasswordChanged,
  UserAccount,
  EventRecord,
  StaffMember,
  RoleParameterRule,
} from "../../lib/services/storage";

function getShiftRateForEvent(
  startTime: string,
  user: UserAccount | null,
  rules: RoleParameterRule[]
): { shiftLabel: string; rateValue: number } {
  const hour = Number((startTime || "12:00").split(":")[0]);
  const matchedRule = rules.find(
    (r) =>
      r.functionName.toLowerCase() === (user?.specialty || "").toLowerCase() ||
      (user?.specialty || "").toLowerCase().includes(r.functionName.toLowerCase().split(" ")[0])
  );

  const diurna = user?.rateDiurna || matchedRule?.rateDiurna || user?.dailyRate || 250;
  const vespertina = user?.rateVespertina || matchedRule?.rateVespertina || user?.dailyRate || 280;
  const noturna = user?.rateNoturna || matchedRule?.rateNoturna || user?.dailyRate || 320;

  if (hour < 12) {
    return { shiftLabel: "Turno Diurno", rateValue: diurna };
  }
  if (hour < 18) {
    return { shiftLabel: "Turno Vespertino", rateValue: vespertina };
  }
  return { shiftLabel: "Turno Noturno", rateValue: noturna };
}

export default function StaffPortalPage() {
  // CARD #49: Guarda estrita de rota por perfil antes de renderizar o portal
  const [isAuthVerified, setIsAuthVerified] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<"ESCALA" | "CONTA">("ESCALA");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [roleRules, setRoleRules] = useState<RoleParameterRule[]>([]);
  const [daysRemaining, setDaysRemaining] = useState<number>(90);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Coluna 1: Estados de "Meus Dados Pessoais e Profissionais"
  const [myName, setMyName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [mySpecialty, setMySpecialty] = useState("");
  const [myCompany, setMyCompany] = useState("");

  // Coluna 2: Estados de "Segurança da Senha (RBAC)"
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const session = getCurrentUserSession();

    // CARD #49: Bloqueia acesso direto via URL sem estar logado
    if (!session) {
      window.location.replace("/");
      return;
    }

    // CARD #42: Se ainda não trocou a senha obrigatória de 1º acesso, retorna ao login
    if (isFirstLoginPasswordChangeRequired(session)) {
      window.location.replace("/");
      return;
    }

    // CARD #45 e #46: Bloqueia acesso se o modo de emergência estiver ativo ou conta bloqueada/inativa
    const emergency = getEmergencyMaintenanceState();
    if (
      session.status === "INATIVO" ||
      session.status === "BLOQUEADO" ||
      (emergency.active && session.role !== "ADM")
    ) {
      setCurrentUserSession(null);
      window.location.replace("/");
      return;
    }

    // CARD #49: Redireciona perfis que não pertencem ao Portal da Equipe Externa
    if (session.role === "CLIENTE") {
      window.location.replace("/cliente");
      return;
    }
    if (session.role === "EQUIPE_INTERNA") {
      window.location.replace("/admin");
      return;
    }

    const loadedRules = getRoleParameterRulesFromStorage();
    setRoleRules(loadedRules);

    setCurrentUser(session);
    setMyName(session.name);
    setMyEmail(session.email);
    setMyPhone(session.phoneAnatel);
    setMySpecialty(session.specialty || "Prestador Parceiro");
    setMyCompany(session.companyName || "Autônomo / MEI");
    setDaysRemaining(getPasswordDaysRemaining(session.passwordChangedAtIso));
    setIsAuthVerified(true);

    fetchAllFromSupabase().then((cloudData) => {
      setAllUsers(cloudData.users);
      setAllStaff(cloudData.staff);
      setEvents(cloudData.events);

      const freshUser = cloudData.users.find(
        (u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase()
      );
      if (freshUser) {
        if (freshUser.status === "INATIVO" || freshUser.status === "BLOQUEADO") {
          setCurrentUserSession(null);
          window.location.replace("/");
          return;
        }
        setCurrentUser(freshUser);
        setCurrentUserSession(freshUser);
        setMyName(freshUser.name);
        setMyEmail(freshUser.email);
        setMyPhone(freshUser.phoneAnatel);
        setMySpecialty(freshUser.specialty || "Prestador Parceiro");
        setMyCompany(freshUser.companyName || "Autônomo / MEI");
        setDaysRemaining(getPasswordDaysRemaining(freshUser.passwordChangedAtIso));
      }
      setIsLoadingCloud(false);
    });
  }, []);

  const phoneCheck = validateAnatelPhone(myPhone);
  const pwCheck = validatePasswordRbac(newPassword);

  const corpIdentity = currentUser
    ? getCorporateIdentityInfo(currentUser)
    : {
        corporateCode: "CDH-EXT-0000",
        clearanceLevel: "NÍVEL 2 · PARCEIRO CREDENCIADO",
        unitDepartment: "Operação Terceirizada",
      };

  const matchedRuleForCurrentUser = roleRules.find(
    (r) =>
      r.functionName.toLowerCase() === (mySpecialty || currentUser?.specialty || "").toLowerCase() ||
      (mySpecialty || currentUser?.specialty || "")
        .toLowerCase()
        .includes(r.functionName.toLowerCase().split(" ")[0])
  );

  const rateDiurnaDisplay =
    currentUser?.rateDiurna || matchedRuleForCurrentUser?.rateDiurna || currentUser?.dailyRate || 250;
  const rateVespertinaDisplay =
    currentUser?.rateVespertina ||
    matchedRuleForCurrentUser?.rateVespertina ||
    currentUser?.dailyRate ||
    280;
  const rateNoturnaDisplay =
    currentUser?.rateNoturna || matchedRuleForCurrentUser?.rateNoturna || currentUser?.dailyRate || 320;
  const workModelDisplay =
    currentUser?.workModel || matchedRuleForCurrentUser?.workModel || "PRESENCIAL";
  const shiftPeriodDisplay =
    currentUser?.shiftPeriod || matchedRuleForCurrentUser?.defaultPeriod || "INTEGRAL";

  const getInitials = (name: string) => {
    if (!name) return "EQ";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const assignedEvents = events.filter((ev) => {
    if (ev.status === "CANCELADO") return false;
    return ev.supportTeam.some((member) =>
      member.toLowerCase().includes((currentUser?.name || "").toLowerCase())
    );
  });

  const confirmedCount = assignedEvents.filter((ev) =>
    (ev.confirmedStaff || []).some(
      (c) => c.trim().toLowerCase() === (currentUser?.name || "").trim().toLowerCase()
    )
  ).length;

  const estimatedTotalEarnings = assignedEvents.reduce((acc, ev) => {
    const { rateValue } = getShiftRateForEvent(ev.startTime, currentUser, roleRules);
    return acc + rateValue;
  }, 0);

  const handleConfirmPresence = (eventId: string) => {
    if (!currentUser) return;
    const updated = events.map((ev) => {
      if (ev.id !== eventId) return ev;
      const currentConfirmed = ev.confirmedStaff || [];
      const alreadyIn = currentConfirmed.some(
        (c) => c.trim().toLowerCase() === currentUser.name.trim().toLowerCase()
      );
      const nextConfirmed = alreadyIn
        ? currentConfirmed.filter(
            (c) => c.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
          )
        : [...currentConfirmed, currentUser.name];
      return { ...ev, confirmedStaff: nextConfirmed };
    });
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({
      type: "success",
      text: "✓ Seu status de presença na escala foi atualizado e salvo no Supabase!",
    });
  };

  const handleSaveProfileData = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!phoneCheck.valid) {
      setFeedback({ type: "error", text: phoneCheck.error || "Telefone inválido na regra ANATEL." });
      return;
    }

    const normalizedEmail = myEmail.trim().toLowerCase();
    const emailConflict = allUsers.some(
      (u) => u.id !== currentUser.id && u.email.toLowerCase() === normalizedEmail
    );
    if (emailConflict) {
      setFeedback({ type: "error", text: "Este e-mail já está em uso por outra conta no sistema." });
      return;
    }

    const formattedPhone = phoneCheck.formatted || myPhone;
    const updatedUser: UserAccount = {
      ...currentUser,
      name: myName.trim(),
      email: normalizedEmail,
      phoneAnatel: formattedPhone,
      specialty: mySpecialty.trim() || currentUser.specialty,
      companyName: myCompany.trim() || currentUser.companyName,
    };

    const existsInUsers = allUsers.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInUsers
      ? allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
      : [updatedUser, ...allUsers];

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    const updatedStaff = allStaff.map((s) =>
      s.id === currentUser.id || s.email.toLowerCase() === currentUser.email.toLowerCase()
        ? {
            ...s,
            name: updatedUser.name,
            email: updatedUser.email,
            phoneAnatel: updatedUser.phoneAnatel,
            specialty: updatedUser.specialty || s.specialty,
            companyName: updatedUser.companyName || s.companyName,
          }
        : s
    );
    setAllStaff(updatedStaff);
    saveStaffToStorage(updatedStaff);

    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);
    setFeedback({
      type: "success",
      text: `✓ Seus dados pessoais e profissionais foram salvos no Supabase (${phoneCheck.regionUf})!`,
    });
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    if (currentPassword !== currentUser.password) {
      setFeedback({ type: "error", text: "A senha atual digitada está incorreta." });
      return;
    }
    if (!pwCheck.isValid) {
      setFeedback({
        type: "error",
        text: "A nova senha precisa cumprir os 4 critérios RBAC (mín. 8 caracteres, caractere especial, maiúscula/minúscula e número).",
      });
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback({ type: "error", text: "A confirmação da nova senha não confere." });
      return;
    }

    const nowIso = markIsoPasswordChanged();
    const updatedUser: UserAccount = {
      ...currentUser,
      password: newPassword,
      passwordChangedAtIso: nowIso,
      mustChangePassword: false,
    };

    const existsInUsers = allUsers.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInUsers
      ? allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
      : [updatedUser, ...allUsers];

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    const updatedStaff = allStaff.map((s) =>
      s.id === currentUser.id ? { ...s, passwordChangedAtIso: nowIso } : s
    );
    setAllStaff(updatedStaff);
    saveStaffToStorage(updatedStaff);

    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDaysRemaining(90);
    setFeedback({
      type: "success",
      text: "✓ Senha RBAC atualizada no Supabase! Novo ciclo de validade: 90 dias.",
    });
  };

  // CARD #49: Bloqueio de renderização enquanto verifica credenciais RBAC
  if (!isAuthVerified) {
    return (
      <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-[#111726] border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-3 shadow-2xl">
          <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            🔒
          </div>
          <p className="text-sm font-extrabold text-white">Verificando credenciais RBAC...</p>
          <p className="text-xs text-slate-400">Validando acesso exclusivo ao Portal da Equipe Externa.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* CONTAINER 1: SIDEBAR CORPORATIVA */}
      <aside className="w-full lg:w-64 bg-[#0D121E] border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-7">
          <div className="flex items-center gap-3 px-1">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
              🔥
            </div>
            <div className="leading-tight">
              <span className="block font-extrabold text-base text-white">churrasco</span>
              <span className="block text-[9px] font-bold tracking-[0.22em] text-amber-500 uppercase">
                DOS DA HORA
              </span>
            </div>
          </div>

          {/* CARD #47: Crachá resumido de Identidade Corporativa na Sidebar */}
          <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 space-y-1">
            <span className="text-[10px] font-mono font-bold text-amber-400 block">
              {corpIdentity.corporateCode}
            </span>
            <p className="text-[11px] font-bold text-white">{corpIdentity.clearanceLevel}</p>
            <p className="text-[10px] text-slate-400 truncate">{corpIdentity.unitDepartment}</p>
          </div>

          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase mb-2">
              PORTAL EQUIPE EXTERNA
            </p>
            <button
              onClick={() => setActiveTab("ESCALA")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "ESCALA"
                  ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <span>📋</span>
              <span>Minha escala</span>
            </button>
            <button
              onClick={() => setActiveTab("CONTA")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "CONTA"
                  ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <span>👤</span>
              <span>Minha conta</span>
            </button>
          </div>
        </div>

        <div className="hidden lg:flex flex-col gap-4 pt-6">
          <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 space-y-1">
            <span className="text-[11px] font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />{" "}
              {isLoadingCloud ? "Sincronizando..." : "✓ Supabase & Google Calendar"}
            </span>
            <p className="text-xs font-bold text-white">Escala & Diárias por Turno</p>
            <p className="text-[11px] text-slate-400">
              Regime {workModelDisplay} · Período {shiftPeriodDisplay}
            </p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                {getInitials(myName || currentUser?.name || "")}
              </div>
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate">{myName || currentUser?.name}</p>
                <p className="text-[11px] text-amber-400 truncate">
                  🤝 Base: R$ {rateDiurnaDisplay} a R$ {rateNoturnaDisplay}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentUserSession(null);
                window.location.replace("/");
              }}
              className="text-xs text-slate-400 hover:text-red-400 pt-1 block transition"
            >
              ↪ Sair da conta
            </button>
          </div>
        </div>
      </aside>

      {/* CONTAINER 2: ÁREA OPERACIONAL PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 bg-[#0D121E]/60 px-6 py-5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
                {corpIdentity.corporateCode} · PRESTADOR PARCEIRO ·{" "}
                {(mySpecialty || currentUser?.specialty || "EQUIPE EXTERNA").toUpperCase()}
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                {activeTab === "ESCALA"
                  ? `Olá, ${(myName || currentUser?.name || "Parceiro").split(" ")[0]}!`
                  : "Minha conta e parâmetros"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === "ESCALA"
                  ? "Confira os eventos na sua escala, o valor calculado por turno (Diurno/Vespertino/Noturno) e confirme sua presença."
                  : "Gerencie seus dados pessoais, informações profissionais, telefone ANATEL e senha RBAC no Supabase."}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <span className="px-3.5 py-2 rounded-full bg-[#111726] border border-slate-800 text-amber-400 text-xs font-mono font-bold">
                🪪 {corpIdentity.corporateCode}
              </span>
              <span className="px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                ✓ Senha válida por mais {daysRemaining} dias
              </span>
            </div>
          </div>
        </header>

        <main className="p-6 flex-1">
          <div className="max-w-7xl mx-auto space-y-6">
            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex justify-between items-center border ${
                  feedback.type === "success"
                    ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                    : "bg-red-950/60 border-red-500/40 text-red-200"
                }`}
              >
                <span>{feedback.text}</span>
                <button onClick={() => setFeedback(null)} className="font-bold ml-4">
                  ✕
                </button>
              </div>
            )}

            {activeTab === "ESCALA" ? (
              <div className="space-y-6">
                {/* CONTAINER 3: RESUMO DE ESCALA E PARÂMETROS DE DIÁRIAS POR TURNO (CARD #41) */}
                <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-500 shadow-lg">
                    <span className="text-xs text-slate-400">Eventos na minha escala</span>
                    <p className="text-3xl font-extrabold text-white mt-1">
                      {String(assignedEvents.length).padStart(2, "0")}
                    </p>
                    <p className="text-[11px] text-amber-400 mt-1">
                      {confirmedCount} presença(s) confirmada(s)
                    </p>
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-emerald-500 shadow-lg">
                    <span className="text-xs text-slate-400">Previsão de Diárias Escaladas</span>
                    <p className="text-3xl font-extrabold text-emerald-400 mt-1">
                      R$ {estimatedTotalEarnings}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-1">
                      Calculado conforme turno do evento
                    </p>
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-sky-500 shadow-lg">
                    <span className="text-xs text-slate-400">Tabela de Diárias por Turno</span>
                    <div className="flex items-center justify-between text-xs font-bold text-white mt-2">
                      <span>☀️ Diurna: R$ {rateDiurnaDisplay}</span>
                      <span>🌤️ Vesp.: R$ {rateVespertinaDisplay}</span>
                    </div>
                    <p className="text-xs font-bold text-amber-400 mt-1">
                      🌙 Noturna: R$ {rateNoturnaDisplay}
                    </p>
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-purple-500 shadow-lg">
                    <span className="text-xs text-slate-400">Regime & Período Padrão</span>
                    <p className="text-lg font-extrabold text-white mt-1.5">
                      {workModelDisplay} · {shiftPeriodDisplay}
                    </p>
                    <p className="text-[11px] text-purple-300 mt-1">
                      Função: {mySpecialty || currentUser?.specialty}
                    </p>
                  </div>
                </section>

                {/* CONTAINER 4: LISTA DE EVENTOS ESCALADOS */}
                <section className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Meus Eventos Escalados</h2>
                      <p className="text-xs text-slate-400">
                        Confirme sua presença ou clique em 📅 GCal para salvar o evento no seu Google Calendar.
                      </p>
                    </div>
                    <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                      {assignedEvents.length} evento(s) ativo(s)
                    </span>
                  </div>

                  {assignedEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Nenhum evento escalado para o seu perfil no momento.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {assignedEvents.map((ev) => {
                        const isConfirmed = (ev.confirmedStaff || []).some(
                          (c) =>
                            c.trim().toLowerCase() ===
                            (currentUser?.name || "").trim().toLowerCase()
                        );
                        const shiftInfo = getShiftRateForEvent(
                          ev.startTime,
                          currentUser,
                          roleRules
                        );

                        return (
                          <div
                            key={ev.id}
                            className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                          >
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-amber-500/15 text-amber-300">
                                  {ev.eventType} · {ev.eventDate} ({ev.startTime} às {ev.endTime})
                                </span>
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                    ev.status === "CONFIRMADO"
                                      ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/40"
                                      : "bg-orange-500/15 text-orange-400 border-orange-500/40"
                                  }`}
                                >
                                  {ev.status === "CONFIRMADO" ? "✓ Confirmado" : "● Pendente"}
                                </span>
                                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                                  {shiftInfo.shiftLabel}
                                </span>
                              </div>
                              <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                              <p className="text-xs text-slate-400">
                                Quantidade: <strong className="text-slate-200">{ev.honoreeName}</strong> · Resp. ADM:{" "}
                                {ev.responsibleAdmin}
                              </p>
                              <p className="text-xs text-emerald-400 font-semibold">
                                💰 Diária aplicável ({shiftInfo.shiftLabel}): R$ {shiftInfo.rateValue}
                              </p>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleConfirmPresence(ev.id)}
                                className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                                  isConfirmed
                                    ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                    : "bg-[#F59E0B] hover:bg-amber-400 text-slate-950"
                                }`}
                              >
                                {isConfirmed ? "✓ Presença Confirmada" : "Confirmar Presença"}
                              </button>
                              <a
                                href={generateGoogleCalendarUrl(ev)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold transition"
                              >
                                📅 GCal
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </section>
              </div>
            ) : (
              /* CONTAINER 5: ABA "MINHA CONTA" PADRONIZADA EM 2 COLUNAS */
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                {/* COLUNA 1: MEUS DADOS PESSOAIS E PROFISSIONAIS */}
                <form
                  onSubmit={handleSaveProfileData}
                  className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4 shadow-xl"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Meus Dados Pessoais e Profissionais</h2>
                      <p className="text-xs text-slate-400">
                        Sincronizados em tempo real na tabela de usuários e equipe do Supabase.
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-[#0A0E17] border border-slate-800 px-3 py-1.5 rounded-xl text-amber-400 font-bold shrink-0">
                      {corpIdentity.corporateCode}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome completo *</label>
                    <input
                      type="text"
                      required
                      value={myName}
                      onChange={(e) => setMyName(e.target.value)}
                      placeholder="Seu nome completo"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      value={myEmail}
                      onChange={(e) => setMyEmail(e.target.value)}
                      placeholder="seuemail@exemplo.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-300 font-medium">Telefone ANATEL *</span>
                      {phoneCheck.valid && (
                        <span className="text-emerald-400 font-semibold">
                          ✓ {phoneCheck.regionUf?.replace(" - ", " · ")} · DDD válido
                        </span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      value={myPhone}
                      onChange={(e) => setMyPhone(applyAnatelPhoneMask(e.target.value))}
                      placeholder="(11) 98888-7777"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Especialidade / Função *
                      </label>
                      <input
                        type="text"
                        required
                        value={mySpecialty}
                        onChange={(e) => setMySpecialty(e.target.value)}
                        placeholder="Ex: Garçom, Churrasqueiro, Segurança..."
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Empresa / MEI (Opcional)
                      </label>
                      <input
                        type="text"
                        value={myCompany}
                        onChange={(e) => setMyCompany(e.target.value)}
                        placeholder="Ex: Prestador Parceiro MEI"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  {/* CARD #41: Exibição transparente dos parâmetros de regra aplicados ao colaborador */}
                  <div className="bg-[#0A0E17] border border-slate-800 p-4 rounded-2xl space-y-2.5 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold">Parâmetros de Diária por Turno</span>
                      <span className="text-[11px] font-bold text-amber-400">
                        {workModelDisplay} · {shiftPeriodDisplay}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 pt-1">
                      <div className="bg-[#111726] border border-slate-800/80 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 block">☀️ Diurna</span>
                        <strong className="text-emerald-400 text-xs">R$ {rateDiurnaDisplay}</strong>
                      </div>
                      <div className="bg-[#111726] border border-slate-800/80 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 block">🌤️ Vespertina</span>
                        <strong className="text-emerald-400 text-xs">R$ {rateVespertinaDisplay}</strong>
                      </div>
                      <div className="bg-[#111726] border border-slate-800/80 p-2.5 rounded-xl text-center">
                        <span className="text-[10px] text-slate-400 block">🌙 Noturna</span>
                        <strong className="text-emerald-400 text-xs">R$ {rateNoturnaDisplay}</strong>
                      </div>
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-2xl text-xs transition"
                  >
                    Salvar alterações no Supabase
                  </button>
                </form>

                {/* COLUNA 2: SEGURANÇA DA SENHA (RBAC) */}
                <form
                  onSubmit={handleUpdatePassword}
                  className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4 shadow-xl"
                >
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-lg font-extrabold text-white">Segurança da Senha (RBAC)</h2>
                    <p className="text-xs text-slate-400">
                      Mínimo de 8 caracteres, 1 caractere especial, letra maiúscula, minúscula e número.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha atual *</label>
                    <input
                      type="password"
                      required
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Nova senha RBAC *</label>
                    <input
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="••••••••••••••"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                    <span className={pwCheck.minLength ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Mínimo de 8 caracteres
                    </span>
                    <span className={pwCheck.hasSpecial ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ 1 caractere especial (!@#$)
                    </span>
                    <span className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Maiúscula e minúscula
                    </span>
                    <span className={pwCheck.hasNumber ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Pelo menos 1 número
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirme a nova senha *</label>
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••••••••"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-extrabold py-3.5 rounded-2xl text-xs transition"
                  >
                    Atualizar minha senha no Supabase
                  </button>
                </form>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}