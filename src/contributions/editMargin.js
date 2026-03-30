import { getContribution } from "../registry";

const CONTRIBUTION_ID = "driveMonaco.editMargin";

export class EditMarginController {
    static ID = CONTRIBUTION_ID;

    static get() {
        return getContribution(CONTRIBUTION_ID);
    }

    constructor(editor) {
        this._editor = editor;
        this._changedLines = new Set();
        this._savedLines = new Set();
        this._decorations = [];

        this._editor.onDidChangeModelContent((e) => {
            for (const change of e.changes) {
                const startLine = change.range.startLineNumber;
                const newLines = change.text.split("\n").length;
                const endLine = startLine + newLines - 1;
                for (let line = startLine; line <= endLine; line++) {
                    this._changedLines.add(line);
                    this._savedLines.delete(line);
                }
            }
            this._updateDecorations();
        });
    }

    getId() {
        return CONTRIBUTION_ID;
    }

    markSaved() {
        for (const line of this._changedLines) {
            this._savedLines.add(line);
        }
        this._changedLines.clear();
        this._updateDecorations();
    }

    dispose() {}

    // --- Private ---

    _updateDecorations() {
        const newDecorations = [];

        for (const line of this._changedLines) {
            newDecorations.push({
                range: {
                    startLineNumber: line,
                    startColumn: 1,
                    endLineNumber: line,
                    endColumn: 1,
                },
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: "edit-margin-changed",
                },
            });
        }

        for (const line of this._savedLines) {
            newDecorations.push({
                range: {
                    startLineNumber: line,
                    startColumn: 1,
                    endLineNumber: line,
                    endColumn: 1,
                },
                options: {
                    isWholeLine: true,
                    linesDecorationsClassName: "edit-margin-saved",
                },
            });
        }

        this._decorations = this._editor.deltaDecorations(
            this._decorations,
            newDecorations
        );
    }
}
