import { CLIENT_ID, DISCOVERY_DOC, SCOPES } from "../gapi_consts";

const CONTRIBUTION_ID = "driveMonaco.auth";
const TOKEN_KEY = "driveMonaco.token";

export class GapiAuthController {
    static ID = CONTRIBUTION_ID;

    static get(editor) {
        return editor.getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._loggedIn = false;
        this._listeners = [];
        this._tokenClient = null;
        this._gapiReady = false;
        this._gsiReady = false;

        if (import.meta.env.DEV) {
            this._loggedIn = true;
            this._fireLoggedInChanged();
            return;
        }

        this._restoreToken();
        this._setupHandleClientLoad();
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    get isLoggedIn() {
        return this._loggedIn;
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
        if (import.meta.env.DEV) return;

        return new Promise((resolve, reject) => {
            this._tokenClient.callback = (response) => {
                if (response.error) {
                    reject(response);
                    return;
                }
                this._storeToken(response);
                this._setLoggedIn(true);
                resolve(response);
            };
            this._tokenClient.requestAccessToken();
        });
    }

    getAccessToken() {
        if (import.meta.env.DEV) return "dev-token";
        const token = gapi.client.getToken();
        return token?.access_token;
    }

    /**
     * Execute a GAPI request with auto-retry on 401/403.
     */
    async executeWithRetry(requestFn) {
        try {
            return await requestFn();
        } catch (err) {
            const status = err?.status || err?.result?.error?.code;
            if (status === 401 || status === 403) {
                await this.requestToken();
                return await requestFn();
            }
            throw err;
        }
    }

    dispose() {}

    // --- Private ---

    _setupHandleClientLoad() {
        const originalHandler = window.handleClientLoad;
        window.handleClientLoad = () => {
            originalHandler?.();
            if (typeof gapi !== "undefined" && !this._gapiReady) {
                this._initGapi();
            }
            if (typeof google !== "undefined" && !this._gsiReady) {
                this._initGsi();
            }
        };

        // In case scripts already loaded before this contribution initialized
        if (typeof gapi !== "undefined") this._initGapi();
        if (typeof google !== "undefined") this._initGsi();
    }

    async _initGapi() {
        this._gapiReady = true;
        await new Promise((resolve) => gapi.load("client", resolve));
        await gapi.client.init({ discoveryDocs: [DISCOVERY_DOC] });
    }

    _initGsi() {
        this._gsiReady = true;
        this._tokenClient = google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPES,
            callback: () => {},
        });
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

            // Will be applied once gapi is loaded
            const applyToken = () => {
                if (typeof gapi !== "undefined" && gapi.client) {
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
