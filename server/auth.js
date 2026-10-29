import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { config, sessionCookieName } from './config.js';
import { db } from './db.js';
import { HttpError, parseCookies, sessionCookie } from './http.js';

export const hashToken = (token) => createHash('sha256').update(token).digest('base64url');

// ── 일회용 질문(challenge) ─────────────────────────────
export async function saveChallenge(client, { challenge, kind, userId = null, username = null, webauthnUserId = null }) {
  await client.query(
    `insert into t08_challenges (challenge, kind, user_id, username, webauthn_user_id, expires_at)
     values ($1, $2, $3, $4, $5, $6)`,
    [challenge, kind, userId, username, webauthnUserId, new Date(Date.now() + config.challengeTtlMs)],
  );
  // 만료된 질문은 새 질문을 만들 때 함께 지운다.
  await client.query('delete from t08_challenges where expires_at < now()');
}

// 응답에 담긴 질문 값을 꺼내, 서버에 보관된 같은 값을 "지우면서" 가져온다.
// delete ... returning은 한 문장이라 같은 질문으로 동시에 두 번 와도 한쪽만 행을 받는다.
export async function consumeChallenge(client, response, kind) {
  let clientData;
  try {
    clientData = JSON.parse(Buffer.from(response?.response?.clientDataJSON || '', 'base64url').toString('utf8'));
  } catch {
    throw new HttpError(400, 'client_data_invalid', '응답 형식이 올바르지 않습니다.');
  }
  const { rows } = await client.query(
    'delete from t08_challenges where challenge = $1 and kind = $2 returning *',
    [clientData.challenge || '', kind],
  );
  const row = rows[0];
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    throw new HttpError(401, 'challenge_invalid', '이미 사용했거나 만료된 질문입니다. 처음부터 다시 시도해 주세요.', {
      reason: 'challenge_invalid',
    });
  }
  return row;
}

// ── 세션 ────────────────────────────────────────────
export async function createSession(client, userId, credentialId) {
  const token = randomBytes(32).toString('base64url');
  await client.query(
    `insert into t08_sessions (token_hash, user_id, credential_id, expires_at) values ($1, $2, $3, $4)`,
    [hashToken(token), userId, credentialId, new Date(Date.now() + config.sessionTtlMs)],
  );
  return sessionCookie(token, Math.floor(config.sessionTtlMs / 1000));
}

export async function readSession(req) {
  const token = parseCookies(req)[sessionCookieName];
  if (!token) return null;
  const pool = await db();
  const { rows } = await pool.query(
    `select s.token_hash, s.user_id, u.username
       from t08_sessions s join t08_users u on u.id = s.user_id
      where s.token_hash = $1 and s.expires_at > now()`,
    [hashToken(token)],
  );
  return rows[0] || null;
}

export async function requireSession(req) {
  const session = await readSession(req);
  if (!session) throw new HttpError(401, 'login_required', '패스키로 들어온 뒤에만 볼 수 있습니다.');
  return session;
}

export async function destroySession(req) {
  const token = parseCookies(req)[sessionCookieName];
  if (!token) return 0;
  const pool = await db();
  const { rowCount } = await pool.query('delete from t08_sessions where token_hash = $1', [hashToken(token)]);
  return rowCount;
}

export const clearedSessionCookie = () => sessionCookie('', 0);
export const newId = () => randomUUID();
