import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const workspacePath = "src/page-slices/create/ui/create-workspace.tsx";
const generationPath = "src/page-slices/create/model/use-create-generation.ts";
const allowedPaths = new Set([
  workspacePath, generationPath,
  "src/page-slices/create/model/use-create-attachments.ts",
  "src/page-slices/create/model/use-create-print-flow.ts",
  "src/page-slices/create/model/model-utils.ts",
  "src/page-slices/create/model/mock-data.ts",
  "src/shared/mock/mock-data.ts",
].map((path) => resolve(root, path)));
const sources = new Map();
export const plain = (value) => JSON.parse(JSON.stringify(value));
export const submitEvent = () => ({ preventDefault() {} });
const flushResponses = () => new Promise((done) => setImmediate(done));

function findProps(tree, type) {
  if (Array.isArray(tree)) {
    for (const child of tree) {
      const result = findProps(child, type);
      if (result) return result;
    }
  } else if (tree && typeof tree === "object") {
    if (tree.type === type) return tree.props;
    return findProps(tree.props?.children, type);
  }
}

// Execute real modules with explicit rerenders, simulated hooks and a virtual clock.
// This is not a React renderer, a browser, or a concurrent scheduling simulation.
export function createGenerationHarness({ hookOnly = false, connected = true, desktop = false } = {}) {
  const slots = [];
  const effects = new Map();
  const pendingEffects = new Set();
  const modules = new Map();
  const timers = new Map();
  const liveUrls = new Set();
  const queries = [];
  const submissions = [];
  let cursor = 0;
  let now = 0;
  let timerId = 0;
  let uuid = 0;
  let urlId = 0;
  let mounted = true;
  function registerEffect(setup, dependencies, phase) {
    const slot = cursor++;
    const previous = effects.get(slot);
    if (!previous || dependencies.length !== previous.dependencies.length ||
        !dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) {
      effects.set(slot, { setup, dependencies, phase, cleanup: previous?.cleanup });
      pendingEffects.add(slot);
    }
  }
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) {
        const cell = { value: typeof initial === "function" ? initial() : initial };
        cell.set = (next) => {
          assert(mounted, "No setters after unmount");
          // Replay updater evaluation to detect impure version-number allocation.
          if (typeof next === "function") next(cell.value);
          cell.value = typeof next === "function" ? next(cell.value) : next;
        };
        slots[slot] = cell;
      }
      return [slots[slot].value, slots[slot].set];
    },
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useCallback(callback, dependencies) {
      const slot = cursor++;
      const previous = slots[slot];
      if (!previous || dependencies.length !== previous.dependencies.length ||
          !dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) {
        slots[slot] = { callback, dependencies };
      }
      return slots[slot].callback;
    },
    useEffect: (setup, dependencies) => registerEffect(setup, dependencies, "passive"),
    useLayoutEffect: (setup, dependencies) => registerEffect(setup, dependencies, "layout"),
    useSyncExternalStore: () => desktop,
  };
  const jsx = (type, props) => ({ type, props });
  const stubs = {
    react,
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "next/navigation": { useRouter: () => ({ push: () => assert.fail("Unexpected navigation") }) },
    "@/entities/printer": {
      usePrinterQuery: () => ({ connectedPrinter: null, isPrinterConnected: connected }),
    },
    "@/entities/print": {
      getCurrentPrintTask: (...args) => new Promise((resolve, reject) => queries.push({ args, resolve, reject })),
      createPrintTask: (...args) => new Promise((resolve, reject) => submissions.push({ args, resolve, reject })),
    },
    "@/features/print-artwork": { PrintSettingsModal: "PrintSettingsModal" },
    "@/widgets/header": { Header: "Header" },
  };
  for (const [file, name] of [
    ["chat-panel", "ChatPanel"], ["preview-panel", "PreviewPanel"],
    ["version-history", "VersionHistory"], ["history-sidebar", "HistorySidebar"],
    ["printer-disconnected-modal", "PrinterDisconnectedModal"],
    ["print-in-progress-modal", "PrintInProgressModal"],
  ]) stubs["./components/" + file] = { [name]: name };
  function load(path) {
    assert(allowedPaths.has(path), "Unexpected module: " + path);
    if (modules.has(path)) return modules.get(path).exports;
    if (!sources.has(path)) {
      sources.set(path, ts.transpileModule(readFileSync(path, "utf8"), {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
        },
        fileName: path,
      }).outputText);
    }
    const loaded = { exports: {} };
    modules.set(path, loaded);
    const requireSource = (specifier) => {
      if (Object.hasOwn(stubs, specifier)) return stubs[specifier];
      const target = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2)) : resolve(dirname(path), specifier);
      return load(allowedPaths.has(target + ".ts") ? target + ".ts" : target + ".tsx");
    };
    new Script("(function(require, module, exports) {\n" + sources.get(path) + "\n})", {
      filename: path,
    }).runInNewContext({
      crypto: { randomUUID: () => "message-" + (++uuid) },
      process: { env: { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: "false" } },
      performance: { now: () => now },
      URL: {
        createObjectURL() {
          const url = "blob:generation-" + (++urlId);
          liveUrls.add(url);
          return url;
        },
        revokeObjectURL(url) { assert(liveUrls.delete(url), "URL must be released exactly once"); },
      },
      window: {
        setTimeout(callback, delay) {
          timers.set(++timerId, { callback, due: now + delay });
          return timerId;
        },
        clearTimeout: (id) => timers.delete(id),
      },
    })(requireSource, loaded, loaded.exports);
    return loaded.exports;
  }
  const run = hookOnly ? load(resolve(root, generationPath)).useCreateGeneration
    : load(resolve(root, workspacePath)).default;
  function render() {
    assert(mounted, "Cannot render after unmount");
    cursor = 0;
    const result = run();
    for (const phase of ["layout", "passive"]) {
      for (const slot of pendingEffects) {
        const effect = effects.get(slot);
        if (effect.phase !== phase) continue;
        effect.cleanup?.();
        effect.cleanup = effect.setup();
      }
    }
    pendingEffects.clear();
    return result;
  }
  function props(name) {
    const result = findProps(render(), name);
    assert(result, "Missing rendered component: " + name);
    return result;
  }
  function unmount() {
    for (const effect of effects.values()) effect.cleanup?.();
    effects.clear();
    pendingEffects.clear();
    mounted = false;
    assert.equal(timers.size, 0, "Unmount must clear scheduled timers");
    assert.equal(liveUrls.size, 0, "Unmount must release attached URLs");
  }
  return {
    render, props, unmount, timers, liveUrls, queries, submissions,
    submit(prompt) {
      props("ChatPanel").onDraftChange(prompt);
      props("ChatPanel").onSubmit(submitEvent());
    },
    attach(name = "reference.png") {
      props("ChatPanel").onFileChange({
        target: { files: [new File(["image"], name, { type: "image/png" })], value: "selected" },
      });
    },
    newChat() {
      if (!findProps(render(), "HistorySidebar")) props("ChatPanel").onToggleHistory();
      props("HistorySidebar").onNewChat();
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= target)
          .sort((first, second) => first[1].due - second[1].due)[0];
        if (!next) break;
        now = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
        if (mounted) render();
      }
      now = target;
      return mounted ? render() : undefined;
    },
  };
}

// Shared by generation regression and test:print; replaces the old function-location check.
export async function verifyGenerationPrintIntegration() {
  for (const connected of [true, false]) {
    const harness = createGenerationHarness({ connected });
    const modal = connected ? "PrintSettingsModal" : "PrinterDisconnectedModal";
    const open = async () => {
      const before = harness.queries.length;
      harness.props("PreviewPanel").onPrint();
      assert.equal(harness.queries.length, before + 1);
      harness.queries.at(-1).resolve(null);
      await flushResponses();
      assert.equal(harness.props(modal).isOpen, true);
    };
    try {
      harness.props("PreviewPanel").onPrint();
      assert.equal(harness.queries.length, 0, "An empty generation must not query print status");
      harness.submit("연필꽂이");
      harness.advance(1800);
      await open();
      harness.submit("   ");
      assert.equal(harness.props(modal).isOpen, true, "Empty requests must not close print setup");
      assert.equal(harness.props("ChatPanel").draft, "   ");
      harness.attach("reference.png");
      harness.submit("다음 디자인");
      assert.equal(harness.props(modal).isOpen, false, "Accepted starts must close print setup");
      let chat = harness.props("ChatPanel");
      assert.equal(chat.draft, "");
      assert.equal(chat.attachedImages.length, 0);
      assert.equal(harness.liveUrls.size, 0);
      assert.equal(chat.messages.at(-1).content, "다음 디자인\n참고 이미지: reference.png");
      await open();
      harness.attach("keep.png");
      harness.props("ChatPanel").onDraftChange("보존할 입력");
      chat = harness.props("ChatPanel");
      const before = chat.messages;
      const attachments = chat.attachedImages;
      chat.onSubmit(submitEvent());
      chat = harness.props("ChatPanel");
      assert.equal(chat.messages, before);
      assert.equal(chat.draft, "보존할 입력");
      assert.equal(chat.attachedImages, attachments);
      assert.equal(harness.liveUrls.size, 1);
      assert.equal(harness.props(modal).isOpen, true, "Rejected starts must preserve print setup");
      harness.newChat();
      assert.equal(harness.props(modal).isOpen, false);
      assert.equal(harness.props("ChatPanel").messages.length, 0);
      assert.equal(harness.liveUrls.size, 0);
      assert.equal(harness.timers.size, 0);
      harness.submit("얇은 연필꽂이");
      harness.advance(1800);
      const blockedQueries = harness.queries.length;
      harness.props("PreviewPanel").onPrint();
      assert.equal(harness.queries.length, blockedQueries, "Print warnings must reach print eligibility");
      chat = harness.props("ChatPanel");
      chat.onAutoFix(chat.messages.at(-1).id);
      await open();
      harness.newChat();
      harness.props("PreviewPanel").onPrint();
      assert.equal(harness.queries.length, blockedQueries + 1, "Reset must remove print eligibility");
      assert.equal(harness.submissions.length, 0, "Opening setup must not start a print");
    } finally {
      harness.unmount();
    }
  }
}
