import "./userWorker";
import * as monaco from "./monaco";
import { GapiAuthController } from "./contributions/auth";

monaco.editor.registerEditorContribution(
    GapiAuthController.ID,
    GapiAuthController
);

const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Welcome to Drive Monaco\n",
    language: "javascript",
    automaticLayout: true,
    minimap: { enabled: false },
});
