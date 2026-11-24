// components/shared/AccountProfileSplitForm.tsx
"use client";

import React, { useState } from "react";
import {
  applyAnatelPhoneMask,
  validateAnatelPhone,
} from "../../lib/services/anatel";
import { UserAccount } from "../../models/user.model";
import { markIsoPasswordChanged } from "../../services/auth.service";
import { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";
import { formatIsoDatePtBr } from "../../utils/dateFormatters";
import { FeedbackBanner } from "./FeedbackBanner";
import {
  evaluatePasswordRbacCriteria,
  PasswordRbacChecklist,
} from "./PasswordRbacChecklist";
import { UserStatusBadge } from "./StatusBadge";

export interface AccountProfileSplitFormProps {
  currentUser: UserAccount;
  allUsers: UserAccount[];
  hideCpfCnpj?: boolean;
  showStaffShiftRates?: boolean;
  onSaveUpdatedUsers: (
    updatedUsers: UserAccount[],
    updatedCurrentUser: UserAccount
  ) => Promise<void>;
}

/**
 * Unified 2-column "Minha Conta" component used across Admin, Internal Staff,
 * External Staff, and Client portals (Cards #36, #40, #41, #47).
 */
export function AccountProfileSplitForm({
  currentUser,
  allUsers,
  hideCpfCnpj = true,
  showStaffShiftRates = false,
  onSaveUpdatedUsers,
}: AccountProfileSplitFormProps) {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [phone, setPhone] = useState(currentUser.phoneAnatel);
  const [specialty, setSpecialty] = useState(currentUser.specialty || "");
  const [companyName, setCompanyName] = useState(currentUser.companyName || "");

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const corporateInfo = getCorporateIdentityInfo(currentUser);

  const handleSaveProfileData = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!name.trim() || !email.trim()) {
      setFeedback({
        type: "error",
        message: "Nome completo e e-mail são obrigatórios.",
      });
      return;
    }

    const phoneValidation = validateAnatelPhone(phone);
    if (!phoneValidation.valid) {
      setFeedback({
        type: "error",
        message:
          phoneValidation.error ||
          "Telefone inválido segundo o padrão ANATEL (67 DDDs).",
      });
      return;
    }

    const emailInUse = allUsers.some(
      (u) =>
        u.id !== currentUser.id &&
        u.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (emailInUse) {
      setFeedback({
        type: "error",
        message: "Este e-mail já está vinculado a outra conta no sistema.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser: UserAccount = {
        ...currentUser,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneAnatel: phoneValidation.formatted || phone.trim(),
        specialty: specialty.trim() || currentUser.specialty,
        companyName: companyName.trim() || currentUser.companyName,
      };

      const updatedUsers = allUsers.map((u) =>
        u.id === currentUser.id ? updatedUser : u
      );

      await onSaveUpdatedUsers(updatedUsers, updatedUser);
      setFeedback({
        type: "success",
        message: "✓ Dados cadastrais atualizados e sincronizados com o Supabase!",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (currentPassword !== currentUser.password) {
      setFeedback({
        type: "error",
        message: "A senha atual informada está incorreta.",
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

    if (newPassword === currentUser.password) {
      setFeedback({
        type: "error",
        message: "A nova senha deve ser diferente da senha atual.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const updatedUser: UserAccount = {
        ...currentUser,
        password: newPassword,
        passwordChangedAtIso: markIsoPasswordChanged(),
        mustChangePassword: false,
      };

      const updatedUsers = allUsers.map((u) =>
        u.id === currentUser.id ? updatedUser : u
      );

      await onSaveUpdatedUsers(updatedUsers, updatedUser);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setFeedback({
        type: "success",
        message: "🔒 Senha RBAC atualizada com sucesso (validade renovada por 90 dias)!",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Corporate Identity Digital Badge Banner (Card #47) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-5 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/40">
              🪪 {corporateInfo.corporateCode}
            </span>
            <UserStatusBadge status={currentUser.status} />
            <span className="text-xs font-bold text-slate-400">
              {corporateInfo.clearanceLevel}
            </span>
          </div>
          <h2 className="text-lg font-black text-white">{currentUser.name}</h2>
          <p className="text-xs text-slate-400">
            Unidade: {corporateInfo.unitDepartment} · Última atualização de senha:{" "}
            {formatIsoDatePtBr(currentUser.passwordChangedAtIso)}
          </p>
        </div>

        {showStaffShiftRates && (
          <div className="flex flex-wrap items-center gap-2 bg-slate-900/90 border border-slate-800 rounded-xl p-3 text-xs">
            <div className="px-2.5 py-1">
              <span className="text-slate-400 block text-[10px]">Diária Diurna</span>
              <strong className="text-emerald-300">
                R$ {currentUser.rateDiurna ?? currentUser.dailyRate ?? 250}
              </strong>
            </div>
            <div className="px-2.5 py-1 border-l border-slate-800">
              <span className="text-slate-400 block text-[10px]">Diária Vespertina</span>
              <strong className="text-amber-300">
                R$ {currentUser.rateVespertina ?? currentUser.dailyRate ?? 280}
              </strong>
            </div>
            <div className="px-2.5 py-1 border-l border-slate-800">
              <span className="text-slate-400 block text-[10px]">Diária Noturna</span>
              <strong className="text-sky-300">
                R$ {currentUser.rateNoturna ?? currentUser.dailyRate ?? 320}
              </strong>
            </div>
          </div>
        )}
      </div>

      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Column 1: Personal Registration Data */}
        <form
          onSubmit={handleSaveProfileData}
          className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Dados do Titular
            </span>
            <h3 className="text-base font-black text-white">
              Informações Cadastrais
            </h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nome Completo
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              E-mail de Acesso
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Telefone Celular / WhatsApp (Padrão ANATEL · 67 DDDs)
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(formatAnatelPhone(e.target.value))}
              placeholder="(11) 99999-0000"
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          {!hideCpfCnpj && currentUser.cpfCnpj && (
            <div>
              <label className="block text-xs font-bold text-slate-400 mb-1.5">
                Documento (Somente leitura)
              </label>
              <input
                type="text"
                disabled
                value={currentUser.cpfCnpj}
                className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-sm text-slate-400"
              />
            </div>
          )}

          {currentUser.role !== "CLIENTE" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Especialidade / Função
                </label>
                <input
                  type="text"
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-300 mb-1.5">
                  Empresa / Vínculo
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-300"
          >
            {isSaving ? "Salvando alterações..." : "Salvar dados cadastrais"}
          </button>
        </form>

        {/* Column 2: RBAC Password Change */}
        <form
          onSubmit={handleUpdatePassword}
          className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              Segurança RBAC · Ciclo de 90 Dias
            </span>
            <h3 className="text-base font-black text-white">
              Alterar Senha de Acesso
            </h3>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Senha Atual
            </label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-300 mb-1.5">
              Nova Senha RBAC
            </label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
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
              className="w-full min-h-[44px] px-3.5 py-2.5 rounded-xl bg-slate-900/90 border border-slate-700 text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-300"
          >
            {isSaving ? "Atualizando senha..." : "Atualizar senha RBAC"}
          </button>
        </form>
      </div>
    </div>
  );
}