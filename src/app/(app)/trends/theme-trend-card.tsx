"use client";

import Link from "next/link";
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ThemeTrend } from "@/lib/trends";
import { Card } from "@/components/ui/card";
import { TrendBadge } from "@/components/ui/badge";

function formatWeek(weekStart: string): string {
  return new Date(`${weekStart}T00:00:00Z`).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const WEEKS_SHOWN = 8;

/**
 * get_theme_trend only returns weeks that had feedback, so a plain bar chart
 * would silently drop empty weeks and make e.g. "3 items, then nothing for a
 * month, then 3" look like steady volume. Lays the counts onto the last 8
 * calendar weeks (Monday starts, matching Postgres' date_trunc('week')).
 */
function fillWeeks(weeks: ThemeTrend["weeks"]): { week: string; count: number }[] {
  const counts = new Map(weeks.map((w) => [w.weekStart.slice(0, 10), w.count]));
  const now = new Date();
  const monday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  monday.setUTCDate(monday.getUTCDate() - ((monday.getUTCDay() + 6) % 7));

  const result: { week: string; count: number }[] = [];
  for (let i = WEEKS_SHOWN - 1; i >= 0; i--) {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() - i * 7);
    const key = d.toISOString().slice(0, 10);
    result.push({ week: formatWeek(key), count: counts.get(key) ?? 0 });
  }
  return result;
}

export function ThemeTrendCard({
  themeId,
  name,
  trend,
}: {
  themeId: string;
  name: string | null;
  trend: ThemeTrend;
}) {
  const chartData = trend.weeks.length === 0 ? [] : fillWeeks(trend.weeks);

  return (
    <Card interactive className="p-4">
      <div className="flex items-center justify-between">
        <Link
          href={`/dashboard?theme=${themeId}`}
          className="font-medium text-foreground transition-colors hover:text-primary"
        >
          {name ?? <span className="italic text-muted-foreground">Unlabeled theme</span>}
        </Link>
        <TrendBadge direction={trend.direction} />
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {trend.recentTotal} in the last 2 weeks, {trend.priorTotal} the 2 weeks before
        {trend.percentChange !== null && ` (${trend.percentChange > 0 ? "+" : ""}${trend.percentChange}%)`}
      </p>
      <div className="mt-3 h-32">
        {chartData.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
            No feedback in the last 8 weeks
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={{ stroke: "var(--color-border-strong)" }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                axisLine={false}
                tickLine={false}
                width={28}
              />
              <Tooltip
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  fontSize: 12,
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-surface)",
                  color: "var(--color-foreground)",
                }}
              />
              <Bar dataKey="count" fill="var(--color-primary)" radius={[4, 4, 0, 0]} maxBarSize={24} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </Card>
  );
}
