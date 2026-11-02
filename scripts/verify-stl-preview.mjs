import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Script } from "node:vm";
import test from "node:test";
import ts from "typescript";

function load(relative, stubs) {
  const path = fileURLToPath(new URL(relative, import.meta.url));
  const source = ts.transpileModule(readFileSync(path, "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
    fileName: path,
  }).outputText;
  const exports = {};
  const jsx = (type, props) => ({ type, props });
  new Script(source, { filename: path }).runInNewContext({ exports, require(name) {
    if (name === "react/jsx-runtime") return { jsx, jsxs: jsx };
    assert(Object.hasOwn(stubs, name), "Unexpected viewer dependency: " + name);
    return stubs[name];
  } });
  return exports;
}

function find(tree, type) {
  if (Array.isArray(tree)) return tree.map(child => find(child, type)).find(Boolean);
  if (tree && typeof tree === "object") return tree.type === type ? tree : find(tree.props?.children, type);
}

const { ArtworkModelPreview } = load("../src/features/stl-viewer/ui/artwork-model-preview.tsx", {
  react: { useState: initial => [typeof initial === "function" ? initial() : initial, () => {}],
    useRef: () => ({ current: null }), useEffect() {}, Suspense: "Suspense" },
  "@react-three/drei": { Center: "Center", OrbitControls: "OrbitControls" },
  "@react-three/fiber": { Canvas: "Canvas" }, "lucide-react": { Maximize2: "Maximize2", Minimize2: "Minimize2" },
  three: { MathUtils: {} }, "../model/use-stl-model": { useStlModel() {} },
});

test("fullscreen position is explicit and independent of viewer variant", () => {
  for (const variant of ["detail", "detail-compact", "create"]) {
    const render = fullscreenButtonPosition => ArtworkModelPreview({ variant, stlUrl: "/model.stl", fullscreenButtonPosition });
    const bottom = find(render(undefined), "button");
    const top = find(render("top-right"), "button");
    assert.match(bottom.props.className, /bottom-4/);
    assert.doesNotMatch(bottom.props.className, /top-4/);
    assert.match(top.props.className, /top-4/);
    assert.doesNotMatch(top.props.className, /bottom-4/);
    assert.equal(find(render(undefined), "Canvas").props.camera.position[2], 42);
  }
});

test("Create explicitly places fullscreen above its bottom-right zoom controls", () => {
  const { PreviewPanel } = load("../src/page-slices/create/ui/components/preview-panel.tsx", {
    "lucide-react": {}, "@/features/stl-viewer": { ArtworkModelPreview: "ArtworkModelPreview" },
    "@/shared/ui": { PistonLogo: "PistonLogo" },
  });
  const tree = PreviewPanel({ isGenerated: true, modelParams: { stlUrl: "/model.stl" }, printSuccessPhase: "hidden" });
  const props = find(tree, "ArtworkModelPreview").props;
  assert.equal(props.fullscreenButtonPosition, "top-right");
  assert.equal(props.variant, "create");
});
