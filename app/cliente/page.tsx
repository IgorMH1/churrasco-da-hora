// app/cliente/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { AuthGuardLoader } from "../../components/layout/AuthGuardLoader";
import {
  PortalHeader,
  PortalNavigationTab,
} from "../../components/layout/PortalHeader";
import { usePortalAuthGuard } from "../../hooks/usePortalAuthGuard";
import { EventRecord } from "../../models/event.model";
import { UserAccount } from "../../models/user.model";
import { ClientEventsTab } from "../../tabs/client/ClientEventsTab";
import { ClientMyAccountTab } from "../../tabs/client/ClientMyAccountTab";

type ClientTabId = "EVENTOS" | "MINHA_CONTA";

export default function ClientPortalOrchestrator() {
  const {
    isCheckingAuth,
    currentUser,
    dataset,
    setCurrentUser,
    handleLogout,
  } = usePortalAuthGuard({
    allowedRoles: ["CLIENTE", "ADM"],
  });

  const [activeTab, setActiveTab] = useState<ClientTabId>("EVENTOS");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);

  useEffect(() => {
    setUsers(dataset.users);
    setEvents(dataset.events);
  }, [dataset]);

  if (isCheckingAuth || !currentUser) {
    return <AuthGuardLoader portalName="Portal do Cliente" />;
  }

  const tabs: PortalNavigationTab[] = [
    { id: "EVENTOS", label: "📅 Meus Eventos & Reservas" },
    { id: "MINHA_CONTA", label: "👤 Minha Conta" },
  ];

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col">
      <PortalHeader
        portalTitle="Portal do Cliente · Churrasco dos Da Hora"
        portalSubtitle="Acompanhamento de reservas, solicitações e credencial corporativa"
        currentUser={currentUser}
        tabs={tabs}
        activeTabId={activeTab}
        onSelectTab={(id) => setActiveTab(id as ClientTabId)}
        onLogout={handleLogout}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6">
        {activeTab === "EVENTOS" && (
          <ClientEventsTab
            currentUser={currentUser}
            allEvents={events}
            onEventsUpdated={setEvents}
          />
        )}

        {activeTab === "MINHA_CONTA" && (
          <ClientMyAccountTab
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