// tabs/staff/StaffScheduleTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { MonthYearNavigator } from "../../components/shared/MonthYearNavigator";
import { EventStatusBadge } from "../../components/shared/StatusBadge";
import { EventRecord } from "../../models/event.model";
import { RoleParameterRule } from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import { saveEventsToStorage } from "../../repositories/event.repository";
import { generateGoogleCalendarUrl } from "../../services/eventSchedule.service";
import { calculateShiftRateForEvent } from "../../services/shiftRate.service";
import {
  calculateCleanupEndTime,
  formatIsoDatePtBr,
} from "../../utils/dateFormatters";
import { isStaffMemberInList } from "../../utils/stringFormatters";

export interface StaffScheduleTabProps {
  currentUser: UserAccount;
  allEvents: EventRecord[];
  roleRules: RoleParameterRule[];
  onEventsUpdated: (updatedEvents: EventRecord[]) => void;
}

type StaffFilterMode = "MEUS_ESCALADOS" | "CONFIRMADOS" | "PENDENTES" | "TODOS";

/**
 * Isolated External/Internal Staff schedule tab with automatic shift daily rate calculation (Card #41)
 * and self-service presence confirmation (Cards #35, #36, #38).
 */
export function StaffScheduleTab({
  currentUser,
  allEvents,
  roleRules,
  onEventsUpdated,
}: StaffScheduleTabProps) {
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");
  const [filterMode, setFilterMode] =
    useState<StaffFilterMode>("MEUS_ESCALADOS");
  const [feedback, setFeedback] = useState<string>("");

  const monthEvents = allEvents.filter(
    (ev) =>
      ev.eventDate.startsWith(selectedYearMonth) && ev.status !== "CANCELADO"
  );

  const assignedToMeEvents = monthEvents.filter((ev) =>
    isStaffMemberInList(currentUser.name, ev.supportTeam)
  );

  const confirmedByMeEvents = assignedToMeEvents.filter((ev) =>
    isStaffMemberInList(currentUser.name, ev.confirmedStaff)
  );

  const awaitingMyConfirmationEvents = assignedToMeEvents.filter(
    (ev) => !isStaffMemberInList(currentUser.name, ev.confirmedStaff)
  );

  const estimatedMonthlyEarnings = confirmedByMeEvents.reduce((acc, ev) => {
    const shiftRate = calculateShiftRateForEvent(
      ev.startTime,
      currentUser,
      roleRules
    );
    return acc + shiftRate.rateValue;
  }, 0);

  const visibleEvents = monthEvents.filter((ev) => {
    if (filterMode === "MEUS_ESCALADOS") {
      return isStaffMemberInList(currentUser.name, ev.supportTeam);
    }
    if (filterMode === "CONFIRMADOS") {
      return (
        isStaffMemberInList(currentUser.name, ev.supportTeam) &&
        isStaffMemberInList(currentUser.name, ev.confirmedStaff)
      );
    }
    if (filterMode === "PENDENTES") {
      return (
        isStaffMemberInList(currentUser.name, ev.supportTeam) &&
        !isStaffMemberInList(currentUser.name, ev.confirmedStaff)
      );
    }
    return true;
  });

  const handleToggleMyPresence = async (targetEvent: EventRecord) => {
    const currentConfirmed = targetEvent.confirmedStaff || [];
    const alreadyConfirmed = isStaffMemberInList(
      currentUser.name,
      currentConfirmed
    );

    const updatedConfirmed = alreadyConfirmed
      ? currentConfirmed.filter(
          (name) =>
            name.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        )
      : [...currentConfirmed, currentUser.name];

    const updatedEvents = allEvents.map((ev) =>
      ev.id === targetEvent.id
        ? { ...ev, confirmedStaff: updatedConfirmed }
        : ev
    );

    await saveEventsToStorage(updatedEvents);
    onEventsUpdated(updatedEvents);
    setFeedback(
      alreadyConfirmed
        ? `Presença desmarcada no evento #${targetEvent.id}.`
        : `✓ Sua presença foi confirmada no evento #${targetEvent.id}!`
    );
  };

  return (
    <div className="space-y-6">
      <MonthYearNavigator
        selectedYearMonth={selectedYearMonth}
        onChangeYearMonth={setSelectedYearMonth}
      />

      {/* Interactive KPI Cards with Shift Daily Rate Summary (Card #41) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          type="button"
          onClick={() => setFilterMode("MEUS_ESCALADOS")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === "MEUS_ESCALADOS"
              ? "bg-amber-500/15 border-amber-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-slate-400">
            Minha Escala no Mês
          </span>
          <p className="text-2xl font-black text-white mt-1">
            {assignedToMeEvents.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("CONFIRMADOS")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === "CONFIRMADOS"
              ? "bg-emerald-500/20 border-emerald-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-emerald-300">
            Presenças Confirmadas
          </span>
          <p className="text-2xl font-black text-emerald-300 mt-1">
            {confirmedByMeEvents.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("PENDENTES")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === "PENDENTES"
              ? "bg-orange-500/20 border-orange-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-orange-300">
            Aguardando Confirmação
          </span>
          <p className="text-2xl font-black text-orange-300 mt-1">
            {awaitingMyConfirmationEvents.length}
          </p>
        </button>

        <button
          type="button"
          onClick={() => setFilterMode("TODOS")}
          className={`p-4 rounded-2xl border text-left transition-all ${
            filterMode === "TODOS"
              ? "bg-sky-500/20 border-sky-500 text-white"
              : "bg-[#111726] border-slate-800 text-slate-300"
          }`}
        >
          <span className="text-[11px] font-bold uppercase text-sky-300">
            Repasse Estimado (Confirmados)
          </span>
          <p className="text-2xl font-black text-sky-300 mt-1">
            R$ {estimatedMonthlyEarnings}
          </p>
        </button>
      </div>

      {feedback && (
        <FeedbackBanner
          type="success"
          message={feedback}
          onDismiss={() => setFeedback("")}
        />
      )}

      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Agenda Operacional · Somente Visualização do Espaço & Confirmação
              Própria (Card #36)
            </span>
            <h2 className="text-base font-black text-white">
              Eventos listados ({visibleEvents.length})
            </h2>
          </div>
        </div>

        {visibleEvents.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center border border-dashed border-slate-800 rounded-xl">
            Nenhum evento encontrado para este filtro no mês selecionado.
          </p>
        ) : (
          <div className="space-y-3">
            {visibleEvents.map((ev) => {
              const isAssigned = isStaffMemberInList(
                currentUser.name,
                ev.supportTeam
              );
              const isConfirmed = isStaffMemberInList(
                currentUser.name,
                ev.confirmedStaff
              );
              const shiftRate = calculateShiftRateForEvent(
                ev.startTime,
                currentUser,
                roleRules
              );

              return (
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
                      <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                        {shiftRate.shiftLabel}: R$ {shiftRate.rateValue}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-white">
                      {ev.title} ({ev.eventType})
                    </h3>
                    <p className="text-xs text-slate-300">
                      📅 {formatIsoDatePtBr(ev.eventDate)} · ⏰ {ev.startTime}{" "}
                      às {ev.endTime} (+1h limpeza:{" "}
                      {calculateCleanupEndTime(ev.endTime)}) · 👥{" "}
                      {ev.honoreeName}
                    </p>
                    <p className="text-[11px] text-slate-400">
                      Equipe escalada: {(ev.supportTeam || []).join(", ")}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {isAssigned && (
                      <button
                        type="button"
                        onClick={() => handleToggleMyPresence(ev)}
                        className={`min-h-[42px] px-4 py-2 rounded-xl text-xs font-black transition-colors ${
                          isConfirmed
                            ? "bg-emerald-500 text-slate-950"
                            : "bg-amber-500 hover:bg-amber-400 text-slate-950"
                        }`}
                      >
                        {isConfirmed
                          ? "✓ Presença Confirmada (Clique p/ desmarcar)"
                          : "Confirmar minha presença"}
                      </button>
                    )}

                    <a
                      href={generateGoogleCalendarUrl(ev)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[42px] px-3.5 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold inline-flex items-center"
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