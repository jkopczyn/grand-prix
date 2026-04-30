import { GapiAuthController } from "./auth";
import { ConfigController } from "./config";
import { getContribution } from "../registry";

const CONTRIBUTION_ID = "grandPrix.firstChangePrompt";
const SIGN_IN_DISMISSED_KEY = "grandPrix.signInDismissed";
const SESSION_SHOWN_KEY = "grandPrix.signInPromptShownThisSession";

export class FirstChangePrompt {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._domNode = null;

        const config = ConfigController.get();
        config.onDidSet(() => this._maybeShow());
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    dispose() {
        this._hide();
    }

    // --- Private ---

    _maybeShow() {
        if (this._domNode) return; // already showing
        const auth = GapiAuthController.get();
        if (auth.isLoggedIn) return;
        if (auth.isDevFallback) return;
        if (localStorage.getItem(SIGN_IN_DISMISSED_KEY) === "1") return;
        if (sessionStorage.getItem(SESSION_SHOWN_KEY) === "1") return;
        sessionStorage.setItem(SESSION_SHOWN_KEY, "1");
        this._show();
    }

    _show() {
        this._domNode = document.createElement("div");
        Object.assign(this._domNode.style, {
            position: "fixed",
            top: "0",
            left: "0",
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: "1000",
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
            background: "#1e1e1e",
            color: "#cccccc",
            padding: "32px 40px",
            borderRadius: "8px",
            textAlign: "center",
            fontFamily:
                "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            maxWidth: "440px",
        });

        const title = document.createElement("h2");
        title.textContent = "Sync your settings?";
        Object.assign(title.style, {
            margin: "0 0 12px",
            color: "#ffffff",
        });

        const desc = document.createElement("p");
        desc.textContent =
            "You just changed a setting. Sign in to Google Drive to keep settings in sync across devices. Your changes are saved locally either way.";
        Object.assign(desc.style, {
            margin: "0 0 24px",
            lineHeight: "1.5",
        });

        const buttonRow = document.createElement("div");
        Object.assign(buttonRow.style, {
            display: "flex",
            gap: "8px",
            justifyContent: "center",
            flexWrap: "wrap",
        });

        const signInBtn = this._makeButton("Sign in", "#4285f4");
        signInBtn.addEventListener("click", () => {
            const auth = GapiAuthController.get();
            auth.requestToken().catch((err) => {
                console.error("[firstChangePrompt] Sign in failed:", err);
            });
            // User has acted; suppress further nudges.
            localStorage.setItem(SIGN_IN_DISMISSED_KEY, "1");
            window.dispatchEvent(
                new Event("grandPrix.signInPromptsRestored")
            );
            this._hide();
        });

        const notNowBtn = this._makeButton("Not now", "#3c3c3c");
        notNowBtn.addEventListener("click", () => this._hide());

        const neverBtn = this._makeButton("Don't ask again", "#3c3c3c");
        neverBtn.addEventListener("click", () => {
            localStorage.setItem(SIGN_IN_DISMISSED_KEY, "1");
            // Banner subscribes to this event to re-render itself away.
            window.dispatchEvent(
                new Event("grandPrix.signInPromptsRestored")
            );
            this._hide();
        });

        buttonRow.appendChild(signInBtn);
        buttonRow.appendChild(notNowBtn);
        buttonRow.appendChild(neverBtn);

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(buttonRow);
        this._domNode.appendChild(card);
        document.body.appendChild(this._domNode);
    }

    _hide() {
        if (!this._domNode) return;
        this._domNode.remove();
        this._domNode = null;
    }

    _makeButton(label, bg) {
        const btn = document.createElement("button");
        btn.textContent = label;
        Object.assign(btn.style, {
            padding: "10px 20px",
            fontSize: "13px",
            border: "none",
            borderRadius: "4px",
            background: bg,
            color: "#ffffff",
            cursor: "pointer",
            fontFamily: "inherit",
        });
        return btn;
    }
}
