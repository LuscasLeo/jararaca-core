import { resolve } from "path";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import dts from "vite-plugin-dts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    dts({
      include: ["lib/**/*"],
      exclude: ["src/**/*", "node_modules/**/*"],
      outDir: "dist",
      insertTypesEntry: true, // Create a .d.ts entry file
      copyDtsFiles: true, // Copy .d.ts declaration files without modification
    }),
  ],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "lib/main.ts"),
      name: "jararacaCore",
      fileName: (format) => `jararaca-core.${format}.js`,
      formats: ["es", "cjs", "umd"],
    },
    rollupOptions: {
      external: [
        "react",
        "react-dom",
        "axios",
        "@tanstack/react-query",
        "immutable",
        "notistack",
        "usehooks-ts",
        /^react-dom\/.*$/,
        /^react\/.*$/,
      ],
      output: {
        globals: {
          react: "React",
          "react-dom": "ReactDOM",
          axios: "axios",
          "@tanstack/react-query": "ReactQuery",
          immutable: "Immutable",
          notistack: "Notistack",
          "usehooks-ts": "usehooksTs",
        },
        // Ensure proper exports
        exports: "named",
        // Preserve modules structure to enable tree-shaking in consuming projects
        preserveModules: false,
        // Output directory for preserveModules
        preserveModulesRoot: "lib",
      },
    },
    // Minify the output for production
    minify: true,
    // Don't generate source maps for production build
    sourcemap: false,
  },
});
