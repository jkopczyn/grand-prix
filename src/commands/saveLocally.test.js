import { describe, it, expect, beforeEach, vi } from "vitest";
import { registerContribution } from "../registry";
import { createMockEditor } from "../__mocks__/monaco-editor.js";
import { registerSaveLocallyAction } from "./saveLocally";

const DRIVE_ID = "grandPrix.drive";

function setup(fileName = "test.py") {
    registerContribution(DRIVE_ID, { fileName });
    const editor = createMockEditor();
    editor.getValue.mockReturnValue("print('hello')");
    registerSaveLocallyAction(editor);
    const descriptor = editor.addAction.mock.calls[0][0];
    return { editor, descriptor };
}

describe("registerSaveLocallyAction", () => {
    beforeEach(() => {
        vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake-url");
        vi.spyOn(URL, "revokeObjectURL");
    });

    it("registers with the correct id", () => {
        const { descriptor } = setup();
        expect(descriptor.id).toBe("grandPrix.action.saveLocally");
    });

    it("registers with the correct label", () => {
        const { descriptor } = setup();
        expect(descriptor.label).toBe("Save Locally");
    });

    it("creates an object URL with a Blob", () => {
        const { descriptor, editor } = setup();
        descriptor.run(editor);
        expect(URL.createObjectURL).toHaveBeenCalledOnce();
        const arg = URL.createObjectURL.mock.calls[0][0];
        expect(arg).toBeInstanceOf(Blob);
    });

    it("revokes the object URL after clicking", () => {
        const { descriptor, editor } = setup();
        descriptor.run(editor);
        expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:fake-url");
    });

    it("sets the download attribute to the drive filename", () => {
        const { descriptor, editor } = setup("test.py");
        const createdElements = [];
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tag) => {
            const el = origCreate(tag);
            if (tag === "a") createdElements.push(el);
            return el;
        });
        descriptor.run(editor);
        expect(createdElements[0].download).toBe("test.py");
    });

    it("falls back to untitled.txt when fileName is null", () => {
        const editor = createMockEditor();
        editor.getValue.mockReturnValue("content");
        registerContribution(DRIVE_ID, { fileName: null });
        registerSaveLocallyAction(editor);
        const descriptor = editor.addAction.mock.calls[0][0];

        const createdElements = [];
        const origCreate = document.createElement.bind(document);
        vi.spyOn(document, "createElement").mockImplementation((tag) => {
            const el = origCreate(tag);
            if (tag === "a") createdElements.push(el);
            return el;
        });
        descriptor.run(editor);
        expect(createdElements[0].download).toBe("untitled.txt");
    });
});
