import { createRequire } from "module";

const require = createRequire(import.meta.url);

// TS 7.0 restructured its package exports: `require("typescript")` no longer
// exposes SyntaxKind/Extension/etc., so typescript-eslint 8.x cannot use it.
// We keep TS 7 as the project compiler but transparently substitute TS 6
// (installed as the `typescript6` alias) for the `typescript` module cache so
// that typescript-eslint loads and runs against the TS 6 API. This is the
// "side-by-side" approach recommended by the TS 7.0 announcement.
const ts6 = require("typescript6");
const tsPath = require.resolve("typescript");
const Module = require("module");
const ts6Module = new Module(tsPath, null);
ts6Module.loaded = true;
ts6Module.exports = ts6;
require.cache[tsPath] = ts6Module;

const coreWebVitals = require("eslint-config-next/core-web-vitals");
const typescript = require("eslint-config-next/typescript");

const eslintConfig = [
  ...coreWebVitals,
  ...typescript,
  {
    ignores: ["cf-worker/**", ".next/**", "node_modules/**"],
  },
];

export default eslintConfig;
