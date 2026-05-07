import { vi } from "vitest";

export const languages = {
    getLanguages: () => [
        { id: "javascript", extensions: [".js", ".mjs", ".cjs"] },
        { id: "typescript", extensions: [".ts", ".tsx"] },
        { id: "python", extensions: [".py"] },
        { id: "json", extensions: [".json"] },
        { id: "html", extensions: [".html", ".htm"] },
        { id: "css", extensions: [".css"] },
        { id: "markdown", extensions: [".md", ".markdown"] },
    ],
};

export const KeyMod = { CtrlCmd: 2048, Shift: 1024, Alt: 512 };
export const KeyCode = { KeyS: 49, KeyO: 45, KeyL: 40 };

export const editor = {
    setTheme: vi.fn(),
    setModelLanguage: vi.fn(),
    createModel: vi.fn(),
};

function createMockModel(initialValue = "") {
    let value = initialValue;
    return {
        getValue: vi.fn(() => value),
        setValue: vi.fn((v) => { value = v; }),
        getLineCount: vi.fn(() => 100),
        getLanguageId: vi.fn(() => "plaintext"),
        onDidChangeContent: vi.fn(() => ({ dispose: vi.fn() })),
        dispose: vi.fn(),
        _setValue(v) { value = v; },
    };
}

export function createMockEditor(initialValue = "") {
    const model = createMockModel(initialValue);
    let onDidChangeModelCb = null;
    let onDidChangeModelContentCb = null;
    let lastDescriptor = null;

    const mockEditor = {
        _model: model,
        _onDidChangeModelCb: () => onDidChangeModelCb && onDidChangeModelCb(),
        _onDidChangeModelContentCb: (e) => onDidChangeModelContentCb && onDidChangeModelContentCb(e),

        onDidChangeModel: vi.fn((fn) => {
            onDidChangeModelCb = fn;
            return { dispose: vi.fn() };
        }),
        onDidChangeModelContent: vi.fn((fn) => {
            onDidChangeModelContentCb = fn;
            return { dispose: vi.fn() };
        }),
        getModel: vi.fn(() => model),
        getValue: vi.fn(() => model.getValue()),
        deltaDecorations: vi.fn((old, newOnes) => newOnes),
        addAction: vi.fn((descriptor) => { lastDescriptor = descriptor; }),
        updateOptions: vi.fn(),
        getAction: vi.fn(),
        getLastDescriptor: () => lastDescriptor,
    };

    return mockEditor;
}
