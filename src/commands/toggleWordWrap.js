import * as monaco from "../monaco";
import { ConfigController } from "../contributions/config";

export function registerToggleWordWrapAction(editor) {
    editor.addAction({
        id: "grandPrix.action.toggleWordWrap",
        label: "Toggle Word Wrap",
        keybindings: [monaco.KeyMod.Alt | monaco.KeyCode.KeyH],
        run(editor) {
            const config = ConfigController.get();
            const current = config.get("wordWrap");
            config.set("wordWrap", current === "on" ? "off" : "on");
        },
    });
}
