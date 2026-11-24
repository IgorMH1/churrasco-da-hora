// tabs/client/ClientMyAccountTab.tsx
"use client";

import React from "react";
import { AccountProfileSplitForm } from "../../components/shared/AccountProfileSplitForm";
import { UserAccount } from "../../models/user.model";
import {
  setCurrentUserSession,
  syncAllTablesFromUsersList,
} from "../../repositories/user.repository";

export interface ClientMyAccountTabProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  onAccountUpdated: (
    updatedUsers: UserAccount[],
    updatedCurrentUser: UserAccount
  ) => void;
}

/**
 * Client "Minha Conta" tab wrapper enforcing CPF/CNPJ removal (Card #40).
 */
export function ClientMyAccountTab({
  currentUser,
  allUsers,
  onAccountUpdated,
}: ClientMyAccountTabProps) {
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
      showStaffShiftRates={false}
      onSaveUpdatedUsers={handleSave}
    />
  );
}