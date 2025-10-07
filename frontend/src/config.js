export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://facetrackaws.duckdns.org"
    : "http://localhost:8000";