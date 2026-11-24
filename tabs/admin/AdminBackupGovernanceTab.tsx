// tabs/admin/AdminBackupGovernanceTab.tsx
"use client";

import React, { useState } from "react";
import { FeedbackBanner } from "../../components/shared/FeedbackBanner";
import { getNowGmt3 } from "../../lib/services/rbacAndTime";
import { ClientRecord } from "../../models/client.model";
import { EventRecord } from "../../models/event.model";
import {
  BackupFormat,
  BackupLogRecord,
  BackupScope,
  BackupSnapshotPayload,
  EmergencyMaintenanceState,
} from "../../models/governance.model";
import { StaffMember } from "../../models/staff.model";
import { UserAccount } from "../../models/user.model";
import {
  deleteBackupLogFromSupabase,
  getLastBackupSnapshotFromStorage,
  insertBackupLogInSupabase,
  resetDatabaseToAdminOnly,
  saveBackupSnapshotToStorage,
} from "../../repositories/governance.repository";
import {
  activateEmergencyMaintenanceLock,
  buildBackupExportContent,
  deactivateEmergencyMaintenanceLock,
  restoreLastBackupSnapshot,
} from "../../services/governance.service";

export interface AdminBackupGovernanceTabProps {
  currentUser: UserAccount;
  users: UserAccount[];
  events: EventRecord[];
  clients: ClientRecord[];
  staffList: StaffMember[];
  backupLogs: BackupLogRecord[];
  emergencyState: EmergencyMaintenanceState;
  onDatasetRestoredOrReset: (payload: {
    users: UserAccount[];
    events: EventRecord[];
    clients: ClientRecord[];
    staff: StaffMember[];
    backupLogs?: BackupLogRecord[];
  }) => void;
  onBackupLogsUpdated: (logs: BackupLogRecord[]) => void;
  onEmergencyStateUpdated: (
    nextState: EmergencyMaintenanceState,
    updatedUsers: UserAccount[]
  ) => void;
}

/**
 * Isolated Backup, Restore & Emergency Maintenance Governance tab (Cards #18, #33, #44, #45).
 * Accessible exclusively to ADM profiles.
 */
export function AdminBackupGovernanceTab({
  currentUser,
  users,
  events,
  clients,
  staffList,
  backupLogs,
  emergencyState,
  onDatasetRestoredOrReset,
  onBackupLogsUpdated,
  onEmergencyStateUpdated,
}: AdminBackupGovernanceTabProps) {
  const [scope, setScope] = useState<BackupScope>("Completo");
  const [format, setFormat] = useState<BackupFormat>("JSON");
  const [feedback, setFeedback] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const lastSnapshot = getLastBackupSnapshotFromStorage();

  const handleExportBackup = async () => {
    setIsProcessing(true);
    try {
      const now = getNowGmt3();
      const exportedAtFormatted = `${now.dateStr
        .split("-")
        .reverse()
        .join("/")} às ${now.timeStr}`;

      const content = buildBackupExportContent({
        scope,
        format,
        exportedAtFormatted,
        exportedByAdmin: currentUser.name,
        users,
        clients,
        staffList,
        events,
      });

      const snapshotId = `BKP-${String(backupLogs.length + 101).padStart(
        4,
        "0"
      )}`;

      const snapshotPayload: BackupSnapshotPayload = {
        id: snapshotId,
        savedAtGmt3: exportedAtFormatted,
        savedBy: currentUser.name,
        scope,
        users,
        events,
        clients,
        staff: staffList,
      };
      saveBackupSnapshotToStorage(snapshotPayload);

      const newLog: BackupLogRecord = {
        id: snapshotId,
        scope,
        format,
        exportedAtGmt3: exportedAtFormatted,
        exportedBy: currentUser.name,
      };

      await insertBackupLogInSupabase(newLog);
      onBackupLogsUpdated([newLog, ...backupLogs]);

      const blob = new Blob([content], {
        type: format === "JSON" ? "application/json" : "text/plain",
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `churrasco-da-hora-${scope.toLowerCase()}.${format.toLowerCase()}`;
      anchor.click();
      URL.revokeObjectURL(url);

      setFeedback({
        type: "success",
        message: `✓ Backup #${snapshotId} (${scope} · ${format}) exportado e snapshot de restauração salvo!`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleRestoreLastBackup = async () => {
    setIsProcessing(true);
    try {
      const result = await restoreLastBackupSnapshot();
      if (!result.ok || !result.restored) {
        setFeedback({ type: "error", message: result.message });
        return;
      }

      onDatasetRestoredOrReset({
        users: result.restored.users,
        events: result.restored.events,
        clients: result.restored.clients,
        staff: result.restored.staff,
      });

      setFeedback({ type: "success", message: result.message });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeleteLastBackupLog = async () => {
    if (backupLogs.length === 0) return;
    const latestLog = backupLogs[0];
    await deleteBackupLogFromSupabase(latestLog.id);
    onBackupLogsUpdated(backupLogs.slice(1));
    setFeedback({
      type: "warning",
      message: `Último registro de backup (#${latestLog.id}) excluído do histórico.`,
    });
  };

  const handleActivateEmergency = async () => {
    setIsProcessing(true);
    try {
      const { updatedUsers, state } = await activateEmergencyMaintenanceLock(
        users,
        currentUser.name
      );
      onEmergencyStateUpdated(state, updatedUsers);
      setFeedback({
        type: "warning",
        message: `🚨 MODO DE EMERGÊNCIA ATIVADO! ${state.lockedUserIds.length} conta(s) ativa(s) foram bloqueadas temporariamente (exceto ADM).`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDeactivateEmergency = async () => {
    setIsProcessing(true);
    try {
      const { updatedUsers, state, restoredCount } =
        await deactivateEmergencyMaintenanceLock(users);
      onEmergencyStateUpdated(state, updatedUsers);
      setFeedback({
        type: "success",
        message: `🟢 Modo de Emergência encerrado! ${restoredCount} conta(s) bloqueada(s) pelo botão retornaram ao status ATIVO.`,
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetFullSystem = async () => {
    const confirmed = window.confirm(
      "ATENÇÃO: Isso apagará todos os eventos, clientes e equipe, mantendo apenas a conta padrão Administrador Da Hora (admin@churrascodahora.com). Deseja continuar?"
    );
    if (!confirmed) return;

    setIsProcessing(true);
    try {
      const cleanData = await resetDatabaseToAdminOnly();
      onDatasetRestoredOrReset({
        ...cleanData,
        backupLogs: [],
      });
      setFeedback({
        type: "warning",
        message:
          "Sistema resetado para o padrão de fábrica (apenas Administrador Da Hora mantido).",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <FeedbackBanner
          type={feedback.type}
          message={feedback.message}
          onDismiss={() => setFeedback(null)}
        />
      )}

      {/* Emergency / Maintenance Mode Container (Card #45) */}
      <div
        className={`rounded-2xl border p-6 space-y-4 ${
          emergencyState.active
            ? "bg-red-950/30 border-red-500/50"
            : "bg-[#111726] border-slate-800"
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-red-400">
              Controle de Crise & Manutenção (Card #45)
            </span>
            <h2 className="text-lg font-black text-white">
              {emergencyState.active
                ? "🚨 MODO DE EMERGÊNCIA ATIVO — ACESSO RESTRITO AO ADM"
                : "🛡️ Botão de Emergência / Manutenção Seletiva"}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Bloqueia instantaneamente todos os usuários ATIVOS no momento
              (exceto ADM) e guarda seus IDs para devolver o status ATIVO apenas
              a eles no desbloqueio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {!emergencyState.active ? (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleActivateEmergency}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-black text-xs shadow-lg"
              >
                🚨 Ativar Botão de Emergência (Bloquear Ativos)
              </button>
            ) : (
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleDeactivateEmergency}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg"
              >
                🟢 Desbloquear Usuários ({emergencyState.lockedUserIds.length}{" "}
                afetados)
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Backup Export & 1-Click Restore Container (Cards #18, #44) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
              Exportação & Ponto de Restauração
            </span>
            <h3 className="text-base font-black text-white">
              Gerar Novo Backup (.JSON ou .SQL)
            </h3>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Escopo de Dados
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value as BackupScope)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="Completo">Completo (Usuários + Eventos)</option>
                <option value="Usuários">Apenas Usuários & Equipe</option>
                <option value="Eventos">Apenas Eventos</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-300 mb-1">
                Formato do Arquivo
              </label>
              <select
                value={format}
                onChange={(e) => setFormat(e.target.value as BackupFormat)}
                className="w-full min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white"
              >
                <option value="JSON">JSON Estruturado</option>
                <option value="SQL">Script SQL (PostgreSQL)</option>
              </select>
            </div>
          </div>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExportBackup}
            className="w-full min-h-[44px] px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs"
          >
            ⬇️ Exportar Backup e Criar Snapshot de Restore
          </button>
        </div>

        <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-4 flex flex-col justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
              Recuperação de Desastres (Cards #18, #44)
            </span>
            <h3 className="text-base font-black text-white">
              Restore do Último Backup & Reset do Sistema
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              {lastSnapshot
                ? `Último snapshot disponível: #${lastSnapshot.id} salvo em ${lastSnapshot.savedAtGmt3} por ${lastSnapshot.savedBy}.`
                : "Exporte um backup ao lado para gravar o primeiro snapshot de restauração."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isProcessing}
              onClick={handleRestoreLastBackup}
              className="flex-1 min-h-[44px] px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs"
            >
              🔄 Restaurar Último Backup (#44)
            </button>

            <button
              type="button"
              disabled={isProcessing || backupLogs.length === 0}
              onClick={handleDeleteLastBackupLog}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-amber-300 border border-slate-700 font-bold text-xs"
            >
              Excluir último backup
            </button>

            <button
              type="button"
              disabled={isProcessing}
              onClick={handleResetFullSystem}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs"
            >
              Resetar sistema (#18)
            </button>
          </div>
        </div>
      </div>

      {/* Audit History Table */}
      <div className="bg-[#111726] border border-slate-800 rounded-2xl p-6 space-y-3">
        <h3 className="text-base font-black text-white">
          Histórico de Backups Exportados ({backupLogs.length})
        </h3>
        {backupLogs.length === 0 ? (
          <p className="text-xs text-slate-400">
            Nenhum backup registrado até o momento.
          </p>
        ) : (
          <div className="space-y-2">
            {backupLogs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex items-center justify-between text-xs"
              >
                <div>
                  <strong className="text-amber-300">#{log.id}</strong> · Escopo:{" "}
                  <strong className="text-white">{log.scope}</strong> ({log.format}
                  )
                </div>
                <div className="text-slate-400">
                  {log.exportedAtGmt3} · por {log.exportedBy}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}