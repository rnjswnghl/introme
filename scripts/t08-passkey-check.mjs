// T08 패스키 확인 스크립트.
// 사용: node scripts/t08-passkey-check.mjs [BASE] [결과.json]
//   BASE 기본값 http://localhost:4180. 공개 주소를 넣으면 같은 확인을 그 주소에 한다.
// 소프트웨어 인증기(scripts/soft-authenticator.mjs)로 실제 요청·응답을 만들고,
// 성공한 요청과 거절된 요청을 나란히 기록한다. 세션 값은 앞 6자만 남기고 가린다.
import { writeFile } from 'node:fs/promises';
import { SoftAuthenticator } from './soft-authenticator.mjs';

const BASE = (process.argv[2] || 'http://localhost:4180').replace(/\/$/, '');
const OUT = process.argv[3] || 'docs/T08-evidence-local.json';
const ORIGIN = BASE;
const run = Date.now().toString(36).slice(-5);
const names = { a: `t08a-${run}`, b: `t08b-${run}`, c: `t08c-${run}` };

const mask = (value) => (value ? `${String(value).slice(0, 6)}…(가림)` : value);
const log = [];
let failures = 0;

class Client {
  constructor(label) {
    this.label = label;
    this.cookie = '';
  }
  async call(method, path, body, { origin = ORIGIN, cookie } = {}) {
    const headers = { Origin: origin };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const useCookie = cookie ?? this.cookie;
    if (useCookie) headers.Cookie = useCookie;
    const res = await fetch(BASE + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), redirect: 'manual' });
    const setCookie = res.headers.get('set-cookie');
    if (setCookie) {
      const pair = setCookie.split(';')[0];
      this.cookie = pair.endsWith('=') ? '' : pair;
      this.lastSetCookie = setCookie.replace(/^([^=]+=)([^;]{6})[^;]*/, '$1$2…(가림)');
    } else this.lastSetCookie = null;
    const text = await res.text();
    let json;
    try { json = JSON.parse(text); } catch { json = text.slice(0, 200); }
    return { status: res.status, json, setCookie: this.lastSetCookie };
  }
}

function record(id, criteria, title, request, response, expect, pass, note) {
  if (!pass) failures += 1;
  log.push({ id, criteria, title, request, response, expect, pass, note });
  console.log(`${pass ? 'PASS' : 'FAIL'} ${id} ${title} → ${response.status ?? ''}`);
}

const summarizeOptions = (o) => ({ challenge: o.challenge, rp: o.rp, user: o.user && { name: o.user.name }, allowCredentials: o.allowCredentials?.length, excludeCredentials: o.excludeCredentials?.length });
const bodyShape = (credential, name) => ({
  name,
  response: {
    id: credential.id,
    type: credential.type,
    response: Object.fromEntries(Object.entries(credential.response).map(([k, v]) => [k, Array.isArray(v) ? v : `${String(v).slice(0, 16)}… (${String(v).length}자)`])),
  },
  들어있는_필드: Object.keys(credential.response),
  개인키_포함: Object.keys(credential.response).some((k) => /private|secret|d$/i.test(k)),
});

async function register(client, auth, username, passkeyName) {
  const opt = await client.call('POST', '/api/register/options', { username });
  const credential = auth.create(opt.json, ORIGIN);
  const body = { response: credential, name: passkeyName };
  const verify = await client.call('POST', '/api/register/verify', body);
  return { opt, credential, body, verify };
}

async function login(client, auth, username, opts = {}) {
  const opt = await client.call('POST', '/api/login/options', username ? { username } : {});
  const assertion = auth.get(opt.json, ORIGIN, opts);
  const body = { response: assertion };
  const verify = await client.call('POST', '/api/login/verify', body);
  return { opt, assertion, body, verify };
}

const A = new Client('A'), B = new Client('B'), C = new Client('C'), anon = new Client('anon');
const keyA1 = new SoftAuthenticator('A-노트북'), keyA2 = new SoftAuthenticator('A-휴대폰'), keyB = new SoftAuthenticator('B-노트북');

// ── 1. 공개/비공개 경계 ───────────────────────────
{
  const res = await fetch(BASE + '/');
  const html = await res.text();
  record('1-1', ['T08-C10', 'T08-C11'], '로그인 없이 첫 화면(공개 소개 페이지)이 열린다', { method: 'GET', path: '/' },
    { status: res.status, 포함: { 공개소개: html.includes('주요 프로젝트'), 비공개경계: html.includes('비공개 서랍') } },
    '200 + 공개 소개 내용 + 비공개 영역 경계', res.status === 200 && html.includes('주요 프로젝트') && html.includes('비공개 서랍'));
  const r = await anon.call('GET', '/api/private');
  record('1-2', ['T08-C16', 'T08-C17'], '패스키 없이 비공개 자료를 서버에 직접 요청', { method: 'GET', path: '/api/private', cookie: '없음' }, r, '401', r.status === 401);
}

// ── 2. 등록 ─────────────────────────────────────
const optA1 = await A.call('POST', '/api/register/options', { username: names.a });
const optA2 = await A.call('POST', '/api/register/options', { username: names.a });
record('2-1', ['T08-C19', 'T08-C20'], '등록 질문은 요청마다 다르다',
  { method: 'POST', path: '/api/register/options', body: { username: names.a }, 횟수: 2 },
  { status: [optA1.status, optA2.status], challenges: [optA1.json.challenge, optA2.json.challenge] },
  '두 값이 다르다', optA1.status === 200 && optA1.json.challenge !== optA2.json.challenge);

const credA1 = keyA1.create(optA2.json, ORIGIN);
const regBodyA = { response: credA1, name: 'A 노트북' };
const regA = await A.call('POST', '/api/register/verify', regBodyA);
record('2-2', ['T08-C21', 'T08-C23', 'T08-C24'], '등록 완료 — 본문에는 공개키 관련 값만 실린다',
  { method: 'POST', path: '/api/register/verify', body: bodyShape(credA1, 'A 노트북') },
  { status: regA.status, json: regA.json, setCookie: regA.setCookie }, '201 + 세션 쿠키(HttpOnly; SameSite=Strict)',
  regA.status === 201 && /HttpOnly/.test(regA.setCookie || '') && /SameSite=Strict/.test(regA.setCookie || ''));

const regReplay = await C.call('POST', '/api/register/verify', regBodyA);
record('2-3', ['T08-C19'], '같은 등록 응답을 한 번 더 보냄(질문 재사용)', { method: 'POST', path: '/api/register/verify', body: '2-2와 같은 본문' },
  regReplay, '401 challenge_invalid', regReplay.status === 401 && regReplay.json.error === 'challenge_invalid');

const optC = await C.call('POST', '/api/register/options', { username: names.c });
// 사용자가 기기 창에서 취소 → verify를 보내지 않는다. 같은 이름표로 다시 등록 질문이 나오면 계정이 저장되지 않은 것.
const optC2 = await C.call('POST', '/api/register/options', { username: names.c });
const meC = await C.call('GET', '/api/me');
meC.status = meC.json.authenticated ? 200 : 401; // me는 상태 확인용이라 200으로 오고, 로그인 여부만 본다
record('2-4', ['T08-C25'], '등록을 중간에 취소하면 계정이 만들어지지 않는다',
  { 순서: ['POST /api/register/options', '(기기 창 취소 — verify 없음)', '같은 이름표로 다시 options', 'GET /api/me'] },
  { status: [optC.status, optC2.status, meC.status], 두번째_options: optC2.json.error || '새 질문 발급(=이름표 미사용)' },
  '두 번째 options도 200(이미 쓰는 이름표 409가 아님), me 401', optC.status === 200 && optC2.status === 200 && meC.status === 401);

const dup = await C.call('POST', '/api/register/options', { username: names.a });
record('2-5', [], '이미 있는 이름표로 새 계정 등록 시도', { method: 'POST', path: '/api/register/options', body: { username: names.a } }, dup, '409', dup.status === 409);

// ── 3. 로그인 ───────────────────────────────────
await A.call('POST', '/api/logout', {});
const l1 = await login(A, keyA1, names.a);
const tokenA1 = A.cookie;
record('3-1', ['T08-C27', 'T08-C29', 'T08-C30'], '패스키 로그인 성공(서명을 공개키로 확인)',
  { method: 'POST', path: '/api/login/verify', options: summarizeOptions(l1.opt.json), body: { id: l1.assertion.id, 필드: Object.keys(l1.assertion.response) } },
  { status: l1.verify.status, json: l1.verify.json, setCookie: l1.verify.setCookie }, '200 + 새 세션', l1.verify.status === 200);

const loginReplay = await C.call('POST', '/api/login/verify', l1.body);
record('3-2', ['T08-C31'], '이미 쓴 질문(3-1의 응답 그대로)으로 다시 로그인', { method: 'POST', path: '/api/login/verify', body: '3-1과 같은 본문' },
  loginReplay, '401 challenge_invalid', loginReplay.status === 401 && loginReplay.json.error === 'challenge_invalid');

const l2opt = await C.call('POST', '/api/login/options', { username: names.a });
record('3-3', ['T08-C28'], '로그인 질문도 요청마다 다르다', { method: 'POST', path: '/api/login/options', 횟수: 2 },
  { challenges: [l1.opt.json.challenge, l2opt.json.challenge] }, '두 값이 다르다', l1.opt.json.challenge !== l2opt.json.challenge);

const badSig = keyA1.get(l2opt.json, ORIGIN, { tamper: true });
const badRes = await C.call('POST', '/api/login/verify', { response: badSig });
record('3-4', ['T08-C30'], '서명 끝 1비트를 바꾼 로그인(틀린 서명)', { method: 'POST', path: '/api/login/verify', body: { id: badSig.id, signature: '마지막 바이트 변조' } },
  badRes, '401 signature_invalid', badRes.status === 401 && badRes.json.reason === 'signature_invalid');

const badReuse = await C.call('POST', '/api/login/verify', { response: keyA1.get(l2opt.json, ORIGIN) });
record('3-5', ['T08-C31'], '실패한 질문을 올바른 서명으로 다시 써도 거절', { 설명: '3-4에서 실패한 같은 질문에 올바른 서명' },
  badReuse, '401 challenge_invalid', badReuse.status === 401 && badReuse.json.error === 'challenge_invalid');

const wrongOrigin = await C.call('POST', '/api/login/options', {}, { origin: 'https://evil.example' });
record('3-6', [], '다른 출처에서 보낸 요청', { method: 'POST', path: '/api/login/options', headers: { Origin: 'https://evil.example' } },
  wrongOrigin, '403', wrongOrigin.status === 403);

const phishOpt = await C.call('POST', '/api/login/options', { username: names.a });
const phish = keyA1.get(phishOpt.json, 'https://evil.example');
const phishRes = await C.call('POST', '/api/login/verify', { response: phish });
record('3-7', [], '다른 사이트 주소로 서명된 응답(피싱 사이트 흉내)', { clientDataJSON_origin: 'https://evil.example' },
  phishRes, '401 origin_mismatch', phishRes.status === 401 && phishRes.json.reason === 'origin_mismatch');

const raceOpt = await C.call('POST', '/api/login/options', { username: names.a });
const raceBody = { response: keyA1.get(raceOpt.json, ORIGIN) };
const race = await Promise.all([new Client('r1').call('POST', '/api/login/verify', raceBody), new Client('r2').call('POST', '/api/login/verify', raceBody)]);
record('3-8', ['T08-C31'], '같은 로그인 응답을 동시에 두 번 보냄', { 설명: '같은 본문 두 개를 Promise.all로 동시에 전송' },
  { status: race.map((r) => r.status), reason: race.map((r) => r.json.error || 'ok') }, '하나만 200, 나머지 401',
  race.filter((r) => r.status === 200).length === 1 && race.filter((r) => r.status === 401).length === 1);

// ── 4. 두 번째 계정과 교차 접근 ─────────────────────
const regB = await register(B, keyB, names.b, 'B 노트북');
const listA = await A.call('GET', '/api/private');
const listB = await B.call('GET', '/api/private');
record('4-1', ['T08-C36', 'T08-C14'], '두 계정이 각자 다른 비공개 자료를 가진다', { method: 'GET', path: '/api/private', 계정: ['A', 'B'] },
  { status: [listA.status, listB.status], A: listA.json.notes?.map((n) => n.body), B: listB.json.notes?.map((n) => n.body) },
  '둘 다 200, 3건 이상, 내용이 다르다',
  regB.verify.status === 201 && listA.json.notes?.length >= 3 && listB.json.notes?.length >= 3 && listA.json.notes[0].body !== listB.json.notes[0].body);

const bNoteId = listB.json.notes[0].id;
const aNoteId = listA.json.notes[0].id;
const aReadsB = await A.call('GET', `/api/private?id=${bNoteId}`);
record('4-2', ['T08-C37'], 'A로 들어가 B의 자료를 id로 직접 요청', { method: 'GET', path: `/api/private?id=${bNoteId}`, 세션: 'A' }, aReadsB, '404', aReadsB.status === 404);
const bReadsA = await B.call('GET', `/api/private?id=${aNoteId}`);
record('4-3', ['T08-C38'], 'B로 들어가 A의 자료를 id로 직접 요청', { method: 'GET', path: `/api/private?id=${aNoteId}`, 세션: 'B' }, bReadsA, '404', bReadsA.status === 404);

const before = (await B.call('GET', '/api/private')).json.notes.length;
const aDeletesB = await A.call('DELETE', `/api/private?id=${bNoteId}`);
const after = (await B.call('GET', '/api/private')).json.notes.length;
record('4-4', ['T08-C39'], 'A가 B의 자료 삭제 시도 — 거절 앞뒤 B의 자료 건수', { method: 'DELETE', path: `/api/private?id=${bNoteId}`, 세션: 'A' },
  { status: aDeletesB.status, json: aDeletesB.json, B_건수: { 전: before, 후: after } }, '404, 건수 같음', aDeletesB.status === 404 && before === after);
const beforeA = (await A.call('GET', '/api/private')).json.notes.length;
const bDeletesA = await B.call('DELETE', `/api/private?id=${aNoteId}`);
const afterA = (await A.call('GET', '/api/private')).json.notes.length;
record('4-5', ['T08-C38', 'T08-C39'], 'B가 A의 자료 삭제 시도 — 반대 방향', { method: 'DELETE', path: `/api/private?id=${aNoteId}`, 세션: 'B' },
  { status: bDeletesA.status, A_건수: { 전: beforeA, 후: afterA } }, '404, 건수 같음', bDeletesA.status === 404 && beforeA === afterA);

const spoofGet = await A.call('GET', `/api/private?userId=${names.b}&owner=${names.b}`);
const spoofPost = await A.call('POST', '/api/private', { owner: names.b, userId: names.b, title: '주인 바꿔치기 시도', body: 'owner 값을 B로 넣어 보냄' });
const bAfterSpoof = await B.call('GET', '/api/private');
record('4-6', ['T08-C40'], '주소·본문에 B의 계정 값을 넣어 보낸 요청', {
  get: `/api/private?userId=${names.b}&owner=${names.b}`, post: { path: '/api/private', body: { owner: names.b, userId: names.b, title: '주인 바꿔치기 시도' } }, 세션: 'A',
}, { get: { status: spoofGet.status, owner: spoofGet.json.owner, 건수: spoofGet.json.notes?.length }, post: { status: spoofPost.status, owner: spoofPost.json.owner }, B_자료에_생겼나: bAfterSpoof.json.notes.some((n) => n.title === '주인 바꿔치기 시도') },
'GET은 A 자료만, POST는 A 자료로 저장, B에는 안 생김',
  spoofGet.json.owner === names.a && spoofPost.json.owner === names.a && !bAfterSpoof.json.notes.some((n) => n.title === '주인 바꿔치기 시도'));

const otherOpt = await C.call('POST', '/api/login/options', { username: names.a });
const otherKey = keyB.get(otherOpt.json, ORIGIN, { credentialId: regB.credential.id });
const otherRes = await C.call('POST', '/api/login/verify', { response: otherKey });
record('4-7', ['T08-C50'], 'A의 이름표로 시작해 B의 패스키로 서명(남의 패스키)', { 이름표: names.a, 서명한_패스키: 'B 노트북' },
  otherRes, '401 credential_owner_mismatch', otherRes.status === 401 && otherRes.json.reason === 'credential_owner_mismatch');

// ── 5. 로그아웃 뒤 같은 세션 값 ────────────────────
const saved = A.cookie;
const beforeLogout = await A.call('GET', '/api/private');
const out = await A.call('POST', '/api/logout', {});
const reuse = await anon.call('GET', '/api/private', undefined, { cookie: saved });
record('5-1', ['T08-C32', 'T08-C33', 'T08-C34'], '로그아웃 뒤 같은 세션 값으로 다시 요청', {
  세션: '쿠키(HttpOnly) 값을 서버 sha256 해시와 대조', 쿠키: mask(saved.split('=')[1]),
  순서: ['GET /api/private', 'POST /api/logout', '같은 쿠키로 GET /api/private'],
}, { status: [beforeLogout.status, out.status, reuse.status], logoutSetCookie: out.setCookie, 지운_세션: out.json.sessionsRemoved }, '200 → 200 → 401',
  beforeLogout.status === 200 && out.status === 200 && reuse.status === 401);

// ── 6. 패스키 두 개, 하나 지우기 ─────────────────────
await login(A, keyA1, names.a);
const addOpt = await A.call('POST', '/api/passkeys/options', {});
let sameDevice;
try { keyA1.create(addOpt.json, ORIGIN); sameDevice = '등록됨(문제)'; } catch (error) { sameDevice = error.name; }
record('6-1', ['T08-C42'], '같은 인증기로 두 번째 패스키 — 이미 있는 패스키는 제외 목록으로 막힌다',
  { method: 'POST', path: '/api/passkeys/options', excludeCredentials: addOpt.json.excludeCredentials?.length }, { 인증기_결과: sameDevice }, 'InvalidStateError', sameDevice === 'InvalidStateError');

const credA2 = keyA2.create(addOpt.json, ORIGIN);
const add = await A.call('POST', '/api/passkeys/verify', { response: credA2, name: 'A 휴대폰' });
const pk = await A.call('GET', '/api/passkeys');
record('6-2', ['T08-C42', 'T08-C43'], '다른 인증기로 두 번째 패스키 등록 후 목록', { method: 'POST', path: '/api/passkeys/verify', body: { name: 'A 휴대폰' } },
  { status: [add.status, pk.status], passkeys: pk.json.passkeys?.map(({ name, createdAt, storedIn }) => ({ name, createdAt, storedIn })) },
  '201, 목록 2개(이름·등록일)', add.status === 201 && pk.json.passkeys?.length === 2);

const dupCred = await A.call('POST', '/api/passkeys/options', {});
const dupRes = await A.call('POST', '/api/passkeys/verify', { response: { ...credA2, response: { ...credA2.response, clientDataJSON: Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: dupCred.json.challenge, origin: ORIGIN })).toString('base64url') } }, name: '중복' });
record('6-3', [], '이미 등록된 패스키 응답을 새 질문에 붙여 다시 등록', { 설명: '같은 credential id, 새 challenge' }, dupRes, '400 또는 409', [400, 409].includes(dupRes.status));

const del = await A.call('DELETE', `/api/passkeys?id=${encodeURIComponent(credA1.id)}`);
await A.call('POST', '/api/logout', {});
const viaA2 = await login(A, keyA2, names.a);
record('6-4', ['T08-C44'], 'A 노트북 패스키를 지운 뒤 남은 A 휴대폰으로 로그인', { 삭제: `DELETE /api/passkeys?id=${credA1.id.slice(0, 8)}…`, 로그인: 'A 휴대폰' },
  { status: [del.status, viaA2.verify.status], 남은_패스키: del.json.remaining }, '200, 200', del.status === 200 && viaA2.verify.status === 200);
await A.call('POST', '/api/logout', {});
const viaA1 = await login(C, keyA1, names.a, { credentialId: credA1.id }).catch((e) => ({ verify: { status: e.name } }));
const viaA1Free = await (async () => {
  const opt = await C.call('POST', '/api/login/options', {});
  return C.call('POST', '/api/login/verify', { response: keyA1.get(opt.json, ORIGIN, { credentialId: credA1.id }) });
})();
record('6-5', ['T08-C45'], '지운 패스키(인증기에는 아직 남아 있음)로 로그인', { 설명: '서버에서만 지웠고 인증기에는 개인키가 남은 상태로 서명' },
  { 이름표_지정: viaA1.verify.status, 이름표_없이: { status: viaA1Free.status, json: viaA1Free.json } }, '401 credential_unknown',
  viaA1Free.status === 401 && viaA1Free.json.reason === 'credential_unknown');

await login(A, keyA2, names.a);
const lastDel = await A.call('DELETE', `/api/passkeys?id=${encodeURIComponent(credA2.id)}`);
const stillIn = await A.call('GET', '/api/passkeys');
record('6-6', ['T08-C46'], '마지막 남은 패스키 삭제 시도', { method: 'DELETE', path: '/api/passkeys?id=(마지막 패스키)' },
  { status: lastDel.status, json: lastDel.json, 남은_패스키: stillIn.json.passkeys?.length }, '409 last_passkey, 1개 유지', lastDel.status === 409 && stillIn.json.passkeys?.length === 1);

const crossDel = await A.call('DELETE', `/api/passkeys?id=${encodeURIComponent(regB.credential.id)}`);
record('6-7', [], 'A가 B의 패스키 삭제 시도', { method: 'DELETE', path: '/api/passkeys?id=(B의 패스키)', 세션: 'A' }, crossDel, '404', crossDel.status === 404);

// ── 7. 소스 노출 ────────────────────────────────
const pages = ['/', '/index.html', '/private.js', '/app.js'];
const leaks = [];
for (const path of pages) {
  const text = await (await fetch(BASE + path)).text();
  for (const note of [...listA.json.notes, ...listB.json.notes]) if (text.includes(note.body)) leaks.push({ path, note: note.title });
  if (text.includes(names.a) || text.includes(names.b)) leaks.push({ path, note: '계정 이름표' });
}
record('7-1', ['T08-C18'], '로그인 없이 받은 페이지·스크립트 소스에 비공개 내용이 없다', { 확인한_파일: pages, 찾은_문자열: '두 계정의 비공개 자료 본문 6건 + 이름표 2개' },
  { 발견: leaks }, '0건', leaks.length === 0);

const result = { base: BASE, ranAt: new Date().toISOString(), accounts: names, total: log.length, failed: failures, steps: log };
await writeFile(OUT, JSON.stringify(result, null, 2) + '\n');
console.log(`\n${log.length - failures}/${log.length} 통과 → ${OUT}`);
process.exitCode = failures ? 1 : 0;
