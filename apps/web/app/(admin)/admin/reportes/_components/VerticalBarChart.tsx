'use client';

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  LabelList,
} from 'recharts';
import { formatNumber } from '@frc-e-commerce/shared-utils';

type Point = { label: string; value: number };

const fmt = (n: number) => formatNumber(n, 0);

/** Barras verticales (columna). Más legibles cuando hay pocos elementos
 *  y deja respirar la altura del card sin agrandar barras. */
export function VerticalBarChart({
  data,
  height = 280,
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
        <BarChart data={data} margin={{ top: 16, right: 16, left: 8, bottom: 32 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            interval={0}
            angle={data.length > 4 ? -25 : 0}
            textAnchor={data.length > 4 ? 'end' : 'middle'}
            height={48}
          />
          <YAxis
            type="number"
            tickFormatter={fmt}
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            width={56}
          />
          <Tooltip
            contentStyle={{ fontSize: 12 }}
            formatter={(value) => [fmt(Number(value)), valueLabel] as [string, string]}
          />
          <Bar
            dataKey="value"
            fill="currentColor"
            className="text-primary"
            radius={[4, 4, 0, 0]}
            maxBarSize={64}
          >
            <LabelList
              dataKey="value"
              position="top"
              formatter={(v: unknown) => (typeof v === 'number' ? fmt(v) : String(v ?? ''))}
              fontSize={11}
            />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
