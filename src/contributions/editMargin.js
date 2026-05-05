import { getContribution } from "../registry";

const CONTRIBUTION_ID = "grandPrix.editMargin";

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
        this._originalContent = null;

        editor.onDidChangeModel(() => {
            this._changedLines.clear();
            this._savedLines.clear();
            this._originalContent = editor.getModel()?.getValue() ?? null;
            this._updateDecorations();
        });

        editor.onDidChangeModelContent((e) => {
            const model = editor.getModel();
            for (const change of e.changes) {
                const startLine = change.range.startLineNumber;
                const oldEndLine = change.range.endLineNumber;
                for (let l = startLine; l <= oldEndLine; l++) {
                    this._changedLines.delete(l);
                    this._savedLines.delete(l);
                }
                const newLineCount = change.text.split("\n").length;
                for (let l = startLine; l < startLine + newLineCount; l++) {
                    this._changedLines.add(l);
                    this._savedLines.delete(l);
                }
            }
            const totalLines = model.getLineCount();
            for (const l of this._changedLines) {
                if (l > totalLines) this._changedLines.delete(l);
            }
            for (const l of this._savedLines) {
                if (l > totalLines) this._savedLines.delete(l);
            }
            if (this._originalContent !== null && model.getValue() === this._originalContent) {
                this._changedLines.clear();
                this._savedLines.clear();
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
        this._originalContent = this._editor.getModel()?.getValue() ?? null;
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
