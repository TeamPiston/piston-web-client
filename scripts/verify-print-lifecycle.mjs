#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createContext, Script } from "node:vm";
import ts from "typescript";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const args = new Set(process.argv.slice(2));
const requests = [];

// Execute the real TS modules without a Next server or generated files.
async function loadPrintRuntime({ mock = false, baseUrl = "", fetchImpl }) {
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
    location: { search: "", pathname: "/mypage", assign() {} },
    localStorage: { getItem: () => null, removeItem() {} },
    dispatchEvent() {},
  };
  const context = createContext({
    process: { env: {
      NODE_ENV: "production",
      NEXT_PUBLIC_USE_MOCK: String(mock),
      NEXT_PUBLIC_API_BASE_URL: baseUrl,
    } },
    window, fetch: fetchImpl, Headers, FormData, Blob, URLSearchParams, ArrayBuffer, Event,
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
    window,
  };
}

async function verifyFrontendContracts() {
  const [createSource, previewSource, myPageSource] = await Promise.all([
    readFile(resolve(ROOT_DIR, "src/page-slices/create/ui/create-workspace.tsx"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/create/ui/components/preview-panel.tsx"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/mypage/ui/mypage-page.tsx"), "utf8"),
  ]);
  assert(createSource.includes("createPrintTask()"), "Create: missing print creation");
  for (const statement of [
    'setPrintSuccessPhase("visible")',
    'setPrintSuccessPhase("fading"), 3500',
    'setPrintSuccessPhase("hidden"), 4000',
  ]) {
    assert(createSource.includes(statement), "Create: missing success overlay contract: " + statement);
  }
  for (const statement of [
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
  const requestBody = { userId: print.PRINT_USER_ID, artworkName: responseTask.artworkName };
  pending.push({ method: "GET", path: "/api/prints/current", body: { data: null } });
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
