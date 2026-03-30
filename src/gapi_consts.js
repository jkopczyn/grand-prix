// Replace with your own GCP OAuth Client ID
export const CLIENT_ID = "YOUR_CLIENT_ID.apps.googleusercontent.com";

export const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

export const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/drive.install",
].join(" ");
