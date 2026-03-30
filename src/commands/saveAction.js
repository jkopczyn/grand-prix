import * as monaco from "../monaco";
import { DriveController } from "../contributions/drive";
import { EditMarginController } from "../contributions/editMargin";

export function registerSaveAction(editor) {
    editor.addAction({
        id: "driveMonaco.action.save",
        label: "Save File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS],
        async run(editor) {
            const drive = DriveController.get(editor);
            if (!drive.fileId) return;

            try {
                await drive.saveFile();
                const editMargin = EditMarginController.get(editor);
                editMargin.markSaved();
            } catch (err) {
                console.error("Save failed:", err);
            }
        },
    });
}
