import { config } from "@repo/eslint-config/react-internal";

/** @type {import("eslint").Linter.Config[]} */
export default [
  { ignores: ["dist/**", "src-tauri/**", "src/lib/bindings.ts"] },
  ...config,
];
