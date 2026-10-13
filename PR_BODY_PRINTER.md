##  개요
`feat/printer` 브랜치의 프린터 관리 UI 구현, 상태 연동 및 관련 컴포넌트 구조 작업을 `develop` 브랜치에 통합하기 위한 PR입니다.

## ️ 주요 변경 사항
- **프린터 관리 UI 및 모달 연동**: 프린터 관리 페이지 연동, 공유 상태 및 화면 배치 통합
- **최신 develop 정합성 유지**: PR #8의 출력 라이프사이클, 운영 가드 및 에러 전파 로직과 완벽 통합
- **헤더 및 마이페이지 컴포넌트 최적화**: 프린터 상태 및 작업 내역을 반영하는 컴포넌트 간 데이터 흐름 정리

##  변경 범위 (Scope)
- `src/page-slices/mypage/ui/printer-management-page.tsx`: 프린터 관리 메인 화면 및 상태 연동
- `src/page-slices/mypage/ui/mypage-page.tsx`: 마이페이지 내 프린터 관리 진입점 및 컴포넌트 배치
- `src/page-slices/create/ui/create-workspace.tsx`: 워크스페이스 내 프린터 선택 및 출력 가드 통합
- `src/widgets/header/ui/header.tsx`: 헤더 영역 내 프린터 연결 상태 연동

## ✅ 검증 결과
- **TypeScript (`npx tsc --noEmit`)**: 오류 0건 통과
- **ESLint (`npx eslint .`)**: 경고 및 오류 0건 통과
- **출력 라이프사이클 계약 검증**: API 계약 17건 전체 통과
- **프로덕션 빌드 (`npm run build`)**: 21개 페이지 정상 생성 완료

##  로컬 머지 커밋
- `263a330` (develop 통합 및 충돌 해결 완료)
