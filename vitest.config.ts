import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./packages/ui/src", import.meta.url)) } },
  test: {
    projects: [
      { extends: true, test: { name: "logique", include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"], environment: "node" } },
      { extends: true, test: { name: "interface", include: ["packages/ui/src/**/*.test.tsx"], environment: "./packages/ui/test/jsdom-node.ts", testTimeout: 20_000 } },
    ],
  },
});
