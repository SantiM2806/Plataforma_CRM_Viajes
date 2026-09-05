import { Pool } from 'pg';
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from './schema';

export type Db = NodePgDatabase<typeof schema>;

// Pool con el rol de runtime crm_app (RLS ACTIVA).
const pool = new Pool({ connectionString: process.env.DATABASE_APP_URL });

/**
 * Cliente SIN contexto de usuario. Úsalo SOLO para:
 *  - el adaptador de Auth.js (tablas users/accounts/... que no llevan RLS)
 *  - jobs del worker que ya resuelven su propio scoping
 * No lo uses para leer datos de dominio de un usuario: usa withUser().
 */
export const db: Db = drizzle(pool, { schema });

/**
 * Ejecuta `fn` dentro de una transacción con el usuario inyectado en el GUC
 * `app.user_id`, de modo que las políticas RLS filtren por ese usuario.
 * Esta es la vía por defecto para toda consulta de dominio desde la app.
 */
export async function withUser<T>(
  userId: string | null,
  fn: (tx: Db) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('begin');
    // set_config(..., true) == SET LOCAL: vive solo en esta transacción.
    await client.query("select set_config('app.user_id', $1, true)", [userId ?? '']);
    const tx = drizzle(client, { schema }) as Db;
    const out = await fn(tx);
    await client.query('commit');
    return out;
  } catch (err) {
    await client.query('rollback');
    throw err;
  } finally {
    client.release();
  }
}
