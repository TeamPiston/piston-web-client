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
function runtime(initialPrinters, { storage = new Map(), search = "", clock = Date, isMock = true } = {}) {
  const location = { search };
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
    useEffect: () => {},
    useSyncExternalStore: (_subscribe, getSnapshot) => getSnapshot(),
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
      if (specifier === "react/jsx-runtime") return { jsx, jsxs: jsx, Fragment: Symbol.for("react.fragment") };
      if (specifier === "@/shared/ui") return load(resolve(root, "src/shared/ui/use-native-dialog.ts"));
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
    }).runInNewContext({
      Event,
      crypto: { randomUUID },
      Date: clock,
      URLSearchParams,
      window: {
        location,
        sessionStorage: {
          getItem: (key) => storage.get(key) ?? null,
          setItem: (key, value) => storage.set(key, value),
          removeItem: (key) => storage.delete(key),
        },
      },
      process: { env: { NODE_ENV: "production", NEXT_PUBLIC_USE_MOCK: String(isMock) } },
      fetch: () => assert.fail("Mock printer management must not use HTTP"),
    })(requireSource, mod, mod.exports);
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
  run.print = load("src/entities/print/model/print.ts");
  run.location = location;
  run.PrinterDeleteModal = feature.PrinterDeleteModal;
  return run;
}

const render = runtime([]);
let view = render();
assert.equal(view.query.printers.length, 0);
assert.equal(view.query.connectedPrinter, null);
assert.equal(view.query.isPrinterConnected, false);
assert.deepEqual(Object.keys(view.query).sort(), [
  "connectedPrinter", "hasActivePrint", "isPrinterConnected", "printJob", "printStatus", "printers",
]);
const draft = { name: "Classroom", model: "QIDI X-Max 4", ipAddress: "192.0.2.31" };
view.management.openAddForm();
view = render();
assert.equal(view.management.isFormOpen, true);
view.management.savePrinter(draft, null);
assert.equal(render().query.printers.length, 0);
assert.equal(view.management.testPrinterConnection({ ...draft, ipAddress: "192.0.2.99" }).status, "disconnected");
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
view.management.savePrinter({ ...draft, ipAddress: "192.0.2.99" }, null);
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

// The Artwork action and MyPage read adapter must see one task, including after a reload.
const storage = new Map();
let now = Date.UTC(2026, 0, 1);
class PrintClock extends Date {
  constructor(...args) { super(...(args.length ? args : [now])); }
  static now() { return now; }
}
const artwork = runtime(undefined, { storage, clock: PrintClock });
const artworkPrinter = artwork().query.connectedPrinter;
const artworkJob = { printerId: artworkPrinter.id, colorMode: "single", title: "Feed artwork", stlUrl: "/models/feed-artwork.stl" };
assert(artwork().actions.startPrint(artworkJob));
const active = await artwork.print.getCurrentPrintTask();
assert.equal(active.artworkName, artworkJob.title);
assert.equal(active.printerName, artworkPrinter.name);
assert.equal(active.modelUrl, artworkJob.stlUrl);
assert.equal(active.status, "PRINTING");
assert.equal(active.progress, 0);
const otherArtwork = { ...artworkJob, title: "Second artwork" };
assert.equal(artwork().actions.startPrint(otherArtwork), false);
await assert.rejects(artwork.print.createPrintTask("MyPage design"), /이미 출력 중/);
assert.equal((await artwork.print.getCurrentPrintTask()).id, active.id);

const reloaded = runtime(undefined, { storage, clock: PrintClock });
assert.equal(reloaded().query.printJob.title, artworkJob.title);
assert.equal((await reloaded.print.getCurrentPrintTask()).id, active.id);
assert.equal(reloaded().actions.startPrint(otherArtwork), false);
assert.equal(await runtime(undefined, { storage, search: "?mockPrintStatus=EMPTY" }).print.getCurrentPrintTask(), null);
assert.equal((await runtime(undefined, { storage, search: "?mockPrintStatus=FAILED" }).print.getCurrentPrintTask()).status, "FAILED");
assert.equal((await runtime(undefined, { storage, search: "?mockPrintStatus=unknown", clock: PrintClock }).print.getCurrentPrintTask()).id, active.id);
now += 26 * 60_000;
assert.equal((await reloaded.print.getCurrentPrintTask()).progress, 50);
now += 26 * 60_000;
assert.equal((await reloaded.print.getCurrentPrintTask()).status, "COMPLETED");
assert.equal(reloaded().query.printStatus, "COMPLETED");
assert.equal(await reloaded.print.cancelPrintTask(active.id), undefined, "Completed jobs cannot be cancelled");

const failed = runtime(undefined, { search: "?mockError=print-progress", clock: PrintClock, storage });
assert(failed().actions.startPrint(artworkJob));
now += 60_000;
const failedTask = await failed.print.getCurrentPrintTask();
assert.equal(failedTask.status, "FAILED");
assert.equal(failedTask.printerName, artworkPrinter.name);

const retryPage = runtime(undefined, { storage, clock: PrintClock });
const retried = await retryPage.print.retryPrintTask(failedTask);
assert.notEqual(retried.id, failedTask.id);
assert.equal(retried.modelUrl, artworkJob.stlUrl);
assert.equal(retried.printerName, artworkPrinter.name);
assert.equal(retried.status, "PRINTING");
assert.equal((await retryPage.print.cancelPrintTask(retried.id)).status, "CANCELLED");
assert.equal((await retryPage.print.getCurrentPrintTask()).status, "CANCELLED");
assert.equal(retryPage().query.printStatus, "EMPTY");

const restart = runtime(undefined, { storage, clock: PrintClock });
assert.equal((await restart.print.getCurrentPrintTask()).status, "CANCELLED");
assert(restart().actions.startPrint(artworkJob));
restart().actions.removePrinter(artworkJob.printerId);
assert.equal(await restart.print.getCurrentPrintTask(), null);
assert.equal(await runtime(undefined, { storage }).print.getCurrentPrintTask(), null);
const printerStorage = new Map();
const managed = runtime(undefined, { storage: printerStorage, clock: PrintClock });
const defaultPrinter = managed().query.connectedPrinter;
managed().actions.removePrinter(defaultPrinter.id);
managed().management.savePrinter(draft, "connected");
const added = managed().query.connectedPrinter;
managed().management.openEditForm(added);
managed().management.savePrinter({ ...draft, name: "Edited printer" }, null);
assert.equal(managed().actions.startPrint({ ...artworkJob, printerId: added.id }), true);
const restored = runtime(undefined, { storage: printerStorage, clock: PrintClock });
assert.equal(restored().query.connectedPrinter.id, added.id);
assert.equal(restored().query.connectedPrinter.name, "Edited printer");
assert.equal(restored().query.printers.filter(({ id }) => id === added.id).length, 1);
assert.equal(restored().query.printers.some(({ id }) => id === defaultPrinter.id), false);
assert.equal((await restored.print.getCurrentPrintTask()).printerName, "Edited printer");
const corrupted = new Map(printerStorage);
corrupted.set("piston:mock-printers:v1", "{bad JSON");
assert.equal(await runtime(undefined, { storage: corrupted }).print.getCurrentPrintTask(), null);
const throwingStorage = new Map(printerStorage);
throwingStorage.get = () => { throw new Error("Storage read denied"); };
throwingStorage.set = () => { throw new Error("Storage write denied"); };
const blockedStorage = runtime(undefined, { storage: throwingStorage, clock: PrintClock });
assert(blockedStorage().actions.startPrint(artworkJob), "The current document can run a demo using its in-memory data");
assert.equal((await blockedStorage.print.getCurrentPrintTask()).artworkName, artworkJob.title);
restored().actions.removePrinter(added.id);
const afterDelete = runtime(undefined, { storage: printerStorage });
assert.equal(afterDelete().query.connectedPrinter, null);
assert.equal(await afterDelete.print.getCurrentPrintTask(), null);
const api = runtime(undefined, { isMock: false, storage });
assert.equal(api().actions.startPrint(artworkJob), false, "Artwork printing must remain disabled in API mode");
assert.equal(api().query.printJob, null);
console.log("PASS shared Artwork and MyPage mock print, refresh, progress, completion, failure, retry, cancellation, printer removal, and API guard");

const retryCase = runtime(undefined, { clock: PrintClock });
let retryView = retryCase();
assert(retryView.actions.startPrint(artworkJob));
const retryOriginal = await retryCase.print.getCurrentPrintTask();
const cancelledForRetry = await retryCase.print.cancelPrintTask(retryOriginal.id);
retryView.actions.setPrinters((all) => all.map((printer) => printer.id === artworkJob.printerId
  ? { ...printer, name: "Current printer name", connectionStatus: "disconnected" }
  : printer));
await assert.rejects(() => retryCase.print.retryPrintTask(cancelledForRetry), /연결이 끊겼어요/);
assert.equal((await retryCase.print.getCurrentPrintTask()).id, cancelledForRetry.id);
assert.equal((await retryCase.print.getCurrentPrintTask()).status, "CANCELLED");
retryView.actions.setPrinters((all) => all.map((printer) => printer.id === artworkJob.printerId
  ? { ...printer, connectionStatus: "connected" }
  : printer));
const renamedRetry = await retryCase.print.retryPrintTask(cancelledForRetry);
assert.equal(renamedRetry.printerId, artworkJob.printerId);
assert.equal(renamedRetry.printerName, "Current printer name");
assert.equal(renamedRetry.status, "PRINTING");
assert.equal(renamedRetry.modelUrl, artworkJob.stlUrl);

const cancelledBeforeDelete = await retryCase.print.cancelPrintTask(renamedRetry.id);
retryView.actions.removePrinter(artworkJob.printerId);
await assert.rejects(() => retryCase.print.retryPrintTask(cancelledBeforeDelete), /작업을 확인하지 못했어요/);
assert.equal(await retryCase.print.getCurrentPrintTask(), null);
// Even if a stale task is still present, a missing printer cannot be silently substituted.
const missingPrinterCase = runtime(undefined, { clock: PrintClock });
assert(missingPrinterCase().actions.startPrint(artworkJob));
const activeBeforeRemoval = await missingPrinterCase.print.getCurrentPrintTask();
const cancelledBeforeRemoval = await missingPrinterCase.print.cancelPrintTask(activeBeforeRemoval.id);
missingPrinterCase().actions.setPrinters((all) => all.filter(({ id }) => id !== artworkJob.printerId));
await assert.rejects(() => missingPrinterCase.print.retryPrintTask(cancelledBeforeRemoval), /프린터가 삭제됐거나/);
assert.equal((await missingPrinterCase.print.getCurrentPrintTask()).id, cancelledBeforeRemoval.id);
console.log("PASS retry validates live printer identity, name, removal and connection at execution");

for (const scenario of ["EMPTY", "FAILED"]) {
  const blockedWrites = new Map();
  blockedWrites.set = () => { throw new Error("Storage write denied"); };
  const live = runtime(undefined, { storage: blockedWrites, clock: PrintClock });
  assert(live().actions.startPrint(artworkJob));
  const before = await live.print.getCurrentPrintTask();
  assert.equal(before.persistenceWarning, "snapshot-removed");
  live.location.search = "?mockPrintStatus=" + scenario;
  const debug = await live.print.getCurrentPrintTask();
  assert.equal(debug?.status ?? "EMPTY", scenario);
  await assert.rejects(() => live.print.createPrintTask("Debug replacement"), /이미 출력 중/);
  if (debug) await assert.rejects(() => live.print.retryPrintTask(debug), /이미 출력 중/);
  live.location.search = "";
  assert.equal((await live.print.getCurrentPrintTask()).id, before.id);
  assert.equal((await live.print.getCurrentPrintTask()).status, "PRINTING");
  assert.equal(live().actions.startPrint(otherArtwork), false);
}
console.log("PASS EMPTY and FAILED preserve the same-document task and submission lock when writes fail");

for (const [allowWrite, allowRemove, warning] of [
  [true, true, undefined],
  [false, true, "snapshot-removed"],
  [false, false, "snapshot-may-be-stale"],
]) {
  const snapshots = new Map();
  const live = runtime(undefined, { storage: snapshots, clock: PrintClock });
  assert(live().actions.startPrint(artworkJob));
  const before = await live.print.getCurrentPrintTask();
  assert.equal(before.persistenceWarning, undefined);
  const key = "piston:mock-print:v1";
  assert.equal(JSON.parse(snapshots.get(key)).status, "PRINTING");
  if (!allowWrite) snapshots.set = () => { throw new Error("Storage write denied"); };
  if (!allowRemove) snapshots.delete = () => { throw new Error("Storage remove denied"); };
  const cancelled = await live.print.cancelPrintTask(before.id);
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.persistenceWarning, warning);
  assert.equal((await live.print.getCurrentPrintTask()).persistenceWarning, warning);
  const fresh = await runtime(undefined, { storage: snapshots, clock: PrintClock }).print.getCurrentPrintTask();
  if (allowWrite) {
    assert.equal(fresh.id, before.id);
    assert.equal(fresh.status, "CANCELLED");
    assert.equal(fresh.persistenceWarning, undefined);
  } else if (allowRemove) {
    assert.equal(snapshots.has(key), false);
    assert.notEqual(fresh?.id, before.id);
  } else {
    assert.equal(fresh.id, before.id);
    assert.equal(fresh.status, "PRINTING");
  }
}
console.log("PASS cancellation persistence and fresh-document recovery for every write/remove outcome");

const first = runtime();
const second = runtime();
const original = first().query.printers[0];
assert(first().query.printers.every((printer) => /^192\.0\.2\.\d+$/.test(printer.ipAddress)),
  "Public printer fixtures must use documentation addresses");
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
assert.equal(references.actions.startPrint(jobA), false, "Reconnecting a printer must not overwrite its active job");
const completed = await renderReferences.print.getCurrentPrintTask();
await renderReferences.print.cancelPrintTask(completed.id);
assert.equal(references.actions.startPrint(jobA), true, "Updated actions must see a reconnected printer after cancellation");
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

const editedPrinter = { ...printerA, ipAddress: "192.0.2.20" };
const otherPrinter = {
  ...printerB,
  ipAddress: "192.0.2.30",
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
  ...editedPrinter, ipAddress: "192.0.2.42",
}).status, "connected");
assert.equal(connections.management.testPrinterConnection({
  ...editedPrinter, model: "QIDI Q1 Pro",
}).status, "connected");
assert.equal(connections.management.testPrinterConnection({
  ...editedPrinter, ipAddress: " 192.0.2.99 ",
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
const newDraft = { ...draft, ipAddress: "192.0.2.44" };
assert.equal(connections.management.testPrinterConnection(newDraft).status, "connected");
const failedRegistration = connections.management.testPrinterConnection({
  ...newDraft, ipAddress: "192.0.2.99",
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
