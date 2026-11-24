import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import test from "node:test";
import ts from "typescript";
import { createAuthLocks } from "./test-auth-locks.mjs";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sessionKey = "piston-api-session";
const session = { id: "session-a", accessToken: "fake-access", refreshToken: "fake-refresh" };
const sessionB = { id: "session-b", accessToken: "fake-b-access", refreshToken: "fake-b-refresh" };
const printer = {
  printerId: "9007199254740993", userId: "7", name: "Fixture printer",
  type: "octoprint", url: "http://192.0.2.24:8080", serialNumber: null, hasApiKey: true,
  hasAccessCode: false, status: "online", createdAt: "2026-01-01T00:00:00Z", updatedAt: "2026-01-01T00:00:00Z",
};
const tick = () => new Promise((done) => setImmediate(done));
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};

function harness(respond) {
  const requests = [], events = new EventTarget();
  const storage = new Map([[sessionKey, JSON.stringify(session)]]);
  const tab = new Map();
  const storageApi = (values) => ({
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  });
  const modules = new Map();
  let slots = [], index = 0;
  let pageAuth, sessionPageKey;
  const jsx = (type, props, key) => ({ type, props, key });
  const unmount = () => {
    for (const slot of slots) slot?.cleanup?.();
    slots = [];
  };
  const same = (left, right) => left && left.length === right.length && left.every((item, i) => item === right[i]);
  const react = {
    createContext: (value) => ({ value }),
    useContext: (context) => context.value,
    useCallback: (callback) => callback,
    useRef(initial) {
      const i = index++;
      return slots[i] ?? (slots[i] = { current: initial });
    },
    useState(initial) {
      const state = slots, i = index++;
      if (!(i in state)) state[i] = typeof initial === "function" ? initial() : initial;
      return [state[i], (next) => { state[i] = typeof next === "function" ? next(state[i]) : next; }];
    },
    useEffect(effect, deps) {
      const i = index++;
      if (same(slots[i]?.deps, deps)) return;
      slots[i]?.cleanup?.();
      slots[i] = { deps, cleanup: effect() };
    },
  };
  const ctx = createContext({
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: "https://printer-fixture.invalid" } },
    URL, Event, Headers, FormData, Blob, AbortSignal, AbortController, URLSearchParams, ArrayBuffer,
    window: {
      navigator: { locks: createAuthLocks() },
      localStorage: storageApi(storage),
      sessionStorage: storageApi(tab),
      dispatchEvent: events.dispatchEvent.bind(events),
      location: { origin: "https://fixture.invalid", pathname: "/login", assign: () => assert.fail("Unexpected navigation") },
    },
    fetch: async (url, options) => {
      const target = new URL(url);
      assert.equal(target.origin, "https://printer-fixture.invalid");
      assert.match(target.pathname, /^\/(?:printer(?:\/[1-9][0-9]*)?|reissue)$/);
      const request = { ...options, path: target.pathname };
      requests.push(request);
      return respond(request);
    },
  });
  function load(file) {
    const path = resolve(root, file);
    if (modules.has(path)) return modules.get(path).exports;
    const entry = { exports: {} };
    modules.set(path, entry);
    const require = (name) => {
      if (name === "react") return react;
      if (name === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: Symbol.for("react.fragment") };
      if (name === "@/entities/session") return { useAuth: () => pageAuth };
      if (name === "@/shared/ui") return load("src/shared/ui/use-native-dialog.ts");
      const base = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(path), name);
      const next = [base + ".ts", base + ".tsx", resolve(base, "index.ts")].find(existsSync);
      assert(next, name);
      return load(next);
    };
    const code = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, target: ts.ScriptTarget.ES2022 },
      fileName: path,
    }).outputText;
    new Script("(function(require,module,exports) {" + code + "\n})", { filename: path })
      .runInContext(ctx)(require, entry, entry.exports);
    return entry.exports;
  }
  const query = load("src/entities/printer/api/registered-printer.ts");
  const mutations = load("src/features/printer-management/api/printer-mutations.ts");
  const draft = load("src/features/printer-management/model/registered-printer-draft.ts");
  const auth = load("src/shared/api/auth.ts");
  const { useApiPrinterManagement: renderManagementHook } = load("src/features/printer-management/model/use-api-printer-management.ts");
  return {
    query, mutations, draft, auth, storage, requests,
    render(userId = "7", sessionId = session.id) {
      index = 0;
      return renderManagementHook(userId, sessionId);
    },
    renderPage(authState) {
      pageAuth = authState;
      const { ApiPrinterManagementPage } = load("src/page-slices/mypage/ui/printer-management-page.tsx");
      const element = ApiPrinterManagementPage();
      if (sessionPageKey !== element.key) {
        unmount();
        sessionPageKey = element.key;
      }
      index = 0;
      return typeof element.type === "function" ? element.type(element.props) : element;
    },
    unmount,
  };
}

function findElement(element, predicate) {
  if (Array.isArray(element)) {
    for (const child of element) {
      const found = findElement(child, predicate);
      if (found) return found;
    }
  } else if (element?.props) {
    if (predicate(element)) return element;
    return findElement(element.props.children, predicate);
  }
}

const pageSession = (id = session.id, userId = "7") => ({
  isRestoring: false, isLoggedIn: true, apiSessionId: id, user: { userId },
});

const signal = new AbortController().signal;
const registration = { name: "Fixture printer", type: "octoprint", url: printer.url, apiKey: "fake-private-key" };
const asJson = (value) => JSON.parse(JSON.stringify(value));
const trace = (h) => h.requests.map(({ method, path }) => method + " " + path);

test("printer CRUD uses the documented methods and validates the 200 empty delete even with a JSON header", async () => {
  const h = harness(({ method, path }) => {
    if (method === "DELETE") return new Response(null, { headers: { "content-type": "application/json" } });
    const echoed = { ...printer, apiKey: "fake-echoed-key", accessCode: "fake-echoed-code" };
    if (method === "GET" && path === "/printer") return Response.json([echoed]);
    return Response.json(echoed, { status: method === "POST" ? 201 : 200 });
  });
  const auth = h.auth.captureAuth();
  const added = await h.mutations.registerPrinter(registration, "7", auth, signal);
  const list = await h.query.listPrinters("7", auth, signal);
  const detail = await h.query.getPrinter(added.id, "7", auth, signal);
  const edited = await h.mutations.updatePrinter(added.id, { apiKey: null }, "7", auth, signal);
  await h.mutations.unregisterPrinter(added.id, auth, signal);

  assert.deepEqual(trace(h), [
    "POST /printer", "GET /printer", "GET /printer/" + printer.printerId,
    "PATCH /printer/" + printer.printerId, "DELETE /printer/" + printer.printerId,
  ]);
  assert.equal(added.id, printer.printerId);
  assert.equal(added.model, "octoprint");
  assert.equal(added.ipAddress, printer.url);
  assert.equal(added.connectionStatus, "connected");
  assert.equal(added.hasApiKey, true);
  assert.deepEqual(asJson(list), [asJson(added)]);
  assert.deepEqual(asJson(detail), asJson(edited));
  assert.doesNotMatch(JSON.stringify([added, list, detail, edited]), /fake-echoed|"(apiKey|accessCode)"/);
  assert.deepEqual(JSON.parse(h.requests[0].body), registration);
  assert.deepEqual(JSON.parse(h.requests[3].body), { apiKey: null });
  assert(h.requests.every((entry) => entry.redirect === "error" &&
    entry.headers.get("Authorization") === "Bearer fake-access" && entry.signal === signal));
});

test("empty lists are accepted and wrong statuses, owners, IDs, URLs and response bodies are rejected", async () => {
  const variants = [
    () => Response.json([]),
    () => Response.json([printer], { status: 201 }),
    () => Response.json([{ ...printer, userId: "8" }]),
    () => Response.json([{ ...printer, status: "unknown" }]),
    () => Response.json([{ ...printer, url: "http://name:private@192.0.2.24" }]),
    () => Response.json({ ...printer, printerId: "2" }),
    () => Response.json({ ...printer, hasApiKey: "true" }, { status: 201 }),
    () => Response.json({ deleted: true }),
    () => new Response(null, { status: 204 }),
  ];
  const h = harness(() => variants.shift()());
  const auth = h.auth.captureAuth();
  assert.equal((await h.query.listPrinters("7", auth, signal)).length, 0);
  for (let i = 0; i < 4; i++) await assert.rejects(h.query.listPrinters("7", auth, signal), { kind: "response" });
  await assert.rejects(h.query.getPrinter(printer.printerId, "7", auth, signal), { kind: "response" });
  await assert.rejects(h.mutations.registerPrinter(registration, "7", auth, signal), { kind: "response" });
  await assert.rejects(h.mutations.unregisterPrinter(printer.printerId, auth, signal), { kind: "response" });
  await assert.rejects(h.mutations.unregisterPrinter(printer.printerId, auth, signal), { kind: "response" });
  assert.throws(() => h.query.getPrinter("../prints", "7", auth, signal), /Invalid printer ID/);
  assert.equal(variants.length, 0);
});

test("all type-specific fields are allowlisted, and PATCH distinguishes blank, explicit deletion and replacement", () => {
  const h = harness(() => assert.fail("No transport"));
  const d = h.draft;
  const saved = h.query.decodeRegisteredPrinter({ ...printer, hasAccessCode: true, apiKey: "ignored" });
  const initial = d.createPrinterDraft(saved);
  assert.equal(initial.apiKey, "");
  assert.equal(initial.accessCode, "");
  const all = { ...initial, type: "moonraker", apiKey: "fake-input", serialNumber: "serial-fixture", accessCode: "fake-code" };
  const expected = {
    moonraker: {},
    octoprint: { apiKey: all.apiKey },
    prusalink: { apiKey: all.apiKey },
    bambu: { serialNumber: all.serialNumber, accessCode: all.accessCode },
  };
  for (const [type, fields] of Object.entries(expected)) {
    assert.deepEqual(asJson(d.createPrinterPayload({ ...all, type })), { name: all.name, url: all.url, type, ...fields });
  }
  assert.deepEqual(asJson(d.updatePrinterPayload({ ...initial, apiKey: " " }, saved)), {});
  assert.deepEqual(asJson(d.updatePrinterPayload({ ...initial, removeApiKey: true, removeAccessCode: true }, saved)),
    { apiKey: null, accessCode: null });
  assert.deepEqual(asJson(d.updatePrinterPayload({ ...initial, apiKey: "new-fake-key" }, saved)), { apiKey: "new-fake-key" });
  assert(d.validatePrinterDraft({ ...initial, name: "x".repeat(100), url: "http://p.invalid/" + "x".repeat(483) }));
  for (const invalid of [
    { name: "x".repeat(101) }, { name: " " }, { url: "http://p.invalid/" + "x".repeat(484) },
    { url: "192.0.2.24" }, { url: "ftp://printer.invalid" }, { url: "http://user:key@printer.invalid" }, { type: "qidi" },
  ]) assert(!d.validatePrinterDraft({ ...initial, ...invalid }));
});

test("403, 404 and network failures are sanitized without leaking server echoes or sending without session", async () => {
  const variants = [
    () => Response.json({ message: "fake-private-key" }, { status: 403 }),
    () => Response.json({ accessCode: "fake-private-code" }, { status: 404 }),
    () => { throw new TypeError("fixture low-level secret"); },
  ];
  const h = harness(() => variants.shift()());
  const auth = h.auth.captureAuth();
  const safe = (status, kind) => (error) => error.status === status && error.kind === kind &&
    error.data === null && !error.message.includes("fake") && !error.cause;
  await assert.rejects(h.mutations.registerPrinter(registration, "7", auth, signal), safe(403, "http"));
  await assert.rejects(h.query.getPrinter(printer.printerId, "7", auth, signal), safe(404, "http"));
  await assert.rejects(h.query.listPrinters("7", auth, signal), safe(0, "network"));
  h.storage.delete(sessionKey);
  await assert.rejects(h.query.listPrinters("7", h.auth.captureAuth(), signal), { status: 401 });
  assert.equal(h.requests.length, 3);
});

for (const method of ["GET", "POST", "PATCH", "DELETE"]) {
  test(method + " 401 refreshes under the existing policy without replaying writes", async () => {
    let first = true;
    const h = harness((request) => {
      if (request.path === "/reissue") {
        assert.equal(request.headers.get("Authorization"), "Bearer fake-refresh");
        return Response.json({ accessToken: "fake-renewed-access" });
      }
      if (first) {
        first = false;
        return new Response(null, { status: 401 });
      }
      assert.equal(method, "GET");
      assert.equal(request.headers.get("Authorization"), "Bearer fake-renewed-access");
      return Response.json([printer]);
    });
    const auth = h.auth.captureAuth();
    if (method === "GET") assert.equal((await h.query.listPrinters("7", auth, signal)).length, 1);
    if (method === "POST") await assert.rejects(h.mutations.registerPrinter(registration, "7", auth, signal), { status: 401 });
    if (method === "PATCH") await assert.rejects(h.mutations.updatePrinter(printer.printerId, { name: "Updated" }, "7", auth, signal), { status: 401 });
    if (method === "DELETE") await assert.rejects(h.mutations.unregisterPrinter(printer.printerId, auth, signal), { status: 401 });
    assert.deepEqual(h.requests.map(({ method, path }) => path === "/reissue" ? "refresh" : method),
      method === "GET" ? ["GET", "refresh", "GET"] : [method, "refresh"]);
  });
}

test("account rotation isolates late lists and stale form events, and the new session gets a fresh list", async () => {
  const waiting = deferred();
  let count = 0;
  const h = harness(({ headers }) => {
    if (++count === 1) return waiting.promise;
    assert.equal(headers.get("Authorization"), "Bearer fake-b-access");
    return Response.json([{ ...printer, userId: "8", name: "New session printer", status: "offline" }]);
  });
  const old = h.render();
  await tick();
  h.storage.set(sessionKey, JSON.stringify(sessionB));
  h.unmount();
  const pending = h.render("8", sessionB.id);
  assert.equal(pending.printers.length, 0);
  await tick();
  assert.equal(h.render("8", sessionB.id).printers[0].name, "New session printer");
  waiting.resolve(Response.json([printer]));
  await tick();
  assert(h.requests[0].signal.aborted);
  assert.equal(h.render("8", sessionB.id).printers[0].userId, "8");
  await old.openEditForm(h.query.decodeRegisteredPrinter(printer));
  assert.equal(h.requests.length, 2);

  const editing = harness(() => Response.json([printer]));
  editing.render();
  await tick();
  const oldPrinter = editing.render().printers[0];
  editing.render().openDeleteForm(oldPrinter);
  const oldConfirmation = editing.render();
  editing.storage.set(sessionKey, JSON.stringify(sessionB));
  oldConfirmation.deletePrinter(oldPrinter.id);
  await oldConfirmation.openEditForm(oldPrinter);
  assert.deepEqual(editing.requests.map(({ method }) => method), ["GET"]);
});

test("authentication storage failure blocks HTTP and shows an alert and retry before a confirmed empty list", async () => {
  const h = harness(() => Response.json([]));
  const readStorage = h.storage.get.bind(h.storage);
  h.storage.get = (key) => {
    if (key === sessionKey) throw new Error("Storage unavailable");
    return readStorage(key);
  };
  h.renderPage(pageSession());
  await tick();
  const failed = h.renderPage(pageSession());
  assert.equal(h.requests.length, 0);
  assert.match(findElement(failed, ({ props }) => props.role === "alert")?.props.children ?? "", /로그인 상태를 확인할 수 없어요/);
  assert.equal(findElement(failed, ({ props }) => props.children === "등록된 프린터가 없어요"), undefined);
  const retry = findElement(failed, ({ type, props }) => type === "button" && props.children === "다시 시도");
  assert(retry);
  h.storage.get = readStorage;
  retry.props.onClick();
  const loading = h.renderPage(pageSession());
  assert(findElement(loading, ({ props }) => props.children === "프린터를 불러오는 중이에요."));
  assert.equal(findElement(loading, ({ props }) => props.children === "등록된 프린터가 없어요"), undefined);
  await tick();
  const ready = h.renderPage(pageSession());
  assert.deepEqual(trace(h), ["GET /printer"]);
  assert(findElement(ready, ({ props }) => props.children === "등록된 프린터가 없어요"));
  assert.equal(findElement(ready, ({ props }) => props.role === "alert"), undefined);
});

test("an in-flight list is withheld when authentication storage becomes unreadable", async () => {
  const waiting = deferred();
  const h = harness(() => waiting.promise);
  h.renderPage(pageSession());
  await tick();
  assert.deepEqual(trace(h), ["GET /printer"]);
  const readStorage = h.storage.get.bind(h.storage);
  h.storage.get = (key) => {
    if (key === sessionKey) throw new Error("Storage unavailable");
    return readStorage(key);
  };
  waiting.resolve(Response.json([printer]));
  await tick();
  const failed = h.renderPage(pageSession());
  assert.match(findElement(failed, ({ props }) => props.role === "alert")?.props.children ?? "", /로그인 상태를 확인할 수 없어요/);
  assert.equal(findElement(failed, ({ props }) => props.printer), undefined);
  assert.equal(findElement(failed, ({ props }) => props.children === "등록된 프린터가 없어요"), undefined);
});

test("printer management waits for auth restoration without asking for login or sending requests", async () => {
  const h = harness(() => Response.json([printer]));
  const signedOut = { isRestoring: false, isLoggedIn: false, apiSessionId: null, user: null };
  const restoring = h.renderPage({ ...signedOut, isRestoring: true });
  assert.equal(restoring.props.role, "status");
  assert.match(restoring.props.children, /로그인 상태를 확인하는 중/);
  const restoredSignedOut = h.renderPage(signedOut);
  assert.match(restoredSignedOut.props.children, /로그인해 주세요/);
  await tick();
  assert.equal(h.requests.length, 0);

  h.renderPage({ ...pageSession(), isRestoring: true });
  await tick();
  assert.equal(h.requests.length, 0);
  h.renderPage(pageSession());
  await tick();
  assert.equal(h.renderPage(pageSession()).type, "main");
  assert.deepEqual(trace(h), ["GET /printer"]);
});

for (const nextUserId of ["8", "7"]) {
  test("late list errors do not reach a new session for user " + nextUserId, async () => {
    const waiting = deferred();
    const h = harness(({ headers }) => {
      if (headers.get("Authorization") === "Bearer fake-access") return waiting.promise;
      return Response.json([{ ...printer, userId: nextUserId }]);
    });
    h.renderPage(pageSession());
    await tick();
    h.storage.set(sessionKey, JSON.stringify(sessionB));
    const nextSession = pageSession(sessionB.id, nextUserId);
    h.renderPage(nextSession);
    await tick();
    waiting.resolve(Response.json({}, { status: 403 }));
    await tick();
    assert.equal(h.requests.length, 2);
    assert(h.requests[0].signal.aborted);
    const page = h.renderPage(nextSession);
    assert.equal(findElement(page, ({ props }) => props.role === "alert"), undefined);
    assert(findElement(page, ({ props }) => props.printer?.userId === nextUserId));
  });
}

test("management updates only on confirmed create, detail, edit and delete and rejects duplicate actions", async () => {
  const responses = [
    () => Response.json([]),
    () => Response.json({ message: "fake-private-key" }, { status: 403 }),
    () => Response.json(printer, { status: 201 }),
    () => Response.json(printer),
    () => Response.json({ ...printer, name: "Renamed" }),
    () => new Response(null, { status: 404 }),
    () => new Response(null),
  ];
  const h = harness(() => responses.shift()());
  h.render();
  await tick();
  h.render().openAddForm();
  const draft = { ...h.draft.createPrinterDraft(null), name: registration.name, type: registration.type, url: registration.url };
  const form = h.render();
  form.savePrinter(draft);
  form.savePrinter(draft);
  await tick();
  assert.match(h.render().actionError, /권한/);
  assert.equal(h.render().printers.length, 0);
  assert(h.render().form);
  h.render().savePrinter(draft);
  await tick();
  assert.equal(h.render().printers[0].id, printer.printerId);
  assert.equal(h.render().form, null);
  await h.render().openEditForm(h.render().printers[0]);
  h.render().savePrinter({ ...draft, name: "Renamed" });
  await tick();
  assert.equal(h.render().printers[0].name, "Renamed");
  h.render().openDeleteForm(h.render().printers[0]);
  const deleting = h.render();
  deleting.deletePrinter(printer.printerId);
  deleting.deletePrinter(printer.printerId);
  await tick();
  assert.match(h.render().actionError, /찾을 수 없어요/);
  assert.equal(h.render().printers.length, 1);
  h.render().deletePrinter(printer.printerId);
  await tick();
  assert.equal(h.render().printers.length, 0);
  assert.equal(h.render().deletingPrinter, null);
  assert.deepEqual(h.requests.map(({ method }) => method), ["GET", "POST", "POST", "GET", "PATCH", "DELETE", "DELETE"]);
  assert.equal(responses.length, 0);
});

test("API form masks credentials and keeps the existing layout; mode entry points keep Mock and physical output separate", () => {
  const read = (path) => readFileSync(resolve(root, path), "utf8");
  const baseForm = read("src/features/printer-management/ui/printer-form-modal.tsx");
  const apiForm = read("src/features/printer-management/ui/api-printer-form-modal.tsx");
  const page = read("src/page-slices/mypage/ui/mypage-page.tsx");
  const management = read("src/page-slices/mypage/ui/printer-management-page.tsx");
  assert.match(apiForm, /type="password"/);
  assert.match(apiForm, /기존 \{label\} 삭제/);
  assert.doesNotMatch(apiForm, /연결 테스트|console\./);
  for (const token of ["mt-6 flex flex-col gap-5", "h-[50px] w-full min-w-0", "h-[58px] rounded-lg bg-[#5a7bff]"]) {
    assert(baseForm.includes(token) && apiForm.includes(token));
  }
  assert.match(page, /isMockModeEnabled\(\) \? \([\s\S]+?<PrinterManagementPage[\s\S]+?<ApiPrinterManagementPage/);
  assert.match(management, /ApiPrinterManagementSession key=\{apiSessionId\}/);
  assert.doesNotMatch(read("src/features/printer-management/api/printer-mutations.ts"), /\/api\/prints|\/chats|\/meshy/);
});
