// Replace with your own GCP OAuth Client ID
export const CLIENT_ID =
    "533890037483-v4hapt9o9oodico3fddan4oeslqe683k.apps.googleusercontent.com";

// Replace with your own GCP API key (enable Google Picker API in GCP console)
export const API_KEY = "AIzaSyAeuBRFCqyde4ddZAcOw8fT16T77z4sbBM";

export const DISCOVERY_DOC =
    "https://www.googleapis.com/discovery/v1/apis/drive/v3/rest";

export const SCOPES = [
    "https://www.googleapis.com/auth/drive.file",
    "https://www.googleapis.com/auth/drive.appdata",
    "https://www.googleapis.com/auth/drive.install",
].join(" ");
