'use client';

import Link from 'next/link';
import { RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { usePoDraft } from './usePoDraft';

export function LocalDraftBanner({ scopeKey }: { scopeKey: string }) {
  const { draftFound, clear } = usePoDraft(scopeKey);

  if (!draftFound) return null;

  const lineCount = draftFound.lines.length;
  const unitCount = draftFound.lines.reduce((acc, l) => acc + (l.quantity || 0), 0);
  const savedAt = new Date(draftFound.savedAt).toLocaleString('es-PY', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: 'short',
  });

  return (
    <div className="flex flex-col items-start gap-2 rounded-md border-2 border-primary/40 bg-primary/5 px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="font-medium">Tenés un borrador local sin enviar</p>
        <p className="text-xs text-muted-foreground">
          {savedAt} · {lineCount} {lineCount === 1 ? 'línea' : 'líneas'}
          {lineCount > 0 && ` (${unitCount}u)`}
        </p>
      </div>
      <div className="flex gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={clear}>
          <X className="mr-1 h-3.5 w-3.5" /> Descartar
        </Button>
        <Button type="button" size="sm" asChild>
          <Link href="/admin/compras/nueva">
            <RotateCcw className="mr-1 h-3.5 w-3.5" /> Continuar editando
          </Link>
        </Button>
      </div>
    </div>
  );
}
