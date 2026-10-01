#!/usr/bin/env node

import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { setTimeout as sleep } from "node:timers/promises";

const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_BASE_URL = "https://piston.https.gsmsv.site";
const USER_ID = "dlskawls";
const ARTWORK_NAME = "육각형 연필꽂이";
const COMPLETION_MESSAGE = "오늘 15:12 완료 · 프린터에서 꺼내 주세요";
const args = new Set(process.argv.slice(2));
const useMockServer = args.has("--mock");
const contractOnly = args.has("--contract-only");
const pollIntervalMs = Number(
  process.env.PRINT_POLL_INTERVAL_MS ?? (useMockServer ? 50 : 3000),
);
const maxWaitMs = Number(process.env.PRINT_MAX_WAIT_MS ?? (useMockServer ? 2000 : 45000));

const requests = [];

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function unwrapTask(value) {
  if (value && typeof value === "object" && "data" in value) {
    return value.data;
  }

  return value;
}

function asTask(value) {
  const task = unwrapTask(value);

  if (task === null || task === undefined) {
    return null;
  }

  assert(task && typeof task === "object", "출력 상태 응답이 객체가 아닙니다.");
  assert(
    ["PRINTING", "COMPLETED", "EMPTY"].includes(task.status),
    `알 수 없는 출력 상태입니다: ${String(task.status)}`,
  );
  assert(Number.isFinite(Number(task.progress)), "progress가 숫자가 아닙니다.");

  return {
    ...task,
    progress: Number(task.progress),
  };
}

async function request(baseUrl, path, options = {}) {
  const method = options.method ?? "GET";
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    signal: AbortSignal.timeout(10000),
    headers: {
      Accept: "application/json",
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  const text = await response.text();
  let body = null;

  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  requests.push({ method, path, status: response.status });
  return { body, status: response.status };
}

function assertStatus(response, expectedStatuses, label) {
  assert(
    expectedStatuses.includes(response.status),
    `${label}: HTTP ${response.status}, 응답=${JSON.stringify(response.body)}`,
  );
}

async function verifyFrontendContracts() {
  const [createSource, printEntitySource, myPageSource] = await Promise.all([
    readFile(resolve(ROOT_DIR, "src/page-slices/create/ui/create-workspace.tsx"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/entities/print/model/print.ts"), "utf8"),
    readFile(resolve(ROOT_DIR, "src/page-slices/mypage/ui/mypage-page.tsx"), "utf8"),
  ]);

  assert(createSource.includes("createPrintTask()"), "Create: 출력 시작 API 호출이 없습니다.");
  assert(
    createSource.includes('setPrintSuccessPhase("visible")'),
    "Create: API 성공 후 출력 시작 오버레이 상태 전환이 없습니다.",
  );
  assert(
    createSource.includes('setPrintSuccessPhase("fading"), 3500'),
    "Create: 3.5초 Fade-out 타이머가 없습니다.",
  );
  assert(
    createSource.includes('setPrintSuccessPhase("hidden"), 4000'),
    "Create: 오버레이 종료 타이머가 없습니다.",
  );
  assert(
    createSource.includes("출력이 시작되었습니다.") &&
      createSource.includes("마이페이지에서 출력 상황을 확인해 주세요!"),
    "Create: 출력 시작 성공 오버레이 문구가 없습니다.",
  );
  assert(
    printEntitySource.includes('"/api/prints"') &&
      printEntitySource.includes('"/api/prints/current"'),
    "Print API: 필수 엔드포인트가 없습니다.",
  );
  assert(
    /setInterval\(\(\) => \{[\s\S]*?loadCurrentPrint\(\)[\s\S]*?\}, 3000\)/.test(
      myPageSource,
    ),
    "MyPage: 3초 폴링 설정이 없습니다.",
  );
  assert(
    myPageSource.includes("clearInterval(pollingId)"),
    "MyPage: 폴링 타이머 해제가 없습니다.",
  );
  assert(
    myPageSource.includes('printTask?.status !== "PRINTING"'),
    "MyPage: PRINTING 상태에서만 폴링하는 조건이 없습니다.",
  );
  assert(
    myPageSource.includes('printTask.status === "EMPTY"') &&
      myPageSource.includes('href="/create"') &&
      myPageSource.includes('href="/feed"'),
    "MyPage: EMPTY 상태 및 Create/Feed 링크가 없습니다.",
  );

  console.log("PASS frontend contract checks");
}

async function runApiLifecycle(baseUrl) {
  const reset = await request(baseUrl, "/api/prints/current", { method: "DELETE" });
  assertStatus(reset, [200, 204, 404], "사전 출력 데이터 정리");

  const create = await request(baseUrl, "/api/prints", {
    method: "POST",
    body: JSON.stringify({ userId: USER_ID, artworkName: ARTWORK_NAME }),
  });
  assertStatus(create, [200], "출력 시작 POST");

  let task = asTask(create.body);
  assert(task?.status === "PRINTING", "POST 응답이 PRINTING 상태가 아닙니다.");
  assert(task.userId === USER_ID, "POST 응답의 userId가 요청 사용자와 다릅니다.");
  assert(task.artworkName === ARTWORK_NAME, "POST 응답의 artworkName이 요청과 다릅니다.");

  const progressHistory = [task.progress];
  const deadline = Date.now() + maxWaitMs;

  while (task.status !== "COMPLETED") {
    assert(Date.now() < deadline, `완료 상태를 ${maxWaitMs}ms 안에 확인하지 못했습니다.`);
    await sleep(pollIntervalMs);

    const current = await request(baseUrl, "/api/prints/current");
    assertStatus(current, [200], "현재 출력 상태 조회");
    task = asTask(current.body);
    assert(task, "현재 출력 상태 응답이 비어 있습니다.");
    progressHistory.push(task.progress);
    assert(task.progress >= 0 && task.progress <= 100, "progress가 0~100 범위를 벗어났습니다.");
  }

  assert(progressHistory[0] === 0 || progressHistory[0] === 62, "초기 progress가 0% 또는 62%가 아닙니다.");
  assert(progressHistory.some((progress) => progress >= 62), "62% 이상 진행률을 확인하지 못했습니다.");
  assert(task.progress === 100, "완료 상태의 progress가 100이 아닙니다.");
  assert(task.estimatedEndTime === COMPLETION_MESSAGE, "완료 문구가 요구사항과 다릅니다.");
  console.log(`PASS API lifecycle progress=${progressHistory.join(" -> ")}`);

  const deletion = await request(baseUrl, "/api/prints/current", { method: "DELETE" });
  assertStatus(deletion, [200, 204], "현재 출력 데이터 삭제");

  const empty = await request(baseUrl, "/api/prints/current");
  assertStatus(empty, [200], "EMPTY 상태 조회");
  const emptyTask = asTask(empty.body);
  assert(emptyTask === null || emptyTask.status === "EMPTY", "삭제 후 EMPTY 상태가 아닙니다.");
  console.log("PASS EMPTY state after DELETE");
}

function startMockServer() {
  let task = null;
  let currentReads = 0;

  const server = createServer(async (requestMessage, responseMessage) => {
    const url = new URL(requestMessage.url, "http://localhost");

    const send = (status, body) => {
      responseMessage.writeHead(status, { "Content-Type": "application/json" });
      responseMessage.end(body === undefined ? "" : JSON.stringify(body));
    };

    if (url.pathname === "/api/prints" && requestMessage.method === "POST") {
      const requestBody = await readRequestBody(requestMessage);
      if (requestBody.userId !== USER_ID || requestBody.artworkName !== ARTWORK_NAME) {
        send(400, { message: "Unexpected print request body" });
        return;
      }

      task = {
        id: 1,
        userId: USER_ID,
        artworkName: ARTWORK_NAME,
        status: "PRINTING",
        progress: 0,
        remainingMinutes: 32,
        estimatedEndTime: "오늘 15:12 완료 예정",
        createdAt: new Date().toISOString(),
      };
      currentReads = 0;
      send(200, task);
      return;
    }

    if (url.pathname === "/api/prints/current" && requestMessage.method === "GET") {
      if (!task) {
        send(200, { status: "EMPTY", progress: 0 });
        return;
      }

      if (task.status === "PRINTING") {
        if (currentReads === 1) {
          task.progress = 62;
        } else if (currentReads >= 2) {
          task.progress = 100;
          task.status = "COMPLETED";
          task.estimatedEndTime = COMPLETION_MESSAGE;
        }
        currentReads += 1;
      }

      send(200, task);
      return;
    }

    if (url.pathname === "/api/prints/current" && requestMessage.method === "DELETE") {
      task = null;
      responseMessage.writeHead(204);
      responseMessage.end();
      return;
    }

    send(404, { message: "Not Found" });
  });

  return new Promise((resolveServer) => {
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      resolveServer({
        baseUrl: `http://127.0.0.1:${address.port}`,
        close: () => new Promise((resolveClose) => server.close(resolveClose)),
      });
    });
  });
}

async function readRequestBody(requestMessage) {
  const chunks = [];

  for await (const chunk of requestMessage) {
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function main() {
  await verifyFrontendContracts();

  if (contractOnly) {
    console.log("PASS contract-only verification");
    return;
  }

  let mockServer;
  try {
    if (useMockServer) {
      mockServer = await startMockServer();
    }

    const baseUrl = mockServer?.baseUrl ?? process.env.PISTON_API_BASE_URL ?? DEFAULT_BASE_URL;
    console.log(`Running print lifecycle against ${baseUrl}`);
    await runApiLifecycle(baseUrl);
    console.log(`PASS request count=${requests.length}`);
  } finally {
    await mockServer?.close();
  }
}

main().catch((error) => {
  console.error(`FAIL ${error instanceof Error ? error.message : String(error)}`);
  if (requests.length > 0) {
    console.error(`Requests: ${requests.map(({ method, path, status }) => `${method} ${path}=${status}`).join(", ")}`);
  }
  process.exitCode = 1;
});
