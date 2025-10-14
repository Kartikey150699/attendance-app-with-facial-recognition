// src/hooks/useEmbeddingsCache.js
import { useEffect, useState } from "react";
import { API_BASE } from "../config";

let globalEmbeddings = null;
let globalLoading = false;
let globalListeners = [];
let globalHash = ""; // 🔹 Tracks change signature for backend updates

/**
 * Global persistent embeddings cache across all components.
 * Automatically loads once and reuses for every page (Home, WorkApp, etc.)
 * + Auto-refreshes when backend data changes.
 */
export function useEmbeddingsCache() {
  const [embeddings, setEmbeddings] = useState(globalEmbeddings || []);
  const [loading, setLoading] = useState(!globalEmbeddings);

  // 🧩 Simple signature generator to detect changes
  const computeHash = (arr) => {
    if (!Array.isArray(arr)) return "";
    return arr.map(u => `${u.name}-${u.embedding?.length}`).join("|");
  };

  useEffect(() => {
    // 🧠 Restore from localStorage instantly if available
    if (!globalEmbeddings) {
      try {
        const stored = localStorage.getItem("face_embeddings_cache");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalEmbeddings = parsed;
            globalHash = computeHash(parsed);
            console.log(`⚡ Restored ${parsed.length} embeddings from localStorage`);
            setEmbeddings(parsed);
            setLoading(false);

            // Expose for console testing
            window.__EMBED_CACHE__ = parsed;
          }
        }
      } catch (e) {
        console.warn("⚠️ Local cache load failed:", e);
      }
    }

    // Already loaded globally → skip fetch
    if (globalEmbeddings) {
      setEmbeddings(globalEmbeddings);
      setLoading(false);
      window.__EMBED_CACHE__ = globalEmbeddings;
      return;
    }

    async function fetchEmbeddings(force = false) {
      if (globalLoading && !force) {
        // Wait until other component finishes loading
        await new Promise((resolve) => {
          globalListeners.push(resolve);
        });
        setEmbeddings(globalEmbeddings || []);
        setLoading(false);
        return;
      }

      try {
        globalLoading = true;
        console.log("🧠 Fetching global embeddings from backend...");
        const res = await fetch(`${API_BASE}/users/embeddings`, { cache: "no-store" });
        const data = await res.json();

        // Validate structure
        const users = Array.isArray(data.users) ? data.users : [];
        if (users.length === 0) throw new Error("Empty or invalid embeddings data");

        const newHash = computeHash(users);
        if (!force && newHash === globalHash) {
          // No change detected
          return;
        }

        globalEmbeddings = users;
        globalHash = newHash;
        console.log(`✅ Loaded ${users.length} global embeddings`);
        setEmbeddings(users);

        // Save to localStorage for instant reuse
        try {
          localStorage.setItem("face_embeddings_cache", JSON.stringify(users));
        } catch (e) {
          console.warn("⚠️ Failed to save cache locally:", e);
        }

        window.__EMBED_CACHE__ = users;
      } catch (err) {
        console.error("⚠️ Failed to load embeddings:", err);

        // fallback to previous valid data if available
        try {
          const stored = localStorage.getItem("face_embeddings_cache");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalEmbeddings = parsed;
              globalHash = computeHash(parsed);
              console.log(`♻️ Using backup cache (${parsed.length} embeddings)`);
              setEmbeddings(parsed);
              window.__EMBED_CACHE__ = parsed;
            }
          }
        } catch (e) {
          console.warn("⚠️ No valid backup cache found:", e);
        }
      } finally {
        setLoading(false);
        globalLoading = false;
        globalListeners.forEach((r) => r());
        globalListeners = [];
      }
    }

    // Initial fetch
    fetchEmbeddings(true);

    // Auto-refresh embeddings every 15 minutes (periodic)
    const interval15 = setInterval(() => {
      console.log("⏱️ Auto-refreshing embeddings cache (15min)...");
      fetchEmbeddings(true);
    }, 15 * 60 * 1000);

    // Live backend watcher every 10 seconds
    const watchInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/users/embeddings`, { cache: "no-store" });
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const newHash = computeHash(users);
        if (newHash !== globalHash) {
          console.log("🧩 Backend embeddings changed — refreshing cache automatically...");
          globalEmbeddings = users;
          globalHash = newHash;
          setEmbeddings(users);
          try {
            localStorage.setItem("face_embeddings_cache", JSON.stringify(users));
          } catch {}
          window.__EMBED_CACHE__ = users;
        }
      } catch (err) {
        console.warn("⚠️ Watcher failed:", err);
      }
    }, 10 * 1000); // every 10s check

    return () => {
      clearInterval(interval15);
      clearInterval(watchInterval);
    };
  }, []);

  return { embeddings, loading };
}

/**
 * Optional manual reset (e.g., for debugging)
 */
export function invalidateEmbeddingsCache() {
  console.log("♻️ Global embeddings cache invalidated");
  globalEmbeddings = null;
  globalHash = "";
  try {
    localStorage.removeItem("face_embeddings_cache");
  } catch (e) {
    console.warn("⚠️ Failed to clear local cache:", e);
  }
}