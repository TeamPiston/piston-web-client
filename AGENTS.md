# PISTON 프로젝트 작업 지침

## 적용 범위

- 이 문서는 저장소 전체의 공통 기준이다. 하위 `AGENTS.md`는 해당 디렉터리에만 필요한 규칙이 있을 때 추가하고, 공통 규칙을 복제하거나 안전 규칙을 약화하지 않는다.
- 작업 전 현재 브랜치의 코드, `package.json`, 관련 설정과 지침을 확인한다. 다른 브랜치의 미통합 기능이나 테스트를 현재 구조로 가정하지 않는다.
- 기술 기준은 Next.js App Router, React, TypeScript strict, Tailwind CSS이며 버전과 명령은 `package.json`을 따른다. 스킬의 다른 언어/도구 예시를 그대로 적용하지 않는다.

## Git 및 작업 보호

- **Push 금지:** `git push`는 실행하지 않는다. 원격 반영은 개발자가 수행한다. PR 생성·수정·머지는 별도 사용자 요청이 있을 때만 수행한다.
- 시작 시 `git status`, `git branch -vv`, `git worktree list`로 미커밋 변경, 추적 관계, 다른 worktree 사용 여부를 확인한다.
- 사용자 변경을 덮어쓰거나 임의로 stash·복원·삭제하지 않는다. 변경 사항이 브랜치 전환이나 작업과 충돌하면 중단하고 보고한다. 무관한 변경은 보존하고 커밋에서 제외한다.
- `main`(안정화/배포), `develop`(개발 통합)에 직접 작업·커밋하지 않는다. 사용자가 지정한 작업 브랜치를 사용하고, 무관한 진행 중 브랜치를 재사용하지 않는다.
- 새 작업 브랜치가 필요하면 `git fetch origin` 성공 후 최신 `origin/develop`에서 `git checkout --no-track -b <작업-브랜치> origin/develop`으로 생성한다. 이름은 작업 성격에 맞게 `feat/`, `fix/`, `refactor/`, `chore/`, `docs/` 등을 사용한다.
- fetch 실패 시 최신 상태라고 가정하지 않는다. 기존 브랜치 동기화가 필요한 경우 fast-forward 가능 여부를 확인하고, 불가능하면 강제 병합·reset 대신 원인을 보고한다.
- 검증 통과 후 작업 파일만 명시적으로 stage하고 diff를 검토해 **로컬 커밋을 자동 생성**한다. 커밋 형식은 `type(scope): 한국어 설명`이며, type은 `add/update/fix/refactor/ci/cd/docs/test/merge`, scope는 도메인명(공통 지침은 `global`)을 쓴다. 제목만 작성하고 마침표·AI 공동 작성자 표기는 넣지 않는다.
- 필수 검증 실패·미실행 상태를 성공으로 처리하거나 커밋을 강행하지 않는다. 기존 문제나 환경 제약은 원인과 함께 보고한다.
- 브랜치 정리는 요청된 범위에서만 한다. `git reset --hard`, `git branch -D`, 원격 브랜치 삭제, 이력 재작성은 임의로 수행하지 않는다.
- **개발 서버 실행 금지:** 포트 충돌 방지를 위해 `npm run dev`나 동일 목적의 우회 실행을 하지 않는다. UI 검증은 기존 서버를 활용하고, 서버가 없으면 미검증 범위를 보고한다.

## FSD 책임과 Import 경계

의존 방향은 `app → page-slices → widgets → features → entities → shared`이다. 중간 레이어를 건너뛰어 하위 레이어를 가져오는 것은 가능하다.

| 디렉터리 | 책임 |
| --- | --- |
| `src/app` | Next.js 라우트, layout, metadata, 전역 스타일·Provider 조립. 페이지 구현은 `page-slices`에 위임한다. |
| `src/page-slices/<page>` | 페이지 레이아웃과 하위 레이어 조합, 라우팅·화면 단위 상태. 재사용할 비즈니스 액션을 비대하게 쌓지 않는다. |
| `src/widgets/<slice>` | Header처럼 여러 페이지에서 사용하는 독립적인 화면 영역 조합. |
| `src/features/<slice>` | 로그인·검색·좋아요·출력 등 사용자 액션, 변경 요청 흐름, 폼·제어 버튼·액션 모달과 관련 상태. |
| `src/entities/<slice>` | 도메인 타입, API 스키마·응답 정규화·조회, 순수 데이터 표시 UI. 신규 사용자 액션·제어 모달은 `features`에 둔다. |
| `src/shared` | 도메인에 종속되지 않는 UI, API 전송·인증 기반 코드, 유틸리티. 상위 레이어를 참조하지 않는다. |

- 하위 레이어에서 상위 레이어로 import/re-export하지 않는다. 타입 전용·동적 import에도 같은 경계를 적용한다.
- `page-slices/widgets/features/entities`의 서로 다른 slice끼리 같은 레이어에서 직접 참조하지 않는다. 상위 레이어에서 조합하거나 props/slot으로 연결한다.
- slice 외부에서는 `@/entities/artwork`, `@/features/like-artwork`처럼 slice의 `index.ts` 공개 API를 사용한다. 내부 구현 경로를 직접 참조하거나 레이어 전체 barrel로 경계를 우회하지 않는다. slice 내부는 상대 경로를 사용할 수 있다.
- `shared`는 slice 대신 `ui/api/mock` 등의 용도별 모듈을 사용한다. 기존 공개 진입점을 재사용하고 순환 의존성을 만들지 않는다.
- 페이지의 실제 경로는 `src/page-slices`이다. 기존 라우트의 `@/pages/<page>`는 `tsconfig.json`의 호환 alias이므로 유지한다. Next.js Pages Router로 오인해 `src/pages`를 새로 만들지 않는다.
- 기존 `entities/print`의 변경 API, session/printer Provider, `shared/mock`의 도메인 fixture 등은 이전 구조가 남아 있는 사례다. 신규 책임 배치의 근거로 삼지 말고, 이관은 요청된 작업 범위에서만 한다.
- **린트 한계:** `eslint/fsd-import-boundaries.mjs`는 현재 `pages`만 인식해 실제 `page-slices` 경계를 검사하지 못한다. 공개 API 경유도 강제하지 않으므로 lint 통과와 별개로 import를 검토한다. 설정 개선과 기존 위반 정리는 별도 작업으로 보고한다.

## 코드 품질

- 요청한 동작과 파일에 필요한 최소 변경만 한다. 무관한 리팩터링·파일 이동·일괄 포맷·의존성 갱신을 섞지 않는다.
- 기존 API, 상태 흐름, 로딩·빈 결과·실패·재시도 동작을 보존한다. 중복 전송 방지, 실패 시 rollback, effect의 이벤트·타이머 정리도 확인한다.
- TypeScript strict를 유지한다. 외부 데이터는 `unknown`에서 검사·정규화하고, `any`, 근거 없는 타입 단언, `@ts-ignore`나 lint 비활성화로 오류를 숨기지 않는다.
- 기존 slice 공개 API와 `shared/ui` 컴포넌트를 우선 재사용한다. 실제 중복이나 복잡도를 줄일 때만 공통화를 추가한다.
- 브라우저 API·React hook이 필요한 컴포넌트에만 `"use client"`를 둔다. SSR에서 `window/localStorage` 접근을 보호하고 불필요하게 상위 트리를 client로 전환하지 않는다.

## API 및 Mock

- 실제 API 호출은 `@/shared/api`의 `apiClient`를 재사용한다. `NEXT_PUBLIC_API_BASE_URL`, 인증 헤더, 401 처리와 `ApiError`의 오류 전달 계약을 유지한다.
- endpoint, HTTP method, ID·status 타입, 요청 payload, 응답 envelope·204 처리의 기존 계약을 확인한다. UI 편의로 서버 계약을 임의 변경하지 않는다.
- `withMockFallback`은 `NEXT_PUBLIC_USE_MOCK === "true"`일 때 명시적 Mock 모드를 사용한다. API 모드에서는 운영 환경 오류 및 모든 환경의 HTTP 4xx/5xx를 Mock 성공으로 바꾸지 않는다.
- 현재 개발 환경의 비HTTP 오류 fallback은 기존 동작이다. 이를 운영으로 확대하거나 UI에서 오류를 잡아 별도 Mock 성공을 만드는 코드를 추가하지 않는다.
- Mock URL 시나리오 제어는 기존 환경 제한을 유지한다. 일부 화면의 직접 Mock 호출은 실제 API 연동 완료로 보고하지 않는다. 운영 배포에서는 명시적 Mock 플래그가 활성화되지 않았는지도 확인한다.
- fixture·가상 진행률을 실제 서버 응답으로 섞지 않는다. 비밀키·토큰·개인정보를 코드나 로그에 남기지 않으며 `.env*`의 민감한 값은 출력·커밋하지 않는다.

## 검증 기준

| 변경 범위 | 필수 검증 |
| --- | --- |
| 모든 변경(문서 포함) | `npx tsc --noEmit`, `npx eslint .`, `git diff --check`. 타입 오류 및 lint 오류·경고 0건을 확인한다. |
| 출력 흐름·공유 API/Mock 변경 | 위 검사와 `npm run test:print`. 생성·조회·취소·재시도 및 오류 전파 회귀를 확인한다. |
| 기타 기능 변경 | 위 기본 검사와 현재 브랜치 `package.json`에 있는 관련 회귀 테스트. 없으면 위험에 맞는 검증을 추가하거나 수동 검증과 한계를 보고한다. |
| 라우트·공개 API·레이어 이동·전역 Provider·의존성·빌드 설정 변경 | 관련 검사와 `npm run build`. SSR·정적 생성·번들링 영향을 확인한다. |
| 문서만 변경하거나 국소적인 스타일 변경 | 기본 검사와 관련 검증으로 충분하면 빌드를 생략하고 이유를 보고한다. |

- `npm run test:e2e:print`는 `test:print`의 별칭이다. `scripts/verify-print-lifecycle.mjs`는 소스 계약·Mock 수명주기·주입된 HTTP 전송을 검사하며 **브라우저 E2E나 실제 프린터 검증이 아니다**. 두 별칭을 중복 실행할 필요는 없다.
- `npm run test:print:api`는 실제 생성·취소 요청을 보낸다. 사용자가 허용한 테스트 백엔드와 `PISTON_API_BASE_URL`이 준비된 경우에만 실행하며 운영 서버를 대상으로 삼지 않는다. 상세 조건은 `scripts/README.md`를 따른다.
- 존재하지 않는 테스트 명령을 추정하지 않는다. 현재 npm 프로젝트에 Gradle/Jest 등의 실행 체계를 임의로 적용하지 않는다.
- 테스트를 통과시키려고 assertion을 약화하거나 실패를 숨기지 않는다. 수행한 명령·결과와 미실행 사유를 구분한다.

## UI/UX

- 기존 Tailwind 클래스·색상·간격·타이포그래피와 공통 컴포넌트를 우선 사용한다. 스타일 작업에서 상태 관리·비즈니스 로직을 변경하지 않는다.
- 모바일·데스크톱에서 텍스트 잘림, 겹침, 가로 overflow, 고정 요소와 모달 크기를 확인한다. hover 전환으로 border 두께·크기·위치가 바뀌지 않게 한다.
- hover와 실제 선택·연결 상태를 구분한다. 기능적 선택 표시를 임의 제거하지 않고 상태는 텍스트·배지로도 전달한다. hover는 hover 가능한 기기에서만 적용하고 기존 버튼 hover/focus를 보존한다.
- 의미에 맞는 button/link, 입력 label, 키보드 탐색과 `focus-visible` 표시를 유지한다. 모달은 접근 가능한 제목, 닫기·Escape, 포커스 관리·복귀를 확인한다.
- 로딩·빈 상태·오류·disabled 상태를 제공하고 필요한 상태 변화는 보조기술에도 전달한다. 불필요한 애니메이션은 피하고 동작 감소 설정을 고려한다.
- 화면 변경은 가능하면 실제 렌더링으로 확인한다. 정적 분석·계약 테스트만 했다면 브라우저, 키보드·터치 또는 실제 장비 검증 완료로 보고하지 않는다.

## 결과 보고

- 한국어로 변경 파일, 수정 이유와 영향, 검증 명령·성공/실패, 미검증 범위·추가 개선 권고를 간결하게 보고한다.
- 작업 브랜치, 로컬 커밋 해시(미생성 시 이유), 최종 작업 트리 상태 및 **Push 미실행** 여부를 명시한다.
