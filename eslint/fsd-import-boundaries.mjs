import path from "node:path";

const LAYERS = ["app", "pages", "widgets", "features", "entities", "shared"];
const LAYER_INDEX = new Map(LAYERS.map((layer, index) => [layer, index]));
const LAYER_PATTERN = /[\\/]src[\\/](app|pages|widgets|features|entities|shared)(?:[\\/]|$)/;

function getLayerInfo(filePath) {
  const normalizedPath = path.normalize(filePath);
  const match = normalizedPath.match(LAYER_PATTERN);

  if (!match) {
    return null;
  }

  const layer = match[1];
  const layerPath = normalizedPath.slice(match.index + match[0].length);
  const segments = layerPath.split(path.sep).filter(Boolean);

  return {
    layer,
    slice: segments.length > 1 ? segments[0] : null,
    isRootBarrel: segments.length === 1 && segments[0].startsWith("index."),
  };
}

function resolveImportPath(importerPath, source) {
  if (source.startsWith("@/")) {
    return path.resolve(process.cwd(), "src", source.slice(2));
  }

  if (source.startsWith(".")) {
    return path.resolve(path.dirname(importerPath), source);
  }

  return null;
}

const fsdImportBoundaries = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce Feature-Sliced Design import boundaries",
    },
    schema: [],
    messages: {
      lowerLayerImport: "FSD boundary violation: {{importerLayer}} cannot import the higher layer {{importedLayer}}.",
      sameLayerImport: "FSD boundary violation: {{importerSlice}} cannot directly import {{importedSlice}} in {{layer}}.",
    },
  },

  create(context) {
    const importerPath = context.filename ?? context.getFilename();
    const importer = getLayerInfo(importerPath);

    if (!importer || importer.isRootBarrel) {
      return {};
    }

    function checkImport(sourceNode) {
      const source = sourceNode.value;

      if (typeof source !== "string") {
        return;
      }

      const imported = getLayerInfo(resolveImportPath(importerPath, source) ?? source);

      if (!imported) {
        return;
      }

      const importerIndex = LAYER_INDEX.get(importer.layer);
      const importedIndex = LAYER_INDEX.get(imported.layer);

      if (importedIndex < importerIndex) {
        context.report({
          node: sourceNode,
          messageId: "lowerLayerImport",
          data: {
            importerLayer: importer.layer,
            importedLayer: imported.layer,
          },
        });
        return;
      }

      if (
        imported.layer === importer.layer &&
        importer.slice &&
        importer.slice !== imported.slice
      ) {
        context.report({
          node: sourceNode,
          messageId: "sameLayerImport",
          data: {
            importerSlice: importer.slice,
            importedSlice: imported.slice ?? "the layer barrel",
            layer: importer.layer,
          },
        });
      }
    }

    return {
      ImportDeclaration(node) {
        checkImport(node.source);
      },
      ExportAllDeclaration(node) {
        if (node.source) {
          checkImport(node.source);
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source) {
          checkImport(node.source);
        }
      },
      ImportExpression(node) {
        if (node.source) {
          checkImport(node.source);
        }
      },
    };
  },
};

export default fsdImportBoundaries;
