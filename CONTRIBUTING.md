# 개발과 커밋 규칙

## 형식
`type(scope): 한국어 변경 요약`

- type: feat, fix, docs, style, refactor, test, chore
- scope: t01 등 과제 번호 또는 repo
- 하나의 커밋에는 하나의 설명 가능한 변경 목적을 담습니다.
- 본문: 변경 / 이유 / 검증을 기록합니다. 미검증 상태는 그대로 씁니다.
- 기능 구현, 발견한 결함의 수정, 검증 문서를 구분합니다.
- 의미 없는 빈 커밋이나 인위적으로 만든 결함은 남기지 않습니다.
- push 전 diff와 비밀값·개인정보를 확인합니다. .env 및 원본 개인정보 문서는 커밋하지 않습니다.
- 사용자 기존 변경을 덮어쓰거나 강제 push하지 않습니다.

## 로컬 규칙 적용
`git config core.hooksPath .githooks`

Git의 commit-msg 훅이 제목 형식을 확인합니다. 커밋 작성자는 자동화 작업을 드러내도록 Codex로 기록합니다.
