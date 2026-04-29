import { CLIENT_ID, DISCOVERY_DOC, SCOPES } from "../gapi_consts";
import { getContribution } from "../registry";

const CONTRIBUTION_ID = "grandPrix.auth";
const TOKEN_KEY = "grandPrix.token";

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

        this._restoreToken();
        this._setupHandleClientLoad();
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

    async requestToken() {
        if (this._devFallback) {
            this._setLoggedIn(true);
            return;
        }

        // GSI script may still be loading when this is called (e.g. from a
        // URL-state-driven open at page load). Wait briefly before giving up.
        if (!this._tokenClient) {
            await this._waitForGsi();
        }

        if (!this._tokenClient) {
            return this._handleAuthFailure(
                new Error("GSI token client not initialized"),
                "requestToken: GSI not loaded"
            );
        }

        return new Promise((resolve, reject) => {
            this._tokenClient.callback = (response) => {
                if (response.error) {
                    this._handleAuthFailure(
                        response,
                        "requestToken: token request errored"
                    )
                        .then(resolve)
                        .catch(reject);
                    return;
                }
                this._storeToken(response);
                this._setLoggedIn(true);
                resolve(response);
            };
            try {
                this._tokenClient.requestAccessToken();
            } catch (err) {
                this._handleAuthFailure(
                    err,
                    "requestToken: requestAccessToken threw"
                )
                    .then(resolve)
                    .catch(reject);
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
            console.warn(
                "[auth] DEV fallback active — skipping GAPI request"
            );
            return undefined;
        }

        try {
            return await requestFn();
        } catch (err) {
            const status = err?.status || err?.result?.error?.code;
            if (status === 401 || status === 403) {
                await this.requestToken();
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
        this._setLoggedIn(true);
    }

    async _handleAuthFailure(err, reason) {
        if (import.meta.env.DEV) {
            this._engageDevFallback(reason, err);
            return;
        }
        throw err;
    }

    async _waitForGsi(timeoutMs = 10000) {
        const start = Date.now();
        while (!this._tokenClient && !this._devFallback) {
            if (Date.now() - start > timeoutMs) return;
            await new Promise((r) => setTimeout(r, 50));
        }
    }

    dispose() {}

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
        try {
            const stored = localStorage.getItem(TOKEN_KEY);
            if (!stored) return;

            const { token, expiry } = JSON.parse(stored);
            if (Date.now() >= expiry) {
                localStorage.removeItem(TOKEN_KEY);
                return;
            }

            // Wait until gapi.client.init has loaded the discovery doc — listeners
            // (e.g. ConfigController) call gapi.client.drive.* immediately on login,
            // which is undefined until init completes.
            const applyToken = () => {
                if (this._devFallback) return;
                if (this._gapiReady) {
                    gapi.client.setToken(token);
                    this._setLoggedIn(true);
                } else {
                    setTimeout(applyToken, 100);
                }
            };
            applyToken();
        } catch {
            localStorage.removeItem(TOKEN_KEY);
        }
    }

    _storeToken(response) {
        const token = gapi.client.getToken();
        const expiry = Date.now() + response.expires_in * 1000;
        localStorage.setItem(TOKEN_KEY, JSON.stringify({ token, expiry }));
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
