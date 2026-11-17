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
import { loadInitialData, saveEventsToStorage, EventRecord } from "../../lib/services/storage";

export default function ClientPortalPage() {
  const [activeTab, setActiveTab] = useState<"MEUS_EVENTOS" | "MINHA_CONTA">("MEUS_EVENTOS");
  const [feedback, setFeedback] = useState<string | null>(null);
  const [clockGmt3, setClockGmt3] = useState<string>("17/11/2026 às 14:32:08 (GMT-3)");
  const [daysRemaining, setDaysRemaining] = useState<number>(72);

  const [allEvents, setAllEvents] = useState<EventRecord[]>([]);

  // Campos de Novo Evento
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState<EventRecord["eventType"]>("FESTA");
  const [honoreeName, setHonoreeName] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("12:00");
  const [endTime, setEndTime] = useState("17:00");

  // Campos da aba "Minha conta"
  const [myName, setMyName] = useState("Marcos Oliveira");
  const [myEmail, setMyEmail] = useState("marcos@exemplo.com");
  const [myPhone, setMyPhone] = useState("(11) 99987-6543");
  const [myCpfCnpj, setMyCpfCnpj] = useState("123.456.789-00");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  useEffect(() => {
    const data = loadInitialData();
    setAllEvents(data.events);
    const now = getNowGmt3();
    setClockGmt3(now.formattedPtBr);
    setEventDate(now.dateStr);
    setDaysRemaining(getPasswordDaysRemaining("2026-10-30T10:00:00-03:00"));

    const timer = setInterval(() => {
      setClockGmt3(getNowGmt3().formattedPtBr);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const phoneCheck = validateAnatelPhone(myPhone);
  const pwCheck = validatePasswordRbac(newPassword);

  const conflict = allEvents.find(
    (ev) =>
      ev.eventDate === eventDate &&
      ev.status !== "CANCELADO" &&
      hasScheduleConflict(startTime, endTime, ev.startTime, ev.endTime, 60)
  );

  const nextEvent = allEvents.find((e) => e.status !== "CANCELADO") || null;

  const handleCreateNewEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!honoreeName.trim()) {
      setFeedback("Preencha obrigatoriamente 'Para quem é o evento?'.");
      return;
    }
    if (endTime <= startTime) {
      setFeedback("O horário de término deve ser maior que o início.");
      return;
    }
    if (conflict) {
      setFeedback(`Horário ocupado por "${conflict.title}" (+ 1h de limpeza).`);
      return;
    }

    const newEv: EventRecord = {
      id: `cli-ev-${Date.now()}`,
      title: title || `${eventType} - ${honoreeName}`,
      eventType,
      honoreeName,
      clientName: myName,
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
    setFeedback("✓ Sua solicitação chegou! Nossa família vai confirmar os detalhes em breve.");
  };

  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneCheck.valid) {
      setFeedback(phoneCheck.error || "Telefone inválido na regra ANATEL.");
      return;
    }
    setFeedback(`✓ Seus dados foram atualizados com sucesso (${phoneCheck.regionUf})!`);
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwCheck.isValid) {
      setFeedback("A nova senha precisa cumprir os 4 critérios de segurança.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setFeedback("A confirmação da nova senha não confere.");
      return;
    }
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setDaysRemaining(90);
    setFeedback("✓ Senha atualizada com sucesso! Novo ciclo de validade: 90 dias.");
  };

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* BARRA LATERAL ESQUERDA DO CLIENTE */}
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
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <span>📅</span>
              <span>Meus eventos</span>
            </button>
            <button
              onClick={() => setActiveTab("MINHA_CONTA")}
              className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                activeTab === "MINHA_CONTA"
                  ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                  : "text-slate-400 hover:text-white"
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
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" /> ✓ Conectado
            </span>
            <p className="text-xs font-bold text-white">Google Calendar</p>
            <p className="text-[11px] text-slate-400">Agenda sempre em sintonia.</p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                MO
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white">{myName}</p>
                <p className="text-[11px] text-slate-400">Conta do cliente</p>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs pt-1">
              <Link href="/" className="text-slate-400 hover:text-rose-400">
                ↪ Sair da conta
              </Link>
              <Link href="/admin" className="text-amber-400 hover:underline">
                Painel ADM →
              </Link>
            </div>
          </div>
        </div>
      </aside>

      {/* CONTEÚDO PRINCIPAL DO CLIENTE */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
              {activeTab === "MEUS_EVENTOS" ? "ÁREA DO CLIENTE" : `CLIENTE · ${myName.toUpperCase()}`}
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "MEUS_EVENTOS" ? `Olá, ${myName.split(" ")[0]}!` : "Minha conta"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "MEUS_EVENTOS"
                ? "Seus próximos bons momentos estão aqui."
                : "Seus dados atualizados, sua conta protegida."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <div className="flex items-center gap-2 bg-[#111726] border border-slate-800 px-3.5 py-2 rounded-full text-xs text-slate-300 font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span>{clockGmt3}</span>
            </div>
            <div className="px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
              ✓ Senha válida por mais {daysRemaining} dias
            </div>
          </div>
        </header>

        {feedback && (
          <div className="mx-6 mt-5 p-3.5 rounded-xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs flex justify-between items-center">
            <span>{feedback}</span>
            <button onClick={() => setFeedback(null)} className="text-emerald-400 font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 flex-1">
          {activeTab === "MEUS_EVENTOS" && (
            <div className="space-y-6">
              {/* HERO CARD DO PRÓXIMO ENCONTRO */}
              {nextEvent && (
                <div className="bg-gradient-to-r from-[#161F33] to-[#111726] border border-amber-500/30 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div className="flex items-center gap-5">
                    <div className="w-20 h-20 rounded-2xl bg-[#0A0E17] border border-amber-500/30 flex flex-col items-center justify-center text-center shrink-0">
                      <span className="text-[10px] font-bold uppercase text-amber-400">DATA</span>
                      <span className="text-2xl font-extrabold text-white">
                        {nextEvent.eventDate.split("-")[2] || "28"}
                      </span>
                    </div>
                    <div className="space-y-1">
                      <span className="inline-block text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300">
                        ● {nextEvent.status === "CONFIRMADO" ? "Confirmado no Google Calendar" : "Aguardando confirmação"}
                      </span>
                      <h2 className="text-xl font-extrabold text-white">{nextEvent.title}</h2>
                      <p className="text-xs text-slate-300">
                        Para <strong>{nextEvent.honoreeName}</strong> · {nextEvent.startTime} às {nextEvent.endTime}{" "}
                        (GMT-3)
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* DUAS COLUNAS: + AGENDAR NOVO EVENTO + MEUS EVENTOS MARCADOS */}
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
                      <label className="block text-xs font-medium text-slate-300 mb-1.5">Categoria</label>
                      <select
                        value={eventType}
                        onChange={(e) => setEventType(e.target.value as EventRecord["eventType"])}
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                      >
                        <option value="ANIVERSARIO">🎂 Aniversário</option>
                        <option value="FESTA">🎉 Festa familiar</option>
                        <option value="FUTEBOL">⚽ Futebol</option>
                        <option value="CORPORATIVO">💼 Corporativo</option>
                      </select>
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

                  <p className="text-[11px] text-slate-400">
                    O espaço fica reservado por mais 1h para limpeza e preparação após o término do evento.
                  </p>

                  <button
                    type="submit"
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                  >
                    Solicitar agendamento →
                  </button>
                </form>

                {/* LISTA DE MEUS EVENTOS MARCADOS */}
                <div className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-extrabold text-white">Meus eventos marcados</h2>
                    <span className="text-xs text-slate-400">{allEvents.length} evento(s)</span>
                  </div>

                  {allEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Você ainda não possui eventos marcados. Use o formulário ao lado para solicitar sua primeira reserva!
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {allEvents.map((ev) => (
                        <div key={ev.id} className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 space-y-1.5">
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
                          <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                          <p className="text-xs text-slate-400">
                            {ev.eventDate} · {ev.startTime} - {ev.endTime} (GMT-3)
                          </p>
                          <p className="text-xs text-slate-500">
                            Para {ev.honoreeName} · {ev.responsibleAdmin}
                          </p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: MINHA CONTA (PÁGINA 9 DO PDF) */}
          {activeTab === "MINHA_CONTA" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleSaveProfile}
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Seus dados</h2>
                  <p className="text-xs text-slate-400">Mantenha seus contatos sempre atualizados.</p>
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
                  <label className="block text-xs font-medium text-slate-300 mb-1.5">Telefone</label>
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
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Salvar alterações
                </button>
              </form>

              <form
                onSubmit={handleUpdatePassword}
                className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Segurança da senha</h2>
                  <p className="text-xs text-slate-400">Uma senha forte protege todos os seus encontros.</p>
                </div>

                <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-emerald-400">🔒 Sua senha está em dia</p>
                    <p className="text-[11px] text-slate-300 mt-0.5">
                      Faltam {daysRemaining} de 90 dias para expirar
                    </p>
                  </div>
                  <span className="text-[11px] text-slate-400">Ciclo RBAC</span>
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
                  <span className={pwCheck.minLength ? "text-emerald-400" : "text-slate-500"}>
                    ✓ Mínimo de 8 caracteres
                  </span>
                  <span className={pwCheck.hasUpper && pwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                    ✓ Maiúscula e minúscula
                  </span>
                  <span className={pwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>
                    ✓ Pelo menos 1 número
                  </span>
                  <span className={pwCheck.hasSpecial ? "text-emerald-400" : "text-slate-500"}>
                    ✓ 1 caractere especial
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

                <p className="text-[11px] text-slate-400">Não repita nenhuma das suas últimas 3 senhas.</p>

                <button
                  type="submit"
                  className="w-full bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Atualizar minha senha
                </button>
              </form>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}