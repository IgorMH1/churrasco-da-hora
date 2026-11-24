// tabs/auth/FirstAccessPasswordTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import {
  evaluatePasswordRbacCriteria,
  PasswordRbacChecklist,
} from "../../components/shared/PasswordRbacChecklist";
import { UserAccount } from "../../models/user.model";
import {
  setCurrentUserSession,
  syncAllTablesFromUsersList,
} from "../../repositories/user.repository";
import { markIsoPasswordChanged } from "../../services/auth.service";
import { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";

export interface FirstAccessPasswordTabProps {
  pendingUser: UserAccount;
  allUsers: UserAccount[];
  onUsersUpdated: (updatedUsers: UserAccount[]) => void;
  onCancelFirstAccess: () => void;
}

/**
 * Mandatory first-login password update screen for all RBAC profiles (Card #42).
 */
export function FirstAccessPasswordTab({
  pendingUser,
  allUsers,
  onUsersUpdated,
  onCancelFirstAccess,
}: FirstAccessPasswordTabProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const corporateInfo = getCorporateIdentityInfo(pendingUser);

  const handleCompleteFirstAccess = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const evaluation = evaluatePasswordRbacCriteria(newPassword);
    if (!evaluation.isAllValid) {
      setErrorMessage(
        "A nova senha deve cumprir todos os 4 critérios de segurança RBAC."
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage("A confirmação de senha não confere.");
      return;
    }

    if (newPassword === pendingUser.password) {
      setErrorMessage(
        "Por segurança, a nova senha deve ser diferente da senha provisória inicial."
      );
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser: UserAccount = {
        ...pendingUser,
        password: newPassword,
        passwordChangedAtIso: markIsoPasswordChanged(),
        mustChangePassword: false,
        status: "ATIVO",
      };

      const updatedUsers = allUsers.map((u) =>
        u.id === pendingUser.id ? updatedUser : u
      );

      await syncAllTablesFromUsersList(updatedUsers);
      onUsersUpdated(updatedUsers);
      setCurrentUserSession(updatedUser);

      if (
        updatedUser.role === "ADM" ||
        updatedUser.role === "EQUIPE_INTERNA"
      ) {
        window.location.assign("/admin");
        return;
      }
      if (updatedUser.role === "EQUIPE_EXTERNA") {
        window.location.assign("/equipe");
        return;
      }
      window.location.assign("/cliente");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#111726] border border-amber-500/40 rounded-2xl p-6 sm:p-8 max-w-md mx-auto space-y-5 shadow-xl">
      <div>
        <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
          🔒 Primeiro Acesso Obrigatório · {corporateInfo.corporateCode}
        </span>
        <h2 className="text-xl font-black text-white mt-2">
          Defina sua senha pessoal
        </h2>
        <p className="text-xs text-slate-400 mt-1">
          Olá, <strong className="text-white">{pendingUser.name}</strong>! Para
          liberar seu painel ({corporateInfo.clearanceLevel}), cadastre uma nova
          senha definitiva.
        </p>
      </div>

      {errorMessage && (
        <FeedbackBanner
          type="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage("")}
        />
      )}

      <form onSubmit={handleCompleteFirstAccess} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Nova Senha Definitiva (Padrão RBAC)
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Digite sua nova senha"
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
          <PasswordRbacChecklist passwordValue={newPassword} />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Confirmar Nova Senha
          </label>
          <input
            type="password"
            required
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Repita a nova senha"
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onCancelFirstAccess}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold"
          >
            Voltar
          </button>
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
          >
            {isSaving
              ? "Ativando credencial..."
              : "Salvar senha e acessar painel →"}
          </button>
        </div>
      </form>
    </div>
  );
}