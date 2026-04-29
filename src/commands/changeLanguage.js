import * as monaco from "../monaco";
import { showPicker } from "../picker";

export function registerChangeLanguageAction(editor) {
    editor.addAction({
        id: "grandPrix.action.changeLanguage",
        label: "Change Language Mode",
        async run(editor) {
            const current = editor.getModel()?.getLanguageId();
            const items = monaco.languages
                .getLanguages()
                .map((l) => ({
                    label: l.id,
                    value: l.id,
                    description: l.aliases?.[0],
                    current: l.id === current,
                }))
                .sort((a, b) => a.label.localeCompare(b.label));

            const value = await showPicker(items, {
                placeholder: "Select language mode",
            });
            if (value == null) return;
            monaco.editor.setModelLanguage(editor.getModel(), value);
        },
    });
}
