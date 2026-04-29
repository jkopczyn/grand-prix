import { GapiAuthController } from "../contributions/auth";

export function registerSignInAction(editor) {
    editor.addAction({
        id: "grandPrix.action.signIn",
        label: "Sign in to Google",
        async run() {
            const auth = GapiAuthController.get();
            if (auth.isLoggedIn) {
                alert("Already signed in to Google.");
                return;
            }
            try {
                await auth.requestToken();
            } catch (err) {
                console.error("Sign in failed:", err);
            }
        },
    });
}
