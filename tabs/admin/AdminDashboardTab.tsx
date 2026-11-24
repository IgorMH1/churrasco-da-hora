// tabs/admin/AdminDashboardTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
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
  onChangeYearMonth: (nextYearMonth: string) => void;
  onApprovePendingEvent: (eventRecord: EventRecord) => Promise<void>;
  onCancelEvent: (eventRecord: EventRecord) => Promise<void>;
  onOpenEditScaleModal: (eventRecord: EventRecord) => void;
  onToggleOwnStaffPresence: (eventRecord: EventRecord) => Promise<void>;
}

/**
 * Isolated Admin Dashboard tab.
 * Clicking KPI cards filters and displays the event list directly inside the Dashboard
 * without navigating away to the Events tab (Card #37).
 * ADM cannot confirm presence on behalf of staff (Card #38); Internal Staff can confirm their own presence (Cards #35, #36).
 */
export function AdminDashboardTab({
  currentUser,
  events,
  selectedYearMonth,
  onChangeYearMonth,
  onApprovePendingEvent,
  onCancelEvent,
  onOpenEditScaleModal,
  onToggleOwnStaffPresence,
}: AdminDashboardTabProps) {
  const [kpiFilter, setKpiFilter] = useState<"TODOS" | EventStatus>("TODOS");
  const [feedback, setFeedback] = useState<string>("");

  const isReadOnlyInternalStaff = currentUser.role === "EQUIPE_INTERNA";

  const monthEvents = events.filter((ev) =>
    ev.eventDate.startsWith(selectedYearMonth)
  );

  const confirmedEvents = monthEvents.filter(
    (ev) => ev.status === "CONFIRMADO"
  );
  const pendingEvents = monthEvents.filter((ev) => ev.status === "PENDENTE");
  const canceledEvents = monthEvents.filter((ev) => ev.status === "CANCELADO");

  const filteredDashboardEvents = monthEvents.filter((ev) =>
    kpiFilter === "TODOS" ? true : ev.status === kpiFilter
  );

  const handleApproveClick = async (ev: EventRecord) => {
    await onApprovePendingEvent(ev);
    setFeedback(
      `✓ Evento #${ev.id} confirmado na agenda e notificação disparada ao cliente!`
    );
  };

  return (
    <div className="space-y-6">
      <MonthYearNavigator
        selectedYearMonth={selectedYearMonth}
        onChangeYearMonth={onChangeYearMonth}
      />

      {/* Interactive KPI Cards that filter the inline Dashboard list (Cards #5, #8, #32, #37) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setKpiFilter("TODOS")}
          className={`p-5 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
            kpiFilter === "TODOS"
              ? "bg-amber-500/15 border-amber-500 text-white shadow-lg"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
            Eventos no Mês (Clique p/ listar)
          </span>
          <p className="text-3xl font-black text-white mt-1">
            {monthEvents.length}
          </p>
          <span className="text-[11px] text-amber-300 font-semibold mt-1 inline-block">
            Exibir todos no Dashboard ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setKpiFilter("CONFIRMADO")}
          className={`p-5 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 ${
            kpiFilter === "CONFIRMADO"
              ? "bg-emerald-500/20 border-emerald-500 text-white shadow-lg"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300">
            Confirmados · Verde
          </span>
          <p className="text-3xl font-black text-emerald-300 mt-1">
            {confirmedEvents.length}
          </p>
          <span className="text-[11px] text-emerald-200/80 font-semibold mt-1 inline-block">
            Filtrar confirmados aqui ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setKpiFilter("PENDENTE")}
          className={`p-5 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400 ${
            kpiFilter === "PENDENTE"
              ? "bg-orange-500/20 border-orange-500 text-white shadow-lg"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-orange-300">
            Pendentes · Laranja
          </span>
          <p className="text-3xl font-black text-orange-300 mt-1">
            {pendingEvents.length}
          </p>
          <span className="text-[11px] text-orange-200/80 font-semibold mt-1 inline-block">
            Filtrar pendentes aqui ↓
          </span>
        </button>

        <button
          type="button"
          onClick={() => setKpiFilter("CANCELADO")}
          className={`p-5 rounded-2xl border text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 ${
            kpiFilter === "CANCELADO"
              ? "bg-red-500/20 border-red-500 text-white shadow-lg"
              : "bg-[#111726] border-slate-800 text-slate-300 hover:border-slate-700"
          }`}
        >
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-300">
            Cancelados · Vermelho
          </span>
          <p className="text-3xl font-black text-red-300 mt-1">
            {canceledEvents.length}
          </p>
          <span className="text-[11px] text-red-200/80 font-semibold mt-1 inline-block">
            Filtrar cancelados aqui ↓
          </span>
        </button>
      </div>

      {feedback && (
        <FeedbackBanner
          type="success"
          message={feedback}
          onDismiss={() => setFeedback("")}
        />
      )}

      {/* Inline KPI Filtered List & Monthly Schedule Container (Cards #9, #28, #35, #37, #38) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Agenda do Mês · Lista Direta no Dashboard (Card #37)
            </span>
            <h2 className="text-lg font-black text-white">
              Eventos Filtrados:{" "}
              <span className="text-amber-300">{kpiFilter}</span> (
              {filteredDashboardEvents.length})
            </h2>
          </div>

          {isReadOnlyInternalStaff && (
            <span className="text-xs font-bold px-3 py-1.5 rounded-xl bg-sky-500/15 text-sky-300 border border-sky-500/30">
              👁️ Visão Equipe Interna (Somente Leitura · Confirme sua presença
              abaixo)
            </span>
          )}
        </div>

        {filteredDashboardEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-10 text-center border border-dashed border-slate-800 rounded-xl">
            Nenhum evento com status <strong>{kpiFilter}</strong> neste mês.
          </p>
        ) : (
          <div className="space-y-3">
            {filteredDashboardEvents.map((ev) => {
              const isAssignedToCurrentStaff = isStaffMemberInList(
                currentUser.name,
                ev.supportTeam
              );
              const isConfirmedByCurrentStaff = isStaffMemberInList(
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
                      <span className="text-xs font-bold text-slate-300">
                        📅 {formatIsoDatePtBr(ev.eventDate)} · ⏰ {ev.startTime}{" "}
                        às {ev.endTime} (+1h limpeza:{" "}
                        {calculateCleanupEndTime(ev.endTime)})
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white">
                      {ev.title}{" "}
                      <span className="text-xs font-semibold text-slate-400">
                        ({ev.eventType} · 👥 {ev.honoreeName})
                      </span>
                    </h3>

                    <p className="text-xs text-slate-400">
                      Cliente:{" "}
                      <strong className="text-slate-200">{ev.clientName}</strong>{" "}
                      {ev.clientEmail ? `(${ev.clientEmail})` : ""} · Resp. ADM:{" "}
                      {ev.responsibleAdmin}
                    </p>

                    {/* Read-only Staff Confirmation Badges for ADM (Cards #35, #38) */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      <span className="text-[11px] font-bold text-slate-400 mr-1">
                        Escala & Confirmação da Equipe:
                      </span>
                      {(ev.supportTeam || []).map((memberName) => {
                        const isConfirmed = isStaffMemberInList(
                          memberName,
                          ev.confirmedStaff
                        );
                        return (
                          <span
                            key={memberName}
                            className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                              isConfirmed
                                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                                : "bg-slate-950 text-amber-300 border-slate-800"
                            }`}
                          >
                            {isConfirmed ? "✓ " : "⏳ "}
                            {memberName}
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    {/* Internal Staff can only toggle their own presence (Cards #36, #38) */}
                    {isReadOnlyInternalStaff && isAssignedToCurrentStaff && (
                      <button
                        type="button"
                        onClick={() => onToggleOwnStaffPresence(ev)}
                        className={`min-h-[42px] px-3.5 py-2 rounded-xl text-xs font-black transition-colors ${
                          isConfirmedByCurrentStaff
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                        }`}
                      >
                        {isConfirmedByCurrentStaff
                          ? "✓ Minha Presença Confirmada"
                          : "Confirmar minha presença"}
                      </button>
                    )}

                    {/* Admin-Only Management Actions */}
                    {!isReadOnlyInternalStaff && (
                      <>
                        {ev.status === "PENDENTE" && (
                          <button
                            type="button"
                            onClick={() => handleApproveClick(ev)}
                            className="min-h-[42px] px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-colors"
                          >
                            ✓ Aprovar & Enviar E-mail
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => onOpenEditScaleModal(ev)}
                          className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 font-bold text-xs transition-colors"
                        >
                          ✏️ Editar / Escala
                        </button>

                        {ev.status !== "CANCELADO" && (
                          <button
                            type="button"
                            onClick={() => onCancelEvent(ev)}
                            className="min-h-[42px] px-3 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs transition-colors"
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
                      📅 GCal
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