// hooks/usePortalAuthGuard.ts
"use client";

import { useCallback, useEffect, useState } from "react";
import { SupabaseFullDataset } from "../models/governance.model";
import { UserAccount, UserRole } from "../models/user.model";
import { getEmergencyMaintenanceState } from "../repositories/governance.repository";
import {
  fetchAllFromSupabase,
  getCurrentUserSession,
  setCurrentUserSession,
} from "../repositories/user.repository";
import { isFirstLoginPasswordChangeRequired } from "../services/auth.service";

export interface UsePortalAuthGuardOptions {
  allowedRoles: UserRole[];
}

export interface UsePortalAuthGuardResult {
  isCheckingAuth: boolean;
  currentUser: UserAccount | null;
  dataset: SupabaseFullDataset;
  setCurrentUser: (user: UserAccount | null) => void;
  reloadDataset: () => Promise<void>;
  handleLogout: () => void;
}

const EMPTY_DATASET: SupabaseFullDataset = {
  users: [],
  events: [],
  clients: [],
  staff: [],
  backupLogs: [],
};

export function usePortalAuthGuard({
  allowedRoles,
}: UsePortalAuthGuardOptions): UsePortalAuthGuardResult {
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [dataset, setDataset] = useState<SupabaseFullDataset>(EMPTY_DATASET);

  const redirectToLogin = useCallback((clearSession = false) => {
    if (clearSession) {
      setCurrentUserSession(null);
    }
    window.location.replace("/");
  }, []);

  const verifyAndLoadSession = useCallback(async () => {
    const localSession = getCurrentUserSession();
    if (!localSession) {
      redirectToLogin(false);
      return;
    }

    const remoteData = await fetchAllFromSupabase();
    const freshUser =
      remoteData.users.find((u) => u.id === localSession.id) || localSession;

    if (freshUser.status === "BLOQUEADO" || freshUser.status === "INATIVO") {
      redirectToLogin(true);
      return;
    }

    const emergencyState = getEmergencyMaintenanceState();
    if (emergencyState.active && freshUser.role !== "ADM") {
      redirectToLogin(true);
      return;
    }

    if (isFirstLoginPasswordChangeRequired(freshUser)) {
      setCurrentUserSession(freshUser);
      redirectToLogin(false);
      return;
    }

    if (!allowedRoles.includes(freshUser.role)) {
      redirectToLogin(false);
      return;
    }

    setCurrentUserSession(freshUser);
    setCurrentUser(freshUser);
    setDataset(remoteData);
    setIsCheckingAuth(false);
  }, [allowedRoles, redirectToLogin]);

  useEffect(() => {
    verifyAndLoadSession();
  }, [verifyAndLoadSession]);

  const handleLogout = useCallback(() => {
    setCurrentUserSession(null);
    window.location.replace("/");
  }, []);

  return {
    isCheckingAuth,
    currentUser,
    dataset,
    setCurrentUser,
    reloadDataset: verifyAndLoadSession,
    handleLogout,
  };
}