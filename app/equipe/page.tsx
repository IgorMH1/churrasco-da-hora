// app/equipe/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { AuthGuardLoader } from "../../components/layout/AuthGuardLoader";
import {
  PortalHeader,
  PortalNavigationTab,
} from "../../components/layout/PortalHeader";
import { usePortalAuthGuard } from "../../hooks/usePortalAuthGuard";
import { EventRecord } from "../../models/event.model";
import { RoleParameterRule } from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import { getRoleParameterRulesFromStorage } from "../../repositories/governance.repository";
import { StaffMyAccountTab } from "../../tabs/staff/StaffMyAccountTab";
import { StaffScheduleTab } from "../../tabs/staff/StaffScheduleTab";

type StaffPortalTabId = "ESCALA" | "MINHA_CONTA";

export default function ExternalStaffPortalOrchestrator() {
  const {
    isCheckingAuth,
    currentUser,
    dataset,
    setCurrentUser,
    handleLogout,
  } = usePortalAuthGuard({
    allowedRoles: ["EQUIPE_EXTERNA", "EQUIPE_INTERNA"],
  });

  const [activeTab, setActiveTab] = useState<StaffPortalTabId>("ESCALA");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [roleRules, setRoleRules] = useState<RoleParameterRule[]>([]);

  useEffect(() => {
    setUsers(dataset.users);
    setEvents(dataset.events);
    setRoleRules(getRoleParameterRulesFromStorage());
  }, [dataset]);

  if (isCheckingAuth || !currentUser) {
    return <AuthGuardLoader portalName="Portal da Equipe Credenciada" />;
  }

  const tabs: PortalNavigationTab[] = [
    { id: "ESCALA", label: "📋 Minha Escala & Diárias por Turno" },
    { id: "MINHA_CONTA", label: "🪪 Minha Conta & Credencial" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col">
      <PortalHeader
        portalTitle="Portal da Equipe Operacional · Churrasco dos Da Hora"
        portalSubtitle="Consulta de escala mensal, confirmação de presença e diárias por turno"
        currentUser={currentUser}
        tabs={tabs}
        activeTabId={activeTab}
        onSelectTab={(id) => setActiveTab(id as StaffPortalTabId)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "ESCALA" && (
          <StaffScheduleTab
            currentUser={currentUser}
            allEvents={events}
            roleRules={roleRules}
            onEventsUpdated={setEvents}
          />
        )}

        {activeTab === "MINHA_CONTA" && (
          <StaffMyAccountTab
            currentUser={currentUser}
            allUsers={users}
            onAccountUpdated={(updatedUsers, updatedUser) => {
              setUsers(updatedUsers);
              setCurrentUser(updatedUser);
            }}
          />
        )}
      </main>
    </div>
  );
}