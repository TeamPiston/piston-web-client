# Print Lifecycle Verification

Run `node scripts/verify-print-lifecycle.mjs` or `npm run test:print` after
installing the project's dependencies. `npm run test:e2e:print` remains an alias
for compatibility; this is a module/contract check, not a browser E2E test.

The default command runs offline and starts no server. It transpiles and runs the
actual print entity, shared API client, and mock store in isolated VM contexts.
It ignores the host's mock/API environment settings. `--mock` is an alias for
this default mode; `--contract-only` runs only the frontend source checks.

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
