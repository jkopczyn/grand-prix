import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { registerContribution } from "../registry";
import {
    createMockEditor,
    editor as monacoEditor,
} from "../__mocks__/monaco-editor.js";
import { DriveController } from "./drive";

vi.mock("../utils", () => ({
    getUrlState: vi.fn(() => null),
    getLanguageForFilename: vi.fn(() => "plaintext"),
}));

const AUTH_ID = "grandPrix.auth";
const CONFIG_ID = "grandPrix.config";

function makeAuth(overrides = {}) {
    return {
        isLoggedIn: false,
        isDevFallback: false,
        onLoggedInChanged: vi.fn().mockReturnValue({ dispose: vi.fn() }),
        executeWithRetry: vi.fn(),
        getAccessToken: vi.fn().mockReturnValue("test-token"),
        requestToken: vi.fn().mockResolvedValue(undefined),
        ...overrides,
    };
}

function makeMockModel() {
    return { getValue: vi.fn(() => ""), dispose: vi.fn() };
}

function setup(authOverrides = {}) {
    const auth = makeAuth(authOverrides);
    registerContribution(AUTH_ID, auth);
    registerContribution(CONFIG_ID, { applyConfig: vi.fn() });
    const editor = createMockEditor();
    editor.getModel.mockReturnValue(makeMockModel());
    monacoEditor.createModel.mockReturnValue(makeMockModel());
    const drive = new DriveController(editor);
    return { auth, editor, drive };
}

describe("DriveController — uncovered edge cases", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    // Bug: openFile() crashes with TypeError when executeWithRetry returns undefined.
    // This happens when auth is in dev-fallback mode: executeWithRetry short-circuits
    // and returns undefined, but openFile does not guard against it before accessing
    // metaResponse.result.name.
    it("openFile() resolves without error when auth returns undefined from executeWithRetry", async () => {
        const { drive } = setup({
            isDevFallback: true,
            executeWithRetry: vi.fn().mockResolvedValue(undefined),
        });

        await expect(drive.openFile("file-id")).resolves.toBeUndefined();
    });

    // Bug: openFile() leaves drive.fileName set but drive.fileId null when the
    // content fetch fails after the metadata fetch succeeds. Callers can observe
    // an inconsistent state: a fileName with no corresponding fileId.
    it("openFile() does not expose a stale fileName when content fetch fails", async () => {
        const { drive, auth } = setup();
        auth.executeWithRetry
            .mockResolvedValueOnce({ result: { name: "foo.js" } })
            .mockRejectedValueOnce(new Error("content fetch failed"));

        await expect(drive.openFile("file-id")).rejects.toThrow(
            "content fetch failed"
        );

        // After a failed open, no state should have been mutated
        expect(drive.fileId).toBeNull();
        expect(drive.fileName).toBeNull();
    });

    // Bug: saveFile() recurses without a depth limit when the server persistently
    // returns 401. Each recursive call re-requests a token and tries again, with no
    // circuit breaker. Under a stubborn server or broken auth flow this becomes an
    // infinite call stack.
    it("saveFile() retries at most once on a persistent 401 before giving up", async () => {
        const { drive, auth } = setup();
        drive._fileId = "file-id";

        let fetchCallCount = 0;
        global.fetch = vi.fn().mockImplementation(() => {
            fetchCallCount++;
            if (fetchCallCount > 3) {
                throw new Error(
                    "runaway recursion — no depth guard in saveFile()"
                );
            }
            return Promise.resolve({ status: 401, ok: false });
        });

        await expect(drive.saveFile()).rejects.toThrow();

        // Should have called fetch at most twice: one original attempt + one retry.
        // Currently recurses until fetchCallCount exceeds the guard above.
        expect(fetchCallCount).toBeLessThanOrEqual(2);
    });
});
