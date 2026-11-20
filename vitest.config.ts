import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // vmThreads: con el pool por defecto, Vitest 5 + Node 24 no encuentra la suite actual en este proyecto.
  test: { include: ["src/**/*.test.ts"], pool: "vmThreads" },
});
