import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "happy-dom",
        clearMocks: true,
        restoreMocks: true,
    },
    resolve: {
        alias: {
            "monaco-editor": new URL(
                "./src/__mocks__/monaco-editor.js",
                import.meta.url
            ).pathname,
        },
    },
});
