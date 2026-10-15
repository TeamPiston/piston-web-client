import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import { randomUUID } from "node:crypto";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// Walk a returned element tree, including elements passed through non-children props,
// and execute function components so Providers created by descendants become visible.
// Only components built from the hooks mocked below can be executed; others are reported
// in `unexecuted` instead of being treated as verified.
function inspectElementTree(root, { isForbidden, renderComponent }) {
  const found = [];
  const rendered = [];
  const unexecuted = [];
  const seen = new WeakSet();
  const visit = (value, path) => {
    if (Array.isArray(value)) {
      value.forEach((child, i) => visit(child, path + "." + i));
      return;
    }
    if (!value || typeof value !== "object" || !("type" in value) || !value.props) return;
    // A child passed as a prop is reached again through the parent's rendered output.
    if (seen.has(value)) return;
    seen.add(value);
    const { type, props } = value;
    if (typeof type === "function" && isForbidden(type)) {
      found.push(path);
      return;
    }
    for (const [key, prop] of Object.entries(props)) visit(prop, path + ":" + key);
    if (typeof type !== "function") return;
    const label = type.name || "anonymous";
    let output;
    try {
      output = renderComponent(type, props, path);
    } catch (error) {
      if (!(error instanceof TypeError) || !/is not a function/.test(error.message)) throw error;
      unexecuted.push(label + " (" + error.message + ")");
      return;
    }
    rendered.push(label);
    visit(output, path + ">" + label);
  };
  visit(root, "root");
  return { found, rendered, unexecuted };
}

function assertNoNestedProvider(inspection, subject) {
  assert.deepEqual(
    inspection.found,
    [],
    subject + " must not create a nested Provider at: " + inspection.found.join(", "),
  );
  return inspection;
}

// Static counterpart: report every use of PrinterProvider other than its declaration and
// import/export specifiers. This cannot see namespace imports or computed references.
function findPrinterProviderUsages(sourceText, fileName) {
  const sourceFile = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022, true);
  const usages = [];
  const visit = (node) => {
    if (ts.isIdentifier(node) && node.text === "PrinterProvider") {
      const parent = node.parent;
      const isDeclarationOrSpecifier =
        ts.isImportSpecifier(parent) || ts.isExportSpecifier(parent) ||
        ts.isJsxClosingElement(parent) ||
        (ts.isFunctionDeclaration(parent) && parent.name === node);
      if (!isDeclarationOrSpecifier) {
        usages.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
      }
    }
    if (ts.isImportSpecifier(node) && node.propertyName?.text === "PrinterProvider" &&
        node.name.text !== "PrinterProvider") {
      usages.push(sourceFile.getLineAndCharacterOfPosition(node.getStart()).line + 1);
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return usages;
}

function listSourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(path);
    return /\.(ts|tsx)$/.test(entry.name) ? [path] : [];
  });
}

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
    useRef: (initial) => memoize(() => ({ current: initial }), []),
    useId: () => "test-id",
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
  const run = (pageProps) => {
    let tree = render("provider", () => feature.PrinterProvider({ initialPrinters, children: null }));
    while (tree) {
      contexts.set(tree.type, tree.props.value);
      tree = tree.props.children;
    }
    const result = {
      query: entity.usePrinterQuery(),
      actions: feature.usePrinterActions(),
      management: render("management", feature.usePrinterManagement),
    };
    if (pageProps !== undefined) {
      const page = load("src/page-slices/mypage/ui/printer-management-page.tsx");
      const content = render("page", () => page.PrinterManagementPage(pageProps));
      result.page = content;
      result.pageInspection = assertNoNestedProvider(inspectTree(content, "page"), "Management page");
    }
    return result;
  };
  const inspectTree = (tree, name) => inspectElementTree(tree, {
    isForbidden: (type) => type === feature.PrinterProvider,
    renderComponent: (type, props, path) => render(name + "/" + path, () => type(props)),
  });
  run.inspectTree = inspectTree;
  run.PrinterProvider = feature.PrinterProvider;
  run.PrinterDeleteModal = feature.PrinterDeleteModal;
  return run;
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

function findElements(node, predicate) {
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  if (!node || typeof node !== "object" || !node.props) return [];
  return [
    ...(predicate(node) ? [node] : []),
    ...findElements(node.props.children, predicate),
  ];
}

const renderPreview = runtime([printerA, printerB]);
let preview = renderPreview({ previewEmpty: false });
assert.equal(findElements(preview.page, (node) => node.type.name === "PrinterCard").length, 2);
// Liveness of the nested-Provider walk: it must have executed the page's descendants.
const renderedNames = preview.pageInspection.rendered;
assert.equal(renderedNames.filter((name) => name === "PrinterCard").length, 2);
assert.equal(renderedNames.filter((name) => name === "PrinterControls").length, 2);
assert.equal(renderedNames.filter((name) => name === "AddPrinterButton").length, 1);
assert.deepEqual(preview.pageInspection.unexecuted, []);
assert.equal(preview.actions.startPrint(jobA), true);
preview = renderPreview({ previewEmpty: true });
assert.equal(preview.pageInspection.rendered.filter((name) => name === "PrinterCard").length, 0);
const sharedPrinters = preview.query.printers;
const sharedActions = preview.actions;
assert.equal(findElements(preview.page, (node) => node.type.name === "PrinterCard").length, 0);
assert.equal(findElements(preview.page, (node) => node.type === "h2" &&
  node.props.children === "등록된 프린터가 없어요").length, 1);
const previewAddButton = findElements(preview.page, (node) => node.type.name === "AddPrinterButton")[0];
assert.equal(previewAddButton.type(previewAddButton.props).props.disabled, true, "Preview must not offer global mutations");
assert.equal(preview.query.printers.length, 2);
assert.equal(preview.query.connectedPrinter.id, printerA.id);
assert.equal(preview.query.printJob, jobA);
assert.equal(preview.query.printStatus, "PRINTING");
for (const previewEmpty of [false, true, false]) {
  preview = renderPreview({ previewEmpty });
  assert.equal(preview.query.printers, sharedPrinters, "Preview transitions must preserve global list identity");
  assert.equal(preview.actions, sharedActions);
  assert.equal(preview.query.printJob, jobA);
  assert.equal(preview.query.printStatus, "PRINTING");
}
const normalAddButton = findElements(preview.page, (node) => node.type.name === "AddPrinterButton")[0];
assert.equal(normalAddButton.type(normalAddButton.props).props.disabled, false);
preview.management.openEditForm(preview.query.printers[0]);
preview = renderPreview({ previewEmpty: false });
preview.management.savePrinter({ ...draft, name: "Shared printer" }, "connected");
preview = renderPreview({ previewEmpty: false });
assert.equal(preview.query.printers[0].name, "Shared printer");
assert.equal(findElements(preview.page, (node) => node.type.name === "PrinterCard")[0].props.printer, preview.query.printers[0]);
preview.management.openDeleteForm(preview.query.printers[0]);
preview = renderPreview({ previewEmpty: false });
preview.management.deletePrinter(printerA.id);
preview = renderPreview({ previewEmpty: false });
assert.equal(preview.query.printers.length, 1);
assert.equal(preview.query.printJob, null);
assert.equal(preview.query.printStatus, "EMPTY");
assert.equal(findElements(preview.page, (node) => node.type.name === "PrinterCard").length, 1);
console.log("PASS empty display preview, shared state preservation across transitions and normal management updates");

// Nested Provider guard self-test: each deliberately wrong tree must be rejected.
// Executed walk: only elements reachable from the rendered tree, using mocked hooks.
const nestedProvider = renderPreview.PrinterProvider;
const inspectSynthetic = (tree) => assertNoNestedProvider(renderPreview.inspectTree(tree, "synthetic"), "Synthetic page");
const providerElement = { type: nestedProvider, props: { initialPrinters: [], children: null } };
function WrapsProvider() { return { type: "section", props: { children: providerElement } }; }
function NeedsUnsupportedHook() { return globalThis.__unsupportedHook(); }
const nestedCases = {
  "root-level wrapper": providerElement,
  "inside a host element": { type: "main", props: { children: [{ type: "div", props: { children: providerElement } }] } },
  "inside a non-children prop": { type: "article", props: { actions: [providerElement], children: null } },
  "returned by a child component": { type: "main", props: { children: { type: WrapsProvider, props: {} } } },
  "passed as children to an unexecutable component": {
    type: "main",
    props: { children: { type: NeedsUnsupportedHook, props: { children: providerElement } } },
  },
};
for (const [name, tree] of Object.entries(nestedCases)) {
  assert.throws(() => inspectSynthetic(tree), /nested Provider/, "Nested Provider must be rejected: " + name);
}
const cleanSynthetic = renderPreview.inspectTree(
  { type: "main", props: { children: [{ type: "div", props: { children: null } }] } },
  "synthetic-clean",
);
assert.deepEqual(cleanSynthetic.found, []);

// Static scan: PrinterProvider may be used as an element only by the app root layout.
const providerUsagePolicy = new Map([["src/app/layout.tsx", 1]]);
const staticUsages = new Map();
for (const file of listSourceFiles(resolve(root, "src"))) {
  const usages = findPrinterProviderUsages(readFileSync(file, "utf8"), file);
  if (usages.length > 0) staticUsages.set(relative(root, file).replaceAll("\\", "/"), usages.length);
}
assert.deepEqual(
  [...staticUsages].sort(),
  [...providerUsagePolicy].sort(),
  "PrinterProvider must be used only once, in src/app/layout.tsx",
);
for (const source of [
  "const x = <PrinterProvider><Child /></PrinterProvider>;",
  "const y = createElement(PrinterProvider, null);",
  "import { PrinterProvider as Root } from '@/features/printer-management';",
  "const z = PrinterProvider({ children: null });",
]) {
  assert.equal(findPrinterProviderUsages(source, "sample.tsx").length > 0, true, "Static scan missed: " + source);
}
assert.equal(
  findPrinterProviderUsages("export function PrinterProvider() {}\nexport { PrinterProvider } from './p';", "sample.ts").length,
  0,
);
console.log(
  "PASS nested Provider guard: executed walk of " + preview.pageInspection.rendered.length +
  " page components (" + preview.pageInspection.unexecuted.length + " unexecuted), " +
  Object.keys(nestedCases).length + " rejected synthetic cases, static src scan (layout only)",
);

// Deleting a printer only removes its registration; it must not claim to cancel a print task,
// because the delete flow is not linked to the print lifecycle (entities/print).
function collectText(node) {
  if (typeof node === "string") return node;
  if (Array.isArray(node)) return node.map(collectText).join("");
  if (!node || typeof node !== "object" || !node.props) return "";
  return collectText(node.props.children);
}
const deleteModalText = collectText(
  renderPreview.PrinterDeleteModal({
    printer: { id: printerA.id, name: printerA.name },
    onClose() {},
    onConfirm() {},
  }),
);
assert.match(deleteModalText, /진행 중인 출력 작업은 자동으로 취소되지 않습니다/);
assert.doesNotMatch(deleteModalText, /먼저 취소|자동으로 취소돼요|출력이 취소/);
console.log("PASS delete modal does not promise automatic print cancellation");

await import("./verify-printer-focus.mjs");
