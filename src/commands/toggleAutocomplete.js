import { ConfigController } from "../contributions/config";

export function registerToggleAutocompleteAction(editor) {
    editor.addAction({
        id: "grandPrix.action.toggleAutocomplete",
        label: "Toggle Autocomplete",
        run() {
            const config = ConfigController.get();
            const effective = config.getEffectiveAutocomplete();
            config.setAutocompleteForCurrentLanguage(effective ? "off" : "on");
        },
    });
}
