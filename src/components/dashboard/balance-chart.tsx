"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import { formatCurrency } from "@/lib/utils";

interface BalanceChartProps {
  data: Array<{ date: string; balance: number }>;
}

// Gráfico de evolução do saldo (Recharts LineChart)
export function BalanceChart({ data }: BalanceChartProps) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
        <XAxis
          dataKey="date"
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(value: string) => {
            const [, month, day] = value.split("-");
            return `${day}/${month}`;
          }}
          interval="preserveStartEnd"
        />
        <YAxis
          stroke="#64748b"
          fontSize={12}
          tickFormatter={(value: number) =>
            new Intl.NumberFormat("pt-BR", {
              notation: "compact",
              compactDisplay: "short",
              style: "currency",
              currency: "BRL",
            }).format(value)
          }
          width={80}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "#0f172a",
            border: "1px solid #1e293b",
            borderRadius: "8px",
            color: "#f8fafc",
          }}
          labelFormatter={(label) => {
            const parts = String(label).split("-");
            return `${parts[2]}/${parts[1]}/${parts[0]}`;
          }}
          formatter={(value) => [formatCurrency(Number(value)), "Saldo"]}
        />
        <Line
          type="monotone"
          dataKey="balance"
          stroke="#10b981"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4, fill: "#10b981" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
