# T08 · 비밀번호 없이 나만 들어가는 비공개 서랍

1번 과제의 소개 페이지(dist/)는 그대로 두고, 04번 탭에 패스키로만 열리는 비공개 서랍을 이어 붙였다. 비밀번호 칸은 어디에도 없다.

| 항목 | 값 |
| --- | --- |
| 공개 결과물 | https://introme-t08.vercel.app (비공개 서랍: `#private`) |
| 소스 | https://github.com/rnjswnghl/introme/tree/t08-passkey |
| 1번 공개 페이지 | https://intro.rnjswnghl.chatgpt.site/ 는 손대지 않고 보존 |
| 배포 | Vercel `introme-t08`, Node 22, 함수 지역 iad1. DB는 Neon Postgres의 `t08_` 표 |

## 공개와 비공개의 경계

- 00 홈 · 01 프로젝트 · 02 소개 · 03 링크: 누구나 보는 공개 영역. 1번 내용 그대로.
- 04 비공개: 짙은 먹색 탭, 자물쇠, 점선으로 공개 탭과 떨어뜨렸다. 열면 맨 위에 `여기부터 비공개 영역` 인장 띠가 있다.
- 로그인 전에는 봉인된 세 칸(준비 중인 프로젝트 메모 · 지원하려는 곳 목록 · 스스로 쓰는 회고)의 **이름만** 보인다. 내용은 HTML·JS 어디에도 없고, 서버가 세션을 확인한 뒤 `/api/private` 응답으로만 내려온다.
- 서랍 내용은 만들어 넣은 연습용 문장이다. 실제 연락처·신분증 번호 같은 개인정보는 넣지 않았다.

## 인증 구현 설명서

### ① 무엇으로 붙였나

| 쓰임 | 이름 · 버전 |
| --- | --- |
| 서버 쪽 WebAuthn 검증(질문 생성, 등록 응답·서명 확인) | `@simplewebauthn/server` 13.3.3 |
| 브라우저 쪽 패스키 호출(`navigator.credentials` 감싸기) | `@simplewebauthn/browser` 13.3.0, `dist/vendor/`에 자체 호스팅 |
| 저장소 | Neon Postgres + `pg`(node-postgres) |
| 서버 실행 | Vercel Functions(`api/`), Node 22 |
| 외부 인증 서비스 | 쓰지 않음. 계정·세션·질문 보관은 직접 만든 코드 |

### ② 왜 그걸 골랐나

- **직접 구현 + 검증 라이브러리.** 이번 과제의 핵심은 "비밀번호 자리를 무엇이 대신하는지"를 직접 보는 것이다. Auth0·Clerk 같은 서비스를 쓰면 질문 보관·재사용 차단이 서비스 안에 숨어 기록으로 보여 줄 수 없다. 반대로 CBOR·서명 검증까지 손으로 짜면 실수할 곳이 너무 많다. 그래서 암호 검증만 라이브러리에 맡기고, 질문을 언제 만들고 언제 지우는지·세션을 어떻게 끊는지는 직접 썼다.
- **SimpleWebAuthn.** 서버·브라우저가 같은 JSON 모양을 주고받고, 의존성이 적고, 공식 문서에 질문 보관을 서버가 해야 한다고 명시돼 있다.
- **Postgres(Neon).** 질문을 한 번만 쓰게 하려면 "꺼내면서 지우기"가 한 동작이어야 한다. `delete … returning` 한 문장이 그걸 보장한다. 파일 저장소(Vercel Blob 등)는 이 원자성이 없고 읽기 캐시 때문에 로그아웃 직후 세션이 살아 보일 수 있어 뺐다. T07에서 이미 쓰던 Neon을 표 이름만 나눠 다시 쓴다.
- **Vercel.** 1번 페이지는 정적 호스팅(chatgpt.site)이라 서버를 붙일 수 없다. 같은 `dist/`를 그대로 내보내면서 `api/` 함수를 함께 올릴 수 있어 T07과 같은 곳을 골랐다.

### ③ 어디를 어떻게 고쳤나 — 네 흐름이 지나는 소스

| 흐름 | 화면(브라우저) | 서버 |
| --- | --- | --- |
| 등록 | `dist/private.js` `[data-register-form]` → `startRegistration` | `server/handlers.js` `registerOptions`(78행) → `registerVerify`(104행). 질문 보관 `server/auth.js` `saveChallenge`(9행) |
| 로그인 | `dist/private.js` `[data-login-form]` → `startAuthentication` | `server/handlers.js` `loginOptions`(207행) → `loginVerify`(233행), 세션 발급 `server/auth.js` `createSession`(42행) |
| 로그아웃 | `dist/private.js` `[data-logout]` | `server/handlers.js` `logout`(273행) → `server/auth.js` `destroySession`(70행, 세션 행 삭제) |
| 비공개 자료 조회 | `dist/private.js` `renderNotes` | `server/handlers.js` `privateNotes`(310행) — `requireSession`(auth.js 64행) 통과 뒤 `user_id = 세션 주인` 조건으로만 조회 |

그 밖에 패스키 추가 `addPasskeyOptions/Verify`(159·179행), 목록·삭제 `passkeys`(285행), 표 정의 `server/db.js`, 경로별 진입 파일 `api/**.js`, 보안 헤더 `vercel.json`.

1번 페이지에서 바뀐 곳은 `dist/index.html`의 04 탭·패널·스크립트 두 줄, `dist/app.js`의 탭 전환 이벤트 한 줄, `dist/styles.css` 끝의 T08 블록뿐이다.

#### 거절을 만드는 소스 위치

| 거절 | 위치 | 응답 |
| --- | --- | --- |
| 로그인 없이 비공개 자료 요청 | `server/auth.js` `requireSession` 64행 | 401 `login_required` |
| 이미 쓴(또는 만료된) 질문 | `server/auth.js` `consumeChallenge` 29행 `delete … returning` | 401 `challenge_invalid` |
| 서버에 없는(지운) 패스키 | `server/handlers.js` 240행 | 401 `credential_unknown` |
| 남의 패스키(이름표와 주인이 다름) | `server/handlers.js` 242행 | 401 `credential_owner_mismatch` |
| 틀린 서명·다른 사이트 주소 | `server/handlers.js` `verifyAuthenticationResponse` catch | 401 `signature_invalid` / `origin_mismatch` |
| 남의 자료 읽기·지우기 | `server/handlers.js` 319·354행 `and user_id = $2` | 404 |
| 마지막 패스키 삭제 | `server/handlers.js` 300행 | 409 `last_passkey` |
| 다른 출처의 쓰기 요청 | `server/http.js` `assertSameOriginWrite` 69행 | 403 `origin_rejected` |

### ④ 안 열리는 것을 확인한 기록

전체 요청·응답: 로컬 `docs/T08-evidence-local.json`(31항목), 공개 주소 `docs/T08-evidence-public.json`, 화면 `docs/T08-browser-check.json` + `docs/screenshots/T08-*.png`. 세션 값은 앞 6자만 남기고 가렸다.

| 확인 | 통과한 요청 | 거절된 요청 |
| --- | --- | --- |
| 로그인 없이 열기 | — | `GET /api/private`(쿠키 없음) → **401**. 로그인 없이 받은 `/`, `/private.js`, `/app.js`에서 두 계정의 비공개 문장 6건·이름표 검색 → **0건** |
| 남의 패스키로 로그인 | A 이름표 + A 패스키 → **200** | A 이름표로 받은 질문에 B 패스키로 서명 → **401 credential_owner_mismatch** |
| 이미 쓴 질문 재사용 | 새 질문 + 서명 → **200** | 같은 본문 재전송 → **401 challenge_invalid**. 같은 본문 동시 2회 → **200 1건, 401 1건**. 서명이 틀려 실패한 질문에 올바른 서명을 다시 붙여도 → **401** |
| 패스키 삭제 뒤 로그인 | 남은 두 번째 패스키 → **200** | 지운 패스키(기기에는 개인키가 남아 있음) → **401 credential_unknown** |

함께 확인한 것: 두 계정 서로의 자료 id 직접 요청 양방향 **404**, 거절 앞뒤 상대 자료 건수 동일, 주소(`?userId=`)·본문(`owner`)에 상대 이름표를 넣어도 내 자료만 응답, 로그아웃 뒤 같은 쿠키 **200 → 401**, 다른 출처 요청 **403**, 피싱 주소로 서명된 응답 **401 origin_mismatch**.

### ⑤ AI와 나

제출문 `docs/T08-submission.md`의 세 줄을 본인 말로 확정한다(아래는 실제로 나눈 역할).

- AI(Claude)가 한 일: 서버·화면 코드 작성, 소프트웨어 인증기와 확인 스크립트 작성, 로컬·공개 주소 검증 실행, Vercel 프로젝트 설정과 배포, 이 문서 초안.
- 사람이 한 일: 1번 소개 페이지 위에 이어 붙이기와 T07처럼 Vercel·Neon을 쓰는 방향 지정, Neon 연결 문자열 직접 입력, 실제 기기로 패스키 등록·두 번째 기기 등록·삭제 확인.

### ⑥ 아직 못 막은 것

1. **요청 횟수 제한이 없다.** `/api/register/options`를 반복 호출하면 질문 표에 5분짜리 행이 계속 쌓이고, 409 `username_taken` 응답으로 어떤 이름표가 있는지 하나씩 알아낼 수 있다. Vercel 방화벽 규칙이나 IP별 제한이 필요하다.
2. **패스키를 지울 때 다시 확인하지 않는다.** 로그인된 화면을 누가 잠깐 만지면, 그 세션으로 내 다른 패스키를 지울 수 있다(마지막 하나만 막혀 있다). 삭제 직전에 패스키 서명을 한 번 더 받는 단계가 없다.
3. **패스키를 지워도 그 패스키로 이미 만든 세션은 8시간 동안 살아 있다.** 잃어버린 기기의 패스키를 지우는 상황이라면 그 기기의 세션도 함께 끊어야 한다.
4. **모든 패스키를 잃으면 돌아올 길이 없다.** 마지막 하나는 지울 수 없게 했지만, 그 하나가 든 기기를 잃으면 계정은 영원히 잠긴다. 복구 코드나 이메일 같은 두 번째 경로를 일부러 만들지 않았다(만들면 그게 비밀번호 자리를 다시 차지한다).
5. **거절 이유 코드가 응답에 그대로 나간다.** 확인 기록을 남기려고 `reason`을 넣었는데, 공격자에게 "그 credential id가 서버에 있는지"를 알려 주는 단서가 된다. 실제 서비스라면 서버 로그로만 남긴다.
6. **질문 보관 시간 5분 동안은 같은 질문을 다른 응답으로 노릴 수 있다.** 한 번 쓰면 지워지지만, 쓰기 전에는 살아 있다.

## 마지막 패스키를 지우려고 하면

서버가 409로 거절하고 화면 버튼도 `마지막 하나라 지울 수 없음`으로 잠긴다. 패스키가 0개인 계정은 만들어질 수 없다. 대신 위 ⑥-4처럼 그 하나를 잃으면 복구할 수 없다.

## 검증 방법

```bash
npm install
npm run dev                                   # http://localhost:4180, 메모리 PGlite
node scripts/t08-passkey-check.mjs            # API 31항목 → docs/T08-evidence-local.json
node scripts/t08-browser-check.cjs            # Chrome 가상 인증기 12항목 + 캡처
node scripts/t08-passkey-check.mjs https://introme-t08.vercel.app docs/T08-evidence-public.json
```

`scripts/soft-authenticator.mjs`는 P-256 키를 메모리에 만들어 WebAuthn 규격대로 응답·서명하는 검증용 인증기다. 실제 기기 패스키와 같은 서버 경로를 지나지만, 실제 기기의 저장 위치(Google 비밀번호 관리자 등)는 사람이 직접 등록해서 확인했다.
