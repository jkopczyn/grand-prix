import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { ConnectBanner } from "./connectBanner";

const AUTH_ID = "grandPrix.auth";
const DISMISSED_KEY = "grandPrix.signInDismissed";

function makeAuth(overrides = {}) {
    return {
        isLoggedIn: false,
        isDevFallback: false,
        onLoggedInChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        requestToken: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function setup(authOverrides = {}) {
    const auth = makeAuth(authOverrides);
    registerContribution(AUTH_ID, auth);
    const editor = createMockEditor();
    const banner = new ConnectBanner(editor);
    const container = document.getElementById("connect-banner");
    return { auth, editor, banner, container };
}

describe("ConnectBanner", () => {
    beforeEach(() => {
        localStorage.clear();
        document.body.replaceChildren();
        const div = document.createElement("div");
        div.id = "connect-banner";
        document.body.appendChild(div);
    });

    it("is visible when signed out with no dismissed key", () => {
        const { container } = setup();
        expect(container.classList.contains("visible")).toBe(true);
    });

    it("shows a Sign in button and a dismiss button when visible", () => {
        const { container } = setup();
        const buttons = container.querySelectorAll("button");
        const labels = Array.from(buttons).map((b) => b.textContent);
        expect(labels).toContain("Sign in");
        expect(labels.some((l) => l.includes("✕"))).toBe(true);
    });

    it("is not visible when logged in", () => {
        const { container } = setup({ isLoggedIn: true });
        expect(container.classList.contains("visible")).toBe(false);
        expect(container.children.length).toBe(0);
    });

    it("is not visible when dismissed key is set", () => {
        localStorage.setItem(DISMISSED_KEY, "1");
        const { container } = setup();
        expect(container.classList.contains("visible")).toBe(false);
    });

    it("is not visible in dev fallback mode", () => {
        const { container } = setup({ isDevFallback: true });
        expect(container.classList.contains("visible")).toBe(false);
    });

    it("clicking the dismiss button sets dismissed key and hides banner", () => {
        const { container } = setup();
        const dismissBtn = Array.from(container.querySelectorAll("button")).find((b) =>
            b.textContent.includes("✕")
        );
        dismissBtn.click();
        expect(localStorage.getItem(DISMISSED_KEY)).toBe("1");
        expect(container.classList.contains("visible")).toBe(false);
    });

    it("clicking Sign in calls auth.requestToken()", () => {
        const { auth, container } = setup();
        const signInBtn = Array.from(container.querySelectorAll("button")).find(
            (b) => b.textContent === "Sign in"
        );
        signInBtn.click();
        expect(auth.requestToken).toHaveBeenCalledOnce();
    });

    it("re-renders when onLoggedInChanged fires (login → hide)", () => {
        const { auth, container } = setup();
        expect(container.classList.contains("visible")).toBe(true);

        // simulate login
        auth.isLoggedIn = true;
        const cb = auth.onLoggedInChanged.mock.calls[0][0];
        cb();

        expect(container.classList.contains("visible")).toBe(false);
    });

    it("re-shows after signInPromptsRestored event if dismissed key is cleared", () => {
        localStorage.setItem(DISMISSED_KEY, "1");
        const { container } = setup();
        expect(container.classList.contains("visible")).toBe(false);

        localStorage.removeItem(DISMISSED_KEY);
        window.dispatchEvent(new Event("grandPrix.signInPromptsRestored"));

        expect(container.classList.contains("visible")).toBe(true);
    });
});
