import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { registerToggleWordWrapAction } from "./toggleWordWrap";

const CONFIG_ID = "grandPrix.config";

function setup(initialWordWrap = "off") {
    const config = {
        get: vi.fn((key) => (key === "wordWrap" ? initialWordWrap : undefined)),
        set: vi.fn(),
    };
    registerContribution(CONFIG_ID, config);
    const editor = createMockEditor();
    registerToggleWordWrapAction(editor);
    const { run } = editor.addAction.mock.calls[0][0];
    return { config, editor, run };
}

describe("registerToggleWordWrapAction", () => {
    it("registers with the correct id and label", () => {
        const { editor } = setup();
        const descriptor = editor.addAction.mock.calls[0][0];
        expect(descriptor.id).toBe("grandPrix.action.toggleWordWrap");
        expect(descriptor.label).toBe("Toggle Word Wrap");
    });

    it("toggles from off to on", () => {
        const { config, run } = setup("off");
        run(null);
        expect(config.set).toHaveBeenCalledWith("wordWrap", "on");
    });

    it("toggles from on to off", () => {
        const { config, run } = setup("on");
        run(null);
        expect(config.set).toHaveBeenCalledWith("wordWrap", "off");
    });
});
