import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let response;
const requests = [];
const logs = [];
const removed = [];
const redirects = [];
const events = [];
const storage = new Map([["piston-access-token", "synthetic-token"]]);
let cells = [];
let cursor = 0;
let loggedIn = null;
const context = createContext({
  AbortSignal, Event,
  process: { env: { NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK: "false", NEXT_PUBLIC_API_BASE_URL: "https://auth-test.invalid" } },
  Headers, FormData, Blob, URL, URLSearchParams, ArrayBuffer, crypto: { randomUUID },
  console: Object.fromEntries(["log", "warn", "error", "debug", "info"].map((key) => [key, (...args) => logs.push(args)])),
  window: {
    navigator: { locks: createAuthLocks() },
    localStorage: {
      getItem: (key) => storage.get(key) ?? null,
      setItem: (key, value) => storage.set(key, value),
      removeItem: (key) => { removed.push(key); storage.delete(key); },
    },
    location: { origin: "https://frontend.invalid", pathname: "/register", search: "", assign: (url) => redirects.push(url) },
    dispatchEvent: (event) => events.push(event.type),
  },
  fetch: async (url, options) => {
    assert.equal(new URL(url).origin, "https://auth-test.invalid");
    const request = { url, ...options };
    requests.push(request);
    return response(request);
  },
});
const cache = new Map();
function load(relative) {
  const path = resolve(root, relative);
  if (cache.has(path)) return cache.get(path).exports;
  const loadedModule = { exports: {} };
  cache.set(path, loadedModule);
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const require = (name) => {
    if (name === "react") return { useRef(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = { current: initial };
      return cells[index];
    }, useEffect(setup) {
      const index = cursor++;
      if (!(index in cells)) { cells[index] = true; setup(); }
    }, useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = initial;
      return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
    } };
    if (name === "next/navigation") return { useRouter: () => ({ push: (url) => redirects.push(url) }) };
    if (name === "@/entities/session") return { useAuth: () => ({ login: (user) => { loggedIn = user; } }) };
    if (name === "@/shared/api") return load("src/shared/api/index.ts");
    if (name === "@/shared/lib") return load("src/shared/lib/index.ts");
    return load(name.startsWith("@/") ? `src/${name.slice(2)}.ts` : resolve(dirname(path), name + ".ts"));
  };
  new Script(`(function(require,module,exports){${source}\n})`, { filename: path }).runInContext(context)(require, loadedModule, loadedModule.exports);
  return loadedModule.exports;
}
const { signup, sendVerificationCode } = load("src/features/auth-register/api/register.ts");
const { apiClient, ApiError } = load("src/shared/api/index.ts");
const mock = load("src/shared/mock/mock-data.ts");
const input = { email: "fixture@example.invalid", id: "fixture", password: "synthetic-password", code: "123456" };
const json = (status) => new Response("{}", { status, headers: { "Content-Type": "application/json" } });
for (const [operation, path, body] of [[signup, "/signup", input], [sendVerificationCode, "/send", { email: input.email }]]) {
  response = () => new Response(null, { status: 204 });
  assert.equal(await operation(body), undefined);
  const last = requests.at(-1);
  assert.equal(last.url, "https://auth-test.invalid" + path);
  assert.equal(last.method, "POST");
  assert.equal(last.headers.has("Authorization"), false);
  assert.equal(last.headers.get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(last.body), body);
  for (const status of [400, 401, 500]) {
    response = () => json(status);
    await assert.rejects(() => operation(body), (error) => error instanceof ApiError && error.status === status);
  }
  response = () => new Response("{broken", { status: 401, headers: { "Content-Type": "application/json" } });
  await assert.rejects(() => operation(body), (error) => error.status === 401);
  response = () => { throw new TypeError("simulated network/CORS failure"); };
  await assert.rejects(() => mock.withMockFallback(() => operation(body), () => { throw new Error("Unexpected Mock fallback"); }), (error) => error.kind === "network");
}
assert.deepEqual(removed, []);
assert.deepEqual(events, []);
assert.deepEqual(redirects, []);
for (const status of [200, 201, 202]) {
  response = () => json(status);
  assert.equal(await sendVerificationCode({ email: input.email }), undefined);
}
response = () => json(401);
await assert.rejects(() => apiClient.get("/protected-fixture"), (error) => error.status === 401);
assert.equal(requests.at(-1).headers.get("Authorization"), "Bearer synthetic-token");
assert.deepEqual(removed, ["piston-api-session", "piston-access-token", "piston-auth"]);
assert.deepEqual(events, ["piston-auth-expired"]);
assert.deepEqual(redirects, ["https://frontend.invalid/login"]);
response = () => new Response(null, { status: 204 });
const form = new FormData();
form.append("message", "fixture");
await apiClient.post("/multipart-fixture", form);
assert.equal(requests.at(-1).body, form);
assert.equal(requests.at(-1).headers.has("Content-Type"), false);

// Execute Mock form hooks with minimal synchronous hook cells, not React DOM.
const before = requests.length;
context.process.env.NEXT_PUBLIC_USE_MOCK = "true";
const render = (hook) => { cursor = 0; return hook(); };
const { useLoginForm } = load("src/features/auth-login/model/use-login-form.ts");
let login = render(useLoginForm);
login.setId(mock.MOCK_LOGIN_CREDENTIALS.id);
login.setPassword("invalid-fixture");
login = render(useLoginForm);
login.handleSubmit({ preventDefault() {} });
assert.equal(loggedIn, null);
assert(render(useLoginForm).error);
login.setPassword(mock.MOCK_LOGIN_CREDENTIALS.password);
render(useLoginForm).handleSubmit({ preventDefault() {} });
assert.equal(loggedIn, mock.MOCK_USER_PROFILE);
assert.equal(redirects.at(-1), "/feed");
cells = [];
const { useRegisterForm } = load("src/features/auth-register/model/use-register-form.ts");
let register = render(useRegisterForm);
register.setEmail("fixture@gsm.hs.kr");
register.setId("fixture1");
register.setPassword("Fixture123!");
register.handleAuthCodeChange("1234567");
register = render(useRegisterForm);
assert.equal(register.authCode, "123456");
assert.equal(register.isFormValid, true);
register.handleEmailAuth();
register.handleSubmit({ preventDefault() {} });
register.handleAuthConfirm();
assert.equal(render(useRegisterForm).authError, true);
assert.equal(requests.length, before, "Mock UI must not activate HTTP clients");
assert.deepEqual(logs, [], "Auth hooks/client must not log credentials or errors");
console.log("PASS signup/send HTTP contracts, public/protected 401, error propagation, FormData, Mock forms and zero sensitive logs; real HTTP=0");

const tick = () => new Promise((done) => setImmediate(done));
const { beginApiLogin, captureAuth, saveApiSession, readApiSession, clearStoredAuth } = load("src/shared/api/auth.ts");
const fixtureTokens = { accessToken: "expired-access", refreshToken: "fixture-refresh" };
const protectedPath = "/protected-fixture";
const pathOf = ({ url }) => new URL(url).pathname;
const respond401 = () => new Response(null, { status: 401 });
const refreshed = () => Response.json({ accessToken: "renewed-access" });

async function startSession(respond) {
  requests.length = 0;
  await saveApiSession(beginApiLogin(), fixtureTokens);
  response = respond;
}

await startSession((request) => {
  if (pathOf(request) === "/reissue") {
    assert.equal(request.method, "POST");
    assert.equal(request.headers.get("Authorization"), "Bearer fixture-refresh");
    assert.equal(request.body, undefined);
    return refreshed();
  }
  return request.headers.get("Authorization") === "Bearer renewed-access"
    ? Response.json({ ok: true }) : respond401();
});
assert.deepEqual(await Promise.all([apiClient.get(protectedPath), apiClient.get(protectedPath)]), [{ ok: true }, { ok: true }]);
assert.equal(requests.filter((request) => pathOf(request) === "/reissue").length, 1);
assert.equal(requests.filter((request) => request.headers.get("Authorization") === "Bearer renewed-access").length, 2);
assert.equal(readApiSession().accessToken, "renewed-access");
assert.equal(readApiSession().refreshToken, fixtureTokens.refreshToken);

let finishLateRead;
await startSession((request) => {
  if (pathOf(request) === "/reissue") return refreshed();
  if (request.headers.get("Authorization") === "Bearer renewed-access") return Response.json({ ok: true });
  if (pathOf(request) === "/protected-late") return new Promise((done) => { finishLateRead = done; });
  return respond401();
});
const lateRead = apiClient.get("/protected-late");
await apiClient.get(protectedPath);
finishLateRead(respond401());
assert.deepEqual(await lateRead, { ok: true });
assert.equal(requests.filter((request) => pathOf(request) === "/reissue").length, 1);

for (const badRefresh of [respond401, () => Response.json({ accessToken: "" })]) {
  await startSession((request) => pathOf(request) === "/reissue" ? badRefresh() : respond401());
  await assert.rejects(apiClient.get(protectedPath), (error) => error.status === 401);
  assert.equal(readApiSession(), null);
  assert.deepEqual(requests.map(pathOf), [protectedPath, "/reissue"]);
}

await startSession((request) => pathOf(request) === "/reissue" ? refreshed() : respond401());
await assert.rejects(apiClient.get(protectedPath), (error) => error.status === 401);
assert.deepEqual(requests.map(pathOf), [protectedPath, "/reissue", protectedPath]);
assert.equal(readApiSession(), null);

for (const [reply, verify] of [
  [() => Response.json({}, { status: 403 }), (error) => error.status === 403],
  [() => { throw new TypeError("Synthetic network failure"); }, (error) => error.kind === "network"],
]) {
  await startSession(reply);
  await assert.rejects(apiClient.get(protectedPath), verify);
  assert.deepEqual(requests.map(pathOf), [protectedPath]);
  assert.equal(readApiSession().accessToken, fixtureTokens.accessToken);
}

const noReplay = [
  ["POST", "/chats/messages"], ["POST", "/meshy/text-to-3d"], ["POST", "/meshy/image-to-3d"],
  ["POST", "/chats/generate"], ["POST", "/api/prints"], ["DELETE", "/api/users/me"],
];
for (const [method, path] of noReplay) {
  await startSession((request) => pathOf(request) === "/reissue" ? refreshed() : respond401());
  await assert.rejects(apiClient.request(path, { method }), (error) => error.status === 401);
  assert.deepEqual(requests.map(pathOf), [path, "/reissue"]);
  assert.equal(requests[0].method, method);
  assert.equal(readApiSession().accessToken, "renewed-access");
}

let finishRefresh;
await startSession((request) => pathOf(request) === "/reissue"
  ? new Promise((done) => { finishRefresh = done; }) : respond401());
const afterLogout = assert.rejects(apiClient.get(protectedPath), (error) => error.status === 401);
await tick();
assert(finishRefresh);
await clearStoredAuth(captureAuth(), { explicit: true });
finishRefresh(refreshed());
await afterLogout;
assert.equal(readApiSession(), null);
assert.deepEqual(requests.map(pathOf), [protectedPath, "/reissue"]);

let finishOld;
await startSession(() => new Promise((done) => { finishOld = done; }));
const oldSession = assert.rejects(apiClient.get(protectedPath), (error) => error.status === 401);
await saveApiSession(beginApiLogin(), { accessToken: "new-session-access", refreshToken: "new-session-refresh" });
finishOld(respond401());
await oldSession;
assert.equal(readApiSession().accessToken, "new-session-access");
assert.deepEqual(requests.map(pathOf), [protectedPath]);

await startSession((request) => pathOf(request) === "/reissue"
  ? new Promise((done) => { finishRefresh = done; }) : respond401());
const controller = new AbortController();
const stopped = new Error("synthetic cancellation");
const cancelled = assert.rejects(apiClient.get(protectedPath, { signal: controller.signal }), (error) => error === stopped);
await tick();
controller.abort(stopped);
await cancelled;
finishRefresh(refreshed());
await tick();
assert.deepEqual(requests.map(pathOf), [protectedPath, "/reissue"]);
assert.equal(readApiSession().accessToken, "renewed-access");
assert.deepEqual(logs, [], "Never log auth data");
let finishOldRetry;
let refreshCount = 0;
await startSession((request) => {
  if (pathOf(request) === "/reissue") {
    return Response.json({ accessToken: "rotated-fixture-" + ++refreshCount });
  }
  const bearer = request.headers.get("Authorization");
  if (pathOf(request) === "/slow-read" && bearer === "Bearer rotated-fixture-1") {
    return new Promise((resolve) => { finishOldRetry = resolve; });
  }
  return bearer === "Bearer rotated-fixture-2" ? Response.json({ ok: true }) : respond401();
});
const oldRetry = assert.rejects(apiClient.get("/slow-read"), (error) => error.status === 401);
await tick();
assert(finishOldRetry);
await apiClient.get(protectedPath);
finishOldRetry(respond401());
await oldRetry;
assert.equal(refreshCount, 2);
assert.equal(readApiSession().accessToken, "rotated-fixture-2");

for (const lateRefresh of [respond401, refreshed]) {
  await startSession((request) => pathOf(request) === "/reissue"
    ? new Promise((done) => { finishRefresh = done; }) : respond401());
  const old = assert.rejects(apiClient.post(protectedPath, {}), (error) => error.status === 401);
  await tick();
  const storedSession = readApiSession();
  storage.set("piston-api-session", JSON.stringify({ ...storedSession, accessToken: "newer-cross-tab-access" }));
  finishRefresh(lateRefresh());
  await old;
  assert.equal(readApiSession().accessToken, "newer-cross-tab-access");
  assert.deepEqual(requests.map(pathOf), [protectedPath, "/reissue"]);
}

console.log("PASS refresh authorization, single-flight, stale and cancelled requests, one read retry and paid/destructive request isolation");
