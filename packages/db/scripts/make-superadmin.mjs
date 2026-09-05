// Marca a un usuario existente como super_admin de plataforma.
// Uso: DATABASE_URL=postgres://... node packages/db/scripts/make-superadmin.mjs <email>
// (El usuario debe haberse registrado antes por la UI para existir en `users`.)
import pg from 'pg';

const email = process.argv[2];
if (!email) {
  console.error('Uso: node packages/db/scripts/make-superadmin.mjs <email>');
  process.exit(1);
}
if (!process.env.DATABASE_URL) {
  console.error('Falta DATABASE_URL (rol admin).');
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
