import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // IMPORTANT: site servi sous le sous-chemin /dhimmobilier/ (Nginx alias)
  // Garder cette base pour que les assets/routage fonctionnent en prod.
  base: "/dhimmobilier/",
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    target: "es2020",
    cssMinify: true,
    rollupOptions: {
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": [
            "@radix-ui/react-dialog",
            "@radix-ui/react-select",
            "@radix-ui/react-popover",
            "@radix-ui/react-tabs",
            "@radix-ui/react-tooltip",
            "tailwind-merge",
            "class-variance-authority",
          ],
          "vendor-charts": ["recharts"],
          "vendor-export": ["xlsx", "jspdf", "html2canvas"],
          "vendor-query": ["@tanstack/react-query"],
        },
      },
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
