import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { FirstChangePrompt } from "./firstChangePrompt";

const AUTH_ID = "grandPrix.auth";
const CONFIG_ID = "grandPrix.config";
const DISMISSED_KEY = "grandPrix.signInDismissed";
const SESSION_KEY = "grandPrix.signInPromptShownThisSession";

function makeAuth(overrides = {}) {
    return {
        isLoggedIn: false,
        isDevFallback: false,
        requestToken: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function setup(authOverrides = {}) {
    let onDidSetCb = null;
    const config = {
        onDidSet: vi.fn((fn) => {
            onDidSetCb = fn;
            return { dispose: vi.fn() };
        }),
    };
    const auth = makeAuth(authOverrides);
    registerContribution(CONFIG_ID, config);
    registerContribution(AUTH_ID, auth);
    const editor = createMockEditor();
    const prompt = new FirstChangePrompt(editor);
    const trigger = () => onDidSetCb && onDidSetCb();
    return { auth, config, editor, prompt, trigger };
}

describe("FirstChangePrompt", () => {
    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        document.body.replaceChildren();
    });

    it("shows modal on first config change when conditions pass", () => {
        const { trigger } = setup();
        trigger();
        expect(document.body.querySelector("div")).not.toBeNull();
    });

    it("sets session key after first show", () => {
        const { trigger } = setup();
        trigger();
        expect(sessionStorage.getItem(SESSION_KEY)).toBe("1");
    });

    it("does not show twice in the same session", () => {
        const { trigger } = setup();
        trigger();
        const countAfterFirst = document.body.childElementCount;
        trigger();
        expect(document.body.childElementCount).toBe(countAfterFirst);
    });

    it("does not show when logged in", () => {
        const { trigger } = setup({ isLoggedIn: true });
        trigger();
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it("does not show in dev fallback mode", () => {
        const { trigger } = setup({ isDevFallback: true });
        trigger();
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it("does not show when dismissed key is set", () => {
        localStorage.setItem(DISMISSED_KEY, "1");
        const { trigger } = setup();
        trigger();
        expect(sessionStorage.getItem(SESSION_KEY)).toBeNull();
    });

    it("does not show when session key is already set", () => {
        sessionStorage.setItem(SESSION_KEY, "1");
        const { trigger } = setup();
        const countBefore = document.body.childElementCount;
        trigger();
        expect(document.body.childElementCount).toBe(countBefore);
    });

    it("Not now hides modal without setting dismissed key", () => {
        const { trigger } = setup();
        trigger();
        const notNow = Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent === "Not now"
        );
        notNow.click();
        expect(localStorage.getItem(DISMISSED_KEY)).toBeNull();
        expect(document.body.querySelector("[style]")).toBeNull();
    });

    it("Don't ask again sets dismissed key and dispatches event", () => {
        const { trigger } = setup();
        trigger();
        let eventFired = false;
        window.addEventListener("grandPrix.signInPromptsRestored", () => { eventFired = true; }, { once: true });
        const never = Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent === "Don't ask again"
        );
        never.click();
        expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
        expect(eventFired).toBe(true);
        expect(document.body.querySelector("[style]")).toBeNull();
    });

    it("Sign in calls requestToken, sets dismissed key, dispatches event, and hides modal", () => {
        const { auth, trigger } = setup();
        trigger();
        let eventFired = false;
        window.addEventListener("grandPrix.signInPromptsRestored", () => { eventFired = true; }, { once: true });
        const signIn = Array.from(document.querySelectorAll("button")).find(
            (b) => b.textContent === "Sign in"
        );
        signIn.click();
        expect(auth.requestToken).toHaveBeenCalledOnce();
        expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
        expect(eventFired).toBe(true);
        expect(document.body.querySelector("[style]")).toBeNull();
    });

    it("dispose removes modal from body", () => {
        const { trigger, prompt } = setup();
        trigger();
        prompt.dispose();
        expect(document.body.querySelector("[style]")).toBeNull();
    });
});
