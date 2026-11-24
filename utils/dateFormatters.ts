// utils/dateFormatters.ts
import { MONTH_NAMES_PT } from "../config/themeTokens";

/**
 * Formats a "YYYY-MM" string into a human-readable Portuguese label (e.g., "Novembro de 2026").
 */
export function formatYearMonthLabel(yearMonth: string): string {
  const [year, month] = yearMonth.split("-");
  const foundMonth = MONTH_NAMES_PT.find((item) => item.num === month);
  return foundMonth ? `${foundMonth.name} de ${year}` : yearMonth;
}

/**
 * Formats an ISO timestamp or YYYY-MM-DD date into pt-BR format (DD/MM/YYYY).
 */
export function formatIsoDatePtBr(isoOrDate?: string): string {
  if (!isoOrDate) return "18/11/2026";
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) {
    return isoOrDate.split("-").reverse().join("/");
  }
  const parsedDate = new Date(isoOrDate);
  if (isNaN(parsedDate.getTime())) return isoOrDate;
  return parsedDate.toLocaleDateString("pt-BR");
}

/**
 * Calculates the cleanup window end time (+1 hour after event endTime).
 */
export function calculateCleanupEndTime(endTime: string): string {
  const [hours, minutes] = (endTime || "21:00").split(":").map(Number);
  if (isNaN(hours) || isNaN(minutes)) return "22:00";
  const nextHour = (hours + 1) % 24;
  return `${String(nextHour).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * Steps a "YYYY-MM" string forward or backward by `deltaMonths`.
 */
export function stepYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yearStr, monthStr] = yearMonth.split("-");
  const year = Number(yearStr || 2026);
  const month = Number(monthStr || 11);
  const targetDate = new Date(year, month - 1 + deltaMonths, 1);
  return `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Returns the number of days and the starting weekday (0 = Sunday) for a given "YYYY-MM".
 */
export function getCalendarMonthGeometry(yearMonth: string): {
  daysInMonth: number;
  firstWeekday: number;
} {
  const [year, month] = yearMonth.split("-").map(Number);
  const safeYear = year || 2026;
  const safeMonth = month || 11;
  return {
    daysInMonth: new Date(safeYear, safeMonth, 0).getDate(),
    firstWeekday: new Date(safeYear, safeMonth - 1, 1).getDay(),
  };
}