"use client";

import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from "recharts";
import { formatCurrency } from "@/lib/utils";
import { CATEGORY_TOOLTIPS } from "@/lib/categories";

interface CategoryChartProps {
  data: Array<{ category: string; total: number }>;
}

const COLORS = [
  "#10b981", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
];

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max) + "…" : text;
}

// Gráfico de gastos por categoria (PieChart Recharts)
export function CategoryChart({ data }: CategoryChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-slate-500">Sem dados de gastos para exibir</p>
      </div>
    );
  }

  const grandTotal = data.reduce((s, d) => s + d.total, 0);

  return (
    <ResponsiveContainer width="100%" height={350}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={70}
          outerRadius={120}
          paddingAngle={2}
          dataKey="total"
          nameKey="category"
          label={({ name, percent }) =>
            `${truncate(String(name), 20)} (${((percent || 0) * 100).toFixed(0)}%)`
          }
          labelLine={{ stroke: "#475569" }}
        >
          {data.map((_, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
              stroke="transparent"
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            color: "#f8fafc",
            maxWidth: "320px",
          }}
          formatter={(value, name) => {
            const numValue = Number(value);
            const pct = grandTotal > 0 ? ((numValue / grandTotal) * 100).toFixed(1) : "0";
            const tooltip = CATEGORY_TOOLTIPS[String(name)];
            return [
              <span key="val">
                <strong>{String(name)}</strong>
                <br />
                {formatCurrency(numValue)} ({pct}%)
                {tooltip && (
                  <span style={{ display: "block", fontSize: "10px", color: "#94a3b8", marginTop: "4px" }}>
                    {tooltip}
                  </span>
                )}
              </span>,
              "",
            ];
          }}
        />
        <Legend
          wrapperStyle={{ color: "#94a3b8", fontSize: "12px" }}
          formatter={(value) => truncate(String(value), 25)}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
