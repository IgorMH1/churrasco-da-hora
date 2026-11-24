// app/admin/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AuthGuardLoader } from "../../components/layout/AuthGuardLoader";
import {
  PortalHeader,
  PortalNavigationTab,
} from "../../components/layout/PortalHeader";
import { ApiHealthMonitorModal } from "../../components/modals/ApiHealthMonitorModal";
import { EventScaleEditModal } from "../../components/modals/EventScaleEditModal";
import { QuickEventScheduleModal } from "../../components/modals/QuickEventScheduleModal";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { usePortalAuthGuard } from "../../hooks/usePortalAuthGuard";
import { ClientRecord } from "../../models/client.model";
import { CreateEventDto, EventRecord } from "../../models/event.model";
import {
  ApiHealthStatus,
  BackupLogRecord,
  EmergencyMaintenanceState,
} from "../../models/governance.model";
import { RoleParameterRule, StaffMember } from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import { saveEventsToStorage } from "../../repositories/event.repository";
import {
  getEmergencyMaintenanceState,
  getRoleParameterRulesFromStorage,
} from "../../repositories/governance.repository";
import { syncAllTablesFromUsersList } from "../../repositories/user.repository";
import { notifyClientOnEventConfirmation } from "../../services/eventSchedule.service";
import { checkAllApisHealth } from "../../services/governance.service";
import { isStaffMemberInList } from "../../utils/stringFormatters";
import { AdminBackupGovernanceTab } from "../../tabs/admin/AdminBackupGovernanceTab";
import { AdminDashboardTab } from "../../tabs/admin/AdminDashboardTab";
import { AdminEventsManagementTab } from "../../tabs/admin/AdminEventsManagementTab";
import { AdminMyAccountTab } from "../../tabs/admin/AdminMyAccountTab";
import { AdminRuleParametersTab } from "../../tabs/admin/AdminRuleParametersTab";
import { AdminUsersRegistryTab } from "../../tabs/admin/AdminUsersRegistryTab";

type AdminPortalTabId =
  | "DASHBOARD"
  | "EVENTOS"
  | "CADASTROS"
  | "PARAMETROS"
  | "MINHA_CONTA"
  | "BACKUP";

export default function AdminPortalOrchestrator() {
  const {
    isCheckingAuth,
    currentUser,
    dataset,
    setCurrentUser,
    handleLogout,
  } = usePortalAuthGuard({
    allowedRoles: ["ADM", "EQUIPE_INTERNA"],
  });

  const [activeTab, setActiveTab] = useState<AdminPortalTabId>("DASHBOARD");
  const [selectedYearMonth, setSelectedYearMonth] = useState("2026-11");

  const [users, setUsers] = useState<UserAccount[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [clients, setClients] = useState<ClientRecord[]>([]);
  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLogRecord[]>([]);
  const [roleRules, setRoleRules] = useState<RoleParameterRule[]>([]);
  const [emergencyState, setEmergencyState] =
    useState<EmergencyMaintenanceState>({
      active: false,
      lockedUserIds: [],
    });

  const [isQuickModalOpen, setIsQuickModalOpen] = useState(false);
  const [quickModalDate, setQuickModalDate] = useState("2026-11-20");
  const [editingEvent, setEditingEvent] = useState<EventRecord | null>(null);

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCheckingApis, setIsCheckingApis] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<ApiHealthStatus[]>([]);
  const [globalToast, setGlobalToast] = useState<string>("");

  const refreshApis = useCallback(async () => {
    setIsCheckingApis(true);
    try {
      const results = await checkAllApisHealth();
      setApiStatuses(results);
    } finally {
      setIsCheckingApis(false);
    }
  }, []);

  useEffect(() => {
    setUsers(dataset.users);
    setEvents(dataset.events);
    setClients(dataset.clients);
    setStaff(dataset.staff);
    setBackupLogs(dataset.backupLogs);
    setRoleRules(getRoleParameterRulesFromStorage());
    setEmergencyState(getEmergencyMaintenanceState());
    refreshApis();
  }, [dataset, refreshApis]);

  if (isCheckingAuth || !currentUser) {
    return <AuthGuardLoader portalName="Painel Administrativo & Operação" />;
  }

  const isInternalStaff = currentUser.role === "EQUIPE_INTERNA";

  const handleCreateQuickEvent = async (dto: CreateEventDto) => {
    const nextId = `EVT-${String(events.length + 101).padStart(4, "0")}`;
    const newEvent: EventRecord = {
      id: nextId,
      title: dto.title,
      eventType: dto.eventType,
      honoreeName: dto.guestCount,
      clientName: dto.clientName,
      clientEmail: dto.clientEmail,
      responsibleAdmin: dto.responsibleAdmin,
      eventDate: dto.eventDate,
      startTime: dto.startTime,
      endTime: dto.endTime,
      status: dto.status,
      supportTeam: dto.supportTeam,
      confirmedStaff: [],
    };

    const updated = [newEvent, ...events];
    await saveEventsToStorage(updated);
    setEvents(updated);

    if (newEvent.status === "CONFIRMADO") {
      const emailResult = await notifyClientOnEventConfirmation(newEvent, users);
      setGlobalToast(
        emailResult.sent
          ? `✓ Evento #${nextId} criado e e-mail de confirmação enviado para ${emailResult.email}!`
          : `✓ Evento #${nextId} confirmado na agenda!`
      );
    }
  };

  const handleApprovePendingEvent = async (target: EventRecord) => {
    const confirmedEvent: EventRecord = { ...target, status: "CONFIRMADO" };
    const updated = events.map((ev) =>
      ev.id === target.id ? confirmedEvent : ev
    );
    await saveEventsToStorage(updated);
    setEvents(updated);

    const emailResult = await notifyClientOnEventConfirmation(
      confirmedEvent,
      users
    );
    setGlobalToast(
      emailResult.sent
        ? `✓ Evento #${target.id} aprovado e confirmação enviada por e-mail para ${emailResult.email}!`
        : `✓ Evento #${target.id} aprovado na agenda!`
    );
  };

  const handleCancelEvent = async (target: EventRecord) => {
    const updated = events.map((ev) =>
      ev.id === target.id ? { ...ev, status: "CANCELADO" as const } : ev
    );
    await saveEventsToStorage(updated);
    setEvents(updated);
    setGlobalToast(`Evento #${target.id} marcado como CANCELADO.`);
  };

  const handleSaveEditedEvent = async (updatedEvent: EventRecord) => {
    const previousEvent = events.find((ev) => ev.id === updatedEvent.id);
    const updated = events.map((ev) =>
      ev.id === updatedEvent.id ? updatedEvent : ev
    );
    await saveEventsToStorage(updated);
    setEvents(updated);

    if (
      previousEvent?.status !== "CONFIRMADO" &&
      updatedEvent.status === "CONFIRMADO"
    ) {
      await notifyClientOnEventConfirmation(updatedEvent, users);
    }
    setGlobalToast(`✓ Evento #${updatedEvent.id} e escala atualizados!`);
  };

  const handleToggleOwnStaffPresence = async (targetEvent: EventRecord) => {
    const currentConfirmed = targetEvent.confirmedStaff || [];
    const alreadyConfirmed = isStaffMemberInList(
      currentUser.name,
      currentConfirmed
    );

    const nextConfirmed = alreadyConfirmed
      ? currentConfirmed.filter(
          (n) => n.trim().toLowerCase() !== currentUser.name.trim().toLowerCase()
        )
      : [...currentConfirmed, currentUser.name];

    const updated = events.map((ev) =>
      ev.id === targetEvent.id ? { ...ev, confirmedStaff: nextConfirmed } : ev
    );
    await saveEventsToStorage(updated);
    setEvents(updated);
  };

  const handleSaveUsersAndSync = async (updatedUsers: UserAccount[]) => {
    const { syncedStaff, syncedClients } =
      await syncAllTablesFromUsersList(updatedUsers);
    setUsers(updatedUsers);
    setStaff(syncedStaff);
    setClients(syncedClients);
  };

  const pendingMonthCount = events.filter(
    (ev) =>
      ev.eventDate.startsWith(selectedYearMonth) && ev.status === "PENDENTE"
  ).length;

  const tabs: PortalNavigationTab[] = [
    { id: "DASHBOARD", label: "📊 Dashboard Mensal" },
    {
      id: "EVENTOS",
      label: "📅 Gestão de Eventos",
      badgeCount: pendingMonthCount,
    },
    {
      id: "CADASTROS",
      label: "👥 Cadastros & Credenciais",
      badgeCount: users.length,
    },
    { id: "PARAMETROS", label: "⚙️ Parâmetros & Regras" },
    { id: "MINHA_CONTA", label: "🪪 Minha Conta" },
    // Card #33: Internal Staff has access to everything except Backup
    ...(!isInternalStaff
      ? [{ id: "BACKUP", label: "🛡️ Backup, Restore & Emergência" }]
      : []),
  ];

  const onlineApiCount = apiStatuses.filter(
    (api) => api.status === "ONLINE"
  ).length;

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col">
      <PortalHeader
        portalTitle="Painel de Governança & Operação · Churrasco dos Da Hora"
        portalSubtitle="Gestão integrada de eventos, escala operacional, diárias por turno e RBAC"
        currentUser={currentUser}
        tabs={tabs}
        activeTabId={activeTab}
        onSelectTab={(id) => setActiveTab(id as AdminPortalTabId)}
        onLogout={handleLogout}
        extraRightActions={
          <button
            type="button"
            onClick={() => {
              refreshApis();
              setIsApiModalOpen(true);
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              APIs ({onlineApiCount}/{apiStatuses.length || 4})
            </span>
          </button>
        }
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 space-y-6">
        {globalToast && (
          <FeedbackBanner
            type="success"
            message={globalToast}
            onDismiss={() => setGlobalToast("")}
          />
        )}

        {activeTab === "DASHBOARD" && (
          <AdminDashboardTab
            currentUser={currentUser}
            events={events}
            selectedYearMonth={selectedYearMonth}
            onChangeYearMonth={setSelectedYearMonth}
            onApprovePendingEvent={handleApprovePendingEvent}
            onCancelEvent={handleCancelEvent}
            onOpenEditScaleModal={setEditingEvent}
            onToggleOwnStaffPresence={handleToggleOwnStaffPresence}
          />
        )}

        {activeTab === "EVENTOS" && (
          <AdminEventsManagementTab
            currentUser={currentUser}
            events={events}
            selectedYearMonth={selectedYearMonth}
            onChangeYearMonth={setSelectedYearMonth}
            onOpenQuickScheduleModal={(date) => {
              if (date) setQuickModalDate(date);
              setIsQuickModalOpen(true);
            }}
            onOpenEditScaleModal={setEditingEvent}
            onApprovePendingEvent={handleApprovePendingEvent}
            onCancelEvent={handleCancelEvent}
          />
        )}

        {activeTab === "CADASTROS" && (
          <AdminUsersRegistryTab
            currentUser={currentUser}
            users={users}
            roleRules={roleRules}
            onSaveUsersList={handleSaveUsersAndSync}
          />
        )}

        {activeTab === "PARAMETROS" && (
          <AdminRuleParametersTab
            currentUser={currentUser}
            roleRules={roleRules}
            onRulesUpdated={setRoleRules}
          />
        )}

        {activeTab === "MINHA_CONTA" && (
          <AdminMyAccountTab
            currentUser={currentUser}
            allUsers={users}
            onAccountUpdated={(updatedUsers, updatedUser) => {
              setUsers(updatedUsers);
              setCurrentUser(updatedUser);
            }}
          />
        )}

        {activeTab === "BACKUP" && !isInternalStaff && (
          <AdminBackupGovernanceTab
            currentUser={currentUser}
            users={users}
            events={events}
            clients={clients}
            staffList={staff}
            backupLogs={backupLogs}
            emergencyState={emergencyState}
            onDatasetRestoredOrReset={(payload) => {
              setUsers(payload.users);
              setEvents(payload.events);
              setClients(payload.clients);
              setStaff(payload.staff);
              if (payload.backupLogs) setBackupLogs(payload.backupLogs);
            }}
            onBackupLogsUpdated={setBackupLogs}
            onEmergencyStateUpdated={(nextState, updatedUsers) => {
              setEmergencyState(nextState);
              setUsers(updatedUsers);
            }}
          />
        )}
      </main>

      <QuickEventScheduleModal
        isOpen={isQuickModalOpen}
        initialDate={quickModalDate}
        currentAdminName={currentUser.name}
        clientsList={users.filter((u) => u.role === "CLIENTE")}
        activeStaffList={staff.filter((s) => s.status === "ATIVO")}
        onClose={() => setIsQuickModalOpen(false)}
        onCreateEvent={handleCreateQuickEvent}
      />

      <EventScaleEditModal
        isOpen={Boolean(editingEvent)}
        eventRecord={editingEvent}
        activeStaffList={staff.filter((s) => s.status === "ATIVO")}
        onClose={() => setEditingEvent(null)}
        onSaveEvent={handleSaveEditedEvent}
      />

      <ApiHealthMonitorModal
        isOpen={isApiModalOpen}
        isLoading={isCheckingApis}
        apiStatuses={apiStatuses}
        onRefresh={refreshApis}
        onClose={() => setIsApiModalOpen(false)}
      />
    </div>
  );
}