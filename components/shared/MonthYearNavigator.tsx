// components/shared/MonthYearNavigator.tsx
"use client";

import React from "react";
import {
  AVAILABLE_CALENDAR_YEARS,
  MONTH_NAMES_PT,
} from "../../config/themeTokens";
import {
  formatYearMonthLabel,
  stepYearMonth,
} from "../../utils/dateFormatters";

export interface MonthYearNavigatorProps {
  selectedYearMonth: string;
  onChangeYearMonth: (nextYearMonth: string) => void;
}

/**
 * Reusable month (01-12) and year (2025-2028) selector bar (Cards #28, #34).
 */
export function MonthYearNavigator({
  selectedYearMonth,
  onChangeYearMonth,
}: MonthYearNavigatorProps) {
  const [currentYear, currentMonth] = selectedYearMonth.split("-");

  return (
    <div className="bg-[#111726] border border-slate-800 rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">
            Período Mensal de Visualização (GMT-3)
          </span>
          <h3 className="text-base font-black text-white">
            {formatYearMonthLabel(selectedYearMonth)}
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              onChangeYearMonth(stepYearMonth(selectedYearMonth, -1))
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            ← Mês anterior
          </button>

          <select
            aria-label="Selecionar ano"
            value={currentYear}
            onChange={(e) =>
              onChangeYearMonth(`${e.target.value}-${currentMonth || "11"}`)
            }
            className="min-h-[44px] px-3 py-2 rounded-xl bg-slate-900 text-white border border-slate-700 text-xs font-bold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            {AVAILABLE_CALENDAR_YEARS.map((year) => (
              <option key={year} value={year}>
                Ano {year}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() =>
              onChangeYearMonth(stepYearMonth(selectedYearMonth, 1))
            }
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 text-xs font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
          >
            Próximo mês →
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-12 gap-1.5">
        {MONTH_NAMES_PT.map((month) => {
          const isSelected = month.num === currentMonth;
          return (
            <button
              key={month.num}
              type="button"
              onClick={() => onChangeYearMonth(`${currentYear}-${month.num}`)}
              className={`min-h-[40px] px-2 py-1.5 rounded-xl text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 ${
                isSelected
                  ? "bg-amber-500 text-slate-950 font-black shadow"
                  : "bg-slate-900/90 text-slate-300 hover:bg-slate-800 border border-slate-800"
              }`}
            >
              {month.name.slice(0, 3)}
            </button>
          );
        })}
      </div>
    </div>
  );
}