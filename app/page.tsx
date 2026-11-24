// app/page.tsx
"use client";

import React, { useCallback, useEffect, useState } from "react";
import { ApiHealthMonitorModal } from "../components/modals/ApiHealthMonitorModal";
import {
  ApiHealthStatus,
  EmergencyMaintenanceState,
} from "../models/governance.model";
import { EventRecord } from "../models/event.model";
import { UserAccount } from "../models/user.model";
import { getEmergencyMaintenanceState } from "../repositories/governance.repository";
import { fetchAllFromSupabase } from "../repositories/user.repository";
import { checkAllApisHealth } from "../services/governance.service";
import { FirstAccessPasswordTab } from "../tabs/auth/FirstAccessPasswordTab";
import { ForgotPasswordTab } from "../tabs/auth/ForgotPasswordTab";
import { LoginTab } from "../tabs/auth/LoginTab";
import { PublicPreScheduleTab } from "../tabs/auth/PublicPreScheduleTab";
import { ResetPasswordFromLinkTab } from "../tabs/auth/ResetPasswordFromLinkTab";

type PublicPortalTabId =
  | "LOGIN"
  | "PRIMEIRO_ACESSO"
  | "ESQUECI_SENHA"
  | "TROCAR_SENHA_LINK"
  | "AGENDE_EVENTO";

export default function PublicAuthPortalOrchestrator() {
  const [activeTab, setActiveTab] = useState<PublicPortalTabId>("LOGIN");
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [events, setEvents] = useState<EventRecord[]>([]);
  const [emergencyState, setEmergencyState] =
    useState<EmergencyMaintenanceState>({
      active: false,
      lockedUserIds: [],
    });

  const [firstAccessUser, setFirstAccessUser] = useState<UserAccount | null>(
    null
  );
  const [resetEmailParam, setResetEmailParam] = useState("");
  const [resetTokenParam, setResetTokenParam] = useState("");

  const [isApiModalOpen, setIsApiModalOpen] = useState(false);
  const [isCheckingApis, setIsCheckingApis] = useState(false);
  const [apiStatuses, setApiStatuses] = useState<ApiHealthStatus[]>([]);

  const loadInitialData = useCallback(async () => {
    const dataset = await fetchAllFromSupabase();
    setUsers(dataset.users);
    setEvents(dataset.events);
    setEmergencyState(getEmergencyMaintenanceState());

    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("resetToken");
      const email = params.get("email");
      if (token && email) {
        setResetTokenParam(token);
        setResetEmailParam(email);
        setActiveTab("TROCAR_SENHA_LINK");
      }
    }
  }, []);

  const refreshApisHealth = useCallback(async () => {
    setIsCheckingApis(true);
    try {
      const results = await checkAllApisHealth();
      setApiStatuses(results);
    } finally {
      setIsCheckingApis(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
    refreshApisHealth();
  }, [loadInitialData, refreshApisHealth]);

  const onlineApiCount = apiStatuses.filter(
    (api) => api.status === "ONLINE"
  ).length;

  return (
    <div className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col">
      {/* Modular Public Header Container (Cards #1, #29, #43, #50) */}
      <header className="bg-[#111726]/95 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-base">
              🔥
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-amber-400">
                Sistema de Gestão Familiar & Eventos · GMT-3
              </span>
              <h1 className="text-lg sm:text-xl font-black text-white">
                Churrasco dos Da Hora
              </h1>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              refreshApisHealth();
              setIsApiModalOpen(true);
            }}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-emerald-300 flex items-center gap-2"
          >
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>
              Status APIs ({onlineApiCount}/{apiStatuses.length || 4} Online)
            </span>
          </button>
        </div>

        {/* Navigation Bar with "Agende seu evento" separated on the left (Card #29) */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 pb-3 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setActiveTab("AGENDE_EVENTO")}
            className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-black transition-all ${
              activeTab === "AGENDE_EVENTO"
                ? "bg-emerald-500 text-slate-950 shadow-md"
                : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-500/25"
            }`}
          >
            📅 Agende seu evento
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab("LOGIN")}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "LOGIN"
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ESQUECI_SENHA")}
              className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeTab === "ESQUECI_SENHA"
                  ? "bg-amber-500 text-slate-950 font-black"
                  : "bg-slate-900 text-slate-300 border border-slate-800 hover:bg-slate-800"
              }`}
            >
              Esqueci minha senha
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8">
        {activeTab === "LOGIN" && (
          <LoginTab
            allUsers={users}
            emergencyState={emergencyState}
            onUsersUpdated={setUsers}
            onRequireFirstLoginReset={(user) => {
              setFirstAccessUser(user);
              setActiveTab("PRIMEIRO_ACESSO");
            }}
            onNavigateForgotPassword={() => setActiveTab("ESQUECI_SENHA")}
          />
        )}

        {activeTab === "PRIMEIRO_ACESSO" && firstAccessUser && (
          <FirstAccessPasswordTab
            pendingUser={firstAccessUser}
            allUsers={users}
            onUsersUpdated={setUsers}
            onCancelFirstAccess={() => {
              setFirstAccessUser(null);
              setActiveTab("LOGIN");
            }}
          />
        )}

        {activeTab === "ESQUECI_SENHA" && (
          <ForgotPasswordTab
            allUsers={users}
            onBackToLogin={() => setActiveTab("LOGIN")}
          />
        )}

        {activeTab === "TROCAR_SENHA_LINK" && (
          <ResetPasswordFromLinkTab
            resetEmail={resetEmailParam}
            resetToken={resetTokenParam}
            allUsers={users}
            onUsersUpdated={setUsers}
            onSuccessRedirectLogin={() => setActiveTab("LOGIN")}
          />
        )}

        {activeTab === "AGENDE_EVENTO" && (
          <PublicPreScheduleTab
            events={events}
            allUsers={users}
            onEventsUpdated={setEvents}
            onUsersUpdated={setUsers}
          />
        )}
      </main>

      <ApiHealthMonitorModal
        isOpen={isApiModalOpen}
        isLoading={isCheckingApis}
        apiStatuses={apiStatuses}
        onRefresh={refreshApisHealth}
        onClose={() => setIsApiModalOpen(false)}
      />
    </div>
  );
}