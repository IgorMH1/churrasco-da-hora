// tabs/admin/AdminRuleParametersTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import {
  RoleParameterRule,
  ShiftPeriod,
  WorkModel,
} from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import { saveRoleParameterRulesToStorage } from "../../repositories/governance.repository";

export interface AdminRuleParametersTabProps {
  currentUser: UserAccount;
  roleRules: RoleParameterRule[];
  onRulesUpdated: (updatedRules: RoleParameterRule[]) => void;
}

/**
 * Isolated Rule Parameters tab for configuring shift daily rates (Diurna, Vespertina, Noturna),
 * function types, work models (Presencial, Híbrido, Volante), and default periods (Card #41).
 */
export function AdminRuleParametersTab({
  currentUser,
  roleRules,
  onRulesUpdated,
}: AdminRuleParametersTabProps) {
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [functionName, setFunctionName] = useState("");
  const [targetRole, setTargetRole] = useState<
    "EQUIPE_INTERNA" | "EQUIPE_EXTERNA"
  >("EQUIPE_EXTERNA");
  const [workModel, setWorkModel] = useState<WorkModel>("PRESENCIAL");
  const [defaultPeriod, setDefaultPeriod] = useState<ShiftPeriod>("DIURNO");
  const [rateDiurna, setRateDiurna] = useState<number>(250);
  const [rateVespertina, setRateVespertina] = useState<number>(280);
  const [rateNoturna, setRateNoturna] = useState<number>(330);
  const [feedback, setFeedback] = useState<string>("");

  const isReadOnlyInternalStaff = currentUser.role === "EQUIPE_INTERNA";

  const handleSaveRule = (e: React.FormEvent) => {
    e.preventDefault();
    if (isReadOnlyInternalStaff || !functionName.trim()) return;

    const ruleRecord: RoleParameterRule = {
      id:
        editingRuleId ||
        `RULE-${String(roleRules.length + 1).padStart(2, "0")}`,
      functionName: functionName.trim(),
      targetRole,
      workModel,
      defaultPeriod,
      rateDiurna,
      rateVespertina,
      rateNoturna,
    };

    const updated = editingRuleId
      ? roleRules.map((r) => (r.id === editingRuleId ? ruleRecord : r))
      : [...roleRules, ruleRecord];

    saveRoleParameterRulesToStorage(updated);
    onRulesUpdated(updated);
    setEditingRuleId(null);
    setFunctionName("");
    setFeedback(
      `✓ Parâmetro de função "${ruleRecord.functionName}" salvo e disponibilizado na aba Cadastros!`
    );
  };

  const handleEditRule = (rule: RoleParameterRule) => {
    setEditingRuleId(rule.id);
    setFunctionName(rule.functionName);
    setTargetRole(rule.targetRole);
    setWorkModel(rule.workModel);
    setDefaultPeriod(rule.defaultPeriod);
    setRateDiurna(rule.rateDiurna);
    setRateVespertina(rule.rateVespertina);
    setRateNoturna(rule.rateNoturna);
  };

  const handleDeleteRule = (id: string) => {
    if (isReadOnlyInternalStaff) return;
    const updated = roleRules.filter((r) => r.id !== id);
    saveRoleParameterRulesToStorage(updated);
    onRulesUpdated(updated);
    setFeedback("Regra removida com sucesso.");
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <FeedbackBanner
          type="success"
          message={feedback}
          onDismiss={() => setFeedback("")}
        />
      )}

      {!isReadOnlyInternalStaff && (
        <form
          onSubmit={handleSaveRule}
          className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4"
        >
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Parametrização Operacional & Diárias por Turno (Card #41)
            </span>
            <h2 className="text-lg font-black text-white">
              {editingRuleId
                ? `Editando Regra #${editingRuleId}`
                : "+ Cadastrar Novo Parâmetro de Função e Diárias"}
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Nome da Função / Especialidade
              </label>
              <input
                type="text"
                required
                placeholder="Ex.: Churrasqueiro Mestre"
                value={functionName}
                onChange={(e) => setFunctionName(e.target.value)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Perfil Alvo
              </label>
              <select
                value={targetRole}
                onChange={(e) =>
                  setTargetRole(
                    e.target.value as "EQUIPE_INTERNA" | "EQUIPE_EXTERNA"
                  )
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="EQUIPE_EXTERNA">EQUIPE EXTERNA</option>
                <option value="EQUIPE_INTERNA">EQUIPE INTERNA</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Regime de Trabalho
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
                Período Padrão
              </label>
              <select
                value={defaultPeriod}
                onChange={(e) =>
                  setDefaultPeriod(e.target.value as ShiftPeriod)
                }
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="DIURNO">DIURNO (Até 12h)</option>
                <option value="VESPERTINO">VESPERTINO (12h às 18h)</option>
                <option value="NOTURNO">NOTURNO (Após 18h)</option>
                <option value="INTEGRAL">INTEGRAL</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-300 mb-1">
                Valor Diária Diurna (R$)
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
                Valor Diária Vespertina (R$)
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
                Valor Diária Noturna (R$)
              </label>
              <input
                type="number"
                min={0}
                value={rateNoturna}
                onChange={(e) => setRateNoturna(Number(e.target.value))}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              />
            </div>

            <div className="flex items-end">
              <button
                type="submit"
                className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
              >
                {editingRuleId ? "Atualizar parâmetro" : "+ Salvar parâmetro"}
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
        <h3 className="text-base font-black text-white">
          Tabela de Parâmetros de Funções Homologadas ({roleRules.length})
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {roleRules.map((rule) => (
            <div
              key={rule.id}
              className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 flex flex-col justify-between gap-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30">
                    {rule.id} · {rule.targetRole}
                  </span>
                  <h4 className="text-sm font-black text-white mt-1">
                    {rule.functionName}
                  </h4>
                  <p className="text-xs text-slate-400">
                    Regime: <strong>{rule.workModel}</strong> · Turno padrão:{" "}
                    <strong>{rule.defaultPeriod}</strong>
                  </p>
                </div>

                {!isReadOnlyInternalStaff && (
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleEditRule(rule)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white"
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(rule.id)}
                      className="min-h-[36px] px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-xs font-bold text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-slate-800 text-xs">
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">
                    Diurna
                  </span>
                  <strong className="text-emerald-300">
                    R$ {rule.rateDiurna}
                  </strong>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">
                    Vespertina
                  </span>
                  <strong className="text-amber-300">
                    R$ {rule.rateVespertina}
                  </strong>
                </div>
                <div className="bg-slate-950 p-2 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 block">
                    Noturna
                  </span>
                  <strong className="text-sky-300">
                    R$ {rule.rateNoturna}
                  </strong>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}