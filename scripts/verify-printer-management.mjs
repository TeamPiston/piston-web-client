import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Exercise the real provider and hooks with deterministic state and context slots.
// This verifies state transitions, not browser rendering or React scheduling.
function runtime(initialPrinters) {
  const modules = new Map();
  const contexts = new Map();
  const state = new Map();
  let component;
  let index;
  function memoize(factory, dependencies) {
    const slots = state.get(component);
    const slot = index++;
    const previous = slots[slot];
    if (
      !previous ||
      previous.dependencies.length !== dependencies.length ||
      !dependencies.every((dependency, i) => Object.is(dependency, previous.dependencies[i]))
    ) {
      slots[slot] = { value: factory(), dependencies: [...dependencies] };
    }
    return slots[slot].value;
  }
  const react = {
    createContext: () => {
      const context = {};
      context.Provider = context;
      return context;
    },
    useContext: (context) => contexts.get(context) ?? null,
    useState: (initial) => {
      const slots = state.get(component);
      const slot = index++;
      if (!(slot in slots)) {
        const cell = { value: typeof initial === "function" ? initial() : initial };
        cell.setValue = (next) => {
          cell.value = typeof next === "function" ? next(cell.value) : next;
        };
        slots[slot] = cell;
      }
      return [slots[slot].value, slots[slot].setValue];
    },
    useMemo: memoize,
    useCallback: (callback, dependencies) => memoize(() => callback, dependencies),
  };
  const jsx = (type, props) => ({ type, props });
  function load(relative) {
    const path = resolve(root, relative);
    if (modules.has(path)) return modules.get(path).exports;
    const mod = { exports: {} };
    modules.set(path, mod);
    const source = ts.transpileModule(readFileSync(path, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.ReactJSX,
      },
      fileName: path,
    }).outputText;
    const requireSource = (specifier) => {
      if (specifier === "react") return react;
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx };
      const target = specifier.startsWith("@/")
        ? resolve(root, "src", specifier.slice(2))
        : resolve(dirname(path), specifier);
      for (const candidate of [target + ".ts", target + ".tsx", resolve(target, "index.ts")]) {
        try {
          readFileSync(candidate);
        } catch (error) {
          if (error.code === "ENOENT") continue;
          throw error;
        }
        return load(candidate);
      }
      throw new Error("Unresolved import: " + specifier);
    };
    new Script("(function(require, module, exports) {\n" + source + "\n})", {
      filename: path,
    }).runInNewContext({ crypto: { randomUUID } })(requireSource, mod, mod.exports);
    return mod.exports;
  }
  function render(name, fn) {
    component = name;
    index = 0;
    if (!state.has(name)) state.set(name, []);
    return fn();
  }
  const entity = load("src/entities/printer/index.ts");
  const feature = load("src/features/printer-management/index.ts");
  assert.throws(() => entity.usePrinterQuery(), /PrinterProvider/);
  assert.throws(() => feature.usePrinterActions(), /PrinterProvider/);
  return () => {
    let tree = render("provider", () => feature.PrinterProvider({ initialPrinters, children: null }));
    while (tree) {
      contexts.set(tree.type, tree.props.value);
      tree = tree.props.children;
    }
    return {
      query: entity.usePrinterQuery(),
      actions: feature.usePrinterActions(),
      management: render("management", feature.usePrinterManagement),
    };
  };
}

const render = runtime([]);
let view = render();
assert.equal(view.query.printers.length, 0);
assert.equal(view.query.connectedPrinter, null);
assert.equal(view.query.isPrinterConnected, false);
assert.deepEqual(Object.keys(view.query).sort(), [
  "connectedPrinter", "isPrinterConnected", "printJob", "printStatus", "printers",
]);
const draft = { name: "Classroom", model: "QIDI X-Max 4", ipAddress: "192.168.0.31" };
view.management.openAddForm();
view = render();
assert.equal(view.management.isFormOpen, true);
view.management.savePrinter(draft, null);
assert.equal(render().query.printers.length, 0);
assert.equal(view.management.testPrinterConnection({ ...draft, ipAddress: "192.168.0.99" }).status, "disconnected");
const tested = view.management.testPrinterConnection(draft);
assert.equal(tested.status, "connected");
view.management.savePrinter(draft, tested.status);
view = render();
assert.equal(view.query.printers.length, 1);
assert.equal(view.query.isPrinterConnected, true);
assert.equal(view.management.isFormOpen, false);
const printerId = view.query.connectedPrinter.id;
const job = { printerId, colorMode: "single", stlUrl: "/test.stl", title: "Test" };
assert.equal(view.actions.startPrint({ ...job, printerId: "missing" }), false);
assert.equal(render().query.printJob, null);
assert.equal(view.actions.startPrint(job), true);
view = render();
assert.equal(view.query.printStatus, "PRINTING");
assert.equal(view.query.printJob, job);
console.log("PASS empty state, read-only query, tested registration and print control");

view.management.openEditForm(view.query.printers[0]);
view = render();
view.management.savePrinter({ ...draft, name: "Renamed" }, null);
view = render();
assert.equal(view.query.connectedPrinter.name, "Renamed");
view.management.openEditForm(view.query.printers[0]);
view = render();
view.management.savePrinter({ ...draft, ipAddress: "192.168.0.99" }, null);
view = render();
assert.equal(view.query.connectedPrinter, null);
assert.equal(view.actions.startPrint(job), false);
view.management.checkPrinterConnection(view.query.printers[0]);
assert.equal(render().query.isPrinterConnected, false);
view.management.openEditForm(view.query.printers[0]);
view = render();
view.management.savePrinter(draft, null);
view = render();
assert.equal(view.query.isPrinterConnected, false);
view.management.checkPrinterConnection(view.query.printers[0]);
view = render();
assert.equal(view.query.isPrinterConnected, true);
view.management.openDeleteForm(view.query.printers[0]);
view = render();
view.management.deletePrinter("missing");
assert.equal(render().query.printers.length, 1);
view.management.closeDeleteForm();
assert.equal(render().management.deletingPrinter, null);
view.management.openDeleteForm(view.query.printers[0]);
view = render();
view.management.deletePrinter(printerId);
view = render();
assert.equal(view.query.printers.length, 0);
assert.equal(view.query.isPrinterConnected, false);
assert.equal(view.management.deletingPrinter, null);
assert.equal(view.query.printStatus, "EMPTY", "Deleting the active printer must clear PRINTING");
assert.equal(view.query.printJob, null, "Deleted printers must not remain in the print job");
console.log("PASS edit, connection invalidation/recheck and confirmed deletion");

const first = runtime();
const second = runtime();
const original = first().query.printers[0];
let firstView = first();
firstView.management.openDeleteForm(original);
firstView = first();
firstView.management.deletePrinter(original.id);
assert.equal(first().query.printers.length, 1);
assert.equal(first().query.printStatus, "EMPTY");
assert.equal(first().query.printJob, null);
assert.equal(second().query.printers.length, 2);
assert.equal(runtime([])().query.printers.length, 0);
console.log("PASS default fixtures, provider isolation and explicit empty preview");

const printerA = { ...draft, id: "printer-a", connectionStatus: "connected" };
const printerB = { ...draft, id: "printer-b", connectionStatus: "connected" };
const jobA = { ...job, printerId: printerA.id };
const jobB = { ...job, printerId: printerB.id };

for (const deletingActivePrinter of [true, false]) {
  const renderDeletion = runtime([printerA, printerB]);
  let deletion = renderDeletion();
  assert.equal(deletion.actions.startPrint(jobA), true);
  deletion = renderDeletion();
  assert.equal(deletion.query.printStatus, "PRINTING");
  assert.equal(deletion.query.printJob, jobA);
  const target = deletingActivePrinter ? printerA : printerB;
  deletion.management.openDeleteForm(target);
  deletion = renderDeletion();
  deletion.management.deletePrinter(target.id);
  deletion = renderDeletion();
  assert.equal(deletion.query.printers.length, 1);
  assert.equal(deletion.query.printers.some((printer) => printer.id === target.id), false);
  assert.equal(deletion.query.printStatus, deletingActivePrinter ? "EMPTY" : "PRINTING");
  assert.equal(deletion.query.printJob, deletingActivePrinter ? null : jobA);
}
console.log("PASS active printer deletion clears the job; other printer deletion preserves it");

// Start/change the job after opening confirmation, without refreshing its callbacks.
for (const nextJob of [jobA, jobB]) {
  const renderPendingDeletion = runtime([printerA, printerB]);
  renderPendingDeletion().management.openDeleteForm(printerA);
  const pendingDeletion = renderPendingDeletion();
  assert.equal(pendingDeletion.actions.startPrint(nextJob), true);
  pendingDeletion.management.deletePrinter(printerA.id);
  const result = renderPendingDeletion();
  assert.equal(result.query.printers.some((printer) => printer.id === printerA.id), false);
  assert.equal(result.query.printStatus, nextJob === jobA ? "EMPTY" : "PRINTING");
  assert.equal(result.query.printJob, nextJob === jobA ? null : jobB);
}
console.log("PASS deletion uses the latest job even before callbacks re-render");

const renderReferences = runtime([printerA, printerB]);
let references = renderReferences();
const initialActions = references.actions;
assert.equal(renderReferences().actions, initialActions, "Unchanged renders must reuse Actions value");
assert.equal(initialActions.startPrint(jobA), true);
references = renderReferences();
assert.equal(references.query.printStatus, "PRINTING");
assert.equal(references.query.printJob, jobA);
assert.equal(references.actions, initialActions, "Print state changes must not change Actions value");
assert.equal(references.actions.startPrint, initialActions.startPrint);
assert.equal(references.actions.removePrinter, initialActions.removePrinter);
references.management.openAddForm();
assert.equal(renderReferences().actions, initialActions, "Form state changes must not change Actions value");

references.actions.setPrinters((printers) =>
  printers.map((printer) => printer.id === printerA.id
    ? { ...printer, connectionStatus: "disconnected" }
    : printer),
);
references = renderReferences();
assert.notEqual(references.actions, initialActions);
assert.notEqual(references.actions.startPrint, initialActions.startPrint);
assert.equal(references.actions.removePrinter, initialActions.removePrinter);
assert.equal(references.actions.setPrinters, initialActions.setPrinters);
assert.equal(references.actions.startPrint(jobA), false, "Updated actions must see a disconnected printer");
const disconnectedActions = references.actions;
assert.equal(renderReferences().actions, disconnectedActions);

references.actions.setPrinters((printers) =>
  printers.map((printer) => printer.id === printerA.id
    ? { ...printer, connectionStatus: "connected" }
    : printer),
);
references = renderReferences();
assert.equal(references.actions.startPrint(jobA), true, "Updated actions must see a reconnected printer");
const reconnectedActions = references.actions;
assert.equal(renderReferences().actions, reconnectedActions);
initialActions.removePrinter(printerA.id);
references = renderReferences();
assert.equal(references.query.printers.some((printer) => printer.id === printerA.id), false);
assert.equal(references.query.printJob, null);
assert.equal(references.query.printStatus, "EMPTY");
assert.equal(references.actions.startPrint(jobA), false, "Updated actions must reject a deleted printer");
assert.equal(references.actions.removePrinter, initialActions.removePrinter);
console.log("PASS stable Actions value across unrelated updates and fresh printer-dependent actions");

const editedPrinter = { ...printerA, ipAddress: "192.168.0.20" };
const otherPrinter = {
  ...printerB,
  ipAddress: "192.168.0.30",
  model: "QIDI X-Plus 4",
  connectionStatus: "disconnected",
};
const renderConnections = runtime([editedPrinter, otherPrinter]);
let connections = renderConnections();
connections.management.openEditForm(connections.query.printers[0]);
connections = renderConnections();
const originalPrinters = connections.query.printers;
assert.equal(connections.management.testPrinterConnection(editedPrinter).status, "connected");
const otherAddressResult = connections.management.testPrinterConnection(otherPrinter);
assert.equal(otherAddressResult.status, "connected", "Changed input must use a fresh mock, not another printer's disconnected state");
assert.equal(otherAddressResult.model, otherPrinter.model);
assert.equal(connections.management.testPrinterConnection({
  ...editedPrinter, ipAddress: "192.168.0.42",
}).status, "connected");
assert.equal(connections.management.testPrinterConnection({
  ...editedPrinter, model: "QIDI Q1 Pro",
}).status, "connected");
assert.equal(connections.management.testPrinterConnection({
  ...editedPrinter, ipAddress: " 192.168.0.99 ",
}).status, "disconnected");
assert.equal(renderConnections().query.printers, originalPrinters, "Connection previews must not mutate stored printers");

connections.management.savePrinter({
  name: otherPrinter.name,
  model: otherPrinter.model,
  ipAddress: otherPrinter.ipAddress,
}, otherAddressResult.status);
connections = renderConnections();
assert.equal(connections.query.printers[0].id, editedPrinter.id);
assert.equal(connections.query.printers[0].connectionStatus, "connected");
assert.equal(connections.query.printers[1].id, otherPrinter.id);
assert.equal(connections.query.printers[1].connectionStatus, "disconnected");
connections.management.openEditForm(connections.query.printers[1]);
connections = renderConnections();
assert.equal(
  connections.management.testPrinterConnection(otherPrinter).status,
  "disconnected",
  "Identical IP/model records must still use the edited printer's ID",
);
connections.actions.setPrinters((printers) => printers.map((printer) =>
  printer.id === otherPrinter.id ? { ...printer, connectionStatus: "connected" } : printer,
));
connections = renderConnections();
assert.equal(connections.management.testPrinterConnection(otherPrinter).status, "connected", "Unchanged input must read the latest state of the edited ID");

connections.management.openAddForm();
connections = renderConnections();
const newDraft = { ...draft, ipAddress: "192.168.0.44" };
assert.equal(connections.management.testPrinterConnection(newDraft).status, "connected");
const failedRegistration = connections.management.testPrinterConnection({
  ...newDraft, ipAddress: "192.168.0.99",
});
assert.equal(failedRegistration.status, "disconnected");
connections.management.savePrinter(newDraft, failedRegistration.status);
assert.equal(renderConnections().query.printers.length, 2);
connections.management.savePrinter(newDraft, "connected");
assert.equal(renderConnections().query.printers.length, 3);
assert.equal(renderConnections().query.printers[1].connectionStatus, "connected");
console.log("PASS ID-scoped edit connection checks, changed addresses/models, isolated mock previews and registration scenarios");

await import("./verify-printer-focus.mjs");
