import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

const path = fileURLToPath(new URL("../src/page-slices/create/model/use-create-print-flow.ts", import.meta.url));
const source = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  fileName: path,
}).outputText;
const flushResponses = () => new Promise((resolve) => setImmediate(resolve));
const settings = { colorMode: "monochrome" };
const printTask = (status = "PRINTING") => ({ id: 1, status, artworkName: "Existing design" });

function createHarness(context, initialOptions = {}) {
  const slots = [];
  const effects = new Map();
  const pendingEffects = new Set();
  const timers = new Map();
  const queries = [];
  const submissions = [];
  let options = { isGenerated: true, isPrintBlocked: false, isPrinterConnected: true, ...initialOptions };
  let cursor = 0;
  let now = 0;
  let timerId = 0;
  let mounted = true;
  let updatesAfterUnmount = 0;
  const react = {
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) {
        const cell = { value: typeof initial === "function" ? initial() : initial };
        cell.set = (next) => {
          if (!mounted) {
            updatesAfterUnmount += 1;
            return;
          }
          cell.value = typeof next === "function" ? next(cell.value) : next;
        };
        slots[slot] = cell;
      }
      return [slots[slot].value, slots[slot].set];
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
    useEffect(setup, dependencies) {
      const slot = cursor++;
      const previous = effects.get(slot);
      if (!previous || dependencies.length !== previous.dependencies.length ||
          !dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) {
        effects.set(slot, { setup, dependencies, cleanup: previous?.cleanup });
        pendingEffects.add(slot);
      }
    },
  };
  const enqueue = (requests, args) => new Promise((resolve, reject) => {
    requests.push({ args, resolve, reject });
  });
  const exports = {};
  new Script(source, { filename: path }).runInNewContext({
    exports,
    require(specifier) {
      if (specifier === "react") return react;
      assert.equal(specifier, "@/entities/print");
      return {
        getCurrentPrintTask: (...args) => enqueue(queries, args),
        createPrintTask: (...args) => enqueue(submissions, args),
      };
    },
    window: {
      setTimeout(callback, delay) {
        timers.set(++timerId, { callback, due: now + delay });
        return timerId;
      },
      clearTimeout: (timer) => timers.delete(timer),
    },
  });
  function render(nextOptions = {}) {
    assert(mounted, "Cannot render an unmounted harness");
    options = { ...options, ...nextOptions };
    cursor = 0;
    const result = exports.useCreatePrintFlow(options);
    for (const slot of pendingEffects) {
      const effect = effects.get(slot);
      effect.cleanup?.();
      effect.cleanup = effect.setup();
    }
    pendingEffects.clear();
    return result;
  }
  function unmount() {
    mounted = false;
    for (const effect of effects.values()) effect.cleanup?.();
    effects.clear();
  }
  context.after(() => {
    unmount();
    assert.equal(timers.size, 0, "Success timers must be cleaned up");
  });
  return {
    render, unmount, queries, submissions, timers,
    get updatesAfterUnmount() { return updatesAfterUnmount; },
    replayMountEffects() {
      for (const effect of effects.values()) {
        effect.cleanup?.();
        effect.cleanup = effect.setup();
      }
    },
    advance(milliseconds) {
      const target = now + milliseconds;
      let result = render();
      while (true) {
        const next = [...timers.entries()].filter(([, timer]) => timer.due <= target)
          .sort((first, second) => first[1].due - second[1].due)[0];
        if (!next) break;
        now = next[1].due;
        timers.delete(next[0]);
        next[1].callback();
        result = render();
      }
      now = target;
      return result;
    },
  };
}

async function openSettings(harness) {
  harness.render().handlePrintOpen();
  harness.queries.at(-1).resolve(null);
  await flushResponses();
  const flow = harness.render();
  assert.equal(flow.isPrintModalOpen, true);
  return flow;
}

function assertReset(flow) {
  for (const key of [
    "isPrintModalOpen", "isPrintInProgressModalOpen", "isPrintStatusChecking",
    "isPrintCheckFailed", "isPrintStarting", "isPrinterConnectionModalOpen",
  ]) assert.equal(flow[key], false, key);
  assert.equal(flow.currentPrintTask, null);
  assert.equal(flow.printStartError, null);
  assert.equal(flow.printSuccessPhase, "hidden");
}

for (const options of [{ isGenerated: false }, { isPrintBlocked: true }]) {
  test("ineligible designs do not query or submit: " + JSON.stringify(options), (context) => {
    const harness = createHarness(context, options);
    const flow = harness.render();
    flow.handlePrintOpen();
    flow.handlePrintConfirm(settings);
    assert.equal(harness.queries.length, 0);
    assert.equal(harness.submissions.length, 0);
  });
}

test("query first, confirm explicitly, and block duplicate calls after loading rerenders", async (context) => {
  const harness = createHarness(context);
  let flow = harness.render();
  harness.replayMountEffects();
  assertReset(flow);
  flow.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 0);
  flow.handlePrintOpen();
  flow = harness.render();
  assert.equal(flow.isPrintStatusChecking, true);
  assert.equal(flow.isPrintModalOpen, false);
  flow.handlePrintOpen();
  flow.handlePrintConfirm(settings);
  assert.equal(harness.queries.length, 1);
  assert.equal(harness.submissions.length, 0);
  assert.deepEqual(harness.queries[0].args, []);
  harness.queries[0].resolve(null);
  await flushResponses();
  flow = harness.render();
  assert.equal(flow.isPrintModalOpen, true);
  assert.equal(flow.isPrintStatusChecking, false);
  flow.handlePrintConfirm(settings);
  flow = harness.render();
  assert.equal(flow.isPrintStarting, true);
  flow.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 1);
  assert.deepEqual(harness.submissions[0].args, [], "Do not add colorMode, printerId or new API payloads");
  harness.submissions[0].resolve(printTask());
  await flushResponses();
  flow = harness.render();
  assert.equal(flow.isPrintStarting, false);
  assert.equal(flow.isPrintModalOpen, false);
  assert.equal(flow.printSuccessPhase, "visible");
});

for (const connected of [false, true]) {
  test("an active print takes precedence over connection state: " + connected, async (context) => {
    const harness = createHarness(context, { isPrinterConnected: connected });
    const task = printTask();
    harness.render().handlePrintOpen();
    harness.queries[0].resolve(task);
    await flushResponses();
    let flow = harness.render();
    assert.equal(flow.currentPrintTask, task);
    assert.equal(flow.isPrintInProgressModalOpen, true);
    assert.equal(flow.isPrinterConnectionModalOpen, false);
    assert.equal(flow.isPrintModalOpen, false);
    flow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 0);
    flow.closePrintSetup();
    assert.equal(harness.render().isPrintInProgressModalOpen, true);
    flow.handlePrintInProgressModalClose();
    flow = harness.render();
    assert.equal(flow.isPrintInProgressModalOpen, false);
    assert.equal(flow.currentPrintTask, task);
    flow.resetPrintFlow();
    assertReset(harness.render());
  });
}

test("all existing non-printing statuses permit setup when connected", async (context) => {
  const harness = createHarness(context);
  for (const status of ["EMPTY", "COMPLETED", "FAILED", "ERROR", "CANCELLED", "CANCELED"]) {
    harness.render().handlePrintOpen();
    harness.queries.at(-1).resolve(printTask(status));
    await flushResponses();
    const flow = harness.render();
    assert.equal(flow.isPrintModalOpen, true, status);
    assert.equal(flow.isPrintInProgressModalOpen, false, status);
    flow.resetPrintFlow();
    assertReset(harness.render());
  }
});

test("disconnected guidance closes and switches to settings on the next connected check", async (context) => {
  const harness = createHarness(context, { isPrinterConnected: false });
  harness.render().handlePrintOpen();
  harness.queries[0].resolve(null);
  await flushResponses();
  let flow = harness.render();
  assert.equal(flow.isPrinterConnectionModalOpen, true);
  assert.equal(flow.isPrintModalOpen, false);
  flow.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 0);
  flow.handlePrinterConnectionModalClose();
  assert.equal(harness.render().isPrinterConnectionModalOpen, false);
  flow = harness.render({ isPrinterConnected: true });
  flow.handlePrintOpen();
  harness.queries[1].resolve(null);
  await flushResponses();
  flow = harness.render();
  assert.equal(flow.isPrintModalOpen, true);
  assert.equal(flow.isPrinterConnectionModalOpen, false);
});

test("query failures close all dialogs, block submission and allow an explicit retry", async (context) => {
  const harness = createHarness(context);
  await openSettings(harness);
  harness.render().handlePrintOpen();
  harness.queries.at(-1).reject(new Error("offline"));
  await flushResponses();
  let flow = harness.render();
  assert.equal(flow.isPrintCheckFailed, true);
  assert.equal(flow.isPrintStatusChecking, false);
  assert.equal(flow.isPrintModalOpen, false);
  assert.equal(flow.isPrintInProgressModalOpen, false);
  assert.equal(flow.isPrinterConnectionModalOpen, false);
  flow.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 0);
  flow = await openSettings(harness);
  assert.equal(flow.isPrintCheckFailed, false);
  flow.handlePrintModalClose();
  assert.equal(harness.render().isPrintModalOpen, false);
});

test("submission failure keeps settings open; retry clears the existing error", async (context) => {
  const harness = createHarness(context);
  (await openSettings(harness)).handlePrintConfirm(settings);
  harness.submissions[0].reject(new Error("server failure"));
  await flushResponses();
  let flow = harness.render();
  assert.equal(flow.isPrintStarting, false);
  assert.equal(flow.isPrintModalOpen, true);
  assert.equal(flow.printStartError, "출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
  assert.equal(flow.printSuccessPhase, "hidden");
  flow.handlePrintConfirm(settings);
  flow = harness.render();
  assert.equal(flow.printStartError, null);
  assert.equal(flow.isPrintStarting, true);
  harness.submissions[1].resolve(printTask());
  await flushResponses();
  assert.equal(harness.render().printSuccessPhase, "visible");
  flow.resetPrintFlow();
  assertReset(harness.render());
  assert.equal(harness.timers.size, 0);
});

test("close callbacks stay stable; closing during submission does not cancel its result", async (context) => {
  const harness = createHarness(context);
  const initial = harness.render();
  let flow = await openSettings(harness);
  for (const action of ["handlePrintModalClose", "handlePrinterConnectionModalClose", "closePrintSetup"]) {
    assert.equal(flow[action], initial[action], action);
  }
  flow.handlePrintConfirm(settings);
  flow.handlePrintModalClose();
  assert.equal(harness.render().isPrintModalOpen, false);
  harness.submissions[0].resolve(printTask());
  await flushResponses();
  flow = harness.render();
  assert.equal(flow.isPrintModalOpen, false);
  assert.equal(flow.printSuccessPhase, "visible");
  harness.unmount();
  assert.equal(harness.timers.size, 0);
});

test("legacy timing: fading cleans up the pending hide timer; reset still hides the notice", async (context) => {
  const harness = createHarness(context);
  (await openSettings(harness)).handlePrintConfirm(settings);
  harness.submissions[0].resolve(printTask());
  await flushResponses();
  assert.equal(harness.render().printSuccessPhase, "visible");
  assert.equal(harness.timers.size, 2);
  assert.equal(harness.advance(3499).printSuccessPhase, "visible");
  assert.equal(harness.advance(1).printSuccessPhase, "fading");
  assert.equal(harness.timers.size, 0);
  const flow = harness.advance(500);
  assert.equal(flow.printSuccessPhase, "fading");
  flow.resetPrintFlow();
  assertReset(harness.render());
});

test("legacy ordering: repeated same-render checks are not locked; completion order wins", async (context) => {
  const harness = createHarness(context);
  const flow = harness.render();
  flow.handlePrintOpen();
  flow.handlePrintOpen();
  assert.equal(harness.queries.length, 2);
  harness.queries[1].resolve(null);
  await flushResponses();
  assert.equal(harness.render().isPrintModalOpen, true);
  harness.queries[0].reject(new Error("late failure"));
  await flushResponses();
  assert.equal(harness.render().isPrintCheckFailed, true);
  assert.equal(harness.render().isPrintModalOpen, false);
});

test("legacy ordering: repeated same-render submissions are not locked", async (context) => {
  const harness = createHarness(context);
  const flow = await openSettings(harness);
  flow.handlePrintConfirm(settings);
  flow.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 2);
  harness.submissions[0].resolve(printTask());
  await flushResponses();
  assert.equal(harness.render().isPrintStarting, false);
  harness.submissions[1].reject(new Error("late failure"));
  await flushResponses();
  assert.equal(harness.render().printSuccessPhase, "visible");
  assert.equal(harness.render().printStartError, "출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
});

test("legacy closure: a pending check uses connection state from its initiating render", async (context) => {
  const harness = createHarness(context);
  harness.render().handlePrintOpen();
  harness.render({ isPrinterConnected: false });
  harness.queries[0].resolve(null);
  await flushResponses();
  const flow = harness.render();
  assert.equal(flow.isPrintModalOpen, true);
  assert.equal(flow.isPrinterConnectionModalOpen, false);
});

for (const operation of ["query", "submit"]) {
  test("legacy reset: a pending " + operation + " still applies its late response", async (context) => {
    const harness = createHarness(context);
    let flow;
    if (operation === "query") {
      flow = harness.render();
      flow.handlePrintOpen();
    } else {
      flow = await openSettings(harness);
      flow.handlePrintConfirm(settings);
    }
    flow.resetPrintFlow();
    assertReset(harness.render({ isGenerated: false }));
    if (operation === "query") harness.queries.at(-1).resolve(null);
    else harness.submissions[0].resolve(printTask());
    await flushResponses();
    flow = harness.render();
    if (operation === "query") assert.equal(flow.isPrintModalOpen, true);
    else assert.equal(flow.printSuccessPhase, "visible");
  });
}

for (const operation of ["query", "submit"]) {
  test("legacy unmount: pending " + operation + " callbacks still attempt state updates", async (context) => {
    const harness = createHarness(context);
    if (operation === "query") harness.render().handlePrintOpen();
    else (await openSettings(harness)).handlePrintConfirm(settings);
    harness.unmount();
    if (operation === "query") harness.queries.at(-1).resolve(null);
    else harness.submissions[0].resolve(printTask());
    await flushResponses();
    assert(harness.updatesAfterUnmount > 0);
    assert.equal(harness.timers.size, 0);
  });
}
