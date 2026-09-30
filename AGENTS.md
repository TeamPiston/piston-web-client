# Codex Global Operating Rules

## Git & Commit Rules
1. **No Auto-Push**: 모든 작업 완료 후 원격 저장소로 `git push`를 절대로 실행하지 마세요. (Push는 개발자가 직접 수행함)
2. **Auto Local Commit**: 
   - 코드 구현 완료 후 `npx tsc --noEmit` 및 `npx eslint .`를 실행해 오류 0건임을 검증하세요.
   - 검증 통과 시 작업 내용을 요약한 컨벤션 커밋 메시지로 **로컬 커밋만 자동으로 진행**하세요.
3. **Branch Auto-Creation**:
   - 지정된 작업 브랜치나 별도의 브랜치가 존재하지 않는 경우, 작업 성격에 맞는 로컬 브랜치(예: `feat/feature-name`, `refactor/target-name`)를 직접 생성(`git checkout -b`)하고 해당 브랜치에서 커밋을 진행하세요.
4. **No Dev Server**: 포트 충돌 방지를 위해 `npm run dev` 명령어는 직접 실행하지 마세요.