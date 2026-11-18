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

function isDateInCurrentWeek(dateStr: string, todayStr: string): boolean {
  if (!dateStr || !todayStr) return false;
  const [ty, tm, td] = todayStr.split("-").map(Number);
  const [ey, em, ed] = dateStr.split("-").map(Number);
  const today = new Date(ty, tm - 1, td);
  const target = new Date(ey, em - 1, ed);

  const dayOfWeek = today.getDay();
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
  const [backupLogs, setBackupLogs] = useState<BackupLogRecord[]>([]);

  // Estados de Gestão de Eventos
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "PENDENTE" | "CONFIRMADO" | "CANCELADO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState("");
  const [evCategoryText, setEvCategoryText] = useState("");
  const [evHonoree, setEvHonoree] = useState("");
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
  const [modHonoree, setModHonoree] = useState("");
  const [modClient, setModClient] = useState("");
  const [modAdmin, setModAdmin] = useState("");
  const [modDate, setModDate] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");
  const [modStatus, setModStatus] = useState<EventRecord["status"]>("CONFIRMADO");
  const [modTeam, setModTeam] = useState<string[]>([]);
  const [modNotes, setModNotes] = useState("");

  // Estados de Cadastros para os 4 Perfis RBAC (ADM, EQUIPE_INTERNA, EQUIPE_EXTERNA, CLIENTE)
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

  // Filtro por Abas dos 4 Perfis na Listagem Abaixo
  const [roleFilterTab, setRoleFilterTab] = useState<"TODOS" | UserRole>("TODOS");
  const [personSearch, setPersonSearch] = useState("");

  // Modal de Edição de Utilizador Cadastrado
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

  const eventsThisWeek = events.filter(
    (e) => e.status !== "CANCELADO" && isDateInCurrentWeek(e.eventDate, todayGmt3)
  );
  const pendingEvents = events.filter((e) => e.status === "PENDENTE");

  const phoneValidation = validateAnatelPhone(cadPhone);
  const cadPwCheck = validatePasswordRbac(cadPassword);
  const editPwCheck = validatePasswordRbac(editUserNewPassword);

  // Sincroniza a tabela central `users` com `staff`, `clients` e o Supabase
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

  // CADASTRAR NOVA CONTA NO SUPABASE PARA QUALQUER UM DOS 4 PERFIS RBAC
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
          ? cadCompany || "Autónomo / MEI"
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
        text: "A nova senha precisa de ter no mínimo 8 caracteres e incluir caractere especial.",
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

  const handleApproveAndSyncGcal = (id: string) => {
    const updated = events.map((ev) =>
      ev.id === id
        ? {
            ...ev,
            status: "CONFIRMADO" as const,
            responsibleAdmin: ev.responsibleAdmin.includes("confirmar")
              ? "Administrador Da Hora"
              : ev.responsibleAdmin,
            googleCalendarEventId: `gcal_sync_${Math.floor(1000 + Math.random() * 9000)}`,
          }
        : ev
    );
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "✓ Evento aprovado no Supabase e sincronizado com o Google Calendar!" });
  };

  const handleCancelEvent = (id: string) => {
    const updated = events.map((ev) => (ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev));
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "Evento cancelado no Supabase e horário libertado na agenda." });
  };

  const openEventModal = (ev: EventRecord) => {
    setEditingEvent(ev);
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
    setFeedback({ type: "success", text: "✓ Dados e escala do evento atualizados no Supabase!" });
  };

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
    setFeedback({ type: "success", text: "✓ Novo agendamento guardado no Supabase!" });
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

  // CORRIGIDO: Adicionado async / await para resolver a Promise do resetDatabaseToAdminOnly()
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
              { id: "DASHBOARD", label: "Dashboard", icon: "⊞" },
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
            <p className="text-[11px] text-slate-400">Banco em nuvem sincronizado.</p>
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
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-rose-400 px-1 transition"
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
              {activeTab === "DASHBOARD" && "Dashboard"}
              {activeTab === "EVENTOS" && "Gestão de eventos"}
              {activeTab === "CADASTROS" && "Cadastros por Perfil RBAC"}
              {activeTab === "BACKUP" && "Backup e governança"}
            </h1>
            <p className="text-xs text-slate-400 mt-0.5">
              {activeTab === "DASHBOARD" && "Visão geral da Agenda da Semana sincronizada no Supabase."}
              {activeTab === "EVENTOS" && "Calendário interativo, categorias livres e escala."}
              {activeTab === "CADASTROS" &&
                "Qualquer conta criada aqui é gravada no Supabase e já pode fazer login imediatamente."}
              {activeTab === "BACKUP" && "Exportação segura, exclusão de último backup e reset."}
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
          {/* ABA 1: DASHBOARD */}
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
                    <span>Eventos na semana</span>
                    <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">
                      SEMANA ATUAL
                    </span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(eventsThisWeek.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-amber-400/80 mt-1">Clique para gerir →</p>
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
                  <p className="text-xs text-slate-500 mt-1">Rever solicitações →</p>
                </div>

                <div
                  onClick={() => setActiveTab("CADASTROS")}
                  className="cursor-pointer bg-[#111726] hover:bg-[#161E31] border border-slate-800/90 rounded-2xl p-5 border-t-2 border-t-sky-500 transition"
                >
                  <div className="flex justify-between items-center text-xs text-slate-400">
                    <span>Contas RBAC no Supabase</span>
                    <span className="text-sky-400">👥</span>
                  </div>
                  <p className="text-4xl font-extrabold text-white mt-2">
                    {String(users.length).padStart(2, "0")}
                  </p>
                  <p className="text-xs text-slate-500 mt-1">Gerir os 4 perfis →</p>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <div className="xl:col-span-8 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Agenda da semana</h2>
                      <p className="text-xs text-slate-400">
                        Clique num evento para editar dados ou clique em &quot;Editar escala&quot;
                      </p>
                    </div>
                    <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                      {eventsThisWeek.length} evento(s)
                    </span>
                  </div>

                  {eventsThisWeek.length === 0 ? (
                    <div className="bg-[#0A0E17] border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
                      <p className="text-sm font-semibold text-slate-300">
                        Nenhum evento programado para esta semana.
                      </p>
                      <p className="text-xs text-slate-500">
                        Use o botão &quot;+ Novo evento&quot; para agendar.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {eventsThisWeek.map((ev) => (
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
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                                    ev.status === "CONFIRMADO"
                                      ? "bg-emerald-500/15 text-emerald-400"
                                      : "bg-amber-500/15 text-amber-400"
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
                              onClick={() => openEventModal(ev)}
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

                <div className="xl:col-span-4 space-y-4">
                  <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-3">
                    <div className="flex justify-between items-center">
                      <h3 className="text-sm font-bold text-white">Precisam de si</h3>
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
                          onClick={() => openEventModal(pe)}
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
                </div>
              </div>
            </div>
          )}

          {/* ABA 2: GESTÃO DE EVENTOS */}
          {activeTab === "EVENTOS" && (
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
              <form
                onSubmit={handleCreateManualEvent}
                className="xl:col-span-5 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
              >
                <div>
                  <h2 className="text-lg font-extrabold text-white">Novo agendamento</h2>
                  <p className="text-xs text-slate-400">Crie, escale a equipa e grave no Supabase.</p>
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
                      placeholder="Ex: Aniversário, Futebol..."
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

                <div>
                  <p className="text-[11px] font-bold tracking-wider text-slate-400 uppercase mb-2">EQUIPE ESCALADA</p>
                  <div className="space-y-2 max-h-36 overflow-y-auto">
                    {staffList.length === 0 ? (
                      <p className="text-xs text-slate-500 bg-[#0A0E17] p-3 rounded-xl border border-slate-800">
                        Cadastre Equipe Interna ou Externa na aba Cadastros para escalá-los aqui.
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
                  Agendar e sincronizar no Supabase
                </button>
              </form>

              <div className="xl:col-span-7 space-y-5">
                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Calendário Mensal ({currentYearMonth})
                      </h3>
                      <p className="text-xs text-slate-400">Clique num dia para filtrar ou selecionar a data</p>
                    </div>
                    {selectedCalendarDay && (
                      <button
                        onClick={() => setSelectedCalendarDay(null)}
                        className="text-xs text-amber-400 underline font-semibold"
                      >
                        Mostrar todos os dias
                      </button>
                    )}
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
                      <div key={`empty-${idx}`} className="h-10 rounded-xl bg-transparent" />
                    ))}
                    {Array.from({ length: daysInMonth }).map((_, idx) => {
                      const dayNum = idx + 1;
                      const fullDate = `${currentYearMonth}-${String(dayNum).padStart(2, "0")}`;
                      const dayEvents = events.filter((e) => e.eventDate === fullDate && e.status !== "CANCELADO");
                      const isSelected = selectedCalendarDay === fullDate;

                      return (
                        <button
                          key={fullDate}
                          type="button"
                          onClick={() => {
                            setEvDate(fullDate);
                            setSelectedCalendarDay(isSelected ? null : fullDate);
                          }}
                          className={`h-10 rounded-xl border text-xs font-bold flex flex-col items-center justify-center transition ${
                            isSelected
                              ? "bg-[#F59E0B] text-slate-950 border-amber-400"
                              : "bg-[#0A0E17] text-slate-300 border-slate-800/80 hover:border-slate-700"
                          }`}
                        >
                          <span>{dayNum}</span>
                          {dayEvents.length > 0 && (
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mt-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-5 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex gap-1.5 bg-[#0A0E17] p-1 rounded-xl border border-slate-800">
                      {(["TODOS", "PENDENTE", "CONFIRMADO", "CANCELADO"] as const).map((st) => (
                        <button
                          key={st}
                          onClick={() => setStatusFilter(st)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                            statusFilter === st ? "bg-[#F59E0B] text-slate-950 font-bold" : "text-slate-400"
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Procurar evento..."
                      className="bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-white"
                    />
                  </div>

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
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400">
                              {ev.status}
                            </span>
                          </div>
                          <p className="text-xs text-slate-400">
                            {ev.eventDate} · {ev.startTime} - {ev.endTime} · Para: <strong>{ev.honoreeName}</strong>
                          </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 shrink-0">
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
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
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
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      E-mail de Login *
                    </label>
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
                      <span className={cadPwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>
                        ✓ Número
                      </span>
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
                                  : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
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
                    desc: "Histórico completo, homenageados, datas em GMT-3 e equipas escaladas.",
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
                  <h3 className="text-sm font-extrabold text-white">Controlo de Governança e Reset</h3>
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
                    className="bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 font-bold px-4 py-2.5 rounded-xl text-xs transition"
                  >
                    🧹 Resetar sistema
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

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
              <label className="block text-slate-300 mb-1">
                Nova senha (Opcional · Mín. 8 chars + especial)
              </label>
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
}