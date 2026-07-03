import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react-swc";
import tsconfigPaths from "vite-tsconfig-paths";

// Vitest config for unit/component tests.
// - `vite-tsconfig-paths` makes the "@/*" alias from tsconfig.json resolve in tests.
// - `@vitejs/plugin-react-swc` compiles JSX/TSX (SWC avoids the babel peer conflict
//   that @vitejs/plugin-react pulls in under React 19 / Next 16).
export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./test/setup.ts"],
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: [
        "app/**",
        "components/**",
        "lib/**",
        "services/**",
        "actions/**",
      ],
    },
  },
});
