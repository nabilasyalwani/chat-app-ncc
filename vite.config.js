import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      "/start_web_socket": {
        target: "ws://localhost:8080",
        ws: true,
      },
    },
  },
});
