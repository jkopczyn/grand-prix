import "./userWorker";
import * as monaco from "./monaco";
import { GapiAuthController } from "./contributions/auth";
import { DriveController } from "./contributions/drive";
import { ConfigController } from "./contributions/config";
import { WelcomeModal } from "./contributions/welcome";
import { EditMarginController } from "./contributions/editMargin";

monaco.editor.registerEditorContribution(
    GapiAuthController.ID,
    GapiAuthController
);
monaco.editor.registerEditorContribution(DriveController.ID, DriveController);
monaco.editor.registerEditorContribution(ConfigController.ID, ConfigController);
monaco.editor.registerEditorContribution(WelcomeModal.ID, WelcomeModal);
monaco.editor.registerEditorContribution(
    EditMarginController.ID,
    EditMarginController
);

const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Welcome to Drive Monaco\n",
    language: "javascript",
    automaticLayout: true,
    minimap: { enabled: false },
});
