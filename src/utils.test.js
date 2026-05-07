import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { getUrlState, getLanguageForFilename } from "./utils";

function stubSearch(search) {
    vi.stubGlobal("location", { search });
}

describe("getUrlState", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it("returns null when no state param", () => {
        stubSearch("");
        expect(getUrlState()).toBeNull();
    });

    it("returns null for malformed JSON", () => {
        stubSearch("?state=not-json");
        expect(getUrlState()).toBeNull();
    });

    it("returns null for empty state param", () => {
        stubSearch("?state=");
        expect(getUrlState()).toBeNull();
    });

    it("parses a valid open action", () => {
        const state = { action: "open", ids: ["abc123"], userId: "user1" };
        stubSearch("?state=" + encodeURIComponent(JSON.stringify(state)));
        expect(getUrlState()).toEqual(state);
    });

    it("parses a valid create action", () => {
        const state = { action: "create", folderId: "folder1" };
        stubSearch("?state=" + encodeURIComponent(JSON.stringify(state)));
        expect(getUrlState()).toEqual(state);
    });
});

describe("getLanguageForFilename", () => {
    it("maps .bashrc to shell", () => {
        expect(getLanguageForFilename(".bashrc")).toBe("shell");
    });

    it("maps .bash_profile to shell", () => {
        expect(getLanguageForFilename(".bash_profile")).toBe("shell");
    });

    it("maps .zshrc to shell", () => {
        expect(getLanguageForFilename(".zshrc")).toBe("shell");
    });

    it("maps .profile to shell", () => {
        expect(getLanguageForFilename(".profile")).toBe("shell");
    });

    it("maps .js to javascript", () => {
        expect(getLanguageForFilename("foo.js")).toBe("javascript");
    });

    it("maps .py to python", () => {
        expect(getLanguageForFilename("script.py")).toBe("python");
    });

    it("maps .ts to typescript", () => {
        expect(getLanguageForFilename("app.ts")).toBe("typescript");
    });

    it("strips directory prefix before matching extension", () => {
        expect(getLanguageForFilename("path/to/script.py")).toBe("python");
    });

    it("strips path prefix before matching dotfile", () => {
        expect(getLanguageForFilename("path/to/.bashrc")).toBe("shell");
    });

    it("returns plaintext for unknown extension", () => {
        expect(getLanguageForFilename("archive.tar.gz")).toBe("plaintext");
    });

    it("returns plaintext for file with no extension", () => {
        expect(getLanguageForFilename("README")).toBe("plaintext");
    });
});
