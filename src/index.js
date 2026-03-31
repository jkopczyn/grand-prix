import "./userWorker";
import * as monaco from "./monaco";
import { registerContribution } from "./registry";
import { GapiAuthController } from "./contributions/auth";
import { DriveController } from "./contributions/drive";
import { ConfigController } from "./contributions/config";
import { WelcomeModal } from "./contributions/welcome";
import { EditMarginController } from "./contributions/editMargin";
import { registerSaveAction } from "./commands/saveAction";
import { registerCreateFileAction } from "./commands/createFile";
import { registerChangeThemeAction } from "./commands/changeTheme";
import { registerChangeLanguageAction } from "./commands/changeLanguage";
import { registerToggleWordWrapAction } from "./commands/toggleWordWrap";
import { registerToggleWhitespaceAction } from "./commands/toggleWhitespace";
import { registerChangeLineNumbersAction } from "./commands/changeLineNumbers";
import { createMenubar } from "./menubar";
import { getLanguageForFilename } from "./utils";

const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Welcome to Grand Prix\n// Press F1 to open the command palette\n",
    language: "javascript",
    automaticLayout: true,
    minimap: { enabled: false },
    renderLineHighlight: "all",
});

// Instantiate contributions (order matters — auth first)
registerContribution(GapiAuthController.ID, new GapiAuthController(editor));
registerContribution(DriveController.ID, new DriveController(editor));
registerContribution(ConfigController.ID, new ConfigController(editor));
registerContribution(WelcomeModal.ID, new WelcomeModal(editor));
registerContribution(
    EditMarginController.ID,
    new EditMarginController(editor)
);

registerSaveAction(editor);
registerCreateFileAction(editor);
registerChangeThemeAction(editor);
registerChangeLanguageAction(editor);
registerToggleWordWrapAction(editor);
registerToggleWhitespaceAction(editor);
registerChangeLineNumbersAction(editor);

createMenubar(editor);

const devfile = new URLSearchParams(window.location.search).get("devfile");
if (devfile) {
    document.title = `${devfile} — Grand Prix`;
    const lang = getLanguageForFilename(devfile);
    monaco.editor.setModelLanguage(editor.getModel(), lang);
}
