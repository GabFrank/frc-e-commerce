import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL is not set');
}

const client = postgres(connectionString, {
  max: process.env.NODE_ENV === 'production' ? 10 : 1,
  prepare: false,
});

export const db = drizzle(client, { schema });

export * from './schema/index';
export type Database = typeof db;
