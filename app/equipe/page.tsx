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
  UserAccount,
  EventRecord,
  StaffMember,
} from "../../lib/services/storage";

export default function StaffPortalPage() {
  const [activeTab, setActiveTab] = useState<"ESCALA" | "CONTA">("ESCALA");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allStaff, setAllStaff] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
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
    if (!session) {
      window.location.href = "/";
      return;
    }
    setCurrentUser(session);
    setMyName(session.name);
    setMyEmail(session.email);
    setMyPhone(session.phoneAnatel);
    setMySpecialty(session.specialty || "Prestador Parceiro");
    setMyCompany(session.companyName || "Autônomo / MEI");
    setDaysRemaining(getPasswordDaysRemaining(session.passwordChangedAtIso));

    fetchAllFromSupabase().then((cloudData) => {
      setAllUsers(cloudData.users);
      setAllStaff(cloudData.staff);
      setEvents(cloudData.events);

      const freshUser = cloudData.users.find(
        (u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase()
      );
      if (freshUser) {
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

  const isInternal = currentUser?.role === "EQUIPE_INTERNA";

  const getInitials = (name: string) => {
    if (!name) return "EQ";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  const assignedEvents = events.filter((ev) => {
    if (ev.status === "CANCELADO") return false;
    if (isInternal) return true;
    return ev.supportTeam.some((member) =>
      member.toLowerCase().includes((currentUser?.name || "").toLowerCase())
    );
  });

  const handleConfirmPresence = (eventId: string) => {
    if (!currentUser) return;
    const updated = events.map((ev) => {
      if (ev.id !== eventId) return ev;
      const currentConfirmed = ev.confirmedStaff || [];
      if (currentConfirmed.includes(currentUser.name)) return ev;
      return { ...ev, confirmedStaff: [...currentConfirmed, currentUser.name] };
    });
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({
      type: "success",
      text: "✓ Sua presença foi confirmada e salva no Supabase para este evento!",
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

    const nowIso = new Date().toISOString();
    const updatedUser: UserAccount = {
      ...currentUser,
      password: newPassword,
      passwordChangedAtIso: nowIso,
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

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
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

          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase mb-2">
              {isInternal ? "PORTAL EQUIPE INTERNA" : "PORTAL EQUIPE EXTERNA"}
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
            <p className="text-xs font-bold text-white">Nuvem Ativa</p>
            <p className="text-[11px] text-slate-400">Use o botão 📅 GCal para adicionar eventos à sua agenda.</p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                {getInitials(myName || currentUser?.name || "")}
              </div>
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate">{myName || currentUser?.name}</p>
                <p className="text-[11px] text-amber-400 truncate">
                  {isInternal
                    ? "🏠 Equipe Interna"
                    : `🤝 Terceirizado · R$ ${currentUser?.dailyRate || 0}/diária`}
                </p>
              </div>
            </div>
            <button
              onClick={() => {
                setCurrentUserSession(null);
                window.location.href = "/";
              }}
              className="text-xs text-slate-400 hover:text-red-400 pt-1 block transition"
            >
              ↪ Sair da conta
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-500">
              {isInternal
                ? "APOIO INTERNO · SUPABASE CLOUD"
                : `PRESTADOR PARCEIRO · ${(mySpecialty || currentUser?.specialty || "EQUIPE EXTERNA").toUpperCase()}`}
            </span>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "ESCALA"
                ? `Olá, ${(myName || currentUser?.name || "Parceiro").split(" ")[0]}!`
                : "Minha conta"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "ESCALA"
                ? "Confira os eventos na sua escala, confirme presença ou adicione ao Google Calendar."
                : "Gerencie seus dados pessoais, informações profissionais, telefone ANATEL e senha RBAC no Supabase."}
            </p>
          </div>
          <span className="px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold shrink-0">
            ✓ Senha válida por mais {daysRemaining} dias
          </span>
        </header>

        {feedback && (
          <div
            className={`mx-6 mt-5 p-3.5 rounded-xl text-xs flex justify-between items-center border ${
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

        <main className="p-6 space-y-6 flex-1">
          {activeTab === "ESCALA" ? (
            <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-lg font-extrabold text-white">
                    {isInternal ? "Cronograma de Operação e Preparação (+1h limpeza)" : "Meus Eventos Escalados"}
                  </h2>
                  <p className="text-xs text-slate-400">
                    Confirme sua presença ou clique em 📅 GCal para salvar o evento no seu Google Calendar.
                  </p>
                </div>
                <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                  {assignedEvents.length} evento(s)
                </span>
              </div>

              {assignedEvents.length === 0 ? (
                <p className="text-xs text-slate-500 py-8 text-center">
                  Nenhum evento escalado para o seu perfil no momento.
                </p>
              ) : (
                <div className="space-y-3">
                  {assignedEvents.map((ev) => {
                    const isConfirmed = (ev.confirmedStaff || []).includes(currentUser?.name || "");
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
                          </div>
                          <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                          <p className="text-xs text-slate-400">
                            Quantidade: <strong className="text-slate-200">{ev.honoreeName}</strong> · Resp. ADM:{" "}
                            {ev.responsibleAdmin}
                          </p>
                          {!isInternal && (
                            <p className="text-xs text-emerald-400 font-semibold">
                              💰 Diária combinada: R$ {currentUser?.dailyRate || 0}
                            </p>
                          )}
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
            </div>
          ) : (
            /* ABA "MINHA CONTA" PADRONIZADA EM 2 COLUNAS */
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* COLUNA 1: MEUS DADOS PESSOAIS E PROFISSIONAIS */}
              <form
                onSubmit={handleSaveProfileData}
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Meus Dados Pessoais e Profissionais</h2>
                    <p className="text-xs text-slate-400">
                      Sincronizados em tempo real na tabela de usuários e equipe do Supabase.
                    </p>
                  </div>
                  <span className="text-xs font-mono bg-[#0A0E17] border border-slate-800 px-3 py-1.5 rounded-xl text-amber-400 font-bold shrink-0">
                    ID #{currentUser?.id}
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
                  {phoneCheck.valid && (
                    <div className="mt-2 px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      ✓ {phoneCheck.regionUf?.replace(" - ", " · ")} · Formato ANATEL validado
                    </div>
                  )}
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

                <div className="grid grid-cols-2 gap-3 bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl text-xs">
                  <div>
                    <span className="text-slate-500 block">Valor da Diária Acordada</span>
                    <span className="text-emerald-400 font-extrabold text-sm">
                      R$ {currentUser?.dailyRate || 0} / evento
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Status do Cadastro</span>
                    <span className="text-emerald-400 font-bold text-sm">
                      ● {currentUser?.status || "ATIVO"}
                    </span>
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
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
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
        </main>
      </div>
    </div>
  );
}