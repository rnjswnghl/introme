// 검증용 소프트웨어 인증기. 실제 기기 대신 P-256 키 쌍을 메모리에 만들고
// WebAuthn 규격대로 등록 응답(attestation 'none')과 로그인 서명을 만든다.
// 개인키는 이 객체 안에만 있고 어떤 요청에도 실리지 않는다.
import { createHash, generateKeyPairSync, randomBytes, sign } from 'node:crypto';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const sha256 = (data) => createHash('sha256').update(data).digest();

// ── 최소 CBOR 인코더(정수·바이트·문자열·맵) ──
function head(major, value) {
  if (value < 24) return Buffer.from([(major << 5) | value]);
  if (value < 256) return Buffer.from([(major << 5) | 24, value]);
  if (value < 65536) return Buffer.from([(major << 5) | 25, value >> 8, value & 255]);
  const b = Buffer.alloc(5);
  b[0] = (major << 5) | 26;
  b.writeUInt32BE(value, 1);
  return b;
}
export function cbor(value) {
  if (Buffer.isBuffer(value) || value instanceof Uint8Array) return Buffer.concat([head(2, value.length), Buffer.from(value)]);
  if (typeof value === 'number') return value >= 0 ? head(0, value) : head(1, -1 - value);
  if (typeof value === 'string') {
    const s = Buffer.from(value, 'utf8');
    return Buffer.concat([head(3, s.length), s]);
  }
  if (value instanceof Map) {
    const parts = [head(5, value.size)];
    for (const [k, v] of value) parts.push(cbor(k), cbor(v));
    return Buffer.concat(parts);
  }
  if (typeof value === 'object') return cbor(new Map(Object.entries(value)));
  throw new Error('unsupported cbor value');
}

const FLAG_UP = 0x01;
const FLAG_UV = 0x04;
const FLAG_AT = 0x40;

export class SoftAuthenticator {
  constructor(label) {
    this.label = label;
    this.credentials = []; // { id, privateKey, rpId, userHandle, signCount }
  }

  create(options, origin, { rpIdOverride } = {}) {
    const excluded = new Set((options.excludeCredentials || []).map((c) => c.id));
    const existing = this.credentials.find((c) => excluded.has(c.id));
    if (existing) {
      const error = new Error('InvalidStateError: 이 인증기에는 이미 이 계정의 패스키가 있습니다.');
      error.name = 'InvalidStateError';
      throw error;
    }
    const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const jwk = publicKey.export({ format: 'jwk' });
    const credentialId = randomBytes(16);
    const rpId = rpIdOverride || options.rp.id;
    const cose = cbor(new Map([[1, 2], [3, -7], [-1, 1], [-2, Buffer.from(jwk.x, 'base64url')], [-3, Buffer.from(jwk.y, 'base64url')]]));
    const idLen = Buffer.alloc(2);
    idLen.writeUInt16BE(credentialId.length);
    const authData = Buffer.concat([
      sha256(rpId), Buffer.from([FLAG_UP | FLAG_UV | FLAG_AT]), Buffer.alloc(4),
      Buffer.alloc(16), idLen, credentialId, cose,
    ]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.create', challenge: options.challenge, origin, crossOrigin: false }));
    const attestationObject = cbor(new Map([['fmt', 'none'], ['attStmt', new Map()], ['authData', authData]]));
    this.credentials.push({ id: b64u(credentialId), privateKey, rpId, userHandle: options.user.id, signCount: 0 });
    return {
      id: b64u(credentialId),
      rawId: b64u(credentialId),
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(clientDataJSON),
        attestationObject: b64u(attestationObject),
        transports: ['internal'],
        publicKeyAlgorithm: -7,
        publicKey: b64u(publicKey.export({ format: 'der', type: 'spki' })),
        authenticatorData: b64u(authData),
      },
    };
  }

  // credentialId를 정하면 그 패스키로, 아니면 allowCredentials 중 가진 것으로 서명한다.
  get(options, origin, { credentialId, tamper = false } = {}) {
    const allowed = (options.allowCredentials || []).map((c) => c.id);
    const cred = credentialId
      ? this.credentials.find((c) => c.id === credentialId)
      : this.credentials.find((c) => !allowed.length || allowed.includes(c.id));
    if (!cred) {
      const error = new Error('NotAllowedError: 이 인증기에 맞는 패스키가 없습니다.');
      error.name = 'NotAllowedError';
      throw error;
    }
    cred.signCount += 1;
    const count = Buffer.alloc(4);
    count.writeUInt32BE(cred.signCount);
    const authData = Buffer.concat([sha256(cred.rpId), Buffer.from([FLAG_UP | FLAG_UV]), count]);
    const clientDataJSON = Buffer.from(JSON.stringify({ type: 'webauthn.get', challenge: options.challenge, origin, crossOrigin: false }));
    let signature = sign('sha256', Buffer.concat([authData, sha256(clientDataJSON)]), cred.privateKey);
    if (tamper) signature = Buffer.from(signature.map((byte, i) => (i === signature.length - 1 ? byte ^ 1 : byte)));
    return {
      id: cred.id,
      rawId: cred.id,
      type: 'public-key',
      authenticatorAttachment: 'platform',
      clientExtensionResults: {},
      response: {
        clientDataJSON: b64u(clientDataJSON),
        authenticatorData: b64u(authData),
        signature: b64u(signature),
        userHandle: cred.userHandle,
      },
    };
  }

  forget(credentialId) {
    this.credentials = this.credentials.filter((c) => c.id !== credentialId);
  }
}
