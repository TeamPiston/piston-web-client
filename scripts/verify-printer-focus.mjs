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
function modalHarness() {
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
  const exports = {};
  const dialog = new Element();
  let opened = false;
  let closed = false;
  dialog.showModal = () => { opened = true; document.activeElement = dialog; };
  dialog.close = () => { closed = true; document.activeElement = document.body; };
  dialog.getBoundingClientRect = () => ({ left: 10, right: 100, top: 10, bottom: 100 });
  const jsx = (type, props) => ({ type, props });
  new Script(source, { filename: path }).runInNewContext({
    exports,
    document,
    HTMLElement: Element,
    getComputedStyle: (element) => ({ visibility: element.visibility }),
    require(specifier) {
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      assert.equal(specifier, "react");
      return {
        useRef: () => ({ current: null }),
        useEffect: (effect) => effects.push(effect),
      };
    },
  });
  return {
    document,
    element: () => new Element(),
    mount(previous, getFallbackFocusTargets) {
      document.activeElement = previous;
      let closeRequests = 0;
      const tree = exports.PrinterModalShell({
        labelledBy: "title",
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
      return () => {
        cleanup();
        assert.equal(closed, true);
        assert.equal(document.body.style.overflow, "auto");
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
