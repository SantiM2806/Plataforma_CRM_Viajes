// Marca a un usuario existente como super_admin de plataforma.
// Uso:  pnpm db:make-superadmin <email>   (lee apps/web/.env.local)
// (El usuario debe haberse registrado antes por la UI para existir en `users`.)
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import pg from 'pg';

function loadEnvFile(path) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m || line.trim().startsWith('#')) continue;
    let val = m[2];
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) val = val.slice(1, -1);
    if (process.env[m[1]] === undefined) process.env[m[1]] = val;
  }
}
const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
loadEnvFile(join(repoRoot, 'apps', 'web', '.env.local'));

const email = process.argv[2];
if (!email) {
  console.error('Uso: pnpm db:make-superadmin <email>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (rol admin). Ponlo en apps/web/.env.local.');
  process.exit(1);
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const { rows } = await client.query('select id from users where email = $1', [email]);
if (rows.length === 0) {
  console.error(`No existe un usuario con email "${email}". Regístrate primero por la UI.`);
  await client.end();
  process.exit(1);
}

await client.query(
  `insert into memberships (user_id, agency_id, role)
   values ($1, null, 'super_admin')
   on conflict do nothing`,
  [rows[0].id],
);

console.log(`✓ ${email} ahora es super_admin.`);
await client.end();
