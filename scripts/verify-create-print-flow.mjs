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
  let stateUpdates = 0;
  let updatesAfterUnmount = 0;
  function registerEffect(setup, dependencies, phase) {
    const slot = cursor++;
    const previous = effects.get(slot);
    if (!previous || dependencies.length !== previous.dependencies.length ||
        !dependencies.every((value, index) => Object.is(value, previous.dependencies[index]))) {
      effects.set(slot, { setup, dependencies, phase, cleanup: previous?.cleanup });
      pendingEffects.add(slot);
    }
  }
  function flushEffects(phase) {
    for (const slot of pendingEffects) {
      const effect = effects.get(slot);
      if (effect.phase !== phase) continue;
      effect.cleanup?.();
      effect.cleanup = effect.setup();
      pendingEffects.delete(slot);
    }
  }
  const react = {
    useRef(initial) {
      const slot = cursor++;
      if (!(slot in slots)) slots[slot] = { current: initial };
      return slots[slot];
    },
    useState(initial) {
      const slot = cursor++;
      if (!(slot in slots)) {
        const cell = { value: typeof initial === "function" ? initial() : initial };
        cell.set = (next) => {
          stateUpdates += 1;
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
      registerEffect(setup, dependencies, "passive");
    },
    useLayoutEffect(setup, dependencies) {
      registerEffect(setup, dependencies, "layout");
    },
  };
  const enqueue = (requests, args) => new Promise((resolve, reject) => {
    requests.push({ args, resolve, reject });
  });
  const api = {
    getCurrentPrintTask: (...args) => enqueue(queries, args),
    createPrintTask: (...args) => enqueue(submissions, args),
  };
  const exports = {};
  new Script(source, { filename: path }).runInNewContext({
    exports,
    require(specifier) {
      if (specifier === "react") return react;
      assert.equal(specifier, "@/entities/print");
      return api;
    },
    window: {
      setTimeout(callback, delay) {
        timers.set(++timerId, { callback, due: now + delay });
        return timerId;
      },
      clearTimeout: (timer) => timers.delete(timer),
    },
  });
  function render(nextOptions = {}, { flushPassiveEffects = true } = {}) {
    assert(mounted, "Cannot render an unmounted harness");
    flushEffects("passive");
    options = { ...options, ...nextOptions };
    cursor = 0;
    const result = exports.useCreatePrintFlow(options);
    flushEffects("layout");
    if (flushPassiveEffects) flushEffects("passive");
    return result;
  }
  function unmount() {
    mounted = false;
    for (const effect of effects.values()) effect.cleanup?.();
    effects.clear();
    pendingEffects.clear();
  }
  context.after(() => {
    unmount();
    assert.equal(timers.size, 0, "Success timers must be cleaned up");
  });
  return {
    render, unmount, queries, submissions, timers, api,
    get stateUpdates() { return stateUpdates; },
    get updatesAfterUnmount() { return updatesAfterUnmount; },
    replayMountEffects() {
      for (const effect of effects.values()) effect.cleanup?.();
      for (const phase of ["layout", "passive"]) {
        for (const effect of effects.values()) {
          if (effect.phase === phase) effect.cleanup = effect.setup();
        }
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

for (const outcome of ["success", "failure"]) {
  test("same-render queries stay locked until " + outcome + " and then allow another check", async (context) => {
    const harness = createHarness(context);
    let flow = harness.render();
    const initial = flow;
    flow.handlePrintOpen();
    flow.handlePrintOpen();
    assert.equal(harness.queries.length, 1);
    flow = harness.render();
    assert.equal(flow.isPrintStatusChecking, true);
    flow.handlePrintOpen();
    flow.closePrintSetup();
    harness.render().handlePrintOpen();
    initial.handlePrintOpen();
    assert.equal(harness.queries.length, 1);
    if (outcome === "success") harness.queries[0].resolve(null);
    else harness.queries[0].reject(new Error("offline"));
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintModalOpen, outcome === "success");
    assert.equal(flow.isPrintCheckFailed, outcome === "failure");
    flow.handlePrintOpen();
    flow.handlePrintOpen();
    assert.equal(harness.queries.length, 2);
    harness.queries[1].resolve(null);
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintModalOpen, true);
    assert.equal(flow.isPrintCheckFailed, false);
    assert.equal(flow.isPrintStatusChecking, false);
  });

  test("same-render submissions stay locked until " + outcome + " and then allow another print", async (context) => {
    const harness = createHarness(context);
    let flow = await openSettings(harness);
    const initial = flow;
    flow.handlePrintConfirm(settings);
    flow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 1);
    flow = harness.render();
    assert.equal(flow.isPrintStarting, true);
    flow.handlePrintConfirm(settings);
    flow.handlePrintModalClose();
    harness.render().handlePrintConfirm(settings);
    initial.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 1);
    if (outcome === "success") harness.submissions[0].resolve(printTask());
    else harness.submissions[0].reject(new Error("offline"));
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintStarting, false);
    assert.equal(flow.isPrintModalOpen, false);
    assert.equal(flow.printSuccessPhase, outcome === "success" ? "visible" : "hidden");
    assert.equal(flow.printStartError, outcome === "failure"
      ? "출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요." : null);
    flow = await openSettings(harness);
    assert.equal(flow.printStartError, null);
    flow.handlePrintConfirm(settings);
    flow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 2);
    harness.submissions[1].resolve(printTask());
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintStarting, false);
    assert.equal(flow.isPrintModalOpen, false);
    assert.equal(flow.printSuccessPhase, "visible");
  });
}

for (const operation of ["query", "submit"]) {
  test("reset does not release an in-flight " + operation + " lock", async (context) => {
    const harness = createHarness(context);
    const initial = operation === "query" ? harness.render() : await openSettings(harness);
    if (operation === "query") initial.handlePrintOpen();
    else initial.handlePrintConfirm(settings);
    initial.resetPrintFlow();
    assertReset(harness.render());
    if (operation === "query") {
      initial.handlePrintOpen();
      harness.render().handlePrintOpen();
      assert.equal(harness.queries.length, 1);
      harness.queries[0].resolve(null);
    } else {
      initial.handlePrintConfirm(settings);
      const reopened = await openSettings(harness);
      reopened.handlePrintConfirm(settings);
      reopened.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, 1);
      harness.submissions[0].resolve(printTask());
    }
    await flushResponses();
    let flow = harness.render();
    if (operation === "query") {
      assertReset(flow);
      flow.handlePrintOpen();
      assert.equal(harness.queries.length, 2);
      harness.queries[1].resolve(null);
    } else {
      assert.equal(flow.printSuccessPhase, "hidden");
      assert.equal(flow.isPrintModalOpen, true);
      flow = await openSettings(harness);
      flow.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, 2);
      harness.submissions[1].resolve(printTask());
    }
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintStarting, false);
  });

  test("synchronous " + operation + " exceptions release the lock and allow retry", async (context) => {
    const harness = createHarness(context);
    let flow = operation === "query" ? harness.render() : await openSettings(harness);
    const method = operation === "query" ? "getCurrentPrintTask" : "createPrintTask";
    const request = harness.api[method];
    let calls = 0;
    harness.api[method] = (...args) => {
      calls += 1;
      if (calls === 1) throw new Error("synchronous failure");
      return request(...args);
    };
    assert.doesNotThrow(() => {
      if (operation === "query") flow.handlePrintOpen();
      else flow.handlePrintConfirm(settings);
    });
    await flushResponses();
    flow = harness.render();
    assert.equal(calls, 1);
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintStarting, false);
    if (operation === "query") {
      assert.equal(flow.isPrintCheckFailed, true);
      assert.equal(flow.isPrintModalOpen, false);
      flow.handlePrintOpen();
      flow.handlePrintOpen();
      assert.equal(harness.queries.length, 1);
      harness.queries[0].resolve(null);
    } else {
      assert.equal(flow.isPrintModalOpen, true);
      assert.equal(flow.printStartError, "출력 시작에 실패했어요. 잠시 후 다시 시도해 주세요.");
      flow.handlePrintConfirm(settings);
      flow.handlePrintConfirm(settings);
      assert.equal(harness.render().printStartError, null);
      assert.equal(harness.submissions.length, 1);
      harness.submissions[0].resolve(printTask());
    }
    assert.equal(calls, 2);
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintStarting, false);
    assert.equal(flow.isPrintCheckFailed, false);
    assert.equal(flow.printStartError, null);
    assert.equal(flow.isPrintModalOpen, operation === "query");
    assert.equal(flow.printSuccessPhase, operation === "query" ? "hidden" : "visible");
  });
}

for (const firstCompleted of ["query", "submit"]) {
  test("query and submit locks remain independent when " + firstCompleted + " finishes first", async (context) => {
    const harness = createHarness(context);
    const initial = await openSettings(harness);
    initial.handlePrintConfirm(settings);
    initial.handlePrintOpen();
    assert.equal(harness.queries.length, 2);
    assert.equal(harness.submissions.length, 1);
    if (firstCompleted === "query") harness.queries[1].resolve(null);
    else harness.submissions[0].resolve(printTask());
    await flushResponses();
    harness.render();
    if (firstCompleted === "query") {
      initial.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, 1);
      harness.submissions[0].resolve(printTask());
    } else {
      initial.handlePrintOpen();
      assert.equal(harness.queries.length, 2);
      harness.queries[1].resolve(null);
    }
    await flushResponses();
    const flow = harness.render();
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintStarting, false);
    assert.equal(flow.printSuccessPhase, "visible");
    assert.equal(flow.isPrintModalOpen, firstCompleted === "submit");
  });
}

for (const connections of [[true, true], [true, false], [false, true], [true, false, true], [false, false]]) {
  test("pending checks use the latest committed connection before passive effects: " + connections.join(" -> "), async (context) => {
    const harness = createHarness(context, { isPrinterConnected: connections[0] });
    const initial = harness.render();
    initial.handlePrintOpen();
    initial.handlePrintOpen();
    const updatesBeforeConnection = harness.stateUpdates;
    for (const isPrinterConnected of connections.slice(1)) {
      const pending = harness.render({ isPrinterConnected }, { flushPassiveEffects: false });
      assert.equal(pending.isPrintStatusChecking, true);
      pending.handlePrintOpen();
    }
    assert.equal(harness.stateUpdates, updatesBeforeConnection, "Connection updates must not reset loading or invalidate the request");
    assert.equal(harness.queries.length, 1);
    const task = printTask("COMPLETED");
    harness.queries[0].resolve(task);
    await flushResponses();
    const connected = connections.at(-1);
    let flow = harness.render();
    assert.equal(flow.currentPrintTask, task);
    assert.equal(flow.isPrintModalOpen, connected);
    assert.equal(flow.isPrinterConnectionModalOpen, !connected);
    assert.equal(flow.isPrintInProgressModalOpen, false);
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintCheckFailed, false);
    assert.equal(harness.submissions.length, 0);
    if (!connected) {
      flow.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, 0);
    }
    flow = harness.render({ isPrinterConnected: !connected }, { flushPassiveEffects: false });
    flow.handlePrintOpen();
    flow.handlePrintOpen();
    assert.equal(harness.queries.length, 2, "The completed query must unlock a fresh check using the changed connection");
    harness.queries[1].resolve(null);
    await flushResponses();
    flow = harness.render();
    assert.equal(flow.currentPrintTask, null);
    assert.equal(flow.isPrintModalOpen, !connected);
    assert.equal(flow.isPrinterConnectionModalOpen, connected);
    assert.equal(flow.isPrintStatusChecking, false);
  });
}

for (const initiallyConnected of [true, false]) {
  test("active jobs still take precedence after a connection change from " + initiallyConnected, async (context) => {
    const harness = createHarness(context, { isPrinterConnected: initiallyConnected });
    harness.render().handlePrintOpen();
    harness.render({ isPrinterConnected: !initiallyConnected }, { flushPassiveEffects: false });
    const task = printTask();
    harness.queries[0].resolve(task);
    await flushResponses();
    const flow = harness.render();
    assert.equal(flow.currentPrintTask, task);
    assert.equal(flow.isPrintInProgressModalOpen, true);
    assert.equal(flow.isPrintModalOpen, false);
    assert.equal(flow.isPrinterConnectionModalOpen, false);
    assert.equal(flow.isPrintStatusChecking, false);
    flow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 0);
  });

  test("query failure remains an error after a connection change from " + initiallyConnected, async (context) => {
    const harness = createHarness(context, { isPrinterConnected: initiallyConnected });
    harness.render().handlePrintOpen();
    harness.render({ isPrinterConnected: !initiallyConnected }, { flushPassiveEffects: false });
    harness.queries[0].reject(new Error("query failed"));
    await flushResponses();
    const flow = harness.render();
    assert.equal(flow.isPrintCheckFailed, true);
    assert.equal(flow.isPrintStatusChecking, false);
    assert.equal(flow.isPrintModalOpen, false);
    assert.equal(flow.isPrinterConnectionModalOpen, false);
    assert.equal(flow.isPrintInProgressModalOpen, false);
    assert.equal(flow.currentPrintTask, null);
    flow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 0);
    harness.render({ isPrinterConnected: true });
    assert.equal((await openSettings(harness)).isPrintCheckFailed, false);
    assert.equal(harness.queries.length, 2);
  });
}

for (const lifecycle of ["reset", "unmount"]) {
  for (const outcome of ["success", "failure"]) {
    test("connection changes cannot revive a " + lifecycle + " query " + outcome, async (context) => {
      const harness = createHarness(context);
      harness.render().handlePrintOpen();
      let flow = harness.render({ isPrinterConnected: false });
      if (lifecycle === "reset") {
        flow.resetPrintFlow();
        flow = harness.render({ isPrinterConnected: true });
        assertReset(flow);
      } else {
        harness.unmount();
      }
      flow.handlePrintOpen();
      assert.equal(harness.queries.length, 1);
      const updatesBeforeResponse = harness.stateUpdates;
      if (outcome === "success") harness.queries[0].resolve(null);
      else harness.queries[0].reject(new Error("late query failure"));
      await flushResponses();
      assert.equal(harness.stateUpdates, updatesBeforeResponse);
      assert.equal(harness.updatesAfterUnmount, 0);
      if (lifecycle === "reset") {
        assertReset(harness.render());
        await openSettings(harness);
        assert.equal(harness.queries.length, 2);
      }
    });
  }
}

test("connection changes leave an already submitted request valid", async (context) => {
  const harness = createHarness(context);
  (await openSettings(harness)).handlePrintConfirm(settings);
  const pending = harness.render({ isPrinterConnected: false });
  assert.equal(pending.isPrintStarting, true);
  pending.handlePrintConfirm(settings);
  assert.equal(harness.submissions.length, 1);
  harness.submissions[0].resolve(printTask());
  await flushResponses();
  const flow = harness.render();
  assert.equal(flow.isPrintStarting, false);
  assert.equal(flow.isPrintModalOpen, false);
  assert.equal(flow.printSuccessPhase, "visible");
});

for (const operation of ["query", "submit"]) {
  for (const outcome of ["success", "failure"]) {
    test("reset ignores pending " + operation + " " + outcome + " and permits a new generation", async (context) => {
      const harness = createHarness(context);
      let flow = operation === "query" ? harness.render() : await openSettings(harness);
      if (operation === "query") flow.handlePrintOpen();
      else flow.handlePrintConfirm(settings);
      const request = operation === "query" ? harness.queries.at(-1) : harness.submissions[0];
      flow.resetPrintFlow();
      flow.resetPrintFlow();
      assertReset(harness.render({ isGenerated: false }));
      const updatesBeforeResponse = harness.stateUpdates;
      if (outcome === "success") request.resolve(printTask());
      else request.reject(new Error("late failure"));
      await flushResponses();
      assert.equal(harness.stateUpdates, updatesBeforeResponse, "Stale success, catch and finally must not call setters");
      assertReset(harness.render());
      assert.equal(harness.timers.size, 0);
      harness.render({ isGenerated: true });
      flow = await openSettings(harness);
      assert.equal(harness.queries.length, 2);
      flow.handlePrintConfirm(settings);
      flow.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, operation === "query" ? 1 : 2);
      harness.submissions.at(-1).resolve(printTask());
      await flushResponses();
      flow = harness.render();
      assert.equal(flow.isPrintStarting, false);
      assert.equal(flow.isPrintModalOpen, false);
      assert.equal(flow.printSuccessPhase, "visible");
    });

    test("unmount ignores pending " + operation + " " + outcome + " without affecting a fresh mount", async (context) => {
      const harness = createHarness(context);
      if (operation === "query") harness.render().handlePrintOpen();
      else (await openSettings(harness)).handlePrintConfirm(settings);
      const request = operation === "query" ? harness.queries.at(-1) : harness.submissions[0];
      harness.unmount();
      const updatesBeforeResponse = harness.stateUpdates;
      const fresh = createHarness(context);
      fresh.render();
      fresh.replayMountEffects();
      const initial = operation === "query" ? fresh.render() : await openSettings(fresh);
      if (operation === "query") initial.handlePrintOpen();
      else initial.handlePrintConfirm(settings);
      const freshUpdates = fresh.stateUpdates;
      if (outcome === "success") request.resolve(printTask());
      else request.reject(new Error("late failure"));
      await flushResponses();
      assert.equal(harness.updatesAfterUnmount, 0);
      assert.equal(harness.stateUpdates, updatesBeforeResponse);
      assert.equal(harness.timers.size, 0);
      assert.equal(fresh.stateUpdates, freshUpdates);
      if (operation === "query") {
        initial.handlePrintOpen();
        assert.equal(fresh.queries.length, 1);
        assert.equal(fresh.render().isPrintStatusChecking, true);
        fresh.queries[0].resolve(null);
      } else {
        initial.handlePrintConfirm(settings);
        assert.equal(fresh.submissions.length, 1);
        assert.equal(fresh.render().isPrintStarting, true);
        fresh.submissions[0].resolve(printTask());
      }
      await flushResponses();
      const flow = fresh.render();
      assert.equal(flow.isPrintStatusChecking, false);
      assert.equal(flow.isPrintStarting, false);
      assert.equal(flow.isPrintModalOpen, operation === "query");
      assert.equal(flow.printSuccessPhase, operation === "query" ? "hidden" : "visible");
    });
  }

  for (const outcome of ["success", "failure"]) {
    test("effect replay ignores earlier " + operation + " " + outcome + " and permits retry without reset", async (context) => {
      const harness = createHarness(context);
      if (operation === "query") harness.render().handlePrintOpen();
      else (await openSettings(harness)).handlePrintConfirm(settings);
      const request = operation === "query" ? harness.queries.at(-1) : harness.submissions[0];
      harness.replayMountEffects();
      let flow = harness.render();
      assert.equal(flow.isPrintStatusChecking, false);
      assert.equal(flow.isPrintStarting, false);
      if (operation === "query") flow.handlePrintOpen();
      else flow.handlePrintConfirm(settings);
      assert.equal(harness.queries.length, 1, "Effect replay must not release the pending query lock");
      assert.equal(harness.submissions.length, operation === "query" ? 0 : 1);
      const updatesBeforeResponse = harness.stateUpdates;
      if (outcome === "success") request.resolve(printTask());
      else request.reject(new Error("late failure"));
      await flushResponses();
      assert.equal(harness.stateUpdates, updatesBeforeResponse);
      assert.equal(harness.timers.size, 0);
      flow = harness.render();
      assert.equal(flow.isPrintStatusChecking, false);
      assert.equal(flow.isPrintStarting, false);
      assert.equal(flow.isPrintModalOpen, operation === "submit");
      assert.equal(flow.isPrintInProgressModalOpen, false);
      assert.equal(flow.isPrintCheckFailed, false);
      assert.equal(flow.printStartError, null);
      assert.equal(flow.currentPrintTask, null);
      assert.equal(flow.printSuccessPhase, "hidden");
      flow = await openSettings(harness);
      assert.equal(harness.queries.length, 2, "The same instance must permit a new query without reset");
      flow.handlePrintConfirm(settings);
      flow.handlePrintConfirm(settings);
      assert.equal(harness.submissions.length, operation === "query" ? 1 : 2);
      harness.submissions.at(-1).resolve(printTask());
      await flushResponses();
      flow = harness.render();
      assert.equal(flow.isPrintStarting, false);
      assert.equal(flow.isPrintModalOpen, false);
      assert.equal(flow.printSuccessPhase, "visible");
    });
  }
}

for (const outcome of ["success", "failure"]) {
  test("stale submit " + outcome + " preserves new settings and the new query lock", async (context) => {
    const harness = createHarness(context);
    (await openSettings(harness)).handlePrintConfirm(settings);
    harness.render().resetPrintFlow();
    const newTask = printTask("COMPLETED");
    harness.render().handlePrintOpen();
    harness.queries[1].resolve(newTask);
    await flushResponses();
    const newFlow = harness.render();
    assert.equal(newFlow.isPrintModalOpen, true);
    newFlow.handlePrintOpen();
    newFlow.handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 1, "Reset must not unlock the old submission");
    const updatesBeforeResponse = harness.stateUpdates;
    if (outcome === "success") harness.submissions[0].resolve(printTask());
    else harness.submissions[0].reject(new Error("late failure"));
    await flushResponses();
    const flow = harness.render();
    assert.equal(harness.stateUpdates, updatesBeforeResponse);
    assert.equal(flow.isPrintModalOpen, true);
    assert.equal(flow.isPrintStatusChecking, true);
    assert.equal(flow.currentPrintTask, newTask);
    assert.equal(flow.printSuccessPhase, "hidden");
    assert.equal(flow.printStartError, null);
    newFlow.handlePrintOpen();
    assert.equal(harness.queries.length, 3, "Stale submit finally must not unlock the current query");
    harness.queries[2].resolve(null);
    await flushResponses();
    harness.render().handlePrintConfirm(settings);
    assert.equal(harness.submissions.length, 2);
    harness.submissions[1].resolve(printTask());
    await flushResponses();
    assert.equal(harness.render().printSuccessPhase, "visible");
  });
}
