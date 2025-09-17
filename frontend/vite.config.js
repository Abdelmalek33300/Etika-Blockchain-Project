import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": {
        target: "https://localhost:4443",
        changeOrigin: true,
        secure: false, // accepte le cert local auto-signé
      },
    },
  },
});
