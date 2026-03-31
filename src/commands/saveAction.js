import * as monaco from "../monaco";
import { DriveController } from "../contributions/drive";
import { EditMarginController } from "../contributions/editMargin";

export function registerSaveAction(editor) {
    editor.addAction({
        id: "grandPrix.action.save",
        label: "Save File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        async run(editor) {
            const drive = DriveController.get();
            if (!drive.fileId) return;

            try {
                await drive.saveFile();
                const editMargin = EditMarginController.get();
                editMargin.markSaved();
            } catch (err) {
                console.error("Save failed:", err);
            }
        },
    });
}
