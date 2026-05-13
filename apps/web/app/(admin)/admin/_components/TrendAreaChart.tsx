'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAmount, getCurrencyDecimalPlaces } from '@frc-e-commerce/shared-utils';

type Point = { date: string; label: string; total: number };

/** Area chart compacto h-40 con gradient violet. Total ya viene en MAJOR units. */
export function TrendAreaChart({
  data,
  currency,
}: {
  data: Point[];
  currency: string;
}) {
  if (data.length === 0 || data.every((d) => d.total === 0)) {
    return (
      <div className="flex h-40 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
        Sin ventas en los últimos 14 días
      </div>
    );
  }

  const dp = getCurrencyDecimalPlaces(currency);
  const formatY = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace('.', ',')}M`;
    if (Math.abs(v) >= 1_000) return `${Math.round(v / 1_000)}K`;
    return v.toFixed(dp).replace('.', ',');
  };

  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
          <defs>
            <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity={0.35} />
              <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="currentColor"
            strokeOpacity={0.08}
            vertical={false}
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={20}
          />
          <YAxis
            tickFormatter={formatY}
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            tickLine={false}
            axisLine={false}
            width={48}
          />
          <Tooltip
            contentStyle={{ fontSize: 12, borderRadius: 8 }}
            formatter={(value) => [formatAmount(Number(value), currency), 'Ventas']}
            labelFormatter={(l) => String(l)}
          />
          <Area
            type="monotone"
            dataKey="total"
            stroke="currentColor"
            strokeWidth={2}
            className="text-primary"
            fill="url(#trendGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
