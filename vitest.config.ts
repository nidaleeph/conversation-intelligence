import path from "path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["server/__tests__/**/*.test.ts"],
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
    },
  },
});
