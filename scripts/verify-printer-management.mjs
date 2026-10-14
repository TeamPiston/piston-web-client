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
      if (!(slot in slots)) slots[slot] = typeof initial === "function" ? initial() : initial;
      return [slots[slot], (next) => {
        slots[slot] = typeof next === "function" ? next(slots[slot]) : next;
      }];
    },
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
console.log("PASS edit, connection invalidation/recheck and confirmed deletion");

const first = runtime();
const second = runtime();
const original = first().query.printers[0];
let firstView = first();
firstView.management.openDeleteForm(original);
firstView = first();
firstView.management.deletePrinter(original.id);
assert.equal(first().query.printers.length, 1);
assert.equal(second().query.printers.length, 2);
assert.equal(runtime([])().query.printers.length, 0);
console.log("PASS default fixtures, provider isolation and explicit empty preview");
