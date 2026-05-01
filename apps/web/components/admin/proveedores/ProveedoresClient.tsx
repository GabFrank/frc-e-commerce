'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { upsertSupplier } from '@/lib/actions/supplier';
import type { Supplier } from '@frc-e-commerce/db/schema';

export function ProveedoresClient({ initial }: { initial: Supplier[] }) {
  const [editing, setEditing] = useState<Partial<Supplier> | null>(null);

  return (
    <>
      <div className="flex justify-end">
        <Button onClick={() => setEditing({ name: '', isActive: true })}>
          <Plus className="mr-1 h-4 w-4" /> Nuevo proveedor
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{initial.length} proveedores</CardTitle>
        </CardHeader>
        <CardContent>
          {initial.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin proveedores cargados todavía.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-muted-foreground">
                <tr>
                  <th className="text-left">Nombre</th>
                  <th className="text-left">RUC/Doc</th>
                  <th className="text-left">Contacto</th>
                  <th className="text-left">Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {initial.map((s) => (
                  <tr key={s.id} className="border-t">
                    <td className="py-2 font-medium">{s.name}</td>
                    <td>{s.document ?? <span className="text-muted-foreground">—</span>}</td>
                    <td>
                      {s.contactName ?? '—'}
                      {s.phone && <div className="text-xs text-muted-foreground">{s.phone}</div>}
                    </td>
                    <td>
                      {s.isActive ? (
                        <span className="rounded bg-green-100 px-1.5 py-0.5 text-xs text-green-900">
                          activo
                        </span>
                      ) : (
                        <span className="rounded bg-muted px-1.5 py-0.5 text-xs">inactivo</span>
                      )}
                    </td>
                    <td className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => setEditing(s)}>
                        Editar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {editing && (
        <SupplierEditDialog initial={editing} onClose={() => setEditing(null)} />
      )}
    </>
  );
}

function SupplierEditDialog({
  initial,
  onClose,
}: {
  initial: Partial<Supplier>;
  onClose: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    id: initial.id,
    name: initial.name ?? '',
    document: initial.document ?? '',
    contactName: initial.contactName ?? '',
    phone: initial.phone ?? '',
    email: initial.email ?? '',
    notes: initial.notes ?? '',
    isActive: initial.isActive ?? true,
  });

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await upsertSupplier(form);
      if (!res.ok) setError(res.error);
      else onClose();
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{form.id ? 'Editar proveedor' : 'Nuevo proveedor'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={onSave} className="space-y-3">
          <Input
            placeholder="Nombre"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            required
          />
          <Input
            placeholder="RUC / Documento"
            value={form.document}
            onChange={(e) => setForm((f) => ({ ...f, document: e.target.value }))}
          />
          <Input
            placeholder="Contacto (nombre)"
            value={form.contactName}
            onChange={(e) => setForm((f) => ({ ...f, contactName: e.target.value }))}
          />
          <Input
            placeholder="Teléfono"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <Input
            placeholder="Email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <Input
            placeholder="Notas"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
          <label className="flex items-center justify-between rounded-md border p-2 text-sm">
            <span>Activo</span>
            <Switch
              checked={form.isActive}
              onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: v }))}
            />
          </label>
          {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
          <DialogFooter>
            <Button variant="outline" type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? 'Guardando…' : 'Guardar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
