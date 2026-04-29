import { ConfigController } from "../contributions/config";

export function registerResetConfigAction(editor) {
    editor.addAction({
        id: "grandPrix.action.resetConfig",
        label: "Reset Configuration",
        async run() {
            if (
                !confirm(
                    "Reset all settings (theme, autocomplete, etc.) to defaults? This clears local and Drive-synced config."
                )
            )
                return;
            await ConfigController.get().reset();
            alert("Configuration reset. Reloading.");
            window.location.reload();
        },
    });
}
