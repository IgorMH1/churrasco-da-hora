"use client";

import React, { useState, useEffect, useRef } from "react";
import { applyAnatelPhoneMask, validateAnatelPhone } from "../../lib/services/anatel";
import {
  getNowGmt3,
  hasScheduleConflict,
  validatePasswordRbac,
  getPasswordDaysRemaining,
} from "../../lib/services/rbacAndTime";
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
  getCurrentUserSession,
  setCurrentUserSession,
  DEFAULT_ADMIN_USER,
  getCorporateIdentityInfo,
  markIsoForFirstLogin,
  markIsoPasswordChanged,
  isFirstLoginPasswordChangeRequired,
  getRoleParameterRulesFromStorage,
  saveRoleParameterRulesToStorage,
  saveBackupSnapshotToStorage,
  getLastBackupSnapshotFromStorage,
  restoreLastBackupSnapshot,
  getEmergencyMaintenanceState,
  activateEmergencyMaintenanceLock,
  deactivateEmergencyMaintenanceLock,
  checkAllApisHealth,
  StaffMember,
  ClientRecord,
  EventRecord,
  UserAccount,
  UserRole,
  UserStatus,
  ShiftPeriod,
  WorkModel,
  BackupLogRecord,
  RoleParameterRule,
  ApiHealthStatus,
  BackupSnapshotPayload,
  EmergencyMaintenanceState,
} from "../../lib/services/storage";

type AdminTab =
  | "DASHBOARD"
  | "EVENTOS"
  | "CADASTROS"
  | "PARAMETROS"
  | "MINHA_CONTA"
  | "BACKUP";

const MONTH_NAMES_PT = [
  { num: "01", name: "Janeiro" },
  { num: "02", name: "Fevereiro" },
  { num: "03", name: "Março" },
  { num: "04", name: "Abril" },
  { num: "05", name: "Maio" },
  { num: "06", name: "Junho" },
  { num: "07", name: "Julho" },
  { num: "08", name: "Agosto" },
  { num: "09", name: "Setembro" },
  { num: "10", name: "Outubro" },
  { num: "11", name: "Novembro" },
  { num: "12", name: "Dezembro" },
];

const AVAILABLE_YEARS = ["2025", "2026", "2027", "2028"];

function formatYearMonthLabel(ym: string): string {
  const [y, m] = ym.split("-");
  const found = MONTH_NAMES_PT.find((item) => item.num === m);
  return found ? `${found.name} de ${y}` : ym;
}

function formatIsoDatePtBr(iso?: string): string {
  if (!iso) return "18/11/2026";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("pt-BR");
}

function getStatusBadgeClasses(status: EventRecord["status"]): string {
  if (status === "CONFIRMADO") {
    return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/40";
  }
  if (status === "CANCELADO") {
    return "bg-red-500/15 text-red-400 border border-red-500/40";
  }
  return "bg-orange-500/15 text-orange-400 border border-orange-500/40";
}

function getUserStatusBadgeClasses(status: UserStatus): string {
  if (status === "ATIVO") {
    return "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30";
  }
  if (status === "BLOQUEADO") {
    return "bg-amber-500/20 text-amber-300 border border-amber-500/40";
  }
  return "bg-red-500/15 text-red-400 border border-red-500/30";
}

function isStaffMemberConfirmed(memberName: string, confirmedList?: string[]): boolean {
  if (!confirmedList || confirmedList.length === 0) return false;
  const cleanMember = memberName.trim().toLowerCase();
  return confirmedList.some((c) => c.trim().toLowerCase() === cleanMember);
}

export default function AdminPortalPage() {
  // CARD #49: Guarda estrita de autenticação antes de renderizar qualquer conteúdo do /admin
  const [isAuthVerified, setIsAuthVerified] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<AdminTab>("DASHBOARD");
  const [todayGmt3, setTodayGmt3] = useState<string>("2026-11-18");
  const [selectedYearMonth, setSelectedYearMonth] = useState<string>("2026-11");
  const [currentUser, setCurrentUser] = useState<UserAccount>(DEFAULT_ADMIN_USER);
  const [myPasswordDaysRemaining, setMyPasswordDaysRemaining] = useState<number>(90);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Referência para detectar o duplo clique nos dias do calendário
  const lastCalendarClickRef = useRef<{ date: string; time: number }>({
    date: "",
    time: 0,
  });

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLogRecord[]>([]);

  // CARD #37: Estado para abrir a lista de eventos da KPI clicada sem sair do Dashboard
  const [dashboardKpiModalFilter, setDashboardKpiModalFilter] = useState<
    "TODOS" | "CONFIRMADO" | "PENDENTE" | "CANCELADO" | null
  >(null);

  // CARD #41: Estados da Aba de Parâmetros de Regra (Diária Diurna/Vespertina/Noturna, Híbrido, Período)
  const [roleRules, setRoleRules] = useState<RoleParameterRule[]>([]);
  const [ruleFunctionName, setRuleFunctionName] = useState("");
  const [ruleTargetRole, setRuleTargetRole] = useState<"EQUIPE_INTERNA" | "EQUIPE_EXTERNA">("EQUIPE_EXTERNA");
  const [ruleWorkModel, setRuleWorkModel] = useState<WorkModel>("PRESENCIAL");
  const [ruleDefaultPeriod, setRuleDefaultPeriod] = useState<ShiftPeriod>("DIURNO");
  const [ruleRateDiurna, setRuleRateDiurna] = useState("250");
  const [ruleRateVespertina, setRuleRateVespertina] = useState("280");
  const [ruleRateNoturna, setRuleRateNoturna] = useState("330");
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);

  // CARD #43: Estados do Monitor de Funcionamento das APIs
  const [apiHealthList, setApiHealthList] = useState<ApiHealthStatus[]>([]);
  const [showApiStatusModal, setShowApiStatusModal] = useState<boolean>(false);
  const [isCheckingApis, setIsCheckingApis] = useState<boolean>(false);

  // CARD #44: Estado do último snapshot de backup disponível para Restore
  const [lastBackupSnapshot, setLastBackupSnapshot] = useState<BackupSnapshotPayload | null>(null);

  // CARD #45: Estado do Botão de Emergência / Manutenção
  const [emergencyState, setEmergencyState] = useState<EmergencyMaintenanceState>({
    active: false,
    lockedUserIds: [],
  });

  // Modal de "Novo agendamento rápido" (Apenas ADM)
  const [showNewEventModal, setShowNewEventModal] = useState<boolean>(false);

  // Estados de Gestão de Eventos
  const [statusFilter, setStatusFilter] = useState<"TODOS" | "PENDENTE" | "CONFIRMADO" | "CANCELADO">("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCalendarDay, setSelectedCalendarDay] = useState<string | null>(null);
  const [evTitle, setEvTitle] = useState("");
  const [evCategoryText, setEvCategoryText] = useState("");
  const [evGuestCount, setEvGuestCount] = useState("40");
  const [evClient, setEvClient] = useState("");
  const [evClientEmail, setEvClientEmail] = useState("");
  const [evAdmin, setEvAdmin] = useState("Administrador Da Hora");
  const [evDate, setEvDate] = useState("");
  const [evStart, setEvStart] = useState("16:00");
  const [evEnd, setEvEnd] = useState("21:00");
  const [evStaffSelected, setEvStaffSelected] = useState<string[]>([]);

  // Modal de Edição de Escala / Dados do Evento (Apenas ADM)
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);
  const [modTitle, setModTitle] = useState("");
  const [modCategory, setModCategory] = useState("");
  const [modGuestCount, setModGuestCount] = useState("");
  const [modClient, setModClient] = useState("");
  const [modClientEmail, setModClientEmail] = useState("");
  const [modAdmin, setModAdmin] = useState("");
  const [modDate, setModDate] = useState("");
  const [modStart, setModStart] = useState("");
  const [modEnd, setModEnd] = useState("");
  const [modStatus, setModStatus] = useState<EventRecord["status"]>("CONFIRMADO");
  const [modTeam, setModTeam] = useState<string[]>([]);
  const [modConfirmedStaff, setModConfirmedStaff] = useState<string[]>([]);
  const [modNotes, setModNotes] = useState("");

  // Estados de Cadastros para os 4 Perfis RBAC (Criação/Edição apenas para ADM)
  const [cadRole, setCadRole] = useState<UserRole>("EQUIPE_EXTERNA");
  const [cadName, setCadName] = useState("");
  const [cadEmail, setCadEmail] = useState("");
  const [cadPhone, setCadPhone] = useState("");
  const [cadSpecialty, setCadSpecialty] = useState("");
  const [cadCompany, setCadCompany] = useState("");
  const [cadRateDiurna, setCadRateDiurna] = useState("250");
  const [cadRateVespertina, setCadRateVespertina] = useState("280");
  const [cadRateNoturna, setCadRateNoturna] = useState("330");
  const [cadWorkModel, setCadWorkModel] = useState<WorkModel>("PRESENCIAL");
  const [cadShiftPeriod, setCadShiftPeriod] = useState<ShiftPeriod>("INTEGRAL");
  const [cadPassword, setCadPassword] = useState("");
  const [cadStatus, setCadStatus] = useState<UserStatus>("ATIVO");
  const [cadForceFirstLoginReset, setCadForceFirstLoginReset] = useState<boolean>(true);

  const [roleFilterTab, setRoleFilterTab] = useState<"TODOS" | UserRole | "BLOQUEADOS">("TODOS");
  const [personSearch, setPersonSearch] = useState("");

  // Modal de Edição de Conta de Terceiros (Apenas ADM)
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [editUserName, setEditUserName] = useState("");
  const [editUserEmail, setEditUserEmail] = useState("");
  const [editUserPhone, setEditUserPhone] = useState("");
  const [editUserRole, setEditUserRole] = useState<UserRole>("CLIENTE");
  const [editUserSpecialty, setEditUserSpecialty] = useState("");
  const [editUserRateDiurna, setEditUserRateDiurna] = useState("0");
  const [editUserRateVespertina, setEditUserRateVespertina] = useState("0");
  const [editUserRateNoturna, setEditUserRateNoturna] = useState("0");
  const [editUserWorkModel, setEditUserWorkModel] = useState<WorkModel>("PRESENCIAL");
  const [editUserShiftPeriod, setEditUserShiftPeriod] = useState<ShiftPeriod>("INTEGRAL");
  const [editUserStatus, setEditUserStatus] = useState<UserStatus>("ATIVO");
  const [editUserNewPassword, setEditUserNewPassword] = useState("");

  // Estados da Aba "MINHA_CONTA"
  const [myAccountName, setMyAccountName] = useState("");
  const [myAccountEmail, setMyAccountEmail] = useState("");
  const [myAccountPhone, setMyAccountPhone] = useState("");
  const [myAccountSpecialty, setMyAccountSpecialty] = useState("");
  const [myCurrentPassword, setMyCurrentPassword] = useState("");
  const [myNewPassword, setMyNewPassword] = useState("");
  const [myConfirmPassword, setMyConfirmPassword] = useState("");

  const refreshApisHealth = async () => {
    setIsCheckingApis(true);
    const list = await checkAllApisHealth();
    setApiHealthList(list);
    setIsCheckingApis(false);
  };

  useEffect(() => {
    const now = getNowGmt3();
    setTodayGmt3(now.dateStr);
    setSelectedYearMonth(now.dateStr.slice(0, 7));
    setEvDate(now.dateStr);

    const session = getCurrentUserSession();

    // CARD #49: Bloqueia acesso direto via URL sem login em outro navegador
    if (!session) {
      window.location.replace("/");
      return;
    }

    // CARD #42: Se o usuário ainda não trocou a senha no primeiro login, redireciona para a tela inicial
    if (isFirstLoginPasswordChangeRequired(session)) {
      window.location.replace("/");
      return;
    }

    // CARD #49: Restrição estrita por perfil RBAC
    if (session.role === "CLIENTE") {
      window.location.replace("/cliente");
      return;
    }
    if (session.role === "EQUIPE_EXTERNA") {
      window.location.replace("/equipe");
      return;
    }

    const currentEmergency = getEmergencyMaintenanceState();
    setEmergencyState(currentEmergency);

    // CARD #45 e #46: Se não for ADM e estiver bloqueado ou em manutenção, encerra a sessão
    if (
      session.role !== "ADM" &&
      (session.status === "INATIVO" ||
        session.status === "BLOQUEADO" ||
        currentEmergency.active)
    ) {
      setCurrentUserSession(null);
      window.location.replace("/");
      return;
    }

    setCurrentUser(session);
    setEvAdmin(session.name);
    setMyAccountName(session.name);
    setMyAccountEmail(session.email);
    setMyAccountPhone(session.phoneAnatel);
    setMyAccountSpecialty(session.specialty || "");
    setMyPasswordDaysRemaining(getPasswordDaysRemaining(session.passwordChangedAtIso));
    setRoleRules(getRoleParameterRulesFromStorage());
    setLastBackupSnapshot(getLastBackupSnapshotFromStorage());
    setIsAuthVerified(true);

    refreshApisHealth();

    fetchAllFromSupabase().then((data) => {
      setUsers(data.users);
      setEvents(data.events);
      setClients(data.clients);
      setStaffList(data.staff);
      setBackupLogs(data.backupLogs);

      const fresh = data.users.find(
        (u) => u.id === session.id || u.email.toLowerCase() === session.email.toLowerCase()
      );
      if (fresh) {
        if (
          fresh.role !== "ADM" &&
          (fresh.status === "INATIVO" || fresh.status === "BLOQUEADO")
        ) {
          setCurrentUserSession(null);
          window.location.replace("/");
          return;
        }
        setCurrentUser(fresh);
        setCurrentUserSession(fresh);
        setMyAccountName(fresh.name);
        setMyAccountEmail(fresh.email);
        setMyAccountPhone(fresh.phoneAnatel);
        setMyAccountSpecialty(fresh.specialty || "");
        setMyPasswordDaysRemaining(getPasswordDaysRemaining(fresh.passwordChangedAtIso));
      }
    });
  }, []);

  const isAdmin = currentUser.role === "ADM";
  const isReadOnlyStaff = currentUser.role !== "ADM";
  const canAccessBackup = isAdmin;
  const corpIdentity = getCorporateIdentityInfo(currentUser);

  useEffect(() => {
    if (!canAccessBackup && activeTab === "BACKUP") {
      setActiveTab("DASHBOARD");
    }
  }, [canAccessBackup, activeTab]);

  const [selYear, selMonth] = selectedYearMonth.split("-");

  const handleStepMonth = (delta: number) => {
    const y = Number(selYear || 2026);
    const m = Number(selMonth || 11);
    const d = new Date(y, m - 1 + delta, 1);
    const nextYm = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    setSelectedYearMonth(nextYm);
    setSelectedCalendarDay(null);
    setEvDate(`${nextYm}-01`);
  };

  const handleSelectMonthNum = (newMonthNum: string) => {
    const nextYm = `${selYear}-${newMonthNum}`;
    setSelectedYearMonth(nextYm);
    setSelectedCalendarDay(null);
    setEvDate(`${nextYm}-01`);
  };

  const handleSelectYear = (newYear: string) => {
    const nextYm = `${newYear}-${selMonth}`;
    setSelectedYearMonth(nextYm);
    setSelectedCalendarDay(null);
    setEvDate(`${nextYm}-01`);
  };

  const handleResetToCurrentMonth = () => {
    const curYm = todayGmt3.slice(0, 7);
    setSelectedYearMonth(curYm);
    setSelectedCalendarDay(null);
    setEvDate(todayGmt3);
  };

  const eventsInSelectedMonth = events.filter((e) => e.eventDate.slice(0, 7) === selectedYearMonth);

  const countMonthAll = eventsInSelectedMonth.length;
  const countMonthPending = eventsInSelectedMonth.filter((e) => e.status === "PENDENTE").length;
  const countMonthConfirmed = eventsInSelectedMonth.filter((e) => e.status === "CONFIRMADO").length;
  const countMonthCancelled = eventsInSelectedMonth.filter((e) => e.status === "CANCELADO").length;

  const countAll = events.length;
  const countPending = events.filter((e) => e.status === "PENDENTE").length;
  const countConfirmed = events.filter((e) => e.status === "CONFIRMADO").length;
  const countCancelled = events.filter((e) => e.status === "CANCELADO").length;
  const pendingEvents = events.filter((e) => e.status === "PENDENTE");
  const blockedUsersCount = users.filter((u) => u.status === "BLOQUEADO").length;

  const phoneValidation = validateAnatelPhone(cadPhone);
  const cadPwCheck = validatePasswordRbac(cadPassword);
  const editPwCheck = validatePasswordRbac(editUserNewPassword);
  const myPhoneCheck = validateAnatelPhone(myAccountPhone);
  const myPwCheck = validatePasswordRbac(myNewPassword);

  // CARD #38: Retirada a confirmação de equipe pela sessão de ADM.
  // Apenas o próprio colaborador logado (isReadOnlyStaff) pode confirmar sua própria presença.
  const handleConfirmOwnStaffPresence = (eventId: string) => {
    if (!isReadOnlyStaff) return;
    const memberName = currentUser.name;

    const updated = events.map((ev) => {
      if (ev.id !== eventId) return ev;
      const currentConfirmed = ev.confirmedStaff || [];
      const alreadyConfirmed = isStaffMemberConfirmed(memberName, currentConfirmed);

      const nextConfirmed = alreadyConfirmed
        ? currentConfirmed.filter((c) => c.trim().toLowerCase() !== memberName.trim().toLowerCase())
        : [...currentConfirmed, memberName];

      const nextTeam = ev.supportTeam.some(
        (m) => m.trim().toLowerCase() === memberName.trim().toLowerCase()
      )
        ? ev.supportTeam
        : [
            ...ev.supportTeam.filter(
              (m) => m !== "A definir pelo ADM" && m !== "Sem equipe escalada"
            ),
            memberName,
          ];

      return {
        ...ev,
        supportTeam: nextTeam,
        confirmedStaff: nextConfirmed,
      };
    });

    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({
      type: "success",
      text: `✓ Sua presença ("${memberName}") foi atualizada na escala e salva no Supabase!`,
    });
  };

  // CARD #39: Disparo automático de e-mail de confirmação de evento para o Cliente (via Netlify SMTP)
  const triggerConfirmationEmailToClient = async (ev: EventRecord) => {
    const matchedClientUser = users.find(
      (u) =>
        (ev.clientEmail && u.email.toLowerCase() === ev.clientEmail.toLowerCase()) ||
        u.name.trim().toLowerCase() === ev.clientName.trim().toLowerCase()
    );
    const targetEmail = (ev.clientEmail || matchedClientUser?.email || "").trim();

    if (!targetEmail || !targetEmail.includes("@")) {
      return { sent: false, reason: "Cliente sem e-mail vinculado." };
    }

    try {
      const response = await fetch("/api/confirm-event-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientEmail: targetEmail,
          clientName: ev.clientName,
          eventTitle: ev.title,
          eventType: ev.eventType,
          guestCount: ev.honoreeName,
          eventDate: ev.eventDate,
          startTime: ev.startTime,
          endTime: ev.endTime,
          responsibleAdmin: ev.responsibleAdmin,
          googleCalendarUrl: generateGoogleCalendarUrl(ev),
        }),
      });
      if (!response.ok) {
        return { sent: false, reason: "Aviso SMTP pendente." };
      }
      return { sent: true, email: targetEmail };
    } catch {
      return { sent: false, reason: "Falha de rede SMTP." };
    }
  };

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
        dailyRate: u.dailyRate ?? u.rateDiurna ?? 0,
        rateDiurna: u.rateDiurna ?? u.dailyRate ?? 0,
        rateVespertina: u.rateVespertina ?? u.dailyRate ?? 0,
        rateNoturna: u.rateNoturna ?? u.dailyRate ?? 0,
        shiftPeriod: u.shiftPeriod || "INTEGRAL",
        workModel: u.workModel || "PRESENCIAL",
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
        status: u.status,
        passwordChangedAtIso: u.passwordChangedAtIso,
      }));
    setClients(syncedClients);
    saveClientsToStorage(syncedClients);
  };

  // CARD #41: Aplicar regra pré-definida ao selecionar uma função no cadastro
  const handleSelectRuleTemplateForCadastro = (ruleId: string) => {
    const found = roleRules.find((r) => r.id === ruleId);
    if (!found) return;
    setCadRole(found.targetRole);
    setCadSpecialty(found.functionName);
    setCadWorkModel(found.workModel);
    setCadShiftPeriod(found.defaultPeriod);
    setCadRateDiurna(String(found.rateDiurna));
    setCadRateVespertina(String(found.rateVespertina));
    setCadRateNoturna(String(found.rateNoturna));
  };

  // CARD #41: Salvar ou atualizar um Parâmetro de Regra (Diária Diurna/Vespertina/Noturna, Híbrido, Período)
  const handleSaveRoleRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    if (!ruleFunctionName.trim()) {
      setFeedback({ type: "error", text: "Informe o nome da função/especialidade para a regra." });
      return;
    }

    const newRule: RoleParameterRule = {
      id: editingRuleId || `RULE-${Math.floor(100 + Math.random() * 900)}`,
      functionName: ruleFunctionName.trim(),
      targetRole: ruleTargetRole,
      workModel: ruleWorkModel,
      defaultPeriod: ruleDefaultPeriod,
      rateDiurna: Number(ruleRateDiurna) || 0,
      rateVespertina: Number(ruleRateVespertina) || 0,
      rateNoturna: Number(ruleRateNoturna) || 0,
    };

    const updatedRules = editingRuleId
      ? roleRules.map((r) => (r.id === editingRuleId ? newRule : r))
      : [newRule, ...roleRules];

    setRoleRules(updatedRules);
    saveRoleParameterRulesToStorage(updatedRules);
    setRuleFunctionName("");
    setEditingRuleId(null);
    setFeedback({
      type: "success",
      text: `✓ Regra "${newRule.functionName}" (Diurna R$ ${newRule.rateDiurna} / Vesp. R$ ${newRule.rateVespertina} / Noturna R$ ${newRule.rateNoturna}) salva com sucesso!`,
    });
  };

  const handleEditRoleRule = (rule: RoleParameterRule) => {
    if (!isAdmin) return;
    setEditingRuleId(rule.id);
    setRuleFunctionName(rule.functionName);
    setRuleTargetRole(rule.targetRole);
    setRuleWorkModel(rule.workModel);
    setRuleDefaultPeriod(rule.defaultPeriod);
    setRuleRateDiurna(String(rule.rateDiurna));
    setRuleRateVespertina(String(rule.rateVespertina));
    setRuleRateNoturna(String(rule.rateNoturna));
  };

  const handleDeleteRoleRule = (ruleId: string) => {
    if (!isAdmin) return;
    const updated = roleRules.filter((r) => r.id !== ruleId);
    setRoleRules(updated);
    saveRoleParameterRulesToStorage(updated);
    setFeedback({ type: "success", text: "🗑️ Regra removida da tabela de parâmetros." });
  };

  const handleSaveMyOwnProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myPhoneCheck.valid) {
      setFeedback({ type: "error", text: `Erro ANATEL: ${myPhoneCheck.error}` });
      return;
    }

    const normalizedEmail = myAccountEmail.trim().toLowerCase();
    const emailConflict = users.some(
      (u) => u.id !== currentUser.id && u.email.toLowerCase() === normalizedEmail
    );
    if (emailConflict) {
      setFeedback({ type: "error", text: "Este e-mail já está em uso por outra conta no sistema." });
      return;
    }

    const formattedPhone = myPhoneCheck.formatted || myAccountPhone;
    const updatedMe: UserAccount = {
      ...currentUser,
      name: myAccountName.trim(),
      email: normalizedEmail,
      phoneAnatel: formattedPhone,
      specialty: myAccountSpecialty.trim() || currentUser.specialty,
    };

    const existsInUsers = users.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInUsers
      ? users.map((u) => (u.id === currentUser.id ? updatedMe : u))
      : [updatedMe, ...users];

    syncAllTablesFromUsers(updatedUsers);
    setCurrentUser(updatedMe);
    setCurrentUserSession(updatedMe);
    setFeedback({
      type: "success",
      text: `✓ Seus dados pessoais foram atualizados e salvos no Supabase (${myPhoneCheck.regionUf})!`,
    });
  };

  const handleUpdateMyOwnPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (myCurrentPassword !== currentUser.password) {
      setFeedback({ type: "error", text: "A senha atual digitada está incorreta." });
      return;
    }
    if (!myPwCheck.isValid) {
      setFeedback({
        type: "error",
        text: "A nova senha precisa cumprir o padrão RBAC (mínimo de 8 caracteres, caractere especial, maiúscula, minúscula e número).",
      });
      return;
    }
    if (myNewPassword !== myConfirmPassword) {
      setFeedback({ type: "error", text: "A confirmação da nova senha não confere." });
      return;
    }

    const nowIso = markIsoPasswordChanged();
    const updatedMe: UserAccount = {
      ...currentUser,
      password: myNewPassword,
      passwordChangedAtIso: nowIso,
      mustChangePassword: false,
    };

    const existsInUsers = users.some((u) => u.id === currentUser.id);
    const updatedUsers = existsInUsers
      ? users.map((u) => (u.id === currentUser.id ? updatedMe : u))
      : [updatedMe, ...users];

    syncAllTablesFromUsers(updatedUsers);
    setCurrentUser(updatedMe);
    setCurrentUserSession(updatedMe);
    setMyPasswordDaysRemaining(90);
    setMyCurrentPassword("");
    setMyNewPassword("");
    setMyConfirmPassword("");
    setFeedback({
      type: "success",
      text: "✓ Sua senha RBAC foi atualizada no Supabase! Novo ciclo de validade: 90 dias.",
    });
  };

  const handleSaveCadastro = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
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

    const numPart = String(Math.floor(1000 + Math.random() * 9000));
    const newId = `${prefix}-${numPart}`;
    const corporateId = `CDH-${prefix}-${numPart}`;

    // CARD #42: Marca a conta para obrigar a troca de senha no primeiro login
    const nowIso = cadForceFirstLoginReset
      ? markIsoForFirstLogin()
      : markIsoPasswordChanged();
    const formattedPhone = phoneValidation.formatted || cadPhone;

    const diurnaVal = cadRole === "EQUIPE_EXTERNA" ? Number(cadRateDiurna) || 0 : 0;
    const vespertinaVal = cadRole === "EQUIPE_EXTERNA" ? Number(cadRateVespertina) || 0 : 0;
    const noturnaVal = cadRole === "EQUIPE_EXTERNA" ? Number(cadRateNoturna) || 0 : 0;

    const newUser: UserAccount = {
      id: newId,
      corporateId,
      name: cadName.trim(),
      email: normalizedEmail,
      phoneAnatel: formattedPhone,
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
      dailyRate: diurnaVal,
      rateDiurna: diurnaVal,
      rateVespertina: vespertinaVal,
      rateNoturna: noturnaVal,
      workModel: cadWorkModel,
      shiftPeriod: cadShiftPeriod,
      status: cadStatus,
      passwordChangedAtIso: nowIso,
      mustChangePassword: cadForceFirstLoginReset,
    };

    const updatedUsers = [newUser, ...users];
    syncAllTablesFromUsers(updatedUsers);

    setCadName("");
    setCadEmail("");
    setCadPhone("");
    setCadSpecialty("");
    setCadCompany("");
    setCadPassword("");

    setFeedback({
      type: "success",
      text: `✓ Identidade Corporativa [${corporateId}] criada no Supabase! ${newUser.name} (${newUser.role}) trocará a senha inicial no 1º login.`,
    });
  };

  // CARD #46: Botão rápido para desbloquear usuário que foi bloqueado após 5 tentativas de erro
  const handleQuickUnlockUser = (user: UserAccount) => {
    if (!isAdmin) return;
    const updatedUsers = users.map((u) =>
      u.id === user.id ? { ...u, status: "ATIVO" as const } : u
    );
    syncAllTablesFromUsers(updatedUsers);
    setFeedback({
      type: "success",
      text: `🔓 Conta de ${user.name} (${user.email}) desbloqueada e restaurada para status ATIVO no Supabase!`,
    });
  };

  const openEditUserModal = (u: UserAccount) => {
    if (!isAdmin) return;
    setEditingUser(u);
    setEditUserName(u.name);
    setEditUserEmail(u.email);
    setEditUserPhone(u.phoneAnatel);
    setEditUserRole(u.role);
    setEditUserSpecialty(u.specialty || "");
    setEditUserRateDiurna(String(u.rateDiurna ?? u.dailyRate ?? 0));
    setEditUserRateVespertina(String(u.rateVespertina ?? u.dailyRate ?? 0));
    setEditUserRateNoturna(String(u.rateNoturna ?? u.dailyRate ?? 0));
    setEditUserWorkModel(u.workModel || "PRESENCIAL");
    setEditUserShiftPeriod(u.shiftPeriod || "INTEGRAL");
    setEditUserStatus(u.status);
    setEditUserNewPassword("");
  };

  const handleSaveEditedUser = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingUser) return;

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
      ? markIsoForFirstLogin()
      : editingUser.passwordChangedAtIso;

    const diurnaVal = editUserRole === "EQUIPE_EXTERNA" ? Number(editUserRateDiurna) || 0 : 0;
    const vespertinaVal = editUserRole === "EQUIPE_EXTERNA" ? Number(editUserRateVespertina) || 0 : 0;
    const noturnaVal = editUserRole === "EQUIPE_EXTERNA" ? Number(editUserRateNoturna) || 0 : 0;

    const updatedUsers = users.map((u) =>
      u.id === editingUser.id
        ? {
            ...u,
            name: editUserName.trim(),
            email: editUserEmail.trim().toLowerCase(),
            phoneAnatel: updatedPhone,
            role: editUserRole,
            specialty: editUserSpecialty,
            dailyRate: diurnaVal,
            rateDiurna: diurnaVal,
            rateVespertina: vespertinaVal,
            rateNoturna: noturnaVal,
            workModel: editUserWorkModel,
            shiftPeriod: editUserShiftPeriod,
            status: editUserStatus,
            password: editUserNewPassword || u.password,
            passwordChangedAtIso: updatedPasswordIso,
            mustChangePassword: editUserNewPassword ? true : u.mustChangePassword,
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

  // CARD #39: Aprovar evento e enviar automaticamente o e-mail de confirmação para o Cliente
  const handleApproveAndSyncGcal = async (id: string) => {
    if (!isAdmin) return;
    const targetEv = events.find((ev) => ev.id === id);
    if (!targetEv) return;

    const confirmedEv: EventRecord = {
      ...targetEv,
      status: "CONFIRMADO",
      responsibleAdmin: targetEv.responsibleAdmin.includes("confirmar")
        ? currentUser.name
        : targetEv.responsibleAdmin,
      googleCalendarEventId: `gcal_auto_${Math.floor(1000 + Math.random() * 9000)}`,
    };

    const updated = events.map((ev) => (ev.id === id ? confirmedEv : ev));
    setEvents(updated);
    saveEventsToStorage(updated);

    setSelectedYearMonth(targetEv.eventDate.slice(0, 7));
    setEvDate(targetEv.eventDate);

    const emailResult = await triggerConfirmationEmailToClient(confirmedEv);

    setFeedback({
      type: "success",
      text: emailResult.sent
        ? `✓ Evento "${confirmedEv.title}" confirmado e e-mail de confirmação enviado automaticamente para ${emailResult.email}!`
        : `✓ Evento "${confirmedEv.title}" confirmado na agenda! Use o botão "📅 GCal" para abrir no Google Calendar.`,
    });
  };

  const handleCancelEvent = (id: string) => {
    if (!isAdmin) return;
    const updated = events.map((ev) => (ev.id === id ? { ...ev, status: "CANCELADO" as const } : ev));
    setEvents(updated);
    saveEventsToStorage(updated);
    setFeedback({ type: "success", text: "Evento marcado como Cancelado (Vermelho) e horário liberado." });
  };

  const openEventModal = (ev: EventRecord) => {
    if (!isAdmin) return;
    setEditingEvent(ev);
    setModTitle(ev.title);
    setModCategory(ev.eventType);
    setModGuestCount(ev.honoreeName);
    setModClient(ev.clientName);
    setModClientEmail(ev.clientEmail || "");
    setModAdmin(ev.responsibleAdmin);
    setModDate(ev.eventDate);
    setModStart(ev.startTime);
    setModEnd(ev.endTime);
    setModStatus(ev.status);
    setModTeam(ev.supportTeam || []);
    setModConfirmedStaff(ev.confirmedStaff || []);
    setModNotes(ev.notes || "");
  };

  const handleSaveEventModal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin || !editingEvent) return;
    if (modEnd <= modStart) {
      setFeedback({ type: "error", text: "O horário final deve ser maior que o inicial." });
      return;
    }

    const formattedGuests = modGuestCount.includes("pessoa")
      ? modGuestCount
      : `${modGuestCount} pessoas`;

    const cleanedConfirmed = modConfirmedStaff.filter((c) =>
      modTeam.some((m) => m.trim().toLowerCase() === c.trim().toLowerCase())
    );

    const wasNotConfirmed = editingEvent.status !== "CONFIRMADO";

    const updatedEv: EventRecord = {
      ...editingEvent,
      title: modTitle,
      eventType: modCategory || "Evento",
      honoreeName: formattedGuests,
      clientName: modClient,
      clientEmail: modClientEmail.trim() || editingEvent.clientEmail,
      responsibleAdmin: modAdmin,
      eventDate: modDate,
      startTime: modStart,
      endTime: modEnd,
      status: modStatus,
      supportTeam: modTeam.length > 0 ? modTeam : ["Sem equipe escalada"],
      confirmedStaff: cleanedConfirmed,
      notes: modNotes,
    };

    const updatedList = events.map((ev) => (ev.id === editingEvent.id ? updatedEv : ev));
    setEvents(updatedList);
    saveEventsToStorage(updatedList);
    setSelectedYearMonth(modDate.slice(0, 7));
    setEditingEvent(null);

    if (wasNotConfirmed && modStatus === "CONFIRMADO") {
      const emailRes = await triggerConfirmationEmailToClient(updatedEv);
      setFeedback({
        type: "success",
        text: emailRes.sent
          ? `✓ Evento confirmado no Supabase e e-mail enviado para o cliente (${emailRes.email})!`
          : "✓ Dados e escala do evento atualizados na agenda e no Supabase!",
      });
      return;
    }

    setFeedback({
      type: "success",
      text: "✓ Dados e escala do evento atualizados na agenda e no Supabase!",
    });
  };

  const handleCreateManualEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
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
      clientEmail: evClientEmail.trim() || undefined,
      responsibleAdmin: evAdmin || currentUser.name,
      eventDate: evDate,
      startTime: evStart,
      endTime: evEnd,
      status: "CONFIRMADO",
      googleCalendarEventId: `gcal_auto_${Math.floor(1000 + Math.random() * 9000)}`,
      supportTeam: evStaffSelected.length > 0 ? evStaffSelected : ["Equipe padrão"],
      confirmedStaff: [],
    };

    const updated = [newEv, ...events];
    setEvents(updated);
    saveEventsToStorage(updated);
    setEvTitle("");
    setEvCategoryText("");
    setEvGuestCount("40");
    setEvClient("");
    setEvClientEmail("");
    setShowNewEventModal(false);
    setSelectedYearMonth(evDate.slice(0, 7));
    setSelectedCalendarDay(evDate);

    const emailRes = await triggerConfirmationEmailToClient(newEv);

    setFeedback({
      type: "success",
      text: emailRes.sent
        ? `✓ Evento "${newEv.title}" agendado e e-mail de confirmação enviado para ${emailRes.email}!`
        : `✓ Evento "${newEv.title}" adicionado na agenda! Clique em "📅 GCal" no card para salvar no Google Calendar.`,
    });
  };

  // CARD #44: Salva snapshot ao baixar backup e permite Restore do Último Backup
  const handleDownloadBackup = async (
    scope: "Usuários" | "Eventos" | "Completo",
    format: "JSON" | "SQL"
  ) => {
    if (!canAccessBackup) return;
    const now = getNowGmt3();
    let content = "";
    const filename = `backup_${scope.toLowerCase()}_${now.dateStr}.${format.toLowerCase()}`;
    const bkpId = `BKP-${Math.floor(1000 + Math.random() * 9000)}`;
    const exportedAtGmt3 = `${now.dateStr.split("-").reverse().join("/")} ${now.timeStr}`;

    // Guarda o snapshot completo para possibilitar o Restore com 1 clique (Card #44)
    const snapshot: BackupSnapshotPayload = {
      id: bkpId,
      savedAtGmt3: exportedAtGmt3,
      savedBy: currentUser.name,
      scope,
      users,
      events,
      clients,
      staff: staffList,
    };
    saveBackupSnapshotToStorage(snapshot);
    setLastBackupSnapshot(snapshot);

    if (format === "JSON") {
      const payload = {
        metadata: {
          system: "Churrasco dos Da Hora",
          version: "2.0.0",
          scope,
          exportedAtGmt3: now.formattedPtBr,
          exportedByAdmin: currentUser.name,
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
      id: bkpId,
      scope,
      format,
      exportedAtGmt3,
      exportedBy: currentUser.name,
    };

    setBackupLogs([newLog, ...backupLogs]);
    await insertBackupLogInSupabase(newLog);
    setFeedback({
      type: "success",
      text: `✓ Exportação "${filename}" concluída e ponto de restauração #${bkpId} salvo!`,
    });
  };

  // CARD #44: Executa o Restore do Último Backup para o Supabase
  const handleRestoreLastBackup = async () => {
    if (!canAccessBackup) return;
    const result = await restoreLastBackupSnapshot();
    if (!result.ok || !result.restored) {
      setFeedback({ type: "error", text: result.message });
      return;
    }
    setUsers(result.restored.users);
    setEvents(result.restored.events);
    setClients(result.restored.clients);
    setStaffList(result.restored.staff);
    setFeedback({ type: "success", text: result.message });
  };

  const handleDeleteLastBackup = async () => {
    if (!canAccessBackup) return;
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
    if (!canAccessBackup) return;
    const clean = await resetDatabaseToAdminOnly();
    setUsers(clean.users);
    setEvents(clean.events);
    setClients(clean.clients);
    setStaffList(clean.staff);
    setBackupLogs([]);
    setEvStaffSelected([]);
    setEmergencyState({ active: false, lockedUserIds: [] });
    setFeedback({
      type: "success",
      text: "🧹 Sistema e tabelas do Supabase resetados com sucesso! Mantido apenas o login ADM padrão.",
    });
  };

  // CARD #45: Ativar Botão de Emergência / Manutenção (Bloqueia todos os usuários ativos menos o ADM)
  const handleActivateEmergencyLock = async () => {
    if (!isAdmin) return;
    const { updatedUsers, state } = await activateEmergencyMaintenanceLock(
      users,
      currentUser.name
    );
    syncAllTablesFromUsers(updatedUsers);
    setEmergencyState(state);
    setFeedback({
      type: "success",
      text: `🚨 Modo de Emergência/Manutenção ATIVADO! ${state.lockedUserIds.length} usuário(s) ativo(s) foram bloqueados temporariamente (exceto ADM).`,
    });
  };

  // CARD #45: Botão de Desbloqueio (Retorna o status de ATIVO aos usuários bloqueados pelo botão de emergência)
  const handleDeactivateEmergencyLock = async () => {
    if (!isAdmin) return;
    const { updatedUsers, state, restoredCount } =
      await deactivateEmergencyMaintenanceLock(users);
    syncAllTablesFromUsers(updatedUsers);
    setEmergencyState(state);
    setFeedback({
      type: "success",
      text: `🔓 Manutenção encerrada! ${restoredCount} usuário(s) bloqueados pelo botão de emergência retornaram ao status ATIVO.`,
    });
  };

  const filteredUsers = users.filter((u) => {
    const matchRole =
      roleFilterTab === "TODOS"
        ? true
        : roleFilterTab === "BLOQUEADOS"
        ? u.status === "BLOQUEADO"
        : u.role === roleFilterTab;
    const matchQuery =
      !personSearch.trim() ||
      u.name.toLowerCase().includes(personSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(personSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(personSearch.toLowerCase()) ||
      (u.corporateId || "").toLowerCase().includes(personSearch.toLowerCase()) ||
      u.phoneAnatel.includes(personSearch) ||
      (u.specialty || "").toLowerCase().includes(personSearch.toLowerCase());
    return matchRole && matchQuery;
  });

  const filteredEvents = events.filter((ev) => {
    const matchesMonth = ev.eventDate.slice(0, 7) === selectedYearMonth;
    const matchesStatus = statusFilter === "TODOS" || ev.status === statusFilter;
    const matchesDay = !selectedCalendarDay || ev.eventDate === selectedCalendarDay;
    const matchesQuery =
      !searchQuery.trim() ||
      ev.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.honoreeName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventType.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ev.eventDate.includes(searchQuery);
    return matchesMonth && matchesStatus && matchesDay && matchesQuery;
  });

  // Lista filtrada para o modal interno de KPI do Dashboard (Card #37)
  const kpiModalEventsList = eventsInSelectedMonth.filter((ev) => {
    if (!dashboardKpiModalFilter || dashboardKpiModalFilter === "TODOS") return true;
    return ev.status === dashboardKpiModalFilter;
  });

  const [calYear, calMonth] = selectedYearMonth.split("-").map(Number);
  const daysInMonth = new Date(calYear || 2026, calMonth || 11, 0).getDate();
  const firstWeekday = new Date(calYear || 2026, (calMonth || 11) - 1, 1).getDay();

  const visibleMenuTabs = [
    { id: "DASHBOARD", label: "Dashboard (Mensal)", icon: "⊞" },
    { id: "EVENTOS", label: isReadOnlyStaff ? "Agenda de eventos (Visão)" : "Gestão de eventos", icon: "📅" },
    { id: "CADASTROS", label: isReadOnlyStaff ? "Pessoas (Visão)" : "Cadastros (RBAC)", icon: "👥" },
    { id: "PARAMETROS", label: isReadOnlyStaff ? "Regras & Diárias (Visão)" : "Parâmetros de regra", icon: "⚙️" },
    { id: "MINHA_CONTA", label: "Minha conta", icon: "👤" },
    ...(canAccessBackup ? [{ id: "BACKUP", label: "Backup e governança", icon: "🛡️" }] : []),
  ];

  const renderMonthNavigationBar = () => (
    <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => handleStepMonth(-1)}
          className="bg-[#0A0E17] hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition"
        >
          ◀ Mês anterior
        </button>
        <button
          type="button"
          onClick={() => handleStepMonth(1)}
          className="bg-[#0A0E17] hover:bg-slate-800 text-slate-200 border border-slate-800 px-3 py-2 rounded-xl text-xs font-bold transition"
        >
          Próximo mês ▶
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mr-1">
          📅 Período:
        </span>
        <select
          value={selMonth}
          onChange={(e) => handleSelectMonthNum(e.target.value)}
          className="bg-[#0A0E17] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
        >
          {MONTH_NAMES_PT.map((m) => (
            <option key={m.num} value={m.num}>
              {m.num} - {m.name}
            </option>
          ))}
        </select>

        <select
          value={selYear}
          onChange={(e) => handleSelectYear(e.target.value)}
          className="bg-[#0A0E17] border border-slate-700 rounded-xl px-3 py-2 text-xs font-bold text-white"
        >
          {AVAILABLE_YEARS.map((yr) => (
            <option key={yr} value={yr}>
              {yr}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={handleResetToCurrentMonth}
          className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 px-3 py-2 rounded-xl text-xs font-bold transition"
        >
          Hoje (Mês atual)
        </button>
      </div>
    </div>
  );

  // CARD #38: Na sessão de ADM, exibe apenas o status de confirmação da equipe (sem botão para o ADM confirmar pela equipe).
  // Na sessão de Equipe Interna (isReadOnlyStaff), mantém o botão para o colaborador confirmar a sua própria presença.
  const renderStaffConfirmationBadges = (ev: EventRecord) => {
    const validTeam = (ev.supportTeam || []).filter(
      (m) => m !== "A definir pelo ADM" && m !== "Sem equipe escalada"
    );
    const confirmedCount = validTeam.filter((m) => isStaffMemberConfirmed(m, ev.confirmedStaff)).length;
    const isCurrentUserConfirmed = isStaffMemberConfirmed(currentUser.name, ev.confirmedStaff);

    return (
      <div className="space-y-2 pt-1.5" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[11px] font-bold text-slate-400">
            👥 Confirmação da Equipe (Confirmado pelo próprio colaborador):{" "}
            <strong
              className={
                confirmedCount === validTeam.length && validTeam.length > 0
                  ? "text-emerald-400"
                  : "text-amber-400"
              }
            >
              {confirmedCount} de {validTeam.length} confirmado(s)
            </strong>
          </span>

          {isReadOnlyStaff && ev.status !== "CANCELADO" && (
            <button
              type="button"
              onClick={() => handleConfirmOwnStaffPresence(ev.id)}
              className={`text-[11px] font-bold px-3 py-1 rounded-lg border transition ${
                isCurrentUserConfirmed
                  ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                  : "bg-amber-500 text-slate-950 border-amber-400"
              }`}
            >
              {isCurrentUserConfirmed ? "✓ Minha presença confirmada" : "✓ Confirmar minha presença"}
            </button>
          )}
        </div>

        {validTeam.length === 0 ? (
          <p className="text-[11px] text-slate-500 italic">Nenhum profissional escalado neste evento.</p>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {validTeam.map((memberName) => {
              const confirmed = isStaffMemberConfirmed(memberName, ev.confirmedStaff);
              const staffObj = staffList.find(
                (s) => s.name.trim().toLowerCase() === memberName.trim().toLowerCase()
              );
              const typeTag =
                staffObj?.staffType === "INTERNA"
                  ? "Interna"
                  : staffObj?.staffType === "EXTERNA_TERCEIRO"
                  ? "Externa"
                  : "Equipe";

              return (
                <span
                  key={memberName}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border ${
                    confirmed
                      ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                      : "bg-orange-500/15 text-orange-300 border-orange-500/40"
                  }`}
                >
                  <span>{confirmed ? "✓" : "⏳"}</span>
                  <span>{memberName}</span>
                  <span className="opacity-75 text-[10px]">
                    ({typeTag} · {confirmed ? "Confirmado" : "Aguardando"})
                  </span>
                </span>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  // CARD #49: Bloqueia completamente a tela enquanto verifica a sessão RBAC
  if (!isAuthVerified) {
    return (
      <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex items-center justify-center p-6 font-sans">
        <div className="bg-[#111726] border border-slate-800 rounded-3xl p-8 max-w-sm w-full text-center space-y-3 shadow-2xl">
          <div className="w-10 h-10 mx-auto rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400 font-bold">
            🔒
          </div>
          <p className="text-sm font-extrabold text-white">Verificando credenciais RBAC...</p>
          <p className="text-xs text-slate-400">
            Acesso restrito. Validando sessão autenticada para o Painel Administrativo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col lg:flex-row font-sans">
      {/* CONTAINER 1: SIDEBAR CORPORATIVA */}
      <aside className="w-full lg:w-64 bg-[#0D121E] border-b lg:border-b-0 lg:border-r border-slate-800/80 flex flex-col justify-between p-5 shrink-0">
        <div className="space-y-6">
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

          {/* CARD #47: Crachá de Identidade Corporativa na Sidebar */}
          <div className="bg-[#111726] border border-slate-800/90 rounded-2xl p-3.5 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono font-extrabold text-amber-400">
                {corpIdentity.corporateCode}
              </span>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400">
                ATIVO
              </span>
            </div>
            <p className="text-[11px] font-bold text-white">{corpIdentity.clearanceLevel}</p>
            <p className="text-[10px] text-slate-400 truncate">{corpIdentity.unitDepartment}</p>
          </div>

          <div className="space-y-1.5">
            <p className="px-3 text-[10px] font-bold tracking-[0.16em] text-slate-500 uppercase mb-2">
              {isReadOnlyStaff ? "VISÃO DO ESPAÇO (EQUIPE)" : "PAINEL DA FAMÍLIA (ADM)"}
            </p>
            {visibleMenuTabs.map((item) => (
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
          {/* CARD #43: Widget Interativo de Status de Funcionamento das APIs */}
          <div
            onClick={() => {
              refreshApisHealth();
              setShowApiStatusModal(true);
            }}
            className="cursor-pointer bg-[#111726] hover:bg-[#162036] border border-slate-800/90 hover:border-emerald-500/40 rounded-2xl p-3.5 space-y-2 transition group"
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Status das APIs ({apiHealthList.length || 4}/4)
              </span>
              <span className="text-[10px] text-amber-400 font-bold group-hover:underline">
                Detalhes →
              </span>
            </div>
            <div className="space-y-1 text-[10px]">
              {(apiHealthList.length > 0
                ? apiHealthList
                : [
                    { id: "1", name: "Supabase Cloud", latencyMs: 18, status: "ONLINE" },
                    { id: "2", name: "Gmail SMTP Netlify", latencyMs: 24, status: "ONLINE" },
                    { id: "3", name: "Google Calendar GMT-3", latencyMs: 8, status: "ONLINE" },
                    { id: "4", name: "Motor ANATEL (67 DDDs)", latencyMs: 2, status: "ONLINE" },
                  ]
              ).map((api) => (
                <div key={api.id} className="flex items-center justify-between text-slate-300">
                  <span className="truncate max-w-[130px]">● {api.name.split(" (")[0]}</span>
                  <span className="font-mono text-emerald-400">{api.latencyMs}ms</span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-t border-slate-800/80 pt-4 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-bold text-xs">
                {currentUser.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="leading-tight truncate">
                <p className="text-xs font-bold text-white truncate">{currentUser.name}</p>
                <p className="text-[11px] text-amber-400">
                  {isReadOnlyStaff ? "👁️ Equipe (Modo Visão)" : "🛡️ Perfil ADM"}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                setCurrentUserSession(null);
                window.location.replace("/");
              }}
              className="flex items-center gap-2 text-xs text-slate-400 hover:text-red-400 px-1 transition"
            >
              <span>↪</span>
              <span>Sair da conta</span>
            </button>
          </div>
        </div>
      </aside>

      {/* CONTAINER 2: ÁREA PRINCIPAL DO PAINEL */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-slate-800/80 bg-[#0D121E]/60 px-6 py-5">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-bold tracking-[0.18em] text-amber-500 uppercase">
                {corpIdentity.corporateCode} ·{" "}
                {isReadOnlyStaff
                  ? "MODO SOMENTE VISUALIZAÇÃO · EQUIPE DO ESPAÇO"
                  : "GOVERNANÇA CORPORATIVA · SUPABASE CLOUD"}
              </p>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white mt-0.5">
                {activeTab === "DASHBOARD" && `Dashboard — ${formatYearMonthLabel(selectedYearMonth)}`}
                {activeTab === "EVENTOS" &&
                  `${isReadOnlyStaff ? "Agenda de eventos" : "Gestão de eventos"} — ${formatYearMonthLabel(
                    selectedYearMonth
                  )}`}
                {activeTab === "CADASTROS" &&
                  (isReadOnlyStaff ? "Consulta de Pessoas Cadastradas" : "Cadastros e Identidade Corporativa")}
                {activeTab === "PARAMETROS" && "Parâmetros de Regra e Diárias por Turno"}
                {activeTab === "MINHA_CONTA" && "Minha conta"}
                {activeTab === "BACKUP" && canAccessBackup && "Backup, Restore e Emergência"}
              </h1>
              <p className="text-xs text-slate-400 mt-0.5">
                {activeTab === "DASHBOARD" &&
                  "Clique em qualquer KPI abaixo para abrir a lista filtrada diretamente nesta tela sem sair do Dashboard."}
                {activeTab === "EVENTOS" &&
                  (isReadOnlyStaff
                    ? "Visualização completa do calendário anual e confirmação da sua própria presença."
                    : "Dê 2 cliques (duplo clique) em qualquer dia do calendário para abrir um novo agendamento.")}
                {activeTab === "CADASTROS" &&
                  "Contas criadas exigem troca de senha no 1º login e possuem matrícula corporativa CDH."}
                {activeTab === "PARAMETROS" &&
                  "Configure valores de diárias (Diurna, Vespertina e Noturna), tipo de função, regime híbrido e período."}
                {activeTab === "MINHA_CONTA" &&
                  "Atualize os seus dados pessoais, telefone ANATEL e senha RBAC diretamente no Supabase."}
                {activeTab === "BACKUP" &&
                  "Exportação segura, Restore do último backup e Botão de Emergência/Manutenção."}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              {/* CARD #43: Botão rápido no topo para abrir o Monitor de APIs */}
              <button
                type="button"
                onClick={() => {
                  refreshApisHealth();
                  setShowApiStatusModal(true);
                }}
                className="text-xs bg-[#111726] hover:bg-slate-800 text-emerald-400 border border-emerald-500/30 font-bold px-3.5 py-2.5 rounded-xl transition flex items-center gap-2"
              >
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>Status APIs</span>
              </button>

              {isAdmin && (activeTab === "DASHBOARD" || activeTab === "EVENTOS") && (
                <button
                  type="button"
                  onClick={() => setShowNewEventModal(true)}
                  className="text-xs bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold px-5 py-2.5 rounded-xl transition shadow-lg shadow-amber-500/20"
                >
                  + Novo agendamento rápido
                </button>
              )}

              {activeTab === "MINHA_CONTA" && (
                <div className="px-3.5 py-2 rounded-full bg-emerald-950/50 border border-emerald-500/30 text-emerald-400 text-xs font-semibold">
                  ✓ Senha válida por mais {myPasswordDaysRemaining} dias
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="p-6 flex-1">
          <div className="max-w-7xl mx-auto space-y-6">
            {/* CARD #45: Banner Global quando o Modo de Emergência/Manutenção está ativo */}
            {emergencyState.active && (
              <div className="p-4 rounded-2xl bg-red-950/70 border border-red-500/50 text-red-200 text-xs flex flex-wrap items-center justify-between gap-3 shadow-lg">
                <div>
                  <span className="font-extrabold uppercase tracking-wider text-red-400 block">
                    🚨 MODO DE EMERGÊNCIA / MANUTENÇÃO ATIVO
                  </span>
                  <span>
                    Ativado em {emergencyState.activatedAtGmt3} por {emergencyState.activatedBy}.{" "}
                    <strong>{emergencyState.lockedUserIds.length} conta(s)</strong> estão bloqueadas temporariamente (apenas ADM acessa).
                  </span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={handleDeactivateEmergencyLock}
                    className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2 rounded-xl text-xs transition shrink-0"
                  >
                    🔓 Desbloquear usuários da manutenção
                  </button>
                )}
              </div>
            )}

            {isReadOnlyStaff && activeTab !== "MINHA_CONTA" && (
              <div className="px-4 py-3 rounded-2xl bg-sky-950/40 border border-sky-500/30 text-sky-200 text-xs flex flex-wrap items-center justify-between gap-2">
                <span>
                  👁️ <strong>Modo Visualização:</strong> Você pode consultar toda a agenda, parâmetros e cadastros do
                  espaço e confirmar a sua própria presença na escala.
                </span>
                <button
                  type="button"
                  onClick={() => setActiveTab("MINHA_CONTA")}
                  className="text-amber-400 hover:underline font-bold shrink-0"
                >
                  Ir para Minha conta →
                </button>
              </div>
            )}

            {feedback && (
              <div
                className={`p-3.5 rounded-xl text-xs flex justify-between items-center border ${
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

            {/* ABA 1: DASHBOARD MENSAL */}
            {activeTab === "DASHBOARD" && (
              <div className="space-y-6">
                {renderMonthNavigationBar()}

                {/* CARD #37: Clicar na KPI abre a lista filtrada no próprio Dashboard sem mudar de página */}
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                  <div
                    onClick={() =>
                      setDashboardKpiModalFilter(
                        dashboardKpiModalFilter === "TODOS" ? null : "TODOS"
                      )
                    }
                    className={`cursor-pointer bg-[#111726] hover:bg-[#161E31] border rounded-2xl p-5 border-t-2 border-t-amber-500 transition ${
                      dashboardKpiModalFilter === "TODOS"
                        ? "border-amber-400 ring-2 ring-amber-500/20"
                        : "border-slate-800/90"
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Eventos em {formatYearMonthLabel(selectedYearMonth)}</span>
                      <span className="text-[10px] font-bold bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded">
                        {selectedYearMonth}
                      </span>
                    </div>
                    <p className="text-4xl font-extrabold text-white mt-2">
                      {String(countMonthAll).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-amber-400/90 mt-1 font-semibold">
                      📋 Abrir lista aqui ({countAll} no ano) ▾
                    </p>
                  </div>

                  <div
                    onClick={() =>
                      setDashboardKpiModalFilter(
                        dashboardKpiModalFilter === "CONFIRMADO" ? null : "CONFIRMADO"
                      )
                    }
                    className={`cursor-pointer bg-[#111726] hover:bg-[#161E31] border rounded-2xl p-5 border-t-2 border-t-emerald-500 transition ${
                      dashboardKpiModalFilter === "CONFIRMADO"
                        ? "border-emerald-400 ring-2 ring-emerald-500/20"
                        : "border-slate-800/90"
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Confirmados no mês (Verde)</span>
                      <span className="text-emerald-400 font-bold">✓</span>
                    </div>
                    <p className="text-4xl font-extrabold text-emerald-400 mt-2">
                      {String(countMonthConfirmed).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-emerald-400/90 mt-1 font-semibold">
                      📋 Abrir lista de confirmados ({countConfirmed}) ▾
                    </p>
                  </div>

                  <div
                    onClick={() =>
                      setDashboardKpiModalFilter(
                        dashboardKpiModalFilter === "PENDENTE" ? null : "PENDENTE"
                      )
                    }
                    className={`cursor-pointer bg-[#111726] hover:bg-[#161E31] border rounded-2xl p-5 border-t-2 border-t-orange-500 transition ${
                      dashboardKpiModalFilter === "PENDENTE"
                        ? "border-orange-400 ring-2 ring-orange-500/20"
                        : "border-slate-800/90"
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Pendentes no mês (Laranja)</span>
                      <span className="text-orange-400 font-bold">●</span>
                    </div>
                    <p className="text-4xl font-extrabold text-orange-400 mt-2">
                      {String(countMonthPending).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-orange-400/90 mt-1 font-semibold">
                      📋 Abrir lista de pendentes ({countPending}) ▾
                    </p>
                  </div>

                  <div
                    onClick={() =>
                      setDashboardKpiModalFilter(
                        dashboardKpiModalFilter === "CANCELADO" ? null : "CANCELADO"
                      )
                    }
                    className={`cursor-pointer bg-[#111726] hover:bg-[#161E31] border rounded-2xl p-5 border-t-2 border-t-red-500 transition ${
                      dashboardKpiModalFilter === "CANCELADO"
                        ? "border-red-400 ring-2 ring-red-500/20"
                        : "border-slate-800/90"
                    }`}
                  >
                    <div className="flex justify-between items-center text-xs text-slate-400">
                      <span>Cancelados no mês (Vermelho)</span>
                      <span className="text-red-400 font-bold">✕</span>
                    </div>
                    <p className="text-4xl font-extrabold text-red-400 mt-2">
                      {String(countMonthCancelled).padStart(2, "0")}
                    </p>
                    <p className="text-xs text-red-400/90 mt-1 font-semibold">
                      📋 Abrir lista de cancelados ({countCancelled}) ▾
                    </p>
                  </div>
                </div>

                {/* CARD #37: Container Expansível da KPI selecionada (Abre a lista sem sair do Dashboard) */}
                {dashboardKpiModalFilter && (
                  <section className="bg-[#111726] border-2 border-amber-500/40 rounded-3xl p-5 space-y-4 shadow-2xl">
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          LISTA RÁPIDA DE KPI · SEM SAIR DO DASHBOARD
                        </span>
                        <h3 className="text-base font-extrabold text-white">
                          Filtro selecionado: {dashboardKpiModalFilter} —{" "}
                          {formatYearMonthLabel(selectedYearMonth)} ({kpiModalEventsList.length} evento(s))
                        </h3>
                      </div>
                      <button
                        type="button"
                        onClick={() => setDashboardKpiModalFilter(null)}
                        className="bg-[#0A0E17] hover:bg-slate-800 text-slate-300 border border-slate-700 px-3.5 py-1.5 rounded-xl text-xs font-bold"
                      >
                        ✕ Fechar lista
                      </button>
                    </div>

                    {kpiModalEventsList.length === 0 ? (
                      <p className="text-xs text-slate-400 py-4 text-center">
                        Nenhum evento com status &ldquo;{dashboardKpiModalFilter}&rdquo; neste mês.
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {kpiModalEventsList.map((ev) => (
                          <div
                            key={`kpi-${ev.id}`}
                            className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                          >
                            <div className="space-y-1">
                              <div className="flex items-center justify-between gap-2">
                                <h4 className="font-bold text-sm text-white">{ev.title}</h4>
                                <span
                                  className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${getStatusBadgeClasses(
                                    ev.status
                                  )}`}
                                >
                                  {ev.status}
                                </span>
                              </div>
                              <p className="text-xs text-slate-400">
                                📅 {ev.eventDate} ({ev.startTime} às {ev.endTime}) · {ev.honoreeName} · Cliente:{" "}
                                <strong className="text-slate-200">{ev.clientName}</strong>
                              </p>
                            </div>
                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                              {isAdmin && ev.status === "PENDENTE" && (
                                <button
                                  type="button"
                                  onClick={() => handleApproveAndSyncGcal(ev.id)}
                                  className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3 py-1.5 rounded-xl"
                                >
                                  ✓ Aprovar e enviar e-mail
                                </button>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => openEventModal(ev)}
                                  className="bg-[#192236] text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl"
                                >
                                  ✏️ Editar
                                </button>
                              )}
                              <a
                                href={generateGoogleCalendarUrl(ev)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl"
                              >
                                📅 GCal
                              </a>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                  <div className="xl:col-span-8 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-lg font-extrabold text-white">
                          Agenda de {formatYearMonthLabel(selectedYearMonth)}
                        </h2>
                        <p className="text-xs text-slate-400">
                          {isReadOnlyStaff
                            ? "Visualização dos eventos do mês e confirmação da sua presença"
                            : "Acompanhe as confirmações registradas diretamente pelos membros da equipe"}
                        </p>
                      </div>
                      <span className="text-xs bg-[#0A0E17] border border-slate-800 px-3 py-1 rounded-full text-amber-400 font-semibold">
                        {eventsInSelectedMonth.length} evento(s) em {selectedYearMonth}
                      </span>
                    </div>

                    {eventsInSelectedMonth.length === 0 ? (
                      <div className="bg-[#0A0E17] border border-slate-800/80 rounded-2xl p-8 text-center space-y-2">
                        <p className="text-sm font-semibold text-slate-300">
                          Nenhum evento programado para {formatYearMonthLabel(selectedYearMonth)}.
                        </p>
                        <p className="text-xs text-slate-500">
                          Use o seletor de meses acima para consultar outros períodos do ano.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {eventsInSelectedMonth.map((ev) => (
                          <div
                            key={ev.id}
                            onClick={() => isAdmin && openEventModal(ev)}
                            className={`${
                              isAdmin ? "cursor-pointer hover:bg-[#131B2E] hover:border-amber-500/40" : ""
                            } bg-[#0A0E17] border border-slate-800/90 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4 transition`}
                          >
                            <div className="flex gap-4 flex-1">
                              <div className="text-xs font-mono text-slate-300 border-r border-slate-800 pr-4 flex flex-col justify-center shrink-0">
                                <span className="text-[10px] text-amber-400 font-bold">{ev.eventDate}</span>
                                <span className="font-bold text-white">{ev.startTime}</span>
                                <span className="text-slate-500">{ev.endTime}</span>
                              </div>
                              <div className="space-y-1.5 flex-1">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="font-bold text-sm text-white">{ev.title}</h3>
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
                                  <strong className="text-slate-200">{ev.honoreeName}</strong> · Cliente:{" "}
                                  {ev.clientName} · ADM:{" "}
                                  <strong className="text-slate-300">{ev.responsibleAdmin}</strong>
                                </p>

                                {renderStaffConfirmationBadges(ev)}
                              </div>
                            </div>

                            <div
                              className="flex sm:flex-col justify-end gap-2 shrink-0"
                              onClick={(e) => e.stopPropagation()}
                            >
                              {isAdmin && (
                                <>
                                  {ev.status === "PENDENTE" && (
                                    <button
                                      onClick={() => handleApproveAndSyncGcal(ev.id)}
                                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs px-3.5 py-2 rounded-xl"
                                    >
                                      ✓ Aprovar & E-mail
                                    </button>
                                  )}
                                  <button
                                    onClick={() => openEventModal(ev)}
                                    className="bg-[#111726] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl"
                                  >
                                    Editar escala
                                  </button>
                                </>
                              )}
                              <a
                                href={generateGoogleCalendarUrl(ev)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-1.5 rounded-xl text-center"
                              >
                                📅 GCal
                              </a>
                              {isAdmin && ev.status !== "CANCELADO" && (
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
                        <h3 className="text-sm font-bold text-white">Solicitações Pendentes (Geral)</h3>
                        <span className="text-[11px] text-orange-400 font-semibold">
                          {pendingEvents.length} pendente(s)
                        </span>
                      </div>
                      {pendingEvents.length === 0 ? (
                        <p className="text-xs text-slate-500">Nenhuma solicitação pendente no momento.</p>
                      ) : (
                        pendingEvents.map((pe) => (
                          <div
                            key={pe.id}
                            onClick={() => isAdmin && openEventModal(pe)}
                            className={`${
                              isAdmin ? "cursor-pointer hover:bg-[#141C2E]" : ""
                            } bg-[#0A0E17] border border-orange-500/30 rounded-xl p-3 flex items-center justify-between transition`}
                          >
                            <div>
                              <p className="text-xs font-bold text-white">{pe.title}</p>
                              <p className="text-[11px] text-slate-400">
                                {pe.eventDate} · {pe.honoreeName}
                              </p>
                            </div>
                            {isAdmin ? (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleApproveAndSyncGcal(pe.id);
                                }}
                                className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 px-2.5 py-1 rounded-lg font-bold"
                              >
                                ✓ Aprovar
                              </button>
                            ) : (
                              <span className="text-[10px] font-bold text-orange-400">Aguardando ADM</span>
                            )}
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
              <div className="w-full space-y-6">
                {renderMonthNavigationBar()}

                <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-extrabold text-white">
                        Calendário Mensal — {formatYearMonthLabel(selectedYearMonth)}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {isAdmin
                          ? "Clique 1x em um dia para filtrar · Dê 2 cliques (duplo clique) em uma data para abrir um novo agendamento"
                          : "Clique em qualquer dia para filtrar os eventos ou use o navegador acima para mudar de mês/ano"}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 text-xs">
                      <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> Confirmado ({countMonthConfirmed})
                      </span>
                      <span className="flex items-center gap-1.5 text-orange-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-orange-400" /> Pendente ({countMonthPending})
                      </span>
                      <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                        <span className="w-2.5 h-2.5 rounded-full bg-red-500" /> Cancelado ({countMonthCancelled})
                      </span>
                      {selectedCalendarDay && (
                        <button
                          onClick={() => setSelectedCalendarDay(null)}
                          className="text-amber-400 underline font-bold"
                        >
                          Mostrar todos os dias de {formatYearMonthLabel(selectedYearMonth)}
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
                      const fullDate = `${selectedYearMonth}-${String(dayNum).padStart(2, "0")}`;
                      const dayEvents = events.filter((e) => e.eventDate === fullDate);
                      const hasConfirmed = dayEvents.some((e) => e.status === "CONFIRMADO");
                      const hasPending = dayEvents.some((e) => e.status === "PENDENTE");
                      const hasCancelled = dayEvents.some((e) => e.status === "CANCELADO");
                      const isSelected = selectedCalendarDay === fullDate;

                      return (
                        <button
                          key={fullDate}
                          type="button"
                          title={
                            isAdmin
                              ? "Clique 1x para filtrar · Dê 2 cliques na data para abrir um novo agendamento"
                              : "Clique para filtrar os eventos deste dia"
                          }
                          onClick={() => {
                            const nowMs = Date.now();
                            const isDoubleClick =
                              lastCalendarClickRef.current.date === fullDate &&
                              nowMs - lastCalendarClickRef.current.time < 500;

                            lastCalendarClickRef.current = { date: fullDate, time: nowMs };

                            if (isDoubleClick && isAdmin) {
                              setEvDate(fullDate);
                              setSelectedCalendarDay(fullDate);
                              setShowNewEventModal(true);
                              return;
                            }

                            setEvDate(fullDate);
                            setSelectedCalendarDay(isSelected ? null : fullDate);
                          }}
                          className={`h-14 rounded-2xl border text-xs font-bold flex flex-col items-center justify-center transition select-none ${
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

                <div className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex flex-wrap gap-2 bg-[#0A0E17] p-1.5 rounded-2xl border border-slate-800">
                      <button
                        onClick={() => setStatusFilter("TODOS")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          statusFilter === "TODOS"
                            ? "bg-[#F59E0B] text-slate-950"
                            : "text-slate-400 hover:text-white"
                        }`}
                      >
                        Todos no mês ({countMonthAll})
                      </button>
                      <button
                        onClick={() => setStatusFilter("PENDENTE")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          statusFilter === "PENDENTE"
                            ? "bg-orange-500 text-slate-950"
                            : "text-orange-400 hover:bg-orange-500/10"
                        }`}
                      >
                        ● Pendentes ({countMonthPending})
                      </button>
                      <button
                        onClick={() => setStatusFilter("CONFIRMADO")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          statusFilter === "CONFIRMADO"
                            ? "bg-emerald-500 text-slate-950"
                            : "text-emerald-400 hover:bg-emerald-500/10"
                        }`}
                      >
                        ✓ Confirmados ({countMonthConfirmed})
                      </button>
                      <button
                        onClick={() => setStatusFilter("CANCELADO")}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          statusFilter === "CANCELADO"
                            ? "bg-red-500 text-white"
                            : "text-red-400 hover:bg-red-500/10"
                        }`}
                      >
                        ✕ Cancelados ({countMonthCancelled})
                      </button>
                    </div>

                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="🔍 Procurar evento neste mês..."
                      className="bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white w-full sm:w-80"
                    />
                  </div>

                  {filteredEvents.length === 0 ? (
                    <p className="text-xs text-slate-500 py-8 text-center">
                      Nenhum evento encontrado em {formatYearMonthLabel(selectedYearMonth)} para o filtro selecionado.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {filteredEvents.map((ev) => (
                        <div
                          key={ev.id}
                          className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="font-bold text-sm text-white">{ev.title}</h3>
                              <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-slate-800 text-amber-300">
                                {ev.eventType}
                              </span>
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
                              <strong>{ev.honoreeName}</strong> · Cliente: {ev.clientName} · ADM: {ev.responsibleAdmin}
                            </p>

                            {renderStaffConfirmationBadges(ev)}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            {isAdmin && ev.status === "PENDENTE" && (
                              <button
                                onClick={() => handleApproveAndSyncGcal(ev.id)}
                                className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs px-3.5 py-2 rounded-xl transition shadow-md"
                              >
                                ✓ Aprovar & Enviar E-mail
                              </button>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => openEventModal(ev)}
                                className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                              >
                                ✏️ Editar dados & Escala
                              </button>
                            )}
                            <a
                              href={generateGoogleCalendarUrl(ev)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border border-emerald-500/30 text-xs font-semibold px-3 py-2 rounded-xl"
                            >
                              📅 GCal
                            </a>
                            {isAdmin && ev.status !== "CANCELADO" && (
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

            {/* ABA 3: CADASTROS E IDENTIDADE CORPORATIVA */}
            {activeTab === "CADASTROS" && (
              <div className="space-y-6">
                {isAdmin && (
                  <form
                    onSubmit={handleSaveCadastro}
                    className="w-full bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-800 pb-4">
                      <div>
                        <h2 className="text-lg font-extrabold text-white">
                          Adicionar uma pessoa (Identidade Corporativa CDH)
                        </h2>
                        <p className="text-xs text-slate-400">
                          Gera matrícula corporativa automática e exige troca de senha no 1º login.
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

                    {/* CARD #41: Seletor rápido de Regra de Função para preencher diárias automaticamente */}
                    {(cadRole === "EQUIPE_EXTERNA" || cadRole === "EQUIPE_INTERNA") && (
                      <div className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-3.5 flex flex-wrap items-center justify-between gap-3 text-xs">
                        <span className="text-amber-400 font-bold">
                          ⚙️ Preencher com Parâmetro de Regra cadastrado:
                        </span>
                        <select
                          onChange={(e) => handleSelectRuleTemplateForCadastro(e.target.value)}
                          defaultValue=""
                          className="bg-[#111726] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-semibold"
                        >
                          <option value="">Selecionar modelo de função / diária...</option>
                          {roleRules.map((r) => (
                            <option key={r.id} value={r.id}>
                              {r.functionName} ({r.workModel} · Diurna R$ {r.rateDiurna} / Vesp. R$ {r.rateVespertina} / Not. R$ {r.rateNoturna})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

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
                          onChange={(e) => setCadStatus(e.target.value as UserStatus)}
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        >
                          <option value="ATIVO">🟢 Ativo (Pode logar)</option>
                          <option value="BLOQUEADO">🔒 Bloqueado</option>
                          <option value="INATIVO">🔴 Inativo</option>
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
                        <>
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
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Regime de Trabalho</label>
                            <select
                              value={cadWorkModel}
                              onChange={(e) => setCadWorkModel(e.target.value as WorkModel)}
                              className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                            >
                              <option value="PRESENCIAL">Presencial</option>
                              <option value="HIBRIDO">Híbrido</option>
                              <option value="VOLANTE">Volante</option>
                            </select>
                          </div>
                        </>
                      )}

                      {cadRole === "EQUIPE_EXTERNA" && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">Especialidade / Função *</label>
                            <input
                              type="text"
                              required
                              value={cadSpecialty}
                              onChange={(e) => setCadSpecialty(e.target.value)}
                              placeholder="Ex: Churrasqueiro, Garçom"
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
                            <label className="block text-xs font-medium text-slate-300 mb-1">Regime & Período</label>
                            <div className="grid grid-cols-2 gap-1.5">
                              <select
                                value={cadWorkModel}
                                onChange={(e) => setCadWorkModel(e.target.value as WorkModel)}
                                className="bg-[#0A0E17] border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white"
                              >
                                <option value="PRESENCIAL">Presencial</option>
                                <option value="HIBRIDO">Híbrido</option>
                                <option value="VOLANTE">Volante</option>
                              </select>
                              <select
                                value={cadShiftPeriod}
                                onChange={(e) => setCadShiftPeriod(e.target.value as ShiftPeriod)}
                                className="bg-[#0A0E17] border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white"
                              >
                                <option value="DIURNO">Diurno</option>
                                <option value="VESPERTINO">Vespertino</option>
                                <option value="NOTURNO">Noturno</option>
                                <option value="INTEGRAL">Integral</option>
                              </select>
                            </div>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Diárias: Diurna / Vesp. / Noturna (R$)
                            </label>
                            <div className="grid grid-cols-3 gap-1.5">
                              <input
                                type="number"
                                value={cadRateDiurna}
                                onChange={(e) => setCadRateDiurna(e.target.value)}
                                placeholder="Diurna"
                                className="bg-[#0A0E17] border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white"
                              />
                              <input
                                type="number"
                                value={cadRateVespertina}
                                onChange={(e) => setCadRateVespertina(e.target.value)}
                                placeholder="Vesp."
                                className="bg-[#0A0E17] border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white"
                              />
                              <input
                                type="number"
                                value={cadRateNoturna}
                                onChange={(e) => setCadRateNoturna(e.target.value)}
                                placeholder="Noturna"
                                className="bg-[#0A0E17] border border-slate-800 rounded-xl px-2 py-2.5 text-xs text-white"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      <div className="sm:col-span-2">
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Senha Inicial RBAC (Mín. 8 caracteres + especial) *
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
                          <span
                            className={
                              cadPwCheck.hasUpper && cadPwCheck.hasLower ? "text-emerald-400" : "text-slate-500"
                            }
                          >
                            ✓ Maiúscula e minúscula
                          </span>
                          <span className={cadPwCheck.hasNumber ? "text-emerald-400" : "text-slate-500"}>✓ Número</span>
                        </div>
                      </div>

                      <div className="sm:col-span-2 flex items-center pt-4">
                        <label className="flex items-center gap-2.5 cursor-pointer text-xs text-slate-300">
                          <input
                            type="checkbox"
                            checked={cadForceFirstLoginReset}
                            onChange={(e) => setCadForceFirstLoginReset(e.target.checked)}
                            className="rounded border-slate-700"
                          />
                          <span>
                            🔐 <strong>Obrigar troca de senha no 1º login</strong> (Regra RBAC recomendada)
                          </span>
                        </label>
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
                )}

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
                        {
                          id: "BLOQUEADOS",
                          label: `🔒 Bloqueados (${blockedUsersCount})`,
                        },
                      ].map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setRoleFilterTab(f.id as "TODOS" | UserRole | "BLOQUEADOS")}
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
                      placeholder="🔍 Procurar por matrícula CDH, nome, e-mail..."
                      className="bg-[#0A0E17] border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-white w-full md:w-80"
                    />
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-800 text-[10px] font-bold tracking-wider text-slate-400 uppercase">
                          <th className="py-3 px-3">IDENTIDADE CORPORATIVA</th>
                          <th className="py-3 px-3">NOME / PERFIL RBAC</th>
                          <th className="py-3 px-3">E-MAIL DE LOGIN & TELEFONE</th>
                          <th className="py-3 px-3">FUNÇÃO / DIÁRIAS (D · V · N)</th>
                          <th className="py-3 px-3">STATUS</th>
                          <th className="py-3 px-3">SENHA / 1º LOGIN</th>
                          {isAdmin && <th className="py-3 px-3 text-right">AÇÕES</th>}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800/60">
                        {filteredUsers.map((u) => {
                          const corp = getCorporateIdentityInfo(u);
                          const requiresFirstReset = isFirstLoginPasswordChangeRequired(u);
                          return (
                            <tr key={u.id} className="hover:bg-[#0A0E17]/60 transition">
                              <td className="py-3.5 px-3">
                                <span className="font-mono font-extrabold text-amber-400 block">
                                  {corp.corporateCode}
                                </span>
                                <span className="text-[10px] text-slate-500">ID #{u.id}</span>
                              </td>
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
                                <p className="text-slate-200 font-semibold">{u.specialty || "—"}</p>
                                {u.role === "EQUIPE_EXTERNA" && (
                                  <span className="text-[10px] text-emerald-400 font-semibold block">
                                    ☀️ R$ {u.rateDiurna ?? u.dailyRate ?? 0} · 🌤️ R${" "}
                                    {u.rateVespertina ?? u.dailyRate ?? 0} · 🌙 R${" "}
                                    {u.rateNoturna ?? u.dailyRate ?? 0}
                                  </span>
                                )}
                                {(u.role === "EQUIPE_EXTERNA" || u.role === "EQUIPE_INTERNA") && (
                                  <span className="text-[10px] text-slate-400">
                                    {u.workModel || "PRESENCIAL"} · {u.shiftPeriod || "INTEGRAL"}
                                  </span>
                                )}
                              </td>
                              <td className="py-3.5 px-3">
                                <span
                                  className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${getUserStatusBadgeClasses(
                                    u.status
                                  )}`}
                                >
                                  {u.status === "ATIVO"
                                    ? "● Ativo"
                                    : u.status === "BLOQUEADO"
                                    ? "🔒 Bloqueado"
                                    : "○ Inativo"}
                                </span>
                              </td>
                              <td className="py-3.5 px-3 font-mono text-slate-300">
                                <span>{formatIsoDatePtBr(u.passwordChangedAtIso)}</span>
                                {requiresFirstReset && (
                                  <span className="block text-[10px] text-amber-400 font-sans font-bold">
                                    🔐 Troca no 1º Login
                                  </span>
                                )}
                              </td>
                              {isAdmin && (
                                <td className="py-3.5 px-3 text-right space-x-1.5">
                                  {u.status === "BLOQUEADO" && (
                                    <button
                                      type="button"
                                      onClick={() => handleQuickUnlockUser(u)}
                                      className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 font-bold px-2.5 py-1.5 rounded-xl text-xs transition"
                                    >
                                      🔓 Desbloquear
                                    </button>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => openEditUserModal(u)}
                                    className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl text-xs transition"
                                  >
                                    ✏️ Editar
                                  </button>
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ABA 4 (CARD #41): TELA DE PARÂMETROS DE REGRA PARA OS USUÁRIOS */}
            {activeTab === "PARAMETROS" && (
              <div className="space-y-6">
                {isAdmin && (
                  <form
                    onSubmit={handleSaveRoleRule}
                    className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-5 shadow-xl"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">
                          GOVERNANÇA OPERACIONAL · PARÂMETROS DE DIÁRIAS E TURNOS
                        </span>
                        <h2 className="text-lg font-extrabold text-white mt-0.5">
                          {editingRuleId ? "Editar Parâmetro de Regra" : "Novo Parâmetro de Regra por Função"}
                        </h2>
                      </div>
                      {editingRuleId && (
                        <button
                          type="button"
                          onClick={() => {
                            setEditingRuleId(null);
                            setRuleFunctionName("");
                          }}
                          className="text-xs text-slate-400 hover:text-white"
                        >
                          Cancelar edição ✕
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Tipo de Função / Especialidade *
                        </label>
                        <input
                          type="text"
                          required
                          value={ruleFunctionName}
                          onChange={(e) => setRuleFunctionName(e.target.value)}
                          placeholder="Ex: Churrasqueiro, Garçom, Segurança..."
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Perfil Aplicável</label>
                        <select
                          value={ruleTargetRole}
                          onChange={(e) =>
                            setRuleTargetRole(e.target.value as "EQUIPE_INTERNA" | "EQUIPE_EXTERNA")
                          }
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        >
                          <option value="EQUIPE_EXTERNA">👨‍🍳 Equipe Externa (Terceirizados)</option>
                          <option value="EQUIPE_INTERNA">🏠 Equipe Interna (Apoio Familiar)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">
                          Modelo / Regime (Presencial / Híbrido)
                        </label>
                        <select
                          value={ruleWorkModel}
                          onChange={(e) => setRuleWorkModel(e.target.value as WorkModel)}
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        >
                          <option value="PRESENCIAL">Presencial no Espaço</option>
                          <option value="HIBRIDO">Híbrido (Remoto + Presencial)</option>
                          <option value="VOLANTE">Volante / Por Demanda</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-xs font-medium text-slate-300 mb-1">Período Padrão</label>
                        <select
                          value={ruleDefaultPeriod}
                          onChange={(e) => setRuleDefaultPeriod(e.target.value as ShiftPeriod)}
                          className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-xs text-white"
                        >
                          <option value="DIURNO">☀️ Diurno (06h às 12h)</option>
                          <option value="VESPERTINO">🌤️ Vespertino (12h às 18h)</option>
                          <option value="NOTURNO">🌙 Noturno (18h às 00h)</option>
                          <option value="INTEGRAL">🔄 Integral / Flexível</option>
                        </select>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
                      <div className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                        <label className="block text-xs font-bold text-amber-400 mb-1">
                          ☀️ Valor da Diária Diurna (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={ruleRateDiurna}
                          onChange={(e) => setRuleRateDiurna(e.target.value)}
                          className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                        />
                      </div>

                      <div className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                        <label className="block text-xs font-bold text-orange-400 mb-1">
                          🌤️ Valor da Diária Vespertina (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={ruleRateVespertina}
                          onChange={(e) => setRuleRateVespertina(e.target.value)}
                          className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                        />
                      </div>

                      <div className="bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                        <label className="block text-xs font-bold text-sky-400 mb-1">
                          🌙 Valor da Diária Noturna (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          required
                          value={ruleRateNoturna}
                          onChange={(e) => setRuleRateNoturna(e.target.value)}
                          className="w-full bg-[#111726] border border-slate-700 rounded-xl px-3 py-2 text-xs text-white font-bold"
                        />
                      </div>
                    </div>

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold py-3 px-8 rounded-2xl text-xs transition"
                      >
                        {editingRuleId ? "✓ Salvar alterações da regra" : "+ Cadastrar parâmetro de regra"}
                      </button>
                    </div>
                  </form>
                )}

                <div className="bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-base font-extrabold text-white">
                        Tabela Oficial de Parâmetros de Regra ({roleRules.length})
                      </h3>
                      <p className="text-xs text-slate-400">
                        Regras utilizadas para cálculo automático de diárias por turno no Portal da Equipe e nos Cadastros.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {roleRules.map((rule) => (
                      <div
                        key={rule.id}
                        className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col justify-between gap-3"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                              {rule.id} · {rule.targetRole}
                            </span>
                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                              {rule.workModel} · {rule.defaultPeriod}
                            </span>
                          </div>
                          <h4 className="text-sm font-extrabold text-white">{rule.functionName}</h4>

                          <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
                            <div className="bg-[#111726] border border-slate-800 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">☀️ Diurna</span>
                              <strong className="text-emerald-400">R$ {rule.rateDiurna}</strong>
                            </div>
                            <div className="bg-[#111726] border border-slate-800 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">🌤️ Vespertina</span>
                              <strong className="text-emerald-400">R$ {rule.rateVespertina}</strong>
                            </div>
                            <div className="bg-[#111726] border border-slate-800 p-2 rounded-xl">
                              <span className="text-[10px] text-slate-400 block">🌙 Noturna</span>
                              <strong className="text-emerald-400">R$ {rule.rateNoturna}</strong>
                            </div>
                          </div>
                        </div>

                        {isAdmin && (
                          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800/80">
                            <button
                              type="button"
                              onClick={() => handleEditRoleRule(rule)}
                              className="bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 text-xs font-bold px-3 py-1.5 rounded-xl"
                            >
                              ✏️ Editar regra
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteRoleRule(rule.id)}
                              className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                            >
                              Excluir
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ABA 5: MINHA CONTA */}
            {activeTab === "MINHA_CONTA" && (
              <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
                <form
                  onSubmit={handleSaveMyOwnProfile}
                  className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-4">
                    <div>
                      <h2 className="text-lg font-extrabold text-white">Meus Dados Pessoais</h2>
                      <p className="text-xs text-slate-400">
                        Edite as informações da sua própria conta ({currentUser.role}).
                      </p>
                    </div>
                    <span className="text-xs font-mono bg-[#0A0E17] border border-slate-800 px-3 py-1.5 rounded-xl text-amber-400 font-bold">
                      {corpIdentity.corporateCode}
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Nome completo *</label>
                    <input
                      type="text"
                      required
                      value={myAccountName}
                      onChange={(e) => setMyAccountName(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">E-mail de Login *</label>
                    <input
                      type="email"
                      required
                      value={myAccountEmail}
                      onChange={(e) => setMyAccountEmail(e.target.value)}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between text-xs mb-1.5">
                      <span className="text-slate-300 font-medium">Telefone ANATEL *</span>
                      {myPhoneCheck.valid && (
                        <span className="text-emerald-400 font-semibold">
                          ✓ {myPhoneCheck.regionUf?.replace(" - ", " · ")} · DDD válido
                        </span>
                      )}
                    </div>
                    <input
                      type="tel"
                      required
                      value={myAccountPhone}
                      onChange={(e) => setMyAccountPhone(applyAnatelPhoneMask(e.target.value))}
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs font-mono text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">
                      Minha Função / Especialidade
                    </label>
                    <input
                      type="text"
                      value={myAccountSpecialty}
                      onChange={(e) => setMyAccountSpecialty(e.target.value)}
                      placeholder="Ex: Apoio Operacional, Recepção, Gestão..."
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold py-3.5 rounded-2xl text-xs transition"
                  >
                    Salvar meus dados no Supabase
                  </button>
                </form>

                <form
                  onSubmit={handleUpdateMyOwnPassword}
                  className="xl:col-span-6 bg-[#111726] border border-slate-800/90 rounded-3xl p-6 space-y-4"
                >
                  <div className="border-b border-slate-800 pb-4">
                    <h2 className="text-lg font-extrabold text-white">Alterar Minha Senha RBAC</h2>
                    <p className="text-xs text-slate-400">
                      Mínimo de 8 caracteres, caractere especial, letra maiúscula, minúscula e número.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Senha atual *</label>
                    <input
                      type="password"
                      required
                      value={myCurrentPassword}
                      onChange={(e) => setMyCurrentPassword(e.target.value)}
                      placeholder="Digite sua senha atual"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Nova senha RBAC *</label>
                    <input
                      type="password"
                      required
                      value={myNewPassword}
                      onChange={(e) => setMyNewPassword(e.target.value)}
                      placeholder="Digite a nova senha"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                    <span className={myPwCheck.minLength ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Mínimo de 8 caracteres
                    </span>
                    <span className={myPwCheck.hasSpecial ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ 1 caractere especial (!@#$)
                    </span>
                    <span
                      className={
                        myPwCheck.hasUpper && myPwCheck.hasLower ? "text-emerald-400 font-bold" : "text-slate-500"
                      }
                    >
                      ✓ Maiúscula e minúscula
                    </span>
                    <span className={myPwCheck.hasNumber ? "text-emerald-400 font-bold" : "text-slate-500"}>
                      ✓ Pelo menos 1 número
                    </span>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1.5">Confirme a nova senha *</label>
                    <input
                      type="password"
                      required
                      value={myConfirmPassword}
                      onChange={(e) => setMyConfirmPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-3 text-xs text-white"
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full bg-[#192236] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-extrabold py-3.5 rounded-2xl text-xs transition"
                  >
                    Atualizar minha senha no Supabase
                  </button>
                </form>
              </div>
            )}

            {/* ABA 6: BACKUP, RESTORE E BOTÃO DE EMERGÊNCIA / MANUTENÇÃO (EXCLUSIVA PARA ADM) */}
            {activeTab === "BACKUP" && canAccessBackup && (
              <div className="space-y-6">
                {/* CARD #45: Painel de Emergência / Manutenção + Botão de Desbloqueio Seletivo */}
                <section className="bg-[#111726] border-2 border-red-500/40 rounded-3xl p-6 space-y-4 shadow-xl">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-red-400">
                        🚨 PROTOCOLO DE SEGURANÇA E MANUTENÇÃO (CARD #45)
                      </span>
                      <h3 className="text-lg font-extrabold text-white">
                        Botão de Emergência / Manutenção & Desbloqueio Seletivo
                      </h3>
                      <p className="text-xs text-slate-400 max-w-2xl">
                        O botão de emergência bloqueia imediatamente todos os usuários que estão com status{" "}
                        <strong>ATIVO</strong> no momento (exceto o perfil <strong>ADM</strong>). O botão de
                        desbloqueio restaura o status <strong>ATIVO</strong> exclusivamente aos usuários que foram
                        bloqueados por esta ação.
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                      <button
                        type="button"
                        onClick={handleActivateEmergencyLock}
                        className="bg-red-600 hover:bg-red-500 text-white font-extrabold px-5 py-3 rounded-2xl text-xs transition shadow-lg shadow-red-600/20"
                      >
                        🚨 Ativar Emergência / Manutenção
                      </button>
                      <button
                        type="button"
                        onClick={handleDeactivateEmergencyLock}
                        className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-5 py-3 rounded-2xl text-xs transition shadow-lg shadow-emerald-500/20"
                      >
                        🔓 Desbloquear usuários ({emergencyState.lockedUserIds.length})
                      </button>
                    </div>
                  </div>
                </section>

                {/* CARDS DE EXPORTAÇÃO DE BACKUP */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[
                    {
                      scope: "Usuários" as const,
                      title: "Pessoas e acessos",
                      desc: "Todas as contas dos 4 perfis RBAC e identidades corporativas sincronizadas no Supabase.",
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
                      desc: "Um retrato integral de todo o sistema, criando automaticamente ponto de Restore.",
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

                {/* CARD #44: Controle de Restore do Último Backup, Exclusão e Reset */}
                <div className="bg-[#111726] border border-amber-500/30 rounded-3xl p-6 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-base font-extrabold text-white">
                      Restore do Último Backup & Governança de Dados
                    </h3>
                    <p className="text-xs text-slate-400">
                      {lastBackupSnapshot
                        ? `Último ponto de restauração disponível: #${lastBackupSnapshot.id} (${lastBackupSnapshot.scope}) salvo em ${lastBackupSnapshot.savedAtGmt3} por ${lastBackupSnapshot.savedBy}.`
                        : "Baixe qualquer backup acima (.JSON ou .SQL) para gerar um snapshot de restauração instantânea."}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2.5 shrink-0">
                    <button
                      type="button"
                      onClick={handleRestoreLastBackup}
                      className="bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold px-4 py-2.5 rounded-xl text-xs transition shadow-md"
                    >
                      ⏪ Restore do último backup
                    </button>
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
          </div>
        </main>
      </div>

      {/* MODAL (CARD #43): MONITOR DETALHADO DE STATUS DE FUNCIONAMENTO DAS APIS */}
      {showApiStatusModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111726] border border-slate-700 rounded-3xl max-w-2xl w-full p-6 space-y-5 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  TELEMETRIA EM TEMPO REAL · INFRAESTRUTURA CLOUD & SERVERLESS
                </span>
                <h2 className="text-xl font-extrabold text-white mt-0.5">
                  Status de Funcionamento das APIs
                </h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={refreshApisHealth}
                  disabled={isCheckingApis}
                  className="bg-[#0A0E17] hover:bg-slate-800 text-amber-400 border border-amber-500/30 font-bold px-3 py-1.5 rounded-xl"
                >
                  {isCheckingApis ? "Verificando..." : "🔄 Atualizar diagnóstico"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowApiStatusModal(false)}
                  className="text-slate-400 hover:text-white text-base font-bold px-2"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {apiHealthList.map((api) => (
                <div
                  key={api.id}
                  className="bg-[#0A0E17] border border-slate-800 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-2.5 h-2.5 rounded-full ${
                          api.status === "ONLINE"
                            ? "bg-emerald-400"
                            : api.status === "ALERTA"
                            ? "bg-amber-400"
                            : "bg-red-500"
                        }`}
                      />
                      <h3 className="font-extrabold text-sm text-white">{api.name}</h3>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                        {api.status}
                      </span>
                    </div>
                    <p className="text-slate-400">
                      Provedor: <strong className="text-slate-200">{api.provider}</strong> · Endpoint:{" "}
                      <span className="font-mono text-amber-300">{api.endpoint}</span>
                    </p>
                    <p className="text-slate-300">{api.detail}</p>
                  </div>

                  <div className="flex sm:flex-col items-end justify-between shrink-0 bg-[#111726] border border-slate-800 px-3.5 py-2.5 rounded-xl">
                    <span className="font-mono text-base font-extrabold text-emerald-400">
                      {api.latencyMs} ms
                    </span>
                    <span className="text-[10px] text-slate-400">Uptime: {api.uptimePercent}</span>
                    <span className="text-[10px] text-slate-500">{api.checkedAtGmt3}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <button
                type="button"
                onClick={() => setShowApiStatusModal(false)}
                className="bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-extrabold py-2.5 px-6 rounded-xl"
              >
                Fechar monitor de APIs
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE "NOVO AGENDAMENTO RÁPIDO" */}
      {isAdmin && showNewEventModal && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateManualEvent}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  ADICIONAR NA AGENDA & NOTIFICAR CLIENTE · DATA: {evDate}
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
                <label className="block text-slate-300 mb-1">Nome do Cliente *</label>
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
                <label className="block text-slate-300 mb-1">E-mail do Cliente (p/ confirmação)</label>
                <input
                  type="email"
                  value={evClientEmail}
                  onChange={(e) => setEvClientEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
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
                        <span className="text-slate-400">
                          {st.specialty} ({st.staffType === "INTERNA" ? "Interna" : "Externa"})
                        </span>
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
                ✓ Confirmar e enviar e-mail ao cliente
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

      {/* MODAL DE EDIÇÃO DE CONTA DE TERCEIROS (APENAS ADM) */}
      {isAdmin && editingUser && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEditedUser}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  IDENTIDADE CORPORATIVA · {getCorporateIdentityInfo(editingUser).corporateCode}
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
                <label className="block text-slate-300 mb-1">Status (Ativo / Bloqueado / Inativo)</label>
                <select
                  value={editUserStatus}
                  onChange={(e) => setEditUserStatus(e.target.value as UserStatus)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2.5 text-white"
                >
                  <option value="ATIVO">🟢 Ativo</option>
                  <option value="BLOQUEADO">🔒 Bloqueado</option>
                  <option value="INATIVO">🔴 Inativo</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-slate-300 mb-1">Função / Especialidade</label>
                <input
                  type="text"
                  value={editUserSpecialty}
                  onChange={(e) => setEditUserSpecialty(e.target.value)}
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3.5 py-2.5 text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
            </div>

            {editUserRole === "EQUIPE_EXTERNA" && (
              <div className="space-y-3 bg-[#0A0E17] border border-slate-800 p-3.5 rounded-2xl">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="block text-slate-400 mb-1">Regime de trabalho</label>
                    <select
                      value={editUserWorkModel}
                      onChange={(e) => setEditUserWorkModel(e.target.value as WorkModel)}
                      className="w-full bg-[#111726] border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                    >
                      <option value="PRESENCIAL">Presencial</option>
                      <option value="HIBRIDO">Híbrido</option>
                      <option value="VOLANTE">Volante</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">Período padrão</label>
                    <select
                      value={editUserShiftPeriod}
                      onChange={(e) => setEditUserShiftPeriod(e.target.value as ShiftPeriod)}
                      className="w-full bg-[#111726] border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                    >
                      <option value="DIURNO">Diurno</option>
                      <option value="VESPERTINO">Vespertino</option>
                      <option value="NOTURNO">Noturno</option>
                      <option value="INTEGRAL">Integral</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] text-amber-400 mb-1">☀️ Diurna (R$)</label>
                    <input
                      type="number"
                      value={editUserRateDiurna}
                      onChange={(e) => setEditUserRateDiurna(e.target.value)}
                      className="w-full bg-[#111726] border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-orange-400 mb-1">🌤️ Vespertina (R$)</label>
                    <input
                      type="number"
                      value={editUserRateVespertina}
                      onChange={(e) => setEditUserRateVespertina(e.target.value)}
                      className="w-full bg-[#111726] border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] text-sky-400 mb-1">🌙 Noturna (R$)</label>
                    <input
                      type="number"
                      value={editUserRateNoturna}
                      onChange={(e) => setEditUserRateNoturna(e.target.value)}
                      className="w-full bg-[#111726] border border-slate-700 rounded-xl px-2.5 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            <div>
              <label className="block text-slate-300 mb-1">
                Redefinir senha (Opcional · exigirá troca no próximo login)
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
                Guardar informações no Supabase
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

      {/* MODAL DE EDIÇÃO DE EVENTO E ESCALA (CARD #38: SEM BOTÃO DE CONFIRMAR PRESENÇA PELO ADM) */}
      {isAdmin && editingEvent && (
        <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <form
            onSubmit={handleSaveEventModal}
            className="bg-[#111726] border border-slate-700 rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase text-amber-400">
                  GESTÃO DE ESCALA E DADOS DO EVENTO
                </span>
                <h3 className="text-lg font-extrabold text-white mt-0.5">Editar Evento & Escala</h3>
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
                  <option value="CONFIRMADO">🟢 Confirmado (Envia e-mail ao cliente)</option>
                  <option value="PENDENTE">🟠 Pendente (Laranja)</option>
                  <option value="CANCELADO">🔴 Cancelado (Vermelho)</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                <label className="block text-slate-300 mb-1">E-mail do Cliente</label>
                <input
                  type="email"
                  value={modClientEmail}
                  onChange={(e) => setModClientEmail(e.target.value)}
                  placeholder="cliente@gmail.com"
                  className="w-full bg-[#0A0E17] border border-slate-800 rounded-xl px-3 py-2 text-white"
                />
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
                Escalar Profissionais (a confirmação de presença é feita pelo próprio colaborador):
              </label>
              <div className="space-y-2 max-h-44 overflow-y-auto bg-[#0A0E17] border border-slate-800 p-3 rounded-xl">
                {staffList.length === 0 ? (
                  <p className="text-slate-500">Cadastre membros na aba Cadastros para escalá-los aqui.</p>
                ) : (
                  staffList.map((st) => {
                    const isAssigned = modTeam.includes(st.name);
                    const isConfirmed = isStaffMemberConfirmed(st.name, modConfirmedStaff);

                    return (
                      <div
                        key={st.id}
                        className="flex items-center justify-between gap-2 py-1.5 border-b border-slate-800/60 last:border-b-0"
                      >
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={isAssigned}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setModTeam([...modTeam.filter((n) => n !== "A definir pelo ADM"), st.name]);
                              } else {
                                setModTeam(modTeam.filter((n) => n !== st.name));
                                setModConfirmedStaff(
                                  modConfirmedStaff.filter(
                                    (c) => c.trim().toLowerCase() !== st.name.trim().toLowerCase()
                                  )
                                );
                              }
                            }}
                          />
                          <span>
                            <strong className="text-white">{st.name}</strong>{" "}
                            <span className="text-slate-400">
                              ({st.specialty} · {st.staffType === "INTERNA" ? "Interna" : "Externa"})
                            </span>
                          </span>
                        </label>

                        {isAssigned && (
                          <span
                            className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border ${
                              isConfirmed
                                ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                                : "bg-orange-500/20 text-orange-300 border-orange-500/40"
                            }`}
                          >
                            {isConfirmed ? "✓ Confirmado pelo colaborador" : "⏳ Aguardando colaborador"}
                          </span>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            <div className="flex gap-2.5 pt-2">
              <button
                type="submit"
                className="flex-1 bg-[#F59E0B] hover:bg-amber-400 text-slate-950 font-bold py-3 rounded-xl"
              >
                Guardar alterações da escala
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