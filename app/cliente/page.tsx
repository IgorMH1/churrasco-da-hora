"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import {
  validatePasswordRbac,
  getPasswordDaysRemaining,
  hasScheduleConflict,
  getNowGmt3,
} from "../../lib/services/rbacAndTime";
import {
  fetchAllFromSupabase,
  saveEventsToStorage,
  saveUsersToStorage,
  saveClientsToStorage,
  getCurrentUserSession,
  setCurrentUserSession,
  generateGoogleCalendarUrl,
  EventRecord,
  UserAccount,
  ClientRecord,
} from "../../lib/services/storage";

export default function ClientPortalPage() {
  const [activeTab, setActiveTab] = useState<"MEUS_EVENTOS" | "MINHA_CONTA">("MEUS_EVENTOS");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number>(90);
  const [isLoadingCloud, setIsLoadingCloud] = useState<boolean>(true);

  // Dados sincronizados com o Supabase
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [allUsers, setAllUsers] = useState<UserAccount[]>([]);
  const [allClients, setAllClients] = useState<ClientRecord[]>([]);
  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);

  // Estados do Modal Interativo de Evento
  const [selectedEvent, setSelectedEvent] = useState<EventRecord | null>(null);
  const [isEditingEvent, setIsEditingEvent] = useState<boolean>(false);
  const [editTitle, setEditTitle] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editHonoree, setEditHonoree] = useState("");
  const [editDate, setEditDate] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");

  // Campos de "+ Agendar novo evento"
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<string>("Festa familiar");
  const [honoreeName, setHonoreeName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("17:00");

  // Campos da aba "Minha conta"
  const [myName, setMyName] = useState("");
  const [myEmail, setMyEmail] = useState("");
  const [myPhone, setMyPhone] = useState("");
  const [myCpfCnpj, setMyCpfCnpj] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const now = getNowGmt3();
    setEventDate(now.dateStr);

    const sessionUser = getCurrentUserSession();
    if (!sessionUser) {
      window.location.href = "/";
      return;
    }

    setCurrentUser(sessionUser);
    setMyName(sessionUser.name);
    setMyEmail(sessionUser.email);
    setMyPhone(sessionUser.phoneAnatel);
    setMyCpfCnpj(sessionUser.cpfCnpj || "");
    setDaysRemaining(getPasswordDaysRemaining(sessionUser.passwordChangedAtIso));

    fetchAllFromSupabase().then((cloudData) => {
      setAllUsers(cloudData.users);
      setAllClients(cloudData.clients);
      setAllEvents(cloudData.events);

      // Atualiza os dados da sessão com a versão mais recente gravada no Supabase
      const freshUser = cloudData.users.find(
        (u) => u.id === sessionUser.id || u.email.toLowerCase() === sessionUser.email.toLowerCase()
      );
      if (freshUser) {
        setCurrentUser(freshUser);
        setCurrentUserSession(freshUser);
        setMyName(freshUser.name);
        setMyEmail(freshUser.email);
        setMyPhone(freshUser.phoneAnatel);
        setMyCpfCnpj(freshUser.cpfCnpj || "");
        setDaysRemaining(getPasswordDaysRemaining(freshUser.passwordChangedAtIso));
      }
      setIsLoadingCloud(false);
    });
  }, []);

  const phoneCheck = validateAnatelPhone(myPhone);
  const pwCheck = validatePasswordRbac(newPassword);

  const myEvents = allEvents.filter((ev) => {
    if (!currentUser) return false;
    if (currentUser.role === "ADM") return true;
    return (
      ev.clientEmail?.toLowerCase() === currentUser.email.toLowerCase() ||
      ev.clientName.toLowerCase() === currentUser.name.toLowerCase()
    );
  });

  const conflict = allEvents.find(
    (ev) =>
      ev.eventDate === eventDate &&
      ev.status !== "CANCELADO" &&
      hasScheduleConflict(startTime, endTime, ev.startTime, ev.endTime, 60)
  );

  const nextEvent = myEvents.find((e) => e.status !== "CANCELADO") || null;

  const getInitials = (name: string) => {
    if (!name) return "CL";
    const parts = name.trim().split(" ");
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  };

  // Criar Novo Evento e gravar na tabela `events` do Supabase
  const handleCreateNewEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!honoreeName.trim()) {
      setFeedback({ type: "error", text: "Preencha obrigatoriamente 'Para quem é o evento?'." });
      return;
    }
    if (endTime <= startTime) {
      setFeedback({ type: "error", text: "O horário de término deve ser maior que o início." });
      return;
    }
    if (conflict) {
      setFeedback({
        type: "error",
        text: `Horário ocupado por "${conflict.title}" (${conflict.startTime} às ${conflict.endTime} + 1h de limpeza).`,
      });
      return;
    }

    const newEv: EventRecord = {
      id: `EV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: title || `${eventType} - ${honoreeName}`,
      eventType,
      honoreeName,
      clientName: myName || currentUser?.name || "Cliente",
      clientEmail: myEmail || currentUser?.email,
      responsibleAdmin: "ADM a confirmar",
      eventDate,
      startTime,
      endTime,
      status: "PENDENTE",
      supportTeam: ["A definir pelo ADM"],
    };

    const updated = [newEv, ...allEvents];
    setAllEvents(updated);
    saveEventsToStorage(updated);
    setTitle("");
    setHonoreeName("");
    setFeedback({
      type: "success",
      text: "✓ Solicitação salva no Supabase! Clique no card do evento ao lado para ver detalhes ou adicionar ao Google Calendar.",
    });
  };

  const handleOpenEventModal = (ev: EventRecord) => {
    setSelectedEvent(ev);
    setIsEditingEvent(false);
    setEditTitle(ev.title);
    setEditCategory(ev.eventType);
    setEditHonoree(ev.honoreeName);
    setEditDate(ev.eventDate);
    setEditStart(ev.startTime);
    setEditEnd(ev.endTime);
  };

  // Salvar Edição do Evento no Supabase
  const handleSaveEventEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedEvent) return;

    if (editEnd <= editStart) {
      setFeedback({ type: "error", text: "O horário final deve ser maior que o horário inicial." });
      return;
    }

    const editConflict = allEvents.find(
      (ev) =>
        ev.id !== selectedEvent.id &&
        ev.eventDate === editDate &&
        ev.status !== "CANCELADO" &&
        hasScheduleConflict(editStart, editEnd, ev.startTime, ev.endTime, 60)
    );

    if (editConflict) {
      setFeedback({
        type: "error",
        text: `Conflito de horário na data escolhida com "${editConflict.title}".`,
      });
      return;
    }

    const updatedEv: EventRecord = {
      ...selectedEvent,
      title: editTitle,
      eventType: editCategory,
      honoreeName: editHonoree,
      eventDate: editDate,
      startTime: editStart,
      endTime: editEnd,
    };

    const updatedList = allEvents.map((ev) => (ev.id === selectedEvent.id ? updatedEv : ev));
    setAllEvents(updatedList);
    saveEventsToStorage(updatedList);
    setSelectedEvent(updatedEv);
    setIsEditingEvent(false);
    setFeedback({ type: "success", text: "✓ Dados do evento atualizados no Supabase!" });
  };

  // Cancelar Evento no Supabase
  const handleCancelEventFromModal = (id: string) => {
    const updatedList = allEvents.map((ev) =>
      ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev
    );
    setAllEvents(updatedList);
    saveEventsToStorage(updatedList);
    setSelectedEvent((prev) => (prev ? { ...prev, status: "CANCELADO" } : null));
    setFeedback({ type: "success", text: "Solicitação de evento cancelada no Supabase." });
  };

  // Salvar Dados de "Minha Conta" na tabela `users` do Supabase
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!phoneCheck.valid) {
      setFeedback({ type: "error", text: phoneCheck.error || "Telefone inválido na regra ANATEL." });
      return;
    }

    const formattedPhone = phoneCheck.formatted || myPhone;
    const updatedUser: UserAccount = {
      ...currentUser,
      name: myName.trim(),
      email: myEmail.trim().toLowerCase(),
      phoneAnatel: formattedPhone,
      cpfCnpj: myCpfCnpj,
    };

    const existsInList = allUsers.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInList
      ? allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
      : [updatedUser, ...allUsers];

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    const updatedClients = allClients.map((c) =>
      c.id === currentUser.id || c.email.toLowerCase() === currentUser.email.toLowerCase()
        ? {
            ...c,
            name: myName.trim(),
            email: myEmail.trim().toLowerCase(),
            phoneAnatel: formattedPhone,
            cpfCnpj: myCpfCnpj,
          }
        : c
    );
    setAllClients(updatedClients);
    saveClientsToStorage(updatedClients);

    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);
    setFeedback({
      type: "success",
      text: `✓ Seus dados foram salvos no Supabase (${phoneCheck.regionUf})!`,
    });
  };

  // Atualizar Senha RBAC na tabela `users` do Supabase
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
        text: "A nova senha precisa cumprir os critérios RBAC (mín. 8 caracteres e caractere especial).",
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

    const existsInList = allUsers.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInList
      ? allUsers.map((u) => (u.id === currentUser.id ? updatedUser : u))
      : [updatedUser, ...allUsers];

    setAllUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDaysRemaining(90);
    setFeedback({
      type: "success",
      text: "✓ Senha atualizada no Supabase! Novo ciclo de validade: 90 dias.",
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
            <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase mb-2">SEU ESPAÇO</p>
            <button
              onClick={() => setActiveTab("MEUS_EVENTOS")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "MEUS_EVENTOS"
                  ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                  : "text-slate-400 hover:text-white hover:bg-slate-800/40"
              }`}
            >
              <span>📅</span>
              <span>Meus eventos</span>
            </button>
            <button
              onClick={() => setActiveTab("MINHA_CONTA")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "MINHA_CONTA"
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
            <p className="text-[11px] text-slate-400">Seus eventos ficam salvos no banco externo.</p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                {getInitials(myName)}
              </div>
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate">{myName || "Cliente"}</p>
                <p className="text-[11px] text-slate-400 truncate">{currentUser?.id || "Conta do cliente"}</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <button
                type="button"
                onClick={() => {
                  setCurrentUserSession(null);
                  window.location.href = "/";
                }}
                className="text-slate-400 hover:text-rose-400 transition"
              >
                ↪ Sair da conta
              </button>
              {currentUser?.role === "ADM" && (
                <Link href="/admin" className="text-amber-400 hover:underline font-semibold">
                  Painel ADM →
                </Link>
              )}
            </div>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
              {activeTab === "MEUS_EVENTOS" ? "ÁREA DO CLIENTE · SUPABASE" : `CLIENTE · ${myName.toUpperCase()}`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "MEUS_EVENTOS" ? `Olá, ${myName.split(" ")[0] || "Cliente"}!` : "Minha conta"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "MEUS_EVENTOS"
                ? "Clique em qualquer card de evento para ver detalhes, editar ou enviar ao Google Calendar."
                : "Seus dados atualizados e sincronizados no Supabase."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              ✓ Senha válida por mais {daysRemaining} dias
            </div>
          </div>
        </header>

        {feedback && (
          <div
            className={`mx-6 mt-5 p-3.5 rounded-xl text-xs flex justify-between items-center border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/60 border-rose-500/40 text-rose-200"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 flex-1">
          {activeTab === "MEUS_EVENTOS" && (
            <div className="space-y-6">
              {nextEvent && (
                <div
                  onClick={() => handleOpenEventModal(nextEvent)}
                  className="cursor-pointer bg-gradient-to-r from-[#161F33] to-[#111726] hover:from-[#1B263E] border border-amber-500/30 hover:border-amber-500/60 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6 transition shadow-lg"
                >
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-[#0A0E17] border border-amber-500/30 flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-[10px] font-bold uppercase text-amber-400">PRÓXIMO</span>
                      <span className="text-2xl font-extrabold text-white">
                        {nextEvent.eventDate.split("-")[2] || "28"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        ●{" "}
                        {nextEvent.status === "CONFIRMADO"
                          ? "Confirmado no Google Calendar"
                          : "Aguardando confirmação"}
                      </span>
                      <h2 className="text-xl font-extrabold text-white">{nextEvent.title}</h2>
                      <p className="text-xs text-slate-300">
                        Para <strong>{nextEvent.honoreeName}</strong> · {nextEvent.eventDate} das {nextEvent.startTime}{" "}
                        às {nextEvent.endTime} (GMT-3)
                      </p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-400 bg-[#0A0E17] border border-amber-500/30 px-4 py-2.5 rounded-xl shrink-0">
                    Ver detalhes / Editar →
                  </span>
                </div>
              )}

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleCreateNewEvent}
                  className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
                >
                  <div>
                    <h2 className="text-lg font-extrabold text-white">+ Agendar novo evento</h2>
                    <p className="text-xs text-slate-400">Mais um motivo para reunir quem você gosta.</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Categoria (Texto livre)</label>
                      <input
                        type="text"
                        required
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value)}
                        placeholder="Ex: Festa familiar, Aniversário, Futebol..."
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">
                        Para quem é o evento? *
                      </label>
                      <input
                        type="text"
                        required
                        value={honoreeName}
                        onChange={(e) => setHonoreeName(e.target.value)}
                        placeholder="Família Oliveira"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Título do evento</label>
                    <input
                      type="text"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Almoço de domingo"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Data</label>
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

                  {!conflict ? (
                    <div className="px-4 py-2.5 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs">
                      ✓ Data disponível · Sem conflito de horário
                    </div>
                  ) : (
                    <div className="px-4 py-2.5 rounded-xl bg-rose-950/50 border border-rose-500/30 text-rose-300 text-xs">
                      ✕ Horário indisponível nesta data
                    </div>
                  )}

                  <button
                    type="submit"
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                  >
                    Solicitar agendamento →
                  </button>
                </form>

                <div className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Meus eventos marcados</h2>
                      <p className="text-[11px] text-slate-400">Clique em um evento para abrir as opções</p>
                    </div>
                    <span className="text-xs text-slate-400">{myEvents.length} evento(s)</span>
                  </div>

                  {myEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Você ainda não possui eventos marcados no Supabase. Use o formulário ao lado para reservar!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {myEvents.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => handleOpenEventModal(ev)}
                          className="cursor-pointer bg-[#0A0E17] hover:bg-[#131B2E] border border-slate-800 hover:border-amber-500/50 rounded-2xl p-4 space-y-2 transition group"
                        >
                          <div className="flex items-center justify-between">
                            <span
                              className={`inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                ev.status === "CONFIRMADO"
                                  ? "bg-emerald-500/15 text-emerald-400"
                                  : ev.status === "CANCELADO"
                                  ? "bg-rose-500/15 text-rose-400"
                                  : "bg-amber-500/15 text-amber-400"
                              }`}
                            >
                              {ev.status === "CONFIRMADO"
                                ? "✓ Confirmado no Google Calendar"
                                : ev.status === "CANCELADO"
                                ? "✕ Cancelado"
                                : "● Pendente"}
                            </span>
                            <span className="text-[11px] text-amber-400 opacity-80 group-hover:opacity-100 font-semibold">
                              Abrir detalhes →
                            </span>
                          </div>
                          <h3 className="font-bold text-sm text-white">
                            {ev.title} <span className="text-xs font-normal text-amber-400">({ev.eventType})</span>
                          </h3>
                          <p className="text-xs text-slate-400">
                            📅 {ev.eventDate} · 🕒 {ev.startTime} - {ev.endTime} (GMT-3)
                          </p>
                          <p className="text-xs text-slate-500">
                            Para: <strong className="text-slate-300">{ev.honoreeName}</strong> · Resp.:{" "}
                            {ev.responsibleAdmin}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === "MINHA_CONTA" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveProfile}
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Seus dados</h2>
                    <p className="text-xs text-slate-400">Sincronizados em tempo real no Supabase.</p>
                  </div>
                  <span className="text-xs font-mono bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-lg text-amber-400">
                    ID: {currentUser?.id}
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome completo</label>
                  <input
                    type="text"
                    required
                    value={myName}
                    onChange={(e) => setMyName(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail</label>
                  <input
                    type="email"
                    required
                    value={myEmail}
                    onChange={(e) => setMyEmail(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Telefone ANATEL</label>
                  <input
                    type="tel"
                    required
                    value={myPhone}
                    onChange={(e) => setMyPhone(applyAnatelPhoneMask(e.target.value))}
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white"
                  />
                  {phoneCheck.valid && (
                    <div className="mt-2 px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                      ✓ {phoneCheck.regionUf?.replace(" - ", " · ")} · DDD válido
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">CPF/CNPJ (opcional)</label>
                  <input
                    type="text"
                    value={myCpfCnpj}
                    onChange={(e) => setMyCpfCnpj(e.target.value)}
                    placeholder="000.000.000-00"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Salvar alterações no Supabase
                </button>
              </form>

              <form
                onSubmit={handleUpdatePassword}
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Segurança da senha (RBAC)</h2>
                  <p className="text-xs text-slate-400">Mínimo de 8 caracteres e 1 caractere especial.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha atual</label>
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Nova senha</label>
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
                    ✓ 1 caractere especial
                  </span>
                  <span className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                    ✓ Maiúscula e minúscula
                  </span>
                  <span className={pwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>
                    ✓ Pelo menos 1 número
                  </span>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirme a nova senha</label>
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
                  className="w-full bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Atualizar minha senha no Supabase
                </button>
              </form>
            </div>
          )}
        </main>
      </div>

      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/15 px-2.5 py-1 rounded-full">
                  {selectedEvent.eventType} · ID #{selectedEvent.id}
                </span>
                <h3 className="text-xl font-extrabold text-white mt-2">{selectedEvent.title}</h3>
              </div>
              <button
                onClick={() => setSelectedEvent(null)}
                className="text-slate-400 hover:text-white text-lg font-bold px-2"
              >
                ✕
              </button>
            </div>

            {!isEditingEvent ? (
              <div className="space-y-4 text-xs">
                <div className="grid grid-cols-2 gap-3 bg-[#0A0E17] border border-slate-800 p-4 rounded-2xl">
                  <div>
                    <p className="text-slate-500">Para quem é o evento</p>
                    <p className="font-bold text-white text-sm mt-0.5">{selectedEvent.honoreeName}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Status da Reserva</p>
                    <p className="font-bold text-amber-400 text-sm mt-0.5">{selectedEvent.status}</p>
                  </div>
                  <div>
                    <p className="text-slate-500">Data e Horário (GMT-3)</p>
                    <p className="font-bold text-white mt-0.5">
                      {selectedEvent.eventDate} · {selectedEvent.startTime} às {selectedEvent.endTime}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Responsável ADM</p>
                    <p className="font-bold text-white mt-0.5">{selectedEvent.responsibleAdmin}</p>
                  </div>
                </div>

                <div className="bg-[#0A0E17] border border-slate-800 p-4 rounded-2xl">
                  <p className="text-slate-500 mb-1">Equipe de apoio escalada</p>
                  <p className="font-semibold text-slate-200">{selectedEvent.supportTeam.join(", ")}</p>
                </div>

                <div className="flex flex-wrap gap-2.5 pt-2">
                  <a
                    href={generateGoogleCalendarUrl(selectedEvent)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold py-3 px-4 rounded-xl text-center transition"
                  >
                    📅 Adicionar ao Google Calendar
                  </a>

                  {selectedEvent.status !== "CANCELADO" && (
                    <>
                      <button
                        type="button"
                        onClick={() => setIsEditingEvent(true)}
                        className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold py-3 px-4 rounded-xl transition"
                      >
                        ✏️ Editar
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCancelEventFromModal(selectedEvent.id)}
                        className="bg-rose-950/70 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold py-3 px-4 rounded-xl transition"
                      >
                        Cancelar reserva
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleSaveEventEdit} className="space-y-3.5 text-xs">
                <div>
                  <label className="block text-slate-300 mb-1">Título do evento</label>
                  <input
                    type="text"
                    required
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">Categoria (Texto livre)</label>
                    <input
                      type="text"
                      required
                      value={editCategory}
                      onChange={(e) => setEditCategory(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Para quem é o evento?</label>
                    <input
                      type="text"
                      required
                      value={editHonoree}
                      onChange={(e) => setEditHonoree(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-slate-300 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Início</label>
                    <input
                      type="time"
                      required
                      value={editStart}
                      onChange={(e) => setEditStart(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">Término</label>
                    <input
                      type="time"
                      required
                      value={editEnd}
                      onChange={(e) => setEditEnd(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                </div>
                <div className="flex gap-2.5 pt-2">
                  <button
                    type="submit"
                    className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl"
                  >
                    Salvar no Supabase
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsEditingEvent(false)}
                    className="bg-slate-800 text-slate-300 font-bold py-2.5 px-4 rounded-xl"
                  >
                    Voltar
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}