// Runner de migraciones para PostgreSQL. Aplica en orden los .sql de ./migrations
// que aún no estén registrados. Usa DATABASE_URL (rol admin/owner).
// Uso:  pnpm db:migrate     (lee apps/web/.env.local si DATABASE_URL no está en el entorno)
//   o:  DATABASE_URL=postgres://... node packages/db/migrate.mjs
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
const dir = join(here, 'migrations');

// Carga variables desde apps/web/.env.local (y .env) si no están en el entorno.
function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    const key = m[1];
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}
const repoRoot = join(here, '..', '..');
loadEnvFile(join(repoRoot, 'apps', 'web', '.env.local'));
loadEnvFile(join(repoRoot, '.env'));

if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL. Ponlo en apps/web/.env.local o en el entorno.');
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
