import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor, editor as monacoEditor } from "../__mocks__/monaco-editor.js";
import { ConfigController } from "./config";

const AUTH_ID = "grandPrix.auth";
const DRIVE_ID = "grandPrix.drive";
const STORAGE_KEY = "grandPrix.config";
const DIRTY_KEY = "grandPrix.config.dirty";

function makeAuth(overrides = {}) {
    return {
        isLoggedIn: false,
        isDevFallback: true,
        onLoggedInChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        executeWithRetry: vi.fn(),
        getAccessToken: vi.fn().mockReturnValue("dev-token"),
        ...overrides,
    };
}

function setup(authOverrides = {}) {
    const auth = makeAuth(authOverrides);
    registerContribution(AUTH_ID, auth);
    registerContribution(DRIVE_ID, { fileName: null });
    const editor = createMockEditor();
    const config = new ConfigController(editor);
    return { auth, editor, config };
}

describe("ConfigController", () => {
    beforeEach(() => {
        localStorage.clear();
    });

    // --- Defaults ---

    it("get() returns default theme", () => {
        const { config } = setup();
        expect(config.get("theme")).toBe("vs");
    });

    it("get() returns default wordWrap", () => {
        const { config } = setup();
        expect(config.get("wordWrap")).toBe("off");
    });

    it("get() returns default renderWhitespace", () => {
        const { config } = setup();
        expect(config.get("renderWhitespace")).toBe("none");
    });

    it("get() returns default lineNumbers", () => {
        const { config } = setup();
        expect(config.get("lineNumbers")).toBe("on");
    });

    // --- set() ---

    it("set() updates in-memory value immediately", () => {
        const { config } = setup();
        config.set("wordWrap", "on");
        expect(config.get("wordWrap")).toBe("on");
    });

    it("set() persists to localStorage", () => {
        const { config } = setup();
        config.set("theme", "vs-dark");
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(stored.theme).toBe("vs-dark");
    });

    it("set() marks dirty flag in localStorage", () => {
        const { config } = setup();
        config.set("wordWrap", "on");
        expect(localStorage.getItem(DIRTY_KEY)).toBe("1");
    });

    it("set() calls monaco.editor.setTheme with new theme", () => {
        const { config } = setup();
        config.set("theme", "hc-black");
        expect(monacoEditor.setTheme).toHaveBeenCalledWith("hc-black");
    });

    it("set() calls editor.updateOptions with new wordWrap", () => {
        const { editor, config } = setup();
        config.set("wordWrap", "on");
        const lastCall = editor.updateOptions.mock.calls.at(-1)[0];
        expect(lastCall.wordWrap).toBe("on");
    });

    it("set() calls editor.updateOptions with new lineNumbers", () => {
        const { editor, config } = setup();
        config.set("lineNumbers", "relative");
        const lastCall = editor.updateOptions.mock.calls.at(-1)[0];
        expect(lastCall.lineNumbers).toBe("relative");
    });

    it("set() calls editor.updateOptions with new renderWhitespace", () => {
        const { editor, config } = setup();
        config.set("renderWhitespace", "all");
        const lastCall = editor.updateOptions.mock.calls.at(-1)[0];
        expect(lastCall.renderWhitespace).toBe("all");
    });

    // --- onDidSet ---

    it("onDidSet callback fires with key and value", () => {
        const { config } = setup();
        const cb = vi.fn();
        config.onDidSet(cb);
        config.set("theme", "vs-dark");
        expect(cb).toHaveBeenCalledWith("theme", "vs-dark");
    });

    it("onDidSet fires for every subsequent set()", () => {
        const { config } = setup();
        const cb = vi.fn();
        config.onDidSet(cb);
        config.set("wordWrap", "on");
        config.set("theme", "vs-dark");
        expect(cb).toHaveBeenCalledTimes(2);
    });

    it("onDidSet dispose() removes the listener", () => {
        const { config } = setup();
        const cb = vi.fn();
        const { dispose } = config.onDidSet(cb);
        dispose();
        config.set("theme", "hc-black");
        expect(cb).not.toHaveBeenCalled();
    });

    // --- localStorage loading ---

    it("constructor loads stored config from localStorage", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ theme: "hc-light", wordWrap: "on" }));
        const { config } = setup();
        expect(config.get("theme")).toBe("hc-light");
        expect(config.get("wordWrap")).toBe("on");
    });

    it("constructor applies stored config to the editor on load", () => {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ wordWrap: "on" }));
        const { editor } = setup();
        const firstCall = editor.updateOptions.mock.calls[0][0];
        expect(firstCall.wordWrap).toBe("on");
    });

    it("constructor ignores corrupt localStorage data and uses defaults", () => {
        localStorage.setItem(STORAGE_KEY, "not valid json {{{");
        const { config } = setup();
        expect(config.get("theme")).toBe("vs");
    });

    // --- reset() ---

    it("reset() removes config from localStorage", async () => {
        const { config } = setup();
        config.set("theme", "hc-black");
        await config.reset();
        expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    });

    it("reset() resets in-memory config to defaults", async () => {
        const { config } = setup();
        config.set("theme", "hc-black");
        config.set("wordWrap", "on");
        await config.reset();
        expect(config.get("theme")).toBe("vs");
        expect(config.get("wordWrap")).toBe("off");
    });

    it("reset() clears the dirty flag", async () => {
        const { config } = setup();
        config.set("theme", "vs-dark");
        await config.reset();
        expect(localStorage.getItem(DIRTY_KEY)).toBeNull();
    });

    it("reset() applies default config to editor", async () => {
        const { editor, config } = setup();
        config.set("wordWrap", "on");
        await config.reset();
        const lastCall = editor.updateOptions.mock.calls.at(-1)[0];
        expect(lastCall.wordWrap).toBe("off");
    });

    // --- Autocomplete ---

    it("getEffectiveAutocomplete returns false for plaintext language", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("plaintext");
        expect(config.getEffectiveAutocomplete()).toBe(false);
    });

    it("getEffectiveAutocomplete returns true for javascript", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("javascript");
        expect(config.getEffectiveAutocomplete()).toBe(true);
    });

    it("getEffectiveAutocomplete returns false when override is 'off'", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("javascript");
        config.setAutocompleteForCurrentLanguage("off");
        expect(config.getEffectiveAutocomplete()).toBe(false);
    });

    it("getEffectiveAutocomplete returns true when override is 'on' for plaintext", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("plaintext");
        config.setAutocompleteForCurrentLanguage("on");
        expect(config.getEffectiveAutocomplete()).toBe(true);
    });

    it("setAutocompleteForCurrentLanguage stores the value under the language key", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("python");
        config.setAutocompleteForCurrentLanguage("on");
        const stored = JSON.parse(localStorage.getItem(STORAGE_KEY));
        expect(stored.autocompleteByLanguage.python).toBe("on");
    });

    it("clearAutocompleteForCurrentLanguage removes the language override", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("python");
        config.setAutocompleteForCurrentLanguage("off");
        config.clearAutocompleteForCurrentLanguage();
        expect(config.getAutocompleteOverrideForCurrentLanguage()).toBeUndefined();
    });

    it("getAutocompleteOverrideForCurrentLanguage returns undefined when not set", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("python");
        expect(config.getAutocompleteOverrideForCurrentLanguage()).toBeUndefined();
    });

    it("getAutocompleteOverrideForCurrentLanguage returns stored value", () => {
        const { editor, config } = setup();
        editor._model.getLanguageId.mockReturnValue("typescript");
        config.setAutocompleteForCurrentLanguage("off");
        expect(config.getAutocompleteOverrideForCurrentLanguage()).toBe("off");
    });
});
