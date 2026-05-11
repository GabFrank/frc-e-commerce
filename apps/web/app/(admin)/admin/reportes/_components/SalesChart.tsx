'use client';

import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useState } from 'react';

type Point = {
  bucket: string;
  bucketLabel: string;
  total: number;
  count: number;
};

const fmt = (n: number) => n.toLocaleString('es-PY');

export function SalesChart({ data }: { data: Point[] }) {
  const [mode, setMode] = useState<'total' | 'count'>('total');
  const hasData = data.length > 0;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-medium">
          {mode === 'total' ? 'Ventas netas por período' : 'Tickets por período'}
        </h3>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => setMode('total')}
            className={`rounded px-2 py-1 text-xs ${
              mode === 'total'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Ventas
          </button>
          <button
            type="button"
            onClick={() => setMode('count')}
            className={`rounded px-2 py-1 text-xs ${
              mode === 'count'
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Tickets
          </button>
        </div>
      </div>

      <div className="h-72 w-full">
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Sin ventas en el período seleccionado
          </div>
        ) : mode === 'total' ? (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="fillTotal" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="currentColor" stopOpacity={0.4} className="text-primary" />
                  <stop offset="100%" stopColor="currentColor" stopOpacity={0} className="text-primary" />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="bucketLabel" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
              <YAxis tickFormatter={fmt} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} width={70} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value) => [fmt(Number(value)), 'Ventas'] as [string, string]}
              />
              <Area
                type="monotone"
                dataKey="total"
                stroke="currentColor"
                className="text-primary"
                strokeWidth={2}
                fill="url(#fillTotal)"
              />
            </AreaChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
              <XAxis dataKey="bucketLabel" tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke="currentColor" strokeOpacity={0.4} width={40} />
              <Tooltip
                contentStyle={{ fontSize: 12 }}
                formatter={(value) => [String(value), 'Tickets'] as [string, string]}
              />
              <Line
                type="monotone"
                dataKey="count"
                stroke="currentColor"
                className="text-primary"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
