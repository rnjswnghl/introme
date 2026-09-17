# T01 배포 주소 변경 · 2026-09-17

- 기존 주소: https://joohoe-introme.rnjswnghl.chatgpt.site/#intro
- 요청 주소: https://rnjswnghl_intro.chatgpt.site/
- 최초 변경 주소: https://rnjswnghl-intro.rnjswnghl.chatgpt.site/
- Sites가 밑줄을 허용하지 않아 하이픈으로 변경했다. 변경 API가 반환한 주소에는 계정명 `rnjswnghl`이 별도 서브도메인으로 포함된다.
- 프로젝트: `appgprj_6aa25292a30c8191bc1e2854e4f14698`
- 기존 저장 버전 15를 재배포했다. 소스 커밋: `2a50a3c1d1577b6acd9d6c07bf8df7bcba177e38`
- 배포 ID: `appgdep_6aab44abf3f4819192dd4d8d35193299`
- 배포 결과: `succeeded`, 공개 범위 `public` 유지.
- 새 루트 주소 GET 응답 200, HTML의 `panel-intro`와 `app.js` 참조 확인.
- 기존 스크립트는 해시가 없을 때 intro를 열므로 공유 주소에 `#intro`를 붙일 필요가 없다.
- UI와 소스 구현은 변경하지 않았다. 기존 화면 검증 자료와 고정 커밋 링크는 보존했다. 이번 확인은 배포 상태 및 HTTP/HTML 확인이며, 화면·키보드 재검증은 수행하지 않았다.

## 최종 주소 정정

- 사용자 지시에 따라 중복 계정명 접두사 `rnjswnghl-`를 제거하고 슬러그를 `intro`로 변경했다.
- 최종 공개 주소: https://intro.rnjswnghl.chatgpt.site/
- Sites 응답: `slug_change.status=complete`, `slug=intro`, 저장 버전 15 유지.
- 최종 루트 주소 GET 응답 200 및 HTML의 `panel-intro` 확인.

## 공개 화면 검증과 Notion 기록 보완

- 2026-09-17 10:51 KST, 새 공개 주소를 로그인 없는 Chrome 컨텍스트로 열었다.
- 1366×768, 1920×1080, 390×844에서 HTTP 200, 기본 홈 표시, 클릭·Enter·Space 탭 전환 통과. 가로 넘침·콘솔 오류·실패 요청 모두 0.
- `T01-deployment-2026-09-17-validation.json`에 결과를 저장했다. 이번에는 대비 수치를 다시 측정하지 않았다.
- `screenshots/T01-deployment-2026-09-17-1366.png`, `-1920.png`, `-390.png`, `-interaction.png`에 홈 화면과 키보드 전환 결과를 새로 캡처했다. 이전 주소 시점 화면을 재현한 캡처가 아니다.
- 기록 대상: Aleph_work → T01 (`3d777405-36fc-81b7-9fdb-ea1f7ca2f121`). 주소 변경 과정·최종 결정·검증 결과와 캡처를 누적한다.
- AGENTS.md에 검증·캡처·Notion 업로드까지 완료 기준으로 명시했다.

## 연등 파비콘·`Intro_J` 제목 재배포

- 배포 소스: `d3e3cdd9495e5c64d159ebb7f050ad2ecc2afdfe`
- Sites 저장 버전: 16
- 배포 ID: `appgdep_6aab528ba2548191a086a27c2321b1f0`
- 배포 결과: `succeeded`, 기존 공개 범위 `public`과 주소 `https://intro.rnjswnghl.chatgpt.site/` 유지.
- 브라우저 탭 제목을 `Intro_J`로 변경하고, 헤더의 세로 `JH` 연등 심벌과 같은 선형·적갈색 SVG를 파비콘으로 연결했다.
- 2026-09-17 11:39 KST, 1366×768·1920×1080·390×844에서 공개 주소를 다시 검사했다. 세 화면 모두 HTTP 200, 제목과 SVG 파비콘 200 응답·`image/svg+xml` MIME·`JH` 문자 확인, 클릭·Enter·Space 통과.
- 가로 넘침·콘솔 오류·실패 요청은 0이었다. 시각 표면의 색상과 레이아웃은 변경하지 않아 기존 대비 검증 결과를 유지한다.
- `T01-deployment-favicon-2026-09-17-validation.json`에 결과를 저장하고, 기존 증거를 덮어쓰지 않는 `screenshots/T01-deployment-favicon-*` 캡처 4장을 추가했다.
