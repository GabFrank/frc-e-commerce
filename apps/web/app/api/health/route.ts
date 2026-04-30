import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';

export async function GET() {
  let dbStatus: 'ok' | 'error' = 'ok';
  let dbError: string | undefined;
  try {
    await db.execute(sql`select 1 as ping`);
  } catch (err) {
    dbStatus = 'error';
    dbError = err instanceof Error ? err.message : String(err);
  }
  const status = dbStatus === 'ok' ? 200 : 503;
  return NextResponse.json(
    { status: dbStatus === 'ok' ? 'ok' : 'degraded', db: dbStatus, dbError },
    { status }
  );
}
