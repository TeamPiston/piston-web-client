import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

const file = fileURLToPath(import.meta.url);
const root = resolve(dirname(file), "..");
if (!process.argv.includes("--child")) {
  for (const mode of ["true", "false", undefined, "", "TRUE"]) {
    const env = { ...process.env, NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: mode };
    if (mode === undefined) delete env.NEXT_PUBLIC_USE_MOCK;
    console.log("LOGIN MODE " + JSON.stringify(mode ?? "unset"));
    execFileSync(process.execPath, [file, "--child"], { env, stdio: "inherit" });
  }
} else {
  const mockMode = process.env.NEXT_PUBLIC_USE_MOCK === "true";
  // Execute actual hook, form, session Provider and mode helper. Hook cells and
  // context delivery are synchronous simulations, not React DOM or scheduling.
  const tick = () => new Promise((done) => setImmediate(done));
  const tokens = { accessToken: "fixture-access", refreshToken: "fixture-refresh" };
  const profile = { userId: 31, loginId: "admin", email: "server-admin@example.invalid", createdAt: "2026-01-01T00:00:00Z" };
  function harness(existingUser = null, {
    storedSession, apiSession, respond, tabStorage = new Map(), sharedStorage, locks = createAuthLocks(),
  } = {}) {
    const modules = new Map();
    const slots = new Map();
    const storage = sharedStorage ?? new Map(existingUser ? [["piston-auth", JSON.stringify(existingUser)], ["piston-access-token", "synthetic-existing-token"]] : []);
    if (storedSession !== undefined) storage.set("piston-auth", storedSession);
    if (apiSession) storage.set("piston-api-session", JSON.stringify(apiSession));
    const writes = [], routes = [], logs = [], requests = [];
    const events = new EventTarget();
    const cleanups = new Map();
    let owner, cursor, sessionContext, httpCount = 0;
    const render = (key, fn) => {
      owner = key; cursor = 0;
      if (!slots.has(key)) slots.set(key, []);
      return fn();
    };
    const react = {
      useState(initial) {
        const cells = slots.get(owner), index = cursor++;
        if (!(index in cells)) cells[index] = typeof initial === "function" ? initial() : initial;
        return [cells[index], (value) => { cells[index] = typeof value === "function" ? value(cells[index]) : value; }];
      },
      useRef(initial) {
        const cells = slots.get(owner), index = cursor++;
        if (!(index in cells)) cells[index] = { current: initial };
        return cells[index];
      },
      useEffect(setup, dependencies) {
        const cells = slots.get(owner), index = cursor++;
        const previous = cells[index];
        if (previous?.dependencies?.every((value, i) => value === dependencies?.[i])) return;
        previous?.cleanup?.();
        const cleanup = setup();
        cells[index] = { dependencies, cleanup };
        if (!cleanups.has(owner)) cleanups.set(owner, new Map());
        cleanups.get(owner).set(index, cleanup);
      },
      useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
      createContext: (value) => ({ value, Provider: "SessionProvider" }),
      useContext: (context) => context.value,
    };
    const context = createContext({
      process: { env: { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK, NEXT_PUBLIC_API_BASE_URL: "https://login.invalid" } },
      crypto: { randomUUID }, URL, Headers, FormData, Event, AbortController, AbortSignal,
      console: Object.fromEntries(["log", "warn", "error", "debug", "info"].map((key) => [key, (...args) => logs.push(args)])),
      window: { navigator: { locks }, localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { writes.push(key); storage.set(key, value); },
        removeItem: (key) => { writes.push(key); storage.delete(key); },
      }, sessionStorage: {
        getItem: (key) => tabStorage.get(key) ?? null,
        setItem: (key, value) => tabStorage.set(key, value),
        removeItem: (key) => tabStorage.delete(key),
      }, addEventListener: events.addEventListener.bind(events), removeEventListener: events.removeEventListener.bind(events),
      dispatchEvent: events.dispatchEvent.bind(events),
      location: { origin: "https://frontend.invalid", pathname: "/login", assign: (url) => routes.push(url) } },
      fetch: async (url, options) => {
        httpCount += 1;
        assert.match(url, /^https:\/\/login\.invalid\/(?:login|logout|reissue|api\/users\/me|protected-fixture)$/);
        assert(respond, "Unexpected HTTP");
        const request = { url, ...options };
        requests.push(request);
        return respond(request);
      },
    });
    function load(path) {
      if (modules.has(path)) return modules.get(path).exports;
      const loaded = { exports: {} };
      modules.set(path, loaded);
      const require = (name) => {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
        if (name === "next/navigation") return { useRouter: () => ({ push: (url) => routes.push(url), replace: (url) => routes.push(url) }) };
        if (name === "next/link") return { default: "Link" };
        if (name === "lucide-react") return { Eye: "Eye", EyeOff: "EyeOff" };
        if (name === "@/shared/ui") return {
          Button: load(resolve(root, "src/shared/ui/button.tsx")).Button,
          TextInput: load(resolve(root, "src/shared/ui/text-input.tsx")).TextInput,
        };
        if (name === "@/entities/session") return { useAuth: load(resolve(root, "src/entities/session/model/use-auth.ts")).useAuth };
        const target = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(path), name);
        const found = [target + ".ts", target + ".tsx", resolve(target, "index.ts")].find(existsSync);
        assert(found, "Unexpected import " + name);
        return load(found);
      };
      const source = ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX }, fileName: path,
      }).outputText;
      new Script("(function(require,module,exports){" + source + "\n})", { filename: path }).runInContext(context)(require, loaded, loaded.exports);
      return loaded.exports;
    }
    const { AuthProvider } = load(resolve(root, "src/entities/session/model/provider.tsx"));
    sessionContext = load(resolve(root, "src/entities/session/model/context.ts")).SessionContext;
    const { useLoginForm } = load(resolve(root, "src/features/auth-login/model/use-login-form.ts"));
    const { LoginForm } = load(resolve(root, "src/features/auth-login/ui/login-form.tsx"));
    const mock = load(resolve(root, "src/shared/mock/mock-data.ts"));
    const provider = () => {
      const tree = render("provider", () => AuthProvider({ children: null }));
      sessionContext.value = tree.props.value;
      return tree.props.value;
    };
    return {
      mock, storage, tabStorage, window: context.window, writes, routes, logs, requests, provider,
      captureAuth: load(resolve(root, "src/shared/api/auth.ts")).captureAuth,
      apiClient: load(resolve(root, "src/shared/api/client.ts")).apiClient,
      httpCount: () => httpCount,
      remountProvider() {
        cleanups.get("provider")?.forEach((cleanup) => cleanup?.());
        cleanups.delete("provider");
        slots.delete("provider");
        return provider();
      },
      protectedRoute() {
        provider();
        const { ProtectedRoute } = load(resolve(root, "src/features/auth-guard/ui/protected-route.tsx"));
        return render("protected", () => ProtectedRoute({ children: "protected-content" }));
      },
      form() { provider(); return render("form", useLoginForm); },
      tree() { provider(); return render("form", LoginForm); },
    };
  }
  function fill(h, id, password) {
    const form = h.form(); form.setId(id); form.setPassword(password); return h.form();
  }
  function submit(form) {
    let prevented = false;
    const result = form.handleSubmit({ preventDefault() { prevented = true; } });
    assert(prevented); return result;
  }
  function assertNoTransport(h) { assert.equal(h.httpCount(), 0); assert.deepEqual(h.logs, []); }
  test("stored Mock profile restores only in explicit Mock mode without rewriting data", () => {
    const h = harness();
    h.storage.set("piston-auth", JSON.stringify(h.mock.MOCK_USER_PROFILE));
    h.storage.set("piston-access-token", "synthetic-existing-token");
    const saved = JSON.stringify([...h.storage]);
    assert.equal(h.provider().isLoggedIn, mockMode);
    assert.equal(JSON.stringify(h.provider().user), JSON.stringify(mockMode ? h.mock.MOCK_USER_PROFILE : null));
    assert.equal(h.remountProvider().isLoggedIn, mockMode);
    assert.equal(JSON.stringify([...h.storage]), saved);
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.routes, []);
    assertNoTransport(h);
  });
  test("legacy true session restores only in explicit Mock mode and remains intact", () => {
    const h = harness(null, { storedSession: "true" });
    assert.equal(h.provider().isLoggedIn, mockMode);
    assert.equal(h.provider().user, mockMode ? h.mock.MOCK_USER_PROFILE : null);
    assert.equal(h.storage.get("piston-auth"), "true");
    assert.deepEqual(h.writes, []);
    assert.deepEqual(h.routes, []);
    assertNoTransport(h);
  });
  test("missing and malformed sessions remain signed out without data deletion", () => {
    for (const storedSession of [undefined, "", "{broken", "null", "false", "{}", '{"id":"fixture"}']) {
      const h = harness(null, { storedSession });
      const saved = JSON.stringify([...h.storage]);
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.provider().user, null);
      assert.equal(JSON.stringify([...h.storage]), saved);
      assert.deepEqual(h.writes, []);
      assert.deepEqual(h.routes, []);
      assertNoTransport(h);
    }
  });
  test("explicit logout clears auth data, keeps unrelated storage and prevents restoration", () => {
    const h = harness({ id: "fixture", email: "fixture@example.com", name: "Fixture" });
    h.storage.set("fixture-preference", "preserved");
    h.provider().logout();
    assert.equal(h.provider().isLoggedIn, false);
    assert.equal(h.storage.has("piston-auth"), false);
    assert.equal(h.storage.has("piston-access-token"), false);
    assert.equal(h.storage.get("fixture-preference"), "preserved");
    assert.deepEqual(h.writes, ["piston-api-session", "piston-access-token", "piston-auth"]);
    assert.equal(h.remountProvider().isLoggedIn, false);
    assert.deepEqual(h.routes, []);
    assertNoTransport(h);
  });
  test("Provider login creates a profile only in Mock mode and never creates tokens", () => {
    const h = harness();
    h.provider().login(h.mock.MOCK_USER_PROFILE);
    assert.equal(h.provider().isLoggedIn, mockMode);
    assert.equal(h.remountProvider().isLoggedIn, mockMode);
    assert.deepEqual([...h.storage.keys()], mockMode ? ["piston-auth"] : []);
    assert.deepEqual(h.writes, mockMode ? ["piston-auth"] : []);
    assert.deepEqual(h.routes, []);
    assertNoTransport(h);
  });
  if (mockMode) {
    for (const id of ["admin", "  ADMIN@EXAMPLE.COM  "]) {
      test("Mock accepts existing demo ID/email " + id.trim(), () => {
        const h = harness(); submit(fill(h, id, h.mock.MOCK_LOGIN_CREDENTIALS.password));
        assert.equal(h.provider().user, h.mock.MOCK_USER_PROFILE);
        assert.equal(h.provider().isLoggedIn, true);
        assert.equal(JSON.parse(h.storage.get("piston-auth")).id, h.mock.MOCK_USER_PROFILE.id);
        assert.equal(h.storage.has("piston-access-token"), false);
        assert.equal(h.remountProvider().user.id, h.mock.MOCK_USER_PROFILE.id);
        assert.equal(h.provider().isLoggedIn, true);
        assert.deepEqual(h.routes, ["/feed"]); assertNoTransport(h);
      });
    }
    test("Mock rejects wrong credentials and permits a corrected retry", () => {
      const h = harness(); submit(fill(h, "admin", "wrong-fixture"));
      assert(h.form().error); assert.equal(h.provider().user, null);
      assert.equal(h.storage.size, 0); assert.deepEqual(h.routes, []);
      submit(fill(h, "wrong-id", h.mock.MOCK_LOGIN_CREDENTIALS.password));
      assert.equal(h.provider().user, null);
      submit(fill(h, "admin", h.mock.MOCK_LOGIN_CREDENTIALS.password));
      assert.equal(h.provider().isLoggedIn, true); assertNoTransport(h);
    });
  } else {
    test("API login verifies exact credentials once and maps the server's real admin profile", async () => {
      let resolveLogin;
      const h = harness(null, { respond: (request) => request.url.endsWith("/login")
        ? new Promise((resolve) => { resolveLogin = resolve; })
        : Response.json(profile) });
      const form = fill(h, "  AdminCase  ", "CaseSensitive!");
      const pending = submit(form);
      await submit(form);
      await tick();
      assert.equal(h.requests.length, 1);
      assert.equal(h.form().isSubmitting, true);
      const call = h.requests[0];
      assert.equal(call.method, "POST");
      assert.equal(call.headers.has("Authorization"), false);
      assert.deepEqual(JSON.parse(call.body), { id: "AdminCase", password: "CaseSensitive!" });
      assert.equal(h.storage.has("piston-api-session"), false);
      resolveLogin(Response.json(tokens));
      await pending;
      assert.deepEqual(h.requests.map(({ url }) => new URL(url).pathname), ["/login", "/api/users/me"]);
      assert.equal(h.requests[1].headers.get("Authorization"), "Bearer fixture-access");
      assert.deepEqual(JSON.parse(JSON.stringify(h.provider().user)), {
        id: profile.loginId, name: profile.loginId, userId: "31", email: profile.email, createdAt: profile.createdAt,
      });
      assert.equal(JSON.parse(h.storage.get("piston-api-session")).refreshToken, tokens.refreshToken);
      assert.deepEqual(h.routes, ["/feed"]);
      assert.equal(h.form().isSubmitting, false);
      assert.deepEqual(h.logs, []);
    });

    test("API login distinguishes credentials, malformed tokens, and profile verification failure", async () => {
      for (const [respond, count, invalid] of [
        [() => new Response(null, { status: 401 }), 1, true],
        [() => Response.json({ accessToken: "incomplete" }), 1, false],
        [(request) => request.url.endsWith("/login") ? Response.json(tokens) : new Response(null, { status: 401 }), 2, false],
      ]) {
        const h = harness(null, { respond });
        await submit(fill(h, "Fixture", "SyntheticSecret"));
        assert.equal(h.requests.length, count);
        const error = h.form().error;
        assert.match(error, invalid ? /아이디 또는 비밀번호가 올바르지 않습니다/ : /로그인을 완료할 수 없습니다/);
        assert.equal(h.storage.has("piston-api-session"), false);
        assert.equal(h.provider().isLoggedIn, false);
        assert.equal(h.form().isSubmitting, false);
        assert.deepEqual(h.routes, []);
        assert.deepEqual(h.logs, []);
      }
    });

    test("profile bootstrap is single-flight across remount and ProtectedRoute waits for verification", async () => {
      let resolveProfile;
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        respond: () => new Promise((resolve) => { resolveProfile = resolve; }) });
      assert.equal(h.provider().isRestoring, true);
      assert.equal(h.protectedRoute(), null);
      assert.deepEqual(h.routes, []);
      h.remountProvider();
      await tick();
      assert.equal(h.requests.length, 1);
      resolveProfile(Response.json(profile));
      await tick();
      assert.equal(h.provider().isRestoring, false);
      assert.equal(h.provider().user.name, profile.loginId);
      assert.equal(h.protectedRoute(), "protected-content");
      assert.deepEqual(h.routes, []);
    });

    test("failed profile restoration clears the saved API session", async () => {
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        respond: () => Response.json({}, { status: 403 }) });
      assert.equal(h.provider().isRestoring, true);
      await tick();
      assert.equal(h.storage.has("piston-api-session"), false);
      assert.equal(h.provider().isRestoring, false);
      assert.equal(h.provider().isLoggedIn, false);
    });

    test("temporary profile failure leaves the session unverified and allows restoration on a later load", async () => {
      let attempts = 0;
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        respond: () => ++attempts === 1 ? Promise.reject(new TypeError("offline")) : Response.json(profile) });
      h.provider();
      await tick();
      assert.equal(h.provider().isRestoring, false);
      assert.equal(h.provider().isLoggedIn, false);
      assert.deepEqual(JSON.parse(h.storage.get("piston-api-session")), { ...tokens, id: "existing" });
      assert.equal(h.protectedRoute(), null);
      h.remountProvider();
      await tick();
      assert.equal(h.provider().user.id, profile.loginId);
      assert.equal(h.requests.length, 2);
    });

    test("old restore results cannot invalidate a newer login before or after it finishes", async () => {
      for (const [oldStatus, completeOldFirst, sameAccount] of [
        [401, true, false], [403, true, false], [200, false, false], [403, false, true], [200, false, true],
      ]) {
        let finishOld, finishNew;
        const nextTokens = { accessToken: "new-fixture-access", refreshToken: "new-fixture-refresh" };
        const nextProfile = { ...profile, loginId: sameAccount ? profile.loginId : "other-fixture",
          userId: sameAccount ? profile.userId : 37, email: "verified-new@example.invalid" };
        const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) => {
          if (request.url.endsWith("/login")) return Response.json(nextTokens);
          assert(request.url.endsWith("/api/users/me"), "Old restoration must not trigger reissue");
          return request.headers.get("Authorization") === "Bearer fixture-access"
            ? new Promise((resolve) => { finishOld = resolve; })
            : new Promise((resolve) => { finishNew = resolve; });
        } });
        h.provider();
        await tick();
        const attempt = submit(fill(h, "Fixture", "SyntheticSecret"));
        await tick();
        assert(finishOld && finishNew);
        const oldResponse = oldStatus === 200 ? Response.json(profile) : new Response(null, { status: oldStatus });
        if (completeOldFirst) {
          finishOld(oldResponse);
          await tick();
          assert.equal(h.protectedRoute(), null);
          assert.deepEqual(h.routes, []);
        }
        finishNew(Response.json(nextProfile));
        await attempt;
        if (!completeOldFirst) finishOld(oldResponse);
        await tick();
        const current = h.provider();
        assert.equal(current.isRestoring, false);
        assert.equal(current.user.email, nextProfile.email);
        assert.notEqual(current.apiSessionId, "existing");
        assert.equal(h.captureAuth().accessToken, nextTokens.accessToken);
        assert.deepEqual(h.routes, ["/feed"]);
        assert.equal(h.requests.length, 3);
      }
    });

    test("logout during profile restoration prevents a late response from restoring the user", async () => {
      let finishProfile;
      const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) => {
        if (request.url.endsWith("/logout")) return new Response(null, { status: 204 });
        return new Promise((resolve) => { finishProfile = resolve; });
      } });
      h.provider();
      await tick();
      h.provider().logout();
      finishProfile(Response.json(profile));
      await tick();
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.provider().isRestoring, false);
      assert.equal(h.captureAuth().accessToken, null);
      assert.equal(h.requests.length, 2);
      assert.equal(h.protectedRoute(), null);
      assert.deepEqual(h.routes, ["/login"]);
    });

    test("logout remains effective when either token store or the storage getter throws", async () => {
      const key = "piston-api-session";
      for (const denied of [key, "piston-access-token", "piston-auth", "getter"]) {
        const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) => {
          if (request.url.endsWith("/logout")) throw new TypeError("synthetic network error");
          return Response.json(profile);
        } });
        h.storage.set("piston-access-token", "legacy-fixture-token");
        h.storage.set("piston-auth", JSON.stringify({ id: "fixture", name: "Fixture", email: "fixture@example.invalid" }));
        h.provider();
        await tick();
        assert.equal(h.provider().isLoggedIn, true);
        const localStorage = h.window.localStorage;
        const removeItem = localStorage.removeItem;
        if (denied === "getter") {
          Object.defineProperty(h.window, "localStorage", { configurable: true, get() { throw new Error("denied"); } });
        } else {
          localStorage.removeItem = (storageKey) => {
            if (storageKey === denied) throw new Error("denied");
            removeItem(storageKey);
          };
        }
        assert.doesNotThrow(() => h.provider().logout());
        if (denied === "getter") Object.defineProperty(h.window, "localStorage", { value: localStorage });
        await tick();
        assert.equal(h.provider().isLoggedIn, false);
        assert.equal(h.provider().isRestoring, false);
        assert.equal(h.captureAuth().accessToken, null);
        assert(h.storage.has(denied === "getter" ? key : denied));
        if (denied !== "getter") {
          assert.equal(h.storage.size, 1);
          assert.equal(h.requests.filter(({ method }) => method === "POST").length, 1);
        }
        assert.equal(h.protectedRoute(), null);
        assert.deepEqual(h.routes, ["/login"]);
        const reloaded = harness(null, { tabStorage: h.tabStorage, apiSession: JSON.parse(h.storage.get(key) ?? "null") });
        for (const [storedKey, value] of h.storage) reloaded.storage.set(storedKey, value);
        reloaded.provider();
        await tick();
        assert.equal(reloaded.captureAuth().accessToken, null);
        assert.equal(reloaded.provider().isLoggedIn, false);
        assert.equal(reloaded.requests.length, 0);
      }
    });

    test("logout fences the old tokens when only the ownership recheck throws", async () => {
      const key = "piston-api-session";
      const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) => {
        if (request.url.endsWith("/logout")) throw new TypeError("synthetic network error");
        return Response.json(profile);
      } });
      h.provider();
      await tick();
      h.storage.set("piston-access-token", "synthetic-legacy-access");
      const local = h.window.localStorage;
      const getItem = local.getItem;
      let reads = 0;
      local.getItem = (name) => {
        if (name === key && ++reads === 2) throw new Error("synthetic read failure");
        return getItem(name);
      };
      h.provider().logout();
      assert.equal(h.provider().isLoggedIn, false);
      await tick();
      assert.equal(reads, 2);
      assert.equal(h.requests.filter(({ method }) => method === "POST").length, 1);
      assert(h.storage.has(key), "Unknown shared owner must not be deleted");
      assert.equal(h.storage.has("piston-access-token"), false);
      assert.equal(h.captureAuth().accessToken, null);
      const reload = harness(null, { sharedStorage: h.storage, tabStorage: h.tabStorage });
      reload.provider();
      await tick();
      assert.equal(reload.provider().isLoggedIn, false);
      assert.equal(reload.requests.length, 0);
    });

    test("an unreadable logout marker blocks restoration with a retained session", async () => {
      const h = harness(null, {
        apiSession: { ...tokens, id: "existing" },
        tabStorage: new Map([["piston-auth-cleanup-failed", "true"]]),
      });
      h.window.sessionStorage.getItem = () => { throw new Error("synthetic marker read failure"); };
      h.provider();
      await tick();
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.provider().isRestoring, false);
      assert.equal(h.captureAuth().accessToken, null);
      assert.equal(h.requests.length, 0);
      assert(h.storage.has("piston-api-session"));
    });

    test("without Web Locks API auth fails closed without deleting shared tokens", async () => {
      const h = harness(null, { locks: null, apiSession: { ...tokens, id: "existing" } });
      h.provider();
      await tick();
      assert.equal(h.provider().isRestoring, false);
      const form = fill(h, "Fixture", "SyntheticSecret");
      await submit(form);
      assert(h.form().error);
      assert.equal(h.requests.length, 0);
      h.provider().logout();
      await tick();
      assert(h.storage.has("piston-api-session"));
      assert.equal(h.captureAuth().accessToken, null);
      assert.equal(h.provider().isLoggedIn, false);
    });

    function twoTabs(respondA) {
      const locks = createAuthLocks();
      const a = harness(null, { locks, apiSession: { ...tokens, id: "initial-A" }, respond: respondA });
      const b = harness(null, { locks, sharedStorage: a.storage, respond: (request) =>
        request.url.endsWith("/login") ? Response.json({ accessToken: "fixture-B", refreshToken: "fixture-B-refresh" })
          : Response.json({ ...profile, userId: 22, loginId: "new-fixture-B" }) });
      return { locks, a, b };
    }

    async function verifyTabA(a) {
      a.provider();
      await tick();
      assert.equal(a.provider().apiSessionId, "initial-A");
    }

    function holdStorageLock(locks) {
      let release;
      const done = locks.request("piston-auth-storage", { mode: "exclusive" },
        () => new Promise((resolve) => { release = resolve; }));
      return async () => { release(); await done; };
    }

    test("an older logout queued after the other tab's login preserves the new session", async () => {
      const { locks, a, b } = twoTabs((request) => request.url.endsWith("/logout")
        ? new Response(null, { status: 204 }) : Response.json(profile));
      await verifyTabA(a);
      b.provider();
      await tick();

      const unlock = holdStorageLock(locks);
      const login = submit(fill(b, "fixture-B", "SyntheticSecret"));
      await tick();
      a.provider().logout();
      assert.equal(a.provider().isLoggedIn, false);
      assert.equal(a.captureAuth().accessToken, null);
      assert.equal(locks.pending, 2);

      await unlock();
      await login;
      await tick();
      assert.equal(b.captureAuth().accessToken, "fixture-B");
      assert.equal(b.provider().user.userId, "22");
      assert.equal(a.captureAuth().accessToken, null);
      assert.equal(a.requests.find((request) => request.url.endsWith("/logout")).headers.get("Authorization"),
        "Bearer fixture-refresh");
    });

    test("queued terminal 401 and old refresh results do not mutate the other tab's new login", async () => {
      for (const oldResult of ["401-on-retry", "refresh-success", "refresh-failure"]) {
        let completeOld;
        const delayed = () => new Promise((resolve) => { completeOld = resolve; });
        const rejectAccess = () => new Response(null, { status: 401 });
        const { locks, a, b } = twoTabs((request) => {
          if (request.url.endsWith("/api/users/me")) return Response.json(profile);
          if (request.url.endsWith("/reissue")) {
            return oldResult === "401-on-retry" ? Response.json({ accessToken: "fixture-A-rotated" }) : delayed();
          }
          if (request.headers.get("Authorization") === "Bearer fixture-A-rotated") return delayed();
          return rejectAccess();
        });
        await verifyTabA(a);
        const oldRequest = oldResult === "401-on-retry"
          ? a.apiClient.get("/protected-fixture") : a.apiClient.post("/protected-fixture", {});
        const expectedError = assert.rejects(oldRequest, (error) => error.status === 401);
        await tick();
        assert(completeOld, "HTTP reissue/retry must progress without holding the storage lock");

        b.provider();
        await tick();
        const unlock = holdStorageLock(locks);
        const login = submit(fill(b, "fixture-B", "SyntheticSecret"));
        await tick();
        completeOld(oldResult === "refresh-success" ? Response.json({ accessToken: "old-refresh-result" }) : rejectAccess());
        await tick();
        assert.equal(locks.pending, 2);

        await unlock();
        await login;
        await expectedError;
        assert.equal(b.captureAuth().accessToken, "fixture-B");
        assert.equal(b.provider().user.userId, "22");
        assert.equal(a.requests.filter((request) => request.url.endsWith("/reissue")).length, 1);
        assert.equal(a.requests.filter((request) => request.url.endsWith("/protected-fixture")).length,
          oldResult === "401-on-retry" ? 2 : 1);
      }
    });

    test("lock acquisition refusal blocks restore, explicit login, and later protected sends", async () => {
      let attempts = 0;
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        locks: { request() { attempts++; return Promise.reject(new DOMException("fixture rejected", "SecurityError")); } },
        respond: () => Response.json(profile) });
      h.provider();
      await tick();
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.provider().isRestoring, false);
      await submit(fill(h, "Fixture", "SyntheticSecret"));
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.equal(attempts, 1);
      assert.equal(h.requests.length, 0);
      assert.equal(h.captureAuth().accessToken, null);
      assert(h.storage.has("piston-api-session"));
      assert.deepEqual(h.writes, []);
    });

    test("a lock rejected after an earlier successful grant disables further authenticated requests", async () => {
      const available = createAuthLocks();
      let deny = false;
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        locks: { request(...args) {
          return deny ? Promise.reject(new DOMException("fixture rejected", "SecurityError")) : available.request(...args);
        } },
        respond: (request) => request.url.endsWith("/protected-fixture")
          ? new Response(null, { status: 401 })
          : request.url.endsWith("/reissue")
            ? Response.json({ accessToken: "unused-fixture-token" }) : Response.json(profile) });
      h.provider();
      await tick();
      assert.equal(h.provider().isLoggedIn, true);
      deny = true;
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.captureAuth().accessToken, null);
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.equal(h.requests.filter((request) => request.url.endsWith("/protected-fixture")).length, 1);
      assert.equal(JSON.parse(h.storage.get("piston-api-session")).accessToken, tokens.accessToken);
    });

    test("first 401 followed by a transient storage read error never reuses the rejected token", async () => {
      let h;
      h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) => {
        if (request.url.endsWith("/api/users/me")) return Response.json(profile);
        assert(request.url.endsWith("/protected-fixture"));
        const storage = h.window.localStorage, read = storage.getItem;
        storage.getItem = (key) => {
          if (key === "piston-api-session") {
            storage.getItem = read;
            throw new Error("fixture transient read failure");
          }
          return read(key);
        };
        return new Response(null, { status: 401 });
      } });
      h.provider();
      await tick();
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.captureAuth().accessToken, null);
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.deepEqual(h.requests.map((request) => new URL(request.url).pathname), ["/api/users/me", "/protected-fixture"]);
      assert(h.storage.has("piston-api-session"));
      assert.deepEqual(h.writes, []);
    });

    function publishStorageChange(tab) {
      const event = new Event("storage");
      Object.defineProperty(event, "key", { value: "piston-api-session" });
      tab.window.dispatchEvent(event);
    }

    test("an expiry notification delayed past another tab's login preserves the new profile and route", async () => {
      const base = createAuthLocks();
      let delay = false, resumeNotification, cleanupFinished;
      const cleanup = new Promise((resolve) => { cleanupFinished = resolve; });
      const locks = { request(...args) {
        const pending = base.request(...args);
        if (!delay) return pending;
        delay = false;
        return pending.then((value) => new Promise((resolve) => {
          resumeNotification = () => resolve(value);
          cleanupFinished();
        }));
      } };
      const a = harness(null, { locks, apiSession: { ...tokens, id: "initial-A" }, respond: (request) => {
        if (!request.url.endsWith("/api/users/me")) return new Response(null, { status: 401 });
        return Response.json({ ...profile, userId: request.headers.get("Authorization") === "Bearer fixture-B" ? 22 : 31 });
      } });
      const b = harness(null, { locks, sharedStorage: a.storage, respond: (request) => request.url.endsWith("/login")
        ? Response.json({ accessToken: "fixture-B", refreshToken: "fixture-B-refresh" })
        : Response.json({ ...profile, userId: 22 }) });
      await verifyTabA(a);
      a.window.location.pathname = "/mypage";
      delay = true;
      const ended = assert.rejects(a.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      await cleanup;
      await submit(fill(b, "fixture-B", "SyntheticSecret"));
      publishStorageChange(a);
      a.provider();
      await tick();
      assert.equal(a.provider().user.userId, "22");

      resumeNotification();
      await ended;
      assert.equal(a.captureAuth().accessToken, "fixture-B");
      assert.equal(a.provider().user.userId, "22");
      assert.deepEqual(a.routes, []);
    });

    test("expiry rechecks the stored owner after notification listeners run", async () => {
      const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) =>
        request.url.endsWith("/api/users/me") ? Response.json({ ...profile,
          userId: request.headers.get("Authorization") === "Bearer fixture-B" ? 22 : 31 })
          : new Response(null, { status: 401 }) });
      h.window.location.pathname = "/mypage";
      h.window.addEventListener("piston-auth-expired", () => {
        h.storage.set("piston-api-session", JSON.stringify({ id: "new-session", accessToken: "fixture-B", refreshToken: "fixture-B-refresh" }));
      }, { once: true });
      h.provider();
      await tick();
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.deepEqual(h.routes, []);
      publishStorageChange(h);
      h.provider();
      await tick();
      assert.equal(h.captureAuth().accessToken, "fixture-B");
      assert.equal(h.provider().user.userId, "22");
    });

    test("normal expiry clears the current session and still redirects", async () => {
      const h = harness(null, { apiSession: { ...tokens, id: "existing" }, respond: (request) =>
        request.url.endsWith("/api/users/me") ? Response.json(profile) : new Response(null, { status: 401 }) });
      h.window.location.pathname = "/mypage";
      h.provider();
      await tick();
      assert.equal(h.provider().isLoggedIn, true);
      await assert.rejects(h.apiClient.get("/protected-fixture"), (error) => error.status === 401);
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.captureAuth().accessToken, null);
      assert.deepEqual(h.routes, ["https://frontend.invalid/login"]);
    });

    test("API logout posts the refresh token once, clears despite failure and cannot restore", async () => {
      const h = harness(null, { apiSession: { ...tokens, id: "existing" },
        respond: (request) => request.url.endsWith("/logout")
          ? Response.json({}, { status: 500 }) : Response.json(profile) });
      h.provider();
      await tick();
      assert.equal(h.provider().isLoggedIn, true);
      const logout = h.provider().logout;
      logout(); logout();
      await tick();
      assert.deepEqual(h.requests.map(({ url }) => new URL(url).pathname), ["/api/users/me", "/logout"]);
      assert.equal(h.requests[1].method, "POST");
      assert.equal(h.requests[1].headers.get("Authorization"), "Bearer fixture-refresh");
      assert.equal(h.requests[1].body, undefined);
      assert.equal(h.storage.has("piston-api-session"), false);
      h.remountProvider();
      await tick();
      assert.equal(h.provider().isLoggedIn, false);
      assert.equal(h.requests.length, 2);
    });
  }
}
