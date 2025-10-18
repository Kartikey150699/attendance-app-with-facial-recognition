// src/config.js
export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://exclude-guardian-newer-reproductive.trycloudflare.com" || 
      "https://0367a4ea48ed.ngrok-free.app" || 
      "https://facetrackaws.duckdns.org" || 
      "http://13.114.163.222:8000"
    : "http://localhost:8000";

// 💡 Notes:
// - Cloudflare (trycloudflare) → highest priority for now
// - Ngrok → fallback #1
// - DuckDNS (AWS custom domain) → fallback #2
// - Direct AWS IP → fallback #3
// - Localhost → used only in development