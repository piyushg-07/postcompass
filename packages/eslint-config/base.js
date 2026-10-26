import babelParser from "@babel/eslint-parser";
import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import onlyWarn from "eslint-plugin-only-warn";
import { fileURLToPath } from "node:url";

// Babel resolves preset names from the folder ESLint runs in, which fails in editors and from the repo root
// (pnpm only links the preset into this package), so hand it the full path instead.
const tsPreset = fileURLToPath(import.meta.resolve("@babel/preset-typescript"));

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config[]}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  {
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [tsPreset],
        },
      },
    },
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",
    },
  },
  // Flat config only lints .js/.mjs/.cjs by default, so without this every TypeScript file was skipped.
  // TypeScript itself checks undefined names and unused variables (and knows about types), so those rules are off.
  {
    files: ["**/*.ts", "**/*.tsx"],
    rules: {
      "no-undef": "off",
      "no-unused-vars": "off",
    },
  },
  // Babel 8's TypeScript preset doesn't enable JSX for .tsx on its own, so turn the syntax on for those files
  {
    files: ["**/*.tsx"],
    languageOptions: {
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          presets: [tsPreset],
          parserOpts: { plugins: ["jsx"] },
        },
      },
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
