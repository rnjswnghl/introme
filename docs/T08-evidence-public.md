# T08 공개 주소 검증 기록

- 대상: https://introme-t08.vercel.app (배포 dpl_7Etrd388giBydVjjYtJMfnpV9eVB, 커밋 e1fb8da, 함수 지역 sin1)
- 실행: 2026-10-29T08:29:28Z, Vercel Sandbox(sin1)에서 `node scripts/t08-passkey-check.mjs https://introme-t08.vercel.app`
- 결과: **31/31 통과**. 요청·응답 전문은 실행 환경에서 생성됐고, 아래는 그 결과를 옮긴 요약이다. 같은 명령으로 언제든 다시 만들 수 있다(새 계정이 만들어진다).
- 이 실행으로 만들어진 계정: `t08a-a896t`, `t08b-a896t`(각자 패스키·비공개 자료 보유, 소프트웨어 인증기). `t08c-a896t`는 등록을 끝내지 않아 **계정이 없다**(아래 DB 확인).

## 단계별 결과

| id | 확인 | 결과 |
| --- | --- | --- |
| 1-1 | 로그인 없이 첫 화면(공개 소개) | 200, 공개 내용·비공개 경계 문구 있음 |
| 1-2 | 쿠키 없이 `GET /api/private` | **401** login_required |
| 2-1 | 등록 질문 2회 | 200·200, `kqpEjB-yqKS…` ≠ `Aw_gq-UCpV9…` |
| 2-2 | 등록 완료 | 201, `__Host-t08_session=l573CW…(가림); Path=/; HttpOnly; SameSite=Strict; Max-Age=28800; Secure` |
| 2-3 | 같은 등록 응답 재전송 | **401** challenge_invalid |
| 2-4 | 등록 중간 취소 뒤 같은 이름표 | 200 → 200(이름표 미사용) → 로그인 안 됨 |
| 2-5 | 이미 있는 이름표 | 409 username_taken |
| 3-1 | 패스키 로그인 | **200** |
| 3-2 | 3-1 응답 그대로 재전송 | **401** challenge_invalid |
| 3-3 | 로그인 질문 2회 | `czKWqm2sy8…` ≠ `X9CAcw3n0A…` |
| 3-4 | 서명 마지막 바이트 변조 | **401** signature_invalid |
| 3-5 | 실패한 질문에 올바른 서명 | **401** challenge_invalid |
| 3-6 | Origin `https://evil.example` | 403 origin_rejected |
| 3-7 | 다른 사이트 주소로 서명된 응답 | **401** origin_mismatch |
| 3-8 | 같은 로그인 응답 동시 2회 | **200 1건, 401 1건**(challenge_invalid) |
| 4-1 | 두 계정의 비공개 자료 | 200·200, 각 3건, 내용 다름 |
| 4-2 | A 세션으로 B 자료 id | **404** |
| 4-3 | B 세션으로 A 자료 id | **404** |
| 4-4 | A가 B 자료 삭제 | **404**, B 자료 건수 앞뒤 같음 |
| 4-5 | B가 A 자료 삭제 | **404**, A 자료 건수 앞뒤 같음 |
| 4-6 | `?userId=t08b…&owner=t08b…`, 본문 `owner: t08b…` | GET 200 owner=`t08a-a896t` 3건, POST 201 owner=`t08a-a896t`, B 자료에 생기지 않음 |
| 4-7 | A 이름표 질문에 B 패스키 서명 | **401** credential_owner_mismatch |
| 5-1 | 로그아웃 뒤 같은 쿠키 | 200 → 로그아웃 200(`Max-Age=0; Secure`, 지운 세션 1) → **401** |
| 6-1 | 같은 인증기로 두 번째 패스키 | 인증기가 InvalidStateError(제외 목록) |
| 6-2 | 다른 인증기로 두 번째 패스키 | 201, 목록 2개 |
| 6-3 | 이미 등록된 패스키를 새 질문에 | 409 credential_exists |
| 6-4 | 첫 패스키 삭제 뒤 두 번째로 로그인 | 200 · **200** |
| 6-5 | 지운 패스키로 로그인 | **401** credential_unknown |
| 6-6 | 마지막 패스키 삭제 | 409 last_passkey, 1개 유지 |
| 6-7 | A가 B 패스키 삭제 | 404 |
| 7-1 | 로그인 없이 받은 `/`, `/index.html`, `/private.js`, `/app.js` | 비공개 문장·이름표 0건 |

## 서버 저장소(Neon `introme_t08`) 확인

`scripts/t08-db-snapshot.mjs`로 같은 시각에 확인.

- `t08_credentials` 열: id, user_id, **public_key**, counter, transports, device_type, backed_up, aaguid, name, created_at, last_used_at. 개인키를 담는 열은 없다.
- 저장된 값 예: `t08a-a896t` · `A 휴대폰` · public_key `pQECAyYgASFYIDZnOf2qjcmg… (103자)`(COSE 공개키, base64url). `t08b-a896t` · `B 노트북` · `pQECAyYgASFYIFZrlRE7-IZ1… (103자)`.
- `t08_sessions` 열: token_hash, user_id, credential_id, created_at, expires_at. 쿠키 원문이 아니라 sha256 해시(43자)만 있다.
- 이름표 확인: `t08c-a896t` 계정 없음(등록 취소), `t08a-a896t`·`t08b-a896t` 있음.
