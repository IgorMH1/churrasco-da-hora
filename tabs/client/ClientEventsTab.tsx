// tabs/client/ClientEventsTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { MonthYearNavigator } from "../../components/shared/MonthYearNavigator";
import { EventStatusBadge } from "../../components/shared/StatusBadge";
import { SCHEDULE_RULES } from "../../config/constants";
import { EventRecord, EventStatus } from "../../models/event.model";
import { UserAccount } from "../../models/user.model";
import { saveEventsToStorage } from "../../repositories/event.repository";
import { generateGoogleCalendarUrl } from "../../services/eventSchedule.service";
import {
  calculateCleanupEndTime,
  formatIsoDatePtBr,
} from "../../utils/dateFormatters";
import { formatGuestCountLabel } from "../../utils/stringFormatters";

export interface ClientEventsTabProps {
  currentUser: UserAccount;
  allEvents: EventRecord[];
  onEventsUpdated: (updatedEvents: EventRecord[]) => void;
}

/**
 * Isolated Client Events & Booking tab with interactive KPI cards (Card #6)
 * and semantic status colors (Card #31).
 */
export function ClientEventsTab({
  currentUser,
  allEvents,
  onEventsUpdated,
}: ClientEventsTabProps) {
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");
  const [statusFilter, setStatusFilter] = useState<"TODOS" | EventStatus>(
    "TODOS"
  );

  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Churrasco Familiar");
  const [guestCount, setGuestCount] = useState("35 pessoas");
  const [eventDate, setEventDate] = useState("2026-11-28");
  const [startTime, setStartTime] = useState<string>(
    SCHEDULE_RULES.DEFAULT_START_TIME
  );
  const [endTime, setEndTime] = useState<string>(
    SCHEDULE_RULES.DEFAULT_END_TIME
  );
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const clientEvents = allEvents.filter(
    (ev) =>
      (ev.clientEmail &&
        ev.clientEmail.toLowerCase() === currentUser.email.toLowerCase()) ||
      ev.clientName.trim().toLowerCase() ===
        currentUser.name.trim().toLowerCase()
  );

  const monthClientEvents = clientEvents.filter((ev) =>
    ev.eventDate.startsWith(selectedYearMonth)
  );

  const confirmedCount = monthClientEvents.filter(
    (ev) => ev.status === "CONFIRMADO"
  ).length;
  const pendingCount = monthClientEvents.filter(
    (ev) => ev.status === "PENDENTE"
  ).length;
  const canceledCount = monthClientEvents.filter(
    (ev) => ev.status === "CANCELADO"
  ).length;

  const visibleEvents = monthClientEvents.filter((ev) =>
    statusFilter === "TODOS" ? true : ev.status === statusFilter
  );

  const handleRequestNewEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!title.trim()) {
      setFeedback({
        type: "error",
        message: "Informe o título do seu evento.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const nextId = `EVT-${String(allEvents.length + 101).padStart(4, "0")}`;
      const newEvent: EventRecord = {
        id: nextId,
        title: title.trim(),
        eventType: eventType.trim() || "Evento",
        honoreeName: formatGuestCountLabel(guestCount),
        clientName: currentUser.name,
        clientEmail: currentUser.email,
        responsibleAdmin: "Administrador Da Hora",
        eventDate,
        startTime,
        endTime,
        status: "PENDENTE",
        supportTeam: ["A definir pelo ADM"],
        confirmedStaff: [],
      };

      const updated = [newEvent, ...allEvents];
      await saveEventsToStorage(updated);
      onEventsUpdated(updated);
      setTitle("");
      setFeedback({
        type: "success",
        message: `✓ Solicitação #${nextId} registrada como PENDENTE! Você receberá um e-mail assim que o Administrador confirmar.`,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <MonthYearNavigator
        selectedYearMonth={selectedYearMonth}
        onChangeYearMonth={setSelectedYearMonth}
      />

      {/* Interactive KPI Filter Cards (Cards #6, #31) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setStatusFilter("TODOS")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "TODOS"
              ? "bg-amber-500/15 border-amber-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Meus Eventos no Mês
          </span>
          <p className="text-2xl font-black text-white mt-1">
            {monthClientEvents.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("CONFIRMADO")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "CONFIRMADO"
              ? "bg-emerald-500/20 border-emerald-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-emerald-300">
            Confirmados (Verde)
          </span>
          <p className="text-2xl font-black text-emerald-300 mt-1">
            {confirmedCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("PENDENTE")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "PENDENTE"
              ? "bg-orange-500/20 border-orange-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-orange-300">
            Pendentes (Laranja)
          </span>
          <p className="text-2xl font-black text-orange-300 mt-1">
            {pendingCount}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setStatusFilter("CANCELADO")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            statusFilter === "CANCELADO"
              ? "bg-red-500/20 border-red-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-red-300">
            Cancelados (Vermelho)
          </span>
          <p className="text-2xl font-black text-red-300 mt-1">
            {canceledCount}
          </p>
        </button>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleRequestNewEvent}
          className="lg:col-span-5 bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Nova Reserva
            </span>
            <h2 className="text-base font-black text-white">
              Solicitar Novo Agendamento
            </h2>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Título do Evento
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Confraternização Anual"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Tipo do Evento
              </label>
              <input
                type="text"
                required
                value={eventType}
                onChange={(e) => setEventType(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Quantidade de Pessoas
              </label>
              <input
                type="text"
                required
                value={guestCount}
                onChange={(e) => setGuestCount(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Data do Evento
            </label>
            <input
              type="date"
              required
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Início
              </label>
              <input
                type="time"
                required
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Término (+1h: {calculateCleanupEndTime(endTime)})
              </label>
              <input
                type="time"
                required
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs"
          >
            {isSubmitting ? "Enviando..." : "Enviar solicitação de reserva →"}
          </button>
        </form>

        <div className="lg:col-span-7 bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
                Histórico e Status
              </span>
              <h2 className="text-base font-black text-white">
                Minhas Reservas ({visibleEvents.length})
              </h2>
            </div>
          </div>

          {visibleEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
              Nenhum evento encontrado para o filtro e mês selecionados.
            </p>
          ) : (
            <div className="space-y-3">
              {visibleEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[11px] font-bold text-amber-300">
                        #{ev.id}
                      </span>
                      <EventStatusBadge status={ev.status} />
                    </div>
                    <h3 className="text-sm font-black text-white">
                      {ev.title} ({ev.eventType})
                    </h3>
                    <p className="text-xs text-slate-300">
                      📅 {formatIsoDatePtBr(ev.eventDate)} · ⏰ {ev.startTime}{" "}
                      às {ev.endTime} · 👥 {ev.honoreeName}
                    </p>
                  </div>

                  {ev.status === "CONFIRMADO" && (
                    <a
                      href={generateGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/40 text-xs font-bold inline-flex items-center justify-center whitespace-nowrap"
                    >
                      📅 Google Calendar
                    </a>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}