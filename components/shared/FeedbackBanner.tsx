// components/shared/FeedbackBanner.tsx
"use client";

import React from "react";

export interface FeedbackBannerProps {
  type: "success" | "error" | "warning" | "info";
  message: string;
  onDismiss?: () => void;
}

const BANNER_STYLE_MAP: Record<FeedbackBannerProps["type"], string> = {
  success: "bg-emerald-500/15 border-emerald-500/40 text-emerald-200",
  error: "bg-red-500/15 border-red-500/40 text-red-200",
  warning: "bg-amber-500/15 border-amber-500/40 text-amber-200",
  info: "bg-sky-500/15 border-sky-500/40 text-sky-200",
};

/**
 * Accessible alert banner for operation feedback (WCAG 2.2 AA).
 */
export function FeedbackBanner({
  type,
  message,
  onDismiss,
}: FeedbackBannerProps) {
  if (!message) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`rounded-2xl border px-4 py-3 text-xs font-semibold flex items-center justify-between gap-3 ${BANNER_STYLE_MAP[type]}`}
    >
      <span>{message}</span>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Fechar aviso"
          className="min-h-[36px] px-2.5 py-1 rounded-lg bg-slate-950/30 hover:bg-slate-950/50 text-[11px] font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          ✕
        </button>
      )}
    </div>
  );
}