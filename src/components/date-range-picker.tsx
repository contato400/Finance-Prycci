"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  useDateRange,
  PRESET_LABELS,
  getPresetDates,
  type PeriodPreset,
} from "@/contexts/date-range-context";

const PRESETS: PeriodPreset[] = [
  "today", "yesterday", "this_week", "this_month", "last_month",
  "last_7", "last_14", "last_30", "custom",
];

const WEEKDAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];

// Formata data longa pt-BR
function fmtLong(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "long", year: "numeric" }).format(d);
}

// Formata data curta para o botão
function fmtShort(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short" }).format(d);
}

function fmtYear(d: Date): string {
  return new Intl.DateTimeFormat("pt-BR", { day: "numeric", month: "short", year: "numeric" }).format(d);
}

// Gera dias do mês
function getMonthDays(year: number, month: number) {
  const first = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0).getDate();
  let startDay = first.getDay() - 1; // segunda = 0
  if (startDay < 0) startDay = 6;

  const days: (Date | null)[] = [];
  for (let i = 0; i < startDay; i++) days.push(null);
  for (let d = 1; d <= lastDay; d++) days.push(new Date(year, month, d));
  return days;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d >= start && d <= end;
}

export function DateRangePicker() {
  const { startDate, endDate, preset, label, setRange, setPreset } = useDateRange();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Estado temporário enquanto o picker está aberto
  const [tmpStart, setTmpStart] = useState(startDate);
  const [tmpEnd, setTmpEnd] = useState(endDate);
  const [tmpPreset, setTmpPreset] = useState(preset);
  const [selecting, setSelecting] = useState<"start" | "end">("start");
  const [viewMonth, setViewMonth] = useState(startDate.getMonth());
  const [viewYear, setViewYear] = useState(startDate.getFullYear());

  // Sincronizar ao abrir
  useEffect(() => {
    if (open) {
      setTmpStart(startDate);
      setTmpEnd(endDate);
      setTmpPreset(preset);
      setSelecting("start");
      setViewMonth(startDate.getMonth());
      setViewYear(startDate.getFullYear());
    }
  }, [open, startDate, endDate, preset]);

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function handlePresetClick(p: PeriodPreset) {
    if (p === "custom") {
      setTmpPreset("custom");
      setSelecting("start");
      return;
    }
    const dates = getPresetDates(p);
    setTmpStart(dates.start);
    setTmpEnd(dates.end);
    setTmpPreset(p);
  }

  function handleDayClick(d: Date) {
    if (selecting === "start") {
      setTmpStart(d);
      setTmpEnd(d);
      setSelecting("end");
      setTmpPreset("custom");
    } else {
      if (d < tmpStart) {
        setTmpStart(d);
        setTmpEnd(tmpStart);
      } else {
        setTmpEnd(d);
      }
      setSelecting("start");
      setTmpPreset("custom");
    }
  }

  function handleApply() {
    if (tmpPreset !== "custom") {
      setPreset(tmpPreset);
    } else {
      setRange(tmpStart, tmpEnd, "custom");
    }
    setOpen(false);
  }

  // Navegação de meses
  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  const month1Days = getMonthDays(viewYear, viewMonth);
  const nextM = viewMonth === 11 ? 0 : viewMonth + 1;
  const nextY = viewMonth === 11 ? viewYear + 1 : viewYear;
  const month2Days = getMonthDays(nextY, nextM);

  const monthName = (y: number, m: number) =>
    new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" }).format(new Date(y, m));

  // Label no botão
  const buttonLabel = preset === "custom"
    ? `${fmtShort(startDate)} – ${fmtYear(endDate)}`
    : label;

  return (
    <div className="relative" ref={ref}>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="gap-2 border-slate-700 text-slate-300 hover:text-white"
      >
        <CalendarDays className="h-4 w-4" />
        <span className="hidden sm:inline">{buttonLabel}</span>
        <span className="sm:hidden">{fmtShort(startDate)}</span>
      </Button>

      {open && (
        <Card className="absolute right-0 top-12 z-50 w-[min(90vw,640px)] border-slate-700 bg-slate-900 shadow-2xl">
          <div className="flex flex-col sm:flex-row">
            {/* Coluna esquerda: presets */}
            <div className="border-b border-slate-800 p-3 sm:w-44 sm:border-b-0 sm:border-r">
              <div className="flex flex-wrap gap-1 sm:flex-col sm:gap-0">
                {PRESETS.map((p) => (
                  <button
                    key={p}
                    onClick={() => handlePresetClick(p)}
                    className={cn(
                      "rounded px-3 py-1.5 text-left text-xs transition-colors sm:w-full",
                      tmpPreset === p
                        ? "bg-emerald-500/10 text-emerald-400"
                        : "text-slate-400 hover:bg-slate-800 hover:text-white"
                    )}
                  >
                    {PRESET_LABELS[p]}
                  </button>
                ))}
              </div>
            </div>

            {/* Coluna direita: calendários */}
            <div className="flex-1 p-3">
              {/* Navegação */}
              <div className="mb-2 flex items-center justify-between">
                <button onClick={prevMonth} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div className="flex gap-8 text-xs font-medium text-slate-300">
                  <span className="capitalize">{monthName(viewYear, viewMonth)}</span>
                  <span className="capitalize">{monthName(nextY, nextM)}</span>
                </div>
                <button onClick={nextMonth} className="rounded p-1 text-slate-400 hover:bg-slate-800 hover:text-white">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              {/* Calendários lado a lado */}
              <div className="grid grid-cols-2 gap-4">
                <CalendarGrid days={month1Days} tmpStart={tmpStart} tmpEnd={tmpEnd} onDayClick={handleDayClick} />
                <CalendarGrid days={month2Days} tmpStart={tmpStart} tmpEnd={tmpEnd} onDayClick={handleDayClick} />
              </div>

              {/* Rodapé */}
              <div className="mt-3 flex items-center justify-between border-t border-slate-800 pt-3">
                <p className="text-xs text-slate-500">
                  {fmtLong(tmpStart)} – {fmtLong(tmpEnd)}
                </p>
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={() => setOpen(false)} className="text-slate-400">
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={handleApply} className="bg-emerald-500 text-slate-950 hover:bg-emerald-400">
                    Aplicar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

// Grid de um mês
function CalendarGrid({
  days, tmpStart, tmpEnd, onDayClick,
}: {
  days: (Date | null)[];
  tmpStart: Date;
  tmpEnd: Date;
  onDayClick: (d: Date) => void;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div>
      <div className="mb-1 grid grid-cols-7 gap-0">
        {WEEKDAYS.map((w) => (
          <div key={w} className="py-1 text-center text-[10px] text-slate-600">{w}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0">
        {days.map((d, i) => {
          if (!d) return <div key={`e${i}`} />;

          const isStart = isSameDay(d, tmpStart);
          const isEnd = isSameDay(d, tmpEnd);
          const isInRange = inRange(d, tmpStart, tmpEnd);
          const isToday = isSameDay(d, today);

          return (
            <button
              key={d.toISOString()}
              onClick={() => onDayClick(d)}
              className={cn(
                "relative h-7 text-center text-xs transition-colors",
                isStart || isEnd
                  ? "bg-emerald-500 font-bold text-slate-950"
                  : isInRange
                    ? "bg-emerald-500/15 text-emerald-300"
                    : "text-slate-400 hover:bg-slate-800 hover:text-white",
                isStart && "rounded-l",
                isEnd && "rounded-r",
                isToday && !isStart && !isEnd && "font-bold text-white"
              )}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}
