import * as monaco from "../monaco";

export function registerChangeLanguageAction(editor) {
    editor.addAction({
        id: "driveMonaco.action.changeLanguage",
        label: "Change Language Mode",
        run(editor) {
            const languages = monaco.languages
                .getLanguages()
                .map((l) => l.id)
                .sort();

            const current = editor.getModel().getLanguageId();
            const choice = prompt(
                `Current: ${current}\n\nAvailable languages:\n${languages.join(", ")}\n\nEnter language:`
            );

            if (choice && languages.includes(choice)) {
                monaco.editor.setModelLanguage(editor.getModel(), choice);
            }
        },
    });
}
