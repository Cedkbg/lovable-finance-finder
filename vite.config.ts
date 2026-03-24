import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  base: "/", // 🔥 important pour corriger le 404

  plugins: [react()],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  optimizeDeps: {
    include: ["@tanstack/react-query", "next-themes", "sonner"],
  },

  server: {
    host: true,
  },

  build: {
    outDir: "dist",
    chunkSizeWarningLimit: 2000,
  },
});