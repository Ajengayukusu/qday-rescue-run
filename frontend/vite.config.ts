import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Code splitting (v2): the app shell + demo game ship in the entry chunk.
// The live chain layer (src/lib/qore.ts — viem + the QoreChain SDK/CosmJS
// stack) is dynamically imported only when a player connects a wallet, and
// Rollup additionally splits stable vendor chunks so returning visitors
// cache them independently.
export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
  build: {
    // Keep the lazily-loaded chain chunks out of the initial page load:
    // Vite would otherwise modulepreload every chunk in the graph.
    modulePreload: {
      resolveDependencies: (_filename: string, deps: string[]) =>
        deps.filter(
          (d) =>
            !d.includes("qore-sdk") &&
            !d.includes("evm-vendor") &&
            !/\/qore-[^/]*\.js$/.test(d)
        ),
    },
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }
          if (id.includes("/viem/") || id.includes("/@qorechain/evm/")) {
            return "evm-vendor";
          }
          if (
            id.includes("/@qorechain/sdk/") ||
            id.includes("/@cosmjs/") ||
            id.includes("/@scure/") ||
            id.includes("/@noble/")
          ) {
            return "qore-sdk";
          }
          return undefined;
        },
      },
    },
  },
});
