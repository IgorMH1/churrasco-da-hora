// tabs/auth/LoginTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { RBAC_SECURITY_LIMITS } from "../../config/constants";
import { EmergencyMaintenanceState } from "../../models/governance.model";
import { UserAccount } from "../../models/user.model";
import {
  lockUserAccountByEmailInSupabase,
  setCurrentUserSession,
} from "../../repositories/user.repository";
import { isFirstLoginPasswordChangeRequired } from "../../services/auth.service";

export interface LoginTabProps {
  allUsers: UserAccount[];
  emergencyState: EmergencyMaintenanceState;
  onUsersUpdated: (updatedUsers: UserAccount[]) => void;
  onRequireFirstLoginReset: (user: UserAccount) => void;
  onNavigateForgotPassword: () => void;
}

/**
 * Pure UI tab for RBAC authentication, enforcing 5-attempt lockout (Card #46),
 * emergency maintenance lockout (Card #45), and first-login interception (Card #42).
 */
export function LoginTab({
  allUsers,
  emergencyState,
  onUsersUpdated,
  onRequireFirstLoginReset,
  onNavigateForgotPassword,
}: LoginTabProps) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [failedAttemptsByEmail, setFailedAttemptsByEmail] = useState<
    Record<string, number>
  >({});
  const [errorMessage, setErrorMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const routeAuthenticatedUser = (user: UserAccount) => {
    setCurrentUserSession(user);
    if (user.role === "ADM" || user.role === "EQUIPE_INTERNA") {
      window.location.assign("/admin");
      return;
    }
    if (user.role === "EQUIPE_EXTERNA") {
      window.location.assign("/equipe");
      return;
    }
    window.location.assign("/cliente");
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    const normalizedEmail = email.trim().toLowerCase();
    const matchedUser = allUsers.find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      setErrorMessage(
        "Conta não encontrada no banco de dados. Solicite seu cadastro ao Administrador."
      );
      return;
    }

    if (emergencyState.active && matchedUser.role !== "ADM") {
      setErrorMessage(
        "🚨 Sistema em Modo de Emergência / Manutenção. O acesso está temporariamente restrito ao Administrador."
      );
      return;
    }

    if (matchedUser.status === "BLOQUEADO") {
      setErrorMessage(
        "🔒 Esta conta está BLOQUEADA por segurança ou manutenção. Solicite o desbloqueio ao Administrador ou redefina sua senha por e-mail."
      );
      return;
    }

    if (matchedUser.status === "INATIVO") {
      setErrorMessage(
        "Esta conta está INATIVA. Entre em contato com a administração."
      );
      return;
    }

    if (matchedUser.password !== password) {
      const currentFailures = (failedAttemptsByEmail[normalizedEmail] || 0) + 1;
      setFailedAttemptsByEmail((prev) => ({
        ...prev,
        [normalizedEmail]: currentFailures,
      }));

      if (
        currentFailures >= RBAC_SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS &&
        matchedUser.role !== "ADM"
      ) {
        setIsSubmitting(true);
        try {
          const updatedList = await lockUserAccountByEmailInSupabase(
            normalizedEmail,
            allUsers
          );
          onUsersUpdated(updatedList);
          setErrorMessage(
            `🔒 Limite de ${RBAC_SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS} tentativas excedido! Sua conta foi marcada como BLOQUEADA no Supabase.`
          );
        } finally {
          setIsSubmitting(false);
        }
        return;
      }

      const remainingAttempts = Math.max(
        0,
        RBAC_SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS - currentFailures
      );
      setErrorMessage(
        `Senha incorreta. Tentativa ${currentFailures}/${RBAC_SECURITY_LIMITS.MAX_LOGIN_ATTEMPTS} (${remainingAttempts} restante(s) antes do bloqueio).`
      );
      return;
    }

    if (isFirstLoginPasswordChangeRequired(matchedUser)) {
      setCurrentUserSession(matchedUser);
      onRequireFirstLoginReset(matchedUser);
      return;
    }

    routeAuthenticatedUser(matchedUser);
  };

  return (
    <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md mx-auto space-y-5 shadow-xl">
      <div>
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
          Autenticação Corporativa RBAC
        </span>
        <h2 className="text-xl font-black text-white mt-1">
          Acessar minha conta
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Entre com seu e-mail e senha cadastrados no Churrasco dos Da Hora.
        </p>
      </div>

      {emergencyState.active && (
        <FeedbackBanner
          type="warning"
          message={`🚨 Modo de Emergência ativo desde ${emergencyState.activatedAtGmt3 || "agora"}. Apenas contas ADM podem iniciar sessão.`}
        />
      )}

      {errorMessage && (
        <FeedbackBanner
          type="error"
          message={errorMessage}
          onDismiss={() => setErrorMessage("")}
        />
      )}

      <form onSubmit={handleLoginSubmit} className="space-y-4">
        <div>
          <label
            htmlFor="login-email"
            className="block text-xs font-bold text-slate-300 mb-1.5"
          >
            E-mail Corporativo ou Pessoal
          </label>
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="seu.email@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label
              htmlFor="login-password"
              className="block text-xs font-bold text-slate-300"
            >
              Senha RBAC
            </label>
            <button
              type="button"
              onClick={onNavigateForgotPassword}
              className="text-xs font-bold text-amber-400 hover:text-amber-300 underline-offset-2 hover:underline"
            >
              Esqueci minha senha
            </button>
          </div>
          <input
            id="login-password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
        >
          {isSubmitting ? "Autenticando..." : "Entrar na plataforma →"}
        </button>
      </form>
    </div>
  );
}