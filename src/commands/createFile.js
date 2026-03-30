import { DriveController } from "../contributions/drive";

export function registerCreateFileAction(editor) {
    editor.addAction({
        id: "driveMonaco.action.createFile",
        label: "Create New File",
        async run(editor) {
            const name = prompt("Enter file name:");
            if (!name) return;

            const drive = DriveController.get();
            try {
                await drive.createFile(name);
            } catch (err) {
                console.error("Create file failed:", err);
            }
        },
    });
}
