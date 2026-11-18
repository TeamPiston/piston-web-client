import assert from "node:assert/strict";
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
  function harness(existingUser = null, { storedSession } = {}) {
    const modules = new Map();
    const slots = new Map();
    const storage = new Map(existingUser ? [["piston-auth", JSON.stringify(existingUser)], ["piston-access-token", "synthetic-existing-token"]] : []);
    if (storedSession !== undefined) storage.set("piston-auth", storedSession);
    const writes = [], routes = [], logs = [];
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
      useEffect() {},
      createContext: (value) => ({ value, Provider: "SessionProvider" }),
      useContext: (context) => context.value,
    };
    const context = createContext({
      process: { env: { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: process.env.NEXT_PUBLIC_USE_MOCK } },
      console: Object.fromEntries(["log", "warn", "error", "debug", "info"].map((key) => [key, (...args) => logs.push(args)])),
      window: { localStorage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => { writes.push(key); storage.set(key, value); },
        removeItem: (key) => { writes.push(key); storage.delete(key); },
      } },
      fetch: () => { httpCount += 1; throw new Error("Real HTTP is forbidden"); },
    });
    function load(path) {
      if (modules.has(path)) return modules.get(path).exports;
      const loaded = { exports: {} };
      modules.set(path, loaded);
      const require = (name) => {
        if (name === "react") return react;
        if (name === "react/jsx-runtime") return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
        if (name === "next/navigation") return { useRouter: () => ({ push: (url) => routes.push(url) }) };
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
      mock, storage, writes, routes, logs, provider,
      httpCount: () => httpCount,
      remountProvider() { slots.delete("provider"); return provider(); },
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
    assert(prevented); assert.equal(result, undefined, "Login remains synchronous without pending work");
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
    assert.deepEqual(h.writes, ["piston-auth", "piston-access-token"]);
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
    for (const existing of [null, { id: "existing-user", email: "existing@example.com", name: "Existing fixture" }]) {
      test("API rejects demo credentials and preserves stored data, existing=" + Boolean(existing), () => {
        const h = harness(existing), saved = JSON.stringify([...h.storage]);
        const form = fill(h, h.mock.MOCK_LOGIN_CREDENTIALS.id, h.mock.MOCK_LOGIN_CREDENTIALS.password);
        submit(form); submit(form);
        assert.match(h.form().error, /아직 지원하지 않습니다/);
        assert.equal(h.provider().isLoggedIn, false);
        assert.equal(h.provider().user, null);
        assert.equal(JSON.stringify([...h.storage]), saved);
        assert.deepEqual(h.writes, []); assert.deepEqual(h.routes, []); assertNoTransport(h);
      });
    }
    test("API form announces unsupported mode and remains usable after retries", () => {
      const h = harness(); submit(fill(h, "admin@example.com", h.mock.MOCK_LOGIN_CREDENTIALS.password));
      const tree = h.tree();
      const nodes = (value) => Array.isArray(value) ? value.flatMap(nodes) : value && typeof value === "object" ? [value, ...nodes(value.props?.children)] : [];
      const all = nodes(tree), alert = all.find((node) => node.props?.role === "alert");
      assert(alert); assert.match(alert.props.children, /아직 지원하지 않습니다/);
      const button = all.find((node) => node.props?.type === "submit");
      assert(button); assert(!button.props.disabled);
      submit(h.form()); assert.equal(h.provider().isLoggedIn, false); assertNoTransport(h);
    });
  }
}
