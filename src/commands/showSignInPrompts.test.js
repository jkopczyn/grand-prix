import { describe, it, expect, beforeEach } from "vitest";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { registerShowSignInPromptsAction } from "./showSignInPrompts";

const DISMISSED_KEY = "grandPrix.signInDismissed";
const SESSION_KEY = "grandPrix.signInPromptShownThisSession";

function setup() {
    const editor = createMockEditor();
    registerShowSignInPromptsAction(editor);
    const descriptor = editor.addAction.mock.calls[0][0];
    return { editor, descriptor };
}

describe("registerShowSignInPromptsAction", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
    });

    it("registers with the correct id", () => {
        const { descriptor } = setup();
        expect(descriptor.id).toBe("grandPrix.action.showSignInPrompts");
    });

    it("registers with the correct label", () => {
        const { descriptor } = setup();
        expect(descriptor.label).toBe("Show Sign-In Prompts");
    });

    it("removes the dismissed key from localStorage", () => {
        localStorage.setItem(DISMISSED_KEY, "1");
        const { descriptor } = setup();
        descriptor.run();
        expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
    });

    it("removes the session key from sessionStorage", () => {
        sessionStorage.setItem(SESSION_KEY, "1");
        const { descriptor } = setup();
        descriptor.run();
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it("dispatches grandPrix.signInPromptsRestored on window", () => {
        const { descriptor } = setup();
        let fired = false;
        window.addEventListener("grandPrix.signInPromptsRestored", () => { fired = true; }, { once: true });
        descriptor.run();
        expect(fired).toBe(true);
    });

    it("does not throw when storage keys are already absent", () => {
        const { descriptor } = setup();
        expect(() => descriptor.run()).not.toThrow();
    });
});
