"use client";

import { createContext, useContext, useState, useEffect, useCallback } from "react";

// Atalhos de período
export type PeriodPreset =
  | "today" | "yesterday" | "this_week" | "this_month" | "last_month"
  | "last_7" | "last_14" | "last_30" | "custom";

export const PRESET_LABELS: Record<PeriodPreset, string> = {
  today: "Hoje",
  yesterday: "Ontem",
  this_week: "Esta semana",
  this_month: "Este mês",
  last_month: "Mês passado",
  last_7: "Últimos 7 dias",
  last_14: "Últimos 14 dias",
  last_30: "Últimos 30 dias",
  custom: "Personalizado",
};

function getPresetDates(preset: PeriodPreset): { start: Date; end: Date } {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = new Date(today); y.setDate(y.getDate() - 1);
      return { start: y, end: y };
    }
    case "this_week": {
      const day = today.getDay();
      const diff = day === 0 ? 6 : day - 1; // segunda = início
      const start = new Date(today); start.setDate(start.getDate() - diff);
      return { start, end: today };
    }
    case "this_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
    case "last_month":
      return {
        start: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        end: new Date(now.getFullYear(), now.getMonth(), 0),
      };
    case "last_7": {
      const s = new Date(today); s.setDate(s.getDate() - 6);
      return { start: s, end: today };
    }
    case "last_14": {
      const s = new Date(today); s.setDate(s.getDate() - 13);
      return { start: s, end: today };
    }
    case "last_30": {
      const s = new Date(today); s.setDate(s.getDate() - 29);
      return { start: s, end: today };
    }
    case "custom":
    default:
      return {
        start: new Date(now.getFullYear(), now.getMonth(), 1),
        end: new Date(now.getFullYear(), now.getMonth() + 1, 0),
      };
  }
}

interface DateRangeState {
  startDate: Date;
  endDate: Date;
  preset: PeriodPreset;
  label: string;
  setRange: (start: Date, end: Date, preset?: PeriodPreset) => void;
  setPreset: (preset: PeriodPreset) => void;
  // Strings formatadas para query params
  startStr: string;
  endStr: string;
}

const DateRangeContext = createContext<DateRangeState | null>(null);

const STORAGE_KEY = "financeos_period";

function toDateStr(d: Date): string {
  return d.toISOString().split("T")[0];
}

function formatLabel(start: Date, end: Date, preset: PeriodPreset): string {
  if (preset !== "custom") return PRESET_LABELS[preset];
  const fmt = new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" });
  return `${fmt.format(start)} – ${fmt.format(end)}`;
}

export function DateRangeProvider({ children }: { children: React.ReactNode }) {
  const [startDate, setStartDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [endDate, setEndDate] = useState<Date>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth() + 1, 0);
  });
  const [preset, setPresetState] = useState<PeriodPreset>("this_month");

  // Restaurar do localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const { preset: p, start, end } = JSON.parse(saved);
        if (p && p !== "custom") {
          const dates = getPresetDates(p);
          setStartDate(dates.start);
          setEndDate(dates.end);
          setPresetState(p);
        } else if (start && end) {
          setStartDate(new Date(start));
          setEndDate(new Date(end));
          setPresetState("custom");
        }
      }
    } catch { /* localStorage indisponível */ }
  }, []);

  // Persistir no localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        preset,
        start: toDateStr(startDate),
        end: toDateStr(endDate),
      }));
    } catch { /* localStorage indisponível */ }
  }, [startDate, endDate, preset]);

  const setRange = useCallback((start: Date, end: Date, p: PeriodPreset = "custom") => {
    setStartDate(start);
    setEndDate(end);
    setPresetState(p);
  }, []);

  const setPreset = useCallback((p: PeriodPreset) => {
    const dates = getPresetDates(p);
    setStartDate(dates.start);
    setEndDate(dates.end);
    setPresetState(p);
  }, []);

  return (
    <DateRangeContext.Provider value={{
      startDate, endDate, preset,
      label: formatLabel(startDate, endDate, preset),
      setRange, setPreset,
      startStr: toDateStr(startDate),
      endStr: toDateStr(endDate),
    }}>
      {children}
    </DateRangeContext.Provider>
  );
}

export function useDateRange() {
  const ctx = useContext(DateRangeContext);
  if (!ctx) throw new Error("useDateRange fora do DateRangeProvider");
  return ctx;
}

export { getPresetDates };
