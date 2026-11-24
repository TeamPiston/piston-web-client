import assert from "node:assert/strict";
import { randomUUID, webcrypto } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const modelPath = "src/page-slices/create/model/create-api-generation-flow.ts";
const uiPath = "src/page-slices/create/ui/api-create-workspace.tsx";
const pagePath = "src/page-slices/create/ui/create-page.tsx";
const allowed = new Set([
  modelPath, uiPath, pagePath,
  "src/page-slices/create/model/create-api-request-storage.ts",
  "src/page-slices/create/model/create-api-session.ts",
  "src/page-slices/create/model/use-create-attachments.ts",
  "src/page-slices/create/model/use-create-chat-history.ts",
  "src/features/stl-viewer/model/use-stl-model.ts",
  "src/page-slices/create/ui/components/chat-panel.tsx",
  "src/page-slices/create/ui/components/chat-message-cards.tsx",
  "src/page-slices/create/ui/components/preview-panel.tsx",
  "src/page-slices/create/ui/components/version-history.tsx",
  "src/features/send-chat-message/api/send-chat-message.ts",
  "src/entities/chat/api/chat-history.ts",
  "src/shared/api/client.ts", "src/shared/api/auth.ts",
  "src/entities/chat/model/chat-input-error.ts",
  "src/features/generate-3d-model/api/generate-model.ts",
]);
const compiled = new Map();
const networkAttempts = [];
const sessionKey = "piston-api-session";
const sessionRecord = (id) => JSON.stringify({ id, accessToken: "fixture-token-" + id, refreshToken: "fixture-refresh-" + id });

test.afterEach(() => {
  assert.deepEqual(networkAttempts.splice(0), [], "No request can reach the real transport");
});
const tick = () => new Promise((done) => setImmediate(done));
const taskId = "fixture-task";
const url = "https://storage.invalid/fixture.stl";
const textAction = { kind: "text", prompt: "Synthetic model" };
const image = new File(["fixture"], "fixture.png", { type: "image/png" });

const scope = "fixture-account";
const storageKey = "piston:create-api:pending:v1:" + scope;
const chatStorageKey = storageKey + ":chat";
const meshyStorageKey = storageKey + ":meshy";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
    removeItem: (key) => values.delete(key),
  };
}

function harness({ mock = false, authenticated = false, storage = memoryStorage(),
  auth = { account: scope, reauthenticatedAccount: null }, localStorage = memoryStorage(),
  fetchResponse, getHistory } = {}) {
  const getVerifiedAccountScope = (purpose) =>
    purpose === "reauthentication" ? auth.reauthenticatedAccount : auth.account;
  const loaded = new Map();
  const timers = new Map();
  const slots = [];
  const effects = new Map();
  const pendingEffects = [];
  const phases = ["layout", "passive"];
  let time = 0;
  let nextTimer = 0;
  let cursor = 0;
  let mounted = true;
  let scopedKey;
  const jsxs = (type, props, key) => ({ type, props, key });
  function renderPanels(tree) {
    if (Array.isArray(tree)) return tree.map(renderPanels);
    if (!tree?.props) return tree;
    const { type, props } = tree;
    if (typeof type === "function" && ["ChatPanel", "PreviewPanel", "VersionHistory"].includes(type.name)) {
      return renderPanels(type(props));
    }
    return { ...tree, props: { ...props, children: renderPanels(props.children) } };
  }

  function registerEffect(phase, setup, dependencies) {
    const index = cursor++;
    const previous = effects.get(index);
    if (!previous || dependencies.length !== previous.dependencies.length ||
      dependencies.some((value, position) => !Object.is(value, previous.dependencies[position]))) {
      pendingEffects.push({ index, phase, setup, dependencies });
    }
  }

  function unmount() {
    for (const phase of phases) {
      for (const effect of effects.values()) {
        if (effect.phase === phase) effect.cleanup?.();
      }
    }
    slots.length = 0;
    effects.clear();
    mounted = false;
  }

  function renderScoped(entry, commit = true) {
    if (!mounted || scopedKey !== entry.key) {
      assert(commit, "Uncommitted renders in this harness must reuse the mounted scope");
      if (mounted) unmount();
      scopedKey = entry.key;
      mounted = true;
    }
    cursor = 0;
    const tree = entry.type(entry.props);
    if (commit) {
      for (const phase of phases) {
        for (const { index, phase: kind, setup, dependencies } of pendingEffects) {
          if (phase !== kind) continue;
          effects.get(index)?.cleanup?.();
          effects.set(index, { phase, dependencies, cleanup: setup() });
        }
      }
    }
    pendingEffects.length = 0;
    return renderPanels(tree);
  }
  const react = {
    Component: class {},
    useState(initial) {
      assert(mounted);
      const index = cursor++;
      if (!(index in slots)) slots[index] = typeof initial === "function" ? initial() : initial;
      return [slots[index], (next) => {
        assert(mounted, "state update after unmount");
        slots[index] = typeof next === "function" ? next(slots[index]) : next;
      }];
    },
    useRef(value) {
      const index = cursor++;
      if (!(index in slots)) slots[index] = { current: value };
      return slots[index];
    },
    useEffect: (setup, dependencies) => registerEffect("passive", setup, dependencies),
    useLayoutEffect: (setup, dependencies) => registerEffect("layout", setup, dependencies),
    useSyncExternalStore(_subscribe, getSnapshot) { return getSnapshot(); },
    useCallback(callback, deps) {
      if (!deps) return callback;
      const index = cursor++;
      const previous = slots[index];
      if (!previous || deps.some((value, i) => value !== previous.deps[i])) {
        slots[index] = { callback, deps };
      }
      return slots[index].callback;
    },
  };
  const fixtureLoader = Symbol("STL loader");
  const stubs = {
    "@react-three/fiber": { useLoader: { clear(loader, modelUrl) {
      assert.equal(loader, fixtureLoader);
      clearedModels.push(modelUrl);
    } } },
    "three/examples/jsm/loaders/STLLoader.js": { STLLoader: fixtureLoader },
    react,
    "react/jsx-runtime": { jsx: jsxs, jsxs, Fragment: "fragment" },
    "next/navigation": { useRouter: () => ({ push: () => assert.fail("Unexpected navigation") }) },
    "@/shared/ui": { PistonLogo: "PistonLogo" },
    "@/widgets/header": { Header: "Header", LoginRequiredModal: "LoginRequiredModal" },
    "@/entities/session": { useAuth: () => typeof authenticated === "object" ? authenticated : { isLoggedIn: authenticated } },
    "lucide-react": new Proxy({}, { get: (_, name) => String(name) }),
    "next/image": { default: "Image" },
    "@/features/stl-viewer": {
      ArtworkModelPreview: "ArtworkModelPreview",
      clearStlModel: (modelUrl) => load("src/features/stl-viewer/model/use-stl-model.ts").clearStlModel(modelUrl),
    },
    "@/shared/ui/demo-notice": { DemoNotice: "DemoNotice" },
    "@/shared/mock/mock-data": { isMockModeEnabled: () => mock },
    "./create-workspace": { default: "MockCreateWorkspace" },
  };
  const aliases = {
    "@/shared/api": "src/shared/api/client.ts",
    "@/shared/api/auth": "src/shared/api/auth.ts",
    "@/features/send-chat-message": "src/features/send-chat-message/api/send-chat-message.ts",
    "@/entities/chat": "src/entities/chat/model/chat-input-error.ts",
    "@/features/generate-3d-model": "src/features/generate-3d-model/api/generate-model.ts",
  };

  function load(path) {
    assert(allowed.has(path), "Unexpected module: " + path);
    if (loaded.has(path)) return loaded.get(path);
    if (!compiled.has(path)) {
      const result = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
        fileName: path,
        compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      }).outputText;
      compiled.set(path, new Script("(function(require, exports) {\n" + result + "\n})", { filename: path }));
    }
    const exports = {};
    loaded.set(path, exports);
    const entry = compiled.get(path).runInNewContext({
      AbortController, AbortSignal, Event, URL, URLSearchParams, Headers, File, FormData, TextEncoder, queueMicrotask,
      crypto: { randomUUID, subtle: webcrypto.subtle },
      window: {
        sessionStorage: storage, localStorage,
        navigator: { locks: { request: (_name, _options, run) => Promise.resolve().then(run) } },
      },
      performance: { now: () => time },
      process: { env: { NEXT_PUBLIC_API_BASE_URL: "https://blocked.invalid" } },
      fetch: (...args) => {
        if (fetchResponse) return fetchResponse(...args);
        networkAttempts.push(args[0]);
        assert.fail("Live network must never run");
      },
      setTimeout(callback, delay) {
        timers.set(++nextTimer, { callback, due: time + delay });
        return nextTimer;
      },
      clearTimeout(id) { timers.delete(id); },
    });
    entry((specifier) => {
      if (specifier === "@/entities/chat") return {
        ...load(aliases["@/entities/chat"]), ...load("src/entities/chat/api/chat-history.ts"),
      };
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
      if (Object.hasOwn(aliases, specifier)) return load(aliases[specifier]);
      assert(specifier.startsWith("."), "Unexpected import: " + specifier);
      const prefix = relative(root, resolve(root, dirname(path), specifier)).replaceAll("\\", "/");
      return load(allowed.has(prefix + ".tsx") ? prefix + ".tsx" : prefix + ".ts");
    }, exports);
    return exports;
  }

  const calls = [];
  const clearedModels = [];
  const transport = Object.fromEntries(["sendChatMessage", "generateTextTo3D", "generateImageTo3D", "getMeshyTaskStatus"]
    .map((method) => [method, (input, { signal }) => new Promise((resolve, reject) => {
      calls.push({ method, input, signal, resolve, reject });
    })]));
  return {
    calls, transport, storage, auth, clearedModels,
    bindApi: (id, account) => load("src/page-slices/create/model/create-api-session.ts").bindCreateApi(id, account),
    renderBoundWorkspace(bound, requestScope = scope, sessionId = "session-a") {
      return renderScoped(load(uiPath).ApiCreateWorkspace({ ...bound, requestScope, sessionId }));
    },
    flow(enabled = true, requestScope = scope, restore = true, authSessionId) {
      const flow = load(modelPath).createApiGenerationFlow(enabled ? transport : undefined, requestScope, authSessionId);
      flow.setAccountVerifier(getVerifiedAccountScope);
      if (restore) flow.restore();
      return flow;
    },
    chatInputError() {
      return new (load(aliases["@/entities/chat"]).ChatInputError)("message", "Synthetic invalid input");
    },
    timers: () => timers.size,
    advance(ms) {
      const end = time + ms;
      while (timers.size) {
        const next = [...timers].sort((a, b) => a[1].due - b[1].due)[0];
        if (next[1].due > end) break;
        timers.delete(next[0]);
        time = next[1].due;
        next[1].callback();
      }
      time = end;
    },
    preflightError() {
      return new (load(aliases["@/shared/api"]).ApiAuthPreflightError)("Synthetic auth rejection");
    },
    error(status, kind = "http") {
      return new (load(aliases["@/shared/api"]).ApiError)("Synthetic failure", status, null, kind);
    },
    conflict(id) {
      return new (load(aliases["@/features/generate-3d-model"]).MeshyTaskConflictError)(this.error(409), id);
    },
    renderWorkspace(injected = transport, requestScope = scope, verifier = getVerifiedAccountScope, commit = true) {
      return renderScoped(load(uiPath).ApiCreateWorkspace({
        transport: injected, requestScope, getVerifiedAccountScope: verifier, getHistory,
      }), commit);
    },
    renderPage() {
      cursor = 0;
      return load(pagePath).default();
    },
    unmount,
  };
}

function find(tree, predicate) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const match = find(child, predicate);
      if (match) return match;
    }
  } else if (tree && typeof tree === "object") {
    if (predicate(tree)) return tree;
    return find(tree.props?.children, predicate);
  }
}

const element = (tree, type) => find(tree, (item) => item.type === type)?.props;
const role = (tree, name) => find(tree, ({ props }) => props.role === name)?.props;
const button = (tree, name) => find(tree, ({ type, props }) => type === "button" && props.children === name)?.props;
const shape = (value) => JSON.parse(JSON.stringify(value));
const formEvent = () => ({ preventDefault() {} });

function chooseText(h) {
  element(h.renderWorkspace(), "select").onChange({ currentTarget: { value: "text" } });
  element(h.renderWorkspace(), "textarea").onChange({ currentTarget: { value: textAction.prompt } });
}

async function accept(h, flow, conflict = false) {
  assert.equal(flow.submit(textAction), true);
  if (conflict) h.calls[0].reject(h.conflict(taskId));
  else h.calls[0].resolve({ taskId });
  await tick();
}

test("signed-out API route opens the existing login gate without a composer or requests", () => {
  const h = harness();
  const ui = h.renderPage();
  assert.equal(element(ui, "LoginRequiredModal").isOpen, true);
  assert.equal(element(ui, "form"), undefined);
  assert.equal(element(ui, "button"), undefined);
  assert.equal(element(ui, "a"), undefined);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers(), 0);
});

test("Mock route keeps the existing workspace and unauthenticated login gate", () => {
  assert.equal(harness({ mock: true, authenticated: true }).renderPage().type, "MockCreateWorkspace");
  assert.equal(element(harness({ mock: true }).renderPage(), "LoginRequiredModal").isOpen, true);
});

test("verified API route selects the keyed workspace and restoring auth does not mount it", () => {
  const auth = { isLoggedIn: true, user: { userId: "7" }, apiSessionId: "session-a", isRestoring: true };
  const h = harness({ authenticated: auth });
  assert.match(role(h.renderPage(), "status").children, /로그인 상태를 확인/);
  auth.isRestoring = false;
  const tree = h.renderPage();
  assert.equal(tree.type.name, "AuthenticatedApiCreateWorkspace");
  assert.equal(tree.key, "session-a");
  assert.equal(tree.props.userId, "7");
  assert.equal(h.calls.length, 0);
});

function apiHarness(respond) {
  const localStorage = memoryStorage();
  localStorage.setItem(sessionKey, sessionRecord("session-a"));
  const requests = [];
  const h = harness({ localStorage, fetchResponse(address, options) {
    const url = new URL(address);
    assert.equal(url.origin, "https://blocked.invalid");
    assert.match(url.pathname, /^\/(?:chats\/messages|meshy\/(?:text-to-3d|image-to-3d|tasks\/[a-z-]+))$/);
    requests.push({ url, options });
    return respond(url, options);
  } });
  const bound = h.bindApi("session-a", scope);
  const render = () => h.renderBoundWorkspace(bound);
  return { h, bound, localStorage, requests, render };
}

test("authenticated chat history requests older cursor pages and user submission sends one billable multipart POST", async () => {
  const row = (chatId, message) => ({
    chatId, role: "USER", message, imageUrl: null, jobId: null, createdAt: "2026-01-01T10:00:00Z",
  });
  const { requests, render } = apiHarness((url, options) => {
    assert.equal(options.headers.get("Authorization"), "Bearer fixture-token-session-a");
    if (options.method === "POST") {
      assert(options.body instanceof FormData);
      assert.equal(options.headers.get("Content-Type"), null);
      assert.equal(options.body.get("message"), "Synthetic question");
      assert.equal(options.body.get("image"), image);
      return Response.json({ chatId: "4", jobId: null, reply: "Synthetic answer" }, { status: 201 });
    }
    assert.equal(url.searchParams.get("size"), "30");
    if (url.searchParams.has("cursor")) {
      assert.equal(url.searchParams.get("cursor"), "cursor/older+");
      return Response.json({ hasNext: false, nextCursor: null, chats: [row("1", "Older message")] });
    }
    return Response.json({ hasNext: true, nextCursor: "cursor/older+", chats: [row("2", "Latest message")] });
  });

  render();
  await tick();
  element(render(), "textarea").onChange({ currentTarget: { value: "Synthetic question" } });
  element(render(), "select").onChange({ currentTarget: { value: "chat" } });
  element(render(), "input").onChange({ target: { files: [image], value: "" } });
  const form = element(render(), "form");
  form.onSubmit(formEvent());
  form.onSubmit(formEvent());
  await tick();
  assert(find(render(), ({ props }) => props.children === "Synthetic answer"));
  find(render(), ({ props }) => props["aria-label"] === "대화 메뉴 열기").props.onClick();
  button(render(), "이전 채팅 기록 더 보기").onClick();
  await tick();
  const visible = JSON.stringify(render());
  assert(visible.indexOf("Older message") < visible.indexOf("Latest message"));
  assert.deepEqual(requests.map(({ options }) => options.method), ["GET", "POST", "GET", "GET"]);
});

test("bound image generation waits between GETs and enables STL only on server success", async () => {
  let statuses = 0;
  const { h, requests, render } = apiHarness((target, options) => {
    if (target.pathname === "/chats/messages") {
      return Response.json({ hasNext: false, nextCursor: null, chats: [] });
    }
    if (options.method === "POST") {
      assert.equal(target.pathname, "/meshy/image-to-3d");
      assert.equal(options.body.get("image"), image);
      assert.equal(options.headers.get("Content-Type"), null);
      return Response.json({ taskId }, { status: 202 });
    }
    assert.equal(target.pathname, "/meshy/tasks/" + taskId);
    return Response.json(++statuses === 1 ? { taskId, status: "PENDING" } : { taskId, status: "SUCCEEDED", modelUrl: url });
  });
  render();
  await tick();
  element(render(), "select").onChange({ currentTarget: { value: "image" } });
  element(render(), "input").onChange({ target: { files: [image], value: "" } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  h.advance(4999);
  assert.equal(requests.length, 2);
  h.advance(1);
  await tick();
  assert.equal(statuses, 1);
  assert.equal(element(render(), "ArtworkModelPreview"), undefined);
  h.advance(4999);
  assert.equal(statuses, 1);
  h.advance(1);
  await tick();
  assert.equal(element(render(), "ArtworkModelPreview").stlUrl, url);
  assert.equal(button(render(), "미리보기 전용").disabled, true);
  assert.equal(h.timers(), 0);
  assert.deepEqual(requests.map(({ options }) => options.method), ["GET", "POST", "GET", "GET"]);
});

test("the bound API cannot send with a replacement session or surface a late successful response", async () => {
  let started, respond;
  const hasStarted = new Promise((resolve) => { started = resolve; });
  const { bound, localStorage, requests } = apiHarness(() => new Promise((resolve) => {
    respond = resolve;
    started();
  }));
  assert.equal(bound.getVerifiedAccountScope("reauthentication", "session-a"), null);
  assert.equal(bound.getVerifiedAccountScope("reauthentication", "old-session"), scope);
  const pending = bound.transport.generateTextTo3D({ prompt: "Synthetic request" });
  await hasStarted;
  localStorage.setItem(sessionKey, sessionRecord("session-b"));
  respond(Response.json({ taskId }, { status: 202 }));
  await assert.rejects(pending, { status: 401 });
  const count = requests.length;
  assert.equal(count, 1);
  await assert.rejects(bound.transport.generateTextTo3D({ prompt: "Another request" }), { status: 401 });
  assert.equal(requests.length, count);
  assert(requests.every(({ options }) => options.headers.get("Authorization") === "Bearer fixture-token-session-a"));
});

test("a real 409 decoder resumes the existing task without another paid POST", async () => {
  const { h, requests, render } = apiHarness((target, options) => {
    if (target.pathname === "/chats/messages") return Response.json({ hasNext: false, nextCursor: null, chats: [] });
    if (options.method === "POST") return Response.json({ message: "Existing fixture task", taskId }, { status: 409 });
    assert.equal(target.pathname, "/meshy/tasks/" + taskId);
    return Response.json({ taskId, status: "FAILED", failureReason: "Synthetic failure" });
  });
  render();
  await tick();
  element(render(), "select").onChange({ currentTarget: { value: "text" } });
  element(render(), "textarea").onChange({ currentTarget: { value: textAction.prompt } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  h.advance(5000);
  await tick();
  assert.match(role(render(), "alert").children, /생성에 실패/);
  assert.equal(element(render(), "ArtworkModelPreview"), undefined);
  assert.equal(h.timers(), 0);
  assert.deepEqual(requests.map(({ url, options }) => [options.method, url.pathname]),
    [["GET", "/chats/messages"], ["POST", "/meshy/text-to-3d"], ["GET", "/meshy/tasks/" + taskId]]);
});

test("changing the bound session aborts history and keeps late old-account messages out of the UI", async () => {
  let resolveOld;
  const { h, localStorage, requests, render } = apiHarness((_, options) => {
    if (options.headers.get("Authorization") === "Bearer fixture-token-session-a") {
      return new Promise((resolve) => { resolveOld = resolve; });
    }
    return Response.json({ hasNext: false, nextCursor: null, chats: [] });
  });
  render();
  await tick();
  assert.equal(requests.length, 1);
  localStorage.setItem(sessionKey, sessionRecord("session-b"));
  const other = h.bindApi("session-b", "another-account");
  h.renderBoundWorkspace(other, "another-account", "session-b");
  await tick();
  assert.equal(requests[0].options.signal.aborted, true);
  resolveOld(Response.json({ hasNext: false, nextCursor: null, chats: [{
    chatId: "99", role: "USER", message: "Old account message", imageUrl: null, jobId: null, createdAt: "2026-01-01T10:00:00Z",
  }] }));
  await tick();
  assert.equal(JSON.stringify(h.renderBoundWorkspace(other, "another-account", "session-b")).includes("Old account message"), false);
  assert.equal(requests.length, 2);
});

test("a saved 401 records the rejected session and only a new authenticated session can resume it", async () => {
  const { h, bound, localStorage } = apiHarness(() => assert.fail("Injected flow should not use HTTP"));
  const first = h.flow(true, scope, true, "session-a");
  first.setAccountVerifier(bound.getVerifiedAccountScope);
  await accept(h, first);
  h.advance(5000);
  h.calls[1].reject(h.error(401));
  await tick();
  const saved = JSON.parse(h.storage.getItem(storageKey));
  assert.equal(saved.authSessionId, "session-a");
  assert.equal(first.recheck(), false);
  assert.equal(h.timers(), 0);

  localStorage.setItem(sessionKey, sessionRecord("session-b"));
  const next = h.flow(true, scope, true, "session-b");
  next.setAccountVerifier(h.bindApi("session-b", scope).getVerifiedAccountScope);
  assert.equal(next.recheck(), true);
  h.advance(5000);
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus", "getMeshyTaskStatus"]);
  h.calls[2].resolve({ taskId, status: "PENDING" });
  await tick();
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).authSessionId, undefined);
  next.stop();
});

test("a flow without a transport rejects direct submissions and schedules nothing", () => {
  const h = harness();
  const flow = h.flow(false);
  assert.equal(flow.submit(textAction), false);
  assert.equal(flow.getSnapshot().phase, "idle");
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers(), 0);
});

test("one explicit chat submission makes one call, keeps the input File, and never generates a model", async () => {
  const h = harness();
  const flow = h.flow();
  assert.equal(flow.submit({ kind: "chat", message: "Fixture message", image }), true);
  assert.deepEqual(shape(flow.getSnapshot()), { phase: "submitting", kind: "chat" });
  assert.deepEqual(h.calls.map(({ method }) => method), ["sendChatMessage"]);
  assert.equal(h.calls[0].input.image, image);
  h.calls[0].resolve({ chatId: "fixture-chat", jobId: null, reply: "Fixture reply" });
  await tick();
  assert.equal(flow.getSnapshot().result.reply, "Fixture reply");
  h.advance(10000);
  assert.equal(h.calls.length, 1);
});

test("a text action stores the accepted task ID and waits 5000 ms before its first GET", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  assert.equal(h.calls[0].method, "generateTextTo3D");
  assert.deepEqual(shape(h.calls[0].input), { prompt: textAction.prompt });
  assert.equal(flow.getSnapshot().phase, "pending");
  assert.equal(flow.getSnapshot().taskId, taskId);
  h.advance(4999);
  assert.equal(h.calls.length, 1);
  h.advance(1);
  assert.equal(h.calls[1].method, "getMeshyTaskStatus");
  assert.equal(h.calls[1].input, taskId);
  assert.equal(h.calls[0].signal, h.calls[1].signal);
});

test("an image action passes the original File and sends no other kind of POST", async () => {
  const h = harness();
  const flow = h.flow();
  assert.equal(flow.submit({ kind: "image", image }), true);
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateImageTo3D"]);
  assert.equal(h.calls[0].input.image, image);
  h.calls[0].resolve({ taskId });
  await tick();
  assert.equal(flow.getSnapshot().taskId, taskId);
});

test("a slow GET never overlaps and PENDING schedules the next GET after completion", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  h.advance(5000);
  h.advance(30000);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers(), 0);
  h.calls[1].resolve({ taskId, status: "PENDING" });
  await tick();
  h.advance(4999);
  assert.equal(h.calls.length, 2);
  h.advance(1);
  assert.equal(h.calls.length, 3);
  assert.equal(flow.getSnapshot().phase, "pending");
});

for (const [status, extra] of [
  ["SUCCEEDED", { modelUrl: url }],
  ["FAILED", { failureReason: "Fixture failure" }],
]) {
  test(status + " is terminal and leaves no polling timer", async () => {
    const h = harness();
    const flow = h.flow();
    await accept(h, flow);
    h.advance(5000);
    h.calls[1].resolve({ taskId, status, ...extra });
    await tick();
    assert.equal(flow.getSnapshot().phase, status.toLowerCase());
    if (status === "SUCCEEDED") assert.equal(flow.getSnapshot().result.modelUrl, url);
    else assert.equal(flow.getSnapshot().failureReason, extra.failureReason);
    h.advance(20000);
    assert.equal(h.timers(), 0);
    assert.equal(h.calls.length, 2);
  });
}

test("409 with an existing ID observes that ID and never repeats POST", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow, true);
  assert.equal(flow.getSnapshot().taskId, taskId);
  h.advance(5000);
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus"]);
  assert.equal(h.calls[1].input, taskId);
});

test("409 with null is uncertain and does not allow retry or polling", async () => {
  const h = harness();
  const flow = h.flow();
  flow.submit(textAction);
  h.calls[0].reject(h.conflict(null));
  await tick();
  h.advance(20000);
  assert.equal(flow.getSnapshot().phase, "uncertain");
  assert.equal(flow.submit(textAction), false);
  assert.equal(flow.recheck(), false);
  assert.equal(h.calls.length, 1);
});

test("the first recovered 404 offers one manual GET retry for the same ID", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow, true);
  h.advance(5000);
  h.calls[1].reject(h.error(404));
  await tick();
  assert.equal(flow.getSnapshot().reason, "registration-pending");
  h.advance(20000);
  assert.equal(h.calls.length, 2);
  assert.equal(flow.recheck(), true);
  assert.equal(flow.recheck(), false);
  h.advance(4999);
  assert.equal(h.calls.length, 2);
  h.advance(1);
  assert.equal(h.calls[2].input, taskId);
  h.calls[2].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  assert.equal(flow.getSnapshot().phase, "succeeded");
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus", "getMeshyTaskStatus"]);
});

test("a regular or repeated 404 is not treated as a queue registration race", async () => {
  for (const recovered of [false, true]) {
    const h = harness();
    const flow = h.flow();
    await accept(h, flow, recovered);
    h.advance(5000);
    h.calls[1].reject(h.error(404));
    await tick();
    if (recovered) {
      assert.equal(flow.recheck(), true);
      h.advance(5000);
      h.calls[2].reject(h.error(404));
      await tick();
    }
    assert.equal(flow.getSnapshot().reason, "not-found");
    assert.equal(flow.submit(textAction), false);
    const count = h.calls.length;
    h.advance(15000);
    assert.equal(h.calls.length, count);
    assert.equal(flow.recheck(), true);
    h.advance(5000);
    assert.equal(h.calls.at(-1).method, "getMeshyTaskStatus");
    assert.equal(h.calls.at(-1).input, taskId);
  }
});

test("GET network errors permit explicit same-ID recheck but do not restart POST", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  h.advance(5000);
  h.calls[1].reject(h.error(0, "network"));
  await tick();
  assert.equal(flow.getSnapshot().reason, "lookup-failed");
  h.advance(60000);
  assert.equal(h.calls.length, 2);
  assert.equal(flow.recheck(), true);
  h.advance(5000);
  assert.equal(h.calls[2].method, "getMeshyTaskStatus");
  assert.equal(h.calls[2].input, taskId);
});

test("post-transport failures keep the saved request uncertain", async () => {
  for (const [status, kind, phase] of [[0, "network", "uncertain"], [202, "response", "uncertain"],
    [408, "http", "uncertain"], [409, "http", "uncertain"], [500, "http", "uncertain"], [401, "http", "uncertain"]]) {
    const h = harness();
    const flow = h.flow();
    flow.submit(textAction);
    h.calls[0].reject(h.error(status, kind));
    await tick();
    assert.equal(flow.getSnapshot().phase, phase);
    assert.equal(JSON.parse(h.storage.getItem(storageKey)).status, "uncertain");
    assert.equal(flow.submit(textAction), false);
    h.advance(20000);
    assert.equal(h.calls.length, 1);
  }
});

test("the synchronous submit handler blocks double-clicks before a render", () => {
  const h = harness();
  chooseText(h);
  const form = element(h.renderWorkspace(), "form");
  form.onSubmit(formEvent());
  form.onSubmit(formEvent());
  assert.equal(h.calls.length, 1);
  assert.equal(element(h.renderWorkspace(), "fieldset").disabled, true);
});

test("Enter repeat is ignored and shifts or IME composition do not submit", () => {
  const h = harness();
  chooseText(h);
  const tree = h.renderWorkspace();
  const submit = element(tree, "form").onSubmit;
  const keydown = element(tree, "textarea").onKeyDown;
  const event = {
    key: "Enter", shiftKey: false, repeat: false, nativeEvent: { isComposing: false },
    currentTarget: { form: { requestSubmit: () => submit(formEvent()) } }, preventDefault() {},
  };
  keydown({ ...event, shiftKey: true });
  keydown({ ...event, nativeEvent: { isComposing: true } });
  keydown({ ...event, repeat: true });
  assert.equal(h.calls.length, 0);
  keydown(event);
  keydown({ ...event, repeat: true });
  assert.equal(h.calls.length, 1);
});

test("mixed text and image generation show an input error without discarding input or making requests", () => {
  const h = harness();
  chooseText(h);
  element(h.renderWorkspace(), "input").onChange({ target: { files: [image], value: "" } });
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  assert.match(role(h.renderWorkspace(), "alert").children, /설명만 입력/);
  assert(find(h.renderWorkspace(), ({ props }) => props["aria-label"] === "fixture.png 첨부 이미지 삭제"));
  assert.equal(element(h.renderWorkspace(), "textarea").value, textAction.prompt);
  element(h.renderWorkspace(), "select").onChange({ currentTarget: { value: "image" } });
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  assert.match(role(h.renderWorkspace(), "alert").children, /이미지 한 장만/);
  assert.equal(h.calls.length, 0);
});

test("stopping clears the timer and aborts an in-flight GET, ignoring its late reply", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  flow.stop();
  assert.equal(h.timers(), 0);
  assert.equal(h.calls[0].signal.aborted, true);
  assert.equal(flow.recheck(), true);
  h.advance(5000);
  flow.stop();
  assert.equal(h.calls[1].signal.aborted, true);
  h.calls[1].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  assert.equal(flow.getSnapshot().phase, "observing-stopped");
});

test("stopping while awaiting POST marks the acceptance as uncertain and ignores the stale task ID", async () => {
  const h = harness();
  const flow = h.flow();
  flow.submit(textAction);
  flow.stop();
  assert.equal(h.calls[0].signal.aborted, true);
  h.calls[0].resolve({ taskId });
  await tick();
  assert.equal(flow.getSnapshot().phase, "uncertain");
  assert.equal(h.timers(), 0);
});

test("new conversation keeps a saved task locked and ignores the cancelled GET's late response", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  h.advance(5000);
  flow.reset();
  assert.equal(h.calls[1].signal.aborted, true);
  assert.equal(flow.getSnapshot().taskId, taskId);
  assert.equal(flow.submit({ kind: "chat", message: "New conversation" }), false);
  h.calls[1].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  assert.equal(flow.getSnapshot().phase, "observing-stopped");
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).taskId, taskId);
  assert.equal(h.timers(), 0);
});

test("unmount cleanup aborts both pending requests and timers without handling late responses", async () => {
  for (const startGet of [false, true]) {
    const h = harness();
    chooseText(h);
    element(h.renderWorkspace(), "form").onSubmit(formEvent());
    h.calls[0].resolve({ taskId });
    await tick();
    if (startGet) h.advance(5000);
    h.unmount();
    assert.equal(h.timers(), 0);
    assert.equal(h.calls.at(-1).signal.aborted, true);
    if (startGet) {
      h.calls[1].resolve({ taskId, status: "PENDING" });
      await tick();
    }
    h.advance(15000);
    assert.equal(h.calls.length, startGet ? 2 : 1);
  }
});

test("UI announces successful generation and renders STL preview without enabling output", async () => {
  const h = harness();
  chooseText(h);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  assert.match(role(h.renderWorkspace(), "status").children, /요청을 보내는 중/);
  h.calls[0].resolve({ taskId });
  await tick();
  assert.match(role(h.renderWorkspace(), "status").children, /생성하는 중/);
  h.advance(5000);
  h.calls[1].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  const ui = h.renderWorkspace();
  assert.match(role(ui, "status").children, /생성이 완료/);
  assert.equal(element(ui, "a").href, url);
  assert.equal(element(ui, "ArtworkModelPreview").stlUrl, url);
  assert.equal(button(ui, "출력하기"), undefined);
  assert.equal(button(ui, "미리보기 전용").disabled, true);
  assert.equal(button(ui, "미리보기 전용").onClick, undefined);
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus"]);
});

test("UI distinguishes terminal failure, uncertainty, and a recoverable stopped lookup", async () => {
  for (const outcome of ["failed", "uncertain", "stopped"]) {
    const h = harness();
    chooseText(h);
    element(h.renderWorkspace(), "form").onSubmit(formEvent());
    if (outcome === "failed") h.calls[0].resolve({ taskId });
    else h.calls[0].reject(h.conflict(outcome === "stopped" ? taskId : null));
    await tick();
    if (outcome !== "uncertain") {
      h.advance(5000);
      if (outcome === "stopped") h.calls[1].reject(h.error(404));
      else h.calls[1].resolve({ taskId, status: "FAILED" });
      await tick();
    }
    const ui = h.renderWorkspace();
    assert.match(role(ui, "alert").children, {
      failed: /생성에 실패/, uncertain: /접수됐는지 확인할 수 없습니다/, stopped: /같은 작업의 상태를 다시 조회/,
    }[outcome]);
    assert.equal(!!button(ui, "상태 다시 조회"), outcome === "stopped");
  }
});


test("remount restores a still-unconfirmed chat and blocks a duplicate POST in the same tab", () => {
  const h = harness();
  element(h.renderWorkspace(), "select").onChange({ currentTarget: { value: "chat" } });
  element(h.renderWorkspace(), "textarea").onChange({ currentTarget: { value: "Original chat" } });
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  assert.equal(h.calls.length, 1);
  h.unmount();
  assert.equal(h.calls[0].signal.aborted, true);

  let tree = h.renderWorkspace();
  assert.match(role(tree, "status").children, /이전 요청 상태를 확인/);
  assert.equal(element(tree, "fieldset").disabled, true);
  tree = h.renderWorkspace();
  assert.match(role(tree, "alert").children, /중복을 방지하기 위해 새 요청을 제한/);
  element(h.renderWorkspace(), "select").onChange({ currentTarget: { value: "chat" } });
  assert.equal(element(h.renderWorkspace(), "textarea").disabled, true);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  button(h.renderWorkspace(), "입력 초기화").onClick();
  assert.equal(element(h.renderWorkspace(), "fieldset").disabled, false);
  assert.equal(JSON.parse(h.storage.getItem(chatStorageKey)).kind, "chat");
  assert.equal(h.calls.length, 1);
});

test("a fresh page restores an unknown Meshy request and never replays POST", async () => {
  const first = harness();
  const flow = first.flow();
  flow.submit(textAction);
  flow.stop();

  const reloaded = harness({ storage: first.storage });
  const restored = reloaded.flow(true, scope, false);
  assert.equal(restored.getSnapshot().phase, "restoring");
  assert.equal(restored.submit(textAction), false);
  restored.restore();
  assert.equal(restored.getSnapshot().phase, "uncertain");
  restored.reset();
  assert.equal(restored.submit(textAction), false);
  assert.equal(restored.recheck(), false);

  first.calls[0].resolve({ taskId });
  await tick();
  assert.equal(JSON.parse(first.storage.getItem(storageKey)).status, "uncertain");
  assert.equal(first.calls.length + reloaded.calls.length, 1);
});

test("a fresh page resumes a saved Meshy ID with GET only and clears the lock on a terminal response", async () => {
  for (const terminal of [{ status: "SUCCEEDED", modelUrl: url }, { status: "FAILED", failureReason: "Synthetic error" }]) {
    const first = harness();
    const flow = first.flow();
    await accept(first, flow, true);
    flow.stop();
    const reloaded = harness({ storage: first.storage });
    const restored = reloaded.flow();
    assert.equal(restored.getSnapshot().taskId, taskId);
    assert.equal(restored.submit(textAction), false);
    assert.equal(restored.recheck(), true);
    reloaded.advance(5000);
    assert.deepEqual(reloaded.calls.map(({ method, input }) => [method, input]), [["getMeshyTaskStatus", taskId]]);
    reloaded.calls[0].resolve({ taskId, ...terminal });
    await tick();
    assert.equal(restored.getSnapshot().phase, terminal.status.toLowerCase());
    assert.equal(first.storage.getItem(storageKey), null);
    assert.equal(restored.submit(textAction), true);
  }
});

test("switching routes does not poll or create a replacement after a regular 404", async () => {
  const h = harness();
  const flow = h.flow();
  await accept(h, flow);
  h.advance(5000);
  h.calls[1].reject(h.error(404));
  await tick();
  const reopened = harness({ storage: h.storage });
  const restored = reopened.flow();
  assert.equal(restored.getSnapshot().reason, "not-found");
  reopened.advance(15000);
  assert.equal(reopened.calls.length, 0);
  assert.equal(restored.submit(textAction), false);
  assert.equal(restored.recheck(), true);
  reopened.advance(5000);
  assert.deepEqual(reopened.calls.map(({ method, input }) => [method, input]), [["getMeshyTaskStatus", taskId]]);
});

test("scope changes reset the composer and isolate saved requests; a missing scope fails closed", () => {
  const h = harness();
  chooseText(h);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  const alternateScope = "different-opaque-scope";
  let tree = h.renderWorkspace(h.transport, alternateScope);
  assert.equal(element(tree, "fieldset").disabled, true);
  tree = h.renderWorkspace(h.transport, alternateScope);
  assert.equal(element(tree, "fieldset").disabled, false);
  assert.equal(element(tree, "textarea").value, "");
  h.renderWorkspace();
  assert.match(role(h.renderWorkspace(), "alert").children, /새 요청을 제한/);
  assert.equal(h.calls[0].signal.aborted, true);
  const noScope = h.flow(true, "");
  assert.equal(noScope.getSnapshot().phase, "storage-unavailable");
  assert.equal(noScope.submit(textAction), false);
  assert.equal(h.calls.length, 1);
});

test("a second stale flow checks the storage claim again before it can send", () => {
  const h = harness();
  const first = h.flow();
  const second = h.flow();
  assert.equal(first.submit(textAction), true);
  assert.equal(second.submit(textAction), false);
  assert.equal(second.getSnapshot().phase, "uncertain");
  assert.equal(h.calls.length, 1);
});

test("storage read, write and schema failures block dispatch instead of discarding the lock", () => {
  const invalid = [
    "{broken", '{"version":2}', JSON.stringify({
      version: 1, status: "accepted", kind: "chat", id: "fixture-claim", startedAt: 1, taskId,
    }),
  ];
  for (const raw of invalid) {
    const h = harness();
    h.storage.setItem(storageKey, raw);
    const flow = h.flow();
    assert.equal(flow.getSnapshot().phase, "storage-unavailable");
    assert.equal(flow.submit(textAction), false);
    assert.equal(h.storage.getItem(storageKey), raw);
    assert.equal(h.calls.length, 0);
  }

  for (const method of ["getItem", "setItem"]) {
    const storage = { ...memoryStorage(), [method]: () => { throw new Error("Synthetic storage denial"); } };
    const h = harness({ storage });
    const flow = h.flow();
    assert.equal(flow.submit(textAction), false);
    assert.equal(flow.getSnapshot().phase, "storage-unavailable");
    assert.equal(h.calls.length, 0);
  }
});

test("the request is recorded before transport with metadata only; a chat success releases it", async () => {
  const storage = memoryStorage();
  const h = harness({ storage });
  const send = h.transport.sendChatMessage;
  h.transport.sendChatMessage = (...params) => {
    const raw = storage.getItem(storageKey);
    assert.ok(raw);
    const record = JSON.parse(raw);
    assert.deepEqual(Object.keys(record).sort(), ["id", "kind", "startedAt", "status", "version"]);
    assert.equal(record.version, 1);
    assert.equal(record.kind, "chat");
    assert.equal(record.status, "uncertain");
    assert.doesNotMatch(raw, /sensitive|fixture.png|token|Authorization|modelUrl/);
    return send(...params);
  };
  const flow = h.flow();
  assert.equal(flow.submit({ kind: "chat", message: "sensitive fixture text", image }), true);
  assert.equal(h.calls[0].input.image, image);
  h.calls[0].resolve({ chatId: "id", jobId: null, reply: "answer" });
  await tick();
  assert.equal(flow.getSnapshot().phase, "succeeded");
  assert.equal(storage.getItem(storageKey), null);
});

test("a definite pre-transport validation error releases the local claim", async () => {
  const h = harness();
  h.transport.sendChatMessage = async () => { throw h.chatInputError(); };
  const flow = h.flow();
  assert.equal(flow.submit({ kind: "chat", message: "" }), true);
  await tick();
  assert.equal(flow.getSnapshot().phase, "rejected");
  assert.equal(h.storage.getItem(storageKey), null);
  assert.equal(h.calls.length, 0);
  assert.equal(flow.submit(textAction), true);
});

test("a storage write failure after acceptance keeps an unconfirmed record and never starts GET", async () => {
  const storage = memoryStorage();
  const h = harness({ storage });
  const flow = h.flow();
  flow.submit(textAction);
  storage.setItem = () => { throw new Error("Quota exceeded"); };
  h.calls[0].resolve({ taskId });
  await tick();
  assert.equal(flow.getSnapshot().phase, "storage-unavailable");
  assert.equal(JSON.parse(storage.getItem(storageKey)).status, "uncertain");
  h.advance(10000);
  assert.equal(h.calls.length, 1);
  assert.equal(flow.submit(textAction), false);
});

test("after abort, same-ID GET waits for real settlement and then five seconds", async () => {
  for (const rejected of [false, true]) {
    const h = harness();
    const flow = h.flow();
    await accept(h, flow);
    h.advance(5000);
    flow.stop();
    assert.equal(h.calls[1].signal.aborted, true);
    assert.equal(flow.recheck(), true);
    assert.equal(flow.recheck(), false);
    assert.equal(flow.getSnapshot().phase, "waiting-to-resume");
    h.advance(60000);
    assert.equal(h.timers(), 0);
    assert.equal(h.calls.length, 2);

    if (rejected) h.calls[1].reject(h.error(404));
    else h.calls[1].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
    await tick();
    assert.equal(flow.getSnapshot().phase, "pending");
    h.advance(4999);
    assert.equal(h.calls.length, 2);
    h.advance(1);
    assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus", "getMeshyTaskStatus"]);
    assert.equal(h.calls[2].input, taskId);
    assert.equal(h.calls[2].signal.aborted, false);
  }
});

test("waiting to resume is shown after remount and a second unmount removes the waiter", async () => {
  const h = harness();
  chooseText(h);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  h.calls[0].resolve({ taskId });
  await tick();
  h.advance(5000);
  h.unmount();
  assert.equal(h.calls[1].signal.aborted, true);

  h.renderWorkspace();
  button(h.renderWorkspace(), "상태 다시 조회").onClick();
  assert.match(role(h.renderWorkspace(), "status").children, /이전 상태 조회가 끝나기를 기다리고/);
  assert.equal(h.timers(), 0);
  h.unmount();
  h.calls[1].resolve({ taskId, status: "PENDING" });
  await tick();
  assert.equal(h.timers(), 0);
  assert.equal(h.calls.length, 2);
});


async function expireLookup(h, flow, { fromConflict = false } = {}) {
  await accept(h, flow, fromConflict);
  h.advance(5000);
  h.auth.account = null;
  h.calls.at(-1).reject(h.error(401));
  await tick();
}

test("GET 401 preserves the task through unmount and only explicit same-account reauthentication resumes GET", async () => {
  const h = harness();
  chooseText(h);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  const original = JSON.parse(h.storage.getItem(meshyStorageKey));
  h.calls[0].resolve({ taskId });
  await tick();
  h.advance(5000);
  h.auth.account = null;
  h.calls[1].reject(h.error(401));
  await tick();

  assert.deepEqual(JSON.parse(h.storage.getItem(meshyStorageKey)), {
    ...original, status: "reauth-required", taskId,
  });
  assert.match(role(h.renderWorkspace(), "alert").children, /인증이 만료/);
  assert.equal(element(h.renderWorkspace(), "textarea").disabled, true);
  const deniedUi = h.renderWorkspace();
  assert.equal(button(deniedUi, "재인증 후 상태 다시 조회").onClick(), false);
  element(deniedUi, "form").onSubmit(formEvent());

  h.unmount();
  h.renderWorkspace();
  element(h.renderWorkspace(), "select").onChange({ currentTarget: { value: "text" } });
  const restoredUi = h.renderWorkspace();
  assert.match(role(restoredUi, "alert").children, /같은 계정으로 다시 로그인/);
  assert.equal(element(restoredUi, "textarea").disabled, true);
  assert.equal(button(restoredUi, "재인증 후 상태 다시 조회").onClick(), false);
  assert.equal(h.calls.length, 2);
  assert.equal(h.timers(), 0);

  h.auth.account = scope;
  assert.equal(button(restoredUi, "재인증 후 상태 다시 조회").onClick(), false);
  h.auth.reauthenticatedAccount = scope;
  h.advance(30000);
  assert.equal(h.calls.length, 2);
  const recheck = button(h.renderWorkspace(), "재인증 후 상태 다시 조회").onClick;
  assert.equal(recheck(), true);
  assert.equal(recheck(), false);
  h.advance(4999);
  assert.equal(h.calls.length, 2);
  h.advance(1);
  assert.deepEqual(h.calls.map(({ method }) => method), [
    "generateTextTo3D", "getMeshyTaskStatus", "getMeshyTaskStatus",
  ]);
  assert.equal(h.calls[2].input, taskId);
  h.calls[2].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  assert.equal(h.storage.getItem(meshyStorageKey), null);
  assert.match(role(h.renderWorkspace(), "status").children, /생성이 완료/);
  assert.equal(h.calls.length, 3);
});

test("a fresh realm rejects absent, unrelated or unverified account evidence for an existing 401 record", async () => {
  const first = harness();
  await expireLookup(first, first.flow());
  const saved = first.storage.getItem(storageKey);
  for (const auth of [
    { account: null, reauthenticatedAccount: null },
    { account: null, reauthenticatedAccount: scope },
    { account: "other-account", reauthenticatedAccount: "other-account" },
    { account: scope, reauthenticatedAccount: "other-account" },
    { account: scope, reauthenticatedAccount: null },
  ]) {
    const reopened = harness({ storage: first.storage, auth });
    const flow = reopened.flow();
    assert.equal(flow.getSnapshot().reason, "reauth-required");
    assert.equal(flow.recheck(), false);
    assert.equal(flow.submit(textAction), false);
    reopened.advance(20000);
    assert.equal(reopened.calls.length, 0);
    assert.equal(first.storage.getItem(storageKey), saved);
  }
  const other = harness({
    storage: first.storage, auth: { account: "other-account", reauthenticatedAccount: "other-account" },
  });
  assert.equal(other.flow(true, "other-account").recheck(), false);
  assert.equal(other.flow(true, "").submit(textAction), false);
  assert.equal(other.calls.length, 0);
  assert.equal(first.storage.getItem(storageKey), saved);

  const same = harness({
    storage: first.storage, auth: { account: scope, reauthenticatedAccount: scope },
  });
  const recovered = same.flow();
  same.advance(20000);
  assert.equal(same.calls.length, 0);
  assert.equal(recovered.recheck(), true);
  same.advance(5000);
  assert.deepEqual(same.calls.map(({ method, input }) => [method, input]), [["getMeshyTaskStatus", taskId]]);
});

test("403 and ambiguous old v1 access-denied records remain blocked after same-account reauthentication", async () => {
  const first = harness();
  const flow = first.flow();
  await accept(first, flow);
  first.advance(5000);
  first.calls[1].reject(first.error(403));
  await tick();
  assert.equal(flow.getSnapshot().reason, "access-denied");
  const current = JSON.parse(first.storage.getItem(storageKey));
  assert.equal(current.taskId, taskId);
  assert.equal(current.status, "forbidden");

  for (const record of [current, { ...current, status: "access-denied" }]) {
    const storage = memoryStorage();
    storage.setItem(storageKey, JSON.stringify(record));
    const reopened = harness({ storage, auth: { account: scope, reauthenticatedAccount: scope } });
    reopened.renderWorkspace();
    const ui = reopened.renderWorkspace();
    assert.match(role(ui, "alert").children, /조회 권한을 확인할 수 없습니다/);
    assert.equal(button(ui, "재인증 후 상태 다시 조회"), undefined);
    const recovery = reopened.flow();
    assert.equal(recovery.recheck(), false);
    assert.equal(recovery.submit(textAction), false);
    reopened.advance(30000);
    assert.equal(reopened.calls.length, 0);
    assert.deepEqual(JSON.parse(storage.getItem(storageKey)), record);
  }
});

test("auth lost after a recovery click prevents dispatch when the timer fires", async () => {
  const h = harness();
  const flow = h.flow();
  await expireLookup(h, flow);
  h.auth.account = scope;
  h.auth.reauthenticatedAccount = scope;
  assert.equal(flow.recheck(), true);
  h.advance(4999);
  h.auth.account = null;
  h.advance(1);
  assert.equal(h.calls.length, 2);
  assert.equal(flow.getSnapshot().reason, "reauth-required");
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).taskId, taskId);
  assert.equal(flow.submit(textAction), false);
});

test("401 does not consume a conflict task's first retryable 404 after reauthentication", async () => {
  const h = harness();
  const flow = h.flow();
  await expireLookup(h, flow, { fromConflict: true });
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).status, "reauth-required-conflict");
  h.auth.account = scope;
  h.auth.reauthenticatedAccount = scope;
  assert.equal(flow.recheck(), true);
  h.advance(5000);
  h.calls[2].reject(h.error(404));
  await tick();
  assert.equal(flow.getSnapshot().reason, "registration-pending");
  assert.equal(flow.recheck(), true);
  h.advance(5000);
  h.calls[3].reject(h.error(404));
  await tick();
  assert.equal(flow.getSnapshot().reason, "not-found");
  assert.equal(flow.submit(textAction), false);
  h.advance(15000);
  assert.deepEqual(h.calls.map(({ method }) => method), [
    "generateTextTo3D", "getMeshyTaskStatus", "getMeshyTaskStatus", "getMeshyTaskStatus",
  ]);
});

test("reauthenticated resumption still waits for an aborted GET to settle and then five seconds", async () => {
  const h = harness();
  const flow = h.flow();
  await expireLookup(h, flow);
  h.auth.account = scope;
  h.auth.reauthenticatedAccount = scope;
  assert.equal(flow.recheck(), true);
  h.advance(5000);
  flow.stop();
  assert.equal(h.calls[2].signal.aborted, true);
  assert.equal(flow.getSnapshot().reason, "reauth-required");
  assert.equal(flow.recheck(), true);
  assert.equal(flow.recheck(), false);
  assert.equal(flow.getSnapshot().phase, "waiting-to-resume");
  h.advance(60000);
  assert.equal(h.calls.length, 3);
  h.calls[2].reject(h.error(403));
  await tick();
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).status, "reauth-required");
  h.advance(4999);
  assert.equal(h.calls.length, 3);
  h.advance(1);
  assert.equal(h.calls[3].method, "getMeshyTaskStatus");
  assert.equal(h.calls[3].input, taskId);
  assert.equal(h.calls[3].signal.aborted, false);
  h.calls[3].resolve({ taskId, status: "FAILED", failureReason: "Verified terminal failure" });
  await tick();
  assert.equal(flow.getSnapshot().phase, "failed");
  assert.equal(h.storage.getItem(storageKey), null);
  assert.equal(h.calls.filter(({ method }) => method === "generateTextTo3D").length, 1);
});

async function workspaceWithExpiredLookup() {
  const first = harness();
  await expireLookup(first, first.flow());
  return harness({ storage: first.storage, auth: { account: null, reauthenticatedAccount: null } });
}

const labelForRecheck = "재인증 후 상태 다시 조회";

test("a committed verifier revocation blocks the scheduled GET without resetting the same-scope flow", async () => {
  const h = await workspaceWithExpiredLookup();
  const allowed = () => scope;
  h.renderWorkspace(h.transport, scope, allowed);
  const allowedTree = h.renderWorkspace(h.transport, scope, allowed);
  const saved = h.storage.getItem(storageKey);
  assert.equal(button(allowedTree, labelForRecheck).onClick(), true);
  assert.equal(h.timers(), 1);

  const checks = [];
  const revoked = (purpose) => { checks.push(purpose); return null; };
  const revokedTree = h.renderWorkspace(h.transport, scope, revoked);
  assert.equal(element(revokedTree, "fieldset").disabled, true);
  assert.equal(h.timers(), 1);
  h.advance(4999);
  assert.equal(h.calls.length, 0);
  h.advance(1);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(checks, ["request"]);
  assert.equal(h.storage.getItem(storageKey), saved);
  assert.match(role(h.renderWorkspace(h.transport, scope, revoked), "alert").children, /인증이 만료/);
});

test("replacing an invalid verifier restores only an explicitly requested same-ID GET", async () => {
  const h = await workspaceWithExpiredLookup();
  const unavailable = () => null;
  h.renderWorkspace(h.transport, scope, unavailable);
  const locked = h.renderWorkspace(h.transport, scope, unavailable);
  assert.equal(button(locked, labelForRecheck).onClick(), false);

  const reauthenticated = () => scope;
  const ready = h.renderWorkspace(h.transport, scope, reauthenticated);
  h.advance(10000);
  assert.equal(h.calls.length, 0);
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).taskId, taskId);
  const recheck = button(ready, labelForRecheck).onClick;
  assert.equal(recheck(), true);
  assert.equal(recheck(), false);
  h.advance(4999);
  assert.equal(h.calls.length, 0);
  h.advance(1);
  assert.deepEqual(h.calls.map(({ method, input }) => [method, input]), [["getMeshyTaskStatus", taskId]]);
  h.calls[0].resolve({ taskId, status: "SUCCEEDED", modelUrl: url });
  await tick();
  assert.equal(h.storage.getItem(storageKey), null);
});

test("a replacement verifier for a different account cannot use the saved task or submit", async () => {
  const h = await workspaceWithExpiredLookup();
  const original = () => scope;
  h.renderWorkspace(h.transport, scope, original);
  h.renderWorkspace(h.transport, scope, original);
  const saved = h.storage.getItem(storageKey);

  const differentAccount = () => "other-account";
  const tree = h.renderWorkspace(h.transport, scope, differentAccount);
  assert.equal(button(tree, labelForRecheck).onClick(), false);
  element(tree, "select").onChange({ currentTarget: { value: "text" } });
  element(tree, "textarea").onChange({ currentTarget: { value: textAction.prompt } });
  element(h.renderWorkspace(h.transport, scope, differentAccount), "form").onSubmit(formEvent());
  h.advance(10000);
  assert.equal(h.calls.length, 0);
  assert.equal(h.timers(), 0);
  assert.equal(h.storage.getItem(storageKey), saved);
});

test("a scheduled GET consults the last verifier after several committed same-scope changes", async () => {
  const h = await workspaceWithExpiredLookup();
  const checked = [];
  const verifier = (name, value) => (purpose) => {
    checked.push([name, purpose]);
    return value;
  };
  const initial = verifier("initial", scope);
  h.renderWorkspace(h.transport, scope, initial);
  assert.equal(button(h.renderWorkspace(h.transport, scope, initial), labelForRecheck).onClick(), true);
  checked.length = 0;

  const latest = verifier("latest", null);
  h.renderWorkspace(h.transport, scope, verifier("second", null));
  h.renderWorkspace(h.transport, scope, verifier("third", scope));
  h.renderWorkspace(h.transport, scope, latest);
  assert.equal(h.timers(), 1);
  h.advance(5000);
  assert.deepEqual(h.calls, []);
  assert.deepEqual(checked, [["latest", "request"]]);
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).taskId, taskId);
});

test("a render that never commits cannot publish a permissive verifier to the existing flow", async () => {
  const h = await workspaceWithExpiredLookup();
  const revoked = () => null;
  h.renderWorkspace(h.transport, scope, revoked);
  const mounted = h.renderWorkspace(h.transport, scope, revoked);
  const allowed = () => scope;
  h.renderWorkspace(h.transport, scope, allowed, false);

  assert.equal(button(mounted, labelForRecheck).onClick(), false);
  h.advance(5000);
  assert.equal(h.calls.length, 0);
  assert.equal(JSON.parse(h.storage.getItem(storageKey)).taskId, taskId);
  assert.equal(button(h.renderWorkspace(h.transport, scope, allowed), labelForRecheck).onClick(), true);
  h.advance(5000);
  assert.deepEqual(h.calls.map(({ method, input }) => [method, input]), [["getMeshyTaskStatus", taskId]]);
});

test("a paid request rejected by auth before fetch releases only its saved request", async () => {
  const { h, localStorage, render, requests } = apiHarness(() =>
    Response.json({ hasNext: false, nextCursor: null, chats: [] }));
  render();
  await tick();
  const unrelated = JSON.stringify({ version: 1, id: "kept-fixture", kind: "text", startedAt: 0,
    status: "accepted", taskId: "kept-task" });
  h.storage.setItem(meshyStorageKey, unrelated);
  const write = h.storage.setItem.bind(h.storage);
  h.storage.setItem = (...args) => {
    write(...args);
    localStorage.removeItem(sessionKey);
  };
  element(render(), "select").onChange({ currentTarget: { value: "chat" } });
  element(render(), "textarea").onChange({ currentTarget: { value: "Not sent" } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  assert(requests.every(({ options }) => options.method === "GET"));
  assert.equal(h.storage.getItem(storageKey), null);
  assert.equal(h.storage.getItem(chatStorageKey), null);
  assert.equal(h.storage.getItem(meshyStorageKey), unrelated);
  h.unmount();
  h.storage.setItem = write;
  localStorage.setItem(sessionKey, sessionRecord("session-b"));
  const next = h.bindApi("session-b", scope);
  h.renderBoundWorkspace(next, scope, "session-b");
  await tick();
  const tree = h.renderBoundWorkspace(next, scope, "session-b");
  assert.equal(element(tree, "fieldset").disabled, false);
  assert.equal(find(tree, ({ props }) => String(props.children).includes("새 요청을 제한")), undefined);
});

test("a failed fetch retains the paid chat lock across remount without resending automatically", async () => {
  const { h, render, requests } = apiHarness((_, options) => {
    if (options.method === "POST") throw new TypeError("Fixture connection lost after dispatch");
    return Response.json({ hasNext: false, nextCursor: null, chats: [] });
  });
  render();
  await tick();
  const tryChat = () => {
    element(render(), "select").onChange({ currentTarget: { value: "chat" } });
    element(render(), "textarea").onChange({ currentTarget: { value: "Fixture question" } });
    element(render(), "form").onSubmit(formEvent());
  };
  tryChat();
  await tick();
  const lock = h.storage.getItem(chatStorageKey);
  assert.equal(JSON.parse(lock).status, "uncertain");
  h.unmount();
  render();
  await tick();
  tryChat();
  h.advance(30000);
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 1);
  assert.equal(h.storage.getItem(chatStorageKey), lock);
});

test("a regular Meshy 404 leaves a GET recovery action and permits a separate paid chat", async () => {
  const { h, render, requests } = apiHarness((target, options) => {
    if (target.pathname === "/chats/messages" && options.method === "GET") {
      return Response.json({ hasNext: false, nextCursor: null, chats: [] });
    }
    if (target.pathname === "/chats/messages") return Response.json({ chatId: "8", jobId: null, reply: "Chat works" });
    if (options.method === "POST") return Response.json({ taskId }, { status: 202 });
    return new Response(null, { status: 404 });
  });
  render();
  await tick();
  element(render(), "select").onChange({ currentTarget: { value: "text" } });
  element(render(), "textarea").onChange({ currentTarget: { value: "Fixture model" } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  h.advance(5000);
  await tick();
  assert.match(role(render(), "alert").children, /찾을 수 없습니다/);
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 1);
  const recheck = button(render(), "상태 다시 조회");
  assert(recheck);
  recheck.onClick();
  h.advance(5000);
  await tick();
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 1);
  const saved = JSON.parse(h.storage.getItem(meshyStorageKey));
  assert.equal(saved.taskId, taskId);
  assert.equal(saved.status, "not-found");

  element(render(), "select").onChange({ currentTarget: { value: "chat" } });
  element(render(), "textarea").onChange({ currentTarget: { value: "Fixture question" } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  assert(find(render(), ({ props }) => props.children === "Chat works"));
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 2);
  assert.equal(h.storage.getItem(chatStorageKey), null);
  assert.equal(JSON.parse(h.storage.getItem(meshyStorageKey)).taskId, taskId);
});

test("chat history refresh keeps distinct equal text and ignores a late initial GET", async () => {
  let sendHistory, sendReply, sendRefreshed;
  let reads = 0;
  const { render, requests } = apiHarness((_, options) => new Promise((resolve) => {
    if (options.method === "POST") sendReply = resolve;
    else if (++reads === 1) sendHistory = resolve;
    else sendRefreshed = resolve;
  }));
  const text = "Repeated fixture text";
  const row = (chatId, role, message) => ({
    chatId, role, message, imageUrl: null, jobId: null, createdAt: "2026-01-01T10:00:00Z",
  });
  render();
  await tick();
  element(render(), "select").onChange({ currentTarget: { value: "chat" } });
  element(render(), "textarea").onChange({ currentTarget: { value: text } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  sendReply(Response.json({ chatId: "3", jobId: null, reply: "Fixture reply" }));
  await tick();
  assert(requests[0].options.signal.aborted);
  assert.equal(reads, 2);
  sendRefreshed(Response.json({ hasNext: false, nextCursor: null,
    chats: [row("1", "USER", text), row("2", "USER", text), row("3", "ASSISTANT", "Fixture reply")] }));
  await tick();
  sendHistory(Response.json({ hasNext: false, nextCursor: null, chats: [row("99", "USER", "Stale row")] }));
  await tick();
  const encoded = JSON.stringify(render());
  assert.equal(encoded.split(text).length - 1, 2);
  assert.equal(encoded.split("Fixture reply").length - 1, 1);
  assert.equal(encoded.includes("Stale row"), false);
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 1);
});

test("a failed chat refresh keeps the preexisting rows and renders the user only once", async () => {
  let acceptChat;
  let reads = 0;
  const text = "Fixture user row";
  const { render, requests } = apiHarness((_, options) => {
    if (options.method === "POST") return new Promise((resolve) => { acceptChat = resolve; });
    if (++reads > 1) return new Response(null, { status: 503 });
    return Response.json({ hasNext: false, nextCursor: null, chats: [
      { chatId: "1", role: "ASSISTANT", message: "Earlier fixture", imageUrl: null, jobId: null, createdAt: "2026-01-01T09:00:00Z" },
      { chatId: "2", role: "USER", message: text, imageUrl: null, jobId: null, createdAt: "2026-01-01T10:00:00Z" },
    ] });
  });
  render();
  element(render(), "select").onChange({ currentTarget: { value: "chat" } });
  element(render(), "textarea").onChange({ currentTarget: { value: text } });
  element(render(), "form").onSubmit(formEvent());
  await tick();
  assert(find(render(), ({ props }) => props.children === text));
  acceptChat(Response.json({ chatId: "3", jobId: null, reply: "Current fixture answer" }));
  await tick();
  const ui = render();
  assert(find(ui, ({ props }) => props.children === "Earlier fixture"));
  assert(find(ui, ({ props }) => props.children === "Current fixture answer"));
  assert.equal(JSON.stringify(ui).split(text).length - 1, 1);
  assert(button(ui, "다시 시도"));
  assert.equal(requests.filter(({ options }) => options.method === "POST").length, 1);
});

test("a late preflight error cannot clear a newer lock in the same request channel", async () => {
  const h = harness();
  const flow = h.flow();
  assert.equal(flow.submit({ kind: "chat", message: "Old fixture" }), true);
  flow.stop();
  const newer = JSON.stringify({ version: 1, id: "new-claim", kind: "chat", startedAt: 0, status: "uncertain" });
  h.storage.setItem(storageKey, newer);
  h.calls[0].reject(h.preflightError());
  await tick();
  assert.equal(h.storage.getItem(storageKey), newer);
  assert.equal(h.calls.length, 1);
});

test("STL retry remounts the failed preview and clears the same signed URL without transport", async () => {
  const h = harness();
  const modelUrl = url + "?signature=fixture";
  chooseText(h);
  element(h.renderWorkspace(), "form").onSubmit(formEvent());
  h.calls[0].resolve({ taskId });
  await tick();
  h.advance(5000);
  h.calls[1].resolve({ taskId, status: "SUCCEEDED", modelUrl });
  await tick();
  const getBoundary = () => find(h.renderWorkspace(), ({ type }) => type?.name === "PreviewErrorBoundary");
  const initial = getBoundary();
  const boundary = new initial.type(initial.props);
  boundary.props = initial.props;
  boundary.state = initial.type.getDerivedStateFromError(new Error("Fixture STL failure"));
  const retry = button(boundary.render(), "미리보기 다시 시도");
  assert(retry);
  retry.onClick();
  assert.deepEqual(h.clearedModels, [modelUrl]);
  assert.notEqual(getBoundary().key, initial.key);
  assert.equal(element(h.renderWorkspace(), "ArtworkModelPreview").stlUrl, modelUrl);
  assert.deepEqual(h.calls.map(({ method }) => method), ["generateTextTo3D", "getMeshyTaskStatus"]);
});
