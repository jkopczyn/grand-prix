import { ConfigController } from "../contributions/config";

export function registerToggleWhitespaceAction(editor) {
    editor.addAction({
        id: "driveMonaco.action.toggleWhitespace",
        label: "Toggle Render Whitespace",
        run(editor) {
            const config = ConfigController.get();
            const current = config.get("renderWhitespace");
            config.set(
                "renderWhitespace",
                current === "none" ? "all" : "none"
            );
        },
    });
}
