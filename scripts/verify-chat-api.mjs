import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseUrl = "https://chat-contract.invalid";
const path = "/chats/messages";
const sent = { chatId: "chat-1", jobId: null, reply: "Synthetic reply" };
const chat = {
  chatId: "chat-1", role: "USER", message: "Synthetic message",
  imageUrl: null, jobId: null, createdAt: "2026-11-22T03:00:00Z",
};
const emptyPage = { hasNext: false, nextCursor: null, chats: [] };

function harness(respond = async () => assert.fail("Unexpected fetch")) {
  const requests = [];
  const events = [];
  const redirects = [];
  const storage = new Map([["piston-access-token", "synthetic-access-token"], ["piston-auth", "synthetic-session"]]);
  const context = createContext({
    AbortSignal, Event,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: baseUrl } },
    Headers, FormData, File, Blob, URLSearchParams, ArrayBuffer,
    window: {
      navigator: { locks: createAuthLocks() },
      localStorage: { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) },
      location: { origin: "https://frontend.invalid", pathname: "/create", assign: (url) => redirects.push(url) },
      dispatchEvent: (event) => events.push(event.type),
    },
    async fetch(url, init) {
      const request = { url: new URL(url), ...init };
      requests.push(request);
      assert.equal(request.url.origin, baseUrl);
      assert.equal(request.url.pathname, path, "Only the chat messages endpoint is allowed");
      assert.ok(["GET", "POST"].includes(init.method));
      return respond(request);
    },
  });
  const modules = new Map();

  function load(target) {
    const file = [target + ".ts", resolve(target, "index.ts")].find(existsSync);
    assert.ok(file, "Unresolved source module: " + target);
    if (modules.has(file)) return modules.get(file).exports;
    const loadedModule = { exports: {} };
    modules.set(file, loadedModule);
    const source = ts.transpileModule(readFileSync(file, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
      fileName: file,
    }).outputText;
    const require = (name) => {
      assert.ok(name.startsWith("@/") || name.startsWith("."), "Unexpected import: " + name);
      const dependency = name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name);
      return load(dependency);
    };
    new Script("(function(require, module, exports) {\n" + source + "\n})", { filename: file })
      .runInContext(context)(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }

  const fromSource = (name) => load(resolve(root, "src", name));
  return {
    ...fromSource("features/send-chat-message"), ...fromSource("entities/chat"), ...fromSource("shared/api"),
    requests, storage, events, redirects,
  };
}

function inputError(h, field) {
  return (error) => error instanceof h.ChatInputError && error.field === field;
}

function apiError(h, kind, status) {
  return (error) => error instanceof h.ApiError && error.kind === kind && error.status === status;
}

test("loading the public chat APIs sends no requests", () => {
  const h = harness();
  assert.equal(typeof h.sendChatMessage, "function");
  assert.equal(typeof h.getChatHistory, "function");
  assert.equal(h.requests.length, 0);
});

test("send makes an authenticated POST with only the original message", async () => {
  const h = harness(() => Response.json({ ...sent, extra: "omit unknown fields" }, { status: 201 }));
  const message = "  A synthetic message.  ";
  assert.deepEqual(structuredClone(await h.sendChatMessage({ message })), sent);
  assert.equal(h.requests.length, 1);
  const [request] = h.requests;
  assert.equal(request.method, "POST");
  assert.equal(request.url.href, baseUrl + path);
  assert.equal(request.headers.get("Authorization"), "Bearer synthetic-access-token");
  assert.ok(request.body instanceof FormData);
  assert.deepEqual(Array.from(request.body), [["message", message]]);
  assert.equal(request.redirect, "error", "The transport must not replay a paid POST on a redirect");
});

test("multipart leaves the header to fetch, which produces a matching boundary", async () => {
  const image = new File(["synthetic content"], "preview.png", { type: "image/png" });
  const h = harness(async (options) => {
    assert.equal(options.headers.has("Content-Type"), false);
    assert.equal(options.body.get("image"), image);
    const request = new Request(options.url, options);
    assert.match(request.headers.get("Content-Type"), /^multipart\/form-data;\s*boundary=\S+/i);
    const body = await request.formData();
    assert.deepEqual(Array.from(body.keys()), ["message", "image"]);
    assert.equal(body.get("message"), "A sample");
    const uploaded = body.get("image");
    assert.equal(uploaded.name, "preview.png");
    assert.equal(uploaded.type, "image/png");
    assert.equal(await uploaded.text(), "synthetic content");
    return Response.json(sent);
  });
  await h.sendChatMessage({ message: "A sample", image });
});

test("JPEG, PNG, WebP and the 10 MiB edge are accepted", async () => {
  const h = harness(() => Response.json(sent));
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    const image = new File(["synthetic"], "preview", { type });
    await h.sendChatMessage({ message: "A sample", image });
  }
  const image = new File([new Uint8Array(10 * 1024 * 1024)], "limit.webp", { type: "image/webp" });
  await h.sendChatMessage({ message: "A sample", image });
  assert.equal(h.requests.length, 4);
  assert.equal(h.requests.at(-1).body.get("image").size, 10 * 1024 * 1024);
});

test("unsupported image types, non-File values and oversized images fail before fetch", async () => {
  const h = harness();
  const png = new File(["synthetic"], "preview.png", { type: "image/png" });
  const images = [
    null, "preview.png", [png], new Blob(["synthetic"], { type: "image/png" }),
    new File(["synthetic"], "preview.gif", { type: "image/gif" }),
    new File(["synthetic"], "preview.png"),
    new File([new Uint8Array(10 * 1024 * 1024 + 1)], "oversized.png", { type: "image/png" }),
  ];
  for (const image of images) {
    await assert.rejects(h.sendChatMessage({ message: "A sample", image }), inputError(h, "image"));
  }
  assert.equal(h.requests.length, 0);
});

test("invalid or whitespace-only messages fail before fetch", async () => {
  const h = harness();
  for (const message of [undefined, null, 24, "", " \n\t"]) {
    await assert.rejects(h.sendChatMessage({ message }), inputError(h, "message"));
  }
  assert.equal(h.requests.length, 0);
});

test("send treats job IDs, broken JSON, and unexpected reply fields as response errors", async () => {
  const malformed = [
    Response.json({ ...sent, jobId: "unexpected-job" }),
    Response.json({ chatId: sent.chatId, reply: sent.reply }),
    Response.json({ ...sent, chatId: 4 }),
    Response.json({ ...sent, reply: null }),
    Response.json(null),
    new Response("{broken", { headers: { "Content-Type": "application/json" } }),
    new Response(null, { status: 204 }),
  ];
  for (const response of malformed) {
    const h = harness(() => response);
    await assert.rejects(h.sendChatMessage({ message: "A sample" }), apiError(h, "response", response.status));
    assert.equal(h.requests.length, 1);
  }
});

test("history with omitted options requests the server default page and carries Bearer auth", async () => {
  const h = harness(() => Response.json(emptyPage));
  assert.deepEqual(structuredClone(await h.getChatHistory()), emptyPage);
  assert.equal(h.requests.length, 1);
  const [request] = h.requests;
  assert.equal(request.method, "GET");
  assert.equal(request.url.href, baseUrl + path);
  assert.equal(request.headers.get("Authorization"), "Bearer synthetic-access-token");
  assert.equal(request.headers.has("Content-Type"), false);
  assert.equal(request.body, undefined);
});

test("history encodes the opaque cursor, preserves order and requires explicit pagination", async () => {
  const cursor = "opaque /+=?&# 한글";
  const second = {
    ...chat, chatId: "chat-2", role: "ASSISTANT", message: "Synthetic reply",
    imageUrl: "/fixture.webp", jobId: "historical-job", createdAt: "2026-11-22T12:00:01.123456789+09:00",
  };
  const page = { hasNext: true, nextCursor: cursor, chats: [chat, second] };
  const h = harness(() => Response.json(h.requests.length === 1 ? page : emptyPage));
  const first = await h.getChatHistory({ size: 1 });
  assert.deepEqual(structuredClone(first), page);
  assert.equal(h.requests.length, 1, "The next page must be explicitly requested");
  assert.equal(h.requests[0].url.searchParams.get("size"), "1");
  await h.getChatHistory({ cursor: first.nextCursor, size: 100 });
  assert.equal(h.requests.length, 2);
  assert.deepEqual(Array.from(h.requests[1].url.searchParams), [["cursor", cursor], ["size", "100"]]);
  assert.ok(h.requests[1].url.search.includes("%26%23"));
});

test("invalid cursors and sizes never reach fetch", async () => {
  const h = harness();
  for (const cursor of [null, "", " \t", 42, []]) {
    await assert.rejects(h.getChatHistory({ cursor }), inputError(h, "cursor"));
  }
  for (const size of [null, "30", 0, -1, 1.5, 101, NaN, Infinity]) {
    await assert.rejects(h.getChatHistory({ size }), inputError(h, "size"));
  }
  assert.equal(h.requests.length, 0);
});

test("history validates the page and every record before exposing data", async () => {
  const malformed = [
    { hasNext: "true", nextCursor: null, chats: [] },
    { hasNext: false, nextCursor: 1, chats: [] },
    { hasNext: false, chats: [] },
    { ...emptyPage, chats: {} },
    { ...emptyPage, chats: [chat, null] },
    { ...emptyPage, chats: [{ ...chat, role: "SYSTEM" }] },
    { ...emptyPage, chats: [{ ...chat, imageUrl: {} }] },
    { ...emptyPage, chats: [{ ...chat, jobId: 7 }] },
    { ...emptyPage, chats: [{ ...chat, createdAt: "tomorrow" }] },
    { ...emptyPage, chats: [{ ...chat, createdAt: "2026-02-30T03:00:00Z" }] },
    { ...emptyPage, chats: [{ ...chat, message: 7 }] },
    { ...emptyPage, chats: [{ ...chat, chatId: null }] },
  ];
  for (const page of malformed) {
    const h = harness(() => Response.json(page));
    await assert.rejects(h.getChatHistory(), apiError(h, "response", 200));
  }
  const h = harness(() => Response.json({
    ...emptyPage, chats: [{ ...chat, createdAt: "2026-11-22T12:34:56.123456", userId: "omit unknown fields" }],
  }));
  const result = await h.getChatHistory();
  assert.equal(result.chats[0].createdAt, "2026-11-22T12:34:56.123456");
  assert.equal("userId" in result.chats[0], false);
});

test("an already aborted signal avoids even a transport attempt", async () => {
  const h = harness();
  const signal = AbortSignal.abort();
  const isSameAbort = (error) => error === signal.reason && error.name === "AbortError";
  await assert.rejects(h.sendChatMessage({ message: "A sample" }, { signal }), isSameAbort);
  await assert.rejects(h.getChatHistory({ signal }), isSameAbort);
  assert.equal(h.requests.length, 0);
});

test("both methods forward AbortSignal and preserve abort errors without retries", async () => {
  for (const method of ["GET", "POST"]) {
    const controller = new AbortController();
    let started;
    const inTransport = new Promise((resolve) => { started = resolve; });
    const h = harness(({ signal }) => new Promise((_, reject) => {
      assert.equal(signal, controller.signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      started();
    }));
    const request = method === "GET"
      ? h.getChatHistory({ signal: controller.signal })
      : h.sendChatMessage({ message: "A sample" }, { signal: controller.signal });
    await inTransport;
    assert.equal(h.requests.length, 1);
    controller.abort();
    await assert.rejects(request, (error) => error === controller.signal.reason);
    assert.equal(h.requests.length, 1);
  }
});

test("401 uses the existing auth expiration handling with no request replay", async () => {
  for (const method of ["GET", "POST"]) {
    const h = harness(() => new Response("{broken", { status: 401, headers: { "Content-Type": "application/json" } }));
    const request = method === "GET" ? h.getChatHistory() : h.sendChatMessage({ message: "A sample" });
    await assert.rejects(request, apiError(h, "http", 401));
    assert.equal(h.requests.length, 1);
    assert.equal(h.storage.size, 0);
    assert.deepEqual(h.events, ["piston-auth-expired"]);
    assert.deepEqual(h.redirects, ["https://frontend.invalid/login"]);
  }
});

test("both methods preserve network and HTTP error classifications without retries", async () => {
  const failures = [
    { kind: "network", status: 0, respond() { throw new TypeError("Synthetic network failure"); } },
    { kind: "http", status: 429, respond: () => Response.json({ message: "Synthetic busy error" }, { status: 429 }) },
    { kind: "http", status: 500, respond: () => Response.json({ message: "Synthetic server error" }, { status: 500 }) },
  ];
  for (const method of ["GET", "POST"]) {
    for (const { respond, kind, status } of failures) {
      const h = harness(respond);
      const request = method === "GET" ? h.getChatHistory() : h.sendChatMessage({ message: "A sample" });
      await assert.rejects(request, apiError(h, kind, status));
      assert.equal(h.requests.length, 1);
      assert.equal(h.storage.size, 2);
    }
  }
});
