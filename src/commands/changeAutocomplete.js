import { ConfigController } from "../contributions/config";

const OPTIONS = [
    { label: "Auto (smart default per filetype)", value: "auto" },
    { label: "On", value: "on" },
    { label: "Off", value: "off" },
];

export function registerChangeAutocompleteAction(editor) {
    editor.addAction({
        id: "grandPrix.action.changeAutocomplete",
        label: "Configure Autocomplete",
        run() {
            const config = ConfigController.get();
            const lang =
                editor.getModel()?.getLanguageId() ?? "(no language)";
            const override =
                config.getAutocompleteOverrideForCurrentLanguage();
            const current = override ?? "auto";

            const choice = prompt(
                `Autocomplete for "${lang}" files:\n\n` +
                    OPTIONS.map(
                        (o, i) =>
                            `${i + 1}. ${o.label}${o.value === current ? " (current)" : ""}`
                    ).join("\n") +
                    "\n\nEnter number:"
            );

            const index = parseInt(choice, 10) - 1;
            if (index < 0 || index >= OPTIONS.length) return;
            const value = OPTIONS[index].value;
            if (value === "auto") {
                config.clearAutocompleteForCurrentLanguage();
            } else {
                config.setAutocompleteForCurrentLanguage(value);
            }
        },
    });
}
