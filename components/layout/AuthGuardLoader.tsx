// components/layout/AuthGuardLoader.tsx
"use client";

import React from "react";

export interface AuthGuardLoaderProps {
  portalName: string;
}

/**
 * Accessible full-screen loading state displayed while RBAC session permissions are verified (Card #49).
 */
export function AuthGuardLoader({ portalName }: AuthGuardLoaderProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="min-h-screen bg-[#0A0E17] text-slate-100 flex flex-col items-center justify-center p-6"
    >
      <div className="w-12 h-12 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-lg animate-pulse mb-4">
        DH
      </div>
      <p className="text-sm font-bold text-white tracking-wide">
        Verificando credenciais RBAC · {portalName}...
      </p>
      <p className="text-xs text-slate-400 mt-1">
        Proteção de rota e sincronização Supabase Cloud ativas (GMT-3)
      </p>
    </div>
  );
}