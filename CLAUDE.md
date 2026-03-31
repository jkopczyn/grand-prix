# Grand Prix

Monaco-based text editor for Google Drive files. Vanilla JS, Vite 4, hosted on GitHub Pages.

## Architecture

**Contributions** (`src/contributions/`) are singleton controllers instantiated after the editor and registered in a `Map`-based registry (`src/registry.js`). Access via `MyController.get()` (no arguments — looks up from registry, not `editor.getContribution()` which is internal Monaco API).

**Commands** (`src/commands/`) register actions via `editor.addAction()` and trigger contributions. They also appear in the menu bar (`src/menubar.js`) and command palette (F1).

**Config** is dual-write: localStorage for instant startup, Drive appDataFolder for cross-device sync. Established keys include: `theme`, `wordWrap`, `renderWhitespace`, `lineNumbers`. Expand as appropriate.

## Google API Notes

**Auth** requires two separate libraries loaded from HTML: GSI (`accounts.google.com/gsi/client`) for `initTokenClient()` and GAPI (`apis.google.com/js/api.js`) for `gapi.client`. Both fire `window.handleClientLoad?.()` on load; the app waits for both before initializing. OAuth scopes: `drive.file`, `drive.appdata`, `drive.install`.

**Drive reads** use `gapi.client.drive.files.get({ fileId, alt: "media" })`. **Writes** cannot use the discovery client. Use raw `fetch` to `https://www.googleapis.com/upload/drive/v3/files/{id}?uploadType=media` with PUT or PATCH.

**Drive "Open With"** passes a JSON `?state=` param: `{ action: "open"|"create", ids: [...], userId, folderId }`. Parsed on load to auto-open or auto-create.

**AppData folder** (`parents: ["appDataFolder"]`) is private per-app storage used for `config.json`.

*Preserve tokens* in `localStorage` with expiry and restore on page load to skip the OAuth popup.
Any 401/403 for any API call should prompt a re-request

**Discovery doc URL:**
```
https://www.googleapis.com/discovery/v1/apis/drive/v3/rest
```
## Key Constraints

- `monaco.editor.registerEditorContribution()` is NOT a public API. Do not use it.
- For Monaco imports, prefer the main `monaco-editor` entry point (`export * from "monaco-editor"`), not deep ESM paths like `monaco-editor/esm/vs/...`. Deep imports cause Vite to pre-bundle each path separately, which lead to high memory usage and potential OOM crashes from crawling 848 files if memory load is otherwise high.
- `src/index.js` must exist before `app/index.html` will load without MIME type errors (missing module = 404 with no Content-Type).
- `?devfile=filename` URL param sets title and language in dev mode.
- Auth is bypassed entirely in dev mode (`import.meta.env.DEV`).

## Build & Dev

```
npm run dev      # Vite dev server on port 3000, opens /app/
npm run build    # Production build to dist/
npm run format   # Prettier (4-space, ES5 trailing commas, double quotes)
```

## Workers

Worker routing is in `src/userWorker.js` via `self.MonacoEnvironment.getWorker`. Routes `json`, `css/scss/less`, `html/handlebars/razor`, and `typescript/javascript` to dedicated workers; everything else falls back to `editorWorker`. Workers use the Vite `?worker` import suffix.
