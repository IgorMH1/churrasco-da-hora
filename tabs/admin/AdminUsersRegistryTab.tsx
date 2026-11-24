// tabs/admin/AdminUsersRegistryTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import {
  evaluatePasswordRbacCriteria,
  PasswordRbacChecklist,
} from "../../components/shared/PasswordRbacChecklist";
import { UserStatusBadge } from "../../components/shared/StatusBadge";
import {
  formatAnatelPhone,
  validateAnatelPhone,
} from "../../lib/services/anatel";
import {
  RoleParameterRule,
  ShiftPeriod,
  WorkModel,
} from "../../models/staff.model";
import { UserAccount, UserRole, UserStatus } from "../../models/user.model";
import {
  isFirstLoginPasswordChangeRequired,
  markIsoForFirstLogin,
  markIsoPasswordChanged,
} from "../../services/auth.service";
import { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";
import { formatIsoDatePtBr } from "../../utils/dateFormatters";

export interface AdminUsersRegistryTabProps {
  currentUser: UserAccount;
  users: UserAccount[];
  roleRules: RoleParameterRule[];
  onSaveUsersList: (updatedUsers: UserAccount[]) => Promise<void>;
}

const ROLE_PREFIX_MAP: Record<UserRole, string> = {
  ADM: "ADM",
  EQUIPE_INTERNA: "INT",
  EQUIPE_EXTERNA: "EXT",
  CLIENTE: "CLI",
};

/**
 * Isolated Users & RBAC Registry tab with full-width creation form (Card #14),
 * filters and table below (Cards #15, #16, #17), role parameter rule autofill (Card #41),
 * mandatory first-login flag (Card #42), blocked status management (Card #46),
 * and corporate identity badge code (Card #47).
 */
export function AdminUsersRegistryTab({
  currentUser,
  users,
  roleRules,
  onSaveUsersList,
}: AdminUsersRegistryTabProps) {
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("Mudar@2026");
  const [role, setRole] = useState<UserRole>("EQUIPE_EXTERNA");
  const [specialty, setSpecialty] = useState("Churrasqueiro Mestre");
  const [companyName, setCompanyName] = useState("Prestador MEI");
  const [rateDiurna, setRateDiurna] = useState<number>(380);
  const [rateVespertina, setRateVespertina] = useState<number>(420);
  const [rateNoturna, setRateNoturna] = useState<number>(480);
  const [workModel, setWorkModel] = useState<WorkModel>("PRESENCIAL");
  const [shiftPeriod, setShiftPeriod] = useState<ShiftPeriod>("INTEGRAL");
  const [status, setStatus] = useState<UserStatus>("ATIVO");
  const [forceFirstLogin, setForceFirstLogin] = useState<boolean>(true);

  const [roleFilter, setRoleFilter] = useState<"TODOS" | UserRole>("TODOS");
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const isReadOnlyInternalStaff = currentUser.role === "EQUIPE_INTERNA";

  const handleApplyRulePreset = (ruleId: string) => {
    const foundRule = roleRules.find((r) => r.id === ruleId);
    if (!foundRule) return;
    setRole(foundRule.targetRole);
    setSpecialty(foundRule.functionName);
    setWorkModel(foundRule.workModel);
    setShiftPeriod(foundRule.defaultPeriod);
    setRateDiurna(foundRule.rateDiurna);
    setRateVespertina(foundRule.rateVespertina);
    setRateNoturna(foundRule.rateNoturna);
  };

  const resetForm = () => {
    setEditingUserId(null);
    setName("");
    setEmail("");
    setPhone("");
    setPassword("Mudar@2026");
    setRole("EQUIPE_EXTERNA");
    setSpecialty("Churrasqueiro Mestre");
    setCompanyName("Prestador MEI");
    setStatus("ATIVO");
    setForceFirstLogin(true);
  };

  const handleEditClick = (user: UserAccount) => {
    setEditingUserId(user.id);
    setName(user.name);
    setEmail(user.email);
    setPhone(user.phoneAnatel);
    setPassword(user.password);
    setRole(user.role);
    setSpecialty(user.specialty || "");
    setCompanyName(user.companyName || "");
    setRateDiurna(user.rateDiurna ?? user.dailyRate ?? 0);
    setRateVespertina(user.rateVespertina ?? user.dailyRate ?? 0);
    setRateNoturna(user.rateNoturna ?? user.dailyRate ?? 0);
    setWorkModel(user.workModel || "PRESENCIAL");
    setShiftPeriod(user.shiftPeriod || "INTEGRAL");
    setStatus(user.status);
    setForceFirstLogin(isFirstLoginPasswordChangeRequired(user));
  };

  const handleUnlockOrToggleStatus = async (targetUser: UserAccount) => {
    if (isReadOnlyInternalStaff) return;
    const nextStatus: UserStatus =
      targetUser.status === "ATIVO" ? "INATIVO" : "ATIVO";

    const updated = users.map((u) =>
      u.id === targetUser.id ? { ...u, status: nextStatus } : u
    );
    await onSaveUsersList(updated);
    setFeedback({
      type: "success",
      message: `✓ Status de ${targetUser.name} atualizado para ${nextStatus}.`,
    });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyInternalStaff) return;
    setFeedback(null);

    const phoneCheck = validateAnatelPhone(phone);
    if (!phoneCheck.valid) {
      setFeedback({
        type: "error",
        message: phoneCheck.error || "Telefone inválido segundo a ANATEL.",
      });
      return;
    }

    const pwEval = evaluatePasswordRbacCriteria(password);
    if (!pwEval.isAllValid) {
      setFeedback({
        type: "error",
        message: "A senha deve cumprir os 4 requisitos RBAC.",
      });
      return;
    }

    const duplicateEmail = users.some(
      (u) =>
        u.id !== editingUserId &&
        u.email.trim().toLowerCase() === email.trim().toLowerCase()
    );
    if (duplicateEmail) {
      setFeedback({
        type: "error",
        message: "Já existe um usuário cadastrado com este e-mail.",
      });
      return;
    }

    setIsSaving(true);
    try {
      const prefix = ROLE_PREFIX_MAP[role] || "CLI";
      const targetId =
        editingUserId ||
        `${prefix}-${String(users.length + 101).padStart(4, "0")}`;

      const corporateInfo = getCorporateIdentityInfo({
        id: targetId,
        role,
        status,
        specialty,
      });

      const userRecord: UserAccount = {
        id: targetId,
        corporateId: corporateInfo.corporateCode,
        name: name.trim(),
        email: email.trim().toLowerCase(),
        phoneAnatel: phoneCheck.formatted || phone.trim(),
        password,
        role,
        specialty: role === "CLIENTE" ? undefined : specialty.trim(),
        companyName: role === "CLIENTE" ? undefined : companyName.trim(),
        dailyRate: role === "EQUIPE_EXTERNA" ? rateDiurna : 0,
        rateDiurna: role === "EQUIPE_EXTERNA" ? rateDiurna : 0,
        rateVespertina: role === "EQUIPE_EXTERNA" ? rateVespertina : 0,
        rateNoturna: role === "EQUIPE_EXTERNA" ? rateNoturna : 0,
        workModel,
        shiftPeriod,
        status,
        passwordChangedAtIso: forceFirstLogin
          ? markIsoForFirstLogin()
          : markIsoPasswordChanged(),
        mustChangePassword: forceFirstLogin,
      };

      const updatedUsers = editingUserId
        ? users.map((u) => (u.id === editingUserId ? userRecord : u))
        : [...users, userRecord];

      await onSaveUsersList(updatedUsers);
      resetForm();
      setFeedback({
        type: "success",
        message: `✓ Credencial ${corporateInfo.corporateCode} (${userRecord.name}) salva no Supabase!`,
      });
    } finally {
      setIsSaving(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const matchesRole = roleFilter === "TODOS" ? true : u.role === roleFilter;
    const query = searchQuery.trim().toLowerCase();
    const matchesQuery =
      !query ||
      u.name.toLowerCase().includes(query) ||
      u.email.toLowerCase().includes(query) ||
      (u.corporateId || "").toLowerCase().includes(query);
    return matchesRole && matchesQuery;
  });

  return (
    <div className="space-y-6">
      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Full-Width User Creation / Edit Container (Cards #14, #41, #42) */}
      {!isReadOnlyInternalStaff && (
        <form
          onSubmit={handleSaveUser}
          className="w-full bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                Governança RBAC & Identidade Corporativa (Largura Total · Card
                #14)
              </span>
              <h2 className="text-lg font-black text-white">
                {editingUserId
                  ? `Editando Credencial #${editingUserId}`
                  : "+ Adicionar Nova Pessoa / Credencial"}
              </h2>
            </div>

            <div className="flex items-center gap-2">
              <select
                aria-label="Aplicar regra pré-configurada de função"
                onChange={(e) => handleApplyRulePreset(e.target.value)}
                defaultValue=""
                className="min-h-[40px] px-3 py-1.5 rounded-xl bg-slate-900 border border-amber-500/40 text-xs font-bold text-amber-300"
              >
                <option value="" disabled>
                  ⚡ Preencher com Regra de Função (Card #41)...
                </option>
                {roleRules.map((rule) => (
                  <option key={rule.id} value={rule.id}>
                    {rule.functionName} (D: R${rule.rateDiurna} / V: R$
                    {rule.rateVespertina} / N: R${rule.rateNoturna})
                  </option>
                ))}
              </select>

              {editingUserId && (
                <button
                  type="button"
                  onClick={resetForm}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 text-slate-300 border border-slate-700 text-xs font-bold"
                >
                  Cancelar edição
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome Completo
              </label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                E-mail de Login
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Telefone Celular ANATEL (67 DDDs)
              </label>
              <input
                type="tel"
                required
                placeholder="(11) 99999-0000"
                value={phone}
                onChange={(e) => setPhone(formatAnatelPhone(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Perfil de Acesso RBAC
              </label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="ADM">ADM (Governança Total)</option>
                <option value="EQUIPE_INTERNA">
                  EQUIPE INTERNA (Família / Apoio)
                </option>
                <option value="EQUIPE_EXTERNA">
                  EQUIPE EXTERNA (Parceiro / Terceiro)
                </option>
                <option value="CLIENTE">CLIENTE (Portal de Reservas)</option>
              </select>
            </div>

            {role !== "CLIENTE" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Especialidade / Função
                  </label>
                  <input
                    type="text"
                    value={specialty}
                    onChange={(e) => setSpecialty(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Empresa / Vínculo
                  </label>
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Regime / Modelo (Card #41)
                  </label>
                  <select
                    value={workModel}
                    onChange={(e) => setWorkModel(e.target.value as WorkModel)}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="PRESENCIAL">PRESENCIAL</option>
                    <option value="HIBRIDO">HÍBRIDO</option>
                    <option value="VOLANTE">VOLANTE / POR EVENTO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-300 mb-1">
                    Período Padrão (Card #41)
                  </label>
                  <select
                    value={shiftPeriod}
                    onChange={(e) =>
                      setShiftPeriod(e.target.value as ShiftPeriod)
                    }
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  >
                    <option value="DIURNO">DIURNO</option>
                    <option value="VESPERTINO">VESPERTINO</option>
                    <option value="NOTURNO">NOTURNO</option>
                    <option value="INTEGRAL">INTEGRAL</option>
                  </select>
                </div>
              </>
            )}

            {role === "EQUIPE_EXTERNA" && (
              <>
                <div>
                  <label className="block text-xs font-bold text-emerald-300 mb-1">
                    Diária Diurna (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rateDiurna}
                    onChange={(e) => setRateDiurna(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-amber-300 mb-1">
                    Diária Vespertina (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rateVespertina}
                    onChange={(e) => setRateVespertina(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-sky-300 mb-1">
                    Diária Noturna (R$)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={rateNoturna}
                    onChange={(e) => setRateNoturna(Number(e.target.value))}
                    className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
                  />
                </div>
              </>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Status da Conta (Card #46)
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="ATIVO">ATIVO</option>
                <option value="BLOQUEADO">BLOQUEADO</option>
                <option value="INATIVO">INATIVO</option>
              </select>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Senha Inicial / Redefinida RBAC
              </label>
              <input
                type="text"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
              <PasswordRbacChecklist passwordValue={password} />
            </div>

            <div className="sm:col-span-2 flex flex-col justify-end space-y-3">
              <label className="flex items-center gap-2.5 text-xs font-bold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={forceFirstLogin}
                  onChange={(e) => setForceFirstLogin(e.target.checked)}
                  className="w-4 h-4 rounded accent-amber-500"
                />
                <span>
                  Obrigar troca de senha no próximo login (1º Acesso · Card #42)
                </span>
              </label>

              <button
                type="submit"
                disabled={isSaving}
                className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs"
              >
                {isSaving
                  ? "Sincronizando no Supabase..."
                  : editingUserId
                  ? "Salvar alterações da credencial"
                  : "+ Cadastrar pessoa e emitir credencial CDH"}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Filter Bar & Users Table Below Form (Cards #15, #16, #17, #46, #47) */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
              Base Corporativa Sincronizada ({filteredUsers.length} registros)
            </span>
            <h3 className="text-base font-black text-white">
              Visualização e Filtro de Perfis RBAC (Card #15)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="search"
              placeholder="Buscar nome, e-mail ou matrícula CDH..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
            />
            {(
              [
                "TODOS",
                "ADM",
                "EQUIPE_INTERNA",
                "EQUIPE_EXTERNA",
                "CLIENTE",
              ] as const
            ).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRoleFilter(r)}
                className={`min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-bold ${
                  roleFilter === r
                    ? "bg-amber-500 text-slate-950 font-black"
                    : "bg-slate-900 text-slate-300 border border-slate-800"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 uppercase text-[11px]">
                <th className="py-3 px-3">Credencial / ID (#47)</th>
                <th className="py-3 px-3">Titular & Contato ANATEL</th>
                <th className="py-3 px-3">Perfil & Função</th>
                <th className="py-3 px-3">Diárias D / V / N (#41)</th>
                <th className="py-3 px-3">Status (#46)</th>
                <th className="py-3 px-3">Última Senha (#17)</th>
                {!isReadOnlyInternalStaff && (
                  <th className="py-3 px-3 text-right">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {filteredUsers.map((u) => {
                const corp = getCorporateIdentityInfo(u);
                const needsFirstReset =
                  isFirstLoginPasswordChangeRequired(u);

                return (
                  <tr key={u.id} className="hover:bg-slate-900/50">
                    <td className="py-3 px-3 font-black text-amber-300 whitespace-nowrap">
                      <div>{u.corporateId || corp.corporateCode}</div>
                      <div className="text-[10px] text-slate-400 font-normal">
                        ID: {u.id}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-bold text-white">{u.name}</div>
                      <div className="text-slate-400">
                        {u.email} · {u.phoneAnatel}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <span className="font-bold text-slate-200">{u.role}</span>
                      {u.specialty && (
                        <div className="text-[11px] text-slate-400">
                          {u.specialty} ({u.workModel || "PRESENCIAL"})
                        </div>
                      )}
                    </td>

                    <td className="py-3 px-3 whitespace-nowrap">
                      {u.role === "EQUIPE_EXTERNA" ? (
                        <span className="text-[11px] text-slate-300">
                          R${u.rateDiurna ?? u.dailyRate ?? 0} / R$
                          {u.rateVespertina ?? u.dailyRate ?? 0} / R$
                          {u.rateNoturna ?? u.dailyRate ?? 0}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>

                    <td className="py-3 px-3">
                      <div className="flex flex-col gap-1 items-start">
                        <UserStatusBadge status={u.status} />
                        {needsFirstReset && (
                          <span className="text-[10px] font-bold text-amber-300">
                            🔒 Troca no 1º Login
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-slate-400 whitespace-nowrap">
                      {formatIsoDatePtBr(u.passwordChangedAtIso)}
                    </td>

                    {!isReadOnlyInternalStaff && (
                      <td className="py-3 px-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => handleEditClick(u)}
                          className="min-h-[36px] px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white font-bold"
                        >
                          Editar
                        </button>
                        {u.role !== "ADM" && (
                          <button
                            type="button"
                            onClick={() => handleUnlockOrToggleStatus(u)}
                            className={`min-h-[36px] px-3 py-1 rounded-lg font-bold ${
                              u.status === "BLOQUEADO" || u.status === "INATIVO"
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                                : "bg-red-500/15 text-red-300 border border-red-500/30"
                            }`}
                          >
                            {u.status === "BLOQUEADO"
                              ? "🔓 Desbloquear"
                              : u.status === "INATIVO"
                              ? "Ativar"
                              : "Inativar"}
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}