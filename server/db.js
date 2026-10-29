import pg from 'pg';

let pool;
let schemaReady;

export function getPool() {
  if (!process.env.DATABASE_URL) {
    const error = new Error('DATABASE_URL이 설정되지 않았습니다.');
    error.status = 503;
    error.code = 'db_not_configured';
    throw error;
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, max: Number(process.env.PG_POOL_MAX || 3), idleTimeoutMillis: 10_000 });
  }
  return pool;
}

const schema = `
create table if not exists t08_users (
  id uuid primary key,
  username text not null unique,
  webauthn_user_id text not null unique,
  created_at timestamptz not null default now()
);
create table if not exists t08_credentials (
  id text primary key,
  user_id uuid not null references t08_users(id) on delete cascade,
  public_key text not null,
  counter bigint not null default 0,
  transports text,
  device_type text,
  backed_up boolean,
  aaguid text,
  name text not null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);
create index if not exists t08_credentials_user on t08_credentials(user_id);
create table if not exists t08_challenges (
  challenge text primary key,
  kind text not null,
  user_id uuid,
  username text,
  webauthn_user_id text,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table if not exists t08_sessions (
  token_hash text primary key,
  user_id uuid not null references t08_users(id) on delete cascade,
  credential_id text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create table if not exists t08_notes (
  id uuid primary key,
  user_id uuid not null references t08_users(id) on delete cascade,
  kind text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists t08_notes_user on t08_notes(user_id);
`;

export async function db() {
  const p = getPool();
  if (!schemaReady) {
    schemaReady = p.query(schema).catch((error) => {
      schemaReady = undefined;
      throw error;
    });
  }
  await schemaReady;
  return p;
}

export async function transaction(work) {
  const p = await db();
  const client = await p.connect();
  try {
    await client.query('begin');
    const result = await work(client);
    await client.query('commit');
    return result;
  } catch (error) {
    await client.query('rollback').catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
