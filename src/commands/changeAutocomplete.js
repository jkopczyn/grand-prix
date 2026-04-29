import { ConfigController } from "../contributions/config";
import { showPicker } from "../picker";

const OPTIONS = [
    {
        label: "Auto",
        value: "auto",
        description: "Smart default per filetype",
    },
    { label: "On", value: "on" },
    { label: "Off", value: "off" },
];

export function registerChangeAutocompleteAction(editor) {
    editor.addAction({
        id: "grandPrix.action.changeAutocomplete",
        label: "Configure Autocomplete",
        async run() {
            const config = ConfigController.get();
            const lang =
                editor.getModel()?.getLanguageId() ?? "(no language)";
            const current =
                config.getAutocompleteOverrideForCurrentLanguage() ?? "auto";

            const items = OPTIONS.map((o) => ({
                ...o,
                current: o.value === current,
            }));

            const value = await showPicker(items, {
                placeholder: `Autocomplete for "${lang}" files`,
            });
            if (value == null) return;

            if (value === "auto") {
                config.clearAutocompleteForCurrentLanguage();
            } else {
                config.setAutocompleteForCurrentLanguage(value);
            }
        },
    });
}
