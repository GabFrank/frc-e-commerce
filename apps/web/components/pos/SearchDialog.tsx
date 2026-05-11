'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import Image from 'next/image';
import { Loader2, Package } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { posSearchProducts, type PosSearchResultProduct, type PosVariantOption } from '@/lib/actions/pos-search';
import type { PosTenantContext } from './PosShell';

const DEBOUNCE_MS = 150;
const SCAN_THRESHOLD_MS = 50;
const SCAN_MIN_CHARS = 8;

type Props = {
  ctx: PosTenantContext;
  onClose: () => void;
  onPick: (productId: string, productName: string, single: PosVariantOption | null) => void;
};

export function SearchDialog({ ctx, onClose, onPick }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PosSearchResultProduct[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const lastKeystrokeRef = useRef<number>(0);
  const charsBufferRef = useRef<string>('');

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(() => {
      startTransition(async () => {
        const res = await posSearchProducts({ query, limit: 20 });
        if (res.ok) {
          setResults(res.results);
          setSelectedIdx(0);
        }
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [query]);

  // Scan detector: si entran muchos chars rápido y termina con Enter, asume scan y dispara directo
  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    const now = Date.now();
    if (now - lastKeystrokeRef.current < SCAN_THRESHOLD_MS) {
      charsBufferRef.current += v.slice(charsBufferRef.current.length);
    } else {
      charsBufferRef.current = v;
    }
    lastKeystrokeRef.current = now;
    setQuery(v);
  };

  const onKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      // Si parece scan: chars rapidos y suficientes
      const isLikelyScan =
        charsBufferRef.current.length >= SCAN_MIN_CHARS &&
        Date.now() - lastKeystrokeRef.current < 200;
      if (isLikelyScan && results.length > 0 && results[0]) {
        const top = results[0];
        onPick(top.productId, top.name, top.singleVariant);
        return;
      }
      const r = results[selectedIdx];
      if (r) onPick(r.productId, r.name, r.singleVariant);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Buscar producto</DialogTitle>
        </DialogHeader>
        <Input
          ref={inputRef}
          value={query}
          onChange={onChange}
          onKeyDown={onKeyDown}
          placeholder="Nombre, SKU o escaneá un código..."
          className="h-11"
          autoComplete="off"
        />
        <div className="flex-1 overflow-y-auto rounded-md border bg-card">
          {pending && results.length === 0 && (
            <div className="flex items-center justify-center p-8 text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Buscando…
            </div>
          )}
          {!pending && query && results.length === 0 && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Sin resultados para “{query}”
            </div>
          )}
          {!query && (
            <div className="p-6 text-center text-sm text-muted-foreground">
              Empezá a escribir o escaneá un código...
            </div>
          )}
          <div className="grid grid-cols-2 gap-2 p-2">
            {results.map((r, i) => (
              <button
                key={r.productId}
                onClick={() => onPick(r.productId, r.name, r.singleVariant)}
                onMouseEnter={() => setSelectedIdx(i)}
                className={`flex gap-3 rounded-md border p-2 text-left transition ${
                  i === selectedIdx ? 'border-primary bg-accent' : 'hover:bg-muted'
                }`}
              >
                {ctx.posConfig.searchShowImages && r.imageUrl ? (
                  <Image
                    src={r.imageUrl}
                    alt={r.name}
                    width={64}
                    height={64}
                    className="h-16 w-16 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded bg-muted text-muted-foreground">
                    <Package className="h-6 w-6" />
                  </div>
                )}
                <div className="flex flex-1 flex-col justify-between text-sm">
                  <div>
                    <div className="font-medium leading-tight">{r.name}</div>
                    {r.singleVariant && (
                      <div className="text-xs text-muted-foreground">
                        SKU: {r.singleVariant.sku} · stock: {r.singleVariant.stock}
                      </div>
                    )}
                    {!r.singleVariant && (
                      <div className="text-xs text-muted-foreground">
                        {r.variantCount} variantes
                      </div>
                    )}
                  </div>
                  <div className="text-sm font-semibold">
                    {(r.singleVariant?.price ?? r.basePrice).toLocaleString('es-PY')}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          ↑↓ navegar · Enter seleccionar · Esc cerrar
        </div>
      </DialogContent>
    </Dialog>
  );
}
