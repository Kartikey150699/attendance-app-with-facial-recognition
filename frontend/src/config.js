// src/config.js

// Auto-select backend URL based on environment
export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://73e2085ed5fc.ngrok-free.app"  // backend (ngrok or hosted)
    : "http://localhost:8000";               // local FastAPI backend