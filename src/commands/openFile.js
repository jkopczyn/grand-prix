import * as monaco from "../monaco";
import { GapiAuthController } from "../contributions/auth";
import { DriveController } from "../contributions/drive";
import { API_KEY, CLIENT_ID } from "../gapi_consts";

const APP_ID = CLIENT_ID.split("-")[0];

export function registerOpenFileAction(editor) {
    editor.addAction({
        id: "grandPrix.action.openFile",
        label: "Open File",
        keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyO],
        async run(editor) {
            const auth = GapiAuthController.get();
            if (!auth.isLoggedIn) {
                await auth.requestToken();
            }

            const token = auth.getAccessToken();

            const view = new google.picker.DocsView()
                .setIncludeFolders(true)
                .setSelectFolderEnabled(false);

            const picker = new google.picker.PickerBuilder()
                .addView(view)
                .setOAuthToken(token)
                .setDeveloperKey(API_KEY)
                .setAppId(APP_ID)
                .setOrigin(window.location.protocol + "//" + window.location.host)
                .setCallback(async (data) => {
                    if (data.action === google.picker.Action.PICKED) {
                        const fileId = data.docs[0].id;
                        const drive = DriveController.get();
                        try {
                            await drive.openFile(fileId);
                        } catch (err) {
                            console.error("Open file failed:", err);
                        }
                    }
                })
                .build();

            picker.setVisible(true);
        },
    });
}
