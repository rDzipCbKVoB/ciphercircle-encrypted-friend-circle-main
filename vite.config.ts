import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { nodePolyfills } from "vite-plugin-node-polyfills";

// Fix CommonJS imports (keccak, fetch-retry) expected by @zama-fhe/relayer-sdk
const fixCommonJSImports = () => ({
  name: "fix-commonjs-imports",
  transform(code: string, id: string) {
    if (id.includes("@zama-fhe/relayer-sdk/lib/web.js")) {
      let fixed = code;

      // Fix keccak import
      fixed = fixed.replace(
        /import\s+(\w+)\s+from\s+['"]keccak['"]/g,
        "import * as $1Module from 'keccak'; const $1 = $1Module.default || $1Module;",
      );

      // Fix fetch-retry import
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
      // Provide Node.js polyfills for keccak and related modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      // Explicitly polyfill the stream module family
      protocolImports: true,
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // Stream polyfill required by keccak
      stream: "stream-browserify",
      _stream_readable: "stream-browserify/readable",
      _stream_writable: "stream-browserify/writable",
      _stream_duplex: "stream-browserify/duplex",
      _stream_transform: "stream-browserify/transform",
    },
  },
  define: {
    // Some dependencies expect a global object
    global: "globalThis",
  },
  optimizeDeps: {
    // Skip Vite pre-bundling for the SDK so our plugin can handle it
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
