import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import process from "node:process";
import { defineConfig } from "vite";

const host = process.env.TAURI_DEV_HOST;

// https://v2.tauri.app/start/frontend/vite/
export default defineConfig({
  plugins: [react(), tailwindcss()],

  // Keep Rust compiler errors visible in the terminal
  clearScreen: false,

  server: {
    // Tauri expects a fixed port
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host ? { protocol: "ws", host, port: 1421 } : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },

  // Tauri uses Chromium (WebView2) on Windows and WebKit on macOS/Linux
  envPrefix: ["VITE_", "TAURI_ENV_*"],
  build: {
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome120" : "safari16",
    minify: process.env.TAURI_ENV_DEBUG ? false : "oxc",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
  },
});
