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
                .sort((a, b) => a.id.localeCompare(b.id))
                .map((l) => ({
                    label: l.aliases?.[0] || l.id,
                    value: l.id,
                    description: l.id,
                    current: l.id === current,
                }));

            const ptIdx = items.findIndex((i) => i.value === "plaintext");
            if (ptIdx > 0) items.unshift(items.splice(ptIdx, 1)[0]);

            const value = await showPicker(items, {
                placeholder: "Select language mode",
            });
            if (value == null) return;
            monaco.editor.setModelLanguage(editor.getModel(), value);
        },
    });
}
