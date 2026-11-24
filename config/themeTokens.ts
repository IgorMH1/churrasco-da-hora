// config/themeTokens.ts
import { EventStatus } from "../models/event.model";
import { UserStatus } from "../models/user.model";

export const MONTH_NAMES_PT = [
  { num: "01", name: "Janeiro" },
  { num: "02", name: "Fevereiro" },
  { num: "03", name: "Março" },
  { num: "04", name: "Abril" },
  { num: "05", name: "Maio" },
  { num: "06", name: "Junho" },
  { num: "07", name: "Julho" },
  { num: "08", name: "Agosto" },
  { num: "09", name: "Setembro" },
  { num: "10", name: "Outubro" },
  { num: "11", name: "Novembro" },
  { num: "12", name: "Dezembro" },
] as const;

export const AVAILABLE_CALENDAR_YEARS = ["2025", "2026", "2027", "2028"] as const;

/**
 * WCAG 2.2 AA compliant semantic badge classes for event statuses.
 */
export const EVENT_STATUS_BADGE_TOKENS: Record<EventStatus, string> = {
  CONFIRMADO: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/40",
  PENDENTE: "bg-orange-500/15 text-orange-300 border border-orange-500/40",
  CANCELADO: "bg-red-500/15 text-red-300 border border-red-500/40",
};

/**
 * WCAG 2.2 AA compliant semantic badge classes for user account statuses.
 */
export const USER_STATUS_BADGE_TOKENS: Record<UserStatus, string> = {
  ATIVO: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  BLOQUEADO: "bg-amber-500/20 text-amber-300 border border-amber-500/40",
  INATIVO: "bg-red-500/15 text-red-300 border border-red-500/30",
};