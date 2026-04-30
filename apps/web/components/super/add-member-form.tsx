'use client';

import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { addTenantMember, searchUsersByEmail } from '@/lib/actions/tenant';

type Role = 'owner' | 'admin' | 'manager' | 'cashier' | 'viewer';

interface UserSuggestion {
  id: string;
  email: string;
  name: string;
}

export function AddMemberForm({ tenantId }: { tenantId: string }) {
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Role>('admin');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error' | 'success'>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<UserSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [highlighted, setHighlighted] = useState<UserSuggestion | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Debounced search
  useEffect(() => {
    if (email.trim().length < 2) {
      setSuggestions([]);
      setHighlighted(null);
      return;
    }
    const handle = setTimeout(async () => {
      const res = await searchUsersByEmail(email.trim());
      setSuggestions(res);
      const exact = res.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      setHighlighted(exact ?? null);
    }, 200);
    return () => clearTimeout(handle);
  }, [email]);

  // Close suggestions on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleSelectSuggestion = (u: UserSuggestion) => {
    setEmail(u.email);
    setHighlighted(u);
    setShowSuggestions(false);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus('loading');
    setMessage(null);
    const res = await addTenantMember(tenantId, email.trim(), role);
    if (!res.ok) {
      setStatus('error');
      setMessage(res.error);
      return;
    }
    setStatus('success');
    setMessage('Miembro agregado.');
    setEmail('');
    setSuggestions([]);
    setHighlighted(null);
  };

  const isUnregistered =
    email.trim().length >= 2 &&
    suggestions.length === 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-[1fr_180px_auto] gap-3 items-end">
        <div className="space-y-1.5 relative" ref={wrapperRef}>
          <Label htmlFor="member-email">Email del usuario</Label>
          <Input
            id="member-email"
            type="email"
            placeholder="usuario@email.com"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setShowSuggestions(true);
              setStatus('idle');
              setMessage(null);
            }}
            onFocus={() => setShowSuggestions(true)}
            autoComplete="off"
            required
          />
          {showSuggestions && suggestions.length > 0 && (
            <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-56 overflow-y-auto rounded-md border bg-white shadow-lg">
              {suggestions.map((u) => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => handleSelectSuggestion(u)}
                    className="w-full px-3 py-2 text-left text-sm hover:bg-zinc-100"
                  >
                    <span className="font-medium">{u.email}</span>
                    <span className="ml-2 text-xs text-zinc-500">{u.name}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="member-role">Rol</Label>
          <Select
            id="member-role"
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
          >
            <option value="owner">Owner</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="cashier">Cashier</option>
            <option value="viewer">Viewer</option>
          </Select>
        </div>

        <div>
          <Button type="submit" disabled={status === 'loading'} className="w-full md:w-auto">
            {status === 'loading' ? 'Agregando...' : 'Agregar'}
          </Button>
        </div>
      </div>

      {/* Status hints */}
      {highlighted && (
        <p className="text-xs text-green-700">
          ✓ Usuario encontrado: <span className="font-medium">{highlighted.name}</span>
        </p>
      )}
      {isUnregistered && !message && (
        <p className="text-xs text-amber-700">
          ⓘ No hay usuario con ese email. Pediles que se registren en{' '}
          <code className="bg-zinc-100 px-1 rounded">/register</code> o invitalos por email
          (envío automático llegará en próxima fase).
        </p>
      )}
      {message && (
        <p className={`text-xs ${status === 'success' ? 'text-green-700' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </form>
  );
}
