import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    build: {
        rollupOptions: {
            input: {
                landing: resolve(__dirname, "index.html"),
                app: resolve(__dirname, "app/index.html"),
            },
        },
    },
    server: {
        port: 3000,
        open: "/app/",
    },
});
