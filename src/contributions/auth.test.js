import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { GapiAuthController } from "./auth";

const TOKEN_KEY = "grandPrix.token";

// Minimal gapi stub sufficient for _restoreToken and _storeToken
function setupGapi() {
    global.gapi = {
        client: {
            getToken: vi.fn().mockReturnValue({ access_token: "tok" }),
            setToken: vi.fn(),
            init: vi.fn().mockResolvedValue(undefined),
        },
        load: vi.fn().mockImplementation((_, cb) => cb()),
    };
}

function setupGoogle() {
    const tokenClient = {
        callback: null,
        requestAccessToken: vi.fn(),
    };
    global.google = {
        accounts: {
            oauth2: {
                initTokenClient: vi.fn().mockReturnValue(tokenClient),
            },
        },
    };
    return tokenClient;
}

function storeValidToken() {
    localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({
            token: { access_token: "stored-tok" },
            expiry: Date.now() + 3_600_000,
        })
    );
}

describe("GapiAuthController — uncovered edge cases", () => {
    afterEach(() => {
        localStorage.clear();
        delete global.gapi;
        delete global.google;
        vi.restoreAllMocks();
    });

    // Bug: When a valid token is found in localStorage, _restoreToken() starts an
    // applyToken polling loop that fires every 100 ms until _gapiReady is true.
    // If GAPI never loads (e.g. network blocked in production), the loop runs
    // forever. dispose() does nothing — it does not cancel the pending timer.
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

        // Bug: dispose() is a no-op — the loop keeps scheduling after disposal
        expect(setTimeoutSpy.mock.calls.length).toBe(0);

        vi.useRealTimers();
    });

    // Bug: requestToken() wraps GSI's callback in a Promise but overwrites
    // _tokenClient.callback on every call. If two callers race, the second call
    // silently discards the first caller's resolve/reject functions. The first
    // Promise never settles, leaving the caller suspended indefinitely.
    it("first concurrent requestToken() caller eventually receives a response", async () => {
        setupGapi();
        const tokenClient = setupGoogle();

        const auth = new GapiAuthController(createMockEditor());
        // Trigger GSI init via the handleClientLoad hook
        window.handleClientLoad?.();

        const p1 = auth.requestToken();
        const p2 = auth.requestToken();

        // Fire one token callback — under the bug only p2's resolve is registered
        tokenClient.callback({ access_token: "tok", expires_in: 3600 });

        const TIMEOUT = Symbol("timeout");
        const race = (p) =>
            Promise.race([p, new Promise((r) => setTimeout(r, 50, TIMEOUT))]);

        expect(await race(p2)).not.toBe(TIMEOUT); // p2 resolves — expected

        // Bug: p1's resolve was overwritten; it hangs and loses the race
        expect(await race(p1)).not.toBe(TIMEOUT);
    });
});
