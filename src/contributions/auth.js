import { CLIENT_ID, DISCOVERY_DOC, SCOPES } from "../gapi_consts";
import { getContribution } from "../registry";

const CONTRIBUTION_ID = "grandPrix.auth";
const TOKEN_KEY = "grandPrix.token";

// How close to expiry a token may be before we proactively refresh it.
const EXPIRY_SKEW_MS = 60_000;
// Give up waiting for GAPI to load before settling the restore promise, so
// callers gating on restore (banner, prompts) are not blocked forever.
const RESTORE_DEADLINE_MS = 15_000;

export class GapiAuthController {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._loggedIn = false;
        this._listeners = [];
        this._tokenClient = null;
        this._gapiReady = false;
        this._gapiInitStarted = false;
        this._gsiReady = false;
        this._devFallback = false;
        this._disposed = false;
        this._restoreTokenTimer = null;
        this._pendingTokenRequest = null;
        this._expiry = null;

        // Resolves once token restore has settled (token applied, or there is
        // nothing valid to restore, or we gave up waiting for GAPI). Callers
        // can await this to avoid acting on a transiently-logged-out state.
        this._restoreSettled = false;
        this._restorePromise = new Promise((resolve) => {
            this._restoreResolve = resolve;
        });

        this._restoreToken();
        this._setupHandleClientLoad();
        this._setupStorageSync();
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    get isLoggedIn() {
        return this._loggedIn;
    }

    get isDevFallback() {
        return this._devFallback;
    }

    /** Resolves once initial token restore has settled. */
    get restored() {
        return this._restorePromise;
    }

    onLoggedInChanged(callback) {
        this._listeners.push(callback);
        return {
            dispose: () => {
                this._listeners = this._listeners.filter(
                    (cb) => cb !== callback
                );
            },
        };
    }

    /**
     * Ensure a usable access token exists, prompting only when necessary.
     *
     * Order of preference: an already-valid in-memory token → a fresh token a
     * sibling tab just wrote to localStorage → a silent refresh → an
     * interactive popup. `force` skips the no-op shortcuts and is used by the
     * 401/403 retry path, where the current token is known-bad even though its
     * expiry timestamp may still be in the future (e.g. server-side revocation).
     */
    async requestToken({ force = false } = {}) {
        if (this._devFallback) {
            this._setLoggedIn(true);
            return;
        }

        // Prefer an in-flight or already-applied restore over a popup.
        await this._restorePromise;

        if (!force && this._loggedIn && !this._isTokenExpired()) return;
        if (!force && this._adoptStoredTokenIfFresh()) return;

        // Coalesce concurrent callers onto one in-flight request. Each call
        // overwrites _tokenClient.callback, so without this the earlier
        // caller's promise would never settle.
        if (this._pendingTokenRequest) return this._pendingTokenRequest;

        this._pendingTokenRequest = this._doRequestToken().finally(() => {
            this._pendingTokenRequest = null;
        });
        return this._pendingTokenRequest;
    }

    /**
     * Refresh the token if it is missing, expired, or about to expire. Used by
     * Drive reads/writes so an idle session is silently renewed before the
     * request rather than failing with a 401 and triggering a popup.
     */
    async ensureFreshToken() {
        if (this._devFallback) return;
        await this._restorePromise;
        if (this._loggedIn && !this._isTokenExpired(EXPIRY_SKEW_MS)) return;
        if (this._adoptStoredTokenIfFresh()) return;
        // force: the current token is within skew of expiry, so requestToken's
        // "still valid" shortcut would otherwise no-op and skip the refresh.
        await this.requestToken({ force: true });
    }

    async _doRequestToken() {
        // GSI script may still be loading when this is called (e.g. from a
        // URL-state-driven open at page load). Wait briefly before giving up.
        if (!this._tokenClient) {
            await this._waitForGsi();
        }

        if (!this._tokenClient) {
            return this._handleTokenFailure(
                new Error("GSI token client not initialized"),
                "requestToken: GSI not loaded"
            );
        }

        // Try silently first — if the user still has a live Google session
        // this returns a token with no UI. Only fall back to the interactive
        // popup if the silent attempt cannot complete.
        try {
            return await this._requestAccessToken({ prompt: "" });
        } catch (silentErr) {
            console.warn(
                "[auth] Silent token refresh failed; prompting.",
                silentErr?.error ?? silentErr
            );
        }

        try {
            return await this._requestAccessToken({});
        } catch (err) {
            return this._handleTokenFailure(
                err,
                "requestToken: interactive token request failed"
            );
        }
    }

    /**
     * Wrap one GSI requestAccessToken call in a Promise. Rejects (rather than
     * routing through failure handling) so the caller can decide whether to
     * fall back to a different prompt mode.
     */
    _requestAccessToken(overrideConfig) {
        return new Promise((resolve, reject) => {
            this._tokenClient.callback = (response) => {
                if (response.error) {
                    reject(response);
                    return;
                }
                // Apply explicitly rather than relying on GSI's implicit
                // update of gapi.client — guarantees retries use the new token.
                if (this._gapiReady) {
                    gapi.client.setToken(response);
                }
                this._storeToken(response);
                this._setLoggedIn(true);
                resolve(response);
            };
            try {
                this._tokenClient.requestAccessToken(overrideConfig);
            } catch (err) {
                reject(err);
            }
        });
    }

    getAccessToken() {
        if (this._devFallback) return "dev-token";
        const token = gapi?.client?.getToken?.();
        return token?.access_token;
    }

    /**
     * Execute a GAPI request with auto-retry on 401/403.
     * In DEV, if the call fails because GAPI isn't usable, engages dev fallback
     * and returns undefined so callers don't crash.
     */
    async executeWithRetry(requestFn) {
        if (this._devFallback) {
            console.warn("[auth] DEV fallback active — skipping GAPI request");
            return undefined;
        }

        await this.ensureFreshToken();
        if (this._devFallback) return undefined;

        try {
            return await requestFn();
        } catch (err) {
            const status = err?.status || err?.result?.error?.code;
            if (status === 401 || status === 403) {
                await this.requestToken({ force: true });
                if (this._devFallback) return undefined;
                return await requestFn();
            }
            // Likely "gapi.client.drive is undefined" or similar — GAPI not ready
            if (import.meta.env.DEV && !this._gapiReady) {
                this._engageDevFallback(
                    "executeWithRetry: GAPI not ready in DEV",
                    err
                );
                return undefined;
            }
            throw err;
        }
    }

    // --- Dev fallback ---

    _engageDevFallback(reason, err) {
        if (this._devFallback) return;
        this._devFallback = true;
        console.error(
            `[auth] Engaging DEV fallback (no real Drive auth). Reason: ${reason}`,
            err ?? ""
        );
        this._settleRestore();
        this._setLoggedIn(true);
    }

    async _handleAuthFailure(err, reason) {
        if (import.meta.env.DEV) {
            this._engageDevFallback(reason, err);
            return;
        }
        throw err;
    }

    /**
     * A token request failed for real (silent + interactive both exhausted, or
     * GSI unavailable). Clear the dead token so future tabs don't restore it
     * and immediately 401, then defer to the normal failure handling.
     */
    async _handleTokenFailure(err, reason) {
        localStorage.removeItem(TOKEN_KEY);
        this._expiry = null;
        if (this._gapiReady) {
            gapi.client.setToken(null);
        }
        this._setLoggedIn(false);
        return this._handleAuthFailure(err, reason);
    }

    async _waitForGsi(timeoutMs = 10000) {
        const start = Date.now();
        while (!this._tokenClient && !this._devFallback) {
            if (Date.now() - start > timeoutMs) return;
            await new Promise((r) => setTimeout(r, 50));
        }
    }

    dispose() {
        this._disposed = true;
        if (this._restoreTokenTimer) {
            clearTimeout(this._restoreTokenTimer);
            this._restoreTokenTimer = null;
        }
        if (this._storageListener) {
            window.removeEventListener("storage", this._storageListener);
            this._storageListener = null;
        }
        this._settleRestore();
    }

    // --- Private ---

    _setupHandleClientLoad() {
        const originalHandler = window.handleClientLoad;
        window.handleClientLoad = () => {
            originalHandler?.();
            if (typeof gapi !== "undefined" && !this._gapiInitStarted) {
                this._initGapi();
            }
            if (typeof google !== "undefined" && !this._gsiReady) {
                this._initGsi();
            }
        };

        // In case scripts already loaded before this contribution initialized
        if (typeof gapi !== "undefined" && !this._gapiInitStarted) {
            this._initGapi();
        }
        if (typeof google !== "undefined" && !this._gsiReady) {
            this._initGsi();
        }
    }

    async _initGapi() {
        if (this._gapiInitStarted) return;
        this._gapiInitStarted = true;
        try {
            await new Promise((resolve) => gapi.load("client:picker", resolve));
            await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
            this._gapiReady = true;
        } catch (err) {
            console.error("[auth] GAPI init failed:", err);
            if (import.meta.env.DEV) {
                this._engageDevFallback("GAPI init failed in DEV", err);
            }
        }
    }

    _initGsi() {
        try {
            this._tokenClient = google.accounts.oauth2.initTokenClient({
                client_id: CLIENT_ID,
                scope: SCOPES,
                callback: () => {},
            });
            this._gsiReady = true;
        } catch (err) {
            console.error("[auth] GSI init failed:", err);
            if (import.meta.env.DEV) {
                this._engageDevFallback("GSI init failed in DEV", err);
            }
        }
    }

    _restoreToken() {
        let stored;
        try {
            stored = localStorage.getItem(TOKEN_KEY);
        } catch {
            this._settleRestore();
            return;
        }
        if (!stored) {
            this._settleRestore();
            return;
        }

        let token, expiry;
        try {
            ({ token, expiry } = JSON.parse(stored));
        } catch {
            localStorage.removeItem(TOKEN_KEY);
            this._settleRestore();
            return;
        }

        if (!expiry || Date.now() >= expiry) {
            localStorage.removeItem(TOKEN_KEY);
            this._settleRestore();
            return;
        }

        this._expiry = expiry;

        // Wait until gapi.client.init has loaded the discovery doc — listeners
        // (e.g. ConfigController) call gapi.client.drive.* immediately on login,
        // which is undefined until init completes. Settle the restore promise
        // either way once we apply the token or give up.
        const start = Date.now();
        const applyToken = () => {
            if (this._disposed || this._devFallback) return;
            if (this._gapiReady) {
                gapi.client.setToken(token);
                this._setLoggedIn(true);
                this._settleRestore();
            } else if (Date.now() - start > RESTORE_DEADLINE_MS) {
                this._settleRestore();
            } else {
                this._restoreTokenTimer = setTimeout(applyToken, 100);
            }
        };
        applyToken();
    }

    /**
     * Adopt a still-valid token from localStorage that another tab may have
     * just written. Returns true if a fresh token was adopted. Cheap dedupe of
     * the cross-tab refresh stampede — the storage event handles the same case
     * but may not have fired yet.
     */
    _adoptStoredTokenIfFresh() {
        if (!this._gapiReady) return false;
        let stored;
        try {
            stored = localStorage.getItem(TOKEN_KEY);
        } catch {
            return false;
        }
        if (!stored) return false;
        try {
            const { token, expiry } = JSON.parse(stored);
            if (!expiry || Date.now() >= expiry - EXPIRY_SKEW_MS) return false;
            const current = gapi.client.getToken?.();
            if (current?.access_token === token?.access_token) {
                // Same token already in effect; just trust the stored expiry.
                this._expiry = expiry;
                this._setLoggedIn(true);
                return !this._isTokenExpired();
            }
            gapi.client.setToken(token);
            this._expiry = expiry;
            this._setLoggedIn(true);
            return true;
        } catch {
            return false;
        }
    }

    _setupStorageSync() {
        this._storageListener = (event) => {
            if (event.key !== TOKEN_KEY) return;
            if (this._disposed || this._devFallback) return;

            if (!event.newValue) {
                // Another tab cleared the token (sign-out / dead token).
                this._expiry = null;
                if (this._gapiReady) {
                    gapi.client.setToken(null);
                }
                this._setLoggedIn(false);
                return;
            }

            try {
                const { token, expiry } = JSON.parse(event.newValue);
                if (!expiry || Date.now() >= expiry) return;
                this._expiry = expiry;
                if (this._gapiReady) {
                    gapi.client.setToken(token);
                }
                this._setLoggedIn(true);
            } catch {
                // Ignore malformed cross-tab writes.
            }
        };
        window.addEventListener("storage", this._storageListener);
    }

    _storeToken(response) {
        const expiry = Date.now() + response.expires_in * 1000;
        this._expiry = expiry;
        const token = (this._gapiReady && gapi.client.getToken?.()) || response;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiry }));
    }

    /** True when there is no token or it has passed (or is within skew of) expiry. */
    _isTokenExpired(skewMs = 0) {
        if (this._expiry == null) return true;
        return Date.now() >= this._expiry - skewMs;
    }

    _settleRestore() {
        if (this._restoreSettled) return;
        this._restoreSettled = true;
        this._restoreResolve();
    }

    _setLoggedIn(value) {
        if (this._loggedIn === value) return;
        this._loggedIn = value;
        this._fireLoggedInChanged();
    }

    _fireLoggedInChanged() {
        for (const cb of this._listeners) {
            cb(this._loggedIn);
        }
    }
}
