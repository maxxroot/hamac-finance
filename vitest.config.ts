import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./packages/ui/src", import.meta.url)) } },
  test: {
    // Couverture (pnpm test:coverage) : rapport lcov lu par SonarQube, dans coverage/lcov.info.
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "lcov"],
      reportsDirectory: "coverage",
      // Mêmes fichiers que sonar.sources : un fichier jamais chargé par un test compte à 0 %.
      include: ["packages/*/src/**/*.{ts,tsx}", "apps/server/src/**/*.ts"],
      exclude: ["**/*.test.{ts,tsx}", "packages/backend/src/db/migrations.generated.ts", "packages/backend/src/demo.ts", "packages/ui/src/main.tsx"],
    },
    projects: [
      { extends: true, test: { name: "logique", include: ["packages/*/src/**/*.test.ts", "apps/*/src/**/*.test.ts"], environment: "node" } },
      { extends: true, test: { name: "interface", include: ["packages/ui/src/**/*.test.tsx"], environment: "./packages/ui/test/jsdom-node.ts", testTimeout: 20_000 } },
    ],
  },
});
