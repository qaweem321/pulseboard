import nextJest from "next/jest.js";

const createJestConfig = nextJest({ dir: "./" });

// Two projects: DOM tests for components, Node tests for server code (Postgres via PGlite).
const shared = { moduleNameMapper: { "^@/(.*)$": "<rootDir>/src/$1" } };

export default async function config() {
  const [dom, node] = await Promise.all([
    createJestConfig({
      ...shared,
      displayName: "dom",
      // userEvent typing into MUI fields is slow on busy CI machines.
      testTimeout: 15_000,
      testEnvironment: "<rootDir>/jest.environment.mjs",
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
  // d3 ships ES modules only; let SWC transform it (Next.js skips node_modules by default).
  const esm = ["d3", "d3-[a-z-]+", "internmap", "delaunator", "robust-predicates"].join("|");
  dom.transformIgnorePatterns = [`/node_modules/(?!(${esm})/)`, ...dom.transformIgnorePatterns.slice(1)];
  return { projects: [dom, node] };
}
