"use client";

import React, { useState, useEffect } from "react";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import { getNowGmt3, hasScheduleConflict, validatePasswordRbac } from "../../lib/services/rbacAndTime";
import {
  fetchAllFromSupabase,
  saveEventsToStorage,
  saveClientsToStorage,
  saveStaffToStorage,
  saveUsersToStorage,
  insertBackupLogInSupabase,
  deleteBackupLogFromSupabase,
  resetDatabaseToAdminOnly,
  generateGoogleCalendarUrl,
  setCurrentUserSession,
  StaffMember,
  ClientRecord,
  EventRecord,
  UserAccount,
  UserRole,
  BackupLogRecord,
} from "../../lib/services/storage";

type AdminTab = "DASHBOARD" | "EVENTOS" | "CADASTROS" | "BACKUP";

// CARD #28: Verifica se o evento pertence ao mês atual (AAAA-MM)
function isDateInCurrentMonth(dateStr: string, todayStr: string): boolean {
  if (!dateStr || !todayStr) return false;
  return dateStr.slice(0, 7) === todayStr.slice(0, 7);
}

function formatIsoDatePtBr(iso?: string): string {
  if (!iso) return "18/11/2026";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

// CARDS #30 e #32: Cores padronizadas (Confirmado - Verde; Cancelado - Vermelho; Pendente - Laranja)
function getStatusBadgeClasses(status: EventRecord["status"]): string {
  if (status === "CONFIRMADO") {
    return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40";
  }
  if (status === "CANCELADO") {
    return "bg-red-500/15 text-red-400 border border-red-500/40";
  }
  return "bg-orange-500/15 text-orange-400 border border-orange-500/40";
}

export default function AdminPortalPage() {
  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");
  const [todayGmt3, setTodayGmt3] = useState<string>("2026-11-18");
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLogRecord[]>([]);

  // CARD #24: Estado para esconder/mostrar o Modal de "Novo agendamento rápido" ao clicar no botão do topo
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);

  // Estados de Gestão de Eventos
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "PENDENTE" | "CONFIRMADO" | "CANCELADO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState("");
  const [evCategoryText, setEvCategoryText] = useState("");
  const [evGuestCount, setEvGuestCount] = useState("40"); // Card #25: Quantidade de pessoas
  const [evClient, setEvClient] = useState("");
  const [evAdmin, setEvAdmin] = useState("Administrador Da Hora");
  const [evDate, setEvDate] = useState("");
  const [evStart, setEvStart] = useState("16:00");
  const [evEnd, setEvEnd] = useState("21:00");
  const [evStaffSelected, setEvStaffSelected] = useState<string[]>([]);

  // Modal de Edição de Escala / Dados do Evento
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [modTitle, setModTitle] = useState("");
  const [modCategory, setModCategory] = useState("");
  const [modGuestCount, setModGuestCount] = useState("");
  const [modClient, setModClient] = useState("");
  const [modAdmin, setModAdmin] = useState("");
  const [modDate, setModDate] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");
  const [modStatus, setModStatus] = useState<EventRecord["status"]>("CONFIRMADO");
  const [modTeam, setModTeam] = useState<string[]>([]);
  const [modNotes, setModNotes] = useState("");

  // Estados de Cadastros para os 4 Perfis RBAC
  const [cadRole, setCadRole] = useState<UserRole>("EQUIPE_EXTERNA");
  const [cadName, setCadName] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadPhone, setCadPhone] = useState("");
  const [cadSpecialty, setCadSpecialty] = useState("");
  const [cadCompany, setCadCompany] = useState("");
  const [cadRate, setCadRate] = useState("350");
  const [cadCpfCnpj, setCadCpfCnpj] = useState("");
  const [cadPassword, setCadPassword] = useState("");
  const [cadStatus, setCadStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");

  const [roleFilterTab, setRoleFilterTab] = useState<"TODOS" | UserRole>("TODOS");
  const [personSearch, setPersonSearch] = useState("");

  // Modal de Edição de Usuário Cadastrado
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("CLIENTE");
  const [editUserSpecialty, setEditUserSpecialty] = useState("");
  const [editUserRate, setEditUserRate] = useState("0");
  const [editUserStatus, setEditUserStatus] = useState<"ATIVO" | "INATIVO">("ATIVO");
  const [editUserNewPassword, setEditUserNewPassword] = useState("");

  useEffect(() => {
    const now = getNowGmt3();
    setTodayGmt3(now.dateStr);
    setEvDate(now.dateStr);

    fetchAllFromSupabase().then((data) => {
      setUsers(data.users);
      setEvents(data.events);
      setClients(data.clients);
      setStaffList(data.staff);
      setBackupLogs(data.backupLogs);
    });
  }, []);

  // CARD #28: Eventos do Mês Atual (em vez de semana)
  const eventsThisMonth = events.filter((e) => isDateInCurrentMonth(e.eventDate, todayGmt3));

  // CARD #27: Contadores exatos de eventos por Status
  const countAll = events.length;
  const countPending = events.filter((e) => e.status === "PENDENTE").length;
  const countConfirmed = events.filter((e) => e.status === "CONFIRMADO").length;
  const countCancelled = events.filter((e) => e.status === "CANCELADO").length;
  const pendingEvents = events.filter((e) => e.status === "PENDENTE");

  const phoneValidation = validateAnatelPhone(cadPhone);
  const cadPwCheck = validatePasswordRbac(cadPassword);
  const editPwCheck = validatePasswordRbac(editUserNewPassword);

  const syncAllTablesFromUsers = (updatedUsers: UserAccount[]) => {
    setUsers(updatedUsers);
    saveUsersToStorage(updatedUsers);

    const syncedStaff: StaffMember[] = updatedUsers
      .filter((u) => u.role === "EQUIPE_INTERNA" || u.role === "EQUIPE_EXTERNA")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phoneAnatel: u.phoneAnatel,
        staffType: u.role === "EQUIPE_INTERNA" ? "INTERNA" : "EXTERNA_TERCEIRO",
        specialty: u.specialty || (u.role === "EQUIPE_INTERNA" ? "Apoio Familiar" : "Terceirizado"),
        companyName: u.companyName || (u.role === "EQUIPE_INTERNA" ? "Família Da Hora" : "Prestador MEI"),
        dailyRate: u.dailyRate || 0,
        status: u.status,
        passwordChangedAtIso: u.passwordChangedAtIso,
      }));
    setStaffList(syncedStaff);
    saveStaffToStorage(syncedStaff);

    const syncedClients: ClientRecord[] = updatedUsers
      .filter((u) => u.role === "CLIENTE")
      .map((u) => ({
        id: u.id,
        name: u.name,
        email: u.email,
        phoneAnatel: u.phoneAnatel,
        cpfCnpj: u.cpfCnpj,
        status: u.status,
        passwordChangedAtIso: u.passwordChangedAtIso,
      }));
    setClients(syncedClients);
    saveClientsToStorage(syncedClients);
  };

  const handleSaveCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneValidation.valid) {
      setFeedback({ type: "error", text: `Erro ANATEL: ${phoneValidation.error}` });
      return;
    }
    if (!cadPwCheck.isValid) {
      setFeedback({
        type: "error",
        text: "A senha inicial deve cumprir o RBAC: mínimo de 8 caracteres, caractere especial (!@#$), maiúscula, minúscula e número.",
      });
      return;
    }

    const normalizedEmail = cadEmail.trim().toLowerCase();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      setFeedback({ type: "error", text: "Já existe uma conta cadastrada com este e-mail." });
      return;
    }

    const prefix =
      cadRole === "ADM"
        ? "ADM"
        : cadRole === "EQUIPE_INTERNA"
        ? "INT"
        : cadRole === "EQUIPE_EXTERNA"
        ? "EXT"
        : "CLI";

    const newId = `${prefix}-${Math.floor(1000 + Math.random() * 9000)}`;
    const nowIso = new Date().toISOString();
    const formattedPhone = phoneValidation.formatted || cadPhone;

    const newUser: UserAccount = {
      id: newId,
      name: cadName.trim(),
      email: normalizedEmail,
      phoneAnatel: formattedPhone,
      cpfCnpj: cadRole === "CLIENTE" ? cadCpfCnpj : undefined,
      password: cadPassword,
      role: cadRole,
      specialty:
        cadRole === "ADM"
          ? cadSpecialty || "Administrador Familiar"
          : cadRole === "CLIENTE"
          ? "Cliente de Eventos"
          : cadSpecialty || "Apoio Operacional",
      companyName:
        cadRole === "EQUIPE_EXTERNA"
          ? cadCompany || "Autônomo / MEI"
          : cadRole === "EQUIPE_INTERNA" || cadRole === "ADM"
          ? "Família Da Hora"
          : undefined,
      dailyRate: cadRole === "EQUIPE_EXTERNA" ? Number(cadRate) || 0 : 0,
      status: cadStatus,
      passwordChangedAtIso: nowIso,
    };

    const updatedUsers = [newUser, ...users];
    syncAllTablesFromUsers(updatedUsers);

    setCadName("");
    setCadEmail("");
    setCadPhone("");
    setCadSpecialty("");
    setCadCompany("");
    setCadCpfCnpj("");
    setCadPassword("");

    setFeedback({
      type: "success",
      text: `✓ Conta guardada no Supabase! ${newUser.name} (${newUser.role}) já pode iniciar sessão usando ${newUser.email}.`,
    });
  };

  const openEditUserModal = (u: UserAccount) => {
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserPhone(u.phoneAnatel);
    setEditUserRole(u.role);
    setEditUserSpecialty(u.specialty || "");
    setEditUserRate(String(u.dailyRate || 0));
    setEditUserStatus(u.status);
    setEditUserNewPassword("");
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    const check = validateAnatelPhone(editUserPhone);
    if (!check.valid) {
      setFeedback({ type: "error", text: `Telefone inválido na regra ANATEL: ${check.error}` });
      return;
    }
    if (editUserNewPassword && !editPwCheck.isValid) {
      setFeedback({
        type: "error",
        text: "A nova senha precisa ter no mínimo 8 caracteres e incluir caractere especial.",
      });
      return;
    }

    const updatedPhone = check.formatted || editUserPhone;
    const updatedPasswordIso = editUserNewPassword
      ? new Date().toISOString()
      : editingUser.passwordChangedAtIso;

    const updatedUsers = users.map((u) =>
      u.id === editingUser.id
        ? {
            ...u,
            name: editUserName.trim(),
            email: editUserEmail.trim().toLowerCase(),
            phoneAnatel: updatedPhone,
            role: editUserRole,
            specialty: editUserSpecialty,
            dailyRate: editUserRole === "EQUIPE_EXTERNA" ? Number(editUserRate) || 0 : 0,
            status: editUserStatus,
            password: editUserNewPassword || u.password,
            passwordChangedAtIso: updatedPasswordIso,
          }
        : u
    );

    syncAllTablesFromUsers(updatedUsers);
    setEditingUser(null);
    setFeedback({
      type: "success",
      text: `✓ Perfil #${editingUser.id} (${editUserName}) atualizado no Supabase!`,
    });
  };

  // CARDS #22 e #26: Ao confirmar/aprovar um evento (no Dashboard ou na Gestão de Eventos), coloca na agenda automaticamente
  const handleApproveAndSyncGcal = (id: string) => {
    const targetEv = events.find((ev) => ev.id === id);
    const updated = events.map((ev) =>
      ev.id === id
        ? {
            ...ev,
            status: "CONFIRMADO" as const,
            responsibleAdmin: ev.responsibleAdmin.includes("confirmar")
              ? "Administrador Da Hora"
              : ev.responsibleAdmin,
            googleCalendarEventId: `gcal_auto_${Math.floor(1000 + Math.random() * 9000)}`,
          }
        : ev
    );
    setEvents(updated);
    saveEventsToStorage(updated);

    if (targetEv) {
      setEvDate(targetEv.eventDate);
    }

    setFeedback({
      type: "success",
      text: `✓ Evento "${targetEv?.title || id}" confirmado e adicionado automaticamente na agenda do mês!`,
    });
  };

  const handleCancelEvent = (id: string) => {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev));
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "Evento marcado como Cancelado (Vermelho) e horário liberado." });
  };

  const openEventModal = (ev: EventRecord) => {
    setEditingEvent(ev);
    setModTitle(ev.title);
    setModCategory(ev.eventType);
    setModGuestCount(ev.honoreeName);
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

    const formattedGuests = modGuestCount.includes("pessoa")
      ? modGuestCount
      : `${modGuestCount} pessoas`;

    const updatedEv: EventRecord = {
      ...editingEvent,
      title: modTitle,
      eventType: modCategory || "Evento",
      honoreeName: formattedGuests,
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
    setFeedback({ type: "success", text: "✓ Dados e escala do evento atualizados na agenda e no Supabase!" });
  };

  // CARD #21: Ao adicionar um evento como ADM, ele adiciona na agenda automaticamente como CONFIRMADO
  const handleCreateManualEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!evCategoryText.trim()) {
      setFeedback({ type: "error", text: "Digite a categoria do evento." });
      return;
    }
    if (!evGuestCount.trim()) {
      setFeedback({ type: "error", text: "Informe obrigatoriamente a 'Quantidade de pessoas'." });
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

    const formattedGuests = evGuestCount.includes("pessoa") ? evGuestCount : `${evGuestCount} pessoas`;

    const newEv: EventRecord = {
      id: `EV-${Math.floor(1000 + Math.random() * 9000)}`,
      title: evTitle || `${evCategoryText} (${formattedGuests})`,
      eventType: evCategoryText.trim(),
      honoreeName: formattedGuests,
      clientName: evClient || "Cliente Da Hora",
      responsibleAdmin: evAdmin,
      eventDate: evDate,
      startTime: evStart,
      endTime: evEnd,
      status: "CONFIRMADO",
      googleCalendarEventId: `gcal_auto_${Math.floor(1000 + Math.random() * 9000)}`,
      supportTeam: evStaffSelected.length > 0 ? evStaffSelected : ["Equipe padrão"],
    };

    const updated = [newEv, ...events];
    setEvents(updated);
    saveEventsToStorage(updated);
    setEvTitle("");
    setEvCategoryText("");
    setEvGuestCount("40");
    setEvClient("");
    setShowNewEventModal(false);
    setSelectedCalendarDay(evDate);
    setFeedback({
      type: "success",
      text: `✓ Evento "${newEv.title}" adicionado automaticamente na agenda do dia ${newEv.eventDate}!`,
    });
  };

  const handleDownloadBackup = async (scope: "Usuários" | "Eventos" | "Completo", format: "JSON" | "SQL") => {
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
          exportedByAdmin: "Administrador Da Hora",
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
        users.forEach((u) => {
          content += `INSERT INTO users (id, name, email, phone_anatel, role, status) VALUES ('${u.id}', '${u.name}', '${u.email}', '${u.phoneAnatel}', '${u.role}', '${u.status}');\n`;
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

    const newLog: BackupLogRecord = {
      id: `BKP-${Math.floor(1000 + Math.random() * 9000)}`,
      scope,
      format,
      exportedAtGmt3: `${now.dateStr.split("-").reverse().join("/")} ${now.timeStr}`,
      exportedBy: "Administrador Da Hora",
    };

    setBackupLogs([newLog, ...backupLogs]);
    await insertBackupLogInSupabase(newLog);
    setFeedback({ type: "success", text: `✓ Exportação "${filename}" concluída e registada no Supabase!` });
  };

  const handleDeleteLastBackup = async () => {
    if (backupLogs.length === 0) {
      setFeedback({ type: "error", text: "Não há backups no histórico para excluir." });
      return;
    }
    const lastLog = backupLogs[0];
    setBackupLogs(backupLogs.slice(1));
    await deleteBackupLogFromSupabase(lastLog.id);
    setFeedback({ type: "success", text: "🗑️ Último backup excluído do Supabase!" });
  };

  const handleResetSystemFromBackupTab = async () => {
    const clean = await resetDatabaseToAdminOnly();
    setUsers(clean.users);
    setEvents(clean.events);
    setClients(clean.clients);
    setStaffList(clean.staff);
    setBackupLogs([]);
    setEvStaffSelected([]);
    setFeedback({
      type: "success",
      text: "🧹 Sistema e tabelas do Supabase resetados com sucesso! Mantido apenas o login ADM padrão.",
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchRole = roleFilterTab === "TODOS" || u.role === roleFilterTab;
    const matchQuery =
      !personSearch.trim() ||
      u.name.toLowerCase().includes(personSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(personSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(personSearch.toLowerCase()) ||
      u.phoneAnatel.includes(personSearch) ||
      (u.specialty || "").toLowerCase().includes(personSearch.toLowerCase());
    return matchRole && matchQuery;
  });

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

  const currentYearMonth = (evDate || todayGmt3).slice(0, 7);
  const [calYear, calMonth] = currentYearMonth.split("-").map(Number);
  const daysInMonth = new Date(calYear || 2026, calMonth || 11, 0).getDate();
  const firstWeekday = new Date(calYear || 2026, (calMonth || 11) - 1, 1).getDay();

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
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
              { id: "DASHBOARD", label: "Dashboard (Mensal)", icon: "⊞" },
              { id: "EVENTOS", label: "Gestão de eventos", icon: "📅" },
              { id: "CADASTROS", label: "Cadastros (RBAC)", icon: "👥" },
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
            <p className="text-xs font-bold text-white">Supabase & Google Calendar</p>
            <p className="text-[11px] text-slate-400">Agenda sincronizada automaticamente.</p>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                AD
              </div>
              <div className="leading-tight">
                <p className="text-xs font-bold text-white">Administrador Da Hora</p>
                <p className="text-[11px] text-slate-400">Perfil ADM</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentUserSession(null);
                window.location.href = "/";
              }}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-400 px-1 transition"
            >
              <span>↪</span>
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 px-6 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
              ADMINISTRAÇÃO DO ESPAÇO · SUPABASE CLOUD
            </p>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
              {activeTab === "DASHBOARD" && "Dashboard do Mês"}
              {activeTab === "EVENTOS" && "Gestão de eventos"}
              {activeTab === "CADASTROS" && "Cadastros por Perfil RBAC"}
              {activeTab === "BACKUP" && "Backup e governança"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "DASHBOARD" &&
                "Visão mensal completa · Cores: Confirmado (Verde), Pendente (Laranja), Cancelado (Vermelho)."}
              {activeTab === "EVENTOS" &&
                "Agenda cobrindo 100% da área. Use o botão no topo para abrir um Novo Agendamento Rápido."}
              {activeTab === "CADASTROS" &&
                "Qualquer conta criada aqui é gravada no Supabase e já pode fazer login imediatamente."}
              {activeTab === "BACKUP" && "Exportação segura, exclusão de último backup e reset."}
            </p>
          </div>

          {/* CARD #24: Botão na parte de cima para abrir o modal de Novo Agendamento Rápido */}
          {(activeTab === "DASHBOARD" || activeTab === "EVENTOS") && (
            <button
              type="button"
              onClick={() => setShowNewEventModal(true)}
              className="text-xs bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-3 rounded-xl transition shrink-0 shadow-lg shadow-amber-500/20"
            >
              + Novo agendamento rápido
            </button>
          )}
        </header>

        {feedback && (
          <div
            className={`mx-6 mt-5 p-3.5 rounded-xl text-xs flex justify-between items-center border ${
              feedback.type === "success"
                ? "bg-emerald-950/60 border-emerald-500/40 text-emerald-200"
                : "bg-red-950/60 border-red-500/40 text-red-200"
            }`}
          >
            <span>{feedback.text}</span>
            <button onClick={() => setFeedback(null)} className="font-bold ml-4">
              ✕
            </button>
          </div>
        )}

        <main className="p-6 space-y-6 flex-1">
          {/* ABA 1: DASHBOARD MENSAL (Card #28 e Card #32) */}
          {activeTab === "DASHBOARD" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                <div
                  onClick={() => {
                    setStatusFilter("TODOS");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-amber-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Eventos no mês</span>
                    <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">
                      MÊS ATUAL ({currentYearMonth})
                    </span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(eventsThisMonth.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">Ver agenda completa do mês →</p>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter("CONFIRMADO");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-emerald-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Confirmados no mês (Verde)</span>
                    <span className="text-emerald-400 font-bold">✓</span>
                  </div>
                  <p className="text-4xl font-extrabold text-emerald-400 mt-2">
                    {String(eventsThisMonth.filter((e) => e.status === "CONFIRMADO").length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-emerald-400/80 mt-1">Total geral: {countConfirmed} confirmado(s) →</p>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter("PENDENTE");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-orange-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Pendentes (Laranja)</span>
                    <span className="text-orange-400 font-bold">●</span>
                  </div>
                  <p className="text-4xl font-extrabold text-orange-400 mt-2">
                    {String(countPending).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-orange-400/80 mt-1">Aprovar solicitações →</p>
                </div>

                <div
                  onClick={() => {
                    setStatusFilter("CANCELADO");
                    setActiveTab("EVENTOS");
                  }}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-red-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Cancelados (Vermelho)</span>
                    <span className="text-red-400 font-bold">✕</span>
                  </div>
                  <p className="text-4xl font-extrabold text-red-400 mt-2">
                    {String(countCancelled).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-red-400/80 mt-1">Ver histórico de cancelados →</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Agenda do mês ({currentYearMonth})</h2>
                      <p className="text-xs text-slate-400">
                        Clique num evento para editar dados ou aprovar/escalar equipe
                      </p>
                    </div>
                    <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                      {eventsThisMonth.length} evento(s) no mês
                    </span>
                  </div>

                  {eventsThisMonth.length === 0 ? (
                    <div className="bg-[#0A0E17] border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-300">
                        Nenhum evento programado para este mês.
                      </p>
                      <p className="text-xs text-slate-500">
                        Use o botão &quot;+ Novo agendamento rápido&quot; no topo para agendar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventsThisMonth.map((ev) => (
                        <div
                          key={ev.id}
                          onClick={() => openEventModal(ev)}
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
                                {/* CARD #32: Cores de status padronizadas */}
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClasses(
                                    ev.status
                                  )}`}
                                >
                                  {ev.status === "CONFIRMADO"
                                    ? "✓ Confirmado"
                                    : ev.status === "CANCELADO"
                                    ? "✕ Cancelado"
                                    : "● Pendente"}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                <span className="text-amber-400 font-semibold">{ev.eventType}</span> · Quantidade:{" "}
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
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
                              >
                                ✓ Aprovar na Agenda
                              </button>
                            )}
                            <button
                              onClick={() => openEventModal(ev)}
                              className="bg-[#111726] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl"
                            >
                              Editar escala
                            </button>
                            {ev.status !== "CANCELADO" && (
                              <button
                                onClick={() => handleCancelEvent(ev.id)}
                                className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
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

                <div className="xl:col-span-4 space-y-4">
                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Solicitações Pendentes</h3>
                      <span className="text-[11px] text-orange-400 font-semibold">
                        {pendingEvents.length} pendente(s)
                      </span>
                    </div>
                    {pendingEvents.length === 0 ? (
                      <p className="text-xs text-slate-500">Nenhuma solicitação pendente de aprovação.</p>
                    ) : (
                      pendingEvents.map((pe) => (
                        <div
                          key={pe.id}
                          onClick={() => openEventModal(pe)}
                          className="cursor-pointer bg-[#0A0E17] hover:bg-[#141C2E] border border-orange-500/30 rounded-xl p-3 flex items-center justify-between transition"
                        >
                          <div>
                            <p className="text-xs font-bold text-white">{pe.title}</p>
                            <p className="text-[11px] text-slate-400">
                              {pe.eventDate} · {pe.honoreeName}
                            </p>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleApproveAndSyncGcal(pe.id);
                            }}
                            className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold"
                          >
                            ✓ Aprovar
                          </button>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: GESTÃO DE EVENTOS — AGENDA COBRINDO A ÁREA TODA (Cards #23, #24, #26, #27 e #30) */}
          {activeTab === "EVENTOS" && (
            <div className="w-full space-y-6">
              {/* CALENDÁRIO MENSAL COBRINDO 100% DA LARGURA (Card #23) */}
              <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-white">
                      Agenda Mensal Completa ({currentYearMonth})
                    </h3>
                    <p className="text-xs text-slate-400">
                      Clique em qualquer dia para filtrar os eventos ou clique em &quot;+ Novo agendamento rápido&quot; no topo
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Confirmado ({countConfirmed})
                    </span>
                    <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Pendente ({countPending})
                    </span>
                    <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                      <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Cancelado ({countCancelled})
                    </span>
                    {selectedCalendarDay && (
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        className="text-amber-400 underline font-bold"
                      >
                        Mostrar mês inteiro
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-bold text-slate-400 uppercase">
                  <span>DOM</span>
                  <span>SEG</span>
                  <span>TER</span>
                  <span>QUA</span>
                  <span>QUI</span>
                  <span>SEX</span>
                  <span>SÁB</span>
                </div>

                <div className="grid grid-cols-7 gap-2">
                  {Array.from({ length: firstWeekday }).map((_, idx) => (
                    <div key={`empty-${idx}`} className="h-14 rounded-2xl bg-transparent" />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, idx) => {
                    const dayNum = idx + 1;
                    const fullDate = `${currentYearMonth}-${String(dayNum).padStart(2, "0")}`;
                    const dayEvents = events.filter((e) => e.eventDate === fullDate);
                    const hasConfirmed = dayEvents.some((e) => e.status === "CONFIRMADO");
                    const hasPending = dayEvents.some((e) => e.status === "PENDENTE");
                    const hasCancelled = dayEvents.some((e) => e.status === "CANCELADO");
                    const isSelected = selectedCalendarDay === fullDate;

                    return (
                      <button
                        key={fullDate}
                        type="button"
                        onClick={() => {
                          setEvDate(fullDate);
                          setSelectedCalendarDay(isSelected ? null : fullDate);
                        }}
                        className={`h-14 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center transition ${
                          isSelected
                            ? "bg-[#F59E0B] text-slate-950 border-amber-400 shadow-lg"
                            : "bg-[#0A0E17] text-slate-200 border-slate-800/80 hover:border-amber-500/50"
                        }`}
                      >
                        <span>{dayNum}</span>
                        {dayEvents.length > 0 && (
                          <div className="flex items-center gap-1 mt-1">
                            {hasConfirmed && <span className="w-2 h-2 rounded-full bg-emerald-400" />}
                            {hasPending && <span className="w-2 h-2 rounded-full bg-orange-400" />}
                            {hasCancelled && <span className="w-2 h-2 rounded-full bg-red-500" />}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* LISTAGEM DE EVENTOS EM LARGURA TOTAL COM CONTAGEM POR STATUS (Card #27) E BOTÃO APROVAR (Card #26) */}
              <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  {/* CARD #27: Mostrar quantidade de eventos de acordo com o Status */}
                  <div className="flex flex-wrap gap-2 bg-[#0A0E17] p-1.5 rounded-2xl border border-slate-800">
                    <button
                      onClick={() => setStatusFilter("TODOS")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        statusFilter === "TODOS"
                          ? "bg-[#F59E0B] text-slate-950"
                          : "text-slate-400 hover:text-white"
                      }`}
                    >
                      Todos ({countAll})
                    </button>
                    <button
                      onClick={() => setStatusFilter("PENDENTE")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        statusFilter === "PENDENTE"
                          ? "bg-orange-500 text-slate-950"
                          : "text-orange-400 hover:bg-orange-500/10"
                      }`}
                    >
                      ● Pendentes ({countPending})
                    </button>
                    <button
                      onClick={() => setStatusFilter("CONFIRMADO")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        statusFilter === "CONFIRMADO"
                          ? "bg-emerald-500 text-slate-950"
                          : "text-emerald-400 hover:bg-emerald-500/10"
                      }`}
                    >
                      ✓ Confirmados ({countConfirmed})
                    </button>
                    <button
                      onClick={() => setStatusFilter("CANCELADO")}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                        statusFilter === "CANCELADO"
                          ? "bg-red-500 text-white"
                          : "text-red-400 hover:bg-red-500/10"
                      }`}
                    >
                      ✕ Cancelados ({countCancelled})
                    </button>
                  </div>

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="🔍 Procurar evento por título, data ou categoria..."
                    className="bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white w-full sm:w-80"
                  />
                </div>

                {filteredEvents.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    Nenhum evento encontrado para o filtro selecionado.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {filteredEvents.map((ev) => (
                      <div
                        key={ev.id}
                        className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-800 text-amber-300">
                              {ev.eventType}
                            </span>
                            {/* CARD #30: Cores Confirmado Verde, Cancelado Vermelho, Pendente Laranja */}
                            <span
                              className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClasses(
                                ev.status
                              )}`}
                            >
                              {ev.status === "CONFIRMADO"
                                ? "✓ Confirmado"
                                : ev.status === "CANCELADO"
                                ? "✕ Cancelado"
                                : "● Pendente"}
                            </span>
                          </div>
                          <p className="text-xs text-slate-300">
                            📅 <strong>{ev.eventDate}</strong> ({ev.startTime} - {ev.endTime}) · 👥 Quantidade:{" "}
                            <strong>{ev.honoreeName}</strong> · Cliente: {ev.clientName}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            ADM: {ev.responsibleAdmin} · Equipe: {ev.supportTeam.join(", ")}
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                          {/* CARD #26: Deve ser possível aprovar os eventos na área de gestão também */}
                          {ev.status === "PENDENTE" && (
                            <button
                              onClick={() => handleApproveAndSyncGcal(ev.id)}
                              className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md"
                            >
                              ✓ Aprovar evento
                            </button>
                          )}
                          <button
                            onClick={() => openEventModal(ev)}
                            className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                          >
                            ✏️ Editar dados
                          </button>
                          <a
                            href={generateGoogleCalendarUrl(ev)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                          >
                            📅 GCal
                          </a>
                          {ev.status !== "CANCELADO" && (
                            <button
                              onClick={() => handleCancelEvent(ev.id)}
                              className="bg-red-950/60 hover:bg-red-900 text-red-200 border border-red-800/60 text-xs font-semibold px-3 py-2 rounded-xl"
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
          )}

          {/* ABA 3: CADASTROS COM 4 ABAS DE PERFIL RBAC */}
          {activeTab === "CADASTROS" && (
            <div className="space-y-6">
              <form
                onSubmit={handleSaveCadastro}
                className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                  <div>
                    <h2 className="text-lg font-extrabold text-white">Adicionar uma pessoa (4 Perfis RBAC)</h2>
                    <p className="text-xs text-slate-400">
                      Selecione a aba do perfil abaixo. A conta é salva diretamente no Supabase.
                    </p>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-[#0A0E17] p-1.5 rounded-2xl border border-slate-800">
                    {[
                      { id: "ADM", label: "🛡️ ADM" },
                      { id: "EQUIPE_INTERNA", label: "🏠 Equipe Interna" },
                      { id: "EQUIPE_EXTERNA", label: "👨‍🍳 Equipe Externa" },
                      { id: "CLIENTE", label: "🙋‍♂️ Cliente" },
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCadRole(tab.id as UserRole)}
                        className={`py-2 px-3 rounded-xl text-xs font-bold transition ${
                          cadRole === tab.id
                            ? "bg-[#F59E0B] text-slate-950 shadow-md"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {tab.label}
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
                      placeholder="Nome completo"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      value={cadEmail}
                      onChange={(e) => setCadEmail(e.target.value)}
                      placeholder="usuario@exemplo.com"
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">Status da Conta</label>
                    <select
                      value={cadStatus}
                      onChange={(e) => setCadStatus(e.target.value as "ATIVO" | "INATIVO")}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                    >
                      <option value="ATIVO">🟢 Ativo (Pode logar)</option>
                      <option value="INATIVO">🔴 Inativo (Bloqueado)</option>
                    </select>
                  </div>

                  {cadRole === "ADM" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Cargo / Papel Familiar</label>
                      <input
                        type="text"
                        value={cadSpecialty}
                        onChange={(e) => setCadSpecialty(e.target.value)}
                        placeholder="Ex: Gestor Geral (Pai / Mãe)"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      />
                    </div>
                  )}

                  {cadRole === "EQUIPE_INTERNA" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">Função Interna *</label>
                      <input
                        type="text"
                        required
                        value={cadSpecialty}
                        onChange={(e) => setCadSpecialty(e.target.value)}
                        placeholder="Ex: Recepção, Organização, Limpeza"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      />
                    </div>
                  )}

                  {cadRole === "EQUIPE_EXTERNA" && (
                    <>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Especialidade *</label>
                        <input
                          type="text"
                          required
                          value={cadSpecialty}
                          onChange={(e) => setCadSpecialty(e.target.value)}
                          placeholder="Ex: Churrasqueiro, Garçom, Juiz"
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Empresa / MEI</label>
                        <input
                          type="text"
                          value={cadCompany}
                          onChange={(e) => setCadCompany(e.target.value)}
                          placeholder="Ex: Paulo Grill MEI"
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Valor da Diária (R$)</label>
                        <input
                          type="number"
                          value={cadRate}
                          onChange={(e) => setCadRate(e.target.value)}
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>
                    </>
                  )}

                  {cadRole === "CLIENTE" && (
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">CPF / CNPJ (Opcional)</label>
                      <input
                        type="text"
                        value={cadCpfCnpj}
                        onChange={(e) => setCadCpfCnpj(e.target.value)}
                        placeholder="000.000.000-00"
                        className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      Senha de Login (Obrigatório RBAC: mín. 8 caracteres + especial) *
                    </label>
                    <input
                      type="text"
                      required
                      value={cadPassword}
                      onChange={(e) => setCadPassword(e.target.value)}
                      placeholder="Ex: Equipe@2026 ou Cliente@2026"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white"
                    />
                    <div className="flex flex-wrap gap-3 mt-1.5 text-[11px]">
                      <span className={cadPwCheck.minLength ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        ✓ Tamanho mínimo (8+ chars)
                      </span>
                      <span className={cadPwCheck.hasSpecial ? "text-emerald-400 font-bold" : "text-slate-500"}>
                        ✓ Caractere especial (!@#$)
                      </span>
                      <span className={cadPwCheck.hasUpper && cadPwCheck.hasLower ? "text-emerald-400" : "text-slate-500"}>
                        ✓ Maiúscula e minúscula
                      </span>
                      <span className={cadPwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>✓ Número</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="w-full sm:w-auto bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 px-8 rounded-2xl text-xs transition"
                  >
                    + Criar Conta no Supabase ({cadRole})
                  </button>
                </div>
              </form>

              <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex flex-wrap gap-1.5 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                    {[
                      { id: "TODOS", label: `Todos (${users.length})` },
                      { id: "ADM", label: `ADM (${users.filter((u) => u.role === "ADM").length})` },
                      {
                        id: "EQUIPE_INTERNA",
                        label: `Equipe Interna (${users.filter((u) => u.role === "EQUIPE_INTERNA").length})`,
                      },
                      {
                        id: "EQUIPE_EXTERNA",
                        label: `Equipe Externa (${users.filter((u) => u.role === "EQUIPE_EXTERNA").length})`,
                      },
                      {
                        id: "CLIENTE",
                        label: `Clientes (${users.filter((u) => u.role === "CLIENTE").length})`,
                      },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => setRoleFilterTab(f.id as "TODOS" | UserRole)}
                        className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                          roleFilterTab === f.id
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
                    placeholder="🔍 Procurar por nome, ID, e-mail ou telefone..."
                    className="bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white w-full md:w-80"
                  />
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                        <th className="py-3 px-3">ID</th>
                        <th className="py-3 px-3">NOME / PERFIL RBAC</th>
                        <th className="py-3 px-3">E-MAIL DE LOGIN & TELEFONE</th>
                        <th className="py-3 px-3">ESPECIALIDADE / DIÁRIA</th>
                        <th className="py-3 px-3">STATUS</th>
                        <th className="py-3 px-3">ÚLTIMA ATUALIZAÇÃO DE SENHA</th>
                        <th className="py-3 px-3 text-right">AÇÕES</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {filteredUsers.map((u) => (
                        <tr key={u.id} className="hover:bg-[#0A0E17]/60 transition">
                          <td className="py-3.5 px-3 font-mono font-bold text-amber-400">#{u.id}</td>
                          <td className="py-3.5 px-3">
                            <p className="font-bold text-white">{u.name}</p>
                            <span className="inline-block mt-0.5 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                              {u.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-3">
                            <p className="text-slate-200 font-semibold">{u.email}</p>
                            <p className="font-mono text-[11px] text-slate-400">{u.phoneAnatel}</p>
                          </td>
                          <td className="py-3.5 px-3">
                            <p className="text-slate-200">{u.specialty || "—"}</p>
                            {u.role === "EQUIPE_EXTERNA" && (
                              <span className="text-[10px] text-emerald-400 font-semibold">
                                R$ {u.dailyRate || 0} / diária
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-3">
                            <span
                              className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                u.status === "ATIVO"
                                  ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                                  : "bg-red-500/15 text-red-400 border border-red-500/30"
                              }`}
                            >
                              {u.status === "ATIVO" ? "● Ativo" : "○ Inativo"}
                            </span>
                          </td>
                          <td className="py-3.5 px-3 font-mono text-slate-300">
                            {formatIsoDatePtBr(u.passwordChangedAtIso)}
                          </td>
                          <td className="py-3.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditUserModal(u)}
                              className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                            >
                              ✏️ Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ABA 4: BACKUP */}
          {activeTab === "BACKUP" && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {[
                  {
                    scope: "Usuários" as const,
                    title: "Pessoas e acessos",
                    desc: "Todas as contas dos 4 perfis RBAC sincronizadas no Supabase.",
                    badge: `${users.length} contas`,
                  },
                  {
                    scope: "Eventos" as const,
                    title: "Eventos e escalas",
                    desc: "Histórico completo, quantidade de pessoas, datas em GMT-3 e equipes escaladas.",
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

              <div className="bg-[#111726] border border-amber-500/30 rounded-3xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div>
                  <h3 className="text-sm font-extrabold text-white">Controle de Governança e Reset</h3>
                  <p className="text-xs text-slate-400">
                    Exclua o último backup ou faça reset às tabelas do Supabase mantendo apenas o ADM padrão.
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
                    className="bg-red-950/80 hover:bg-red-900 text-red-200 border border-red-800 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    🧹 Resetar sistema
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* CARD #24: MODAL DE "NOVO AGENDAMENTO RÁPIDO" (Escondido por padrão, abre ao clicar no botão do topo) */}
      {showNewEventModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateManualEvent}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  ADICIONAR AUTOMATICAMENTE NA AGENDA
                </span>
                <h2 className="text-lg font-extrabold text-white mt-0.5">+ Novo agendamento rápido</h2>
              </div>
              <button
                type="button"
                onClick={() => setShowNewEventModal(false)}
                className="text-slate-400 hover:text-white text-base font-bold px-2"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Título do evento *</label>
              <input
                type="text"
                required
                value={evTitle}
                onChange={(e) => setEvTitle(e.target.value)}
                placeholder="Ex: Churrasco Aniversário"
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            {/* CARD #25: Quantidade de pessoas */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Categoria (Texto livre) *</label>
                <input
                  type="text"
                  required
                  value={evCategoryText}
                  onChange={(e) => setEvCategoryText(e.target.value)}
                  placeholder="Ex: Aniversário, Futebol..."
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Quantidade de pessoas *</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={evGuestCount}
                  onChange={(e) => setEvGuestCount(e.target.value)}
                  placeholder="Ex: 50"
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Cliente vinculado</label>
                <input
                  type="text"
                  required
                  value={evClient}
                  onChange={(e) => setEvClient(e.target.value)}
                  placeholder="Marcos Oliveira"
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Responsável ADM</label>
                <input
                  type="text"
                  required
                  value={evAdmin}
                  onChange={(e) => setEvAdmin(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="block text-slate-300 mb-1">Data</label>
                <input
                  type="date"
                  required
                  value={evDate}
                  onChange={(e) => setEvDate(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Início</label>
                <input
                  type="time"
                  required
                  value={evStart}
                  onChange={(e) => setEvStart(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Término</label>
                <input
                  type="time"
                  required
                  value={evEnd}
                  onChange={(e) => setEvEnd(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-1.5">EQUIPE ESCALADA</p>
              <div className="space-y-1.5 max-h-32 overflow-y-auto bg-[#0A0E17] border border-slate-800 p-3 rounded-xl">
                {staffList.length === 0 ? (
                  <p className="text-slate-500">Cadastre Equipe Interna ou Externa na aba Cadastros para escalá-los.</p>
                ) : (
                  staffList.map((st) => (
                    <label key={st.id} className="flex items-center justify-between cursor-pointer py-1">
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

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold py-3 rounded-xl transition"
              >
                ✓ Confirmar e colocar na agenda
              </button>
              <button
                type="button"
                onClick={() => setShowNewEventModal(false)}
                className="bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl"
              >
                Fechar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE CONTA CADASTRADA */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedUser}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  EDITAR CONTA · ID #{editingUser.id}
                </span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">{editingUser.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-white text-base font-bold"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1">Perfil RBAC</label>
                <select
                  value={editUserRole}
                  onChange={(e) => setEditUserRole(e.target.value as UserRole)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="ADM">ADM</option>
                  <option value="EQUIPE_INTERNA">Equipe Interna</option>
                  <option value="EQUIPE_EXTERNA">Equipe Externa</option>
                  <option value="CLIENTE">Cliente</option>
                </select>
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Status</label>
                <select
                  value={editUserStatus}
                  onChange={(e) => setEditUserStatus(e.target.value as "ATIVO" | "INATIVO")}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="ATIVO">🟢 Ativo</option>
                  <option value="INATIVO">🔴 Inativo</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Nome completo</label>
              <input
                type="text"
                required
                value={editUserName}
                onChange={(e) => setEditUserName(e.target.value)}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">E-mail de Login</label>
              <input
                type="email"
                required
                value={editUserEmail}
                onChange={(e) => setEditUserEmail(e.target.value)}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Telefone ANATEL</label>
              <input
                type="tel"
                required
                value={editUserPhone}
                onChange={(e) => setEditUserPhone(applyAnatelPhoneMask(e.target.value))}
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white"
              />
            </div>

            <div>
              <label className="block text-slate-300 mb-1">Nova senha (Opcional · Mín. 8 chars + especial)</label>
              <input
                type="text"
                value={editUserNewPassword}
                onChange={(e) => setEditUserNewPassword(e.target.value)}
                placeholder="Deixe em branco para manter a senha atual"
                className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 font-mono text-white"
              />
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl"
              >
                Guardar informações
              </button>
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="bg-slate-800 text-slate-300 font-bold py-3 px-4 rounded-xl"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL DE EDIÇÃO DE EVENTO / ESCALA */}
      {editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEventModal}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-extrabold text-white">Editar Evento & Escala</h3>
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
                <label className="block text-slate-300 mb-1">Título</label>
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
                <label className="block text-slate-300 mb-1">Quantidade de pessoas</label>
                <input
                  type="text"
                  required
                  value={modGuestCount}
                  onChange={(e) => setModGuestCount(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1">Status (Verde / Laranja / Vermelho)</label>
                <select
                  value={modStatus}
                  onChange={(e) => setModStatus(e.target.value as EventRecord["status"])}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                >
                  <option value="CONFIRMADO">🟢 Confirmado (Verde)</option>
                  <option value="PENDENTE">🟠 Pendente (Laranja)</option>
                  <option value="CANCELADO">🔴 Cancelado (Vermelho)</option>
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
                  onChange={(e) => setEditEndOrModEnd(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-2.5 py-2 text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 font-bold mb-1.5">Escala de Profissionais:</label>
              <div className="space-y-1.5 max-h-32 overflow-y-auto bg-[#0A0E17] border border-slate-800 p-3 rounded-xl">
                {staffList.map((st) => (
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
                ))}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl"
              >
                Guardar alterações
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
    </div>
  );

  function setEditEndOrModEnd(val: string) {
    setModEnd(val);
  }
}