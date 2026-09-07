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
export const quoteStatus = pgEnum('quote_status', ['draft', 'sent', 'approved', 'rejected', 'expired']);
export const reservationStatus = pgEnum('reservation_status', ['pending', 'confirmed', 'cancelled', 'completed']);
export const channelKind = pgEnum('channel_kind', ['telegram', 'whatsapp']);
export const messageDirection = pgEnum('message_direction', ['inbound', 'outbound']);
export const messageKind = pgEnum('message_kind', ['text', 'quote', 'system']);
export const conversationStatus = pgEnum('conversation_status', ['open', 'closed']);

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
    expires_at: integer('expires_at'),
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
  bankFeePercent: numeric('bank_fee_percent', { precision: 6, scale: 3 }).notNull().default('3.0'),
  quoteValidityDays: integer('quote_validity_days').notNull().default(7),
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

export const quotes = pgTable('quotes', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id')
    .notNull()
    .references(() => agencies.id, { onDelete: 'cascade' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => users.id),
  consecutivo: text('consecutivo').unique(),
  status: quoteStatus('status').notNull().default('draft'),
  title: text('title'),
  clientName: text('client_name'),
  clientEmail: text('client_email'),
  clientPhone: text('client_phone'),
  trmCopPerUsd: numeric('trm_cop_per_usd', { precision: 16, scale: 6 }),
  trmDate: date('trm_date', { mode: 'string' }),
  bankFeePercent: numeric('bank_fee_percent', { precision: 6, scale: 3 }),
  notes: text('notes'),
  validUntil: date('valid_until', { mode: 'string' }),
  publicToken: text('public_token').unique(),
  sentAt: timestamp('sent_at', { withTimezone: true }),
  decidedAt: timestamp('decided_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const quoteOptions = pgTable('quote_options', {
  id: uuid('id').primaryKey().defaultRandom(),
  quoteId: uuid('quote_id')
    .notNull()
    .references(() => quotes.id, { onDelete: 'cascade' }),
  position: integer('position').notNull().default(1),
  label: text('label'),
  provider: text('provider').notNull().default('liteapi'),
  providerRef: jsonb('provider_ref'),
  hotelName: text('hotel_name'),
  hotelCity: text('hotel_city'),
  hotelStars: integer('hotel_stars'),
  hotelImage: text('hotel_image'),
  checkIn: date('check_in', { mode: 'string' }),
  checkOut: date('check_out', { mode: 'string' }),
  nights: integer('nights'), // generado en DB
  occupancy: jsonb('occupancy'),
  board: text('board'),
  netCostUsd: numeric('net_cost_usd', { precision: 12, scale: 2 }).notNull(),
  markupPercent: numeric('markup_percent', { precision: 9, scale: 4 }).notNull().default('0'),
  markupFixedUsd: numeric('markup_fixed_usd', { precision: 12, scale: 2 }).notNull().default('0'),
  bankFeePercent: numeric('bank_fee_percent', { precision: 6, scale: 3 }).notNull().default('0'),
  saleUsd: numeric('sale_usd', { precision: 12, scale: 2 }).notNull().default('0'),
  saleCop: numeric('sale_cop', { precision: 14, scale: 2 }),
  selected: boolean('selected').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const reservations = pgTable('reservations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id')
    .notNull()
    .references(() => agencies.id, { onDelete: 'cascade' }),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  quoteOptionId: uuid('quote_option_id').references(() => quoteOptions.id, { onDelete: 'set null' }),
  agentId: uuid('agent_id')
    .notNull()
    .references(() => users.id),
  consecutivo: text('consecutivo').unique(),
  status: reservationStatus('status').notNull().default('pending'),
  clientName: text('client_name'),
  clientEmail: text('client_email'),
  clientPhone: text('client_phone'),
  hotelName: text('hotel_name'),
  hotelCity: text('hotel_city'),
  checkIn: date('check_in', { mode: 'string' }),
  checkOut: date('check_out', { mode: 'string' }),
  board: text('board'),
  occupancy: jsonb('occupancy'),
  netCostUsd: numeric('net_cost_usd', { precision: 12, scale: 2 }),
  saleUsd: numeric('sale_usd', { precision: 12, scale: 2 }),
  saleCop: numeric('sale_cop', { precision: 14, scale: 2 }),
  trmCopPerUsd: numeric('trm_cop_per_usd', { precision: 16, scale: 6 }),
  providerRef: jsonb('provider_ref'),
  providerConfirmation: text('provider_confirmation'),
  notes: text('notes'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const channelIntegrations = pgTable(
  'channel_integrations',
  {
    agencyId: uuid('agency_id')
      .notNull()
      .references(() => agencies.id, { onDelete: 'cascade' }),
    channel: channelKind('channel').notNull(),
    config: jsonb('config').notNull().default({}),
    active: boolean('active').notNull().default(true),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({ pk: primaryKey({ columns: [t.agencyId, t.channel] }) }),
);

export const conversations = pgTable('conversations', {
  id: uuid('id').primaryKey().defaultRandom(),
  agencyId: uuid('agency_id')
    .notNull()
    .references(() => agencies.id, { onDelete: 'cascade' }),
  channel: channelKind('channel').notNull(),
  externalId: text('external_id').notNull(),
  contactName: text('contact_name'),
  contactHandle: text('contact_handle'),
  assignedAgentId: uuid('assigned_agent_id').references(() => users.id, { onDelete: 'set null' }),
  status: conversationStatus('status').notNull().default('open'),
  lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
  lastMessagePreview: text('last_message_preview'),
  unread: boolean('unread').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().defaultRandom(),
  conversationId: uuid('conversation_id')
    .notNull()
    .references(() => conversations.id, { onDelete: 'cascade' }),
  direction: messageDirection('direction').notNull(),
  kind: messageKind('kind').notNull().default('text'),
  body: text('body'),
  quoteId: uuid('quote_id').references(() => quotes.id, { onDelete: 'set null' }),
  externalMessageId: text('external_message_id'),
  senderUserId: uuid('sender_user_id').references(() => users.id, { onDelete: 'set null' }),
  delivered: boolean('delivered').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

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
