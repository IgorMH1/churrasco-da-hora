// tabs/admin/AdminMyAccountTab.tsx
"use client";

import React from "react";
import { AccountProfileSplitForm } from "../../components/shared/AccountProfileSplitForm";
import { UserAccount } from "../../models/user.model";
import {
  setCurrentUserSession,
  syncAllTablesFromUsersList,
} from "../../repositories/user.repository";

export interface AdminMyAccountTabProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onAccountUpdated: (
    updatedUsers: UserAccount[],
    updatedCurrentUser: UserAccount
  ) => void;
}

/**
 * Admin & Internal Staff "Minha Conta" tab wrapper consuming the unified AccountProfileSplitForm.
 */
export function AdminMyAccountTab({
  currentUser,
  allUsers,
  onAccountUpdated,
}: AdminMyAccountTabProps) {
  const handleSave = async (
    updatedUsers: UserAccount[],
    updatedCurrentUser: UserAccount
  ) => {
    await syncAllTablesFromUsersList(updatedUsers);
    setCurrentUserSession(updatedCurrentUser);
    onAccountUpdated(updatedUsers, updatedCurrentUser);
  };

  return (
    <AccountProfileSplitForm
      currentUser={currentUser}
      allUsers={allUsers}
      hideCpfCnpj={true}
      showStaffShiftRates={currentUser.role !== "ADM"}
      onSaveUpdatedUsers={handleSave}
    />
  );
}