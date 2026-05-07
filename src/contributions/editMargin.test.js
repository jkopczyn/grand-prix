import { describe, it, expect, beforeEach } from "vitest";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { EditMarginController } from "./editMargin";

function makeChange(startLine, endLine, text) {
    return { changes: [{ range: { startLineNumber: startLine, endLineNumber: endLine }, text }] };
}

function lastDecorationsCall(mockEditor) {
    const calls = mockEditor.deltaDecorations.mock.calls;
    return calls[calls.length - 1][1];
}

function getClasses(mockEditor) {
    return lastDecorationsCall(mockEditor).map((d) => d.options.linesDecorationsClassName);
}

describe("EditMarginController", () => {
    let editor;
    let ctrl;

    beforeEach(() => {
        // Use a value that changes will differ from
        editor = createMockEditor("original content");
        ctrl = new EditMarginController(editor);
        // Initialize: fire model change to capture original content
        editor._onDidChangeModelCb();
    });

    function triggerChange(startLine, endLine, text) {
        // Make the model's getValue() return something different from original
        // so the "undo to original" short-circuit doesn't fire
        editor._model._setValue("modified " + Math.random());
        editor._onDidChangeModelContentCb(makeChange(startLine, endLine, text));
    }

    it("getId returns the contribution ID", () => {
        expect(ctrl.getId()).toBe("grandPrix.editMargin");
    });

    it("after model change, decorations are empty", () => {
        // The beforeEach already fired onDidChangeModelCb
        expect(lastDecorationsCall(editor)).toEqual([]);
    });

    it("content change on a single line marks that line as changed", () => {
        triggerChange(3, 3, "hello");
        expect(getClasses(editor)).toContain("edit-margin-changed");
        const changedDec = lastDecorationsCall(editor).find(
            (d) => d.options.linesDecorationsClassName === "edit-margin-changed"
        );
        expect(changedDec.range.startLineNumber).toBe(3);
    });

    it("multi-line replacement removes old range and adds new lines", () => {
        // replace lines 2–4 with 4 lines of text (3 newlines → 4 new lines: 2, 3, 4, 5)
        triggerChange(2, 4, "a\nb\nc\nd");
        const changedLines = lastDecorationsCall(editor)
            .filter((d) => d.options.linesDecorationsClassName === "edit-margin-changed")
            .map((d) => d.range.startLineNumber);
        expect(changedLines).toContain(2);
        expect(changedLines).toContain(5);
        expect(changedLines.length).toBe(4);
    });

    it("prunes entries beyond model line count", () => {
        editor._model.getLineCount.mockReturnValue(5);
        // change touches lines 4–6 but model only has 5 lines
        triggerChange(4, 6, "x\ny\nz");
        const changedLines = lastDecorationsCall(editor)
            .filter((d) => d.options.linesDecorationsClassName === "edit-margin-changed")
            .map((d) => d.range.startLineNumber);
        expect(changedLines.every((l) => l <= 5)).toBe(true);
    });

    it("clears both sets when content returns to original (undo to start)", () => {
        // Make a change
        triggerChange(1, 1, "something new");

        // Now restore to the original content - getValue() should match _originalContent
        editor._model._setValue("original content");
        editor._onDidChangeModelContentCb(makeChange(1, 1, "original content"));

        expect(lastDecorationsCall(editor)).toEqual([]);
    });

    it("markSaved moves changedLines to savedLines", () => {
        triggerChange(1, 1, "foo");
        ctrl.markSaved();
        expect(getClasses(editor)).toContain("edit-margin-saved");
        expect(getClasses(editor)).not.toContain("edit-margin-changed");
    });

    it("markSaved updates originalContent", () => {
        triggerChange(2, 2, "bar");
        const newValue = editor._model.getValue();
        ctrl.markSaved();
        // After save, the new content is the new baseline — trigger another change
        triggerChange(3, 3, "baz");
        const changedLines = lastDecorationsCall(editor)
            .filter((d) => d.options.linesDecorationsClassName === "edit-margin-changed")
            .map((d) => d.range.startLineNumber);
        expect(changedLines).toContain(3);
        expect(changedLines).not.toContain(2);
    });

    it("both decoration classes appear after partial save", () => {
        triggerChange(1, 1, "first edit");
        ctrl.markSaved();
        triggerChange(2, 2, "second edit");
        const classes = getClasses(editor);
        expect(classes).toContain("edit-margin-saved");
        expect(classes).toContain("edit-margin-changed");
    });
});
