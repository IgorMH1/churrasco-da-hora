// tabs/auth/PublicPreScheduleTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { MonthYearNavigator } from "../../components/shared/MonthYearNavigator";
import { EventStatusBadge } from "../../components/shared/StatusBadge";
import { SCHEDULE_RULES } from "../../config/constants";
import {
  formatAnatelPhone,
  validateAnatelPhone,
} from "../../lib/services/anatel";
import { EventRecord } from "../../models/event.model";
import { UserAccount } from "../../models/user.model";
import { saveEventsToStorage } from "../../repositories/event.repository";
import { syncAllTablesFromUsersList } from "../../repositories/user.repository";
import { markIsoForFirstLogin } from "../../services/auth.service";
import { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";
import {
  calculateCleanupEndTime,
  formatIsoDatePtBr,
} from "../../utils/dateFormatters";
import { formatGuestCountLabel } from "../../utils/stringFormatters";

export interface PublicPreScheduleTabProps {
  events: EventRecord[];
  allUsers: UserAccount[];
  onEventsUpdated: (updatedEvents: EventRecord[]) => void;
  onUsersUpdated: (updatedUsers: UserAccount[]) => void;
}

/**
 * Public pre-booking tab ("Agende seu evento") positioned on the left side of the public header (Card #29).
 */
export function PublicPreScheduleTab({
  events,
  allUsers,
  onEventsUpdated,
  onUsersUpdated,
}: PublicPreScheduleTabProps) {
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Churrasco Familiar");
  const [guestCount, setGuestCount] = useState("40 pessoas");
  const [eventDate, setEventDate] = useState("2026-11-25");
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

  const monthEvents = events.filter(
    (ev) =>
      ev.eventDate.startsWith(selectedYearMonth) && ev.status !== "CANCELADO"
  );

  const handlePreScheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const phoneCheck = validateAnatelPhone(clientPhone);
    if (!phoneCheck.valid) {
      setFeedback({
        type: "error",
        message:
          phoneCheck.error ||
          "Telefone inválido segundo o padrão nacional ANATEL.",
      });
      return;
    }

    const hasDateConflict = events.some(
      (ev) => ev.eventDate === eventDate && ev.status === "CONFIRMADO"
    );
    if (hasDateConflict) {
      setFeedback({
        type: "error",
        message:
          "Esta data já possui um evento CONFIRMADO na agenda. Escolha outro dia disponível.",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const nextEventId = `EVT-${String(events.length + 101).padStart(4, "0")}`;
      const newEvent: EventRecord = {
        id: nextEventId,
        title: title.trim(),
        eventType: eventType.trim() || "Evento",
        honoreeName: formatGuestCountLabel(guestCount),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim().toLowerCase(),
        responsibleAdmin: "Administrador Da Hora",
        eventDate,
        startTime,
        endTime,
        status: "PENDENTE",
        supportTeam: ["A definir pelo ADM"],
        confirmedStaff: [],
      };

      const updatedEvents = [newEvent, ...events];
      await saveEventsToStorage(updatedEvents);
      onEventsUpdated(updatedEvents);

      const existingUser = allUsers.find(
        (u) =>
          u.email.trim().toLowerCase() === clientEmail.trim().toLowerCase()
      );

      if (!existingUser) {
        const newClientId = `CLI-${String(allUsers.length + 101).padStart(
          4,
          "0"
        )}`;
        const newClientAccount: UserAccount = {
          id: newClientId,
          corporateId: getCorporateIdentityInfo({
            id: newClientId,
            role: "CLIENTE",
            status: "ATIVO",
          }).corporateCode,
          name: clientName.trim(),
          email: clientEmail.trim().toLowerCase(),
          phoneAnatel: phoneCheck.formatted || clientPhone.trim(),
          password: "Cliente@2026",
          role: "CLIENTE",
          status: "ATIVO",
          passwordChangedAtIso: markIsoForFirstLogin(),
          mustChangePassword: true,
        };
        const updatedUsers = [...allUsers, newClientAccount];
        await syncAllTablesFromUsersList(updatedUsers);
        onUsersUpdated(updatedUsers);
      }

      setTitle("");
      setFeedback({
        type: "success",
        message: `✓ Pré-reserva #${nextEventId} enviada com status PENDENTE! Assim que o ADM aprovar, você receberá o e-mail de confirmação.`,
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

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handlePreScheduleSubmit}
          className="lg:col-span-7 bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Solicitação Online de Reserva (GMT-3)
            </span>
            <h2 className="text-lg font-black text-white">
              Agende seu Evento no Churrasco dos Da Hora
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Seu Nome Completo
              </label>
              <input
                type="text"
                required
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Seu E-mail (Receberá a confirmação · Card #39)
              </label>
              <input
                type="email"
                required
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                WhatsApp / Celular (ANATEL)
              </label>
              <input
                type="tel"
                required
                placeholder="(11) 99999-0000"
                value={clientPhone}
                onChange={(e) =>
                  setClientPhone(formatAnatelPhone(e.target.value))
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Título da Reserva
              </label>
              <input
                type="text"
                required
                placeholder="Ex.: Churrasco Aniversário Lucas"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

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

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Data Desejada
              </label>
              <input
                type="date"
                required
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1">
                  Início
                </label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
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
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                />
              </div>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
          >
            {isSubmitting
              ? "Enviando solicitação..."
              : "Solicitar agendamento de evento →"}
          </button>
        </form>

        <div className="lg:col-span-5 bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Ocupação do Espaço
            </span>
            <h3 className="text-base font-black text-white">
              Datas Reservadas no Mês ({monthEvents.length})
            </h3>
          </div>

          {monthEvents.length === 0 ? (
            <p className="text-xs text-slate-400 py-6 text-center border border-dashed border-slate-800 rounded-xl">
              Nenhuma data ocupada neste mês até o momento.
            </p>
          ) : (
            <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1">
              {monthEvents.map((ev) => (
                <div
                  key={ev.id}
                  className="p-3.5 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-xs font-bold text-white">
                      {formatIsoDatePtBr(ev.eventDate)} · {ev.startTime} às{" "}
                      {ev.endTime}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      {ev.eventType} · {ev.honoreeName}
                    </p>
                  </div>
                  <EventStatusBadge status={ev.status} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}