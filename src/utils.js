import * as monaco from "./monaco";

/**
 * Parse the Google Drive `?state=` URL parameter.
 * Returns { action, ids, userId, folderId } or null.
 */
export function getUrlState() {
    const params = new URLSearchParams(window.location.search);
    const raw = params.get("state");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

/**
 * Detect Monaco language ID from a filename.
 * Special-cases dotfiles like .bashrc → "shell".
 */
export function getLanguageForFilename(filename) {
    const dotfiles = {
        ".bashrc": "shell",
        ".bash_profile": "shell",
        ".zshrc": "shell",
        ".profile": "shell",
    };

    const base = filename.split("/").pop();
    if (dotfiles[base]) return dotfiles[base];

    const ext = "." + base.split(".").pop();
    const languages = monaco.languages.getLanguages();
    for (const lang of languages) {
        if (lang.extensions && lang.extensions.includes(ext)) {
            return lang.id;
        }
    }
    return "plaintext";
}
