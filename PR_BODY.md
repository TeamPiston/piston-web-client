## 작업 개요

백엔드 미연동 환경에서 출력 요청·현황 조회·취소·재출력 UI를 확인할 수 있도록 공통 Mock 데이터와 API 어댑터를 구성하였습니다. 실제 프린터 장치 연동이 완료된 PR은 아닙니다.
- `NEXT_PUBLIC_USE_MOCK=true`에서는 Mock을 직접 사용합니다. 그 외에는 API를 호출하며, 운영 환경에서는 예외를 그대로 전파합니다. 개발 환경에서도 HTTP 오류는 전파하고, 그 외 예외에만 Mock fallback을 적용합니다.
- 운영 환경의 URL 쿼리 기반 Mock 시나리오 제어는 명시적 Mock 모드에서만 허용합니다.

## 변경 범위 (Scope)

주요 작업은 출력 라이프사이클이며, 같은 PR에 포함된 계정·디자인·피드·헤더·STL 뷰어 관련 작업도 아래에 함께 명시합니다.

- **출력 라이프사이클**: Create의 출력 설정·요청·성공 안내, 출력 상태 조회 실패 시 차단·재시도, MyPage의 출력 현황·3초 폴링·상세 모달·취소·재출력 점검을 구현합니다. `src/entities/print`에서 ID 검증, 응답 정규화 및 생성·조회·ID 기반 취소·재출력 API를 처리합니다.
- **Create 작업 공간**: 이미지 첨부 제한, 생성 대기·버전 전환·규격 경고·자동 수정 등 Mock 기반 디자인 생성 흐름과 프린터 미연결·출력 중 안내를 정리합니다. 대상: `src/page-slices/create/ui/create-workspace.tsx`.
- **회원 탈퇴 모달**: 확인·요청 중 상태·실패 안내를 추가하고, 탈퇴 요청 성공 후 로그아웃 및 로그인 화면 이동을 연결합니다. 대상: `src/page-slices/mypage/ui/delete-account-modal.tsx`, `src/entities/session/model/account.ts`.
- **디자인 상세·삭제 모달**: 내가 만든 디자인의 STL 미리보기·상세 정보·색상 선택·공개 토글·출력 요청과 삭제 확인을 연결합니다. 디자인 공개·삭제는 현재 Mock 저장소 기준입니다. 대상: `src/page-slices/mypage/ui/design-detail-modal.tsx`, `delete-design-confirm-modal.tsx`, `mypage-page.tsx`.
- **피드 좋아요·검색**: 공통 Mock 피드 데이터에 작품명·작성자 검색을 연결하고, 좋아요 상태 유지·요청 중 중복 토글 방지·실패 롤백 및 버튼 비활성화를 적용합니다. 좋아요는 현재 Mock 저장소 기준입니다. 대상: `src/page-slices/feed`, `src/features/like-artwork`, `src/features/feed-search`.
- **헤더·프린터 관리**: 로고의 메인 이동, 로그인 상태별 프로필 표시·마이페이지 이동, 비로그인 사용자의 Create·Feed 접근 시 로그인 안내 모달, 프로필 버튼 정렬을 정리합니다. `develop` 통합 후 `/mypage?tab=printer`는 프린터 관리 화면을 표시하며 Create의 연결 상태와 설정 모달에 프린터 정보를 제공합니다. 대상: `src/widgets/header`, `src/entities/printer`, `src/page-slices/mypage/ui/printer-management-page.tsx`.
- **STL 뷰어**: `ArtworkModelPreview`의 인터랙티브 보기·확대·전체 화면과 카드용 정적 캔버스 렌더링을 적용합니다. 대상: `src/features/stl-viewer/ui/artwork-model-preview.tsx` 및 MyPage 카드.
- **공통 데이터·인증 UI**: 작품·계정·출력·디자인 fixture를 `src/shared/mock/mock-data.ts`로 통합하고, 로그인·세션 처리와 회원가입 폼 표시를 정리합니다. 공통 API의 오류 전파·Mock fallback 정책도 함께 보강합니다.
- **검증 스크립트·실행 문서**: `scripts/verify-print-lifecycle.mjs`, `scripts/README.md` 및 `package.json` 실행 구성을 현재 Mock/API 어댑터 계약에 맞춥니다.

## 검증 결과

2026-10-13 실행 완료. 출력 코드 기준 커밋: `ec5bd2e`. 아래 두 명령은 각각 실행했으며 모두 종료 코드 0으로 통과했습니다.

| 실행 명령 | 결과 | 검증 기준 |
| --- | --- | --- |
| `node scripts/verify-print-lifecycle.mjs` | PASS · 종료 코드 0 · API 계약 요청 17건 검증 | 로컬 mock/API 어댑터 |
| `npm run test:e2e:print` | PASS · 종료 코드 0 · API 계약 요청 17건 검증 | `test:print`를 통해 같은 스크립트 실행 |

- 각 실행에서 **17개 API 계약 요청(정상 응답 및 HTTP 오류 시나리오)을 정상 검증**했습니다. 로컬 mock/API 어댑터 기준으로 실제 출력 모듈을 실행하고, API 응답은 주입된 fetch transport로 재현합니다.
- 검증 항목: 생성·조회·`DELETE /api/prints/{id}` 취소·`POST /api/prints` 재출력, 응답 정규화·지원 상태, HTTP 401/403/404/500 오류 전파. Mock의 고정 진행률·취소 후 `CANCELLED` 유지·실패 시 상태 보존도 확인했습니다. 명시적 Mock 모드의 HTTP 요청은 0건입니다.
- `npx tsc --noEmit`, `npx eslint .`: 오류·경고 없이 통과.
- `origin/develop`(`622fff8`) 통합 후에도 타입 검사·ESLint·`npm run test:e2e:print`(17건)·`npm run build`(21개 페이지 생성)를 다시 실행하여 정상 통과했습니다.
- 실제 백엔드·프린터 장치 연동 및 브라우저 캡처는 미검증입니다. 프론트엔드 검증은 소스 계약 확인이며, `test:e2e:print`도 브라우저 E2E 테스트는 아닙니다.
- 상세 실행 기록: [scripts/README.md](scripts/README.md#pr-8-execution-record).

```text
PASS print lifecycle verification; HTTP contract requests=17
```

## UI 주요 장면

아래는 수동 확인 경로와 캡처 대상입니다. 이번 검증에서는 브라우저 캡처를 수행하지 않았습니다.

공통 조건: 대상 브랜치의 Mock 모드 서버에서 `/login`에 접속하여 테스트 계정 `admin / 1234`로 로그인합니다. 아래 경로 앞에 서버 주소를 붙이며, 시나리오를 바꿀 때는 전체 새로고침합니다.

### 1. 프린터 미연결 안내
- 경로: `/create?mockPrintStatus=EMPTY&mockPrinter=disconnected`
- “육각형 연필꽂이” 입력 → 생성 대기 → “출력하기”
- 캡처: `PrinterDisconnectedModal`의 연결 안내, STL 다운로드, 프린터 관리 이동 버튼

### 2. 출력 설정 및 요청
- 경로: `/create?mockPrintStatus=EMPTY`
- 모델 생성 → “출력하기” → 색상·필라멘트·주의 사항 확인 → 요청 확정
- 캡처: `PrintSettingsModal`, 요청 중 비활성화, 성공 안내 오버레이
- 실패 재현: 경로에 `&mockError=print-create` 추가

### 3. 마이페이지 출력 현황 및 폴링
- 경로: `/mypage?mockPrintStatus=PRINTING`
- 캡처: 출력 중 카드, 62% 진행률, 남은 시간 및 상세 모달
- `PRINTING`일 때만 3초마다 조회합니다. Mock 모드에서는 HTTP 요청 없이 메모리 저장소를 조회하며 진행률은 자동 증가하지 않습니다.
- `/mypage?tab=printer`는 프린터 관리 화면입니다. 출력 현황은 기본 마이페이지에서 확인합니다.
- 완료·빈 상태: `mockPrintStatus=COMPLETED` 또는 `EMPTY`로 변경

### 4. 취소 및 재출력 사전 점검
- 취소: `/mypage?mockPrintStatus=PRINTING` → 출력 카드 → 상세 모달 → “출력 취소”
- 재출력: `/mypage?mockPrintStatus=FAILED` → “다시 출력하기” → 점검 모달 → 요청 확정
- 캡처: 취소 버튼·처리 상태, 실패 사유, 노즐·필라멘트·잔여물·연결 점검 UI
- 성공 시 취소는 현재 카드를 비웁니다. Mock 저장소에는 `CANCELLED` 작업을 유지하므로 다시 조회하면 취소 상태가 표시됩니다. 재출력은 새 `PRINTING` 작업으로 교체합니다.
- 실패 재현: `&mockError=print-cancel` 또는 `&mockError=print-retry` 추가

## Mock 구현 위치

- `src/shared/mock/mock-data.ts`: 출력 상태·프린터 설정·디자인 fixture, 생성·조회·취소·재출력 및 URL 시나리오
- `src/entities/print/model/print.ts`: API 요청, 응답 정규화, Mock fallback
- `src/page-slices/create/ui/create-workspace.tsx`: 출력 가능 여부 확인, 연결·출력 중 안내, 요청 상태
- `src/page-slices/mypage/ui/mypage-page.tsx`: 현황 로딩·3초 폴링·취소·재출력 상태 갱신
- `src/page-slices/mypage/ui/print-status-detail-modal.tsx`, `print-retry-confirm-modal.tsx`: 상세·취소·점검 UI
- `src/features/print-artwork/ui/print-settings-modal.tsx`: 출력 설정 UI

## 백엔드 연동 TODO

- [ ] 고정 사용자·작품명 대신 인증 사용자 및 디자인 ID를 사용하고, 모델·버전·프린터·색상 설정을 요청에 반영합니다. 현재 Create의 `colorMode`는 미전송입니다.
- [ ] 기존 `POST /api/prints`, `GET /api/prints/current`, `DELETE /api/prints/{id}`와 재출력 계약을 확정합니다.
- [ ] Mock 연결 상태·고정 필라멘트 정보를 실제 장치 API로 교체합니다. 프린터 등록·관리 탭 UI는 연결된 상태입니다.
- [ ] 실제 진행률·완료·실패 상태 및 재출력 점검 결과를 연동합니다.
- [ ] 메모리 저장소를 서버 데이터로 교체합니다. 운영 환경의 자동 Mock fallback은 차단된 상태입니다.
- [ ] 실제 테스트 백엔드에서 출력 라이프사이클을 검증하고 브라우저 캡처를 추가합니다. 로컬 Mock/API 어댑터 기준 검증 스크립트의 취소·실패·재출력 검증은 수정 및 실행 완료했습니다.
