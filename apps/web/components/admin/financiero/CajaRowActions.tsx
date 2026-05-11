'use client';

import Link from 'next/link';
import { MoreHorizontal, LockKeyhole, ListOrdered } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function CajaRowActions({
  cashSessionId,
  status,
}: {
  cashSessionId: string;
  status: string;
}) {
  const isOpen = status === 'open';
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          aria-label="Acciones"
        >
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {isOpen && (
          <DropdownMenuItem asChild>
            <Link href="/pos?close=1">
              <LockKeyhole className="mr-1 h-3.5 w-3.5" />
              Cerrar caja
            </Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem asChild>
          <Link href={`/admin/financiero/cajas/${cashSessionId}`}>
            <ListOrdered className="mr-1 h-3.5 w-3.5" />
            Ir a ventas
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
