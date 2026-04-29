# Autocomplete persistence: design notes

The autocomplete toggle (View → Toggle Autocomplete) persists user choices **per Monaco language ID** — settings are stored as a map `{ [languageId]: "on" | "off" }` in the existing config (localStorage + Drive `appDataFolder`). Absence of an entry means "use the smart default" (off for `plaintext`, on otherwise).

This document records the alternatives that were considered and why per-language won.

## Considered alternatives

### Per-file ID

Persist the autocomplete choice keyed by Drive file ID.

- **Pros**: Maximum precision — toggle once for that specific file, stays that way forever.
- **Cons**:
  - Storage grows unboundedly with files used.
  - Doesn't capture the actual user intent. The original requirement was "off by default for `.txt` and extensionless files" — that's inherently a *type* concern, not a per-file one.
  - Setting is lost on rename/copy.
  - Drive appData JSON becomes a key-per-file map, awkward to inspect.

### Global with explicit "auto"

A single string config value: `"auto" | "on" | "off"`, default `"auto"`. `"auto"` means "off for plaintext, on otherwise". Toggle cycles through the three states.

- **Pros**: Smallest code change.
- **Cons**:
  - `"auto"` is only a one-time bootstrap; once the user toggles to `"on"` or `"off"`, they're stuck applying that to *every* file regardless of type.
  - Quickly hits the natural use case "I want autocomplete on for code but off for markdown" with nowhere to put that distinction.

### Per-language (chosen)

Map of language ID → user override. Smart default fills in for unset entries.

- **Pros**:
  - Matches the requirement directly (`.txt` and extensionless files both map to `plaintext` via `getLanguageForFilename` in `src/utils.js`, so they're naturally grouped).
  - Bounded size (Monaco has ~80 languages; only entries the user has actually toggled get stored).
  - Mental model is "I want autocomplete off for markdown" → set once, applies to every `.md` file forever.
  - Can be reset to "auto" by removing an entry (no UI for this currently, but the data shape supports it cleanly).
- **Cons**:
  - Slightly more code than the global option (~15 extra lines).
  - Some users might want per-file precision; not supported here. (If we ever do, the per-language map and per-file map can coexist with file-ID overriding language.)

## Implementation pointers

- Config key: `autocompleteByLanguage` in `src/contributions/config.js`.
- Effective value resolution: `ConfigController.getEffectiveAutocomplete()`. Smart default checks both Monaco language (`plaintext` → off) and defaults to none (not JS), updating to the Drive filename once that is connected.
- Per-language writes: `ConfigController.setAutocompleteForCurrentLanguage(value)`.
- Per-language clear (revert to "auto"): `ConfigController.clearAutocompleteForCurrentLanguage()`.
- UI: View → "Configure Autocomplete" presents a 3-option picker (Auto / On / Off) scoped to the current model's language.
- `_applyConfig` re-evaluates on every model-language change (`editor.onDidChangeModelLanguage`) AND is explicitly called from `DriveController.openFile` after `setModelLanguage` to guarantee re-evaluation when files are opened.
- Monaco options affected: `quickSuggestions` and `suggestOnTriggerCharacters`.
