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

// `behavior` (optional) is invoked as behavior(tokenClient, config) whenever
// requestAccessToken is called, letting a test drive the GSI callback.
function setupGoogle(behavior) {
    const tokenClient = {
        callback: null,
        requestAccessToken: vi.fn((config) => behavior?.(tokenClient, config)),
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

// Flush microtasks + one macrotask so the async GAPI/GSI init settles.
const flush = () => new Promise((r) => setTimeout(r, 0));

function storeValidToken() {
    localStorage.setItem(
        TOKEN_KEY,
        JSON.stringify({
            token: { access_token: "stored-tok" },
            expiry: Date.now() + 3_600_000,
        })
    );
}

// NOTE: the _restoreToken polling-loop test lives in auth.restoreTimer.test.js.
// It needs vi.useFakeTimers(), which poisons real setTimeout for the rest of
// the file under happy-dom — so it is isolated in its own file.

describe("GapiAuthController — uncovered edge cases", () => {
    afterEach(() => {
        localStorage.clear();
        delete global.gapi;
        delete global.google;
        delete window.handleClientLoad;
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
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

        // requestToken awaits restore before wiring the GSI callback.
        await flush();

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

describe("GapiAuthController — login persistence", () => {
    afterEach(() => {
        localStorage.clear();
        delete global.gapi;
        delete global.google;
        delete window.handleClientLoad;
        vi.unstubAllEnvs();
        vi.restoreAllMocks();
    });

    // Construct a controller with GAPI/GSI "loaded" and a restored token (if
    // one was stored) already applied.
    async function makeReadyAuth(behavior) {
        setupGapi();
        const tokenClient = setupGoogle(behavior);
        const auth = new GapiAuthController(createMockEditor());
        window.handleClientLoad();
        // applyToken polls on a 100ms timer before it sees _gapiReady.
        await new Promise((r) => setTimeout(r, 150));
        return { auth, tokenClient };
    }

    it("requestToken adopts a restored token instead of prompting", async () => {
        storeValidToken();
        const { auth, tokenClient } = await makeReadyAuth();

        expect(auth.isLoggedIn).toBe(true);
        await auth.requestToken();

        expect(tokenClient.requestAccessToken).not.toHaveBeenCalled();
        auth.dispose();
    });

    it("tries a silent refresh before prompting interactively", async () => {
        const { auth, tokenClient } = await makeReadyAuth((tc, config) => {
            if (config?.prompt === "") {
                tc.callback({ error: "interaction_required" });
            } else {
                tc.callback({ access_token: "fresh", expires_in: 3600 });
            }
        });

        await auth.requestToken();

        expect(tokenClient.requestAccessToken).toHaveBeenNthCalledWith(1, {
            prompt: "",
        });
        expect(tokenClient.requestAccessToken).toHaveBeenNthCalledWith(2, {});
        expect(auth.isLoggedIn).toBe(true);
        auth.dispose();
    });

    it("applies the new token to gapi.client on success", async () => {
        const { auth } = await makeReadyAuth((tc) =>
            tc.callback({ access_token: "fresh", expires_in: 3600 })
        );

        await auth.requestToken();

        expect(gapi.client.setToken).toHaveBeenCalledWith({
            access_token: "fresh",
            expires_in: 3600,
        });
        auth.dispose();
    });

    it("clears the stored token when silent and interactive both fail", async () => {
        storeValidToken();
        const { auth } = await makeReadyAuth((tc) =>
            tc.callback({ error: "access_denied" })
        );

        // Resolves (DEV fallback) or rejects (prod) depending on env — either
        // way the dead token must not be left behind for the next tab.
        await auth.requestToken({ force: true }).catch(() => {});
        expect(localStorage.getItem(TOKEN_KEY)).toBeNull();
        auth.dispose();
    });

    it("syncs login state from another tab via the storage event", async () => {
        const { auth } = await makeReadyAuth();
        expect(auth.isLoggedIn).toBe(false);

        const newValue = JSON.stringify({
            token: { access_token: "x" },
            expiry: Date.now() + 3_600_000,
        });
        window.dispatchEvent(
            new StorageEvent("storage", { key: TOKEN_KEY, newValue })
        );
        expect(auth.isLoggedIn).toBe(true);
        expect(gapi.client.setToken).toHaveBeenCalledWith({
            access_token: "x",
        });

        window.dispatchEvent(
            new StorageEvent("storage", { key: TOKEN_KEY, newValue: null })
        );
        expect(auth.isLoggedIn).toBe(false);
        auth.dispose();
    });

    it("dispose removes the storage listener", async () => {
        const { auth } = await makeReadyAuth();
        const removeSpy = vi.spyOn(window, "removeEventListener");

        auth.dispose();

        expect(removeSpy).toHaveBeenCalledWith("storage", expect.any(Function));
    });

    it("ensureFreshToken is a no-op for a comfortably valid token", async () => {
        storeValidToken();
        const { auth, tokenClient } = await makeReadyAuth();

        await auth.ensureFreshToken();

        expect(tokenClient.requestAccessToken).not.toHaveBeenCalled();
        auth.dispose();
    });

    it("ensureFreshToken refreshes a near-expiry token", async () => {
        localStorage.setItem(
            TOKEN_KEY,
            JSON.stringify({
                token: { access_token: "old" },
                expiry: Date.now() + 30_000,
            })
        );
        const { auth, tokenClient } = await makeReadyAuth((tc) =>
            tc.callback({ access_token: "new", expires_in: 3600 })
        );

        await auth.ensureFreshToken();

        expect(tokenClient.requestAccessToken).toHaveBeenCalled();
        auth.dispose();
    });
});
