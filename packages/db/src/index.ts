import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema/index';

// Lazy: construir el cliente sólo en la primera query. Si lo hicieramos eager
// (en module-eval), el build de Next 16 explota al "Collecting page data"
// porque CI no expone DATABASE_URL. Postgres-js no abre conexión hasta la
// primera query igual, así que esto no agrega overhead — solo difiere el
// throw cuando falta la env var.
let _db: PostgresJsDatabase<typeof schema> | null = null;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  const client = postgres(connectionString, {
    max: process.env.NODE_ENV === 'production' ? 10 : 1,
    prepare: false,
  });
  _db = drizzle(client, { schema });
  return _db;
}

export const db = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    const target = getDb();
    const value = Reflect.get(target, prop, receiver);
    return typeof value === 'function' ? value.bind(target) : value;
  },
});

export * from './schema/index';
export type Database = PostgresJsDatabase<typeof schema>;
