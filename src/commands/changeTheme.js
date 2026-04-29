import { ConfigController } from "../contributions/config";
import { showPicker } from "../picker";

const THEMES = [
    { label: "Light (vs)", value: "vs" },
    { label: "Dark (vs-dark)", value: "vs-dark" },
    { label: "High Contrast Dark", value: "hc-black" },
    { label: "High Contrast Light", value: "hc-light" },
];

export function registerChangeThemeAction(editor) {
    editor.addAction({
        id: "grandPrix.action.changeTheme",
        label: "Change Theme",
        async run() {
            const config = ConfigController.get();
            const current = config.get("theme");

            const items = THEMES.map((t) => ({
                ...t,
                current: t.value === current,
            }));

            const value = await showPicker(items, {
                placeholder: "Select theme",
            });
            if (value == null) return;
            config.set("theme", value);
        },
    });
}
