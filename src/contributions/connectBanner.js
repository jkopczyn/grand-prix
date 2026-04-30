import { GapiAuthController } from "./auth";
import { getContribution } from "../registry";

const CONTRIBUTION_ID = "grandPrix.connectBanner";
const SIGN_IN_DISMISSED_KEY = "grandPrix.signInDismissed";

export class ConnectBanner {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._container = document.getElementById("connect-banner");

        this._render();

        const auth = GapiAuthController.get();
        auth.onLoggedInChanged(() => this._render());

        // Restore-prompts command dispatches this so we re-evaluate.
        window.addEventListener("grandPrix.signInPromptsRestored", () =>
            this._render()
        );
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    dispose() {}

    // --- Private ---

    _shouldShow() {
        const auth = GapiAuthController.get();
        if (auth.isLoggedIn) return false;
        if (auth.isDevFallback) return false;
        if (localStorage.getItem(SIGN_IN_DISMISSED_KEY) === "1") return false;
        return true;
    }

    _render() {
        if (!this._container) return;
        this._container.replaceChildren();

        if (!this._shouldShow()) {
            this._container.classList.remove("visible");
            return;
        }

        const message = document.createElement("span");
        message.className = "banner-message";
        message.textContent =
            "Sign in to Google to sync settings and open Drive files.";

        const signInBtn = document.createElement("button");
        signInBtn.textContent = "Sign in";
        signInBtn.addEventListener("click", () => {
            const auth = GapiAuthController.get();
            auth.requestToken().catch((err) => {
                console.error("[connectBanner] Sign in failed:", err);
            });
        });

        const dismissBtn = document.createElement("button");
        dismissBtn.className = "banner-dismiss";
        dismissBtn.textContent = "✕"; // ✕
        dismissBtn.title = "Dismiss";
        dismissBtn.addEventListener("click", () => {
            localStorage.setItem(SIGN_IN_DISMISSED_KEY, "1");
            this._render();
        });

        this._container.appendChild(message);
        this._container.appendChild(signInBtn);
        this._container.appendChild(dismissBtn);
        this._container.classList.add("visible");
    }
}
