import * as monaco from "../monaco";
import { DriveController } from "../contributions/drive";

export function registerSaveLocallyAction(editor) {
    editor.addAction({
        id: "grandPrix.action.saveLocally",
        label: "Save Locally",
        keybindings: [
            monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS,
        ],
        run(editor) {
            const content = editor.getValue();
            const drive = DriveController.get();
            const fileName = drive.fileName || "untitled.txt";

            const blob = new Blob([content], { type: "text/plain" });
            const url = URL.createObjectURL(blob);

            const a = document.createElement("a");
            a.href = url;
            a.download = fileName;
            a.click();

            URL.revokeObjectURL(url);
        },
    });
}
