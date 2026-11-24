// components/modals/ApiHealthMonitorModal.tsx
"use client";

import React from "react";
import { ApiHealthStatus } from "../../models/governance.model";

export interface ApiHealthMonitorModalProps {
  isOpen: boolean;
  isLoading: boolean;
  apiStatuses: ApiHealthStatus[];
  onRefresh: () => void;
  onClose: () => void;
}

/**
 * Detailed modal displaying real-time health, latency (ms), and uptime for the 4 core system APIs (Card #43).
 */
export function ApiHealthMonitorModal({
  isOpen,
  isLoading,
  apiStatuses,
  onRefresh,
  onClose,
}: ApiHealthMonitorModalProps) {
  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="api-health-modal-title"
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4"
    >
      <div className="bg-[#111726] border border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-emerald-400">
              Telemetria de Infraestrutura · Tempo Real
            </span>
            <h2
              id="api-health-modal-title"
              className="text-lg font-black text-white mt-0.5"
            >
              Status de Funcionamento das APIs e Serviços
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-bold border border-slate-700"
          >
            Fechar ✕
          </button>
        </div>

        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
          {apiStatuses.map((api) => {
            const badgeStyle =
              api.status === "ONLINE"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/40"
                : api.status === "ALERTA"
                ? "bg-amber-500/15 text-amber-300 border-amber-500/40"
                : "bg-red-500/15 text-red-300 border-red-500/40";

            return (
              <div
                key={api.id}
                className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-col gap-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-black text-white">{api.name}</h3>
                    <p className="text-[11px] text-slate-400">
                      {api.provider} · <code className="text-amber-300">{api.endpoint}</code>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-slate-300 bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800">
                      {api.latencyMs} ms
                    </span>
                    <span
                      className={`text-[11px] font-black px-2.5 py-1 rounded-full border ${badgeStyle}`}
                    >
                      ● {api.status}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>{api.detail}</span>
                  <span>
                    Uptime: <strong className="text-emerald-300">{api.uptimePercent}</strong> ·{" "}
                    {api.checkedAtGmt3}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            type="button"
            disabled={isLoading}
            onClick={onRefresh}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-black text-xs transition-colors"
          >
            {isLoading ? "Verificando latência..." : "🔄 Revalidar APIs agora"}
          </button>
        </div>
      </div>
    </div>
  );
}