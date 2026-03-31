import { GapiAuthController } from "./auth";
import { getContribution } from "../registry";
import * as monaco from "../monaco";

const CONTRIBUTION_ID = "driveMonaco.config";
const STORAGE_KEY = "driveMonaco.config";
const CONFIG_FILENAME = "config.json";

const DEFAULTS = {
    theme: "vs",
    wordWrap: "off",
    renderWhitespace: "none",
    lineNumbers: "on",
};

export class ConfigController {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._config = { ...DEFAULTS };

        this._loadLocal();
        this._applyConfig();

        const auth = GapiAuthController.get();
        auth.onLoggedInChanged((loggedIn) => {
            if (loggedIn && !import.meta.env.DEV) {
                this._fetchDriveConfig();
            }
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
        if (!import.meta.env.DEV) {
            this._saveToDrive();
        }
    }

    dispose() {}

    // --- Private ---

    _applyConfig() {
        monaco.editor.setTheme(this._config.theme);
        this._editor.updateOptions({
            wordWrap: this._config.wordWrap,
            renderWhitespace: this._config.renderWhitespace,
            lineNumbers: this._config.lineNumbers,
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

    async _saveToDrive() {
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

            await fetch(
                `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
                {
                    method: "PATCH",
                    headers: {
                        Authorization: `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(this._config),
                }
            );
        } catch {
            // Save to Drive failed — local copy is still current
        }
    }
}
