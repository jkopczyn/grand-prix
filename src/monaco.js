// Selective Monaco imports for smaller bundle
import "monaco-editor/esm/vs/editor/editor.all";

// Language contributions
import "monaco-editor/esm/vs/basic-languages/monaco.contribution";
import "monaco-editor/esm/vs/language/json/monaco.contribution";
import "monaco-editor/esm/vs/language/css/monaco.contribution";
import "monaco-editor/esm/vs/language/html/monaco.contribution";
import "monaco-editor/esm/vs/language/typescript/monaco.contribution";

export * from "monaco-editor/esm/vs/editor/editor.api";
