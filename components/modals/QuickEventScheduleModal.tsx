// components/modals/QuickEventScheduleModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { SCHEDULE_RULES } from "../../config/constants";
import { CreateEventDto, EventStatus } from "../../models/event.model";
import { StaffMember } from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import { calculateCleanupEndTime } from "../../utils/dateFormatters";
import { formatGuestCountLabel } from "../../utils/stringFormatters";

export interface QuickEventScheduleModalProps {
  isOpen: boolean;
  initialDate: string;
  currentAdminName: string;
  clientsList: UserAccount[];
  activeStaffList: StaffMember[];
  onClose: () => void;
  onCreateEvent: (dto: CreateEventDto) => Promise<void>;
}

/**
 * Modal for "+ Novo agendamento rápido" triggered by the top button or calendar double-click (Cards #13, #21, #24, #25).
 */
export function QuickEventScheduleModal({
  isOpen,
  initialDate,
  currentAdminName,
  clientsList,
  activeStaffList,
  onClose,
  onCreateEvent,
}: QuickEventScheduleModalProps) {
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("Churrasco Familiar");
  const [guestCount, setGuestCount] = useState("40 pessoas");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [eventDate, setEventDate] = useState(initialDate || "2026-11-20");
  const [startTime, setStartTime] = useState<string>(
    SCHEDULE_RULES.DEFAULT_START_TIME
  );
  const [endTime, setEndTime] = useState<string>(SCHEDULE_RULES.DEFAULT_END_TIME);
  const [status, setStatus] = useState<EventStatus>("CONFIRMADO");
  const [selectedStaff, setSelectedStaff] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (initialDate) {
      setEventDate(initialDate);
    }
  }, [initialDate]);

  if (!isOpen) return null;

  const toggleStaffMember = (staffName: string) => {
    setSelectedStaff((prev) =>
      prev.includes(staffName)
        ? prev.filter((name) => name !== staffName)
        : [...prev, staffName]
    );
  };

  const handleSelectExistingClient = (selectedClientEmail: string) => {
    setClientEmail(selectedClientEmail);
    const matched = clientsList.find(
      (c) => c.email.toLowerCase() === selectedClientEmail.toLowerCase()
    );
    if (matched) {
      setClientName(matched.name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !clientName.trim()) return;

    setIsSubmitting(true);
    try {
      await onCreateEvent({
        title: title.trim(),
        eventType: eventType.trim() || "Evento",
        guestCount: formatGuestCountLabel(guestCount),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        responsibleAdmin: currentAdminName,
        eventDate,
        startTime,
        endTime,
        status,
        supportTeam:
          selectedStaff.length > 0 ? selectedStaff : ["A definir pelo ADM"],
      });
      setTitle("");
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="quick-schedule-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#111726] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Agendamento Direto na Agenda (GMT-3)
            </span>
            <h2
              id="quick-schedule-modal-title"
              className="text-lg font-black text-white"
            >
              + Novo Agendamento Rápido
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Título do Evento
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Aniversário Família Silva"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Tipo / Descrição Livre (Card #13)
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: Churrasco Corporativo"
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Quantidade de Pessoas (Card #25)
            </label>
            <input
              type="text"
              required
              placeholder="Ex.: 50 pessoas"
              value={guestCount}
              onChange={(e) => setGuestCount(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Status Inicial
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="CONFIRMADO">CONFIRMADO (Dispara E-mail + Agenda)</option>
              <option value="PENDENTE">PENDENTE</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Selecionar Cliente Cadastrado (Opcional)
            </label>
            <select
              value={clientEmail}
              onChange={(e) => handleSelectExistingClient(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="">-- Digitar manualmente --</option>
              {clientsList.map((c) => (
                <option key={c.id} value={c.email}>
                  {c.name} ({c.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Nome do Cliente Responsável
            </label>
            <input
              type="text"
              required
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div className="sm:col-span-2">
            <label className="block text-xs font-bold text-slate-300 mb-1">
              E-mail do Cliente (para disparo automático de confirmação · Card #39)
            </label>
            <input
              type="email"
              placeholder="cliente@email.com"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
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
                Término (+1h limpeza: {calculateCleanupEndTime(endTime)})
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

        <div>
          <span className="block text-xs font-bold text-slate-300 mb-2">
            Escalar Equipe de Apoio ({selectedStaff.length} selecionados)
          </span>
          <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-xl bg-slate-900/90 border border-slate-800">
            {activeStaffList.map((member) => {
              const isSelected = selectedStaff.includes(member.name);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggleStaffMember(member.name)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
                    isSelected
                      ? "bg-amber-500 text-slate-950 font-black"
                      : "bg-slate-950 text-slate-300 border border-slate-800 hover:bg-slate-800"
                  }`}
                >
                  {isSelected ? "✓ " : "+ "}
                  {member.name} ({member.specialty})
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-slate-900 text-slate-300 text-xs font-bold border border-slate-700"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs"
          >
            {isSubmitting ? "Salvando evento..." : "Confirmar e salvar na agenda"}
          </button>
        </div>
      </form>
    </div>
  );
}