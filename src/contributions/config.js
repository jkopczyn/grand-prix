import { GapiAuthController } from "./auth";
import { DriveController } from "./drive";
import { getContribution } from "../registry";
import * as monaco from "../monaco";

const CONTRIBUTION_ID = "grandPrix.config";
const STORAGE_KEY = "grandPrix.config";
const DIRTY_KEY = "grandPrix.config.dirty";
const CONFIG_FILENAME = "config.json";
const PUSH_DEBOUNCE_MS = 3000;

const DEFAULTS = {
    theme: "vs",
    wordWrap: "off",
    renderWhitespace: "none",
    lineNumbers: "on",
    autocompleteByLanguage: {},
};

export class ConfigController {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._config = { ...DEFAULTS, autocompleteByLanguage: {} };
        this._dirty = localStorage.getItem(DIRTY_KEY) === "1";
        this._pushTimer = null;
        this._didSetListeners = [];

        this._loadLocal();
        this._applyConfig();

        // Per-language autocomplete depends on the current model language.
        this._editor.onDidChangeModelLanguage(() => this._applyConfig());

        const auth = GapiAuthController.get();
        auth.onLoggedInChanged((loggedIn) => {
            if (!loggedIn || auth.isDevFallback) return;
            // Local-first reconciliation: dirty local wins, otherwise pull.
            if (this._dirty) this._flushPush();
            else this._fetchDriveConfig();
        });

        // If we boot up already-logged-in with a dirty queue (e.g. tab closed
        // before debounce flushed last session), push as soon as GAPI is ready.
        if (this._dirty && auth.isLoggedIn && !auth.isDevFallback) {
            this._schedulePush();
        }

        const flush = () => this._flushPush({ keepalive: true });
        window.addEventListener("beforeunload", flush);
        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flush();
        });
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    get(key) {
        return this._config[key];
    }

    set(key, value) {
        this._config[key] = value;
        this._applyConfig();
        this._saveLocal();
        this._markDirty(true);
        const auth = GapiAuthController.get();
        if (auth.isLoggedIn && !auth.isDevFallback) {
            this._schedulePush();
        }
        for (const cb of this._didSetListeners) cb(key, value);
    }

    onDidSet(callback) {
        this._didSetListeners.push(callback);
        return {
            dispose: () => {
                this._didSetListeners = this._didSetListeners.filter(
                    (cb) => cb !== callback
                );
            },
        };
    }

    getEffectiveAutocomplete() {
        const lang = this._editor.getModel()?.getLanguageId();
        const v = this._config.autocompleteByLanguage?.[lang];
        if (v === "on") return true;
        if (v === "off") return false;
        // Smart default: off for plaintext-style files. Check both the
        // Monaco language and the filename — for newly-created files the
        // language may briefly lag behind the filename being assigned.
        if (lang === "plaintext") return false;
        const fileName = DriveController.get()?.fileName;
        if (fileName) {
            const base = fileName.split("/").pop();
            if (!base.includes(".") || base.endsWith(".txt")) return false;
        }
        return true;
    }

    setAutocompleteForCurrentLanguage(value) {
        const lang = this._editor.getModel()?.getLanguageId();
        if (!lang) return;
        const next = {
            ...this._config.autocompleteByLanguage,
            [lang]: value,
        };
        this.set("autocompleteByLanguage", next);
    }

    clearAutocompleteForCurrentLanguage() {
        const lang = this._editor.getModel()?.getLanguageId();
        if (!lang) return;
        const next = { ...this._config.autocompleteByLanguage };
        delete next[lang];
        this.set("autocompleteByLanguage", next);
    }

    getAutocompleteOverrideForCurrentLanguage() {
        const lang = this._editor.getModel()?.getLanguageId();
        return this._config.autocompleteByLanguage?.[lang];
    }

    applyConfig() {
        this._applyConfig();
    }

    async reset() {
        localStorage.removeItem(STORAGE_KEY);
        this._markDirty(false);
        clearTimeout(this._pushTimer);
        this._pushTimer = null;
        // Reset in-memory state and re-apply *before* the Drive delete so
        // the user sees defaults immediately even if Drive is slow/offline.
        // Use a fresh object for the per-language map so mutations after
        // reset don't leak into DEFAULTS.
        this._config = { ...DEFAULTS, autocompleteByLanguage: {} };
        this._applyConfig();

        const auth = GapiAuthController.get();
        // Skip Drive cleanup if not actually signed in — otherwise
        // executeWithRetry's 401 retry would pop a fresh sign-in prompt.
        if (!auth.isLoggedIn || auth.isDevFallback) return;
        try {
            const listResponse = await auth.executeWithRetry(() =>
                gapi.client.drive.files.list({
                    spaces: "appDataFolder",
                    q: `name = '${CONFIG_FILENAME}'`,
                    fields: "files(id)",
                })
            );
            const files = listResponse?.result?.files;
            if (files && files.length > 0) {
                await auth.executeWithRetry(() =>
                    gapi.client.drive.files.delete({ fileId: files[0].id })
                );
            }
        } catch (err) {
            console.error("[config] Failed to clear Drive config:", err);
        }
    }

    dispose() {}

    // --- Private ---

    _markDirty(value) {
        this._dirty = value;
        if (value) localStorage.setItem(DIRTY_KEY, "1");
        else localStorage.removeItem(DIRTY_KEY);
    }

    _schedulePush() {
        clearTimeout(this._pushTimer);
        this._pushTimer = setTimeout(
            () => this._flushPush(),
            PUSH_DEBOUNCE_MS
        );
    }

    async _flushPush({ keepalive = false } = {}) {
        clearTimeout(this._pushTimer);
        this._pushTimer = null;
        if (!this._dirty) return;
        const auth = GapiAuthController.get();
        if (!auth.isLoggedIn || auth.isDevFallback) return;
        const ok = await this._saveToDrive({ keepalive });
        if (ok) this._markDirty(false);
    }

    _applyConfig() {
        monaco.editor.setTheme(this._config.theme);
        const autocomplete = this.getEffectiveAutocomplete();
        this._editor.updateOptions({
            wordWrap: this._config.wordWrap,
            renderWhitespace: this._config.renderWhitespace,
            lineNumbers: this._config.lineNumbers,
            quickSuggestions: autocomplete,
            suggestOnTriggerCharacters: autocomplete,
        });
    }

    _loadLocal() {
        try {
            const stored = localStorage.getItem(STORAGE_KEY);
            if (stored) {
                Object.assign(this._config, JSON.parse(stored));
            }
        } catch {
            // ignore corrupt data
        }
    }

    _saveLocal() {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this._config));
    }

    async _fetchDriveConfig() {
        try {
            const auth = GapiAuthController.get();

            const listResponse = await auth.executeWithRetry(() =>
                gapi.client.drive.files.list({
                    spaces: "appDataFolder",
                    q: `name = '${CONFIG_FILENAME}'`,
                    fields: "files(id)",
                })
            );

            const files = listResponse.result.files;
            if (!files || files.length === 0) return;

            const contentResponse = await auth.executeWithRetry(() =>
                gapi.client.drive.files.get({
                    fileId: files[0].id,
                    alt: "media",
                })
            );

            const driveConfig = contentResponse.result;
            Object.assign(this._config, driveConfig);
            this._saveLocal();
            this._applyConfig();
        } catch {
            // Drive config fetch failed — use local
        }
    }

    async _saveToDrive({ keepalive = false } = {}) {
        try {
            const auth = GapiAuthController.get();
            const token = auth.getAccessToken();

            const listResponse = await auth.executeWithRetry(() =>
                gapi.client.drive.files.list({
                    spaces: "appDataFolder",
                    q: `name = '${CONFIG_FILENAME}'`,
                    fields: "files(id)",
                })
            );

            const files = listResponse.result.files;
            let fileId;

            if (files && files.length > 0) {
                fileId = files[0].id;
            } else {
                const createResponse = await auth.executeWithRetry(() =>
                    gapi.client.drive.files.create({
                        resource: {
                            name: CONFIG_FILENAME,
                            parents: ["appDataFolder"],
                        },
                    })
                );
                fileId = createResponse.result.id;
            }

            const res = await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(this._config),
                    keepalive,
                }
            );
            return res.ok;
        } catch {
            // Save to Drive failed — local copy remains; dirty stays set.
            return false;
        }
    }
}
