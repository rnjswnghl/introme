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
