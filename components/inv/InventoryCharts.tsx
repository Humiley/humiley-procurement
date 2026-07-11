"use client";

import { useTranslations } from "next-intl";
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from "recharts";

export type Slice = { name: string; value: number };
export type TrendPoint = { month: string; in: number; out: number };

const PALETTE = ["#205090", "#00B060", "#4d85cf", "#2fce8a", "#8B5CF6", "#F59E0B", "#0D9488", "#64748B"];

const vndCompact = (v: number) => new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(v) + " ₫";
const vndFull = (v: number) => Math.round(v).toLocaleString("en-US") + " ₫";

/** Inventory analytics — stock value by category & warehouse + 6-month movement trend (recharts). */
export function InventoryCharts({ byCategory, byWarehouse, trend }: { byCategory: Slice[]; byWarehouse: Slice[]; trend: TrendPoint[] }) {
  const t = useTranslations("inventory");
  const hasCat = byCategory.some((s) => s.value > 0);
  const hasWh = byWarehouse.some((s) => s.value > 0);
  const hasTrend = trend.some((p) => p.in > 0 || p.out > 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Stock value by category — donut */}
        <div className="card p-4">
          <h3 className="label mb-2">{t("chartByCategory")}</h3>
          {hasCat ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={byCategory} dataKey="value" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2} stroke="none">
                    {byCategory.map((_, i) => (
                      <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => vndFull(Number(v))} />
                  <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-grey">{t("empty")}</p>
          )}
        </div>

        {/* Stock value by warehouse — bar */}
        <div className="card p-4">
          <h3 className="label mb-2">{t("chartByWarehouse")}</h3>
          {hasWh ? (
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byWarehouse} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#5c6470" }} tickLine={false} axisLine={{ stroke: "#dbe1ee" }} />
                  <YAxis tickFormatter={vndCompact} tick={{ fontSize: 11, fill: "#5c6470" }} tickLine={false} axisLine={false} width={64} />
                  <Tooltip formatter={(v) => vndFull(Number(v))} cursor={{ fill: "rgba(32,80,144,0.05)" }} />
                  <Bar dataKey="value" fill="#205090" radius={[6, 6, 0, 0]} maxBarSize={54} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-grey">{t("empty")}</p>
          )}
        </div>
      </div>

      {/* 6-month movement trend — grouped bars */}
      <div className="card p-4">
        <h3 className="label mb-2">{t("chartMovementTrend")}</h3>
        {hasTrend ? (
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trend} margin={{ top: 8, right: 8, left: 4, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef2f8" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#5c6470" }} tickLine={false} axisLine={{ stroke: "#dbe1ee" }} />
                <YAxis tickFormatter={vndCompact} tick={{ fontSize: 11, fill: "#5c6470" }} tickLine={false} axisLine={false} width={64} />
                <Tooltip formatter={(v) => vndFull(Number(v))} cursor={{ fill: "rgba(32,80,144,0.05)" }} />
                <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="in" name={t("movementIn")} fill="#00B060" radius={[5, 5, 0, 0]} maxBarSize={30} />
                <Bar dataKey="out" name={t("movementOut")} fill="#205090" radius={[5, 5, 0, 0]} maxBarSize={30} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <p className="py-16 text-center text-sm text-grey">{t("noMovements")}</p>
        )}
      </div>
    </div>
  );
}
