import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { registerToggleWhitespaceAction } from "./toggleWhitespace";

const CONFIG_ID = "grandPrix.config";

function setup(initialRenderWhitespace = "none") {
    const config = {
        get: vi.fn((key) =>
            key === "renderWhitespace" ? initialRenderWhitespace : undefined
        ),
        set: vi.fn(),
    };
    registerContribution(CONFIG_ID, config);
    const editor = createMockEditor();
    registerToggleWhitespaceAction(editor);
    const { run } = editor.addAction.mock.calls[0][0];
    return { config, editor, run };
}

describe("registerToggleWhitespaceAction", () => {
    it("registers with the correct id and label", () => {
        const { editor } = setup();
        const descriptor = editor.addAction.mock.calls[0][0];
        expect(descriptor.id).toBe("grandPrix.action.toggleWhitespace");
        expect(descriptor.label).toBe("Toggle Render Whitespace");
    });

    it("toggles from none to all", () => {
        const { config, run } = setup("none");
        run(null);
        expect(config.set).toHaveBeenCalledWith("renderWhitespace", "all");
    });

    it("toggles from all to none", () => {
        const { config, run } = setup("all");
        run(null);
        expect(config.set).toHaveBeenCalledWith("renderWhitespace", "none");
    });
});
