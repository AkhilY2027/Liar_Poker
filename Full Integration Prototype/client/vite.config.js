import { defineConfig } from "vite";

const devTarget = process.env.VITE_DEV_PROXY_TARGET || "http://localhost:3000";

export default defineConfig({
  server: {
    proxy: {
      "/socket.io": {
        target: devTarget,
        ws: true,
        changeOrigin: true,
      },
      "/card_deck_images": {
        target: devTarget,
        changeOrigin: true,
      },
      "/health": {
        target: devTarget,
        changeOrigin: true,
      },
    },
  },
});
