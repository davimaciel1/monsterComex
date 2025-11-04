import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  plugins: [react()] as any,
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: "./client/src/test/setup.ts",
    include: ["client/src/**/*.test.{ts,tsx}"]
  },
  resolve: {
    alias: {
      "@": resolve(__dirname, "./client/src"),
      "@shared": resolve(__dirname, "./shared")
    }
  }
});
