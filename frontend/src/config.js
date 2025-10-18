// src/config.js
export const API_BASE =
  process.env.NODE_ENV === "production"
    ? "https://exclude-guardian-newer-reproductive.trycloudflare.com"
    : "http://localhost:8000";

/*
💡 Cloudflare Hosting Info:
To start hosting your backend temporarily:
    cloudflared tunnel --url http://localhost:8000

Then copy the new Cloudflare URL (shown in terminal)
and replace it in the line above.
This will keep your app connected to the backend through Cloudflare.
*/