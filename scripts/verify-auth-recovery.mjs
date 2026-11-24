import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createAuthLocks } from "./test-auth-locks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const tick = () => new Promise((done) => setImmediate(done));
const codes = { token: "fixture-token+123", password: "  Synthetic-Password!  " };
const email = "Fixture@example.invalid";
const endpoints = ["/find-id", "/find-password", "/reset-password"];
const authEndpoints = ["/login", "/api/users/me", "/logout", "/reissue", "/protected-fixture"];
const sessionKey = "piston-api-session";
const initialSession = { id: "session-a", accessToken: "old-access", refreshToken: "old-refresh" };
const renewedTokens = { accessToken: "new-access", refreshToken: "new-refresh" };
const profileA = { userId: 1, loginId: "account-a", email, createdAt: "2026-01-01T00:00:00Z" };
const profileB = { ...profileA, userId: 2, loginId: "account-b", email: "other@example.invalid" };
const noContent = () => new Response(null, { status: 204 });
const find = (tree, predicate) => {
  if (!tree || typeof tree !== "object") return undefined;
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = find(child, predicate);
      if (match) return match;
    }
    return undefined;
  }
  return predicate(tree) ? tree : find(tree.props?.children, predicate);
};
const textOf = (node) => Array.isArray(node) ? node.map(textOf).join("")
  : node && typeof node === "object" ? textOf(node.props?.children)
    : typeof node === "string" ? node : "";

function harness({ mode = "false", endpoint = "email", url = "https://frontend.invalid/reset-password",
  apiSession, sharedStorage, readStorage = () => {}, locks = createAuthLocks(), timeouts = AbortSignal,
  respond = async () => assert.fail("Unexpected HTTP") } = {}) {
  const requests = [], routes = [], logs = [], cleanups = [], storageReads = [];
  const modules = new Map();
  const renderSlots = { form: [], provider: [] };
  const storage = sharedStorage ?? new Map(apiSession ? [[sessionKey, JSON.stringify(apiSession)]] : []);
  const tabStorage = new Map();
  const events = new EventTarget();
  let tree = renderSlots.form;
  let cursor = 0;

  const renderWith = (slots, component) => {
    tree = slots;
    cursor = 0;
    return component();
  };

  const jsx = (type, props) => ({ type, props });
  const location = {
    href: url,
    get pathname() { return new URL(this.href).pathname; },
    get origin() { return new URL(this.href).origin; },
    assign(href) { routes.push(href); this.href = new URL(href, this.href).href; },
  };
  const context = createContext({
    process: { env: { NODE_ENV: "development", NEXT_PUBLIC_USE_MOCK: mode,
      NEXT_PUBLIC_API_BASE_URL: "https://recovery.invalid" } },
    Event, Headers, FormData, Blob, URL, URLSearchParams, ArrayBuffer, AbortController, AbortSignal: timeouts,
    crypto: { randomUUID },
    console: Object.fromEntries(["log", "info", "warn", "error", "debug"].map((key) => [key, (...args) => logs.push(args)])),
    window: {
      location,
      history: { replaceState(_state, _title, path) { location.href = new URL(path, location.href).href; } },
      navigator: { locks },
      localStorage: {
        getItem(key) {
          storageReads.push(key);
          readStorage(key);
          return storage.get(key) ?? null;
        },
        setItem: (key, value) => storage.set(key, value),
        removeItem: (key) => storage.delete(key),
      },
      sessionStorage: {
        getItem: (key) => tabStorage.get(key) ?? null,
        setItem: (key, value) => tabStorage.set(key, value),
        removeItem: (key) => tabStorage.delete(key),
      },
      addEventListener: events.addEventListener.bind(events),
      removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
    },
    fetch: async (url, init) => {
      const target = new URL(url);
      assert.equal(target.origin, "https://recovery.invalid");
      assert(endpoints.includes(target.pathname) || authEndpoints.includes(target.pathname));
      const request = { path: target.pathname, ...init };
      requests.push(request);
      return respond(request);
    },
  });
  const react = {
    useState(initial) {
      const slots = tree;
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (value) => { slots[index] = typeof value === "function" ? value(slots[index]) : value; }];
    },
    useRef(initial) {
      const index = cursor++;
      if (!(index in tree)) tree[index] = { current: initial };
      return tree[index];
    },
    useEffect(setup) {
      const index = cursor++;
      if (index in tree) return;
      tree[index] = true;
      const cleanup = setup();
      if (tree === renderSlots.form) cleanups.push(cleanup);
    },
    createContext: (value) => ({ value, Provider: "session-provider" }),
    useContext: (context) => context.value,
  };
  function load(target) {
    if (modules.has(target)) return modules.get(target).exports;
    const entry = { exports: {} };
    modules.set(target, entry);
    const require = (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "next/link") return { default: "link" };
      if (specifier === "next/navigation") return {
        useRouter: () => ({ replace: (href) => location.assign(href) }),
        useSearchParams: () => new URL(location.href).searchParams,
      };
      if (specifier === "lucide-react") return { Check: "icon" };
      if (specifier === "@/shared/ui") return { Button: "button", TextInput: "input" };
      const base = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(target), specifier);
      for (const candidate of [base + ".ts", base + ".tsx", resolve(base, "index.ts")]) {
        try { readFileSync(candidate); } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        return load(candidate);
      }
      assert.fail("Missing fixture import " + specifier);
    };
    const compiled = ts.transpileModule(readFileSync(target, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      fileName: target,
    }).outputText;
    new Script("(function(require,module,exports) {" + compiled + "\n})", { filename: target })
      .runInContext(context)(require, entry, entry.exports);
    return entry.exports;
  }
  const base = resolve(root, "src/features/auth-recovery");
  const { ResetPasswordForm } = load(resolve(base, "ui/reset-password-form.tsx"));
  const { RecoveryEmailForm } = load(resolve(base, "ui/recovery-email-form.tsx"));
  const api = load(resolve(base, "api/recovery.ts"));
  const { AuthProvider, apiClient, sessionContext, auth } = {
    AuthProvider: load(resolve(root, "src/entities/session/index.ts")).AuthProvider,
    apiClient: load(resolve(root, "src/shared/api/client.ts")).apiClient,
    sessionContext: load(resolve(root, "src/entities/session/model/context.ts")).SessionContext,
    auth: load(resolve(root, "src/shared/api/auth.ts")),
  };
  const provider = () => {
    const rendered = renderWith(renderSlots.provider, () => AuthProvider({ children: null }));
    sessionContext.value = rendered.props.value;
    return rendered.props.value;
  };
  const render = (kind = "id") => {
    provider();
    return renderWith(renderSlots.form, () => endpoint === "reset" ? ResetPasswordForm() : RecoveryEmailForm({ kind }));
  };
  return { api, apiClient, auth, provider, storage, render, requests, routes, logs, storageReads, location,
    unmount: () => cleanups.forEach((cleanup) => cleanup?.()) };
}

const input = (h, id, value, kind) => {
  const node = find(h.render(kind), (node) => node.type === "input" && node.props.id === id);
  assert(node);
  node.props.onChange({ target: { value } });
};
const submit = (h, kind) => {
  const form = find(h.render(kind), (node) => node.type === "form");
  let prevented = false;
  form.props.onSubmit({ preventDefault() { prevented = true; } });
  assert(prevented);
};
const fillReset = (h, token = codes.token, password = codes.password, confirmation = password) => {
  input(h, "reset-code", token);
  input(h, "new-password", password);
  input(h, "confirm-password", confirmation);
};
const status = (h, kind) => textOf(find(h.render(kind), (node) => node.props?.role === "status"));
const alert = (h, kind) => textOf(find(h.render(kind), (node) => node.props?.role === "alert"));

test("all three recovery paths POST their exact JSON, require 204 and leave the current session alone", async () => {
  const h = harness({ apiSession: initialSession, respond: noContent });
  const signal = new AbortController().signal;
  await h.api.findId(email, signal);
  await h.api.findPassword(email, signal);
  await h.api.resetPassword(codes.token, codes.password, signal);
  assert.deepEqual(h.requests.map(({ path }) => path), endpoints);
  assert.deepEqual(h.requests.map(({ body }) => JSON.parse(body)),
    [{ email }, { email }, { token: codes.token, newPassword: codes.password }]);
  for (const request of h.requests) {
    assert.equal(request.method, "POST");
    assert.equal(request.redirect, "error");
    assert.equal(request.signal, signal);
    assert.equal(request.headers.has("Authorization"), false);
    assert.equal(request.headers.get("content-type"), "application/json");
  }
  assert.deepEqual(h.storageReads, []);
  assert.deepEqual(h.logs, []);
});

test("email forms show the same generic message after 204 regardless of the entered address", async () => {
  for (const kind of ["id", "password"]) {
    const messages = [];
    for (const address of [email, "Other@example.invalid"]) {
      let finish;
      const h = harness({ respond: () => new Promise((resolve) => { finish = resolve; }) });
      input(h, "recovery-email", " " + address + " ", kind);
      submit(h, kind);
      submit(h, kind);
      assert.equal(h.requests.length, 1);
      assert.equal(JSON.parse(h.requests[0].body).email, address);
      assert.equal(status(h, kind), "");
      assert.equal(find(h.render(kind), (node) => node.type === "button").props.disabled, true);
      finish(noContent());
      await tick();
      messages.push(status(h, kind));
      assert.deepEqual(h.routes, []);
    }
    assert.match(messages[0], /가입된 계정이 있으면/);
    assert.equal(messages[0], messages[1]);
  }
});

test("email validation and HTTP, malformed success, or network errors never show a successful result", async () => {
  for (const kind of ["id", "password"]) {
    const invalid = harness();
    input(invalid, "recovery-email", "not-an-email", kind);
    submit(invalid, kind);
    assert.match(alert(invalid, kind), /이메일 주소/);
    assert.equal(invalid.requests.length, 0);

    for (const [respond, message] of [
      [() => Response.json({ account: "private-fixture" }, { status: 400 }), /메일 요청을 완료하지 못했어요/],
      [() => new Response(null, { status: 404 }), /메일 요청을 완료하지 못했어요/],
      [() => new Response(null, { status: 429 }), /요청이 너무 많아요/],
      [() => Response.json({ status: "ok" }), /메일 요청을 완료하지 못했어요/],
      [() => { throw new TypeError("private-fixture"); }, /서버에 연결할 수 없어요/],
    ]) {
      const h = harness({ respond });
      input(h, "recovery-email", email, kind);
      submit(h, kind);
      await tick();
      assert.equal(h.requests.length, 1);
      assert.equal(status(h, kind), "");
      assert.match(alert(h, kind), message);
      assert.doesNotMatch(alert(h, kind), /private-fixture|가입된 계정이 없/);
      assert.equal(find(h.render(kind), (node) => node.type === "button").props.disabled, false);
      assert.deepEqual(h.logs, []);
    }
  }
});

test("reset links initialize one code and remove token from the address without exposing it to navigation", () => {
  const h = harness({ endpoint: "reset",
    url: "https://frontend.invalid/reset-password?token=fixture-token%2B123&keep=1#form" });
  const rendered = h.render();
  assert.equal(find(rendered, (node) => node.props?.id === "reset-code").props.value, codes.token);
  assert.equal(new URL(h.location.href).searchParams.has("token"), false);
  assert.equal(new URL(h.location.href).search, "?keep=1");
  assert.equal(new URL(h.location.href).hash, "#form");
  assert.equal(find(h.render(), (node) => node.props?.id === "reset-code").props.value, codes.token);
  assert.deepEqual(h.routes, []);
  assert.deepEqual(h.logs, []);

  const ambiguous = harness({ endpoint: "reset",
    url: "https://frontend.invalid/reset-password?token=first&token=second" });
  assert.equal(find(ambiguous.render(), (node) => node.props?.id === "reset-code").props.value, "");
  assert.equal(new URL(ambiguous.location.href).search, "");
});

test("reset validates every input, prevents concurrent submission and navigates only after a 204", async () => {
  let finish;
  const h = harness({ endpoint: "reset", respond: () => new Promise((resolve) => { finish = resolve; }) });
  for (const [fields, message] of [
    [["", codes.password], /코드를 입력/],
    [[codes.token, "short"], /8자 이상/],
    [[codes.token, codes.password, "different"], /일치하지/],
  ]) {
    fillReset(h, ...fields);
    submit(h);
    assert.match(alert(h), message);
    assert.equal(h.requests.length, 0);
    assert.deepEqual(h.routes, []);
  }
  fillReset(h);
  submit(h);
  submit(h);
  assert.equal(h.requests.length, 1);
  assert.deepEqual(JSON.parse(h.requests[0].body), { token: codes.token, newPassword: codes.password });
  assert.deepEqual(h.routes, []);
  assert.equal(find(h.render(), (node) => node.type === "button").props.disabled, true);
  finish(noContent());
  await tick();
  assert.deepEqual(h.routes, ["/login"]);
  for (const id of ["reset-code", "new-password", "confirm-password"]) {
    assert.equal(find(h.render(), (node) => node.props?.id === id).props.value, "");
  }
  assert.deepEqual(h.logs, []);
});

test("reset handles invalid or expired codes, rate limits, and network failure without logging secrets", async () => {
  for (const [respond, message] of [
    [() => Response.json(codes, { status: 400 }), /올바르지 않거나 만료/],
    [() => Response.json(codes, { status: 429 }), /요청이 너무 많아요/],
    [() => Response.json(codes), /재설정하지 못했어요/],
    [() => { throw new Error(codes.token + codes.password); }, /서버에 연결할 수 없어요/],
  ]) {
    const h = harness({ endpoint: "reset", apiSession: initialSession, respond: (request) =>
      request.path === "/api/users/me" ? Response.json(profileA) : respond(request) });
    await restoreProfile(h);
    fillReset(h);
    submit(h);
    await tick();
    assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password"]);
    assertSession(h, profileA, initialSession);
    assert.match(alert(h), message);
    assert(!alert(h).includes(codes.token) && !alert(h).includes(codes.password));
    assert.deepEqual(h.routes, []);
    assert.deepEqual(h.logs, []);
    assert.equal(find(h.render(), (node) => node.type === "button").props.disabled, false);
  }
});

test("unmount aborts the request and an eventual success cannot navigate", async () => {
  let finish;
  const h = harness({ endpoint: "reset", respond: () => new Promise((resolve) => { finish = resolve; }) });
  fillReset(h);
  submit(h);
  h.unmount();
  assert(h.requests[0].signal.aborted);
  finish(noContent());
  await tick();
  assert.deepEqual(h.routes, []);
});

test("explicit Mock keeps demo mail requests and the new reset form out of the real transport", async () => {
  for (const kind of ["id", "password"]) {
    const h = harness({ mode: "true" });
    input(h, "recovery-email", email, kind);
    submit(h, kind);
    assert.match(status(h, kind), /실제 메일은 발송되지 않아요/);
    assert.equal(h.requests.length, 0);
  }
  const reset = harness({ mode: "true", endpoint: "reset" });
  fillReset(reset);
  submit(reset);
  assert.match(status(reset), /데모에서는 비밀번호를 변경할 수 없어요/);
  assert.equal(reset.requests.length, 0);
  assert.deepEqual(reset.routes, []);
});

async function restoreProfile(h) {
  h.provider();
  await tick();
  assert.equal(h.provider().isLoggedIn, true);
}

function assertSession(h, profile, session) {
  const state = h.provider();
  assert.equal(state.isLoggedIn, true);
  assert.equal(state.user.id, profile.loginId);
  assert.equal(state.apiSessionId, session.id);
  assert.deepEqual(JSON.parse(h.storage.get(sessionKey)), session);
}

test("204 clears the current profile and both tokens before navigating, with no logout or refresh", async () => {
  let completeReset;
  const h = harness({ endpoint: "reset", apiSession: initialSession, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    if (request.path === "/reset-password") return new Promise((resolve) => { completeReset = resolve; });
    assert.equal(request.path, "/protected-fixture");
    assert.equal(request.headers.has("Authorization"), false);
    return new Response(null, { status: 401 });
  } });
  await restoreProfile(h);
  h.storage.set("piston-access-token", "legacy-access");
  fillReset(h);
  submit(h);
  assertSession(h, profileA, initialSession);
  completeReset(noContent());
  await tick();
  assert.equal(h.provider().isLoggedIn, false);
  assert.equal(h.provider().user, null);
  assert.equal(h.provider().apiSessionId, null);
  assert.equal(h.storage.has(sessionKey), false);
  assert.equal(h.storage.has("piston-access-token"), false);
  assert.equal(h.auth.captureAuth().accessToken, null);
  assert.deepEqual(h.routes, ["/login"]);
  await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password", "/protected-fixture"]);
});

for (const profile of [profileB, profileA]) {
  test("204 preserves a new login session for " + profile.loginId + " and stays on the current screen", async () => {
    let completeReset;
    let refuseLock = false;
    const manager = createAuthLocks();
    const locks = {
      request: (name, options, callback) => refuseLock
        ? Promise.reject(new Error("fixture lock refused"))
        : manager.request(name, options, callback),
    };
    const h = harness({ endpoint: "reset", apiSession: initialSession, locks, respond(request) {
      if (request.path === "/api/users/me") {
        return Response.json(request.headers.get("Authorization") === "Bearer old-access" ? profileA : profile);
      }
      if (request.path === "/login") return Response.json(renewedTokens);
      assert.equal(request.path, "/reset-password");
      return new Promise((resolve) => { completeReset = resolve; });
    } });
    await restoreProfile(h);
    fillReset(h);
    submit(h);
    assert(await h.provider().loginWithCredentials({ id: profile.loginId, password: "fixture-password" }));
    const saved = JSON.parse(h.storage.get(sessionKey));
    assert.notEqual(saved.id, initialSession.id);
    assert.deepEqual(saved, { id: saved.id, ...renewedTokens });
    refuseLock = true;
    completeReset(noContent());
    await tick();
    assertSession(h, profile, saved);
    assert.equal(h.auth.captureAuth().session?.id, saved.id);
    assert.deepEqual(h.routes, []);
    assert.match(status(h), /비밀번호를 변경했어요/);
    for (const id of ["reset-code", "new-password", "confirm-password"]) {
      assert.equal(find(h.render(), (node) => node.props?.id === id).props.value, "");
    }
    assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password", "/login", "/api/users/me"]);
  });
}

test("session ownership is checked again inside the lock when another tab replaces storage", async () => {
  const locks = createAuthLocks();
  const h = harness({ endpoint: "reset", apiSession: initialSession, locks, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    assert.equal(request.path, "/reset-password");
    return noContent();
  } });
  await restoreProfile(h);
  let release;
  const otherTab = locks.request("piston-auth-storage", { mode: "exclusive" },
    () => new Promise((resolve) => { release = resolve; }));
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  assert.equal(locks.pending, 1);
  assert.deepEqual(h.routes, []);
  const newSession = { id: "session-b", ...renewedTokens };
  h.storage.set(sessionKey, JSON.stringify(newSession));
  release();
  await otherTab;
  await tick();
  assert.deepEqual(JSON.parse(h.storage.get(sessionKey)), newSession);
  assert.deepEqual(h.routes, []);
  assert.match(status(h), /비밀번호를 변경했어요/);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password"]);
});

function assertSignedOut(h) {
  assert.equal(h.provider().isLoggedIn, false);
  assert.equal(h.provider().user, null);
  assert.equal(h.storage.has(sessionKey), false);
  assert.equal(h.auth.captureAuth().accessToken, null);
  assert.deepEqual(h.routes, ["/login"]);
}

test("204 waits for a pending login and clears the original session when that login fails", async () => {
  let completeReset, completeLogin;
  const h = harness({ endpoint: "reset", apiSession: initialSession, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    if (request.path === "/login") return new Promise((resolve) => { completeLogin = resolve; });
    assert.equal(request.path, "/reset-password");
    return new Promise((resolve) => { completeReset = resolve; });
  } });
  await restoreProfile(h);
  fillReset(h);
  submit(h);
  const login = h.provider().loginWithCredentials({ id: profileB.loginId, password: "fixture-password" });
  await tick();
  completeReset(noContent());
  await tick();
  assertSession(h, profileA, initialSession);
  assert.deepEqual(h.routes, []);
  completeLogin(new Response(null, { status: 401 }));
  await assert.rejects(login, (error) => error.status === 401);
  await tick();
  assertSignedOut(h);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password", "/login"]);
});

test("204 waits for a pending login and preserves the replacement when that login succeeds", async () => {
  let completeLogin;
  const h = harness({ endpoint: "reset", apiSession: initialSession, respond(request) {
    if (request.path === "/api/users/me") {
      return Response.json(request.headers.get("Authorization") === "Bearer old-access" ? profileA : profileB);
    }
    if (request.path === "/login") return new Promise((resolve) => { completeLogin = resolve; });
    assert.equal(request.path, "/reset-password");
    return noContent();
  } });
  await restoreProfile(h);
  const login = h.provider().loginWithCredentials({ id: profileB.loginId, password: "fixture-password" });
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  assertSession(h, profileA, initialSession);
  assert.deepEqual(h.routes, []);
  completeLogin(Response.json(renewedTokens));
  assert(await login);
  await tick();
  const saved = JSON.parse(h.storage.get(sessionKey));
  assert.notEqual(saved.id, initialSession.id);
  assert.deepEqual(saved, { id: saved.id, ...renewedTokens });
  assertSession(h, profileB, saved);
  assert.deepEqual(h.routes, []);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/login", "/reset-password", "/api/users/me"]);
});

test("204 clears the observed session when storage recovers after the initial snapshot read", async () => {
  let failNextRead = false;
  const h = harness({ endpoint: "reset", apiSession: initialSession,
    readStorage(key) {
      if (failNextRead && key === sessionKey) {
        failNextRead = false;
        throw new Error("fixture storage read");
      }
    },
    respond(request) {
      if (request.path === "/api/users/me") return Response.json(profileA);
      assert.equal(request.path, "/reset-password");
      return noContent();
    },
  });
  await restoreProfile(h);
  fillReset(h);
  failNextRead = true;
  submit(h);
  await tick();
  assert.equal(failNextRead, false);
  assertSignedOut(h);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password"]);
});

test("unreadable storage inside the lock preserves the record, blocks old tokens, and prevents navigation", async () => {
  let unreadable = false;
  const h = harness({ endpoint: "reset", apiSession: initialSession,
    readStorage(key) { if (unreadable && key === sessionKey) throw new Error("fixture storage read"); },
    respond(request) {
      if (request.path === "/api/users/me") return Response.json(profileA);
      assert.equal(request.path, "/reset-password");
      unreadable = true;
      return noContent();
    },
  });
  await restoreProfile(h);
  fillReset(h);
  submit(h);
  await tick();
  unreadable = false;
  assert.equal(h.provider().user, null);
  assert.deepEqual(JSON.parse(h.storage.get(sessionKey)), initialSession);
  assert.deepEqual(h.routes, []);
  await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password"]);
});

for (const unreadable of [false, true]) {
  test("new session after lock release prevents navigation when storage is " + (unreadable ? "unreadable" : "readable"), async () => {
    const manager = createAuthLocks();
    let replaceAfterClear, failReads = false;
    const locks = {
      request: (name, options, callback) => manager.request(name, options, callback).then((result) => {
        replaceAfterClear?.();
        return result;
      }),
    };
    const h = harness({ endpoint: "reset", apiSession: initialSession, locks,
      readStorage(key) { if (failReads && key === sessionKey) throw new Error("fixture storage read"); },
      respond(request) {
        if (request.path === "/api/users/me") return Response.json(profileA);
        assert.equal(request.path, "/reset-password");
        return noContent();
      },
    });
    await restoreProfile(h);
    const next = { id: "session-after-clear", ...renewedTokens };
    replaceAfterClear = () => {
      assert.equal(h.storage.has(sessionKey), false);
      h.storage.set(sessionKey, JSON.stringify(next));
      failReads = unreadable;
      replaceAfterClear = undefined;
    };
    fillReset(h);
    submit(h);
    await tick();
    failReads = false;
    assert.deepEqual(JSON.parse(h.storage.get(sessionKey)), next);
    assert.deepEqual(h.routes, []);
    if (unreadable) await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
    assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password"]);
  });
}

function createAuthClock() {
  let now = 0;
  const timers = [];
  return {
    timeouts: {
      any: (signals) => AbortSignal.any(signals),
      timeout(milliseconds) {
        assert.equal(milliseconds, 5_000);
        const controller = new AbortController();
        timers.push({ at: now + milliseconds, controller });
        return controller.signal;
      },
    },
    advance(milliseconds) {
      now += milliseconds;
      for (const timer of timers) {
        if (timer.at <= now) timer.controller.abort(new DOMException("Fixture deadline", "TimeoutError"));
      }
    },
  };
}

test("a login that never responds cannot extend reset cleanup beyond the five-second wait", async () => {
  const clock = createAuthClock();
  const h = harness({ endpoint: "reset", apiSession: initialSession, timeouts: clock.timeouts, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    if (request.path === "/reset-password") return noContent();
    assert.equal(request.path, "/login");
    return new Promise(() => {});
  } });
  await restoreProfile(h);
  void h.provider().loginWithCredentials({ id: profileA.loginId, password: "fixture-password" });
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  assert.match(status(h), /비밀번호를 변경했어요/);
  const attempt = h.requests.find(({ path }) => path === "/login");
  assert.equal(attempt.signal.aborted, false);
  await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
  clock.advance(4_999);
  await tick();
  assert.equal(attempt.signal.aborted, false);
  assert.deepEqual(h.routes, []);
  assert.equal(h.storage.has(sessionKey), true);
  clock.advance(1);
  await tick();
  assert.equal(attempt.signal.reason.name, "TimeoutError");
  assertSignedOut(h);
  assert.equal(find(h.render(), (node) => node.type === "form").props["aria-busy"], false);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/login", "/reset-password"]);
});

test("a late login response after the deadline cannot replace a newly verified session", async () => {
  const clock = createAuthClock();
  let finishExpiredLogin;
  const h = harness({ endpoint: "reset", apiSession: initialSession, timeouts: clock.timeouts, respond(request) {
    if (request.path === "/reset-password") return noContent();
    if (request.path === "/login") {
      if (JSON.parse(request.body).id === profileA.loginId) {
        return new Promise((resolve) => { finishExpiredLogin = resolve; });
      }
      return Response.json(renewedTokens);
    }
    if (request.path === "/api/users/me") {
      const header = request.headers.get("Authorization");
      if (header === "Bearer old-access") return Response.json(profileA);
      assert.equal(header, "Bearer " + renewedTokens.accessToken);
      return Response.json(profileB);
    }
    assert.equal(request.path, "/protected-fixture");
    assert.equal(request.headers.get("Authorization"), "Bearer " + renewedTokens.accessToken);
    return Response.json({ allowed: true });
  } });
  await restoreProfile(h);
  const expiredLogin = h.provider().loginWithCredentials({ id: profileA.loginId, password: "fixture-password" });
  const expired = assert.rejects(expiredLogin, (error) => error.name === "TimeoutError");
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  clock.advance(5_000);
  await tick();
  assertSignedOut(h);
  assert(await h.provider().loginWithCredentials({ id: profileB.loginId, password: "fixture-password" }));
  const saved = JSON.parse(h.storage.get(sessionKey));
  finishExpiredLogin(Response.json({ accessToken: "stale-access", refreshToken: "stale-refresh" }));
  await expired;
  await tick();
  assertSession(h, profileB, saved);
  assert.equal(h.auth.captureAuth().accessToken, renewedTokens.accessToken);
  assert.deepEqual(h.routes, ["/login"]);
  await h.apiClient.get("/protected-fixture");
  assert.deepEqual(h.requests.map(({ path }) => path), [
    "/api/users/me", "/login", "/reset-password", "/login", "/api/users/me", "/protected-fixture",
  ]);
});

test("a 401 from a request already in flight after reset does not refresh the old credentials", async () => {
  let completeLogin, completeRead;
  const h = harness({ endpoint: "reset", apiSession: initialSession, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    if (request.path === "/reset-password") return noContent();
    if (request.path === "/login") return new Promise((resolve) => { completeLogin = resolve; });
    assert.equal(request.path, "/protected-fixture");
    return new Promise((resolve) => { completeRead = resolve; });
  } });
  await restoreProfile(h);
  const read = assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
  const login = assert.rejects(h.provider().loginWithCredentials({ id: profileB.loginId, password: "fixture-password" }),
    (error) => error.status === 401);
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  completeRead(new Response(null, { status: 401 }));
  await read;
  assert.equal(h.storage.has(sessionKey), true);
  assert.deepEqual(h.routes, []);
  completeLogin(new Response(null, { status: 401 }));
  await login;
  await tick();
  assertSignedOut(h);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/protected-fixture", "/login", "/reset-password"]);
});

test("canceling a pending login releases the reset wait before the deadline", async () => {
  const clock = createAuthClock();
  const controller = new AbortController();
  const h = harness({ endpoint: "reset", apiSession: initialSession, timeouts: clock.timeouts, respond(request) {
    if (request.path === "/api/users/me") return Response.json(profileA);
    if (request.path === "/reset-password") return noContent();
    assert.equal(request.path, "/login");
    return new Promise((_resolve, reject) => {
      request.signal.addEventListener("abort", () => reject(request.signal.reason), { once: true });
    });
  } });
  await restoreProfile(h);
  const login = assert.rejects(
    h.provider().loginWithCredentials({ id: profileA.loginId, password: "fixture-password" }, controller.signal),
    (error) => error.name === "AbortError",
  );
  await tick();
  fillReset(h);
  submit(h);
  await tick();
  assert.deepEqual(h.routes, []);
  controller.abort();
  await login;
  await tick();
  assertSignedOut(h);
  assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/login", "/reset-password"]);
});

const resetRecord = "piston-auth-reset-session:" + initialSession.id;

for (const waiting of ["login response", "Web Lock"]) {
  test("a new document cannot restore a reset session while waiting for " + waiting, async () => {
    const locks = createAuthLocks();
    const storage = new Map([[sessionKey, JSON.stringify(initialSession)]]);
    let finishLogin, release;
    const h = harness({ endpoint: "reset", sharedStorage: storage, locks, respond(request) {
      if (request.path === "/api/users/me") return Response.json(profileA);
      if (request.path === "/login") return new Promise((resolve) => { finishLogin = resolve; });
      assert.equal(request.path, "/reset-password");
      return noContent();
    } });
    await restoreProfile(h);

    const wait = waiting === "login response"
      ? assert.rejects(h.provider().loginWithCredentials({ id: profileA.loginId, password: "fixture-password" }),
        (error) => error.status === 401)
      : locks.request("piston-auth-storage", { mode: "exclusive" }, () => new Promise((resolve) => { release = resolve; }));
    await tick();
    fillReset(h);
    submit(h);
    await tick();
    assert.match(status(h), /비밀번호를 변경했어요/);
    assert.equal(storage.has(sessionKey), true);

    const reloaded = harness({ sharedStorage: storage, respond(request) {
      assert.equal(request.path, "/api/users/me");
      return Response.json(profileA);
    } });
    reloaded.provider();
    await tick();
    assert.equal(reloaded.provider().user, null);
    assert.deepEqual(reloaded.requests, []);
    await assert.rejects(reloaded.apiClient.get("/protected-fixture"), (error) => error.status === 401);
    assert.equal(storage.get(resetRecord), "true");

    if (finishLogin) finishLogin(new Response(null, { status: 401 }));
    else release();
    await wait;
    await tick();
    assertSignedOut(h);
    assert.equal(storage.has(resetRecord), false);
  });
}

for (const profile of [profileA, profileB]) {
  test("cleanup lock timeout preserves the verified replacement for " + profile.loginId, async () => {
    const clock = createAuthClock();
    const manager = createAuthLocks();
    let waitForTimeout = false;
    const locks = { request(name, options, callback) {
      if (!waitForTimeout) return manager.request(name, options, callback);
      return new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(options.signal.reason), { once: true });
      });
    } };
    const storage = new Map([[sessionKey, JSON.stringify(initialSession)]]);
    const h = harness({ endpoint: "reset", sharedStorage: storage, timeouts: clock.timeouts, locks, respond(request) {
      if (request.path === "/api/users/me") return Response.json(profileA);
      if (request.path === "/reset-password") return noContent();
      assert.equal(request.path, "/protected-fixture");
      assert.equal(request.headers.get("Authorization"), "Bearer " + renewedTokens.accessToken);
      return Response.json({ fixture: true });
    } });
    await restoreProfile(h);
    waitForTimeout = true;
    fillReset(h);
    submit(h);
    await tick();

    const newTab = harness({ sharedStorage: storage, respond(request) {
      if (request.path === "/login") return Response.json(renewedTokens);
      assert.equal(request.path, "/api/users/me");
      assert.equal(request.headers.get("Authorization"), "Bearer " + renewedTokens.accessToken);
      return Response.json(profile);
    } });
    assert(await newTab.provider().loginWithCredentials({ id: profile.loginId, password: "fixture-password" }));
    const saved = JSON.parse(storage.get(sessionKey));
    assert.notEqual(saved.id, initialSession.id);
    clock.advance(5_000);
    await tick();
    assertSession(newTab, profile, saved);
    assert.deepEqual(h.routes, []);
    assert.equal(h.auth.captureAuth().session?.id, saved.id);
    await h.apiClient.get("/protected-fixture");
    assert.deepEqual(h.requests.map(({ path }) => path), ["/api/users/me", "/reset-password", "/protected-fixture"]);
  });
}

test("an unreadable reset marker prevents profile restoration and protected requests", async () => {
  const storage = new Map([[sessionKey, JSON.stringify(initialSession)]]);
  const h = harness({ sharedStorage: storage, readStorage(key) {
    if (key === resetRecord) throw new Error("fixture marker unavailable");
  }, respond(request) {
    assert.equal(request.path, "/api/users/me");
    return Response.json(profileA);
  } });
  h.provider();
  await tick();
  assert.equal(h.provider().user, null);
  await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
  assert.deepEqual(h.requests, []);
  assert.deepEqual(JSON.parse(storage.get(sessionKey)), initialSession);
});
