# Implementation Plan: Monaco Google Drive Editor

## Context

Building a Monaco-based text editor that integrates with Google Drive, hosted on GitHub Pages. Based on the reference spec in `/home/jkop/.claude/plans/hidden-weaving-oasis.md`. The project directory is currently empty — this is a greenfield build.

---

## Implementation Steps

### Step 1: Project Scaffolding

Create the foundational project files:

- `package.json` — dependencies: `monaco-editor ^0.37.1`, `vite ^4`; dev dep: `prettier`
- `vite.config.js` — two entry points (`index.html`, `app/index.html`), dev server on port 3000
- `.prettierrc.yml` — 4-space indent, ES5 trailing commas, double quotes
- `index.html` — landing page
- `app/index.html` — editor page, loads GSI + GAPI scripts

**Verify:** `npm install && npm run dev` starts cleanly.

### Step 2: Monaco Setup

- `src/monaco.js` — selective Monaco imports (editor.api, editor.all, language contributions)
- `src/userWorker.js` — `MonacoEnvironment.getWorker` routing for JSON/CSS/HTML/TS workers
- `src/index.js` — create editor instance in the app page DOM

**Verify:** Editor renders and syntax highlighting works in dev mode.

### Step 3: Utility Modules

- `src/gapi_consts.js` — placeholder CLIENT_ID, DISCOVERY_DOC URL, SCOPES
- `src/utils.js` — `getUrlState()` (parse Drive `?state=` param), `getLanguageForFilename()` (match extensions from `monaco.languages.getLanguages()`)

### Step 4: Auth Contribution

- `src/contributions/auth.js` — `GapiAuthController`
    - Manages `gapi.load("client")` → `gapi.client.init()` → token client init
    - Token persistence in localStorage with expiry
    - `onLoggedInChanged` event emitter
    - Auto-retry on 401/403
    - Dev mode bypass via `import.meta.env.DEV`

**Verify:** Can authenticate with Google and see token in localStorage.

### Step 5: Drive Contribution

- `src/contributions/drive.js` — `DriveController`
    - `openFile(id)` — read via `gapi.client.drive.files.get({alt:"media"})`
    - `saveFile(id, content)` — PATCH upload
    - `createFile(name, folderId)` — `gapi.client.drive.files.create()`
    - URL state handling (auto-open/create on load)
    - Unsaved changes tracking + `beforeunload` guard

**Verify:** Can open and save a file from Google Drive.

### Step 6: Config Contribution

- `src/contributions/config.js` — `ConfigController`
    - Keys: `theme`, `wordWrap`, `renderWhitespace`
    - Dual-write: localStorage (fast) + Drive appDataFolder (`config.json`)
    - On login: fetch Drive config, overwrite local

### Step 7: Welcome Modal

- `src/contributions/welcome.js` — `WelcomeModal`
    - Overlay widget via `editor.addOverlayWidget()`
    - Shown when not authenticated
    - Sign-in button triggers auth flow

### Step 8: Edit Margin

- `src/contributions/editMargin.js` — `EditMarginController`
    - Track changes via `editor.onDidChangeModelContent()`
    - Line decorations for added/modified lines
    - On save: convert to "saved" style decorations

### Step 9: Commands

Create in `src/commands/`:

- `saveAction.js` — Ctrl+S, calls DriveController
- `createFile.js` — prompt filename, create in Drive
- `changeTheme.js` — quick pick from Monaco themes
- `changeLanguage.js` — quick pick from `monaco.languages.getLanguages()`
- `toggleWordWrap.js` — Alt+H
- `toggleWhitespace.js`

### Step 10: Landing Page

- `index.html` — simple landing with app description and "Open Editor" link

---

## Commit Strategy

Commit after each step (per user's CLAUDE.md instructions).

## Verification

1. `npm run dev` — editor loads at `localhost:3000/app/`
2. Monaco renders with syntax highlighting
3. Auth flow works (requires real GCP client ID to fully test)
4. File open/save round-trips through Drive API
5. Config persists across reloads
6. `npm run build` produces deployable static site
