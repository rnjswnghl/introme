// 서버 저장소에 실제로 무엇이 들어 있는지 남긴다(값은 앞부분만).
// 사용: DATABASE_URL=... node scripts/t08-db-snapshot.mjs [결과.json] [확인할 이름표...]
import pg from 'pg';
import { writeFile } from 'node:fs/promises';

const [out = 'docs/T08-db-snapshot-local.json', ...usernames] = process.argv.slice(2);
const client = new pg.Client({ connectionString: process.env.DATABASE_URL || 'postgres://postgres@127.0.0.1:5433/postgres?sslmode=disable' });
await client.connect();
const cut = (v, n = 18) => (v == null ? v : `${String(v).slice(0, n)}… (${String(v).length}자)`);

const columns = async (table) =>
  (await client.query(`select column_name, data_type from information_schema.columns where table_name = $1 order by ordinal_position`, [table])).rows;

const credentials = (await client.query(
  `select c.id, u.username, c.name, c.public_key, c.counter, c.device_type, c.backed_up, c.aaguid, c.created_at
     from t08_credentials c join t08_users u on u.id = c.user_id order by c.created_at desc limit 6`,
)).rows.map((r) => ({ ...r, id: cut(r.id, 10), public_key: cut(r.public_key, 24) }));
const sessions = (await client.query('select token_hash, created_at, expires_at from t08_sessions order by created_at desc limit 3')).rows
  .map((r) => ({ ...r, token_hash: cut(r.token_hash, 8) }));
const missing = [];
for (const name of usernames) {
  const { rowCount } = await client.query('select 1 from t08_users where username = $1', [name]);
  missing.push({ username: name, 계정_있음: rowCount === 1 });
}

const snapshot = {
  takenAt: new Date().toISOString(),
  설명: 't08_credentials에는 공개키(COSE, base64url)만 있고 개인키 열은 없다. 세션은 쿠키 원문이 아니라 sha256 해시만 저장한다.',
  t08_credentials_열: await columns('t08_credentials'),
  t08_sessions_열: await columns('t08_sessions'),
  credentials,
  sessions,
  이름표_확인: missing,
};
await writeFile(out, JSON.stringify(snapshot, null, 2) + '\n');
console.log(JSON.stringify(snapshot, null, 2).slice(0, 1500));
await client.end();
