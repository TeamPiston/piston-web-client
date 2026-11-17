import assert from "node:assert/strict";
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
let cells = [];
let cursor = 0;
let loggedIn = null;
const context = createContext({
  process: { env: { NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK: "false", NEXT_PUBLIC_API_BASE_URL: "https://auth-test.invalid" } },
  Headers, FormData, Blob, URLSearchParams, ArrayBuffer, Event,
  console: Object.fromEntries(["log", "warn", "error", "debug", "info"].map((key) => [key, (...args) => logs.push(args)])),
  window: {
    localStorage: { getItem: () => "synthetic-token", removeItem: (key) => removed.push(key) },
    location: { pathname: "/register", search: "", assign: (url) => redirects.push(url) },
    dispatchEvent: (event) => events.push(event.type),
  },
  fetch: async (url, options) => { requests.push({ url, ...options }); return response(); },
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
assert.deepEqual(removed, ["piston-access-token", "piston-auth"]);
assert.deepEqual(events, ["piston-auth-expired"]);
assert.deepEqual(redirects, ["/login"]);
response = () => new Response(null, { status: 204 });
const form = new FormData();
form.append("message", "fixture");
await apiClient.post("/multipart-fixture", form);
assert.equal(requests.at(-1).body, form);
assert.equal(requests.at(-1).headers.has("Content-Type"), false);

// Execute unchanged form hooks with minimal synchronous hook cells, not React DOM.
const before = requests.length;
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
context.process.env.NEXT_PUBLIC_USE_MOCK = "true";
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
