import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import ts from "typescript";

const path = fileURLToPath(new URL("../src/features/printer-management/ui/printer-modal-shell.tsx", import.meta.url));
const source = ts.transpileModule(readFileSync(path, "utf8"), {
  compilerOptions: {
    module: ts.ModuleKind.CommonJS,
    target: ts.ScriptTarget.ES2022,
    jsx: ts.JsxEmit.ReactJSX,
  },
  fileName: path,
}).outputText;

// Simulate DOM focus and the passive-effect cleanup after DOM removal.
// Native browser focus trapping and React commit scheduling are not emulated.
function modalHarness({ print = false } = {}) {
  const document = { activeElement: null, body: { style: { overflow: "auto" } } };
  class Element {
    isConnected = true;
    disabled = false;
    hidden = false;
    inert = false;
    visibility = "visible";
    focusable = true;
    focusCalls = 0;
    matches() { return this.disabled; }
    closest() { return this.hidden || this.inert ? this : null; }
    getClientRects() { return this.hidden ? [] : [{}]; }
    focus() {
      this.focusCalls += 1;
      if (this.isConnected && !this.disabled && !this.hidden && !this.inert && this.focusable) {
        document.activeElement = this;
      }
    }
  }
  const effects = [];
  const jsx = (type, props) => ({ type, props });
  const react = {
    useRef: () => ({ current: null }),
    useState: (initial) => [initial, () => {}],
    useEffect: (effect) => effects.push(effect),
  };
  const globals = {
    document,
    HTMLElement: Element,
    getComputedStyle: (element) => ({ visibility: element.visibility }),
  };
  function load(modulePath) {
    const exports = {};
    const compiled = modulePath === path ? source : ts.transpileModule(readFileSync(modulePath, "utf8"), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
      fileName: modulePath,
    }).outputText;
    new Script(compiled, { filename: modulePath }).runInNewContext({ ...globals, exports, require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      if (specifier === "@/shared/ui") return load(fileURLToPath(new URL("../src/shared/ui/use-native-dialog.ts", import.meta.url)));
      if (specifier === "lucide-react") return { X: "X" };
      assert.equal(specifier, "react");
      return react;
    } });
    return exports;
  }
  const exports = load(print ? fileURLToPath(new URL("../src/features/print-artwork/ui/print-settings-modal.tsx", import.meta.url)) : path);
  return {
    document,
    element: () => new Element(),
    mount(previous, getFallbackFocusTargets, returnFocusRef) {
      const dialog = new Element();
      let opened = false;
      let closed = false;
      dialog.showModal = () => { opened = true; document.activeElement = dialog; };
      dialog.close = () => { closed = true; document.activeElement = document.body; };
      dialog.getBoundingClientRect = () => ({ left: 10, right: 100, top: 10, bottom: 100 });
      document.activeElement = previous;
      let closeRequests = 0;
      const render = print ? exports.PrintSettingsModal : exports.PrinterModalShell;
      const tree = render({
        labelledBy: "title",
        isOpen: true, returnFocusRef,
        filamentColors: [], filamentUsage: { length: "1m", weight: "1g" },
        onClose: () => { closeRequests += 1; },
        getFallbackFocusTargets,
      });
      tree.props.ref.current = dialog;
      const cleanup = effects.pop()();
      assert.equal(opened, true);
      assert.equal(document.body.style.overflow, "hidden");
      let prevented = false;
      tree.props.onCancel({ preventDefault: () => { prevented = true; } });
      assert.equal(prevented, true);
      assert.equal(closeRequests, 1, "Native ESC cancel must retain the close handler");
      return (expectedOverflow = "auto") => {
        cleanup();
        assert.equal(closed, true);
        assert.equal(document.body.style.overflow, expectedOverflow);
      };
    },
  };
}

const cancelled = modalHarness();
const deleteButton = cancelled.element();
const addButton = cancelled.element();
cancelled.mount(deleteButton, () => [addButton])();
assert.equal(cancelled.document.activeElement, deleteButton);
assert.equal(addButton.focusCalls, 0);

for (const lastPrinter of [false, true]) {
  const deleted = modalHarness();
  const trigger = deleted.element();
  const add = deleted.element();
  const list = deleted.element();
  list.children = lastPrinter ? [trigger] : [trigger, deleted.element()];
  const cleanup = deleted.mount(trigger, () => [add, list]);
  trigger.isConnected = false;
  list.children = list.children.filter((child) => child !== trigger);
  cleanup();
  assert.equal(deleted.document.activeElement, add, "Deleting a card must focus Add, including empty state");
  assert.equal(trigger.focusCalls, 0);
  assert.equal(list.focusCalls, 0);
  assert.equal(list.children.length, lastPrinter ? 0 : 1);
}

for (const reason of ["disabled", "hidden", "inert", "unfocusable", "disconnected", "visibility"]) {
  const fallback = modalHarness();
  const trigger = fallback.element();
  const add = fallback.element();
  const list = fallback.element();
  const cleanup = fallback.mount(trigger, () => [add, list]);
  trigger.isConnected = false;
  if (reason === "unfocusable") add.focusable = false;
  else if (reason === "disconnected") add.isConnected = false;
  else if (reason === "visibility") add.visibility = "hidden";
  else add[reason] = true;
  cleanup();
  assert.equal(fallback.document.activeElement, list, reason + " Add button must use list fallback");
}

const hiddenTrigger = modalHarness();
const original = hiddenTrigger.element();
const replacement = hiddenTrigger.element();
const cleanup = hiddenTrigger.mount(original, () => [replacement]);
original.disabled = true;
cleanup();
assert.equal(hiddenTrigger.document.activeElement, replacement);

const otherModal = modalHarness();
const editButton = otherModal.element();
otherModal.mount(editButton)();
assert.equal(otherModal.document.activeElement, editButton);
console.log("PASS simulated DOM modal focus: cancel, deletion, unavailable targets, ordinary close and ESC handler");

const printModal = modalHarness({ print: true });
const previous = printModal.element();
const printTrigger = printModal.element();
printModal.mount(previous, undefined, { current: printTrigger })();
assert.equal(printModal.document.activeElement, printTrigger, "Print must prefer its explicit return target");

for (const reason of ["disabled", "hidden", "inert", "disconnected", "visibility"]) {
  const print = modalHarness({ print: true });
  const trigger = print.element();
  const cleanup = print.mount(trigger);
  if (reason === "disconnected") trigger.isConnected = false;
  else if (reason === "visibility") trigger.visibility = "hidden";
  else trigger[reason] = true;
  cleanup();
  assert.equal(trigger.focusCalls, 0, "Print return target must reject " + reason);
  assert.equal(print.document.activeElement, print.document.body);
}
console.log("PASS print modal uses the same native dialog lifecycle and rejects hidden/inert/disabled return targets");

const overlapping = modalHarness();
const closeFirst = overlapping.mount(overlapping.element());
const closeSecond = overlapping.mount(overlapping.element());
closeFirst("hidden");
closeSecond();
const stacked = modalHarness();
stacked.document.body.style.overflow = "clip";
const closeLower = stacked.mount(stacked.element());
const closeUpper = stacked.mount(stacked.element());
closeUpper("hidden");
closeLower("clip");
console.log("PASS shared dialog scroll lock remains owned until the last overlapping dialog closes");
