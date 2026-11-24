// tabs/admin/AdminDashboardTab.tsx
"use client";

import React, { useState } from "react";
import { MonthYearNavigator } from "../../components/shared/MonthYearNavigator";
import { EventStatusBadge } from "../../components/shared/StatusBadge";
import { EventRecord, EventStatus } from "../../models/event.model";
import { UserAccount } from "../../models/user.model";
import { generateGoogleCalendarUrl } from "../../services/eventSchedule.service";
import {
  calculateCleanupEndTime,
  formatIsoDatePtBr,
} from "../../utils/dateFormatters";
import { isStaffMemberInList } from "../../utils/stringFormatters";

export interface AdminDashboardTabProps {
  currentUser: UserAccount;
  events: EventRecord[];
  selectedYearMonth: string;
  onChangeYearMonth: (yearMonth: string) => void;
  onOpenQuickScheduleModal: () => void;
  onOpenEditEventModal: (event: EventRecord) => void;
  onApproveEvent: (event: EventRecord) => Promise<void>;
  onCancelEvent: (event: EventRecord) => Promise<void>;
  onToggleOwnPresence: (event: EventRecord) => Promise<void>;
}

/**
 * Isolated Admin Dashboard tab.
 * - Card #37: Clicking KPI cards filters and opens the event list directly inside the Dashboard without switching tabs.
 * - Card #38: ADM sees staff presence as read-only badges; only the assigned staff member can toggle their own presence.
 */
export function AdminDashboardTab({
  currentUser,
  events,
  selectedYearMonth,
  onChangeYearMonth,
  onOpenQuickScheduleModal,
  onOpenEditEventModal,
  onApproveEvent,
  onCancelEvent,
  onToggleOwnPresence,
}: AdminDashboardTabProps) {
  const [selectedKpiFilter, setSelectedKpiFilter] = useState<
    "TODOS" | EventStatus
  >("TODOS");

  const isAdmin = currentUser.role === "ADM";

  const monthEvents = events.filter((ev) =>
    ev.eventDate.startsWith(selectedYearMonth)
  );
  const confirmedEvents = monthEvents.filter(
    (ev) => ev.status === "CONFIRMADO"
  );
  const pendingEvents = monthEvents.filter((ev) => ev.status === "PENDENTE");
  const canceledEvents = monthEvents.filter((ev) => ev.status === "CANCELADO");

  const filteredDashboardEvents = monthEvents.filter((ev) =>
    selectedKpiFilter === "TODOS" ? true : ev.status === selectedKpiFilter
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
            Visão Executiva Mensal · Agenda do Mês (Cards #9, #28)
          </span>
          <h2 className="text-lg font-black text-white">
            Painel Operacional de Eventos & Escalas
          </h2>
        </div>

        {isAdmin && (
          <button
            type="button"
            onClick={onOpenQuickScheduleModal}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs shadow-lg shadow-amber-500/10 transition-colors"
          >
            + Novo agendamento rápido
          </button>
        )}
      </div>

      <MonthYearNavigator
        selectedYearMonth={selectedYearMonth}
        onChangeYearMonth={onChangeYearMonth}
      />

      {/* Interactive KPI Cards that open/filter the list in-place on the Dashboard (Cards #5, #32, #37) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setSelectedKpiFilter("TODOS")}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedKpiFilter === "TODOS"
              ? "bg-amber-500/15 border-amber-500 ring-2 ring-amber-500/30"
              : "bg-[#111726] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Eventos no Mês (Clique p/ listar)
          </span>
          <p className="text-3xl font-black text-white mt-1">
            {monthEvents.length}
          </p>
          <span className="text-[11px] text-amber-300 font-semibold mt-1 block">
            Exibindo lista abaixo ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedKpiFilter("CONFIRMADO")}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedKpiFilter === "CONFIRMADO"
              ? "bg-emerald-500/20 border-emerald-500 ring-2 ring-emerald-500/30"
              : "bg-[#111726] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-emerald-300">
            Confirmados · Verde
          </span>
          <p className="text-3xl font-black text-emerald-300 mt-1">
            {confirmedEvents.length}
          </p>
          <span className="text-[11px] text-emerald-200/80 font-semibold mt-1 block">
            Filtrar confirmados aqui ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedKpiFilter("PENDENTE")}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedKpiFilter === "PENDENTE"
              ? "bg-orange-500/20 border-orange-500 ring-2 ring-orange-500/30"
              : "bg-[#111726] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-orange-300">
            Pendentes · Laranja
          </span>
          <p className="text-3xl font-black text-orange-300 mt-1">
            {pendingEvents.length}
          </p>
          <span className="text-[11px] text-orange-200/80 font-semibold mt-1 block">
            Filtrar pendentes aqui ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedKpiFilter("CANCELADO")}
          className={`p-5 rounded-2xl border text-left transition-all ${
            selectedKpiFilter === "CANCELADO"
              ? "bg-red-500/20 border-red-500 ring-2 ring-red-500/30"
              : "bg-[#111726] border-slate-800 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-red-300">
            Cancelados · Vermelho
          </span>
          <p className="text-3xl font-black text-red-300 mt-1">
            {canceledEvents.length}
          </p>
          <span className="text-[11px] text-red-200/80 font-semibold mt-1 block">
            Filtrar cancelados aqui ↓
          </span>
        </button>
      </div>

      {/* In-Place KPI Filtered Event List Container (Card #37) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Agenda do Mês · Filtro Ativo: {selectedKpiFilter} (Card #37)
            </span>
            <h3 className="text-base font-black text-white">
              Eventos encontrados ({filteredDashboardEvents.length})
            </h3>
          </div>

          {selectedKpiFilter !== "TODOS" && (
            <button
              type="button"
              onClick={() => setSelectedKpiFilter("TODOS")}
              className="min-h-[38px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-xs font-bold text-slate-300 border border-slate-700"
            >
              Mostrar todos ({monthEvents.length})
            </button>
          )}
        </div>

        {filteredDashboardEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
            Nenhum evento registrado com o status {selectedKpiFilter} neste mês.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredDashboardEvents.map((ev) => {
              const isAssignedToCurrentUser = isStaffMemberInList(
                currentUser.name,
                ev.supportTeam
              );
              const isConfirmedByCurrentUser = isStaffMemberInList(
                currentUser.name,
                ev.confirmedStaff
              );

              return (
                <div
                  key={ev.id}
                  className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-black text-amber-300">
                        #{ev.id}
                      </span>
                      <EventStatusBadge status={ev.status} />
                      <span className="text-xs font-semibold text-slate-400">
                        Cliente: <strong className="text-slate-200">{ev.clientName}</strong>
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-white">
                      {ev.title} ({ev.eventType})
                    </h4>

                    <p className="text-xs text-slate-300">
                      📅 {formatIsoDatePtBr(ev.eventDate)} · ⏰ {ev.startTime} às{" "}
                      {ev.endTime} (+1h limpeza:{" "}
                      {calculateCleanupEndTime(ev.endTime)}) · 👥 {ev.honoreeName}
                    </p>

                    {/* Staff Roster & Read-Only Presence Badges for ADM (Cards #35, #38) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 mr-1">
                        Escala & Confirmação:
                      </span>
                      {(ev.supportTeam || []).map((memberName) => {
                        const confirmed = isStaffMemberInList(
                          memberName,
                          ev.confirmedStaff
                        );
                        return (
                          <span
                            key={memberName}
                            className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold border ${
                              confirmed
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                                : "bg-slate-950 text-amber-300 border-slate-800"
                            }`}
                          >
                            {confirmed ? "✓ " : "⏳ "}
                            {memberName}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Internal Staff self-service presence confirmation (Cards #36, #38) */}
                    {!isAdmin && isAssignedToCurrentUser && (
                      <button
                        type="button"
                        onClick={() => onToggleOwnPresence(ev)}
                        className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-black ${
                          isConfirmedByCurrentUser
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-amber-500 text-slate-950"
                        }`}
                      >
                        {isConfirmedByCurrentUser
                          ? "✓ Minha Presença Confirmada"
                          : "Confirmar minha presença"}
                      </button>
                    )}

                    {isAdmin && ev.status === "PENDENTE" && (
                      <button
                        type="button"
                        onClick={() => onApproveEvent(ev)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
                      >
                        ✓ Aprovar & Enviar E-mail
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => onOpenEditEventModal(ev)}
                        className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-xs border border-slate-700"
                      >
                        ✏️ Editar Escala / Detalhes
                      </button>
                    )}

                    {isAdmin && ev.status !== "CANCELADO" && (
                      <button
                        type="button"
                        onClick={() => onCancelEvent(ev)}
                        className="min-h-[40px] px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs"
                      >
                        Cancelar
                      </button>
                    )}

                    <a
                      href={generateGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[40px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-emerald-300 border border-slate-800 text-xs font-bold inline-flex items-center"
                    >
                      📅 Google Calendar
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}