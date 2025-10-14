// src/config.js
export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://facetrackaws.duckdns.org" || "http://13.114.163.222:8000"
    : "http://localhost:8000";