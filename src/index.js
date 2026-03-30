import "./userWorker";
import * as monaco from "./monaco";
import { GapiAuthController } from "./contributions/auth";
import { DriveController } from "./contributions/drive";
import { ConfigController } from "./contributions/config";
import { WelcomeModal } from "./contributions/welcome";

monaco.editor.registerEditorContribution(
    GapiAuthController.ID,
    GapiAuthController
);
monaco.editor.registerEditorContribution(DriveController.ID, DriveController);
monaco.editor.registerEditorContribution(ConfigController.ID, ConfigController);
monaco.editor.registerEditorContribution(WelcomeModal.ID, WelcomeModal);

const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Welcome to Drive Monaco\n",
    language: "javascript",
    automaticLayout: true,
    minimap: { enabled: false },
});
