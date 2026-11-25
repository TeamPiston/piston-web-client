#!/usr/bin/env node

import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import ts from "typescript";
import { verifyGenerationPrintIntegration } from "./lib/create-generation-harness.mjs";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const requests = [];

// Execute the real TS modules without a Next server or generated files.
async function loadPrintRuntime({ mock = false, baseUrl = "", nodeEnv = "production", fetchImpl, ui }) {
  const paths = [
    "src/entities/print/model/print.ts",
    "src/shared/mock/mock-data.ts",
    "src/shared/api/index.ts",
    "src/shared/api/client.ts",
    "src/shared/api/auth.ts",
    ...(ui ? [
      "src/page-slices/mypage/ui/mypage-page.tsx",
      "src/page-slices/mypage/ui/print-status-detail-modal.tsx",
    ] : []),
  ];
  const sources = new Map(await Promise.all(paths.map(async (path) => [
    resolve(ROOT_DIR, path),
    ts.transpileModule(await readFile(resolve(ROOT_DIR, path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: path,
    }).outputText,
  ])));
  const window = {
    location: { origin: "https://frontend.invalid", search: "", pathname: "/mypage", assign() {} },
    navigator: { locks: createAuthLocks() },
    localStorage: { getItem: () => null, removeItem() {} },
    dispatchEvent() {},
  };
  const context = createContext({
    AbortSignal, Event,
    process: { env: {
      NODE_ENV: nodeEnv,
      NEXT_PUBLIC_USE_MOCK: String(mock),
      NEXT_PUBLIC_API_BASE_URL: baseUrl,
    } },
    window: Object.assign(window, ui?.timers), fetch: fetchImpl, Headers, FormData, Blob, URL, URLSearchParams, ArrayBuffer,
    AbortController, document: { body: { style: {} }, addEventListener() {}, removeEventListener() {} },
  });
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    assert(sources.has(path), "Unexpected module: " + path);
    const loadedModule = { exports: {} };
    modules.set(path, loadedModule);
    const requireSource = (specifier) => {
      if (ui && specifier === "@/entities/print") return load(resolve(ROOT_DIR, paths[0]));
      if (ui && Object.hasOwn(ui.stubs, specifier)) return ui.stubs[specifier];
      const target = specifier.startsWith("@/")
        ? resolve(ROOT_DIR, "src", specifier.slice(2))
        : resolve(dirname(path), specifier);
      return load([target + ".ts", target + ".tsx"].find((path) => sources.has(path)) ?? resolve(target, "index.ts"));
    };
    new Script("(function(require, module, exports) {\n" + sources.get(path) + "\n})", {
      filename: path,
    }).runInContext(context)(requireSource, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }
  return {
    print: load(resolve(ROOT_DIR, paths[0])),
    mock: load(resolve(ROOT_DIR, paths[1])),
    api: load(resolve(ROOT_DIR, "src/shared/api/index.ts")),
    MyPage: ui ? load(resolve(ROOT_DIR, "src/page-slices/mypage/ui/mypage-page.tsx")).default : undefined,
    window,
  };
}

function findElement(tree, match) {
  if (Array.isArray(tree)) return tree.map((child) => findElement(child, match)).find(Boolean);
  if (!tree?.props) return undefined;
  if (match(tree)) return tree;
  return findElement(tree.props.children, match);
}

async function verifyMyPageSafety(mock = false) {
  const jsx = (type, props, key) => ({ type, props, key });
  const auth = {
    user: { id: "a", userId: "a", name: "Account A" },
    apiSessionId: "session-a",
    isLoggedIn: true,
    isRestoring: false,
  };
  const credentials = (id) => ({ id, accessToken: "token-" + id, refreshToken: "refresh-" + id });
  let storedSession = credentials(auth.apiSessionId);
  let storageUnavailable = mock;
  let hooks = [];
  let effects = new Map();
  let index = 0;
  let profileKey;
  const timeouts = new Map();
  const intervals = new Map();
  const printRequests = [];
  const refreshRequests = [];
  let responseStatus = "PRINTING";
  let nextReadStatus;
  let holdNextRead = false;
  let finishRead;
  const runtime = await loadPrintRuntime({
    mock, baseUrl: "https://mypage-contract.invalid",
    fetchImpl: async (url, options) => {
      const authorization = options.headers.get("Authorization");
      if (url === "https://mypage-contract.invalid/reissue") {
        refreshRequests.push({ method: options.method, authorization });
        return Response.json({ accessToken: "renewed-session-a" });
      }
      printRequests.push({ method: options.method, authorization, signal: options.signal });
      assert.equal(options.method, "GET");
      assert.equal(url, "https://mypage-contract.invalid/api/prints/current");
      if (nextReadStatus) {
        const status = nextReadStatus;
        nextReadStatus = undefined;
        return new Response(null, { status });
      }
      if (holdNextRead) {
        holdNextRead = false;
        return new Promise((resolve) => { finishRead = resolve; });
      }
      return Response.json({ id: 7110, artworkName: "Task for " + authorization, status: responseStatus });
    },
    ui: {
      timers: {
        setTimeout(callback) { const id = Symbol(); timeouts.set(id, callback); return id; },
        clearTimeout(id) { timeouts.delete(id); },
        setInterval(callback, delay) {
          assert.equal(delay, 3000);
          const id = Symbol();
          intervals.set(id, callback);
          return id;
        },
        clearInterval(id) { intervals.delete(id); },
      },
      stubs: {
        react: {
          Suspense: "Suspense",
          useState(initial) {
            const slot = index++;
            if (!(slot in hooks)) hooks[slot] = typeof initial === "function" ? initial() : initial;
            const current = hooks;
            return [current[slot], (next) => {
              current[slot] = typeof next === "function" ? next(current[slot]) : next;
            }];
          },
          useRef(initial) {
            const slot = index++;
            return hooks[slot] ??= { current: initial };
          },
          useCallback(fn, deps) {
            const slot = index++;
            const previous = hooks[slot];
            if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) hooks[slot] = { fn, deps };
            return hooks[slot].fn;
          },
          useEffect(setup, deps) {
            const slot = index++;
            const previous = effects.get(slot);
            if (!previous || deps.some((dep, i) => dep !== previous.deps[i])) {
              effects.set(slot, { deps, cleanup: previous?.cleanup, setup });
            }
          },
        },
        "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "fragment" },
        "next/navigation": {
          useRouter: () => ({}),
          useSearchParams: () => new URLSearchParams(),
        },
        "next/link": { default: "Link" },
        "lucide-react": { CircleUserRound: "CircleUserRound" },
        "@/entities/session": { useAuth: () => auth },
        "@/features/stl-viewer": { ArtworkModelPreview: "ArtworkModelPreview" },
        "@/shared/ui/demo-notice": { DemoNotice: "DemoNotice" },
        "@/widgets/header": { Header: "Header" },
        "./design-detail-modal": { DesignDetailModal: "DesignDetailModal" },
        "./delete-account-modal": { DeleteAccountModal: "DeleteAccountModal" },
        "./print-retry-confirm-modal": { PrintRetryConfirmModal: "PrintRetryConfirmModal" },
        "./printer-management-page": { ApiPrinterManagementPage: "ApiPrinterManagementPage" },
      },
    },
  });
  runtime.window.localStorage.getItem = (key) => {
    if (storageUnavailable) throw new Error("Fixture storage unavailable");
    return key === "piston-api-session" ? JSON.stringify(storedSession) : null;
  };
  runtime.window.localStorage.setItem = (key, value) => {
    assert.equal(key, "piston-api-session");
    storedSession = JSON.parse(value);
  };
  const fetchMockDesigns = runtime.mock.fetchMockMyDesigns;
  let mockDesignReads = 0;
  runtime.mock.fetchMockMyDesigns = () => {
    mockDesignReads += 1;
    return fetchMockDesigns();
  };
  const clearPage = () => {
    for (const effect of effects.values()) effect.cleanup?.();
    hooks = [];
    effects = new Map();
  };
  const render = () => {
    const content = runtime.MyPage().props.children;
    const profile = findElement(content.type(), ({ type }) => type.name === "MyProfilePage");
    if (profile.key !== profileKey) {
      clearPage();
      profileKey = profile.key;
    }
    index = 0;
    const tree = profile.type(profile.props);
    for (const effect of effects.values()) {
      if (!effect.setup) continue;
      effect.cleanup?.();
      effect.cleanup = effect.setup();
      delete effect.setup;
    }
    return tree;
  };
  const load = async () => {
    for (const [id, callback] of timeouts) {
      timeouts.delete(id);
      callback();
    }
    await new Promise((resolve) => setImmediate(resolve));
  };
  const named = (tree, name) => findElement(tree, ({ type }) => type === name || type.name === name);
  const statusCard = () => named(render(), "PrintStatusSection");
  const designCard = (tree) => findElement(tree, ({ type, props }) => type === "button" && props["aria-label"]?.endsWith("상세 보기"));
  const beforeLoad = render();
  if (mock) {
    runtime.mock.resetMockData("EMPTY");
    await load();
    const cards = named(render(), "CreatedDesignSection");
    const design = cards.props.designs[0];
    designCard(cards.type(cards.props)).props.onClick();
    let modal = named(render(), "DesignDetailModal");
    assert.equal(modal.props.design.id, design.id);
    modal.props.onTogglePublished(design.id);
    await load();
    modal = named(render(), "DesignDetailModal");
    assert.equal(modal.props.design.isPublished, !design.isPublished);
    await modal.props.onPrint(design.title);
    assert.equal(statusCard().props.printTask.artworkName, design.title);
    statusCard().props.onSelect();
    await named(render(), "PrintStatusDetailModal").props.onCancel();
    assert.equal((await runtime.print.getCurrentPrintTask()).status, "CANCELLED");
    modal.props.onDelete(design.id);
    assert(!named(render(), "CreatedDesignSection").props.designs.some(({ id }) => id === design.id));
    assert.equal(mockDesignReads, 1);
    clearPage();
    render();
    await load();
    statusCard().props.onRetry();
    await named(render(), "PrintRetryConfirmModal").props.onConfirm();
    assert.equal(statusCard().props.printTask.status, "PRINTING");
    assert.equal(printRequests.length, 0);
    clearPage();
    console.log("PASS MyPage Mock design list, open, publish, delete and print lifecycle");
    return;
  }
  const designNotice = "디자인 관리 기능 준비 중";
  // Evaluate the page before its first effect, including the initial render on refresh.
  assert(!named(beforeLoad, "CreatedDesignSection"), "API entry exposed Mock design cards");
  assert(!named(beforeLoad, "DesignDetailModal"), "API entry exposed Mock design actions");
  assert(findElement(beforeLoad, ({ props }) => props.children === designNotice));
  await load();
  const printing = statusCard();
  assert.equal(printing.props.printTask.artworkName, "Task for Bearer token-session-a");
  printing.props.onSelect();
  const detail = named(render(), "PrintStatusDetailModal");
  assert.equal(detail.props.onCancel, undefined);
  const detailUi = detail.type(detail.props);
  assert(!findElement(detailUi, ({ props }) => props.children === "출력 취소"));

  const poll = async () => {
    assert.equal(intervals.size, 1);
    intervals.values().next().value();
    await load();
  };
  nextReadStatus = 401;
  await poll();
  assert.deepEqual(refreshRequests, [{ method: "POST", authorization: "Bearer refresh-session-a" }]);
  assert.deepEqual(printRequests.map(({ authorization }) => authorization), [
    "Bearer token-session-a", "Bearer token-session-a", "Bearer renewed-session-a",
  ]);
  assert.equal(statusCard().props.printTask.artworkName, "Task for Bearer renewed-session-a");

  const renewedA = storedSession;
  const countBeforeBlockedPoll = printRequests.length;
  storedSession = credentials("session-b");
  await poll();
  assert.equal(printRequests.length, countBeforeBlockedPoll, "A poll must not send the new account's token");
  const blocked = named(render(), "PrintLoadState");
  assert.equal(blocked.props.error, "auth");
  storedSession = renewedA;
  blocked.props.onRetry();
  await load();
  assert.equal(statusCard().props.printTask.artworkName, "Task for Bearer renewed-session-a");

  holdNextRead = true;
  await poll();
  const pendingA = printRequests.at(-1);
  const countBeforeSwitch = printRequests.length;
  storedSession = credentials("session-b");
  assert.equal(auth.apiSessionId, "session-a");
  await poll();
  assert.equal(printRequests.length, countBeforeSwitch, "A poll must not send the new account's token");
  assert.equal(pendingA.signal.aborted, true, "A poll must abort the previous account's request");
  assert.equal(statusCard(), undefined, "The stale view must clear the previous print");
  assert(!named(render(), "PrintStatusDetailModal"));
  assert.equal(intervals.size, 0);

  auth.user = { id: "b", userId: "b", name: "Account B" };
  auth.apiSessionId = "session-b";
  responseStatus = "FAILED";
  assert(!named(render(), "PrintStatusDetailModal"));
  await load();
  const failed = statusCard();
  assert.equal(failed.props.printTask.status, "FAILED");
  assert.equal(failed.props.printTask.artworkName, "Task for Bearer token-session-b");
  assert(!findElement(failed.type(failed.props), ({ props }) => props.children === "다시 출력하기"));
  finishRead(Response.json({ id: 7120, artworkName: "Late account A task", status: "PRINTING" }));
  await load();
  assert.equal(statusCard().props.printTask.artworkName, "Task for Bearer token-session-b");
  clearPage();
  holdNextRead = true;
  assert(findElement(render(), ({ props }) => props.children === designNotice));
  await load();
  assert.equal(typeof finishRead, "function");
  storedSession = credentials("session-b-new-login");
  finishRead(Response.json({ id: 7120, artworkName: "Old session task", status: "PRINTING" }));
  await load();
  assert.equal(statusCard(), undefined, "A response must check storage even without a subsequent poll");
  assert.equal(intervals.size, 0);

  auth.apiSessionId = storedSession.id;
  auth.isRestoring = true;
  responseStatus = "COMPLETED";
  const countBeforeRestore = printRequests.length;
  render();
  await load();
  assert.equal(printRequests.length, countBeforeRestore);
  auth.isRestoring = false;
  storageUnavailable = true;
  render();
  await load();
  assert.equal(printRequests.length, countBeforeRestore);
  assert.equal(named(render(), "PrintLoadState").props.error, "auth");
  storageUnavailable = false;
  nextReadStatus = 503;
  named(render(), "PrintLoadState").props.onRetry();
  await load();
  assert.equal(named(render(), "PrintLoadState").props.error, "request");
  named(render(), "PrintLoadState").props.onRetry();
  await load();
  assert.equal(statusCard().props.printTask.status, "COMPLETED");
  assert.equal(statusCard().props.printTask.artworkName, "Task for Bearer token-session-b-new-login");

  clearPage();
  responseStatus = "PRINTING";
  render();
  await load();
  assert.equal(statusCard().props.printTask.status, "PRINTING");
  holdNextRead = true;
  await poll();
  const pendingOnUnmount = printRequests.at(-1);
  const countBeforeUnmount = printRequests.length;
  await poll();
  assert.equal(printRequests.length, countBeforeUnmount, "Polls must not overlap");
  clearPage();
  assert.equal(pendingOnUnmount.signal.aborted, true);
  assert.equal(intervals.size, 0);
  assert.equal(timeouts.size, 0);
  finishRead(Response.json({ id: 7121, status: "COMPLETED" }));
  await load();
  assert.equal(mockDesignReads, 0);
  assert(printRequests.every(({ method }) => method === "GET"));
  assert.equal(refreshRequests.length, 1);
  console.log("PASS MyPage session-bound polling, delayed storage events, late responses, token reissue, retry and cleanup; print writes=0");
}

async function verifyApiMutationSafety() {
  const mutations = [];
  const { print, mock, window } = await loadPrintRuntime({
    baseUrl: "https://blocked-print.invalid",
    fetchImpl: async (url, options) => {
      mutations.push(options.method + " " + new URL(url).pathname);
      return options.method === "DELETE"
        ? new Response(null, { status: 204 })
        : Response.json({ id: 7110, status: "PRINTING" }, { status: 201 });
    },
  });
  window.location.search = "?mockPrintStatus=PRINTING";
  window.localStorage.getItem = (key) => key === "piston-access-token" ? "fixture-access-token" : null;
  mock.resetMockData("EMPTY");
  const results = await Promise.allSettled([
    print.createPrintTask("Fixture"),
    print.retryPrintTask({ id: 7110, artworkName: "Fixture" }),
    print.cancelPrintTask(7110),
  ]);
  assert.deepEqual(mutations, [], "API print mutations must stop before reaching fetch");
  assert(results.every(({ status, reason }) => status === "rejected" && reason.message === "출력 기능 준비 중"));
  assert.equal(await mock.fetchMockPrintStatus(), null);
  console.log("PASS print adapter rejects create, retry and cancel in API mode; write requests=0");
}

async function verifyFrontendContracts() {
  const [createSource, printFlowSource, previewSource, myPageSource] = await Promise.all([
    readFile(resolve(ROOT_DIR, "src/page-slices/create/ui/create-workspace.tsx"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/create/model/use-create-print-flow.ts"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/create/ui/components/preview-panel.tsx"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/mypage/ui/mypage-page.tsx"), "utf8"),
  ]);
  assert(
    createSource.includes("useCreatePrintFlow({ isGenerated, isPrintBlocked, isPrinterConnected })"),
    "Create: missing print flow integration",
  );
  for (const statement of [
    "onPrint={handlePrintOpen}",
    "onRetryPrintCheck={handlePrintOpen}",
    "onConfirm={handlePrintConfirm}",
    "onClose={handlePrintModalClose}",
    "onClose={handlePrinterConnectionModalClose}",
    "onClose={handlePrintInProgressModalClose}",
    "isOpen={isPrintModalOpen && !isPrintCheckFailed && !isPrintStatusChecking}",
    "isOpen={isPrinterConnectionModalOpen}",
    "isOpen={isPrintInProgressModalOpen}",
    'currentPrintTask?.status === "PRINTING"',
    "isSubmitting={isPrintStarting}",
    "errorMessage={printStartError}",
    "printSuccessPhase={printSuccessPhase}",
  ]) {
    assert(createSource.includes(statement), "Create: missing print flow wiring: " + statement);
  }
  const createAst = ts.createSourceFile("create-workspace.tsx", createSource, ts.ScriptTarget.ES2022, true);
  const callbacks = new Map();
  const collectCallbacks = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
      callbacks.set(node.name.text, node.initializer.getText(createAst));
    }
    ts.forEachChild(node, collectCallbacks);
  };
  collectCallbacks(createAst);
  for (const [callback, call] of [
    ["handleNewChat", "resetPrintFlow()"],
    ["handleOpenPrinterManagement", "closePrintSetup()"],
    ["handleOpenPrinterManagement", 'router.push("/mypage?tab=printer")'],
  ]) {
    assert(callbacks.get(callback)?.includes(call), "Create: missing " + callback + " integration: " + call);
  }
  await verifyGenerationPrintIntegration();
  console.log("PASS Create generation acceptance, print setup closure and eligibility (VM execution)");
  assert(printFlowSource.includes("createPrintTask()"), "Create: missing print creation");
  for (const statement of [
    'setPrintSuccess({ phase: "visible", notice: { startedAt: performance.now() } })',
    'updatePhase("fading"), Math.max(0, 3500 - elapsed)',
    'updatePhase("hidden"), Math.max(0, 4000 - elapsed)',
    'printSuccessPhase: printSuccess?.phase ?? "hidden"',
    'setPrintSuccess(null)',
  ]) {
    assert(printFlowSource.includes(statement), "Create: missing success overlay contract: " + statement);
  }
  for (const statement of [
    'printSuccessPhase !== "hidden"',
    'printSuccessPhase === "fading" ? "opacity-0" : "opacity-100"',
    "transition-opacity duration-500",
    'role="status"',
    'aria-live="polite"',
    "출력이 시작되었습니다.",
    "마이페이지에서 출력 상황을 확인해 주세요!",
    'disabled={!onPrint || !isGenerated || isPrintBlocked || isPrintCheckFailed || isPrintStatusChecking}',
    "onClick={onRetryPrintCheck}",
  ]) {
    assert(previewSource.includes(statement), "Create preview: missing contract: " + statement);
  }
  assert(
    /setInterval\(\(\) => \{[\s\S]*?loadCurrentPrint\(\)[\s\S]*?\}, 3000\)/.test(myPageSource),
    "MyPage: missing 3-second polling",
  );
  for (const statement of [
    "clearInterval(pollingId)",
    'printTask?.status !== "PRINTING"',
    'printTask?.status === "EMPTY"',
    'href="/create"',
    'href="/feed"',
    "await cancelPrintTask(selectedPrintTask.id)",
    "setPrintTask(null)",
    "await retryPrintTask(printTask)",
  ]) {
    assert(myPageSource.includes(statement), "MyPage: missing contract: " + statement);
  }
  console.log("PASS frontend source contract checks (no browser rendering)");
}

async function verifyMockLifecycle() {
  let fetchCount = 0;
  const { print, mock, window } = await loadPrintRuntime({
    mock: true,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("Explicit mock mode must not send HTTP requests");
    },
  });
  for (const profile of [mock.MOCK_USER_PROFILE, mock.MOCK_ACCOUNT_PROFILE]) {
    assert.match(profile.email, /^[^@]+@example\.com$/, "Public profile emails must use example.com");
  }
  assert.equal(mock.MOCK_ACCOUNT_PROFILE.id, "demo-user");
  assert.equal(mock.MOCK_ACCOUNT_PROFILE.name, "데모 사용자");
  assert.equal(print.PRINT_USER_ID, mock.MOCK_ACCOUNT_PROFILE.id);
  assert.match(mock.MOCK_ACCOUNT_SETTINGS.printerAddress, /^192\.0\.2\.\d+$/);
  assert(mock.MOCK_FEED_POSTS.every((post) => /^(작가|데모 작가)\d+$/.test(post.author)));
  assert(mock.MOCK_PRINT_STATUS_LIST.every((task) => task.userId === mock.MOCK_ACCOUNT_PROFILE.id));
  console.log("PASS public demo profiles, authors and printer address use synthetic fixtures");
  mock.resetMockData("EMPTY");
  assert.equal(await print.getCurrentPrintTask(), null);
  const created = await print.createPrintTask("화분 받침 트레이");
  assert.equal(created.status, "PRINTING");
  assert.equal(created.progress, 0);
  assert.equal(created.artworkName, "화분 받침 트레이");
  assert.equal(created.userId, print.PRINT_USER_ID);
  for (let read = 0; read < 3; read += 1) {
    const current = await print.getCurrentPrintTask();
    assert.equal(current.id, created.id);
    assert.equal(current.status, "PRINTING");
    assert.equal(current.progress, created.progress, "Mock progress must remain static");
  }
  await print.cancelPrintTask(created.id);
  const cancelled = await print.getCurrentPrintTask();
  assert.equal(cancelled.id, created.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert(cancelled.failureReason && cancelled.stoppedAt);
  const retried = await print.retryPrintTask(cancelled);
  assert.notEqual(retried.id, cancelled.id);
  assert.equal(retried.artworkName, cancelled.artworkName);
  assert.equal(retried.status, "PRINTING");
  assert.equal(retried.progress, 0);
  console.log("PASS mock create/read/cancel/retry (static progress, retained CANCELLED)");

  for (const status of ["PRINTING", "COMPLETED", "FAILED", "ERROR", "CANCELLED", "CANCELED"]) {
    mock.resetMockData(status);
    const task = await print.getCurrentPrintTask();
    assert.equal(task.status, status);
    if (status === "COMPLETED") assert.equal(task.progress, 100);
    if (["FAILED", "ERROR", "CANCELLED", "CANCELED"].includes(status)) {
      assert(task.failureReason && task.stoppedAt);
      const next = await print.retryPrintTask(task);
      assert.notEqual(next.id, task.id);
      assert.equal(next.artworkName, task.artworkName);
      assert.equal(next.status, "PRINTING");
    }
  }
  console.log("PASS mock completed/failed/error/cancelled scenarios");

  for (const [action, status, operation] of [
    ["print-create", "EMPTY", () => print.createPrintTask()],
    ["print-cancel", "PRINTING", (task) => print.cancelPrintTask(task.id)],
    ["print-retry", "FAILED", (task) => print.retryPrintTask(task)],
  ]) {
    mock.resetMockData(status);
    const before = await print.getCurrentPrintTask();
    window.location.search = "?mockError=" + action;
    await assert.rejects(() => operation(before), new RegExp("Mock failure: " + action));
    window.location.search = "";
    assert.deepEqual(await print.getCurrentPrintTask(), before, action + " mutated the task");
  }
  assert.equal(fetchCount, 0);
  console.log("PASS mock operation failures preserve state; HTTP requests=0");
}

async function verifyApiAdapter() {
  const pending = [];
  const { print, mock, window } = await loadPrintRuntime({
    baseUrl: "http://print-contract.invalid",
    fetchImpl: async (url, options) => {
      const expected = pending.shift();
      assert(expected, "Unexpected request: " + options.method + " " + url);
      const path = new URL(url).pathname;
      assert.equal(options.method, expected.method);
      assert.equal(path, expected.path);
      assert.equal(options.body, undefined);
      const status = expected.status ?? 200;
      requests.push({ method: options.method, path, status });
      return new Response(status === 204 ? null : JSON.stringify(expected.body), {
        status, headers: { "Content-Type": "application/json" },
      });
    },
  });
  const responseTask = {
    ...mock.MOCK_PRINT_STATUS_LIST[0], id: 7101, artworkName: "API contract artwork", progress: 0,
  };
  pending.push({ method: "GET", path: "/api/prints/current", body: null });
  assert.equal(await print.getCurrentPrintTask(), null);

  for (const status of ["PRINTING", "COMPLETED", "FAILED", "ERROR", "CANCELLED", "CANCELED", "EMPTY"]) {
    const body = { ...responseTask, id: "7101", status, progress: status === "COMPLETED" ? 100 : 38 };
    pending.push({ method: "GET", path: "/api/prints/current", body });
    const task = await print.getCurrentPrintTask();
    assert.equal(task.status, status);
    assert.equal(task.id, 7101);
    assert.equal(task.progress, body.progress);
  }
  const cancelled = { ...responseTask, status: "CANCELLED", failureReason: "User cancelled", stoppedAt: "14:02" };
  pending.push({ method: "GET", path: "/api/prints/current", body: { data: cancelled } });
  const current = await print.getCurrentPrintTask();
  assert.equal(current.status, "CANCELLED");
  assert.equal(current.failureReason, cancelled.failureReason);
  pending.push({ method: "GET", path: "/api/prints/current", body: { id: 7101, status: "PRINTING" } });
  const unnamed = await print.getCurrentPrintTask();
  assert.equal(unnamed.artworkName, "디자인 이름 확인 불가");
  assert.equal(unnamed.modelUrl, undefined);
  pending.push({ method: "GET", path: "/api/prints/current", status: 204 });
  assert.equal(await print.getCurrentPrintTask(), null);
  console.log("PASS API adapter reads current print status and handles empty responses");

  // HTTP errors must propagate even when URL parameters ask for a mock scenario.
  window.location.search = "?mockPrintStatus=PRINTING&mockError=print-create,print-cancel,print-retry";
  mock.resetMockData("EMPTY");
  for (const status of [401, 403, 404, 500]) {
    pending.push({ method: "GET", path: "/api/prints/current", status, body: { message: "Expected failure" } });
    await assert.rejects(() => print.getCurrentPrintTask(), (error) => error.status === status);
    assert.equal(await mock.fetchMockPrintStatus(), null);
  }
  assert.equal(pending.length, 0, "Not all expected requests were sent");
  console.log("PASS API HTTP errors propagate without mock fallback");
}

async function verifyTransportIsolation() {
  let checks = 0;
  const json = (body, status = 200) => new Response(JSON.stringify(body), {
    status, headers: { "Content-Type": "application/json" },
  });
  // These are injected responses, never real authentication or printer requests.
  for (const nodeEnv of ["development", "production"]) {
    let respond;
    let mockCalls = 0;
    let fetchCalls = 0;
    const runtime = await loadPrintRuntime({
      nodeEnv, baseUrl: "https://api-contract.invalid/",
      fetchImpl: async (url, options) => {
        fetchCalls += 1;
        assert.equal(url, "https://api-contract.invalid/api/prints/current");
        return respond(options);
      },
    });
    const { api: { apiClient, ApiError }, mock, print, window } = runtime;
    const path = "/api/prints/current";
    const call = () => mock.withMockFallback(
      () => apiClient.get(path), () => { mockCalls += 1; return "unexpected mock success"; },
    );
    const removed = [];
    const events = [];
    const redirects = [];
    window.localStorage.getItem = (key) => key === "piston-access-token" ? "test-token-not-a-credential" : null;
    window.localStorage.removeItem = (key) => removed.push(key);
    window.dispatchEvent = (event) => events.push(event.type);
    window.location.assign = (url) => redirects.push(url);

    respond = (options) => {
      assert.equal(options.headers.get("Authorization"), "Bearer test-token-not-a-credential");
      return json({ data: null });
    };
    assert.equal((await call()).data, null);
    checks += 1;
    respond = (options) => {
      assert.equal(options.headers.has("Authorization"), false);
      assert.equal("decode" in options, false);
      return json({ data: null });
    };
    const decode = (data) => {
      if (!data || typeof data !== "object" || data.data !== null) throw new Error("invalid fixture");
      return null;
    };
    assert.equal(await apiClient.get(path, { skipAuth: true, decode }), null);
    checks += 1;

    for (const status of [400, 401, 404, 500]) {
      for (const malformed of [false, true]) {
        respond = () => malformed
          ? new Response("{broken-json", { status, headers: { "Content-Type": "application/json" } })
          : json({ message: "failure fixture" }, status);
        await assert.rejects(call, (error) => error instanceof ApiError && error.status === status && error.kind === "http");
        checks += 1;
      }
    }
    assert.deepEqual(removed, ["piston-api-session", "piston-access-token", "piston-auth", "piston-api-session", "piston-access-token", "piston-auth"]);
    assert.deepEqual(events, ["piston-auth-expired", "piston-auth-expired"]);
    assert.deepEqual(redirects, ["https://frontend.invalid/login", "https://frontend.invalid/login"]);
    for (const message of ["Network disconnected", "Failed to fetch (simulated CORS rejection)"]) {
      respond = () => { throw new TypeError(message); };
      await assert.rejects(call, (error) => error instanceof ApiError && error.status === 0 && error.kind === "network" && error.data === null);
      checks += 1;
    }
    respond = () => new Response("{broken-json", { headers: { "Content-Type": "application/json" } });
    await assert.rejects(call, (error) => error instanceof ApiError && error.kind === "response");
    checks += 1;
    for (const body of [{}, { data: {} }, [], "proxy HTML", { id: 1, status: "UNKNOWN" }]) {
      respond = () => json(body);
      await assert.rejects(() => print.getCurrentPrintTask(), /응답 형식/);
      await assert.rejects(() => apiClient.get(path, { decode }), (error) => error instanceof ApiError && error.kind === "response");
      checks += 2;
    }
    for (const body of [null, { data: null }]) {
      respond = () => json(body);
      assert.equal(await print.getCurrentPrintTask(), null);
      checks += 1;
    }
    respond = () => new Response(null, { status: 204 });
    assert.equal(await print.getCurrentPrintTask(), null);
    checks += 1;
    const abort = new DOMException("Cancelled", "AbortError");
    const controller = new AbortController();
    controller.abort(abort);
    const beforeAbort = fetchCalls;
    respond = () => { throw new Error("A pre-aborted request must not reach fetch"); };
    await assert.rejects(() => apiClient.get(path, { signal: controller.signal }), (error) => error === abort);
    assert.equal(fetchCalls, beforeAbort);
    checks += 2;
    const bodyController = new AbortController();
    respond = () => ({
      status: 200, ok: true, headers: new Headers({ "Content-Type": "application/json" }),
      json: async () => { bodyController.abort(); throw abort; },
    });
    await assert.rejects(() => apiClient.get(path, { signal: bodyController.signal }), (error) => error === abort);
    checks += 1;
    assert(fetchCalls > 0);
    assert.equal(mockCalls, 0, "API mode must never execute a fallback");

    const explicitMock = await loadPrintRuntime({
      nodeEnv, mock: true,
      fetchImpl: () => { throw new Error("Explicit Mock mode must not call HTTP"); },
    });
    const task = await explicitMock.print.createPrintTask("Isolated Mock fixture");
    assert.equal((await explicitMock.print.getCurrentPrintTask()).id, task.id);
    checks += 1;
  }
  console.log(`PASS API transport/mode isolation: ${checks} assertions (development + production); real HTTP=0`);
}

async function verifyLiveApi(baseUrl) {
  assert(baseUrl, "--api requires PISTON_API_BASE_URL pointing to a test backend");
  const { print } = await loadPrintRuntime({
    baseUrl,
    fetchImpl: async (url, options) => {
      const response = await fetch(url, { ...options, signal: AbortSignal.timeout(10000) });
      requests.push({ method: options.method, path: new URL(url).pathname, status: response.status });
      return response;
    },
  });
  await print.getCurrentPrintTask();
  console.log("PASS live API read-only print status");
}

async function main() {
  for (const arg of args) {
    assert(["--mock", "--api", "--contract-only"].includes(arg), "Unknown option: " + arg);
  }
  assert(!(args.has("--api") && args.has("--mock")), "Choose either --api or --mock");
  await verifyFrontendContracts();
  if (args.has("--contract-only")) return;
  if (args.has("--api")) {
    await verifyLiveApi(process.env.PISTON_API_BASE_URL);
  } else {
    const safetyChecks = await Promise.allSettled([verifyApiMutationSafety(), verifyMyPageSafety()]);
    const failures = safetyChecks.filter((check) => check.status === "rejected");
    assert.equal(failures.length, 0, failures.map(({ reason }) => reason.stack).join("\n"));
    await verifyMyPageSafety(true);
    await verifyMockLifecycle();
    await verifyApiAdapter();
    await verifyTransportIsolation();
  }
  console.log("PASS print lifecycle verification; HTTP contract requests=" + requests.length);
}

main().catch((error) => {
  console.error("FAIL " + (error instanceof Error ? error.message : String(error)));
  if (requests.length > 0) {
    console.error("Requests: " + requests.map(({ method, path, status }) => method + " " + path + "=" + status).join(", "));
  }
  process.exitCode = 1;
});
