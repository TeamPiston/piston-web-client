# Print Lifecycle Verification

## 인증 클라이언트 검사

`npm run test:auth-api`는 실제 회원가입/이메일 발송 클라이언트와 공통 HTTP
클라이언트를 VM에서 실행하고 응답을 주입합니다. 실제 서버 요청은 없습니다.
`signup(SignupRequest)`는 `/signup`에 email/id/password/code를 전송하고 204를
처리합니다. `sendVerificationCode(SendVerificationCodeRequest)`는 `/send`에
email을 전송하며 특정 성공 상태 코드나 응답 DTO를 가정하지 않습니다.
두 함수는 `features/auth-register` 공개 API에서 제공하며 회원가입 훅에 연결했습니다.
훅이 UI의 authCode를 code로 매핑합니다.
공개 요청의 `skipAuth: true`는 저장된 토큰 첨부와 401 세션 만료 처리를
생략합니다. 보호 요청의 기존 401 처리는 유지합니다.
검사는 JSON/FormData, 오류 전파, 세션 보호, 민감정보 로그 부재 및 기존 Mock
폼을 포함합니다. Hook 상태는 동기식 셀로 모사하므로 실제 React/브라우저
검증은 아닙니다.

`npm run test:register-form`은 실제 폼 JSX → 훅 → 인증 함수 → HTTP 클라이언트의
호출을 VM에서 실행하고 지연 응답을 주입합니다. 입력 검증, 요청 Body, 성공/오류
안내, 400/401/409/500, 네트워크 실패, 재시도, 동일 렌더 중복 방지, Mock의 HTTP
미호출, 언마운트 및 Effect 재연결을 검사합니다. JSX와 Hook 모사이므로 실제 DOM,
브라우저 포커스와 React 동시성 스케줄러를 검증하지 않습니다.

### 회원가입 UI 활성화

- `NEXT_PUBLIC_USE_MOCK=true`이면 기존 로컬 Mock 폼을 사용합니다.
- API 모드에서도 기본적으로 가입과 발송 요청은 비활성화되며 준비 중 안내가 보입니다.
- 백엔드 담당자의 비밀번호 보안 개선 및 `/signup`, `/send` 배포·CORS 확인 후에만
  `NEXT_PUBLIC_ENABLE_REGISTRATION_API=true`를 설정하고 다시 빌드/실행하세요.
- 이 설정은 UI 활성화 설정입니다. 서버 인증·보안 검증은 서버에서 수행해야 합니다.
- 이번 작업에서는 환경 파일과 활성화 설정을 변경하지 않았습니다. 테스트에서는
  격리된 VM에만 활성화 값을 주입하며 실제 인증·이메일 요청은 전송하지 않습니다.

발송 성공은 요청 접수 안내이며 코드 검증 완료를 의미하지 않습니다. API 모드에는
로컬 `완료` 버튼과 가상 만료 타이머를 표시하지 않습니다. 코드는 회원가입 제출 시
서버에 전달합니다. 가입 성공 후 로그인 링크를 제공하며 토큰/세션을 만들지 않습니다.
폼은 전송 중 잠금을 공유하므로 발송과 가입의 동시 전송도 차단합니다. 전송한 POST는
Effect cleanup만으로 취소되지 않으므로 완료까지 잠금을 유지하고, 재연결 전 응답은
성공 상태에 반영하지 않습니다. 재연결 중 완료된 요청은 결과 확인 안내를 표시합니다.
서버 idempotency·새 마운트/새 탭 간 중복 방지 및 자동 재전송은 구현하지 않습니다.

## API 통신 준비 및 모드 구분

공통 HTTP 클라이언트는 `NEXT_PUBLIC_API_BASE_URL`을 사용합니다. 제공된 서버
주소는 `https://piston.https.gsmsv.site/`입니다. 사용자 환경 파일을 자동으로
변경하지 않습니다. 프린터에 영향을 주지 않는 로컬 UI 검증에는 다음 설정을
사용하고, 환경 변수 변경 후에는 다음 실행/빌드에 반영되는지 확인하세요.

```dotenv
NEXT_PUBLIC_API_BASE_URL=https://piston.https.gsmsv.site/
NEXT_PUBLIC_USE_MOCK=true
```

`NEXT_PUBLIC_USE_MOCK`이 정확히 `true`일 때만 `withMockFallback` 호출부가
Mock을 선택합니다. 그 외에는 API 모드이며 개발/운영 모두 HTTP 오류,
네트워크/CORS 오류, 응답 검증 실패를 Mock 성공으로 바꾸지 않습니다.
함수 이름은 기존 호출부 호환을 위해 유지합니다. URL이 비어 있으면 기존처럼
동일 Origin의 상대 경로를 사용하므로 외부 서버 연동 시 URL을 명시해야 합니다.

`ApiError.status`는 HTTP 응답 코드를 유지하며, 응답이 없는 네트워크 오류는
`0`입니다. `kind`는 `http`, `network`, `response`를 구분합니다. 브라우저에서
CORS 실패와 일반 연결 실패는 확정적으로 구별할 수 없습니다. 오류 객체나
요청 Body, 토큰을 로그에 출력하지 마세요. HTTP 오류의 `data`에는 서버 응답이
남아 있을 수 있습니다. 보호 요청의 401 세션 정리·로그인 이동 정책은 유지합니다.
`apiClient`의 `decode` 옵션으로 `unknown` 응답을 검사할 수 있습니다.
제네릭 타입 선언만으로 JSON 검증이 되지는 않습니다. 기존 출력 어댑터는
직접 검증하며 조회의 명시적 `null`, `{ data: null }`, 204만 빈 결과로 인정합니다.

### 인증 및 출력 계약의 미확인 범위

현재 `/signup`과 `/send`의 제공된 요청 명세로 클라이언트와 폼 연결을 준비했습니다.
로그인 응답과 토큰 전달·갱신 방식은 미확정이며 재발급·로그아웃 Method/경로는
이전 소스 기록과 Notion이 충돌합니다. 실제 인증 UI 전환은 명세와 비밀번호
보안 개선 확인 이후 위 활성화 설정을 적용합니다. 로그인·계정 복구는 기존 Mock
구현이며 회원가입의 API 활성화 설정이 로그인·토큰 연동을 활성화하지 않습니다.
Create 3D 생성과 프린터 관리도 기존 직접 Mock 구현을 유지합니다.

기존 출력 어댑터의 payload와 취소 ID 경로는 프론트엔드의 기존 계약이며,
배포 서버와 합의/검증 완료된 계약이 아닙니다. `POST /api/prints`는 물리 출력까지
시작할 수 있으므로 3D 미리보기 생성에 사용하거나 테스트 목적으로 호출하지
마세요. 이전에 관찰된 배포 404·CORS 문제와 서버 인증 보안은 백엔드 담당자에게
확인이 필요합니다. 이번 테스트는 배포 서버 상태를 재확인하지 않습니다.

### 격리된 HTTP 회귀 검사

`npm run test:print`는 실제 TypeScript 클라이언트·Mock 선택 함수·출력 어댑터를
VM에서 실행합니다. 추가 통신 검사는 개발/운영 각각 정상 응답, 400/401/404/500,
깨진 오류 JSON에서도 401 세션 정리, Bearer 헤더/skipAuth, 네트워크·CORS 모사,
취소 전달, 잘못된 JSON/응답 형태, 명시적 빈 결과 및 Mock의 HTTP 미호출을
검사합니다. 모든 응답은 주입되며 실제 서버·인증·프린터 요청은 0건입니다.
실제 CORS 정책, React 렌더링 및 브라우저 인증 검증을 대체하지 않습니다.
`--api`는 이 작업에서 사용하지 않습니다.

## Create Generation Regression Checks

Run `npm run test:create-generation` for the actual generation hook and its
CreateWorkspace wiring. The Workspace scenarios were first run against the
pre-extraction implementation, then retained after extraction. They cover:

- Immediate user messages, ID allocation/order, 1800 ms loading, the first three
  versions, subsequent single versions and the selected preview model.
- Copyright keyword precedence and preservation of existing results, selection
  and print blocking; print warnings still generate versions and block printing.
- Latest-warning auto-fix, resolved/old/missing warning rejection, same-render
  duplicate auto-fix prevention, correction messages and shared version numbering.
- Valid/invalid version selection, reset during generation, fresh numbering and
  unmount timer cleanup. Reset checks cover both desktop and mobile UI branches.
- Image-only and text/image messages, filename preservation, input/attachment
  cleanup only after acceptance, and the IME/Shift+Enter/Enter handler branches.
- Real generation, attachment and print hooks composed by Workspace: accepted
  starts close print settings or disconnected guidance; empty/loading rejections
  preserve them. Generated/blocked/reset results reach print eligibility checks.
- Direct `startGeneration({ prompt, userContent })` acceptance booleans: `true`
  means the mock request started, not that generation completed successfully.
- Same-render and rerendered duplicate starts: only the first request is accepted,
  with one timer, no extra messages/IDs/versions and no rejected-request cleanup.
- Reset immediately or at 1799 ms, forced execution of cancelled/completed
  callbacks, unmount, fresh mounts and effect cleanup/setup replay. Old callbacks
  must not call setters or release a newer request's lock.
- Synchronous message-ID and timer-registration failures: no published state,
  no retained lock, retry without reset, and preserved Workspace input,
  attachments, results and print settings. Browser-call failures are injected
  before the harness allocates an ID or registers a timer.

`scripts/lib/create-generation-harness.mjs` uses the existing VM testing approach:
actual TS modules, simulated hook cells/effects, deterministic IDs, a virtual
clock, deferred print API promises, Object URLs and placeholder child components.
State cells update immediately; handlers retain their render's snapshot until
an explicit rerender. Setter attempts are counted, and state updaters are evaluated
twice to detect side effects. Effect cleanup/setup can be replayed, including a
callback between the two phases. This is not actual React StrictMode, batching,
concurrent scheduling or browser rendering. Tests retain and invoke real timer
callbacks after cancellation to check ownership defensively; this does not claim
that browsers execute every cancelled timeout or measure real timer throttling.
`test:print` also executes the shared generation/print integration assertions,
replacing the former check for `closePrintSetup()` inside `appendMockResponse`.
The other print source and API/Mock assertions remain in place.

Generation admission uses an active-task ref as a synchronous lock. Each accepted
request creates a unique task object that owns its 1800 ms timer; callback validity
depends on both mounted state and that exact task identity. Reset and effect
cleanup clear the owner before cancelling its timer. A stale callback returns
before changing state or unlocking a newer task. Completion releases only its own
lock, including copyright-warning completion. Reset can admit a fresh request
immediately, even through a handler that captured the previous loading state.
Message preparation finishes before lock acquisition; timer registration runs
under the lock and releases it if registration throws. User messages and loading
state are published only after successful registration. Synchronous exceptions
still propagate to the caller; they are not converted to a successful start.
Effect setup restores mounted state and reconciles the loading UI with the active
owner, so cleanup/setup replay does not leave the hook permanently loading. Replay
cancels pending work but does not reset existing messages or design results.

This policy applies only to cancellable local Mock timers. Print HTTP locks retain
their existing policy; no AI API, AbortController or backend cancellation is added.
Auto-fix's separate synchronous guard and shared version numbering are unchanged.
Before this fix, the eight added lifecycle cases and strengthened Workspace
integration case failed (13 passed, 9 failed); the initial fix passed all 22 cases.
Final review added four synchronous-failure cases, all of which failed before
the error-path correction. That review brought the generation suite to 26 cases.

Actual IME input, native file/clipboard events, responsive layout, modal focus,
Canvas lifetime/rotation/zoom and fullscreen behavior need browser verification.
No new dependency, server, AI API, upload or printer hardware is used.

## Create Attachment Regression Checks

Run `npm run test:create-attachments` for image filtering, the two-image limit,
file/paste/drop handlers, repeated add/remove/reset operations and Object URL
ownership. It also executes CreateWorkspace submit and new-chat handlers to check
image-name messages and attachment cleanup. The actual TypeScript modules run in
memory with simulated hook state/effects, URL APIs and child components; no server
or new dependency is required. Mount-effect replay and repeated state-updater
calls are simulated, not actual React StrictMode or concurrent scheduling.
Native file dialogs, clipboard/drag events, image decoding, layout and browser
accessibility still require browser verification.

## Create Print Flow Regression Checks

Run `npm run test:create-print-flow` to execute the actual Create print hook with
deferred API promises and simulated React state, refs, callback identity, effects and
timers. It covers eligibility, connection/active-job precedence, query and submit
errors, same-render and rerendered duplicate calls, explicit confirmation, modal
closure, reset and timer cleanup. GET and POST have different ownership policies.
A GET owns a unique request object. Closing setup (including accepted prompts and
printer-management navigation), reset and effect cleanup invalidate that owner
and permit a replacement GET immediately. Success, error and finally check both
identity and the UI epoch, so an old GET cannot reopen a modal or unlock a new GET.
An in-flight POST retains its lock across closure, reset and effect cleanup until
its own request settles; completing a GET never releases this POST lock.
Requests retain their original zero-argument contract;
colorMode and printerId are not added to the API payload.

Reset increments the UI response epoch before clearing state. Effect cleanup
also advances the epoch and marks the hook inactive; setup marks it active again.
Requests capture their starting epoch. Success, error and loading updates are
ignored after reset or cleanup, even if a later setup reactivates the hook.
The POST lock releases in finally even for stale responses. Reset/cleanup during
a POST also marks its outcome as requiring a fresh status check. Confirmation
then displays an instruction to close/reopen setup and does not send another POST.
Only a successful current GET that started after the previous POST settled can
clear this requirement. A GET started during that POST is insufficient even if
its response arrives later. Ordinary closure does not invalidate POST results.
Setup reconciles loading flags with the active owners; replay does not restore
invalid responses. A POST that never settles retains its lock in that instance.
No timeout, abort, server cancellation or server idempotency guarantee is added.

Tests count setter attempts as well as visible state. They cover stale success
and failure, new-generation state and lock preservation, fresh hook instances,
and effect cleanup/setup replay. This is UI response invalidation, not backend cancellation: a submitted
print request may still create a server-side job after reset or navigation.
No cancel API or transport abort is added.

PR-review regressions cover both response orders, old finally execution during a
replacement GET, pending-POST feedback/rechecking, and an accepted Workspace
prompt superseding a pending print check. Former assertions that reset must keep
a GET locked were changed to the replacement-GET contract; POST assertions remain.
The print suite also executes the actual modal's JSX/handlers to check pending
submission semantics (focusable aria-disabled button, activation guard, live
status) and native Tab delegation. This is a component contract check with stubbed
effects, not DOM focus verification. The print suite has 82 cases and generation
has 27 lifecycle/integration cases following these review fixes. The generation
command also runs two viewer position contract cases, for 29 cases in total.

The modal retains submit-button focus while pending instead of disabling it and
moving focus to the first button. Its handler and the hook's synchronous lock both
reject repeated activation. Native showModal handles background inertness and Tab;
the button-only manual trap and fallback focus effect have been removed. Actual
Chromium keyboard/focus validation is separate from the VM checks.

Pending queries read the latest committed frontend connection flag from a ref
after checking response validity and active-job precedence. A layout effect updates
only this ref when the input changes, before passive effects; it does not advance
the response epoch, reset UI or release request locks. Writing the ref during render
would expose uncommitted values, while replacing a callback would not update an
already pending closure. A passive effect alone can leave a post-commit gap.
Connection changes do not cancel already submitted prints. The Provider, Mock
connection policy and API contract are unchanged; this is not a physical printer probe.

Success notices fade 3500 ms after success and hide at 4000 ms, preserving the UI's
500 ms opacity transition. Each success creates a new notice identity and monotonic
start time within the notice state. Its effect owns two local timers and depends on
that identity, not the visible/fading phase. Ordinary rerenders and fading therefore
do not cancel the pending hide timer. A subsequent success replaces the notice even
while it is visible; reset removes it. Cleanup cancels both timers and deactivates
their callbacks. A functional state update checks notice identity as well, so an old
callback cannot overwrite a reset or newer notice before passive cleanup runs.
Effect replay cancels old timers and schedules only the remaining delays from the
same start time, rather than restarting a full lifetime. Timer IDs stay local to the
effect; this lifecycle does not reuse or change API response epochs or request locks.

The former `legacy timing` case now requires visible -> fading -> hidden. A virtual
monotonic clock advances timer callbacks and rerenders after each callback. Tests
check both timing boundaries, unchanged timer IDs on ordinary rerenders, reset and
unmount in either phase, repeated success, effect replay, errors and retry. Captured
callbacks are also invoked after cleanup or before deferred passive cleanup to test
defensive ownership checks; this deliberately adversarial invocation is not a claim
that browsers execute every cancelled timeout. These tests do not measure real CSS
animation or browser timer throttling. Actual timers may run later than their deadline.
The clock can also advance without dispatching timers. Delayed first setup, effect
replay after 4000 ms and overdue callbacks must finish without restarting a lifetime;
a subsequent notice must still receive its own full lifetime. Overdue callbacks run
at the current virtual time, never by moving the clock backwards to their due time.

The harness does not run a browser, React's concurrent scheduler or native modal
focus/keyboard behavior. State cells update immediately, while handlers retain
their render's snapshot until the test explicitly rerenders; refs retain the
same mutable object across renders. This is not a simulation of React's full
batching or StrictMode behavior. `render(nextOptions)` merges new hook inputs and
executes the actual hook, then runs layout effects before passive effects. The
connection tests can defer the current commit's passive effects until the next render
and resolve a query in that gap. They cover disconnect, reconnect, active-job/error
precedence, retry, duplicate calls and connection changes combined with reset/unmount.
Both Create harnesses support layout effects; attachment assertions remain unchanged.
Pending-request effect replay tests exercise
invalidation, retained locks and retry on the same instance without an extra reset;
fresh-mount tests also replay setup/cleanup before issuing normal requests.
They do not prove browser event ordering or React's real lifecycle scheduling.
API adapter/Mock contracts remain covered by the print
checks below, which use the actual entity and transport modules.

## Shared Lifecycle and Viewer Regression Checks

`useMountedRef` is exported through `@/shared/lib` and tracks committed passive
effect lifetime only. Generation still owns its cancellable local timer/task;
printing still owns response epochs, replaceable GET identities and the retained
POST lock. Request admission checks mounted state; print response validity checks
the epoch advanced by reset/cleanup. The harnesses execute the actual common hook,
including cleanup/setup replay and stale callbacks, rather than stubbing its result.

Generation's loading reconciliation is retained: React Activity can disconnect
effects while keeping state, so cancellation must be reflected when effects
reconnect. A separate Chromium check with the installed React development build
exercised real StrictMode setup/cleanup/setup and Activity hide/show during a
pending generation. This is distinct from the deterministic VM replay and does
not claim coverage of every concurrent scheduling interleaving.

`useNativeDialog` is exported through `@/shared/ui`. PrintSettingsModal and
PrinterModalShell share showModal/close, Escape cancellation, return-target
validation and scroll-lock ownership. Domain forms and submit/delete actions stay
in their features. Native dialog retains Tab trapping/background inertness.
`test:printer` executes both actual modal implementations and the shared hook with
a simulated DOM. Checks cover explicit focus targets, removed/disabled/hidden/
inert/invisible targets, fallback focus and independent overlapping dialogs closed
in either order. The last dialog restores the original overflow value. These
checks do not prove native browser focus handling or React DOM commit order.

`scripts/verify-stl-preview.mjs`, included by `test:create-generation`, executes
the actual viewer/PreviewPanel JSX with child components stubbed. It checks the
explicit fullscreenButtonPosition option independently of variant, default
bottom-right placement, Create's top-right placement and unchanged initial camera
distance. It does not render WebGL, measure CSS positions or prove rotation/zoom;
those require a separate browser check.

## Print Checks

Run `node scripts/verify-print-lifecycle.mjs` or `npm run test:print` after
installing the project's dependencies. `npm run test:e2e:print` remains an alias
for compatibility; this is a module/contract check, not a browser E2E test.

The default command runs offline and starts no server. It transpiles and runs the
actual print entity, shared API client, and mock store in isolated VM contexts.
It ignores the host's mock/API environment settings. `--mock` is an alias for
this default mode; `--contract-only` runs the frontend source checks and the
executed generation/print integration check, without API adapter/Mock lifecycle checks.

Covered behavior:

- Create success overlay and MyPage polling/cancel/retry source contracts.
- Empty mock state, creation, repeated reads with static progress, retained
  `CANCELLED` state, and retry with a new task ID and the original artwork name.
- Completed, failed, error, and both cancelled spelling scenarios.
- Mock create/cancel/retry failures leave the stored task unchanged.
- Explicit mock mode sends no HTTP requests.
- API requests use `POST /api/prints`, `GET /api/prints/current`, and
  `DELETE /api/prints/{id}`. Retry uses `POST /api/prints` with the original name.
- Raw/enveloped responses, numeric string IDs, all supported statuses, empty
  responses, and HTTP 401/403/404/500 propagation without mock fallback.

## Optional Test Backend

`npm run test:print:api` (or `node scripts/verify-print-lifecycle.mjs --api`)
requires `PISTON_API_BASE_URL` to point to a test backend. There is no default
remote URL. This mode sends real create/read/cancel/retry requests, requires an
initially empty current task, and cancels the task it created during cleanup.
It allows an empty or cancelled state after cancellation and does not assume
automatic completion or fixed completion text/timestamps.

## PR #8 Execution Record

Executed on 2026-10-13:

- Before the fix, `node scripts/verify-print-lifecycle.mjs` exited 1:
  `DELETE /api/prints/current=404`, `POST /api/prints=404` at the old default URL.
- The old `--mock` check exited 0 but used its own server's automatic progress
  and empty-after-delete behavior, which differed from the application's mock.
- After the fix, the direct command, `npm run test:e2e:print`, and
  `node scripts/verify-print-lifecycle.mjs --contract-only` exited 0.
- `npx tsc --noEmit`, `npx eslint .`, and `git diff --check` exited 0.
  TypeScript and ESLint reported no errors or warnings.

Default command output:

```text
PASS frontend source contract checks (no browser rendering)
PASS mock create/read/cancel/retry (static progress, retained CANCELLED)
PASS mock completed/failed/error/cancelled scenarios
PASS mock operation failures preserve state; HTTP requests=0
PASS API adapter POST/GET/DELETE by ID; retry uses POST /api/prints
PASS API HTTP errors propagate without mock fallback
PASS print lifecycle verification; HTTP contract requests=17
```

The 17 HTTP contract requests use an injected fetch transport, not a remote
backend. Browser captures, real printer behavior, and a successful live backend
lifecycle were not verified by this run.
