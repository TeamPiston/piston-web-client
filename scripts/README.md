# Print Lifecycle Verification

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

`scripts/lib/create-generation-harness.mjs` uses the existing VM testing approach:
actual TS modules, simulated hook cells/effects, deterministic IDs, a virtual
clock, deferred print API promises, Object URLs and placeholder child components.
State updaters are evaluated twice to detect side effects; this is not actual
React StrictMode, batching, concurrent scheduling or browser rendering.
`test:print` also executes the shared generation/print integration assertions,
replacing the former check for `closePrintSetup()` inside `appendMockResponse`.
The other print source and API/Mock assertions remain in place.

Known limitation intentionally unchanged: generation admission still uses the
render's `isLoading` snapshot, with one timeout ref and no response epoch. This
suite does not require same-render duplicate generation or stale callback mutation
as expected behavior. Their prevention is a separate bug-fix task. Auto-fix's
existing synchronous duplicate guard is covered. Reset/unmount tests here use
one pending generation, not a new cancellation or response-invalidation policy.

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
closure, reset and timer cleanup. Independent in-flight guards remain locked
across modal closure and reset until their own request settles. Success, rejected
promises and synchronous API exceptions release the lock and allow subsequent
requests; completion of one operation does not release the other's lock.
Requests retain their original zero-argument contract;
colorMode and printerId are not added to the API payload.

Reset increments the UI response epoch before clearing state. Effect cleanup
also advances the epoch and marks the hook inactive; setup marks it active again.
Requests capture their starting epoch. Success, error and loading updates are
ignored after reset or cleanup, even if a later setup reactivates the hook.
The request's own in-flight lock still releases in finally, including for stale
responses. Reset and cleanup do not release these locks, so a newer request of
the same kind cannot acquire the lock before the old one finishes. Each independent
lock stores its request epoch (or null when idle). Setup derives the loading flags
from these owners and the active epoch, so effect replay does not leave the same
instance stuck loading. This does not revive the old response or release its lock.
A request that never settles keeps its own lock indefinitely in that instance,
including after reset or effect replay; no timeout or cancellation is introduced.

Tests count setter attempts as well as visible state. They cover stale success
and failure, new-generation state and lock preservation, fresh hook instances,
and effect cleanup/setup replay. Ordinary modal closure does not invalidate a
response. This is UI response invalidation, not backend cancellation: a submitted
print request may still create a server-side job after reset or navigation.
No cancel API or transport abort is added.

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
