// Provided via Vite env vars. See .env.example and SETUP.md.
// Local: set in .env.local. CI: GitHub Actions secrets passed to the build step.
export const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID;
export const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY;

export const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

export const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/drive.install",
].join(" ");
