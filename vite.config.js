import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
    base: "/grand-prix/",
    build: {
        rollupOptions: {
            input: {
                landing: resolve(__dirname, "index.html"),
                app: resolve(__dirname, "app/index.html"),
            },
        },
    },
    optimizeDeps: {
        include: ["monaco-editor"],
    },
    server: {
        port: 3000,
        open: "/grand-prix/app/",
    },
});
