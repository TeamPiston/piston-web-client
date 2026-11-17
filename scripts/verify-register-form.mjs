import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const event = () => ({ preventDefault() {} });

// Actual hook, component, client and validators. Effects and rerenders are explicit,
// not React batching/StrictMode/DOM. No ambient fetch is available in this VM.
function harness({ mock = false, enabled = true, component = false } = {}) {
  const cells = [];
  const effects = [];
  const modules = new Map();
  const requests = [];
  const logs = [];
  const authChanges = [];
  let cursor = 0;
  let mounted = true;
  let setterCount = 0;
  const react = {
    useState(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
      return [cells[index], (value) => {
        setterCount += 1;
        assert(mounted, "Unexpected setter after unmount");
        cells[index] = typeof value === "function" ? value(cells[index]) : value;
      }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in cells)) cells[index] = { current: initial };
      return cells[index];
    },
    useEffect(setup) {
      const index = cursor++;
      if (!(index in cells)) { cells[index] = true; effects.push({ setup, cleanup: null }); }
    },
  };
  const context = createContext({
    process: { env: { NEXT_PUBLIC_USE_MOCK: String(mock), NEXT_PUBLIC_ENABLE_REGISTRATION_API: String(enabled), NEXT_PUBLIC_API_BASE_URL: "https://registration.invalid", NODE_ENV: "production" } },
    Headers, FormData, Blob, URLSearchParams, ArrayBuffer, Event,
    console: Object.fromEntries(["log", "error", "warn", "debug", "info"].map((name) => [name, (...args) => logs.push(args)])),
    window: {
      localStorage: { getItem: () => "fixture-token", removeItem: (key) => authChanges.push(key) },
      dispatchEvent: () => authChanges.push("event"),
      location: { pathname: "/register/form", assign: () => authChanges.push("redirect") },
    },
    fetch: (url, options) => new Promise((resolveResponse, reject) => requests.push({ url, ...options, resolve: resolveResponse, reject })),
  });
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    const loaded = { exports: {} };
    modules.set(path, loaded);
    const require = (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
      if (specifier === "lucide-react") return { Eye: "Eye", EyeOff: "EyeOff" };
      const target = specifier.startsWith("@/") ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(path), specifier);
      return load([target + ".ts", target + ".tsx", resolve(target, "index.ts")].find(existsSync));
    };
    const source = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: path,
    }).outputText;
    new Script(`(function(require,module,exports){${source}\n})`, { filename: path }).runInContext(context)(require, loaded, loaded.exports);
    return loaded.exports;
  }
  const hook = load(resolve(root, "src/features/auth-register/model/use-register-form.ts")).useRegisterForm;
  const renderComponent = component ? load(resolve(root, "src/features/auth-register/ui/register-form.tsx")).RegisterForm : null;
  const render = () => {
    cursor = 0;
    const result = renderComponent ? renderComponent() : hook();
    for (const effect of effects) if (!effect.cleanup) effect.cleanup = effect.setup();
    return result;
  };
  const cleanup = () => { for (const effect of effects) effect.cleanup?.(); };
  return {
    render, requests, logs, authChanges,
    setters: () => setterCount,
    unmount() { cleanup(); mounted = false; },
    replay() { cleanup(); for (const effect of effects) effect.cleanup = effect.setup(); },
  };
}

function fill(h) {
  const form = h.render();
  form.setEmail("fixture@gsm.hs.kr");
  form.setId("fixture1");
  form.setPassword("Fixture123!");
  form.handleAuthCodeChange("123456");
  return h.render();
}
function reply(request, status = 204) {
  request.resolve(new Response(status === 204 ? null : JSON.stringify({ message: "INTERNAL-SENSITIVE-FIXTURE" }), {
    status, headers: { "Content-Type": "application/json" },
  }));
}
function nodes(tree) {
  if (!tree || typeof tree !== "object") return [];
  if (Array.isArray(tree)) return tree.flatMap(nodes);
  return [tree, ...nodes(tree.props?.children)];
}
const text = (tree) => {
  if (Array.isArray(tree)) return tree.map(text).join("");
  if (typeof tree === "string") return tree;
  return tree && typeof tree === "object" ? text(tree.props?.children) : "";
};

test("API activation is opt-in; disabled handlers cannot issue HTTP", async () => {
  const h = harness({ enabled: false });
  const form = fill(h);
  assert.equal(form.isRegistrationAvailable, false);
  await form.handleEmailAuth();
  await form.handleSubmit(event());
  assert.equal(h.requests.length, 0);
});

test("send validates email, locks synchronously, reports acceptance and allows resend", async () => {
  const h = harness();
  await h.render().handleEmailAuth();
  assert.equal(h.requests.length, 0);
  const form = fill(h);
  const pending = form.handleEmailAuth();
  await form.handleEmailAuth();
  await form.handleSubmit(event());
  assert.equal(h.requests.length, 1);
  assert.equal(h.render().pendingAction, "send");
  assert.equal(h.requests[0].url, "https://registration.invalid/send");
  assert.equal(h.requests[0].method, "POST");
  assert.deepEqual(JSON.parse(h.requests[0].body), { email: "fixture@gsm.hs.kr" });
  form.setEmail("changed@gsm.hs.kr");
  assert.equal(h.render().email, "fixture@gsm.hs.kr", "Pending form remains consistent");
  reply(h.requests[0], 202);
  await pending;
  assert.match(h.render().requestMessage, /접수/);
  assert.equal(h.render().isSignupComplete, false);
  assert.equal(h.render().authError, false);
  h.render().handleAuthConfirm();
  assert.equal(h.render().authError, false, "API mode must not run Mock confirmation");
  const resend = h.render().handleEmailAuth();
  reply(h.requests[1]);
  await resend;
  assert.deepEqual(h.logs, []);
});

for (const status of [400, 401, 409, 500, "network"]) {
  for (const action of ["send", "signup"]) {
    test(`${action} ${status}: safe error, session intact and retry succeeds`, async () => {
      const h = harness();
      const form = fill(h);
      const call = () => action === "send" ? h.render().handleEmailAuth() : h.render().handleSubmit(event());
      const pending = call();
      if (status === "network") h.requests[0].reject(new TypeError("PRIVATE-NETWORK-FIXTURE"));
      else reply(h.requests[0], status);
      await pending;
      assert(h.render().requestError);
      assert(!h.render().requestError.includes("FIXTURE"));
      assert.equal(h.render().requestMessage, "");
      assert.equal(h.render().pendingAction, null);
      assert.equal(h.render().isSignupComplete, false);
      assert.deepEqual(h.authChanges, []);
      assert.equal(form.password, "Fixture123!");
      const retry = call();
      reply(h.requests[1]);
      await retry;
      assert.equal(h.render().requestError, "");
      assert(h.render().requestMessage);
      assert.deepEqual(h.logs, []);
    });
  }
}

test("signup maps authCode, admits one submit and completes without auth/session changes", async () => {
  const h = harness();
  const form = fill(h);
  const pending = form.handleSubmit(event());
  await form.handleSubmit(event());
  await h.render().handleSubmit(event());
  assert.equal(h.requests.length, 1);
  assert.equal(h.render().pendingAction, "signup");
  assert.equal(h.requests[0].url, "https://registration.invalid/signup");
  assert.equal(h.requests[0].method, "POST");
  assert.equal(h.requests[0].headers.has("Authorization"), false);
  assert.deepEqual(JSON.parse(h.requests[0].body), { email: "fixture@gsm.hs.kr", id: "fixture1", password: "Fixture123!", code: "123456" });
  reply(h.requests[0]);
  await pending;
  assert.equal(h.render().isSignupComplete, true);
  assert.match(h.render().requestMessage, /로그인 화면/);
  await form.handleSubmit(event());
  assert.equal(h.requests.length, 1, "Retained handler cannot resubmit a successful signup");
  assert.deepEqual(h.authChanges, []);
  assert.deepEqual(h.logs, []);
});

for (const action of ["send", "signup"]) {
  test(`${action}: unmount ignores delayed success and failure`, async () => {
    for (const failure of [false, true]) {
      const h = harness();
      const form = fill(h);
      const pending = action === "send" ? form.handleEmailAuth() : form.handleSubmit(event());
      h.unmount();
      const before = h.setters();
      if (failure) h.requests[0].reject(new Error("fixture"));
      else reply(h.requests[0]);
      await pending;
      assert.equal(h.setters(), before);
    }
  });
}

for (const action of ["send", "signup"]) {
test(`${action}: effect replay retains POST lock until settlement and suppresses obsolete results`, async () => {
  const h = harness();
  const form = fill(h);
  const call = () => action === "send" ? h.render().handleEmailAuth() : h.render().handleSubmit(event());
  const old = action === "send" ? form.handleEmailAuth() : form.handleSubmit(event());
  h.replay();
  assert.equal(h.render().pendingAction, action);
  await call();
  assert.equal(h.requests.length, 1);
  reply(h.requests[0]);
  await old;
  assert.equal(h.render().pendingAction, null);
  assert.equal(h.render().requestMessage, "");
  assert.match(h.render().requestError, /이전 요청 결과/);
  const fresh = call();
  reply(h.requests[1]);
  await fresh;
  assert(h.render().requestMessage);
});
}

test("invalid signup is blocked and changing API email clears its old code and feedback", async () => {
  const h = harness();
  await h.render().handleSubmit(event());
  const form = fill(h);
  const pending = form.handleEmailAuth();
  reply(h.requests[0]);
  await pending;
  h.render().setEmail("another@gsm.hs.kr");
  assert.equal(h.render().authCode, "");
  assert.equal(h.render().requestMessage, "");
  await h.render().handleSubmit(event());
  assert.equal(h.requests.length, 1);
});

test("unavailable API form explains availability and disables request controls", () => {
  const h = harness({ enabled: false, component: true });
  const tree = h.render();
  assert(text(tree).includes("회원가입 서비스 준비 중"));
  const controls = nodes(tree).filter((node) => node.type === "button" && ["인증", "회원가입"].includes(text(node)));
  assert.equal(controls.length, 2);
  for (const node of controls) {
    assert.equal(node.props.disabled, true);
  }
});

test("Mock form retains validation/confirmation and never calls HTTP even when API enabled", async () => {
  const h = harness({ mock: true });
  const form = fill(h);
  await form.handleEmailAuth();
  await form.handleSubmit(event());
  assert.equal(h.render().isFormValid, true);
  form.handleAuthConfirm();
  assert.equal(h.render().authError, true);
  assert.equal(h.render().isFormValid, false);
  h.render().handleAuthCodeChange("6543217");
  assert.equal(h.render().authCode, "654321");
  assert.equal(h.render().isFormValid, true);
  assert.equal(h.render().isSignupComplete, false);
  assert.equal(h.requests.length, 0);
});

test("actual form JSX wires API handlers, status, disabled fields and server-side code verification", async () => {
  const h = harness({ component: true });
  let tree = h.render();
  const input = (placeholder) => nodes(tree).find((node) => node.props?.placeholder === placeholder);
  input("학교 이메일을 입력해 주세요.").props.onChange({ target: { value: "fixture@gsm.hs.kr" } });
  input("아이디를 입력해 주세요.").props.onChange({ target: { value: "fixture1" } });
  input("비밀번호를 입력해 주세요.").props.onChange({ target: { value: "Fixture123!" } });
  input("인증번호 6자리를 입력해 주세요.").props.onChange({ target: { value: "123456" } });
  tree = h.render();
  assert(!nodes(tree).some((node) => node.type === "button" && text(node) === "완료"));
  assert(text(tree).includes("회원가입 제출 시 서버에서 확인"));
  const send = nodes(tree).find((node) => node.type === "button" && text(node) === "인증");
  const sending = send.props.onClick();
  tree = h.render();
  assert(nodes(tree).find((node) => node.type === "fieldset").props.disabled);
  assert(text(tree).includes("요청 중"));
  reply(h.requests[0], 500);
  await sending;
  tree = h.render();
  assert(nodes(tree).some((node) => node.props?.role === "alert"));
  const retry = nodes(tree).find((node) => node.type === "button" && text(node) === "인증").props.onClick();
  reply(h.requests[1], 202);
  await retry;
  tree = h.render();
  assert(nodes(tree).some((node) => node.props?.role === "status" && text(node).includes("접수")));
  const pending = tree.props.onSubmit(event());
  tree = h.render();
  assert(text(tree).includes("가입 요청 중"));
  reply(h.requests[2]);
  await pending;
  tree = h.render();
  assert(nodes(tree).some((node) => node.type === "a" && node.props.href === "/login"));
  assert(text(tree).includes("회원가입이 완료"));
});
