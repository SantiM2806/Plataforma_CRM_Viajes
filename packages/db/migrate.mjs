// Runner de migraciones minimalista para Supabase self-hosted.
// Aplica en orden los .sql de ./migrations que aún no estén registrados.
// Uso: DATABASE_URL=postgres://... node packages/db/migrate.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'migrations');

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL en el entorno.');
  process.exit(1);
}

const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

await client.query(`
  create table if not exists _migrations (
    name text primary key,
    applied_at timestamptz not null default now()
  )
`);

const { rows } = await client.query('select name from _migrations');
const done = new Set(rows.map((r) => r.name));

for (const f of files) {
  if (done.has(f)) {
    console.log('· skip   ', f);
    continue;
  }
  console.log('→ applying', f);
  const sql = readFileSync(join(dir, f), 'utf8');
  try {
    await client.query(sql);
    await client.query('insert into _migrations(name) values ($1)', [f]);
    console.log('  ✓ ok    ', f);
  } catch (err) {
    console.error('  ✗ FAILED', f, '\n', err.message);
    await client.end();
    process.exit(1);
  }
}

await client.end();
console.log('Migraciones al día.');
