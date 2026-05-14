import { describe, it, expect, afterEach, vi } from "vitest";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { GapiAuthController } from "./auth";

const TOKEN_KEY = "grandPrix.token";

// Isolated in its own file: vi.useFakeTimers() under happy-dom poisons real
// setTimeout for any later test in the same file, so the timer-based test
// cannot share a file with tests that await real timers.

function storeValidToken() {
    localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({
            token: { access_token: "stored-tok" },
            expiry: Date.now() + 3_600_000,
        })
    );
}

describe("GapiAuthController — restore polling loop", () => {
    afterEach(() => {
        localStorage.clear();
        delete window.handleClientLoad;
        vi.restoreAllMocks();
    });

    // When a valid token is found in localStorage, _restoreToken() starts an
    // applyToken polling loop that fires every 100 ms until _gapiReady is true.
    // dispose() must cancel the pending timer so the loop cannot run forever
    // when GAPI never loads (e.g. network blocked in production).
    it("polling loop halts after dispose() when GAPI never loads", async () => {
        vi.useFakeTimers();
        storeValidToken();

        const auth = new GapiAuthController(createMockEditor());

        const setTimeoutSpy = vi.spyOn(global, "setTimeout");
        setTimeoutSpy.mockClear();

        // Give the loop some time to run
        await vi.advanceTimersByTimeAsync(300);
        const callsBeforeDispose = setTimeoutSpy.mock.calls.length;
        expect(callsBeforeDispose).toBeGreaterThan(0); // confirm it is looping

        // Disposing should cancel the timer so no further scheduling occurs
        auth.dispose();
        setTimeoutSpy.mockClear();
        await vi.advanceTimersByTimeAsync(500);

        expect(setTimeoutSpy.mock.calls.length).toBe(0);

        setTimeoutSpy.mockRestore();
        vi.useRealTimers();
    });
});
