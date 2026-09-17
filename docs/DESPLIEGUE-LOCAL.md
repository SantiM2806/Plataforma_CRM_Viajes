# CRM de Viajes — Correr en localhost (otra máquina)

Guía paso a paso para dejar el proyecto funcionando en `http://localhost:3000` en una máquina nueva.

---

## 1. Requisitos

Instala estos programas:

- **Node.js 20 o superior** — https://nodejs.org
- **pnpm** (gestor de paquetes) — con Node ya instalado:
  ```bash
  npm install -g pnpm
  ```
- **Git** — https://git-scm.com
- **PostgreSQL 16+** *(Opción B)* o **Docker Desktop** *(Opción A, recomendado)* para la base de datos.

> Windows, macOS o Linux funcionan. Los comandos van en una terminal (en Windows: **Git Bash** o **PowerShell**).

---

## 2. Clonar el repositorio

```bash
git clone https://github.com/SantiM2806/Plataforma_CRM_Viajes.git
cd Plataforma_CRM_Viajes
```

---

## 3. Instalar dependencias

```bash
pnpm install
```

---

## 4. Base de datos PostgreSQL

Elige **una** opción.

### Opción A — con Docker (más fácil)

Levanta solo Postgres desde el compose del proyecto:

```bash
docker compose -f deploy/docker-compose.yml up -d postgres
```

Esto crea la base `travelkit_crm` en `localhost:5432` con usuario `postgres` y contraseña `postgres` (valor por defecto del compose).

### Opción B — Postgres instalado localmente

Crea la base de datos (te pedirá la contraseña de tu usuario `postgres`):

```bash
psql -U postgres -c "CREATE DATABASE travelkit_crm;"
```

---

## 5. Variables de entorno

Crea el archivo **`apps/web/.env.local`** (no se sube al repo). Copia esto y ajusta:

```bash
# --- Base de datos ---
# ADMIN: solo para correr migraciones (crea el rol crm_app, funciones, etc.)
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/travelkit_crm
# RUNTIME de la app: rol crm_app (lo crea la migración). RLS activa.
DATABASE_APP_URL=postgresql://crm_app:change_me_dev@localhost:5432/travelkit_crm

# --- Auth.js ---
AUTH_SECRET=PEGA_AQUI_UN_SECRETO
AUTH_URL=http://localhost:3000

# --- LiteAPI (búsqueda de hoteles) ---
LITEAPI_ENV=sandbox
LITEAPI_KEY_SANDBOX=sand_TU_KEY_PRIVADA

# --- Google OAuth (opcional; el botón "Continuar con Google") ---
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
```

Genera el `AUTH_SECRET` con uno de estos:

```bash
# con OpenSSL
openssl rand -base64 32
# o con Node
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

> Notas:
> - En **Opción A** la contraseña de `postgres` es `postgres`. En **Opción B** usa la que pusiste al instalar PostgreSQL (ajusta `DATABASE_URL`).
> - `LITEAPI_KEY_SANDBOX` debe ser la key **privada** que empieza por `sand_` (no la pública). Sin ella, la app abre pero el buscador de hoteles no traerá resultados.
> - Google es **opcional**: sin esas variables, entras con email/contraseña normal.

---

## 6. Correr las migraciones

Aplica el esquema y crea el rol `crm_app`:

```bash
pnpm db:migrate
```

Debe terminar en `Migraciones al día.`

> **Recomendado (seguridad):** cambia la contraseña por defecto del rol de la app y actualiza `DATABASE_APP_URL`:
> ```bash
> psql -U postgres -d travelkit_crm -c "ALTER ROLE crm_app PASSWORD 'una-clave-fuerte';"
> ```
> Luego pon esa misma clave en `DATABASE_APP_URL`.

---

## 7. Levantar la aplicación

```bash
pnpm --filter @crm/web dev
```

Abre **http://localhost:3000** 🎉

---

## 8. Primer ingreso

1. Ve a `http://localhost:3000/register` y **crea tu cuenta** (nombre, email, contraseña).
2. Te pedirá **crear tu agencia** (nombre + iniciales, ej. `AVM`). Quedas como **Administrador**.
3. Ya puedes: crear cotizaciones, enviarlas, ver la propuesta pública, reservas, reportes, etc.

Para agregar agentes/contables: **Configuración → Equipo**.

### (Opcional) Convertirte en Super Admin (dueño de la plataforma)

Después de registrarte:

```bash
pnpm db:make-superadmin tu@email.com
```

---

## 9. (Opcional) Worker de TRM automática

El worker refresca la TRM del Banco de la República cada día. Necesita **Redis**:

```bash
# Redis con Docker
docker compose -f deploy/docker-compose.yml up -d redis
# En apps/web/.env.local añade:  REDIS_URL=redis://localhost:6379
# Corre el worker:
pnpm --filter @crm/worker start
```

No es necesario para usar la app: la TRM también se consulta al vuelo cuando se envía una cotización.

---

## 10. Solución de problemas

- **`pnpm db:migrate` falla con "no se pudo conectar"** → revisa que Postgres esté arriba y que `DATABASE_URL` tenga el host/puerto/usuario/clave correctos.
- **La app abre pero "Falta la API key de LiteAPI"** al buscar hoteles → falta `LITEAPI_KEY_SANDBOX` en `.env.local` (reinicia `pnpm dev` tras editarlo).
- **El botón de Google no funciona** → faltan `AUTH_GOOGLE_ID/SECRET`, o no registraste la URI de redirección `http://localhost:3000/api/auth/callback/google` en Google Cloud.
- **Windows: Postgres no arranca en el puerto elegido ("permission denied")** → algunos puertos (ej. 5433) están reservados por Windows. Usa `5432` (por defecto) o uno alto como `55432`, y ajusta las URLs.
- **Cambié `.env.local` y no toma efecto** → detén (`Ctrl+C`) y vuelve a levantar `pnpm --filter @crm/web dev`.

---

## 11. Iterar y actualizar el app

### Mientras desarrollas (recarga en vivo)
Con `pnpm --filter @crm/web dev` **corriendo**, cada vez que guardas un archivo el navegador se **recarga solo**. No necesitas reiniciar nada. Solo edita y mira el cambio en http://localhost:3000.

### Traer cambios nuevos desde GitHub
Cuando haya actualizaciones en el repo:

```bash
git pull                 # trae los cambios
pnpm install             # solo hace falta si cambiaron dependencias
pnpm db:migrate          # solo hace falta si hay migraciones nuevas (es seguro correrlo siempre)
```

Si el `pnpm dev` estaba corriendo, con `git pull` la app se recarga sola. Si cambiaron dependencias o migraciones, reinícialo (`Ctrl+C` y de nuevo `pnpm --filter @crm/web dev`).

### Guardar TUS cambios en GitHub

```bash
git add -A
git commit -m "describe tu cambio"
git push
```

### Parar / reiniciar
- **Parar la app:** `Ctrl+C` en la terminal del `pnpm dev`.
- **Reiniciar la app:** `pnpm --filter @crm/web dev`.
- **Parar la base (Docker):** `docker compose -f deploy/docker-compose.yml stop postgres` — tus datos se conservan; para arrancarla otra vez, `... start postgres`.

### Verificar que todo compila antes de subir (opcional)
```bash
pnpm --filter @crm/web build
```

---

## Resumen ultra-rápido (con Docker)

```bash
git clone https://github.com/SantiM2806/Plataforma_CRM_Viajes.git
cd Plataforma_CRM_Viajes
pnpm install
docker compose -f deploy/docker-compose.yml up -d postgres
# crea apps/web/.env.local (ver paso 5) con AUTH_SECRET y tu LiteAPI key
pnpm db:migrate
pnpm --filter @crm/web dev
# abre http://localhost:3000  ->  /register
```
