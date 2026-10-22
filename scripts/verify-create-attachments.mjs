import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const hookPath = "src/page-slices/create/model/use-create-attachments.ts";
const workspacePath = "src/page-slices/create/ui/create-workspace.tsx";
const sources = new Map([
  hookPath,
  "src/page-slices/create/model/use-create-print-flow.ts",
  workspacePath,
  "src/page-slices/create/model/model-utils.ts",
  "src/page-slices/create/model/mock-data.ts",
  "src/shared/mock/mock-data.ts",
].map((path) => [resolve(root, path), ts.transpileModule(readFileSync(resolve(root, path), "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
  fileName: path,
}).outputText]));

function createHarness(context, { workspace = false, desktop = false } = {}) {
  const slots = [];
  const effects = new Map();
  const pendingEffects = new Set();
  const modules = new Map();
  const liveUrls = new Map();
  const created = [];
  const revoked = [];
  const timers = new Map();
  let cursor = 0;
  let rendering = false;
  let nextTimerId = 0;
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) {
        slots[slot] = { value: typeof initial === "function" ? initial() : initial };
      }
      const cell = slots[slot];
      return [cell.value, (next) => {
        if (typeof next === "function") next(cell.value);
        cell.value = typeof next === "function" ? next(cell.value) : next;
      }];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useEffect(setup, dependencies) {
      const slot = cursor++;
      const previous = effects.get(slot);
      if (!previous || !dependencies || !previous.dependencies ||
          dependencies.length !== previous.dependencies.length ||
          !dependencies.every((dependency, index) => Object.is(dependency, previous.dependencies[index]))) {
        effects.set(slot, { setup, dependencies, cleanup: previous?.cleanup });
        pendingEffects.add(slot);
      }
    },
    useCallback: (callback) => callback,
    useSyncExternalStore: () => desktop,
  };
  const jsx = (type, props) => ({ type, props });
  const unexpected = () => assert.fail("Attachment tests must not navigate or call print APIs");
  const stubs = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => ({ push: unexpected }) },
    "@/entities/printer": { usePrinterQuery: () => ({ connectedPrinter: null, isPrinterConnected: false }) },
    "@/entities/print": { createPrintTask: unexpected, getCurrentPrintTask: unexpected },
    "@/features/print-artwork": { PrintSettingsModal: "PrintSettingsModal" },
    "@/widgets/header": { Header: "Header" },
    "./components/chat-panel": { ChatPanel: "ChatPanel" },
    "./components/history-sidebar": { HistorySidebar: "HistorySidebar" },
    "./components/preview-panel": { PreviewPanel: "PreviewPanel" },
    "./components/print-in-progress-modal": { PrintInProgressModal: "PrintInProgressModal" },
    "./components/printer-disconnected-modal": { PrinterDisconnectedModal: "PrinterDisconnectedModal" },
    "./components/version-history": { VersionHistory: "VersionHistory" },
  };
  function load(path) {
    if (modules.has(path)) return modules.get(path).exports;
    assert(sources.has(path), "Unexpected module: " + path);
    const loaded = { exports: {} };
    modules.set(path, loaded);
    const requireSource = (specifier) => {
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
      const target = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(path), specifier);
      return load(sources.has(target + ".ts") ? target + ".ts" : target + ".tsx");
    };
    new Script("(function(require, module, exports) {\n" + sources.get(path) + "\n})", {
      filename: path,
    }).runInNewContext({
      crypto: { randomUUID },
      URL: {
        createObjectURL(file) {
          assert.equal(rendering, false, "URLs must not be allocated during render");
          const url = "blob:attachment-" + (created.length + 1);
          created.push(url);
          liveUrls.set(url, file);
          return url;
        },
        revokeObjectURL(url) {
          assert.equal(rendering, false, "URLs must not be revoked during render");
          assert(liveUrls.delete(url), "Duplicate or unknown URL revocation: " + url);
          revoked.push(url);
        },
      },
      window: {
        setTimeout(callback) {
          timers.set(++nextTimerId, callback);
          return nextTimerId;
        },
        clearTimeout: (timerId) => timers.delete(timerId),
      },
    })(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  const run = workspace
    ? load(resolve(root, workspacePath)).default
    : load(resolve(root, hookPath)).useCreateAttachments;
  function unmount() {
    for (const effect of effects.values()) effect.cleanup?.();
    effects.clear();
    pendingEffects.clear();
  }
  context.after(() => {
    unmount();
    assert.equal(liveUrls.size, 0, "Every allocated URL must be released");
    assert.equal(created.length, revoked.length);
    assert.equal(timers.size, 0);
  });
  return {
    created, revoked, liveUrls, timers, unmount,
    render() {
      cursor = 0;
      rendering = true;
      let result;
      try {
        result = run();
      } finally {
        rendering = false;
      }
      for (const slot of pendingEffects) {
        const effect = effects.get(slot);
        effect.cleanup?.();
        effect.cleanup = effect.setup();
      }
      pendingEffects.clear();
      return result;
    },
    replayMountEffects() {
      for (const effect of effects.values()) {
        effect.cleanup?.();
        effect.cleanup = effect.setup();
      }
    },
  };
}

const imageFile = (name = "reference.png") => new File(["image"], name, { type: "image/png" });
const textFile = () => new File(["text"], "notes.txt", { type: "text/plain" });
const eventWith = (fields = {}) => ({
  ...fields,
  defaultPrevented: false,
  preventDefault() { this.defaultPrevented = true; },
});
const selectFiles = (files) => ({ target: { files, value: "selected-file" } });
const names = (images) => Array.from(images, (image) => image.name);

function findProps(tree, type) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const props = findProps(child, type);
      if (props) return props;
    }
  } else if (tree && typeof tree === "object") {
    if (tree.type === type) return tree.props;
    return findProps(tree.props?.children, type);
  }
}

test("file selection filters non-images, clears input and keeps the fallback name", (context) => {
  const harness = createHarness(context);
  let hook = harness.render();
  for (const files of [null, [], [textFile()]]) {
    const event = selectFiles(files);
    hook.handleFileChange(event);
    assert.equal(event.target.value, "");
  }
  assert.equal(harness.created.length, 0);
  const selected = imageFile();
  hook.handleFileChange(selectFiles([textFile(), selected, imageFile("")]));
  hook = harness.render();
  assert.deepEqual(names(hook.attachedImages), ["reference.png", "붙여넣은 이미지"]);
  assert.equal(hook.isLimitExceeded, false);
  assert.equal(harness.liveUrls.get(hook.attachedImages[0].url), selected);
  assert.notEqual(hook.attachedImages[0].id, hook.attachedImages[1].id);
});

for (const method of ["handleFileChange", "handlePaste", "handleDrop"]) {
  test(method + " enforces two images without allocating rejected URLs", (context) => {
    const harness = createHarness(context);
    let hook = harness.render();
    const files = [imageFile("first.png"), textFile(), imageFile("second.png"), imageFile("third.png")];
    const event = eventWith({ ...selectFiles(files), clipboardData: { files }, dataTransfer: { files } });
    hook[method](event);
    hook = harness.render();
    assert.deepEqual(names(hook.attachedImages), ["first.png", "second.png"]);
    assert.equal(hook.isLimitExceeded, true);
    assert.equal(harness.created.length, 2);
    if (method !== "handleFileChange") assert.equal(event.defaultPrevented, true);
    hook[method](event);
    hook.handleFileChange(selectFiles([textFile()]));
    assert.equal(harness.render().isLimitExceeded, true);
    assert.equal(harness.created.length, 2);
    assert.equal(harness.revoked.length, 0);
  });
}

test("paste preserves text defaults; drop and drag-over prevent navigation", (context) => {
  const harness = createHarness(context);
  const hook = harness.render();
  const textPaste = eventWith({ clipboardData: { files: [textFile()] } });
  hook.handlePaste(textPaste);
  assert.equal(textPaste.defaultPrevented, false);
  const emptyDrop = eventWith({ dataTransfer: { files: [textFile()] } });
  hook.handleDrop(emptyDrop);
  assert.equal(emptyDrop.defaultPrevented, true);
  const dragOver = eventWith();
  hook.handleDragOver(dragOver);
  assert.equal(dragOver.defaultPrevented, true);
  assert.equal(harness.created.length, 0);
});

test("back-to-back additions, removals and resets use current ownership before rerender", (context) => {
  const harness = createHarness(context);
  let hook = harness.render();
  hook.handleFileChange(selectFiles([imageFile("first.png")]));
  hook.handleFileChange(selectFiles([imageFile("second.png"), imageFile("rejected.png")]));
  hook.handleFileChange(selectFiles([imageFile("also-rejected.png")]));
  hook = harness.render();
  assert.deepEqual(names(hook.attachedImages), ["first.png", "second.png"]);
  assert.equal(hook.isLimitExceeded, true);
  assert.equal(harness.created.length, 2);
  const [removed, retained] = hook.attachedImages;
  hook.fileInputRef.current = { value: "selected-file" };
  hook.handleRemoveAttachment(removed.id);
  hook.handleRemoveAttachment(removed.id);
  hook.handleRemoveAttachment("missing-id");
  assert.equal(hook.fileInputRef.current.value, "");
  assert.deepEqual(harness.revoked, [removed.url]);
  assert.equal(harness.render().isLimitExceeded, false);
  hook.handleFileChange(selectFiles([imageFile("replacement.png")]));
  hook = harness.render();
  assert.deepEqual(names(hook.attachedImages), ["second.png", "replacement.png"]);
  assert.equal(hook.attachedImages[0].url, retained.url);
  hook.resetAttachments();
  hook.resetAttachments();
  hook.handleFileChange(selectFiles([imageFile("after-reset.png")]));
  assert.deepEqual(names(harness.render().attachedImages), ["after-reset.png"]);
  harness.unmount();
});

test("mount effect replay and rerenders keep previews alive; unmount sees the latest addition", (context) => {
  const harness = createHarness(context);
  const hook = harness.render();
  harness.replayMountEffects();
  hook.handleFileChange(selectFiles([imageFile()]));
  const previewUrl = harness.render().attachedImages[0].url;
  for (let iteration = 0; iteration < 3; iteration += 1) {
    assert.equal(harness.render().attachedImages[0].url, previewUrl);
    assert.equal(harness.revoked.length, 0);
  }
  hook.handleFileChange(selectFiles([imageFile("latest.png")]));
  harness.unmount();
  assert.equal(harness.revoked.length, 2);
});

test("repeated attach/remove cycles allow the same file and release each URL exactly once", (context) => {
  const harness = createHarness(context);
  const selected = imageFile();
  let hook = harness.render();
  for (let iteration = 0; iteration < 20; iteration += 1) {
    const event = selectFiles([selected]);
    hook.handleFileChange(event);
    assert.equal(event.target.value, "");
    hook = harness.render();
    assert.equal(hook.attachedImages.length, 1);
    hook.handleRemoveAttachment(hook.attachedImages[0].id);
    hook = harness.render();
    assert.equal(hook.attachedImages.length, 0);
    assert.equal(harness.liveUrls.size, 0);
  }
  assert.equal(harness.created.length, 20);
  assert.equal(harness.revoked.length, 20);
});

for (const draft of ["", "  디자인 요청  "]) {
  test("workspace submits image names and resets attachments: " + JSON.stringify(draft), (context) => {
    const harness = createHarness(context, { workspace: true });
    let chat = findProps(harness.render(), "ChatPanel");
    chat.onSubmit(eventWith());
    assert.equal(findProps(harness.render(), "ChatPanel").messages.length, 0);
    chat.onFileChange(selectFiles([imageFile("selected.png")]));
    chat.onPaste(eventWith({ clipboardData: { files: [imageFile("pasted.png")] } }));
    chat.onDrop(eventWith({ dataTransfer: { files: [imageFile("rejected.png")] } }));
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.isLimitExceeded, true);
    chat.onDraftChange(draft);
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.isLimitExceeded, false);
    chat.fileInputRef.current = { value: "selected-file" };
    chat.onSubmit(eventWith());
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.messages.length, 1);
    assert.equal(chat.messages[0].role, "user");
    assert.equal(chat.messages[0].content,
      (draft.trim() || "참고 이미지를 바탕으로 디자인을 만들어 주세요.") +
      "\n참고 이미지: selected.png, pasted.png");
    assert.equal(chat.attachedImages.length, 0);
    assert.equal(chat.fileInputRef.current.value, "");
    assert.equal(chat.draft, "");
    assert.equal(chat.isLimitExceeded, false);
    assert.equal(harness.liveUrls.size, 0);
    chat.onDrop(eventWith({ dataTransfer: { files: [imageFile("while-loading.png")] } }));
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.isLoading, true);
    chat.onSubmit(eventWith());
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.messages.length, 1);
    assert.deepEqual(names(chat.attachedImages), ["while-loading.png"]);
  });
}

for (const desktop of [false, true]) {
  test("workspace new chat clears attachments, warning and input; desktop=" + desktop, (context) => {
    const harness = createHarness(context, { workspace: true, desktop });
    let chat = findProps(harness.render(), "ChatPanel");
    chat.onDrop(eventWith({ dataTransfer: { files: [imageFile("remove.png")] } }));
    chat = findProps(harness.render(), "ChatPanel");
    chat.onRemoveAttachment(chat.attachedImages[0].id);
    chat.onFileChange(selectFiles([imageFile(), imageFile(), imageFile()]));
    chat.onToggleHistory();
    const tree = harness.render();
    chat = findProps(tree, "ChatPanel");
    assert.equal(chat.isLimitExceeded, true);
    chat.fileInputRef.current = { value: "selected-file" };
    findProps(tree, "HistorySidebar").onNewChat();
    chat = findProps(harness.render(), "ChatPanel");
    assert.equal(chat.attachedImages.length, 0);
    assert.equal(chat.isLimitExceeded, false);
    assert.equal(chat.fileInputRef.current.value, "");
    assert.equal(harness.liveUrls.size, 0);
    chat.onFileChange(selectFiles([imageFile("fresh.png")]));
    assert.deepEqual(names(findProps(harness.render(), "ChatPanel").attachedImages), ["fresh.png"]);
  });
}
