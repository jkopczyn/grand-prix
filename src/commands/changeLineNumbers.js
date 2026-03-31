import { ConfigController } from "../contributions/config";

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
        run(editor) {
            const config = ConfigController.get();
            const current = config.get("lineNumbers");

            const choice = prompt(
                OPTIONS.map(
                    (o, i) =>
                        `${i + 1}. ${o.label}${o.value === current ? " (current)" : ""}`
                ).join("\n") + "\n\nEnter number:"
            );

            const index = parseInt(choice, 10) - 1;
            if (index >= 0 && index < OPTIONS.length) {
                config.set("lineNumbers", OPTIONS[index].value);
            }
        },
    });
}
