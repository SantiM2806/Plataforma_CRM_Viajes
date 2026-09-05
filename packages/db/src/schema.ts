// Esquema Drizzle para consultas tipadas.
// FUENTE DE VERDAD del DDL = migrations/*.sql. Mantener este archivo en sync.
import {
  pgTable,
  pgEnum,
  uuid,
  text,
  timestamp,
  date,
  boolean,
  integer,
  bigint,
  numeric,
  jsonb,
  char,
  primaryKey,
} from 'drizzle-orm/pg-core';

export const appRole = pgEnum('app_role', ['super_admin', 'admin_agencia', 'agente', 'contable']);
export const markupScope = pgEnum('markup_scope', ['agency_default', 'provider', 'product_type', 'product']);
export const markupCalc = pgEnum('markup_calc', ['percent', 'fixed']);

// ---------- Auth.js ----------
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: bigint('expires_at', { mode: 'number' }),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (t) => ({ pk: primaryKey({ columns: [t.provider, t.providerAccountId] }) }),
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { withTimezone: true }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.identifier, t.token] }) }),
);

// ---------- Dominio ----------
export const agencies = pgTable('agencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  initials: text('initials').notNull().unique(),
  country: char('country', { length: 2 }).notNull().default('CO'),
  taxId: text('tax_id'),
  baseCurrency: char('base_currency', { length: 3 }).notNull().default('USD'),
  displayCurrency: char('display_currency', { length: 3 }).notNull().default('COP'),
  settings: jsonb('settings').notNull().default({}),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const memberships = pgTable('memberships', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'cascade' }),
  role: appRole('role').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const markupRules = pgTable('markup_rules', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id')
    .notNull()
    .references(() => agencies.id, { onDelete: 'cascade' }),
  scope: markupScope('scope').notNull(),
  scopeRef: text('scope_ref'),
  calcType: markupCalc('calc_type').notNull(),
  value: numeric('value', { precision: 12, scale: 4 }).notNull(),
  currency: char('currency', { length: 3 }).notNull().default('USD'),
  priority: integer('priority').notNull().default(100),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const exchangeRates = pgTable(
  'exchange_rates',
  {
    rateDate: date('rate_date', { mode: 'string' }).notNull(),
    baseCurrency: char('base_currency', { length: 3 }).notNull().default('USD'),
    quoteCurrency: char('quote_currency', { length: 3 }).notNull().default('COP'),
    rate: numeric('rate', { precision: 16, scale: 6 }).notNull(),
    source: text('source').notNull().default('BANREP'),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.rateDate, t.baseCurrency, t.quoteCurrency] }) }),
);

export const auditLog = pgTable('audit_log', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  agencyId: uuid('agency_id').references(() => agencies.id, { onDelete: 'set null' }),
  actorUserId: uuid('actor_user_id').references(() => users.id, { onDelete: 'set null' }),
  action: text('action').notNull(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id'),
  changes: jsonb('changes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});
