import { GapiAuthController } from "./auth";

const CONTRIBUTION_ID = "driveMonaco.welcome";
const WIDGET_ID = "driveMonaco.welcome.widget";

export class WelcomeModal {
    static ID = CONTRIBUTION_ID;

    static get(editor) {
        return editor.getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._domNode = null;
        this._widget = null;
        this._visible = false;

        const auth = GapiAuthController.get(editor);

        if (!auth.isLoggedIn) {
            this._show();
        }

        auth.onLoggedInChanged((loggedIn) => {
            if (loggedIn) {
                this._hide();
            } else {
                this._show();
            }
        });
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    dispose() {
        this._hide();
    }

    // --- Private ---

    _show() {
        if (this._visible) return;
        this._visible = true;

        this._domNode = document.createElement("div");
        Object.assign(this._domNode.style, {
            position: "absolute",
            top: "0",
            left: "0",
            width: "100%",
            height: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "rgba(0, 0, 0, 0.5)",
            zIndex: "100",
        });

        const card = document.createElement("div");
        Object.assign(card.style, {
            background: "#1e1e1e",
            color: "#cccccc",
            padding: "32px 40px",
            borderRadius: "8px",
            textAlign: "center",
            fontFamily: "sans-serif",
            maxWidth: "400px",
        });

        const title = document.createElement("h2");
        title.textContent = "Drive Monaco";
        title.style.margin = "0 0 12px";
        title.style.color = "#ffffff";

        const desc = document.createElement("p");
        desc.textContent =
            "Sign in with Google to open and edit files from your Drive.";
        desc.style.margin = "0 0 24px";

        const button = document.createElement("button");
        button.textContent = "Sign in with Google";
        Object.assign(button.style, {
            padding: "10px 24px",
            fontSize: "14px",
            border: "none",
            borderRadius: "4px",
            background: "#4285f4",
            color: "#ffffff",
            cursor: "pointer",
        });

        button.addEventListener("click", () => {
            const auth = GapiAuthController.get(this._editor);
            auth.requestToken().catch(console.error);
        });

        card.appendChild(title);
        card.appendChild(desc);
        card.appendChild(button);
        this._domNode.appendChild(card);

        this._widget = {
            getId: () => WIDGET_ID,
            getDomNode: () => this._domNode,
            getPosition: () => null,
        };

        this._editor.addOverlayWidget(this._widget);
    }

    _hide() {
        if (!this._visible) return;
        this._visible = false;
        this._editor.removeOverlayWidget(this._widget);
        this._widget = null;
        this._domNode = null;
    }
}
