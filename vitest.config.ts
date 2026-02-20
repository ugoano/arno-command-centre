import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "web/src"),
    },
  },
  test: {
    environment: "jsdom",
    include: ["**/*.test.{ts,tsx}"],
    globals: true,
    css: false,
  },
});
