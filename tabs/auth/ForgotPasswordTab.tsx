// tabs/auth/ForgotPasswordTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { UserAccount } from "../../models/user.model";
import { sendPasswordRecoveryEmail } from "../../repositories/email.repository";
import { createPasswordResetToken } from "../../services/auth.service";

export interface ForgotPasswordTabProps {
  allUsers: UserAccount[];
  onBackToLogin: () => void;
}

/**
 * Isolated tab for requesting a 15-minute password recovery link via Gmail SMTP (Cards #20, #48).
 */
export function ForgotPasswordTab({
  allUsers,
  onBackToLogin,
}: ForgotPasswordTabProps) {
  const [email, setEmail] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSending, setIsSending] = useState(false);

  const handleSendRecoveryLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    const normalizedEmail = email.trim().toLowerCase();
    const matchedUser = allUsers.find(
      (u) => u.email.trim().toLowerCase() === normalizedEmail
    );

    if (!matchedUser) {
      setFeedback({
        type: "error",
        message: "Nenhuma conta encontrada com este endereço de e-mail.",
      });
      return;
    }

    setIsSending(true);
    try {
      const token = createPasswordResetToken(matchedUser.email);
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const resetUrl = `${origin}/?resetToken=${encodeURIComponent(
        token
      )}&email=${encodeURIComponent(matchedUser.email)}`;

      const dispatchResult = await sendPasswordRecoveryEmail({
        email: matchedUser.email,
        userName: matchedUser.name,
        resetUrl,
      });

      if (!dispatchResult.ok) {
        setFeedback({
          type: "error",
          message:
            dispatchResult.error ||
            "Falha ao enviar o e-mail de recuperação via Gmail SMTP.",
        });
        return;
      }

      setFeedback({
        type: "success",
        message: `✓ Link de recuperação enviado para ${matchedUser.email}! Verifique sua caixa de entrada e spam (válido por 15 minutos).`,
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-md mx-auto space-y-5 shadow-xl">
      <div>
        <span className="text-[11px] font-black uppercase tracking-widest text-amber-400">
          Recuperação via Gmail SMTP · Porta 465 SSL
        </span>
        <h2 className="text-xl font-black text-white mt-1">
          Esqueci minha senha
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Informe seu e-mail cadastrado para receber o link exclusivo de
          redefinição de senha.
        </p>
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <form onSubmit={handleSendRecoveryLink} className="space-y-4">
        <div>
          <label
            htmlFor="recover-email"
            className="block text-xs font-bold text-slate-300 mb-1.5"
          >
            E-mail da Conta
          </label>
          <input
            id="recover-email"
            type="email"
            required
            placeholder="seu.email@dominio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBackToLogin}
            className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-700 text-xs font-bold"
          >
            Voltar ao login
          </button>
          <button
            type="submit"
            disabled={isSending}
            className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
          >
            {isSending ? "Enviando e-mail..." : "Enviar link por e-mail →"}
          </button>
        </div>
      </form>
    </div>
  );
}