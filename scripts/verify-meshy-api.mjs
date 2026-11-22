import assert from "node:assert/strict";
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
const allowedUrls = new Set([textUrl, imageUrl]);
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
    process: { env: { NODE_ENV: "production", NEXT_PUBLIC_API_BASE_URL: baseUrl } },
    Headers, FormData, File, Blob, URLSearchParams, ArrayBuffer, Event,
    window: {
      localStorage: { getItem: (key) => storage.get(key), removeItem: (key) => storage.delete(key) },
      location: { origin: "https://frontend.invalid", pathname: "/create", assign: (url) => redirects.push(url) },
      dispatchEvent: (event) => events.push(event.type),
    },
    async fetch(url, init) {
      const request = { url, ...init };
      requests.push(request);
      assert.ok(allowedUrls.has(url), "Blocked unexpected fetch URL: " + url);
      assert.equal(init.method, "POST");
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

test("text generation POSTs only the original prompt as authenticated JSON", async () => {
  const h = harness(() => Response.json({ ...model, extra: "ignore fixture metadata" }));
  const originalPrompt = "  " + prompt.repeat(200) + " \n";
  const result = await h.generateTextTo3D({ prompt: originalPrompt, extra: "ignore input field" });
  assert.deepEqual(structuredClone(result), model);
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
    return Response.json(model, { status: 201 });
  });
  assert.deepEqual(structuredClone(await h.generateImageTo3D({ image })), model);
  assert.equal(h.requests.length, 1);
});

test("relative model URLs are preserved without downloading or requesting another API", async () => {
  for (const operation of generate) {
    const relative = { modelUrl: "/models/example.stl" };
    const h = harness(() => Response.json(relative));
    assert.deepEqual(structuredClone(await operation(h)), relative);
    assert.equal(h.requests.length, 1);
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
  const h = harness(() => Response.json(model));
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

test("both operations reject malformed model responses without retrying", async () => {
  const malformed = [
    () => Response.json(null),
    () => Response.json([model]),
    () => Response.json({ data: model }),
    () => Response.json({ modelUrl: null }),
    () => Response.json({ modelUrl: 3 }),
    () => Response.json({ modelUrl: "" }),
    () => Response.json({ modelUrl: "   " }),
    () => new Response("{bad", { headers: { "Content-Type": "application/json" } }),
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
  assert.equal(h.requests.length, 0);
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
