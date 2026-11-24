// tabs/auth/ResetPasswordFromLinkTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import {
  evaluatePasswordRbacCriteria,
  PasswordRbacChecklist,
} from "../../components/shared/PasswordRbacChecklist";
import { UserAccount } from "../../models/user.model";
import { syncAllTablesFromUsersList } from "../../repositories/user.repository";
import {
  markIsoPasswordChanged,
  verifyPasswordResetToken,
} from "../../services/auth.service";

export interface ResetPasswordFromLinkTabProps {
  resetEmail: string;
  resetToken: string;
  allUsers: UserAccount[];
  onUsersUpdated: (updatedUsers: UserAccount[]) => void;
  onSuccessRedirectLogin: () => void;
}

/**
 * Isolated tab opened exclusively when the user clicks the email recovery link (?resetToken=...&email=...).
 */
export function ResetPasswordFromLinkTab({
  resetEmail,
  resetToken,
  allUsers,
  onUsersUpdated,
  onSuccessRedirectLogin,
}: ResetPasswordFromLinkTabProps) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const tokenCheck = verifyPasswordResetToken(resetToken, resetEmail);
    if (!tokenCheck.valid) {
      setFeedback({
        type: "error",
        message: tokenCheck.reason || "Token de recuperação inválido.",
      });
      return;
    }

    const evaluation = evaluatePasswordRbacCriteria(newPassword);
    if (!evaluation.isAllValid) {
      setFeedback({
        type: "error",
        message: "A nova senha não cumpre os 4 requisitos de segurança RBAC.",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        type: "error",
        message: "A confirmação da nova senha não confere.",
      });
      return;
    }

    const targetUser = allUsers.find(
      (u) => u.email.trim().toLowerCase() === resetEmail.trim().toLowerCase()
    );

    if (!targetUser) {
      setFeedback({
        type: "error",
        message: "Usuário não localizado para este link de recuperação.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedUsers = allUsers.map((u) =>
        u.id === targetUser.id
          ? {
              ...u,
              password: newPassword,
              status: "ATIVO" as const,
              passwordChangedAtIso: markIsoPasswordChanged(),
              mustChangePassword: false,
            }
          : u
      );

      await syncAllTablesFromUsersList(updatedUsers);
      onUsersUpdated(updatedUsers);

      if (typeof window !== "undefined") {
        window.history.replaceState({}, "", "/");
      }

      setFeedback({
        type: "success",
        message:
          "✓ Senha redefinida e conta desbloqueada com sucesso! Redirecionando para o login...",
      });

      setTimeout(() => {
        onSuccessRedirectLogin();
      }, 1500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-[#111726] border border-emerald-500/40 rounded-2xl p-6 sm:p-8 max-w-md mx-auto space-y-5 shadow-xl">
      <div>
        <span className="text-[11px] font-black uppercase tracking-widest text-emerald-400">
          Link Verificado · Redefinição Segura RBAC
        </span>
        <h2 className="text-xl font-black text-white mt-1">
          Cadastrar nova senha
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Conta vinculada: <strong className="text-white">{resetEmail}</strong>
        </p>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <form onSubmit={handleResetSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-bold text-slate-300 mb-1.5">
            Nova Senha RBAC
          </label>
          <input
            type="password"
            required
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
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
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          />
        </div>

        <button
          type="submit"
          disabled={isSaving}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
        >
          {isSaving ? "Atualizando no Supabase..." : "Confirmar nova senha →"}
        </button>
      </form>
    </div>
  );
}