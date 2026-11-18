"use client";

import React, { useState, useEffect } from "react";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import { validatePasswordRbac, getPasswordDaysRemaining } from "../../lib/services/rbacAndTime";
import {
  loadInitialData,
  saveEventsToStorage,
  saveUsersToStorage,
  saveStaffToStorage,
  getCurrentUserSession,
  setCurrentUserSession,
  generateGoogleCalendarUrl,
  UserAccount,
  EventRecord,
} from "../../lib/services/storage";

export default function StaffPortalPage() {
  const [activeTab, setActiveTab] = useState<"ESCALA" | "CONTA">("ESCALA");
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [daysRemaining, setDaysRemaining] = useState<number>(90);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [myPhone, setMyPhone] = useState("");
  const [newPassword, setNewPassword] = useState("");

  useEffect(() => {
    const session = getCurrentUserSession();
    if (!session) {
      window.location.href = "/";
      return;
    }
    setCurrentUser(session);
    setMyPhone(session.phoneAnatel);
    setDaysRemaining(getPasswordDaysRemaining(session.passwordChangedAtIso));

    const data = loadInitialData();
    setEvents(data.events);
  }, []);

  const phoneCheck = validateAnatelPhone(myPhone);
  const pwCheck = validatePasswordRbac(newPassword);

  const isInternal = currentUser?.role === "EQUIPE_INTERNA";

  // Equipe Interna vê todos os eventos ativos para apoiar a organização; Equipe Externa vê onde está escalada
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
    setFeedback({ type: "success", text: "✓ Sua presença foi confirmada na escala deste evento!" });
  };

  const handleUpdateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    if (!phoneCheck.valid) {
      setFeedback({ type: "error", text: phoneCheck.error || "Telefone inválido na regra ANATEL." });
      return;
    }
    if (newPassword && !pwCheck.isValid) {
      setFeedback({
        type: "error",
        text: "A nova senha deve ter no mínimo 8 caracteres e incluir caractere especial.",
      });
      return;
    }

    const nowIso = newPassword ? new Date().toISOString() : currentUser.passwordChangedAtIso;
    const updatedUser: UserAccount = {
      ...currentUser,
      phoneAnatel: phoneCheck.formatted || myPhone,
      password: newPassword || currentUser.password,
      passwordChangedAtIso: nowIso,
    };

    const data = loadInitialData();
    const updatedUsers = data.users.map((u) => (u.id === currentUser.id ? updatedUser : u));
    saveUsersToStorage(updatedUsers);

    const updatedStaff = data.staff.map((s) =>
      s.id === currentUser.id
        ? { ...s, phoneAnatel: updatedUser.phoneAnatel, passwordChangedAtIso: nowIso }
        : s
    );
    saveStaffToStorage(updatedStaff);

    setCurrentUser(updatedUser);
    setCurrentUserSession(updatedUser);
    setNewPassword("");
    setFeedback({ type: "success", text: "✓ Dados e senha RBAC atualizados com sucesso!" });
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
                  ? "bg-[#F59E0B] text-slate-950 font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📋</span>
              <span>Minha escala</span>
            </button>
            <button
              onClick={() => setActiveTab("CONTA")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "CONTA"
                  ? "bg-[#F59E0B] text-slate-950 font-extrabold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>👤</span>
              <span>Minha conta</span>
            </button>
          </div>
        </div>

        <div className="border-t border-slate-800/80 pt-4 space-y-2">
          <p className="text-xs font-bold text-white">{currentUser?.name}</p>
          <p className="text-[11px] text-amber-400">
            {isInternal ? "🏠 Equipe Interna (Família)" : `🤝 Terceirizado · R$ ${currentUser?.dailyRate || 0}/diária`}
          </p>
          <button
            onClick={() => {
              setCurrentUserSession(null);
              window.location.href = "/";
            }}
            className="text-xs text-slate-400 hover:text-rose-400 pt-1 block"
          >
            ↪ Sair da conta
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col">
        <header className="border-b border-slate-800/80 px-6 py-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500">
              {isInternal ? "APOIO INTERNO · FAMÍLIA DA HORA" : `PRESTADOR PARCEIRO · ${currentUser?.specialty}`}
            </span>
            <h1 className="text-2xl font-extrabold text-white mt-0.5">
              Olá, {currentUser?.name.split(" ")[0]}!
            </h1>
          </div>
          <span className="px-3.5 py-1.5 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
            ✓ Senha válida por {daysRemaining} dias
          </span>
        </header>

        {feedback && (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex justify-between">
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)}>✕</button>
          </div>
        )}

        <main className="p-6">
          {activeTab === "ESCALA" ? (
            <div className="bg-[#111726] border border-slate-800 rounded-3xl p-6 space-y-4">
              <h2 className="text-lg font-extrabold text-white">
                {isInternal ? "Cronograma de Operação e Preparação (+1h limpeza)" : "Meus Eventos Escalados"}
              </h2>
              {assignedEvents.length === 0 ? (
                <p className="text-xs text-slate-500 py-6">Nenhum evento escalado para o seu perfil no momento.</p>
              ) : (
                <div className="space-y-3">
                  {assignedEvents.map((ev) => {
                    const isConfirmed = (ev.confirmedStaff || []).includes(currentUser?.name || "");
                    return (
                      <div
                        key={ev.id}
                        className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                      >
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-300">
                            {ev.eventType} · {ev.eventDate} ({ev.startTime} às {ev.endTime})
                          </span>
                          <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                          <p className="text-xs text-slate-400">
                            Para: <strong>{ev.honoreeName}</strong> · Resp. ADM: {ev.responsibleAdmin}
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
                                : "bg-[#F59E0B] text-slate-950"
                            }`}
                          >
                            {isConfirmed ? "✓ Presença Confirmada" : "Confirmar Presença"}
                          </button>
                          <a
                            href={generateGoogleCalendarUrl(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-slate-800 text-slate-200 px-3 py-2 rounded-xl text-xs font-semibold"
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
            <form
              onSubmit={handleUpdateAccount}
              className="max-w-md bg-[#111726] border border-slate-800 rounded-3xl p-6 space-y-4 text-xs"
            >
              <h2 className="text-base font-extrabold text-white">Meus Dados e Senha RBAC</h2>
              <div>
                <label className="block text-slate-400 mb-1">Telefone ANATEL</label>
                <input
                  type="tel"
                  required
                  value={myPhone}
                  onChange={(e) => setMyPhone(applyAnatelPhoneMask(e.target.value))}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white"
                />
              </div>
              <div>
                <label className="block text-slate-400 mb-1">Alterar Senha (mín. 8 chars + especial)</label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha RBAC"
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full bg-[#F59E0B] text-slate-950 font-bold py-3 rounded-xl"
              >
                Salvar alterações
              </button>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}