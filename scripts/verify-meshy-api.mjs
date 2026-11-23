import assert from "node:assert/strict";
import { createAuthLocks } from "./test-auth-locks.mjs";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { createContext, Script } from "node:vm";
import ts from "typescript";

const root = fileURLToPath(new URL("..", import.meta.url));
const baseUrl = "https://meshy-contract.invalid";
const textUrl = baseUrl + "/meshy/text-to-3d";
const imageUrl = baseUrl + "/meshy/image-to-3d";
const taskId = "task-42";
const taskUrl = baseUrl + "/meshy/tasks/" + taskId;
const escapedTaskId = "task /?#한글📦";
const escapedTaskUrl = baseUrl + "/meshy/tasks/" + encodeURIComponent(escapedTaskId);
const allowedRequests = new Map([[textUrl, "POST"], [imageUrl, "POST"], [taskUrl, "GET"], [escapedTaskUrl, "GET"]]);
const accepted = { taskId };
const acceptTask = () => Response.json(accepted, { status: 202 });
const model = { modelUrl: "https://storage-fixture.invalid/models/a.stl?signature=synthetic%2Bvalue" };
const prompt = "A synthetic model";
const image = new File(["synthetic"], "preview.png", { type: "image/png" });
const maxImageBytes = 10 * 1024 * 1024;

function harness(respond = () => assert.fail("Unexpected fetch")) {
  const requests = [];
  const events = [];
  const redirects = [];
  const storage = new Map([["piston-access-token", "synthetic-access-token"], ["piston-auth", "synthetic-session"]]);
  const context = createContext({
    AbortSignal, Event,
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: baseUrl } },
    Headers, FormData, File, Blob, URL, URLSearchParams, ArrayBuffer,
    window: {
      navigator: { locks: createAuthLocks() },
      localStorage: { getItem: (key) => storage.get(key) ?? null, removeItem: (key) => storage.delete(key) },
      location: { origin: "https://frontend.invalid", pathname: "/create", assign: (url) => redirects.push(url) },
      dispatchEvent: (event) => events.push(event.type),
    },
    async fetch(url, init) {
      const request = { url, ...init };
      requests.push(request);
      assert.ok(allowedRequests.has(url), "Blocked unexpected fetch URL: " + url);
      assert.equal(init.method, allowedRequests.get(url));
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
      return load(name.startsWith("@/") ? resolve(root, "src", name.slice(2)) : resolve(dirname(file), name));
    };
    new Script("(function(require, module, exports) {\n" + source + "\n})", { filename: file })
      .runInContext(context)(require, loadedModule, loadedModule.exports);
    return loadedModule.exports;
  }

  const fromSource = (name) => load(resolve(root, "src", name));
  return { ...fromSource("features/generate-3d-model"), ...fromSource("shared/api"), requests, storage, events, redirects };
}

const generate = [
  (h, options) => h.generateTextTo3D({ prompt }, options),
  (h, options) => h.generateImageTo3D({ image }, options),
];

function invalidInput(h, field) {
  return (error) => error instanceof h.ModelGenerationInputError && error.field === field;
}

function apiError(h, kind, status) {
  return (error) => error instanceof h.ApiError && error.kind === kind && error.status === status;
}

test("loading the public Meshy API makes no request", () => {
  assert.equal(harness().requests.length, 0);
});

test("text generation accepts 202 and POSTs only the original prompt as authenticated JSON", async () => {
  const h = harness(() => Response.json({ ...accepted, ...model, extra: "ignore fixture metadata" }, { status: 202 }));
  const originalPrompt = "  " + prompt.repeat(200) + " \n";
  const result = await h.generateTextTo3D({ prompt: originalPrompt, extra: "ignore input field" });
  assert.deepEqual(structuredClone(result), accepted);
  assert.equal(h.requests.length, 1);
  const [request] = h.requests;
  assert.equal(request.url, textUrl);
  assert.equal(request.method, "POST");
  assert.equal(request.headers.get("Authorization"), "Bearer synthetic-access-token");
  assert.equal(request.headers.get("Content-Type"), "application/json");
  assert.deepEqual(JSON.parse(request.body), { prompt: originalPrompt });
  assert.equal(request.redirect, "error");
});

test("image generation POSTs only the image with a fetch-generated multipart boundary", async () => {
  const h = harness(async (options) => {
    assert.equal(options.url, imageUrl);
    assert.equal(options.method, "POST");
    assert.equal(options.headers.get("Authorization"), "Bearer synthetic-access-token");
    assert.equal(options.headers.has("Content-Type"), false);
    assert.equal(options.redirect, "error");
    assert.ok(options.body instanceof FormData);
    assert.equal(options.body.get("image"), image);
    const request = new Request(options.url, options);
    assert.match(request.headers.get("Content-Type"), /^multipart\/form-data;\s*boundary=\S+/i);
    const body = await request.formData();
    assert.deepEqual(Array.from(body.keys()), ["image"]);
    const file = body.get("image");
    assert.equal(file.name, image.name);
    assert.equal(file.type, image.type);
    assert.equal(await file.text(), "synthetic");
    return acceptTask();
  });
  assert.deepEqual(structuredClone(await h.generateImageTo3D({ image })), accepted);
  assert.equal(h.requests.length, 1);
});

test("status GET encodes the task ID, uses Bearer auth, and drops pending result fields", async () => {
  const h = harness(() => Response.json({ taskId: escapedTaskId, status: "PENDING", ...model }));
  const controller = new AbortController();
  const result = await h.getMeshyTaskStatus(escapedTaskId, { signal: controller.signal });
  assert.deepEqual(structuredClone(result), { taskId: escapedTaskId, status: "PENDING" });
  assert.equal(h.requests.length, 1);
  const [request] = h.requests;
  assert.equal(request.url, escapedTaskUrl);
  assert.equal(request.method, "GET");
  assert.equal(request.body, undefined);
  assert.equal(request.headers.has("Content-Type"), false);
  assert.equal(request.headers.get("Authorization"), "Bearer synthetic-access-token");
  assert.equal(request.signal, controller.signal);
});

test("succeeded status preserves absolute and root-relative model URLs without downloading", async () => {
  for (const modelUrl of [model.modelUrl, "/models/example.stl"]) {
    const response = { taskId, status: "SUCCEEDED", modelUrl };
    const h = harness(() => Response.json(response));
    assert.deepEqual(structuredClone(await h.getMeshyTaskStatus(taskId)), response);
    assert.equal(h.requests.length, 1);
  }
});

test("failed status preserves the optional failure reason", async () => {
  for (const result of [{ taskId, status: "FAILED" }, { taskId, status: "FAILED", failureReason: "Synthetic failure" }]) {
    const h = harness(() => Response.json(result));
    assert.deepEqual(structuredClone(await h.getMeshyTaskStatus(taskId)), result);
    assert.equal(h.requests.length, 1);
  }
});

test("status GET rejects invalid task IDs before fetch", async () => {
  const h = harness();
  for (const invalid of [null, undefined, 42, "", " \n", ".", "..", "\ud800"]) {
    await assert.rejects(h.getMeshyTaskStatus(invalid), invalidInput(h, "taskId"));
  }
  assert.equal(h.requests.length, 0);
});

test("status GET rejects malformed tasks and unsafe or missing succeeded model URLs", async () => {
  const invalid = [
    null, [], { status: "PENDING" }, { taskId: "", status: "PENDING" }, { taskId: 42, status: "PENDING" },
    { taskId: "different-task", status: "PENDING" }, { taskId, status: "RUNNING" }, { taskId, status: "SUCCEEDED" },
    ...[null, 42, "", "  ", "javascript:alert(1)", "https://", "//storage-fixture.invalid/model.stl"].map(
      (modelUrl) => ({ taskId, status: "SUCCEEDED", modelUrl }),
    ),
    { taskId, status: "PENDING", modelUrl: "" },
    { taskId, status: "FAILED", failureReason: "" },
    { taskId, status: "FAILED", failureReason: 42 },
  ];
  for (const value of invalid) {
    const h = harness(() => Response.json(value));
    await assert.rejects(h.getMeshyTaskStatus(taskId), apiError(h, "response", 200));
    assert.equal(h.requests.length, 1);
  }
});

test("creation and subsequent status lookup require separate explicit calls", async () => {
  const h = harness(({ method }) => method === "POST" ? acceptTask() : Response.json({ taskId, status: "PENDING" }));
  const task = await h.generateTextTo3D({ prompt });
  await new Promise(setImmediate);
  assert.deepEqual(h.requests.map(({ method }) => method), ["POST"]);
  await h.getMeshyTaskStatus(task.taskId);
  await new Promise(setImmediate);
  assert.deepEqual(h.requests.map(({ method }) => method), ["POST", "GET"]);
});

test("409 with a task ID exposes it through an ApiError that can be followed by an explicit GET", async () => {
  for (const operation of generate) {
    const conflict = { statusCode: 409, message: "Synthetic conflict", taskId };
    const h = harness(({ method }) => method === "POST"
      ? Response.json(conflict, { status: 409 })
      : Response.json({ taskId, status: "PENDING" }));
    let existingId;
    await assert.rejects(operation(h), (error) => {
      existingId = error.taskId;
      assert.deepEqual(error.data, conflict);
      return error instanceof h.MeshyTaskConflictError && apiError(h, "http", 409)(error) && existingId === taskId;
    });
    assert.equal(h.requests.length, 1);
    await h.getMeshyTaskStatus(existingId);
    assert.deepEqual(h.requests.map(({ method }) => method), ["POST", "GET"]);
  }
});

test("409 with a null or malformed task ID makes no new request", async () => {
  for (const operation of generate) {
    for (const value of [null, "", " ", 42, undefined, "\ud800"]) {
      const h = harness(() => Response.json({ message: "Synthetic conflict", taskId: value }, { status: 409 }));
      await assert.rejects(operation(h), (error) => {
        assert.ok(apiError(h, "http", 409)(error));
        if (value === null) {
          assert.ok(error instanceof h.MeshyTaskConflictError);
          assert.equal(error.taskId, null);
        } else {
          assert.ok(!(error instanceof h.MeshyTaskConflictError));
        }
        return true;
      });
      await new Promise(setImmediate);
      assert.deepEqual(h.requests.map(({ method }) => method), ["POST"]);
    }
  }
});

test("blank and invalid prompts are rejected before fetch", async () => {
  const h = harness();
  for (const prompt of ["", " \n\t", null, undefined, 7]) {
    await assert.rejects(h.generateTextTo3D({ prompt }), invalidInput(h, "prompt"));
  }
  assert.equal(h.requests.length, 0);
});

test("JPEG, PNG, WebP and the exact 10 MiB boundary are accepted", async () => {
  const h = harness(acceptTask);
  for (const type of ["image/jpeg", "image/png", "image/webp"]) {
    await h.generateImageTo3D({ image: new File(["fixture"], "preview", { type }) });
  }
  const boundary = new File([new Uint8Array(maxImageBytes)], "boundary.webp", { type: "image/webp" });
  await h.generateImageTo3D({ image: boundary });
  assert.equal(h.requests.length, 4);
  assert.equal(h.requests.at(-1).body.get("image").size, maxImageBytes);
});

test("non-File values, unsupported MIME and 10 MiB plus one byte fail before fetch", async () => {
  const h = harness();
  for (const image of [
    undefined, null, "preview.png", new Blob(["fixture"], { type: "image/png" }),
    new File(["fixture"], "preview.gif", { type: "image/gif" }),
    new File(["fixture"], "preview.png"),
    new File([new Uint8Array(maxImageBytes + 1)], "oversized.png", { type: "image/png" }),
  ]) {
    await assert.rejects(h.generateImageTo3D({ image }), invalidInput(h, "image"));
  }
  assert.equal(h.requests.length, 0);
});

test("both creation operations reject non-202 success codes and malformed task IDs", async () => {
  const malformed = [
    () => Response.json(accepted, { status: 200 }),
    () => Response.json(accepted, { status: 201 }),
    () => Response.json(null, { status: 202 }),
    () => Response.json([accepted], { status: 202 }),
    () => Response.json({ data: accepted }, { status: 202 }),
    () => Response.json(model, { status: 202 }),
    ...[null, 3, "", "   ", ".", "..", "\ud800"].map((taskId) => () => Response.json({ taskId }, { status: 202 })),
    () => new Response("{bad", { status: 202, headers: { "Content-Type": "application/json" } }),
    () => new Response(null, { status: 204 }),
  ];
  for (const operation of generate) {
    for (const respond of malformed) {
      const response = respond();
      const h = harness(() => response);
      await assert.rejects(operation(h), apiError(h, "response", response.status));
      assert.equal(h.requests.length, 1);
    }
  }
});

test("an already-aborted signal prevents any request", async () => {
  const h = harness();
  const signal = AbortSignal.abort();
  for (const operation of generate) {
    await assert.rejects(operation(h, { signal }), (error) => error === signal.reason);
  }
  await assert.rejects(h.getMeshyTaskStatus(taskId, { signal }), (error) => error === signal.reason);
  assert.equal(h.requests.length, 0);
});

test("GET cancellation preserves the caller's original abort reason", async () => {
  const controller = new AbortController();
  const reason = new Error("Synthetic view unmount");
  let started;
  const inTransport = new Promise((resolve) => { started = resolve; });
  const h = harness(({ signal }) => new Promise((_, reject) => {
    assert.equal(signal, controller.signal);
    signal.addEventListener("abort", () => reject(new Error("Synthetic transport abort")), { once: true });
    started();
  }));
  const status = h.getMeshyTaskStatus(taskId, { signal: controller.signal });
  await inTransport;
  controller.abort(reason);
  await assert.rejects(status, (error) => error === reason);
  assert.deepEqual(h.requests.map(({ method }) => method), ["GET"]);
});

test("a missing status task preserves 404 without replaying a POST", async () => {
  const h = harness(() => Response.json({ message: "Synthetic missing task" }, { status: 404 }));
  await assert.rejects(h.getMeshyTaskStatus(taskId), apiError(h, "http", 404));
  assert.deepEqual(h.requests.map(({ method }) => method), ["GET"]);
});

test("pending generation forwards the signal, makes no polling request, and keeps the abort reason", async () => {
  for (const operation of generate) {
    const controller = new AbortController();
    const h = harness(({ signal }) => new Promise((_, reject) => {
      assert.equal(signal, controller.signal);
      signal.addEventListener("abort", () => reject(signal.reason), { once: true });
    }));
    let settled = false;
    const result = operation(h, { signal: controller.signal });
    const aborted = assert.rejects(result, (error) => error === controller.signal.reason);
    void result.then(() => { settled = true; }, () => { settled = true; });
    await new Promise(setImmediate);
    assert.equal(settled, false);
    assert.equal(h.requests.length, 1);
    controller.abort();
    await aborted;
    assert.equal(h.requests.length, 1);
  }
});

test("408, 429, and 500 preserve HTTP status without retry or session clearing", async () => {
  for (const operation of generate) {
    for (const status of [408, 429, 500]) {
      const h = harness(() => Response.json({ message: "Synthetic server error" }, { status }));
      await assert.rejects(operation(h), apiError(h, "http", status));
      assert.equal(h.requests.length, 1);
      assert.equal(h.storage.size, 2);
    }
  }
});

test("401 preserves existing session expiration and never replays a POST", async () => {
  for (const operation of generate) {
    const h = harness(() => new Response("{bad", { status: 401, headers: { "Content-Type": "application/json" } }));
    await assert.rejects(operation(h), apiError(h, "http", 401));
    assert.equal(h.requests.length, 1);
    assert.equal(h.storage.size, 0);
    assert.deepEqual(h.events, ["piston-auth-expired"]);
    assert.deepEqual(h.redirects, ["https://frontend.invalid/login"]);
  }
});

test("connection errors are exposed without replaying the POST", async () => {
  for (const operation of generate) {
    const h = harness(() => { throw new TypeError("Synthetic network failure"); });
    await assert.rejects(operation(h), apiError(h, "network", 0));
    assert.equal(h.requests.length, 1);
    assert.equal(h.storage.size, 2);
  }
});
