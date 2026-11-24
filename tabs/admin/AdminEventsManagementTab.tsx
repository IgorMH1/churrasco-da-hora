// tabs/admin/AdminEventsManagementTab.tsx
"use client";

import React, { useRef, useState } from "react";
import { MonthYearNavigator } from "../../components/shared/MonthYearNavigator";
import { EventStatusBadge } from "../../components/shared/StatusBadge";
import { SCHEDULE_RULES } from "../../config/constants";
import { EventRecord, EventStatus } from "../../models/event.model";
import { UserAccount } from "../../models/user.model";
import { generateGoogleCalendarUrl } from "../../services/eventSchedule.service";
import {
  calculateCleanupEndTime,
  formatIsoDatePtBr,
  getCalendarMonthGeometry,
} from "../../utils/dateFormatters";
import { isStaffMemberInList } from "../../utils/stringFormatters";

export interface AdminEventsManagementTabProps {
  currentUser: UserAccount;
  events: EventRecord[];
  selectedYearMonth: string;
  onChangeYearMonth: (nextYearMonth: string) => void;
  onOpenQuickScheduleModal: (prefilledDate?: string) => void;
  onOpenEditScaleModal: (eventRecord: EventRecord) => void;
  onApprovePendingEvent: (eventRecord: EventRecord) => Promise<void>;
  onCancelEvent: (eventRecord: EventRecord) => Promise<void>;
}

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/**
 * Isolated Events Management tab with full-width monthly calendar (Card #23),
 * double-click day quick scheduling (Card #24), status counters (Card #27),
 * and direct approval with automated client email (Cards #26, #39).
 */
export function AdminEventsManagementTab({
  currentUser,
  events,
  selectedYearMonth,
  onChangeYearMonth,
  onOpenQuickScheduleModal,
  onOpenEditScaleModal,
  onApprovePendingEvent,
  onCancelEvent,
}: AdminEventsManagementTabProps) {
  const [statusFilter, setStatusFilter] = useState<"TODOS" | EventStatus>(
    "TODOS"
  );
  const [selectedDayDate, setSelectedDayDate] = useState<string | null>(null);
  const lastClickRef = useRef<{ date: string; timestamp: number }>({
    date: "",
    timestamp: 0,
  });

  const isReadOnlyInternalStaff = currentUser.role === "EQUIPE_INTERNA";

  const { daysInMonth, firstWeekday } =
    getCalendarMonthGeometry(selectedYearMonth);

  const monthEvents = events.filter((ev) =>
    ev.eventDate.startsWith(selectedYearMonth)
  );

  const confirmedCount = monthEvents.filter(
    (ev) => ev.status === "CONFIRMADO"
  ).length;
  const pendingCount = monthEvents.filter(
    (ev) => ev.status === "PENDENTE"
  ).length;
  const canceledCount = monthEvents.filter(
    (ev) => ev.status === "CANCELADO"
  ).length;

  const visibleEvents = monthEvents.filter((ev) => {
    const matchesStatus =
      statusFilter === "TODOS" ? true : ev.status === statusFilter;
    const matchesDay = selectedDayDate
      ? ev.eventDate === selectedDayDate
      : true;
    return matchesStatus && matchesDay;
  });

  const handleCalendarDayInteraction = (fullDateStr: string) => {
    const now = performance.now();
    const isDoubleClick =
      lastClickRef.current.date === fullDateStr &&
      now - lastClickRef.current.timestamp <
        SCHEDULE_RULES.CALENDAR_DOUBLE_CLICK_THRESHOLD_MS;

    lastClickRef.current = { date: fullDateStr, timestamp: now };

    if (isDoubleClick && !isReadOnlyInternalStaff) {
      onOpenQuickScheduleModal(fullDateStr);
      return;
    }

    setSelectedDayDate((prev) => (prev === fullDateStr ? null : fullDateStr));
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar & Status Counters (Cards #24, #27, #30) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
            Gestão Completa de Agenda & Aprovações (GMT-3)
          </span>
          <h2 className="text-lg font-black text-white">
            Calendário Operacional e Controle de Reservas
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setStatusFilter("TODOS")}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              statusFilter === "TODOS"
                ? "bg-amber-500 text-slate-950 font-black border-amber-400"
                : "bg-slate-900 text-slate-300 border-slate-800"
            }`}
          >
            Todos ({monthEvents.length})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("CONFIRMADO")}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              statusFilter === "CONFIRMADO"
                ? "bg-emerald-500 text-slate-950 font-black border-emerald-400"
                : "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
            }`}
          >
            Confirmados ({confirmedCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("PENDENTE")}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              statusFilter === "PENDENTE"
                ? "bg-orange-500 text-slate-950 font-black border-orange-400"
                : "bg-orange-500/15 text-orange-300 border-orange-500/30"
            }`}
          >
            Pendentes ({pendingCount})
          </button>
          <button
            type="button"
            onClick={() => setStatusFilter("CANCELADO")}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-xl text-xs font-bold border ${
              statusFilter === "CANCELADO"
                ? "bg-red-500 text-slate-950 font-black border-red-400"
                : "bg-red-500/15 text-red-300 border-red-500/30"
            }`}
          >
            Cancelados ({canceledCount})
          </button>

          {!isReadOnlyInternalStaff && (
            <button
              type="button"
              onClick={() =>
                onOpenQuickScheduleModal(
                  selectedDayDate || `${selectedYearMonth}-20`
                )
              }
              className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/10"
            >
              + Novo agendamento rápido
            </button>
          )}
        </div>
      </div>

      <MonthYearNavigator
        selectedYearMonth={selectedYearMonth}
        onChangeYearMonth={(nextYm) => {
          setSelectedDayDate(null);
          onChangeYearMonth(nextYm);
        }}
      />

      {/* Full-Width Monthly Calendar Grid (Cards #23, #24, #34) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-slate-300">
            💡 Clique em um dia para filtrar ou dê{" "}
            <strong className="text-amber-300">duplo clique</strong> no dia para
            abrir o Novo Agendamento Rápido.
          </span>
          {selectedDayDate && (
            <button
              type="button"
              onClick={() => setSelectedDayDate(null)}
              className="text-xs font-bold text-amber-400 hover:underline"
            >
              Limpar filtro do dia {formatIsoDatePtBr(selectedDayDate)} ✕
            </button>
          )}
        </div>

        <div className="grid grid-cols-7 gap-2 text-center">
          {WEEKDAY_HEADERS.map((weekday) => (
            <div
              key={weekday}
              className="text-[11px] font-black uppercase text-slate-400 py-1.5"
            >
              {weekday}
            </div>
          ))}

          {Array.from({ length: firstWeekday }).map((_, idx) => (
            <div
              key={`empty-${idx}`}
              className="min-h-[84px] rounded-xl bg-slate-950/30 border border-slate-900"
            />
          ))}

          {Array.from({ length: daysInMonth }).map((_, idx) => {
            const dayNumber = idx + 1;
            const fullDate = `${selectedYearMonth}-${String(dayNumber).padStart(
              2,
              "0"
            )}`;
            const dayEvents = monthEvents.filter(
              (ev) => ev.eventDate === fullDate
            );
            const isSelected = selectedDayDate === fullDate;

            return (
              <button
                key={fullDate}
                type="button"
                onClick={() => handleCalendarDayInteraction(fullDate)}
                className={`min-h-[84px] p-2 rounded-xl border text-left flex flex-col justify-between transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isSelected
                    ? "bg-amber-500/20 border-amber-400"
                    : "bg-slate-900/80 border-slate-800 hover:border-slate-700"
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="text-xs font-black text-white">
                    {dayNumber}
                  </span>
                  {dayEvents.length > 0 && (
                    <span className="text-[10px] font-black px-1.5 py-0.5 rounded-md bg-slate-950 text-amber-300">
                      {dayEvents.length}
                    </span>
                  )}
                </div>

                <div className="space-y-1 w-full overflow-hidden">
                  {dayEvents.slice(0, 2).map((ev) => {
                    const dotColor =
                      ev.status === "CONFIRMADO"
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : ev.status === "PENDENTE"
                        ? "bg-orange-500/20 text-orange-300 border-orange-500/40"
                        : "bg-red-500/20 text-red-300 border-red-500/40";
                    return (
                      <div
                        key={ev.id}
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border truncate ${dotColor}`}
                      >
                        {ev.startTime} {ev.title}
                      </div>
                    );
                  })}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Events List with Direct Approval & Scale Editing (Cards #12, #26, #35, #38) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-black text-white">
          Lista de Eventos ({visibleEvents.length})
        </h3>

        {visibleEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
            Nenhum evento listado para este filtro.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((ev) => (
              <div
                key={ev.id}
                className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-black text-amber-300">
                      #{ev.id}
                    </span>
                    <EventStatusBadge status={ev.status} />
                    <span className="text-xs font-bold text-slate-300">
                      📅 {formatIsoDatePtBr(ev.eventDate)} · ⏰ {ev.startTime} às{" "}
                      {ev.endTime} (+1h limpeza:{" "}
                      {calculateCleanupEndTime(ev.endTime)})
                    </span>
                  </div>

                  <h4 className="text-sm font-black text-white">
                    {ev.title} ({ev.eventType}) · 👥 {ev.honoreeName}
                  </h4>

                  <p className="text-xs text-slate-400">
                    Cliente: <strong className="text-white">{ev.clientName}</strong>{" "}
                    {ev.clientEmail ? `(${ev.clientEmail})` : ""}
                  </p>

                  <div className="flex flex-wrap items-center gap-1.5 pt-1">
                    {(ev.supportTeam || []).map((staffName) => {
                      const confirmed = isStaffMemberInList(
                        staffName,
                        ev.confirmedStaff
                      );
                      return (
                        <span
                          key={staffName}
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            confirmed
                              ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                              : "bg-slate-950 text-amber-300 border-slate-800"
                          }`}
                        >
                          {confirmed ? "✓ " : "⏳ "}
                          {staffName}
                        </span>
                      );
                    })}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  {!isReadOnlyInternalStaff && (
                    <>
                      {ev.status === "PENDENTE" && (
                        <button
                          type="button"
                          onClick={() => onApprovePendingEvent(ev)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
                        >
                          ✓ Aprovar na gestão
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => onOpenEditScaleModal(ev)}
                        className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs"
                      >
                        ✏️ Editar dados / escala
                      </button>

                      {ev.status !== "CANCELADO" && (
                        <button
                          type="button"
                          onClick={() => onCancelEvent(ev)}
                          className="min-h-[42px] px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs"
                        >
                          Cancelar
                        </button>
                      )}
                    </>
                  )}

                  <a
                    href={generateGoogleCalendarUrl(ev)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-emerald-500/30 text-xs font-bold inline-flex items-center"
                  >
                    📅 Google Calendar
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}