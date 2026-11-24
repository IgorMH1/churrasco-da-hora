// components/layout/PortalHeader.tsx
"use client";

import React from "react";
import { UserAccount } from "../../models/user.model";
import { getCorporateIdentityInfo } from "../../services/corporateIdentity.service";
import { getAvatarInitials } from "../../utils/stringFormatters";

export interface PortalNavigationTab {
  id: string;
  label: string;
  badgeCount?: number;
}

export interface PortalHeaderProps {
  portalTitle: string;
  portalSubtitle: string;
  currentUser: UserAccount;
  tabs: PortalNavigationTab[];
  activeTabId: string;
  onSelectTab: (tabId: string) => void;
  onLogout: () => void;
  extraRightActions?: React.ReactNode;
}

/**
 * Standardized modular container header with corporate identity badge and accessible navigation tabs (Cards #47, #50).
 */
export function PortalHeader({
  portalTitle,
  portalSubtitle,
  currentUser,
  tabs,
  activeTabId,
  onSelectTab,
  onLogout,
  extraRightActions,
}: PortalHeaderProps) {
  const corporateInfo = getCorporateIdentityInfo(currentUser);
  const initials = getAvatarInitials(currentUser.name);

  return (
    <header className="bg-[#111726]/95 border-b border-slate-800/90 sticky top-0 z-30 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-300 font-black text-base shadow-inner">
              {initials}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  {corporateInfo.corporateCode}
                </span>
                <span className="text-[11px] font-semibold text-slate-400">
                  {corporateInfo.clearanceLevel}
                </span>
              </div>
              <h1 className="text-lg sm:text-xl font-black text-white tracking-tight mt-0.5">
                {portalTitle}
              </h1>
              <p className="text-xs text-slate-400">{portalSubtitle}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {extraRightActions}
            <div className="hidden md:flex flex-col items-end px-3 py-1.5 rounded-xl bg-slate-900/90 border border-slate-800">
              <span className="text-xs font-bold text-slate-200">
                {currentUser.name}
              </span>
              <span className="text-[11px] text-slate-400">
                {corporateInfo.unitDepartment}
              </span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400"
            >
              Sair da sessão
            </button>
          </div>
        </div>

        <nav
          aria-label="Navegação principal do portal"
          className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-thin"
        >
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            return (
              <button
                key={tab.id}
                type="button"
                aria-current={isActive ? "page" : undefined}
                onClick={() => onSelectTab(tab.id)}
                className={`min-h-[44px] px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                  isActive
                    ? "bg-amber-500 text-slate-950 font-black shadow-md shadow-amber-500/10"
                    : "bg-slate-900/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-800"
                }`}
              >
                <span>{tab.label}</span>
                {typeof tab.badgeCount === "number" && (
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                      isActive
                        ? "bg-slate-950/20 text-slate-950"
                        : "bg-slate-800 text-amber-300"
                    }`}
                  >
                    {tab.badgeCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
}