import { ConfigController } from "../contributions/config";
import { showPicker } from "../picker";

const OPTIONS = [
    { label: "On", value: "on" },
    { label: "Off", value: "off" },
    { label: "Relative", value: "relative" },
    { label: "Interval", value: "interval" },
];

export function registerChangeLineNumbersAction(editor) {
    editor.addAction({
        id: "grandPrix.action.changeLineNumbers",
        label: "Change Line Numbers",
        async run() {
            const config = ConfigController.get();
            const current = config.get("lineNumbers");

            const items = OPTIONS.map((o) => ({
                ...o,
                current: o.value === current,
            }));

            const value = await showPicker(items, {
                placeholder: "Line numbers",
            });
            if (value == null) return;
            config.set("lineNumbers", value);
        },
    });
}
