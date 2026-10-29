import { randomBytes } from 'node:crypto';
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import { config } from './config.js';
import { db, transaction } from './db.js';
import { HttpError, readJson, send } from './http.js';
import {
  clearedSessionCookie,
  consumeChallenge,
  createSession,
  destroySession,
  newId,
  readSession,
  requireSession,
  saveChallenge,
} from './auth.js';
import { describeAuthenticator } from './authenticators.js';

const USERNAME = /^[a-z0-9][a-z0-9_-]{2,19}$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const notFound = () => new HttpError(404, 'not_found', '찾을 수 없는 자료입니다.');

function cleanUsername(value) {
  const username = String(value || '').trim().toLowerCase();
  if (!USERNAME.test(username)) {
    throw new HttpError(400, 'username_invalid', '이름표는 영문 소문자·숫자·-·_ 3~20자로 적어 주세요. 실명 대신 별명을 권합니다.');
  }
  return username;
}

function cleanText(value, max, fallback = '') {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
  return text || fallback;
}

const toAuthenticatorDescriptor = (row) => ({
  id: row.id,
  transports: row.transports ? row.transports.split(',').filter(Boolean) : undefined,
});

function seedNotes(username) {
  return [
    {
      kind: 'project',
      title: '준비 중인 프로젝트 메모',
      body: `[${username}] 패스키 로그인(T08) 마무리 — 두 번째 패스키 등록과 삭제 뒤 로그인까지 기록하기.`,
    },
    {
      kind: 'apply',
      title: '지원하려는 곳 목록',
      body: `[${username}] 연습용 예시 · 가상회사 A 프론트엔드 / 가상회사 B 웹 플랫폼. 실제 지원처가 아닙니다.`,
    },
    {
      kind: 'retro',
      title: '스스로 쓰는 회고',
      body: `[${username}] 비밀번호 칸 없이 들어오는 흐름을 처음부터 끝까지 직접 만들어 본 날.`,
    },
  ];
}

function credentialView(row, currentCredentialId) {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    lastUsedAt: row.last_used_at,
    storedIn: describeAuthenticator(row.aaguid, row.device_type, row.backed_up),
    synced: row.backed_up === true,
    current: row.id === currentCredentialId,
  };
}

// ── 등록: 새 계정 ───────────────────────────────────────
export async function registerOptions(req, res) {
  const body = await readJson(req);
  const username = cleanUsername(body.username);
  const pool = await db();
  const taken = await pool.query('select 1 from t08_users where username = $1', [username]);
  if (taken.rowCount) throw new HttpError(409, 'username_taken', '이미 쓰는 이름표입니다. 다른 이름표를 적어 주세요.');

  const webauthnUserId = randomBytes(32);
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: username,
    userDisplayName: username,
    userID: webauthnUserId,
    attestationType: 'none',
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await saveChallenge(pool, {
    challenge: options.challenge,
    kind: 'register',
    username,
    webauthnUserId: webauthnUserId.toString('base64url'),
  });
  send(res, 200, options);
}

export async function registerVerify(req, res) {
  const body = await readJson(req);
  const challenge = await consumeChallenge(await db(), body.response, 'register');
  const cookie = await transaction(async (client) => {
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    }).catch((error) => {
      throw new HttpError(400, 'registration_rejected', '등록 응답을 확인하지 못했습니다.', { reason: error.message });
    });
    if (!verification.verified) throw new HttpError(400, 'registration_rejected', '등록 응답을 확인하지 못했습니다.');

    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;
    const userId = newId();
    const inserted = await client.query(
      `insert into t08_users (id, username, webauthn_user_id) values ($1, $2, $3)
       on conflict (username) do nothing`,
      [userId, challenge.username, challenge.webauthn_user_id],
    );
    if (!inserted.rowCount) throw new HttpError(409, 'username_taken', '그 사이 다른 사람이 같은 이름표로 등록했습니다.');

    await insertCredential(client, userId, credential, credentialDeviceType, credentialBackedUp, aaguid, body.name);
    for (const note of seedNotes(challenge.username)) {
      await client.query(
        'insert into t08_notes (id, user_id, kind, title, body) values ($1, $2, $3, $4, $5)',
        [newId(), userId, note.kind, note.title, note.body],
      );
    }
    return createSession(client, userId, credential.id);
  });
  send(res, 201, { ok: true }, { 'Set-Cookie': cookie });
}

async function insertCredential(client, userId, credential, deviceType, backedUp, aaguid, name) {
  await client.query(
    `insert into t08_credentials (id, user_id, public_key, counter, transports, device_type, backed_up, aaguid, name)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      credential.id,
      userId,
      Buffer.from(credential.publicKey).toString('base64url'),
      credential.counter,
      (credential.transports || []).join(','),
      deviceType,
      backedUp,
      aaguid,
      cleanText(name, 40, '이름 없는 패스키'),
    ],
  );
}

// ── 등록: 로그인한 계정에 패스키 추가 ─────────────────────
export async function addPasskeyOptions(req, res) {
  const session = await requireSession(req);
  const pool = await db();
  const user = (await pool.query('select * from t08_users where id = $1', [session.user_id])).rows[0];
  const creds = (await pool.query('select id, transports from t08_credentials where user_id = $1', [user.id])).rows;
  const options = await generateRegistrationOptions({
    rpName: config.rpName,
    rpID: config.rpID,
    userName: user.username,
    userDisplayName: user.username,
    userID: Buffer.from(user.webauthn_user_id, 'base64url'),
    attestationType: 'none',
    // 이미 이 계정에 등록된 패스키를 가진 인증기는 다시 등록하지 않게 브라우저에 알린다.
    excludeCredentials: creds.map(toAuthenticatorDescriptor),
    authenticatorSelection: { residentKey: 'required', userVerification: 'required' },
  });
  await saveChallenge(pool, { challenge: options.challenge, kind: 'add', userId: user.id });
  send(res, 200, options);
}

export async function addPasskeyVerify(req, res) {
  const session = await requireSession(req);
  const body = await readJson(req);
  const challenge = await consumeChallenge(await db(), body.response, 'add');
  const created = await transaction(async (client) => {
    if (challenge.user_id !== session.user_id) {
      throw new HttpError(401, 'challenge_invalid', '다른 계정에서 만든 질문입니다.', { reason: 'challenge_owner_mismatch' });
    }
    const verification = await verifyRegistrationResponse({
      response: body.response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
    }).catch((error) => {
      throw new HttpError(400, 'registration_rejected', '등록 응답을 확인하지 못했습니다.', { reason: error.message });
    });
    if (!verification.verified) throw new HttpError(400, 'registration_rejected', '등록 응답을 확인하지 못했습니다.');
    const { credential, credentialDeviceType, credentialBackedUp, aaguid } = verification.registrationInfo;
    const exists = await client.query('select 1 from t08_credentials where id = $1', [credential.id]);
    if (exists.rowCount) throw new HttpError(409, 'credential_exists', '이미 등록된 패스키입니다.');
    await insertCredential(client, session.user_id, credential, credentialDeviceType, credentialBackedUp, aaguid, body.name);
    return credential.id;
  });
  send(res, 201, { ok: true, id: created });
}

// ── 로그인 ─────────────────────────────────────────────
export async function loginOptions(req, res) {
  const body = await readJson(req);
  const pool = await db();
  let user = null;
  let allowCredentials = [];
  if (body.username) {
    const username = cleanUsername(body.username);
    user = (await pool.query('select id from t08_users where username = $1', [username])).rows[0] || null;
    if (user) {
      const creds = (await pool.query('select id, transports from t08_credentials where user_id = $1', [user.id])).rows;
      allowCredentials = creds.map(toAuthenticatorDescriptor);
    }
    // 없는 이름표여도 같은 모양의 응답을 준다. 확인은 서명 검증 단계에서 실패한다.
    const options = await generateAuthenticationOptions({ rpID: config.rpID, allowCredentials, userVerification: 'required' });
    await saveChallenge(pool, { challenge: options.challenge, kind: 'login', userId: user?.id || null, username });
    send(res, 200, options);
    return;
  }
  const options = await generateAuthenticationOptions({ rpID: config.rpID, userVerification: 'required' });
  await saveChallenge(pool, { challenge: options.challenge, kind: 'login' });
  send(res, 200, options);
}

const rejectLogin = (reason) =>
  new HttpError(401, 'passkey_rejected', '패스키를 확인하지 못했습니다. 등록된 패스키로 다시 시도해 주세요.', { reason });

export async function loginVerify(req, res) {
  const body = await readJson(req);
  const response = body.response;
  // 질문은 검증 결과와 상관없이 먼저 지운다(실패한 시도도 같은 질문을 다시 쓰지 못한다).
  const challenge = await consumeChallenge(await db(), response, 'login');
  const cookie = await transaction(async (client) => {
    const cred = (await client.query('select * from t08_credentials where id = $1 for update', [response?.id || ''])).rows[0];
    if (!cred) throw rejectLogin('credential_unknown');
    // 이름표를 적고 시작했다면, 그 이름표 계정의 패스키만 받는다.
    if (challenge.username && challenge.user_id !== cred.user_id) throw rejectLogin('credential_owner_mismatch');
    const owner = (await client.query('select webauthn_user_id from t08_users where id = $1', [cred.user_id])).rows[0];
    const handle = response.response?.userHandle;
    if (handle && handle !== owner.webauthn_user_id) throw rejectLogin('user_handle_mismatch');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge.challenge,
      expectedOrigin: config.origin,
      expectedRPID: config.rpID,
      requireUserVerification: true,
      credential: {
        id: cred.id,
        publicKey: new Uint8Array(Buffer.from(cred.public_key, 'base64url')),
        counter: Number(cred.counter),
        transports: cred.transports ? cred.transports.split(',') : undefined,
      },
    }).catch((error) => {
      throw rejectLogin(/origin/i.test(error.message) ? 'origin_mismatch' : 'signature_invalid');
    });
    if (!verification.verified) throw rejectLogin('signature_invalid');

    await client.query('update t08_credentials set counter = $1, last_used_at = now() where id = $2', [
      verification.authenticationInfo.newCounter,
      cred.id,
    ]);
    return createSession(client, cred.user_id, cred.id);
  });
  send(res, 200, { ok: true }, { 'Set-Cookie': cookie });
}

export async function logout(req, res) {
  const removed = await destroySession(req);
  send(res, 200, { ok: true, sessionsRemoved: removed }, { 'Set-Cookie': clearedSessionCookie() });
}

export async function me(req, res) {
  // 로그인 여부만 알려 주는 확인용 주소. 비공개 자료는 담지 않는다.
  const session = await readSession(req);
  // origin: 패스키가 묶인 공식 주소. 다른 주소(배포별 주소 등)로 열었는지 화면이 알 수 있게 한다.
  send(res, 200, session ? { authenticated: true, username: session.username, origin: config.origin } : { authenticated: false, origin: config.origin });
}

// ── 패스키 목록·삭제 ────────────────────────────────────
export async function passkeys(req, res) {
  const session = await requireSession(req);
  const pool = await db();
  const current = (await pool.query('select credential_id from t08_sessions where token_hash = $1', [session.token_hash])).rows[0];
  if (req.method === 'GET') {
    const rows = (await pool.query('select * from t08_credentials where user_id = $1 order by created_at', [session.user_id])).rows;
    send(res, 200, { passkeys: rows.map((row) => credentialView(row, current?.credential_id)) });
    return;
  }
  // DELETE ?id=
  const id = new URL(req.url, config.origin).searchParams.get('id') || '';
  const result = await transaction(async (client) => {
    const rows = (await client.query('select id from t08_credentials where user_id = $1 for update', [session.user_id])).rows;
    if (!rows.some((row) => row.id === id)) throw new HttpError(404, 'not_found', '이 계정의 패스키가 아닙니다.');
    if (rows.length === 1) {
      throw new HttpError(409, 'last_passkey', '마지막 남은 패스키는 지울 수 없습니다. 다른 패스키를 먼저 등록해 주세요.');
    }
    await client.query('delete from t08_credentials where id = $1 and user_id = $2', [id, session.user_id]);
    return rows.length - 1;
  });
  send(res, 200, { ok: true, remaining: result });
}

// ── 비공개 자료 ───────────────────────────────────────
// 누구의 자료인지는 오직 세션에서 정한다. 주소나 본문의 userId·owner 값은 읽지 않는다.
export async function privateNotes(req, res) {
  const session = await requireSession(req);
  const pool = await db();
  const params = new URL(req.url, config.origin).searchParams;
  const id = params.get('id');
  if (id !== null && !UUID.test(id)) throw notFound();

  if (req.method === 'GET') {
    if (id) {
      const row = (await pool.query('select id, kind, title, body, created_at from t08_notes where id = $1 and user_id = $2', [id, session.user_id])).rows[0];
      if (!row) throw new HttpError(404, 'not_found', '찾을 수 없는 자료입니다.');
      send(res, 200, { owner: session.username, note: row });
      return;
    }
    const rows = (await pool.query(`select id, kind, title, body, created_at from t08_notes where user_id = $1
       order by created_at, case kind when 'project' then 1 when 'apply' then 2 when 'retro' then 3 else 4 end`, [session.user_id])).rows;
    send(res, 200, { owner: session.username, notes: rows });
    return;
  }

  if (req.method === 'POST') {
    const body = await readJson(req);
    const count = (await pool.query('select count(*)::int as n from t08_notes where user_id = $1', [session.user_id])).rows[0].n;
    if (count >= 30) throw new HttpError(409, 'note_limit', '자료는 30개까지 둘 수 있습니다.');
    const note = {
      id: newId(),
      kind: 'memo',
      title: cleanText(body.title, 60),
      body: cleanText(body.body, 500),
    };
    if (!note.title || !note.body) throw new HttpError(400, 'note_invalid', '제목과 내용을 모두 적어 주세요.');
    await pool.query('insert into t08_notes (id, user_id, kind, title, body) values ($1, $2, $3, $4, $5)', [
      note.id,
      session.user_id,
      note.kind,
      note.title,
      note.body,
    ]);
    send(res, 201, { owner: session.username, note });
    return;
  }

  // DELETE
  if (!id) throw notFound();
  const { rowCount } = await pool.query('delete from t08_notes where id = $1 and user_id = $2', [id, session.user_id]);
  if (!rowCount) throw new HttpError(404, 'not_found', '찾을 수 없는 자료입니다.');
  send(res, 200, { ok: true });
}
