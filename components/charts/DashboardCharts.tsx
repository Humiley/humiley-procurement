"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from "recharts";

/** §10-G brand charts — navy #205090 / emerald #00B060 + tints only. */
const NAVY = "#205090";
const EMERALD = "#00B060";
const TINTS = [NAVY, EMERALD, "#5378AC", "#4DC88F", "#8FA7C7", "#99DFBF", "#BFCCDE", "#CCEFDF"];

const fmt = (v: number) => (v >= 1_000_000 ? `${Math.round(v / 1_000_000)}M` : v >= 1000 ? `${Math.round(v / 1000)}k` : String(v));
const fmtFull = (v: number) => `${Number(v).toLocaleString("en-US")} ₫`;

export function SpendTrendChart({ data }: { data: { month: string; spend: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="spendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={NAVY} stopOpacity={0.25} />
            <stop offset="100%" stopColor={NAVY} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" />
        <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#5C6470" }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#5C6470" }} width={44} />
        <Tooltip formatter={(v) => fmtFull(Number(v))} />
        <Area type="monotone" dataKey="spend" stroke={NAVY} strokeWidth={2} fill="url(#spendFill)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

export function CategoryDonut({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2} label={(e) => e.name}>
          {data.map((_, i) => (
            <Cell key={i} fill={TINTS[i % TINTS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(v) => fmtFull(Number(v))} />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function DeptBarChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E5E9F0" />
        <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#5C6470" }} />
        <YAxis tickFormatter={fmt} tick={{ fontSize: 11, fill: "#5C6470" }} width={44} />
        <Tooltip formatter={(v) => fmtFull(Number(v))} />
        <Bar dataKey="value" fill={EMERALD} radius={[4, 4, 0, 0]} maxBarSize={42} />
      </BarChart>
    </ResponsiveContainer>
  );
}
