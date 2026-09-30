import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "src/lib/scanner/**/*.ts",
        "src/lib/jenkins/version.ts",
        "src/lib/jenkins/java-support.ts",
      ],
      thresholds: { lines: 90, functions: 90, branches: 80, statements: 90 },
    },
  },
});
