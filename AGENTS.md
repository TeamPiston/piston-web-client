# Codex Global Operating Rules

## Git & Commit Rules
1. **No Auto-Push**: 모든 작업 완료 후 원격 저장소로 `git push`를 절대로 실행하지 마세요. (Push는 직접 수행함)
2. **Auto Local Commit**:
   - 코드 구현 완료 후 `npx tsc --noEmit` 및 `npx eslint .`를 실행해 오류 0건임을 검증하세요.
   - 검증 통과 시 작업 내용을 요약한 커밋 메시지로 **로컬 커밋만 자동으로 진행**하세요.
3. **No Dev Server**: 포트 충돌 방지를 위해 `npm run dev` 명령어는 직접 실행하지 마세요.