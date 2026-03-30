import { ConfigController } from "../contributions/config";

const THEMES = [
    { label: "Light (vs)", value: "vs" },
    { label: "Dark (vs-dark)", value: "vs-dark" },
    { label: "High Contrast Dark", value: "hc-black" },
    { label: "High Contrast Light", value: "hc-light" },
];

export function registerChangeThemeAction(editor) {
    editor.addAction({
        id: "driveMonaco.action.changeTheme",
        label: "Change Theme",
        run(editor) {
            const config = ConfigController.get(editor);
            const current = config.get("theme");

            const choice = prompt(
                THEMES.map(
                    (t, i) =>
                        `${i + 1}. ${t.label}${t.value === current ? " (current)" : ""}`
                ).join("\n") + "\n\nEnter number:"
            );

            const index = parseInt(choice, 10) - 1;
            if (index >= 0 && index < THEMES.length) {
                config.set("theme", THEMES[index].value);
            }
        },
    });
}
