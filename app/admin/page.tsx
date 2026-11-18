"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import { getNowGmt3, hasScheduleConflict, validatePasswordRbac } from "../../lib/services/rbacAndTime";
import {
  loadInitialData,
  saveEventsToStorage,
  saveClientsToStorage,
  saveStaffToStorage,
  saveUsersToStorage,
  resetDatabaseToAdminOnly,
  generateGoogleCalendarUrl,
  setCurrentUserSession,
  StaffMember,
  ClientRecord,
  EventRecord,
  UserAccount,
} from "../../lib/services/storage";

type AdminTab = "DASHBOARD" | "EVENTOS" | "CADASTROS" | "BACKUP";

interface BackupLog {
  id: string;
  scope: "Usuários" | "Eventos" | "Completo";
  format: "JSON" | "SQL";
  exportedAtGmt3: string;
  exportedBy: string;
}

interface UnifiedPerson {
  id: string;
  origin: "STAFF" | "CLIENT" | "USER_ADM";
  name: string;
  email: string;
  phoneAnatel: string;
  profileLabel: string;
  specialtyOrRole: string;
  companyName?: string;
  dailyRate?: number;
  status: "ATIVO" | "INATIVO";
  passwordChangedAtIso: string;
}

// Verifica se a data do evento (AAAA-MM-DD) pertence aos 7 dias da semana atual (Dom a Sáb)
function isDateInCurrentWeek(dateStr: string, todayStr: string): boolean {
  if (!dateStr || !todayStr) return false;
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [ey, em, ed] = dateStr.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  const target = new Date(ey, em - 1, ed);

  const dayOfWeek = today.getDay(); // 0 (Dom) a 6 (Sáb)
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayOfWeek);
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 6);
  endOfWeek.setHours(23, 59, 59, 999);

  return target >= startOfWeek && target <= endOfWeek;
}

function formatIsoDatePtBr(iso?: string): string {
  if (!iso) return "17/11/2026";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

export default function AdminPortalPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");
  const [todayGmt3, setTodayGmt3] = useState<string>("2026-11-17");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);

  // Estados da Aba 2: Gestão de Eventos + Calendário Mensal Visual (Cards #11, #12, #13)
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "PENDENTE" | "CONFIRMADO" | "CANCELADO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState("");
  const [evCategoryText, setEvCategoryText] = useState(""); // Texto livre (Card #13)
  const [evHonoree, setEvHonoree] = useState("");
  const [evClient, setEvClient] = useState("");
  const [evAdmin, setEvAdmin] = useState("Roberto Da Hora");
  const [evDate, setEvDate] = useState("");
  const [evStart, setEvStart] = useState("16:00");
  const [evEnd, setEvEnd] = useState("21:00");
  const [evStaffSelected, setEvStaffSelected] = useState<string[]>([]);

  // Modal de Editar Escala / Editar Dados do Evento (Cards #5, #7, #12)
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [modalMode, setModalMode] = useState<"ESCALA" | "DADOS_COMPLETOS">("ESCALA");
  const [modTitle, setModTitle] = useState("");
  const [modCategory, setModCategory] = useState("");
  const [modHonoree, setModHonoree] = useState("");
  const [modClient, setModClient] = useState("");
  const [modAdmin, setModAdmin] = useState("");
  const [modDate, setModDate] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");
  const [modStatus, setModStatus] = useState<EventRecord["status"]>("CONFIRMADO");
  const [modTeam, setModTeam] = useState<string[]>([]);
  const [modNotes, setModNotes] = useState("");

  // Estados da Aba 3: Cadastros de ponta a ponta + Filtros abaixo + Edição (Cards #14, #15, #16, #17)
  const [cadCategory, setCadCategory] = useState<"EXTERNA_TERCEIRO" | "INTERNA" | "CLIENTE">("EXTERNA_TERCEIRO");
  const [cadName, setCadName] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadPhone, setCadPhone] = useState("");
  const [cadSpecialty, setCadSpecialty] = useState("");
  const [cadCompany, setCadCompany] = useState("");
  const [cadRate, setCadRate] = useState("350");
  const [cadPassword, setCadPassword] = useState("");
  const [cadStatus, setCadStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [personFilterType, setPersonFilterType] = useState<"TODOS" | "INTERNA" | "EXTERNA" | "CLIENTE">("TODOS");
  const [personSearch, setPersonSearch] = useState("");

  // Modal de Edição de Pessoa Cadastrada (Card #17)
  const [editingPerson, setEditingPerson] = useState<UnifiedPerson | null>(null);
  const [editPersonName, setEditPersonName] = useState("");
  const [editPersonEmail, setEditPersonEmail] = useState("");
  const [editPersonPhone, setEditPersonPhone] = useState("");
  const [editPersonSpecialty, setEditPersonSpecialty] = useState("");
  const [editPersonRate, setEditPersonRate] = useState("0");
  const [editPersonStatus, setEditPersonStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [editPersonNewPassword, setEditPersonNewPassword] = useState("");

  useEffect(() => {
    const now = getNowGmt3();
    setTodayGmt3(now.dateStr);
    setEvDate(now.dateStr);

    const data = loadInitialData();
    setUsers(data.users);
    setEvents(data.events);
    setClients(data.clients);
    setStaffList(data.staff);
  }, []);

  // Eventos da Semana Atual em GMT-3 (Card #9)
  const eventsThisWeek = events.filter(
    (e) => e.status !== "CANCELADO" && isDateInCurrentWeek(e.eventDate, todayGmt3)
  );
  const pendingEvents = events.filter((e) => e.status === "PENDENTE");
  const internalStaff = staffList.filter((s) => s.staffType === "INTERNA");
  const externalStaff = staffList.filter((s) => s.staffType === "EXTERNA_TERCEIRO");

  // Aprovar evento e sincronizar Google Calendar
  const handleApproveAndSyncGcal = (id: string) => {
    const updated = events.map((ev) =>
      ev.id === id
        ? {
            ...ev,
            status: "CONFIRMADO" as const,
            responsibleAdmin: ev.responsibleAdmin.includes("confirmar") ? "Roberto Da Hora" : ev.responsibleAdmin,
            googleCalendarEventId: `gcal_sync_${Math.floor(1000 + Math.random() * 9000)}`,
          }
        : ev
    );
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "✓ Evento aprovado e sincronizado com o Google Calendar!" });
  };

  const handleCancelEvent = (id: string) => {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev));
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "Evento cancelado e horário liberado na agenda." });
  };

  // Abrir Modal de Edição de Escala ou Edição Completa de Dados do Evento (Cards #7 e #12)
  const openEventModal = (ev: EventRecord, mode: "ESCALA" | "DADOS_COMPLETOS") => {
    setEditingEvent(ev);
    setModalMode(mode);
    setModTitle(ev.title);
    setModCategory(ev.eventType);
    setModHonoree(ev.honoreeName);
    setModClient(ev.clientName);
    setModAdmin(ev.responsibleAdmin);
    setModDate(ev.eventDate);
    setModStart(ev.startTime);
    setModEnd(ev.endTime);
    setModStatus(ev.status);
    setModTeam(ev.supportTeam || []);
    setModNotes(ev.notes || "");
  };

  const handleSaveEventModal = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingEvent) return;
    if (modEnd <= modStart) {
      setFeedback({ type: "error", text: "O horário final deve ser maior que o inicial." });
      return;
    }

    const updatedEv: EventRecord = {
      ...editingEvent,
      title: modTitle,
      eventType: modCategory || "Evento",
      honoreeName: modHonoree,
      clientName: modClient,
      responsibleAdmin: modAdmin,
      eventDate: modDate,
      startTime: modStart,
      endTime: modEnd,
      status: modStatus,
      supportTeam: modTeam.length > 0 ? modTeam : ["Sem equipe escalada"],
      notes: modNotes,
    };

    const updatedList = events.map((ev) => (ev.id === editingEvent.id ? updatedEv : ev));
    setEvents(updatedList);
    saveEventsToStorage(updatedList);
    setEditingEvent(null);
    setFeedback({ type: "success", text: "✓ Informações e escala do evento atualizadas com sucesso!" });
  };

  // Criar Novo Agendamento Manual com Categoria em Texto Livre (Card #13)
  const handleCreateManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evCategoryText.trim()) {
      setFeedback({ type: "error", text: "Digite a categoria do evento." });
      return;
    }
    if (!evHonoree.trim()) {
      setFeedback({ type: "error", text: "Informe obrigatoriamente 'Para quem é o evento?'." });
      return;
    }
    if (evEnd <= evStart) {
      setFeedback({ type: "error", text: "O horário de término deve ser maior que o início." });
      return;
    }

    const conflict = events.find(
      (existing) =>
        existing.eventDate === evDate &&
        existing.status !== "CANCELADO" &&
        hasScheduleConflict(evStart, evEnd, existing.startTime, existing.endTime, 60)
    );

    if (conflict) {
      setFeedback({
        type: "error",
        text: `Conflito de horário com "${conflict.title}" (${conflict.startTime} às ${conflict.endTime} + 1h limpeza).`,
      });
      return;
    }

    const newEv: EventRecord = {
      id: `EV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: evTitle || `${evCategoryText} - ${evHonoree}`,
      eventType: evCategoryText.trim(),
      honoreeName: evHonoree,
      clientName: evClient || "Cliente Da Hora",
      responsibleAdmin: evAdmin,
      eventDate: evDate,
      startTime: evStart,
      endTime: evEnd,
      status: "CONFIRMADO",
      googleCalendarEventId: `gcal_sync_${Math.floor(1000 + Math.random() * 9000)}`,
      supportTeam: evStaffSelected.length > 0 ? evStaffSelected : ["Equipe padrão"],
    };

    const updated = [newEv, ...events];
    setEvents(updated);
    saveEventsToStorage(updated);
    setEvTitle("");
    setEvCategoryText("");
    setEvHonoree("");
    setEvClient("");
    setFeedback({ type: "success", text: "✓ Novo agendamento criado e sincronizado com o Google Calendar!" });
  };

  // Salvar Novo Cadastro de Pessoa com ID, Status e Última Atualização de Senha (Cards #14 a #17)
  const handleSaveCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    const check = validateAnatelPhone(cadPhone);
    if (!check.valid) {
      setFeedback({ type: "error", text: `Erro ANATEL: ${check.error}` });
      return;
    }
    if (cadPassword && !validatePasswordRbac(cadPassword).isValid) {
      setFeedback({
        type: "error",
        text: "Se informada, a senha precisa seguir o padrão RBAC (mín. 8 caracteres, maiúscula, número e especial).",
      });
      return;
    }

    const nowIso = new Date().toISOString();
    const formattedPhone = check.formatted || cadPhone;

    if (cadCategory === "CLIENTE") {
      const newId = `CLI-${Math.floor(1000 + Math.random() * 9000)}`;
      const newCli: ClientRecord = {
        id: newId,
        name: cadName,
        email: cadEmail.trim().toLowerCase(),
        phoneAnatel: formattedPhone,
        status: cadStatus,
        passwordChangedAtIso: nowIso,
      };
      const updatedClients = [newCli, ...clients];
      setClients(updatedClients);
      saveClientsToStorage(updatedClients);

      // Também cria/atualiza na tabela de usuários de login se tiver e-mail
      if (cadEmail.trim()) {
        const newUser: UserAccount = {
          id: newId,
          name: cadName,
          email: cadEmail.trim().toLowerCase(),
          phoneAnatel: formattedPhone,
          password: cadPassword || "Cliente@2026",
          role: "CLIENTE",
          status: cadStatus,
          passwordChangedAtIso: nowIso,
        };
        const updatedUsers = [...users, newUser];
        setUsers(updatedUsers);
        saveUsersToStorage(updatedUsers);
      }
      setFeedback({ type: "success", text: `✓ Cliente "${cadName}" (${newId}) cadastrado com sucesso!` });
    } else {
      const prefix = cadCategory === "INTERNA" ? "INT" : "EXT";
      const newId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
      const newSt: StaffMember = {
        id: newId,
        name: cadName,
        email: cadEmail.trim().toLowerCase() || `${newId.toLowerCase()}@equipe.com`,
        phoneAnatel: formattedPhone,
        staffType: cadCategory,
        specialty: cadSpecialty || "Apoio Geral",
        companyName: cadCategory === "EXTERNA_TERCEIRO" ? cadCompany || "Autônomo / MEI" : "Família Da Hora",
        dailyRate: cadCategory === "EXTERNA_TERCEIRO" ? Number(cadRate) || 0 : 0,
        status: cadStatus,
        passwordChangedAtIso: nowIso,
      };
      const updatedStaff = [newSt, ...staffList];
      setStaffList(updatedStaff);
      saveStaffToStorage(updatedStaff);
      setFeedback({ type: "success", text: `✓ Profissional "${cadName}" (${newId}) cadastrado com sucesso!` });
    }

    setCadName("");
    setCadEmail("");
    setCadPhone("");
    setCadSpecialty("");
    setCadCompany("");
    setCadPassword("");
  };

  // Lista Unificada de Pessoas para o Filtro e Tabela Abaixo de "Adicionar uma pessoa" (Cards #15, #16, #17)
  const unifiedPeople: UnifiedPerson[] = [
    ...staffList.map((st) => ({
      id: st.id,
      origin: "STAFF" as const,
      name: st.name,
      email: st.email || "—",
      phoneAnatel: st.phoneAnatel,
      profileLabel: st.staffType === "INTERNA" ? "Equipe Interna" : "Equipe Externa",
      specialtyOrRole: st.specialty,
      companyName: st.companyName,
      dailyRate: st.dailyRate,
      status: st.status || "ATIVO",
      passwordChangedAtIso: st.passwordChangedAtIso || "2026-11-17T00:00:00-03:00",
    })),
    ...clients.map((cl) => ({
      id: cl.id,
      origin: "CLIENT" as const,
      name: cl.name,
      email: cl.email,
      phoneAnatel: cl.phoneAnatel,
      profileLabel: "Cliente",
      specialtyOrRole: "Cliente de Eventos",
      status: cl.status || "ATIVO",
      passwordChangedAtIso: cl.passwordChangedAtIso || "2026-11-17T00:00:00-03:00",
    })),
  ];

  const filteredPeople = unifiedPeople.filter((p) => {
    const matchType =
      personFilterType === "TODOS" ||
      (personFilterType === "INTERNA" && p.profileLabel === "Equipe Interna") ||
      (personFilterType === "EXTERNA" && p.profileLabel === "Equipe Externa") ||
      (personFilterType === "CLIENTE" && p.profileLabel === "Cliente");

    const matchSearch =
      !personSearch.trim() ||
      p.name.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.id.toLowerCase().includes(personSearch.toLowerCase()) ||
      p.phoneAnatel.includes(personSearch) ||
      p.specialtyOrRole.toLowerCase().includes(personSearch.toLowerCase());

    return matchType && matchSearch;
  });

  // Abrir Modal de Edição de Pessoa (Card #17)
  const openEditPersonModal = (person: UnifiedPerson) => {
    setEditingPerson(person);
    setEditPersonName(person.name);
    setEditPersonEmail(person.email === "—" ? "" : person.email);
    setEditPersonPhone(person.phoneAnatel);
    setEditPersonSpecialty(person.specialtyOrRole);
    setEditPersonRate(String(person.dailyRate || 0));
    setEditPersonStatus(person.status);
    setEditPersonNewPassword("");
  };

  const handleSaveEditedPerson = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPerson) return;

    const check = validateAnatelPhone(editPersonPhone);
    if (!check.valid) {
      setFeedback({ type: "error", text: `Telefone inválido na regra ANATEL: ${check.error}` });
      return;
    }
    if (editPersonNewPassword && !validatePasswordRbac(editPersonNewPassword).isValid) {
      setFeedback({
        type: "error",
        text: "A nova senha precisa ter no mínimo 8 caracteres, maiúscula, minúscula, número e especial.",
      });
      return;
    }

    const updatedPhone = check.formatted || editPersonPhone;
    const updatedPasswordIso = editPersonNewPassword
      ? new Date().toISOString()
      : editingPerson.passwordChangedAtIso;

    if (editingPerson.origin === "STAFF") {
      const updatedStaff = staffList.map((st) =>
        st.id === editingPerson.id
          ? {
              ...st,
              name: editPersonName,
              email: editPersonEmail,
              phoneAnatel: updatedPhone,
              specialty: editPersonSpecialty,
              dailyRate: Number(editPersonRate) || 0,
              status: editPersonStatus,
              passwordChangedAtIso: updatedPasswordIso,
            }
          : st
      );
      setStaffList(updatedStaff);
      saveStaffToStorage(updatedStaff);
    } else if (editingPerson.origin === "CLIENT") {
      const updatedClients = clients.map((cl) =>
        cl.id === editingPerson.id
          ? {
              ...cl,
              name: editPersonName,
              email: editPersonEmail,
              phoneAnatel: updatedPhone,
              status: editPersonStatus,
              passwordChangedAtIso: updatedPasswordIso,
            }
          : cl
      );
      setClients(updatedClients);
      saveClientsToStorage(updatedClients);

      const updatedUsers = users.map((u) =>
        u.id === editingPerson.id || u.email.toLowerCase() === editingPerson.email.toLowerCase()
          ? {
              ...u,
              name: editPersonName,
              email: editPersonEmail,
              phoneAnatel: updatedPhone,
              status: editPersonStatus,
              password: editPersonNewPassword || u.password,
              passwordChangedAtIso: updatedPasswordIso,
            }
          : u
      );
      setUsers(updatedUsers);
      saveUsersToStorage(updatedUsers);
    }

    setEditingPerson(null);
    setFeedback({
      type: "success",
      text: `✓ Cadastro #${editingPerson.id} (${editPersonName}) atualizado com sucesso!`,
    });
  };

  // Funções de Backup, Excluir Último Backup e Resetar Sistema (Card #18)
  const handleDownloadBackup = (scope: "Usuários" | "Eventos" | "Completo", format: "JSON" | "SQL") => {
    const now = getNowGmt3();
    let content = "";
    const filename = `backup_${scope.toLowerCase()}_${now.dateStr}.${format.toLowerCase()}`;

    if (format === "JSON") {
      const payload = {
        metadata: {
          system: "Churrasco dos Da Hora",
          version: "1.0.0",
          scope,
          exportedAtGmt3: now.formattedPtBr,
          exportedByAdmin: "Roberto Da Hora",
        },
        backupData: {
          ...(scope !== "Eventos" ? { users, clients, staffMembers: staffList } : {}),
          ...(scope !== "Usuários" ? { events } : {}),
        },
      };
      content = JSON.stringify(payload, null, 2);
    } else {
      content = `-- BACKUP SQL CHURRASCO DOS DA HORA (${now.formattedPtBr})\nSET TIME ZONE 'America/Sao_Paulo';\n\n`;
      if (scope !== "Eventos") {
        clients.forEach((c) => {
          content += `INSERT INTO users (id, name, email, phone_anatel, role) VALUES ('${c.id}', '${c.name}', '${c.email}', '${c.phoneAnatel}', 'CLIENTE');\n`;
        });
        staffList.forEach((s) => {
          content += `INSERT INTO staff_members (id, name, phone_anatel, staff_type, specialty) VALUES ('${s.id}', '${s.name}', '${s.phoneAnatel}', '${s.staffType}', '${s.specialty}');\n`;
        });
      }
      if (scope !== "Usuários") {
        events.forEach((ev) => {
          content += `INSERT INTO events (id, title, event_type, honoree_name, event_date, start_time, end_time, status) VALUES ('${ev.id}', '${ev.title}', '${ev.eventType}', '${ev.honoreeName}', '${ev.eventDate}', '${ev.startTime}', '${ev.endTime}', '${ev.status}');\n`;
        });
      }
    }

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);

    setBackupLogs([
      {
        id: `BKP-${Math.floor(1000 + Math.random() * 9000)}`,
        scope,
        format,
        exportedAtGmt3: `${now.dateStr.split("-").reverse().join("/")} ${now.timeStr}`,
        exportedBy: "Roberto Da Hora",
      },
      ...backupLogs,
    ]);
    setFeedback({ type: "success", text: `✓ Exportação "${filename}" concluída e registrada em BACKUP_LOGS!` });
  };

  const handleDeleteLastBackup = () => {
    if (backupLogs.length === 0) {
      setFeedback({ type: "error", text: "Não há backups no histórico para excluir." });
      return;
    }
    const removed = backupLogs[0];
    setBackupLogs(backupLogs.slice(1));
    setFeedback({
      type: "success",
      text: `🗑️ Último backup (${removed.scope} · ${removed.format} de ${removed.exportedAtGmt3}) excluído com sucesso!`,
    });
  };

  const handleResetSystemFromBackupTab = () => {
    const clean = resetDatabaseToAdminOnly();
    setUsers(clean.users);
    setEvents(clean.events);
    setClients(clean.clients);
    setStaffList(clean.staff);
    setBackupLogs([]);
    setEvStaffSelected([]);
    setFeedback({
      type: "success",
      text: "🧹 Sistema resetado com sucesso! Todos os eventos, clientes, equipes e logs foram limpos (mantido apenas o ADM padrão).",
    });
  };

  const phoneValidation = validateAnatelPhone(cadPhone);

  const filteredEvents = events.filter((ev) => {
    const matchesStatus = statusFilter === "TODOS" || ev.status === statusFilter;
    const matchesDay = !selectedCalendarDay || ev.eventDate === selectedCalendarDay;
    const matchesQuery =
      !searchQuery.trim() ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.honoreeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventDate.includes(searchQuery);
    return matchesStatus && matchesDay && matchesQuery;
  });

  // Geração da Grade do Calendário Mensal Visual (Card #11)
  const currentYearMonth = (evDate || todayGmt3).slice(0, 7); // "YYYY-MM"
  const [calYear, calMonth] = currentYearMonth.split("-").map(Number);
  const daysInMonth = new Date(calYear || 2026, calMonth || 11, 0).getDate();
  const firstWeekday = new Date(calYear || 2026, (calMonth || 11) - 1, 1).getDay();

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* BARRA LATERAL ESQUERDA FIXA */}
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
              PAINEL DA FAMÍLIA
            </p>
            {[
              { id: "DASHBOARD", label: "Dashboard", icon: "⊞" },
              { id: "EVENTOS", label: "Gestão de eventos", icon: "📅" },
              { id: "CADASTROS", label: "Cadastros", icon: "👥" },
              { id: "BACKUP", label: "Backup e governança", icon: "🛡️" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id as AdminTab)}
                className={`w-full flex items-center gap-3 px-3.5 py-3 rounded-xl text-xs font-semibold transition ${
                  activeTab === item.id
                    ? "bg-[#F59E0B] text-slate-950 font-extrabold shadow-md"
                    : "text-slate-400 hover:text-white hover:bg-slate-800/40"
                }`}
              >
                <span className="text-sm">{item.icon}</span>
                <span>{item.label}</span>
              </button>
            ))}
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
                RD
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white">Roberto Da Hora</p>
                <p className="text-[11px] text-slate-400">Administrador · Família</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentUserSession(null);
                window.location.href = "/";
              }}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 px-1 transition"
            >
              <span>↪</span>
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </aside>

      {/* ÁREA DE CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* TOPBAR LIMPA (Sem GMT-3, Sem Ver Área do Cliente e Sem Resetar Dados - Card #10) */}
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
              ADMINISTRAÇÃO DO ESPAÇO
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "DASHBOARD" && "Dashboard"}
              {activeTab === "EVENTOS" && "Gestão de eventos"}
              {activeTab === "CADASTROS" && "Cadastros"}
              {activeTab === "BACKUP" && "Backup e governança"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "DASHBOARD" && "Uma visão da semana para receber bem."}
              {activeTab === "EVENTOS" && "Da reserva à escala, cada detalhe no lugar."}
              {activeTab === "CADASTROS" && "As pessoas que fazem cada encontro acontecer."}
              {activeTab === "BACKUP" && "Seus dados seguros. Sua operação tranquila."}
            </p>
          </div>

          {activeTab === "DASHBOARD" && (
            <button
              type="button"
              onClick={() => setActiveTab("EVENTOS")}
              className="text-xs bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold px-4 py-2.5 rounded-xl transition shrink-0"
            >
              + Novo evento
            </button>
          )}
        </header>

        {feedback && (
          <div
            className={`mx-6 mt-5 p-3.5 rounded-xl text-xs flex justify-between items-center border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-rose-950/60 border-rose-500/40 text-rose-200"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 flex-1">
          {/* ABA 1: DASHBOARD (Agenda da Semana + KPIs Interativos + Sem KPI lateral removida - Cards #5, #7, #8, #9) */}
          {activeTab === "DASHBOARD" && (
            <div className="space-y-6">
              {/* 4 KPI CARDS INTERATIVOS (Card #5) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  onClick={() => {
                    setStatusFilter("TODOS");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Eventos na semana</span>
                    <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">
                      SEMANA ATUAL
                    </span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(eventsThisWeek.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">Clique para gerenciar →</p>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter("CONFIRMADO");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-emerald-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Confirmados / ativos</span>
                    <span className="text-emerald-400">✓</span>
                  </div>
                  <p className="text-4xl font-extrabold text-emerald-400 mt-2">
                    {String(eventsThisWeek.filter((e) => e.status === "CONFIRMADO").length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Filtrar confirmados →</p>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter("PENDENTE");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-400 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Solicitações pendentes</span>
                    <span className="text-amber-400">●</span>
                  </div>
                  <p className="text-4xl font-extrabold text-amber-400 mt-2">
                    {String(pendingEvents.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Revisar solicitações →</p>
                </div>

                <div
                  onClick={() => setActiveTab("CADASTROS")}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-sky-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Profissionais na equipe</span>
                    <span className="text-sky-400">👥</span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(staffList.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">
                    {internalStaff.length} internos · {externalStaff.length} terceirizados →
                  </p>
                </div>
              </div>

              {/* AGENDA DA SEMANA (Card #9) + COLUNA LATERAL SEM A KPI REMOVIDA (Card #8) */}
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Agenda da semana</h2>
                      <p className="text-xs text-slate-400">
                        Clique em um card para abrir detalhes ou em &quot;Editar escala&quot; para gerenciar a equipe
                      </p>
                    </div>
                    <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                      {eventsThisWeek.length} evento(s) na semana
                    </span>
                  </div>

                  {eventsThisWeek.length === 0 ? (
                    <div className="bg-[#0A0E17] border border-slate-800/80 rounded-2xl p-8 text-center space-y-3">
                      <p className="text-sm font-semibold text-slate-300">
                        Nenhum evento programado para esta semana.
                      </p>
                      <p className="text-xs text-slate-500">
                        Clique em &quot;+ Novo evento&quot; no topo para cadastrar um agendamento.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventsThisWeek.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => openEventModal(ev, "DADOS_COMPLETOS")}
                          className="cursor-pointer bg-[#0A0E17] hover:bg-[#131B2E] border border-slate-800/90 hover:border-amber-500/40 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4 transition"
                        >
                          <div className="flex gap-4">
                            <div className="text-xs font-mono text-slate-300 border-r border-slate-800 pr-4 flex flex-col justify-center shrink-0">
                              <span className="text-[10px] text-amber-400 font-bold">{ev.eventDate}</span>
                              <span className="font-bold text-white">{ev.startTime}</span>
                              <span className="text-slate-500">{ev.endTime}</span>
                            </div>
                            <div className="space-y-1.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                    ev.status === "CONFIRMADO"
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                      : "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                                  }`}
                                >
                                  {ev.status === "CONFIRMADO" ? "✓ Confirmado" : "● Pendente"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                <span className="text-amber-400 font-semibold">{ev.eventType}</span> · Para:{" "}
                                <strong className="text-slate-200">{ev.honoreeName}</strong> · Cliente: {ev.clientName}
                              </p>
                              <p className="text-[11px] text-slate-400">
                                ADM: <strong className="text-slate-300">{ev.responsibleAdmin}</strong> · Equipe:{" "}
                                {ev.supportTeam.join(" / ")}
                              </p>
                            </div>
                          </div>

                          <div
                            className="flex sm:flex-col justify-end gap-2 shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {ev.status === "PENDENTE" && (
                              <button
                                onClick={() => handleApproveAndSyncGcal(ev.id)}
                                className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
                              >
                                ✓ Aprovar + GCal
                              </button>
                            )}
                            <button
                              onClick={() => openEventModal(ev, "ESCALA")}
                              className="bg-[#111726] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl"
                            >
                              Editar escala
                            </button>
                            <button
                              onClick={() => handleCancelEvent(ev.id)}
                              className="text-xs text-slate-400 hover:text-rose-400 px-2 py-1"
                            >
                              Cancelar
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* WIDGETS LATERAIS (Sem a KPI removida no Card #8) */}
                <div className="xl:col-span-4 space-y-4">
                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Precisam de você</h3>
                      <span className="text-[11px] text-amber-400 font-semibold">
                        {pendingEvents.length} pendente(s)
                      </span>
                    </div>
                    {pendingEvents.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma solicitação pendente de aprovação.</p>
                    ) : (
                      pendingEvents.map((pe) => (
                        <div
                          key={pe.id}
                          onClick={() => openEventModal(pe, "DADOS_COMPLETOS")}
                          className="cursor-pointer bg-[#0A0E17] hover:bg-[#141C2E] border border-slate-800 rounded-xl p-3 flex items-center justify-between transition"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{pe.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {pe.eventDate}, às {pe.startTime}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveAndSyncGcal(pe.id);
                            }}
                            className="text-xs text-amber-400 hover:underline font-bold"
                          >
                            Aprovar →
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-2">
                    <p className="text-xs font-bold text-emerald-400">✓ Google Calendar conectado</p>
                    <p className="text-xs text-slate-400">
                      Cada evento possui botão direto para abrir e salvar na agenda oficial do Google.
                    </p>
                    <button
                      onClick={() => setActiveTab("EVENTOS")}
                      className="text-xs font-bold text-amber-400 hover:underline pt-1 inline-block"
                    >
                      Abrir gestão de eventos →
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: GESTÃO DE EVENTOS (Categoria em texto livre + Calendário Mensal Visual + Edição de Eventos - Cards #11, #12, #13) */}
          {activeTab === "EVENTOS" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              {/* FORMULÁRIO ESQUERDO COM CATEGORIA EM TEXTO LIVRE (Card #13) */}
              <form
                onSubmit={handleCreateManualEvent}
                className="xl:col-span-5 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Novo agendamento</h2>
                  <p className="text-xs text-slate-400">Crie, escale a equipe e sincronize.</p>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-300 mb-1">Título do evento</label>
                  <input
                    type="text"
                    required
                    value={evTitle}
                    onChange={(e) => setEvTitle(e.target.value)}
                    placeholder="Aniversário da Ana Clara"
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Categoria (Texto livre) *</label>
                    <input
                      type="text"
                      required
                      value={evCategoryText}
                      onChange={(e) => setEvCategoryText(e.target.value)}
                      placeholder="Ex: Aniversário, Bodas, Futebol..."
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Para quem é o evento? *</label>
                    <input
                      type="text"
                      required
                      value={evHonoree}
                      onChange={(e) => setEvHonoree(e.target.value)}
                      placeholder="Ana Clara · 15 anos"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Cliente vinculado</label>
                    <input
                      type="text"
                      required
                      value={evClient}
                      onChange={(e) => setEvClient(e.target.value)}
                      placeholder="Marcos Oliveira"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Responsável ADM</label>
                    <input
                      type="text"
                      required
                      value={evAdmin}
                      onChange={(e) => setEvAdmin(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Data</label>
                    <input
                      type="date"
                      required
                      value={evDate}
                      onChange={(e) => setEvDate(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Início</label>
                    <input
                      type="time"
                      required
                      value={evStart}
                      onChange={(e) => setEvStart(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Término</label>
                    <input
                      type="time"
                      required
                      value={evEnd}
                      onChange={(e) => setEvEnd(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="px-3.5 py-2 rounded-xl bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs">
                  ✓ Sem conflitos · Limpeza reservada (+1h após término)
                </div>

                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">EQUIPE ESCALADA</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {staffList.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-[#0A0E17] p-3 rounded-xl border border-slate-800">
                        Cadastre membros na aba Cadastros para escalá-los aqui.
                      </p>
                    ) : (
                      staffList.map((st) => (
                        <label
                          key={st.id}
                          className="flex items-center justify-between bg-[#0A0E17] border border-slate-800 px-3.5 py-2.5 rounded-xl text-xs cursor-pointer"
                        >
                          <span>
                            <strong className="text-white">{st.name}</strong> ·{" "}
                            <span className="text-slate-400">{st.specialty}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={evStaffSelected.includes(st.name)}
                            onChange={(e) => {
                              if (e.target.checked) setEvStaffSelected([...evStaffSelected, st.name]);
                              else setEvStaffSelected(evStaffSelected.filter((n) => n !== st.name));
                            }}
                          />
                        </label>
                      ))
                    )}
                  </div>
                </div>

                <button
                  type="submit"
                  className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3.5 rounded-2xl text-xs transition"
                >
                  Agendar e sincronizar Google Calendar
                </button>
              </form>

              {/* COLUNA DIREITA: CALENDÁRIO MENSAL VISUAL INTERATIVO (Card #11) + LISTA COM EDIÇÃO (Card #12) */}
              <div className="xl:col-span-7 space-y-5">
                {/* GRADE DO CALENDÁRIO MENSAL */}
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Calendário Mensal ({currentYearMonth})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Clique em um dia para filtrar os eventos ou preencher a data no formulário
                      </p>
                    </div>
                    <div className="flex items-center gap-3 text-xs">
                      {selectedCalendarDay && (
                        <button
                          onClick={() => setSelectedCalendarDay(null)}
                          className="text-amber-400 underline font-semibold"
                        >
                          Mostrar mês inteiro
                        </button>
                      )}
                      <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 text-emerald-400 font-semibold">
                        ✓ Google Calendar conectado
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-500 uppercase">
                    <span>DOM</span>
                    <span>SEG</span>
                    <span>TER</span>
                    <span>QUA</span>
                    <span>QUI</span>
                    <span>SEX</span>
                    <span>SÁB</span>
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {Array.from({ length: firstWeekday }).map((_, idx) => (
                      <div key={`empty-${idx}`} className="h-11 rounded-xl bg-transparent" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const fullDate = `${currentYearMonth}-${String(dayNum).padStart(2, "0")}`;
                      const dayEvents = events.filter((e) => e.eventDate === fullDate && e.status !== "CANCELADO");
                      const hasConfirmed = dayEvents.some((e) => e.status === "CONFIRMADO");
                      const hasPending = dayEvents.some((e) => e.status === "PENDENTE");
                      const isSelected = selectedCalendarDay === fullDate;

                      return (
                        <button
                          key={fullDate}
                          type="button"
                          onClick={() => {
                            setEvDate(fullDate);
                            setSelectedCalendarDay(isSelected ? null : fullDate);
                          }}
                          className={`h-11 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition ${
                            isSelected
                              ? "bg-[#F59E0B] text-slate-950 border-amber-400"
                              : fullDate === todayGmt3
                              ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                              : "bg-[#0A0E17] text-slate-300 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <span>{dayNum}</span>
                          {dayEvents.length > 0 && (
                            <div className="flex gap-1 mt-0.5">
                              {hasConfirmed && <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />}
                              {hasPending && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center gap-4 text-[11px] text-slate-400 pt-1">
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" /> Confirmado
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-amber-400" /> Pendente · Horários em GMT-3
                    </span>
                  </div>
                </div>

                {/* LISTA DE EVENTOS COM BOTÃO DE EDIÇÃO DE DADOS (Card #12) */}
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1.5 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                      {(["TODOS", "PENDENTE", "CONFIRMADO", "CANCELADO"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            statusFilter === st ? "bg-[#F59E0B] text-slate-950 font-bold" : "text-slate-400 hover:text-white"
                          }`}
                        >
                          {st === "TODOS"
                            ? "Todos"
                            : st === "PENDENTE"
                            ? "Pendentes"
                            : st === "CONFIRMADO"
                            ? "Confirmados"
                            : "Cancelados"}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Buscar por data ou homenageado"
                      className="bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                    />
                  </div>

                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-6 text-center">Nenhum evento encontrado para este filtro.</p>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                        >
                          <div className="space-y-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                                {ev.eventType}
                              </span>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                  ev.status === "CONFIRMADO"
                                    ? "bg-emerald-500/15 text-emerald-400"
                                    : ev.status === "CANCELADO"
                                    ? "bg-rose-500/15 text-rose-400"
                                    : "bg-amber-500/15 text-amber-400"
                                }`}
                              >
                                {ev.status}
                              </span>
                            </div>
                            <p className="text-xs text-slate-400">
                              {ev.eventDate} · {ev.startTime} - {ev.endTime} · Para: <strong>{ev.honoreeName}</strong> ·{" "}
                              {ev.clientName}
                            </p>
                            <p className="text-[11px] text-slate-500">
                              ADM: {ev.responsibleAdmin} · Equipe: {ev.supportTeam.join(", ")}
                            </p>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {ev.status === "PENDENTE" && (
                              <button
                                onClick={() => handleApproveAndSyncGcal(ev.id)}
                                className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold text-xs px-3 py-2 rounded-xl"
                              >
                                Aprovar + GCal
                              </button>
                            )}
                            <button
                              onClick={() => openEventModal(ev, "DADOS_COMPLETOS")}
                              className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                            >
                              ✏️ Editar dados
                            </button>
                            <a
                              href={generateGoogleCalendarUrl(ev)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                            >
                              📅 GCal
                            </a>
                            {ev.status !== "CANCELADO" && (
                              <button
                                onClick={() => handleCancelEvent(ev.id)}
                                className="bg-[#111726] hover:bg-rose-950 text-slate-300 hover:text-rose-200 border border-slate-800 text-xs px-3 py-2 rounded-xl"
                              >
                                Cancelar
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ABA 3: CADASTROS ("Adicionar uma pessoa" de ponta a ponta + Filtro e Lista abaixo com ID, Status, Última senha e Edição - Cards #14, #15, #16, #17) */}
          {activeTab === "CADASTROS" && (
            <div className="space-y-6">
              {/* BLOCO 1: ADICIONAR UMA PESSOA DE PONTA A PONTA (100% LARGURA - Card #14) */}
              <form
                onSubmit={handleSaveCadastro}
                className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Adicionar uma pessoa</h2>
                    <p className="text-xs text-slate-400">
                      Formulário em largura total. Escolha o perfil e preencha os dados validados pela ANATEL.
                    </p>
                  </div>

                  <div className="grid grid-cols-3 bg-[#0A0E17] p-1 rounded-xl border border-slate-800 w-full md:w-96">
                    {[
                      { id: "EXTERNA_TERCEIRO", label: "Equipe externa" },
                      { id: "INTERNA", label: "Equipe interna" },
                      { id: "CLIENTE", label: "Cliente" },
                    ].map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setCadCategory(t.id as "EXTERNA_TERCEIRO" | "INTERNA" | "CLIENTE")}
                        className={`py-2 rounded-lg text-xs font-semibold transition ${
                          cadCategory === t.id ? "bg-[#F59E0B] text-slate-950 font-bold" : "text-slate-400"
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Nome completo *</label>
                    <input
                      type="text"
                      required
                      value={cadName}
                      onChange={(e) => setCadName(e.target.value)}
                      placeholder="Paulo Mendes"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-300 font-medium">Telefone ANATEL *</span>
                      {phoneValidation.valid && (
                        <span className="text-emerald-400 font-semibold">✓ {phoneValidation.regionUf}</span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      value={cadPhone}
                      onChange={(e) => setCadPhone(applyAnatelPhoneMask(e.target.value))}
                      placeholder="(11) 98765-4321"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail</label>
                    <input
                      type="email"
                      required={cadCategory === "CLIENTE"}
                      value={cadEmail}
                      onChange={(e) => setCadEmail(e.target.value)}
                      placeholder="contato@exemplo.com"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status do Cadastro</label>
                    <select
                      value={cadStatus}
                      onChange={(e) => setCadStatus(e.target.value as "ATIVO" | "INATIVO")}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    >
                      <option value="ATIVO">🟢 Ativo</option>
                      <option value="INATIVO">🔴 Inativo</option>
                    </select>
                  </div>

                  {cadCategory !== "CLIENTE" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Especialidade / Função</label>
                        <input
                          type="text"
                          required
                          value={cadSpecialty}
                          onChange={(e) => setCadSpecialty(e.target.value)}
                          placeholder="Ex: Churrasqueiro, Garçom..."
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Empresa / MEI</label>
                        <input
                          type="text"
                          value={cadCompany}
                          onChange={(e) => setCadCompany(e.target.value)}
                          placeholder="Paulo Grill · MEI"
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      {cadCategory === "EXTERNA_TERCEIRO" && (
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">Diária / Cachê (R$)</label>
                          <input
                            type="number"
                            value={cadRate}
                            onChange={(e) => setCadRate(e.target.value)}
                            className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                          />
                        </div>
                      )}
                    </>
                  )}

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Senha inicial (Opcional · RBAC)
                    </label>
                    <input
                      type="password"
                      value={cadPassword}
                      onChange={(e) => setCadPassword(e.target.value)}
                      placeholder="Ex: Festa@2026"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 px-8 rounded-2xl text-xs transition"
                  >
                    + Salvar cadastro
                  </button>
                </div>
              </form>

              {/* BLOCO 2: FILTRO E VISUALIZAÇÃO DE PERFIS ABAIXO DE "ADICIONAR PESSOA" (Cards #15, #16, #17) */}
              <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                    {[
                      { id: "TODOS", label: `Todos (${unifiedPeople.length})` },
                      { id: "INTERNA", label: `Equipe Interna (${internalStaff.length})` },
                      { id: "EXTERNA", label: `Equipe Externa (${externalStaff.length})` },
                      { id: "CLIENTE", label: `Clientes (${clients.length})` },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setPersonFilterType(f.id as "TODOS" | "INTERNA" | "EXTERNA" | "CLIENTE")}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                          personFilterType === f.id
                            ? "bg-[#F59E0B] text-slate-950 font-bold"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <input
                    type="text"
                    value={personSearch}
                    onChange={(e) => setPersonSearch(e.target.value)}
                    placeholder="🔍 Buscar por nome, ID, telefone ou especialidade..."
                    className="bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white w-full md:w-80"
                  />
                </div>

                {/* TABELA / MODELO DE EXEMPLO COM ID, STATUS, ÚLTIMA SENHA E EDIÇÃO (Cards #16 e #17) */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">NOME / PERFIL</th>
                        <th className="py-3 px-3">CONTATO ANATEL</th>
                        <th className="py-3 px-3">FUNÇÃO / DIÁRIA</th>
                        <th className="py-3 px-3">STATUS</th>
                        <th className="py-3 px-3">ÚLTIMA ATUALIZAÇÃO DE SENHA</th>
                        <th className="py-3 px-3 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredPeople.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-8 text-center text-slate-500">
                            Nenhum perfil cadastrado encontrado para este filtro. Use o formulário acima para adicionar.
                          </td>
                        </tr>
                      ) : (
                        filteredPeople.map((person) => (
                          <tr key={person.id} className="hover:bg-[#0A0E17]/60 transition">
                            <td className="py-3.5 px-3 font-mono font-bold text-amber-400">#{person.id}</td>
                            <td className="py-3.5 px-3">
                              <p className="font-bold text-white">{person.name}</p>
                              <span className="text-[10px] text-slate-400">{person.profileLabel}</span>
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="font-mono text-slate-200">{person.phoneAnatel}</p>
                              <p className="text-[11px] text-slate-500">{person.email}</p>
                            </td>
                            <td className="py-3.5 px-3">
                              <p className="text-slate-200">{person.specialtyOrRole}</p>
                              {person.dailyRate ? (
                                <span className="text-[10px] text-emerald-400 font-semibold">
                                  R$ {person.dailyRate} / diária
                                </span>
                              ) : null}
                            </td>
                            <td className="py-3.5 px-3">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                  person.status === "ATIVO"
                                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                    : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                                }`}
                              >
                                {person.status === "ATIVO" ? "● Ativo" : "○ Inativo"}
                              </span>
                            </td>
                            <td className="py-3.5 px-3 font-mono text-slate-300">
                              {formatIsoDatePtBr(person.passwordChangedAtIso)}
                            </td>
                            <td className="py-3.5 px-3 text-right">
                              <button
                                type="button"
                                onClick={() => openEditPersonModal(person)}
                                className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                              >
                                ✏️ Editar
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: BACKUP E GOVERNANÇA (Com Excluir Último Backup e Resetar Sistema - Card #18) */}
          {activeTab === "BACKUP" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    scope: "Usuários" as const,
                    title: "Pessoas e acessos",
                    desc: "Clientes, administradores, equipe interna e profissionais externos.",
                    badge: `${clients.length + staffList.length + 1} cadastros`,
                  },
                  {
                    scope: "Eventos" as const,
                    title: "Eventos e escalas",
                    desc: "Histórico completo, homenageados, datas em GMT-3 e equipes escaladas.",
                    badge: `${events.length} eventos`,
                  },
                  {
                    scope: "Completo" as const,
                    title: "Backup completo",
                    desc: "Um retrato de todo o sistema, pronto para guardar com segurança.",
                    badge: "Snapshot integral",
                  },
                ].map((card) => (
                  <div
                    key={card.scope}
                    className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 flex flex-col justify-between space-y-5"
                  >
                    <div className="space-y-2">
                      <h3 className="text-base font-extrabold text-white">{card.title}</h3>
                      <p className="text-xs text-slate-400 leading-relaxed">{card.desc}</p>
                      <span className="inline-block text-[11px] font-bold bg-[#0A0E17] border border-slate-800 text-amber-400 px-3 py-1 rounded-full">
                        {card.badge}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-2.5 pt-2">
                      <button
                        onClick={() => handleDownloadBackup(card.scope, "JSON")}
                        className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-2.5 rounded-xl text-xs transition"
                      >
                        ⬇ Baixar .JSON
                      </button>
                      <button
                        onClick={() => handleDownloadBackup(card.scope, "SQL")}
                        className="bg-[#0A0E17] hover:bg-slate-800 text-white border border-slate-800 font-bold py-2.5 rounded-xl text-xs transition"
                      >
                        ⬇ Baixar .SQL
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* AÇÕES DE GOVERNANÇA: EXCLUIR ÚLTIMO BACKUP E RESETAR SISTEMA (Card #18) */}
              <div className="bg-[#111726] border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Controle de Governança e Reset</h3>
                  <p className="text-xs text-slate-400">
                    Remova o último registo de backup ou restaure o sistema mantendo exclusivamente o login ADM.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleDeleteLastBackup}
                    className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    🗑️ Excluir último backup
                  </button>
                  <button
                    type="button"
                    onClick={handleResetSystemFromBackupTab}
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    🧹 Resetar sistema
                  </button>
                </div>
              </div>

              {/* TABELA DE AUDITORIA BACKUP_LOGS */}
              <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <div>
                    <h3 className="text-base font-extrabold text-white">Histórico de backups</h3>
                    <p className="text-xs text-slate-400">Registro de auditoria · BACKUP_LOGS</p>
                  </div>
                  <span className="text-xs text-slate-400">{backupLogs.length} exportação(ões) recente(s)</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">ESCOPO EXPORTADO</th>
                        <th className="py-3 px-3">FORMATO</th>
                        <th className="py-3 px-3">DATA/HORA GMT-3</th>
                        <th className="py-3 px-3">RESPONSÁVEL</th>
                        <th className="py-3 px-3 text-right">AÇÃO</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {backupLogs.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="py-6 text-center text-slate-500">
                            Nenhuma exportação ativa no histórico.
                          </td>
                        </tr>
                      ) : (
                        backupLogs.map((log) => (
                          <tr key={log.id}>
                            <td className="py-3 px-3 font-mono text-slate-400">#{log.id}</td>
                            <td className="py-3 px-3 font-bold text-white">{log.scope}</td>
                            <td className="py-3 px-3">
                              <span className="px-2 py-0.5 rounded bg-amber-500/15 text-amber-400 font-mono text-[11px]">
                                {log.format}
                              </span>
                            </td>
                            <td className="py-3 px-3 font-mono text-slate-300">{log.exportedAtGmt3}</td>
                            <td className="py-3 px-3 text-slate-300">{log.exportedBy}</td>
                            <td className="py-3 px-3 text-right">
                              <button
                                onClick={() => setBackupLogs(backupLogs.filter((b) => b.id !== log.id))}
                                className="text-rose-400 hover:underline text-xs font-semibold"
                              >
                                Excluir
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* MODAL DE EDIÇÃO DE ESCALA E DADOS DO EVENTO (Cards #7 e #12) */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEventModal}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  {modalMode === "ESCALA" ? "EDITAR ESCALA — MAIS DETALHES" : "EDITAR DADOS DO EVENTO"}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{editingEvent.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="text-slate-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Título do evento</label>
                <input
                  type="text"
                  required
                  value={modTitle}
                  onChange={(e) => setModTitle(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Categoria (Texto livre)</label>
                <input
                  type="text"
                  required
                  value={modCategory}
                  onChange={(e) => setModCategory(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Para quem é?</label>
                <input
                  type="text"
                  required
                  value={modHonoree}
                  onChange={(e) => setModHonoree(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Cliente</label>
                <input
                  type="text"
                  required
                  value={modClient}
                  onChange={(e) => setModClient(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Responsável ADM</label>
                <input
                  type="text"
                  required
                  value={modAdmin}
                  onChange={(e) => setModAdmin(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Status</label>
                <select
                  value={modStatus}
                  onChange={(e) => setModStatus(e.target.value as EventRecord["status"])}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="PENDENTE">Pendente</option>
                  <option value="CONFIRMADO">Confirmado</option>
                  <option value="CANCELADO">Cancelado</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-300 mb-1">Data</label>
                <input
                  type="date"
                  required
                  value={modDate}
                  onChange={(e) => setModDate(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Início</label>
                <input
                  type="time"
                  required
                  value={modStart}
                  onChange={(e) => setModStart(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Término</label>
                <input
                  type="time"
                  required
                  value={modEnd}
                  onChange={(e) => setModEnd(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">
                Escala de Profissionais (Internos e Terceiros):
              </label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto bg-[#0A0E17] border border-slate-800 p-3 rounded-xl">
                {staffList.length === 0 ? (
                  <p className="text-slate-500">Nenhum profissional cadastrado na aba Cadastros.</p>
                ) : (
                  staffList.map((st) => (
                    <label key={st.id} className="flex items-center justify-between cursor-pointer py-1">
                      <span>
                        <strong className="text-white">{st.name}</strong> ({st.specialty})
                      </span>
                      <input
                        type="checkbox"
                        checked={modTeam.includes(st.name)}
                        onChange={(e) => {
                          if (e.target.checked) setModTeam([...modTeam, st.name]);
                          else setModTeam(modTeam.filter((n) => n !== st.name));
                        }}
                      />
                    </label>
                  ))
                )}
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Observações da escala / detalhes operacionais</label>
              <input
                type="text"
                value={modNotes}
                onChange={(e) => setModNotes(e.target.value)}
                placeholder="Ex: Chegar 1h antes para acender a churrasqueira..."
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl"
              >
                Salvar alterações
              </button>
              <button
                type="button"
                onClick={() => setEditingEvent(null)}
                className="bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl"
              >
                Fechar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE PESSOA CADASTRADA (Card #17) */}
      {editingPerson && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedPerson}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  EDITAR PERFIL · ID #{editingPerson.id}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{editingPerson.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingPerson(null)}
                className="text-slate-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Nome completo</label>
              <input
                type="text"
                required
                value={editPersonName}
                onChange={(e) => setEditPersonName(e.target.value)}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Telefone ANATEL</label>
              <input
                type="tel"
                required
                value={editPersonPhone}
                onChange={(e) => setEditPersonPhone(applyAnatelPhoneMask(e.target.value))}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">E-mail</label>
              <input
                type="email"
                value={editPersonEmail}
                onChange={(e) => setEditPersonEmail(e.target.value)}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Status</label>
                <select
                  value={editPersonStatus}
                  onChange={(e) => setEditPersonStatus(e.target.value as "ATIVO" | "INATIVO")}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="ATIVO">🟢 Ativo</option>
                  <option value="INATIVO">🔴 Inativo</option>
                </select>
              </div>
              {editingPerson.origin === "STAFF" && (
                <div>
                  <label className="block text-slate-300 mb-1">Diária (R$)</label>
                  <input
                    type="number"
                    value={editPersonRate}
                    onChange={(e) => setEditPersonRate(e.target.value)}
                    className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                  />
                </div>
              )}
            </div>

            {editingPerson.origin === "STAFF" && (
              <div>
                <label className="block text-slate-300 mb-1">Especialidade / Função</label>
                <input
                  type="text"
                  value={editPersonSpecialty}
                  onChange={(e) => setEditPersonSpecialty(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-1">
                Definir nova senha (atualiza data de última senha)
              </label>
              <input
                type="password"
                value={editPersonNewPassword}
                onChange={(e) => setEditPersonNewPassword(e.target.value)}
                placeholder="Deixe em branco para manter a atual"
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl"
              >
                Salvar informações
              </button>
              <button
                type="button"
                onClick={() => setEditingPerson(null)}
                className="bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}