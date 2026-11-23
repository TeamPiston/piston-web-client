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
async function loadPrintRuntime({ mock = false, baseUrl = "", nodeEnv = "production", fetchImpl }) {
  const paths = [
    "src/entities/print/model/print.ts",
    "src/shared/mock/mock-data.ts",
    "src/shared/api/index.ts",
    "src/shared/api/client.ts",
    "src/shared/api/auth.ts",
  ];
  const sources = new Map(await Promise.all(paths.map(async (path) => [
    resolve(ROOT_DIR, path),
    ts.transpileModule(await readFile(resolve(ROOT_DIR, path), "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
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
    window, fetch: fetchImpl, Headers, FormData, Blob, URLSearchParams, ArrayBuffer,
  });
  const modules = new Map();
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    assert(sources.has(path), "Unexpected module: " + path);
    const loadedModule = { exports: {} };
    modules.set(path, loadedModule);
    const requireSource = (specifier) => {
      const target = specifier.startsWith("@/")
        ? resolve(ROOT_DIR, "src", specifier.slice(2))
        : resolve(dirname(path), specifier);
      return load(sources.has(target + ".ts") ? target + ".ts" : resolve(target, "index.ts"));
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
    window,
  };
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
    'disabled={!isGenerated || isPrintBlocked || isPrintCheckFailed || isPrintStatusChecking}',
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
      if (expected.requestBody) {
        assert.deepEqual(JSON.parse(options.body), expected.requestBody);
        assert.equal(options.headers.get("Content-Type"), "application/json");
      }
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
  const requestBody = { artworkName: responseTask.artworkName };
  pending.push({ method: "GET", path: "/api/prints/current", body: null });
  assert.equal(await print.getCurrentPrintTask(), null);
  pending.push({ method: "POST", path: "/api/prints", status: 201, body: { data: responseTask }, requestBody });
  const created = await print.createPrintTask(responseTask.artworkName);
  assert.equal(created.id, responseTask.id);
  assert.equal(created.status, "PRINTING");

  for (const status of ["PRINTING", "COMPLETED", "FAILED", "ERROR", "CANCELLED", "CANCELED", "EMPTY"]) {
    const body = { ...responseTask, id: "7101", status, progress: status === "COMPLETED" ? 100 : 38 };
    pending.push({ method: "GET", path: "/api/prints/current", body });
    const task = await print.getCurrentPrintTask();
    assert.equal(task.status, status);
    assert.equal(task.id, 7101);
    assert.equal(task.progress, body.progress);
  }
  const cancelled = { ...responseTask, status: "CANCELLED", failureReason: "User cancelled", stoppedAt: "14:02" };
  pending.push({ method: "DELETE", path: "/api/prints/" + created.id, status: 204 });
  await print.cancelPrintTask(created.id);
  pending.push({ method: "GET", path: "/api/prints/current", body: { data: cancelled } });
  const current = await print.getCurrentPrintTask();
  assert.equal(current.status, "CANCELLED");
  assert.equal(current.failureReason, cancelled.failureReason);
  pending.push({ method: "POST", path: "/api/prints", body: { ...responseTask, id: 7102 }, requestBody });
  const retried = await print.retryPrintTask(current);
  assert.equal(retried.status, "PRINTING");
  assert.equal(retried.artworkName, current.artworkName);
  assert.notEqual(retried.id, created.id);
  pending.push({ method: "GET", path: "/api/prints/current", status: 204 });
  assert.equal(await print.getCurrentPrintTask(), null);
  console.log("PASS API adapter POST/GET/DELETE by ID; retry uses POST /api/prints");

  // HTTP errors must propagate even when URL parameters ask for a mock scenario.
  window.location.search = "?mockPrintStatus=PRINTING&mockError=print-create,print-cancel,print-retry";
  mock.resetMockData("EMPTY");
  for (const [method, path, status, operation] of [
    ["POST", "/api/prints", 401, () => print.createPrintTask()],
    ["GET", "/api/prints/current", 404, () => print.getCurrentPrintTask()],
    ["DELETE", "/api/prints/" + created.id, 403, () => print.cancelPrintTask(created.id)],
    ["POST", "/api/prints", 500, () => print.retryPrintTask(current)],
  ]) {
    pending.push({ method, path, status, body: { message: "Expected failure" } });
    await assert.rejects(operation, (error) => error.status === status);
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
  const initial = await print.getCurrentPrintTask();
  assert(initial === null || initial.status === "EMPTY", "Test backend must start with no current task");
  let activeTask;
  try {
    activeTask = await print.createPrintTask();
    assert.equal(activeTask.status, "PRINTING");
    const current = await print.getCurrentPrintTask();
    assert.equal(current?.id, activeTask.id);
    const previousTask = activeTask;
    await print.cancelPrintTask(activeTask.id);
    activeTask = null;
    const cancelled = await print.getCurrentPrintTask();
    assert(cancelled === null || ["EMPTY", "CANCELLED", "CANCELED"].includes(cancelled.status));
    activeTask = await print.retryPrintTask(previousTask);
    assert.equal(activeTask.status, "PRINTING");
    assert.equal(activeTask.artworkName, previousTask.artworkName);
    assert.notEqual(activeTask.id, previousTask.id);
  } finally {
    if (activeTask) await print.cancelPrintTask(activeTask.id);
  }
  console.log("PASS live API create/read/cancel/retry");
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
