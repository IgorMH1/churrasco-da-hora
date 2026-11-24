// components/modals/EventScaleEditModal.tsx
"use client";

import React, { useEffect, useState } from "react";
import { EventRecord, EventStatus } from "../../models/event.model";
import { StaffMember } from "../../models/staff.model";
import { isStaffMemberInList } from "../../utils/stringFormatters";

export interface EventScaleEditModalProps {
  isOpen: boolean;
  eventRecord: EventRecord | null;
  activeStaffList: StaffMember[];
  onClose: () => void;
  onSaveEvent: (updatedEvent: EventRecord) => Promise<void>;
}

/**
 * Modal for editing event details and assigning staff members.
 * Per Card #38, ADM assigns staff to the roster (`supportTeam`), while presence confirmation
 * (`confirmedStaff`) is displayed as read-only and controlled exclusively by each staff member.
 */
export function EventScaleEditModal({
  isOpen,
  eventRecord,
  activeStaffList,
  onClose,
  onSaveEvent,
}: EventScaleEditModalProps) {
  const [title, setTitle] = useState("");
  const [eventType, setEventType] = useState("");
  const [honoreeName, setHonoreeName] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [status, setStatus] = useState<EventStatus>("PENDENTE");
  const [supportTeam, setSupportTeam] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (eventRecord) {
      setTitle(eventRecord.title);
      setEventType(eventRecord.eventType);
      setHonoreeName(eventRecord.honoreeName);
      setClientName(eventRecord.clientName);
      setClientEmail(eventRecord.clientEmail || "");
      setEventDate(eventRecord.eventDate);
      setStartTime(eventRecord.startTime);
      setEndTime(eventRecord.endTime);
      setStatus(eventRecord.status);
      setSupportTeam(
        (eventRecord.supportTeam || []).filter(
          (name) => name !== "A definir pelo ADM"
        )
      );
    }
  }, [eventRecord]);

  if (!isOpen || !eventRecord) return null;

  const toggleStaffAssignment = (memberName: string) => {
    setSupportTeam((prev) =>
      prev.includes(memberName)
        ? prev.filter((item) => item !== memberName)
        : [...prev, memberName]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveEvent({
        ...eventRecord,
        title: title.trim(),
        eventType: eventType.trim(),
        honoreeName: honoreeName.trim(),
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
        eventDate,
        startTime,
        endTime,
        status,
        supportTeam:
          supportTeam.length > 0 ? supportTeam : ["A definir pelo ADM"],
      });
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-scale-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <form
        onSubmit={handleSubmit}
        className="bg-[#111726] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Edição Completa & Escala Operacional (Cards #7, #12, #38)
            </span>
            <h2
              id="edit-scale-modal-title"
              className="text-lg font-black text-white"
            >
              Editar Evento #{eventRecord.id}
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Tipo / Categoria
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
              value={honoreeName}
              onChange={(e) => setHonoreeName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Status do Evento
            </label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as EventStatus)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            >
              <option value="CONFIRMADO">CONFIRMADO</option>
              <option value="PENDENTE">PENDENTE</option>
              <option value="CANCELADO">CANCELADO</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Cliente Responsável
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
              E-mail do Cliente
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1">
              Data
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
                Término
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

        {/* Staff Assignment Roster with Read-Only Presence Status (Card #38) */}
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">
              Profissionais Escalados ({supportTeam.length})
            </span>
            <span className="text-[11px] text-slate-400">
              A confirmação de presença é exclusiva da sessão de cada colaborador (Card #38)
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-44 overflow-y-auto p-2.5 rounded-xl bg-slate-900/90 border border-slate-800">
            {activeStaffList.map((member) => {
              const isAssigned = supportTeam.includes(member.name);
              const hasConfirmedPresence = isStaffMemberInList(
                member.name,
                eventRecord.confirmedStaff
              );

              return (
                <div
                  key={member.id}
                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 ${
                    isAssigned
                      ? "bg-amber-500/10 border-amber-500/40"
                      : "bg-slate-950/80 border-slate-800"
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">
                      {member.name}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {member.specialty} ·{" "}
                      {hasConfirmedPresence ? (
                        <span className="text-emerald-300 font-bold">
                          ✓ Presença confirmada
                        </span>
                      ) : (
                        <span className="text-amber-300">
                          ⏳ Aguardando colaborador
                        </span>
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleStaffAssignment(member.name)}
                    className={`min-h-[38px] px-3 py-1 rounded-lg text-[11px] font-black shrink-0 ${
                      isAssigned
                        ? "bg-amber-500 text-slate-950"
                        : "bg-slate-800 text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {isAssigned ? "Escalado" : "Escalar"}
                  </button>
                </div>
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
            disabled={isSaving}
            className="min-h-[44px] px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs"
          >
            {isSaving ? "Salvando..." : "Salvar alterações do evento"}
          </button>
        </div>
      </form>
    </div>
  );
}