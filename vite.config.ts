import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Fix CommonJS imports (keccak, fetch-retry) inside @zama-fhe/relayer-sdk
const fixCommonJSImports = () => ({
  name: "fix-commonjs-imports",
  transform(code: string, id: string) {
    if (id.includes("@zama-fhe/relayer-sdk/lib/web.js")) {
      let fixed = code;

      // Normalize keccak import
      fixed = fixed.replace(
        /import\s+(\w+)\s+from\s+['"]keccak['"]/g,
        "import * as $1Module from 'keccak'; const $1 = $1Module.default || $1Module;",
      );

      // Normalize fetch-retry import
      fixed = fixed.replace(
        /import\s+(\w+)\s+from\s+['"]fetch-retry['"]/g,
        "import * as $1Module from 'fetch-retry'; const $1 = $1Module.default || $1Module;",
      );

      return {
        code: fixed,
        map: null,
      };
    }

    return null;
  },
});

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    fixCommonJSImports(),
    nodePolyfills({
      // Provide Node.js-style globals for keccak and friends
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Inject stream-related polyfills explicitly
      protocolImports: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Route keccak dependencies to stream polyfills
      stream: "stream-browserify",
      _stream_readable: "stream-browserify/readable",
      _stream_writable: "stream-browserify/writable",
      _stream_duplex: "stream-browserify/duplex",
      _stream_transform: "stream-browserify/transform",
    },
  },
  define: {
    // Some dependencies expect a global variable
    global: "globalThis",
  },
  optimizeDeps: {
    // Keep the SDK out of Vite pre-bundling; handled via custom plugin
    exclude: ["@zama-fhe/relayer-sdk"],
    include: ["keccak", "fetch-retry", "stream-browserify"],
    esbuildOptions: {
      target: "esnext",
      define: {
        global: "globalThis",
      },
    },
  },
  build: {
    target: "esnext",
    commonjsOptions: {
      include: [/keccak/, /fetch-retry/, /node_modules/],
      transformMixedEsModules: true,
    },
  },
}));
