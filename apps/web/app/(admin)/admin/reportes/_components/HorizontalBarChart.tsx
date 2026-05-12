'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatNumber } from '@frc-e-commerce/shared-utils';

type Point = { label: string; value: number };

const fmt = (n: number) => formatNumber(n, 0);

export function HorizontalBarChart({
  data,
  height = 320,
  valueLabel = 'Total',
}: {
  data: Point[];
  height?: number;
  valueLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <div
        className="flex items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground"
        style={{ height }}
      >
        Sin datos en el período seleccionado
      </div>
    );
  }
  return (
    <div className="w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 5, right: 16, left: 16, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            type="number"
            tickFormatter={fmt}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <YAxis
            type="category"
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            width={140}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [fmt(Number(value)), valueLabel] as [string, string]}
          />
          <Bar
            dataKey="value"
            fill="currentColor"
            className="text-primary"
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
