import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Two projects: DOM tests for components, Node tests for server code (Postgres via PGlite).
const shared = { moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" } };

export default async function config() {
  const [dom, node] = await Promise.all([
    createJestConfig({
      ...shared,
      displayName: "dom",
      testEnvironment: "jsdom",
      setupFilesAfterEnv: ["<rootDir>/jest.setup.ts"],
      testMatch: ["<rootDir>/src/**/*.test.tsx"],
    })(),
    createJestConfig({
      ...shared,
      displayName: "node",
      testEnvironment: "node",
      testMatch: ["<rootDir>/src/**/*.test.ts", "<rootDir>/worker/**/*.test.ts"],
    })(),
  ]);
  return { projects: [dom, node] };
}
