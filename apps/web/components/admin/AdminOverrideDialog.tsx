'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { validateAdminCredential } from '@/lib/actions/admin-override';
import type { Capability } from '@/lib/auth/permissions';

type Props = {
  open: boolean;
  onClose: () => void;
  /** Capability que la acción protegida requiere. El admin que valida debe poseerla. */
  requiredCapability: Capability;
  title?: string;
  description?: string;
  onSuccess: (authorizedBy: { userId: string; name: string }) => void;
};

/**
 * Dialog reutilizable para pedir credenciales de un usuario admin/manager
 * cuando un cashier necesita autorización para una acción específica.
 */
export function AdminOverrideDialog({
  open,
  onClose,
  requiredCapability,
  title = 'Autorización admin',
  description = 'Esta acción requiere validación de un usuario con permisos. Ingresá tus credenciales.',
  onSuccess,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setEmail('');
    setPassword('');
    setError(null);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await validateAdminCredential({
        email: email.trim(),
        password,
        requiredCapability,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      onSuccess({ userId: res.userId, name: res.name });
      reset();
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-3">
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Email del autorizante</span>
            <Input
              type="email"
              autoFocus
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          <label className="block text-sm">
            <span className="block mb-1 font-medium">Contraseña</span>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="off"
            />
          </label>
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={pending}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending || !email || !password}>
              {pending ? 'Validando…' : 'Autorizar'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
