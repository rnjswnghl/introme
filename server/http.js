import { config, sessionCookieName } from './config.js';

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function send(res, status, body, headers = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  for (const [key, value] of Object.entries(headers)) res.setHeader(key, value);
  res.end(JSON.stringify(body));
}

export async function readJson(req) {
  // Vercel은 req.body를 미리 해석해 둔다. 로컬 개발 서버는 스트림을 직접 읽는다.
  if (req.body !== undefined) {
    if (typeof req.body === 'string') return req.body ? JSON.parse(req.body) : {};
    return req.body || {};
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new HttpError(413, 'body_too_large', '요청 본문이 너무 큽니다.');
    chunks.push(chunk);
  }
  const text = Buffer.concat(chunks).toString('utf8');
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', '요청 형식이 올바르지 않습니다.');
  }
}

export function parseCookies(req) {
  const header = req.headers.cookie || '';
  return Object.fromEntries(
    header
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf('=');
        return [part.slice(0, index), decodeURIComponent(part.slice(index + 1))];
      }),
  );
}

export function sessionCookie(token, maxAgeSeconds) {
  const attributes = [
    `${sessionCookieName}=${token}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (config.secure) attributes.push('Secure');
  return attributes.join('; ');
}

// 상태를 바꾸는 요청은 같은 출처에서 JSON으로 온 것만 받는다(SameSite=Strict와 이중 방어).
export function assertSameOriginWrite(req) {
  if (req.method === 'GET' || req.method === 'HEAD') return;
  if (req.headers.origin !== config.origin) {
    throw new HttpError(403, 'origin_rejected', '허용되지 않은 출처의 요청입니다.');
  }
  const type = req.headers['content-type'] || '';
  if (req.method === 'POST' && !type.startsWith('application/json')) {
    throw new HttpError(415, 'json_required', 'JSON 요청만 받습니다.');
  }
}

export function wrap(handler, methods) {
  return async (req, res) => {
    try {
      if (!methods.includes(req.method)) {
        res.setHeader('Allow', methods.join(', '));
        throw new HttpError(405, 'method_not_allowed', '허용되지 않은 방식입니다.');
      }
      assertSameOriginWrite(req);
      await handler(req, res);
    } catch (error) {
      if (error instanceof HttpError) {
        // 거절 이유를 서버 로그에 남긴다(세션·자격 증명 값은 남기지 않는다).
        if (error.code !== 'login_required') {
          console.warn(`[t08] ${req.method} ${req.url.split('?')[0]} → ${error.status} ${error.code}${error.extra?.reason ? ` (${error.extra.reason})` : ''}`);
        }
        send(res, error.status, { error: error.code, message: error.message, ...error.extra });
        return;
      }
      if (error.code === 'db_not_configured') {
        send(res, 503, { error: error.code, message: '저장소가 아직 연결되지 않았습니다.' });
        return;
      }
      console.error('[t08]', error);
      send(res, 500, { error: 'server_error', message: '서버에서 처리하지 못했습니다.' });
    }
  };
}
