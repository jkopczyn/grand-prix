import { GapiAuthController } from "./auth";
import { getUrlState, getLanguageForFilename } from "../utils";
import { getContribution } from "../registry";
import * as monaco from "../monaco";

const CONTRIBUTION_ID = "grandPrix.drive";

export class DriveController {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._fileId = null;
        this._fileName = null;
        this._hasUnsavedChanges = false;

        window.addEventListener("beforeunload", (e) => {
            if (this._hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = "";
            }
        });

        this._editor.onDidChangeModelContent(() => {
            if (this._fileId) {
                this._hasUnsavedChanges = true;
            }
        });

        const auth = GapiAuthController.get();
        auth.onLoggedInChanged((loggedIn) => {
            if (loggedIn) this._handleUrlState();
        });
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    get fileId() {
        return this._fileId;
    }

    get fileName() {
        return this._fileName;
    }

    get hasUnsavedChanges() {
        return this._hasUnsavedChanges;
    }

    async openFile(id) {
        const auth = GapiAuthController.get();

        const metaResponse = await auth.executeWithRetry(() =>
            gapi.client.drive.files.get({
                fileId: id,
                fields: "name",
            })
        );
        this._fileName = metaResponse.result.name;

        const contentResponse = await auth.executeWithRetry(() =>
            gapi.client.drive.files.get({
                fileId: id,
                alt: "media",
            })
        );

        const content =
            typeof contentResponse.body === "string"
                ? contentResponse.body
                : JSON.stringify(contentResponse.result, null, 2);

        this._fileId = id;
        this._hasUnsavedChanges = false;

        const lang = getLanguageForFilename(this._fileName);
        const model = this._editor.getModel();
        monaco.editor.setModelLanguage(model, lang);
        this._editor.setValue(content);

        document.title = `${this._fileName} — Grand Prix`;
    }

    async saveFile() {
        if (!this._fileId) return;

        const auth = GapiAuthController.get();
        const token = auth.getAccessToken();
        const content = this._editor.getValue();

        const response = await fetch(
            `https://www.googleapis.com/upload/drive/v3/files/${this._fileId}?uploadType=media`,
            {
                method: "PATCH",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "text/plain",
                },
                body: content,
            }
        );

        if (response.status === 401 || response.status === 403) {
            await auth.requestToken();
            return this.saveFile();
        }

        if (!response.ok) {
            throw new Error(`Save failed: ${response.status}`);
        }

        this._hasUnsavedChanges = false;
        return response.json();
    }

    async createFile(name, folderId) {
        const auth = GapiAuthController.get();

        const response = await auth.executeWithRetry(() =>
            gapi.client.drive.files.create({
                resource: {
                    name,
                    parents: folderId ? [folderId] : [],
                },
            })
        );

        const newId = response.result.id;
        await this.openFile(newId);
        return newId;
    }

    dispose() {}

    // --- Private ---

    async _handleUrlState() {
        const state = getUrlState();
        if (!state) return;

        if (state.action === "open" && state.ids?.length) {
            await this.openFile(state.ids[0]);
        } else if (state.action === "create") {
            const name = prompt("Enter file name:");
            if (name) {
                await this.createFile(name, state.folderId);
            }
        }
    }
}
