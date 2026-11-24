// tabs/staff/StaffMyAccountTab.tsx
"use client";

import React from "react";
import { AccountProfileSplitForm } from "../../components/shared/AccountProfileSplitForm";
import { UserAccount } from "../../models/user.model";
import {
  setCurrentUserSession,
  syncAllTablesFromUsersList,
} from "../../repositories/user.repository";

export interface StaffMyAccountTabProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onAccountUpdated: (
    updatedUsers: UserAccount[],
    updatedCurrentUser: UserAccount
  ) => void;
}

/**
 * External Staff "Minha Conta" tab wrapper displaying shift daily rates (Cards #36, #41).
 */
export function StaffMyAccountTab({
  currentUser,
  allUsers,
  onAccountUpdated,
}: StaffMyAccountTabProps) {
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
      showStaffShiftRates={true}
      onSaveUpdatedUsers={handleSave}
    />
  );
}