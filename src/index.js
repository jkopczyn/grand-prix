import "./userWorker";
import * as monaco from "./monaco";
import { registerContribution } from "./registry";
import { GapiAuthController } from "./contributions/auth";
import { DriveController } from "./contributions/drive";
import { ConfigController } from "./contributions/config";
import { EditMarginController } from "./contributions/editMargin";
import { registerSaveAction } from "./commands/saveAction";
import { registerCreateFileAction } from "./commands/createFile";
import { registerOpenFileAction } from "./commands/openFile";
import { registerSignInAction } from "./commands/signIn";
import { registerChangeThemeAction } from "./commands/changeTheme";
import { registerChangeLanguageAction } from "./commands/changeLanguage";
import { registerToggleWordWrapAction } from "./commands/toggleWordWrap";
import { registerToggleWhitespaceAction } from "./commands/toggleWhitespace";
import { registerChangeAutocompleteAction } from "./commands/changeAutocomplete";
import { registerChangeLineNumbersAction } from "./commands/changeLineNumbers";
import { registerResetConfigAction } from "./commands/resetConfig";
import { createMenubar } from "./menubar";
import { getLanguageForFilename } from "./utils";

const editor = monaco.editor.create(document.getElementById("editor"), {
    value: "// Welcome to Grand Prix\n// Press F1 to open the command palette\n",
    language: "plaintext",
    automaticLayout: true,
    minimap: { enabled: false },
    renderLineHighlight: "all",
});

// Instantiate contributions (order matters — auth first)
registerContribution(GapiAuthController.ID, new GapiAuthController(editor));
registerContribution(DriveController.ID, new DriveController(editor));
registerContribution(ConfigController.ID, new ConfigController(editor));
registerContribution(
    EditMarginController.ID,
    new EditMarginController(editor)
);

registerSignInAction(editor);
registerSaveAction(editor);
registerOpenFileAction(editor);
registerCreateFileAction(editor);
registerChangeThemeAction(editor);
registerChangeLanguageAction(editor);
registerToggleWordWrapAction(editor);
registerToggleWhitespaceAction(editor);
registerChangeAutocompleteAction(editor);
registerChangeLineNumbersAction(editor);
registerResetConfigAction(editor);

createMenubar(editor);

const devfile = new URLSearchParams(window.location.search).get("devfile");
if (devfile) {
    document.title = `${devfile} — Grand Prix`;
    const lang = getLanguageForFilename(devfile);
    monaco.editor.setModelLanguage(editor.getModel(), lang);
}
