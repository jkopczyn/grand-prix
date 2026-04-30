const SIGN_IN_DISMISSED_KEY = "grandPrix.signInDismissed";
const SESSION_SHOWN_KEY = "grandPrix.signInPromptShownThisSession";

export function registerShowSignInPromptsAction(editor) {
    editor.addAction({
        id: "grandPrix.action.showSignInPrompts",
        label: "Show Sign-In Prompts",
        run() {
            localStorage.removeItem(SIGN_IN_DISMISSED_KEY);
            // Also clear the per-session flag so the first-change modal
            // can fire again without a reload.
            sessionStorage.removeItem(SESSION_SHOWN_KEY);
            window.dispatchEvent(
                new Event("grandPrix.signInPromptsRestored")
            );
        },
    });
}
