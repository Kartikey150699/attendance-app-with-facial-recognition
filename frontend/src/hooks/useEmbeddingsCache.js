// src/hooks/useEmbeddingsCache.js
import { useEffect, useState } from "react";
import { API_BASE } from "../config";

let globalEmbeddings = null;
let globalLoading = false;
let globalListeners = [];

/**
 * Global persistent embeddings cache across all components.
 * Automatically loads once and reuses for every page (Home, WorkApp, etc.)
 */
export function useEmbeddingsCache() {
  const [embeddings, setEmbeddings] = useState(globalEmbeddings || []);
  const [loading, setLoading] = useState(!globalEmbeddings);

  useEffect(() => {
    // 🧠 Restore from localStorage instantly if available
    if (!globalEmbeddings) {
      try {
        const stored = localStorage.getItem("face_embeddings_cache");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed) && parsed.length > 0) {
            globalEmbeddings = parsed;
            console.log(`⚡ Restored ${parsed.length} embeddings from localStorage`);
            setEmbeddings(parsed);
            setLoading(false);

            // 🧩 <--- NEW: expose to window for console testing
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

      // 🧩 <--- NEW: expose to window for console testing
      window.__EMBED_CACHE__ = globalEmbeddings;
      return;
    }

    async function fetchEmbeddings() {
      if (globalLoading) {
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

        // ✅ Validate structure
        const users = Array.isArray(data.users) ? data.users : [];
        if (users.length === 0) throw new Error("Empty or invalid embeddings data");

        globalEmbeddings = users;
        console.log(`✅ Loaded ${users.length} global embeddings`);
        setEmbeddings(users);

        // 💾 Save to localStorage for instant reuse
        try {
          localStorage.setItem("face_embeddings_cache", JSON.stringify(users));
        } catch (e) {
          console.warn("⚠️ Failed to save cache locally:", e);
        }

        // 🧩 <--- NEW: expose to window for console testing
        window.__EMBED_CACHE__ = users;

      } catch (err) {
        console.error("⚠️ Failed to load embeddings:", err);
        // 🩹 fallback to previous valid data if available
        try {
          const stored = localStorage.getItem("face_embeddings_cache");
          if (stored) {
            const parsed = JSON.parse(stored);
            if (Array.isArray(parsed) && parsed.length > 0) {
              globalEmbeddings = parsed;
              console.log(`♻️ Using backup cache (${parsed.length} embeddings)`);
              setEmbeddings(parsed);

              // 🧩 <--- NEW: expose to window for console testing
              window.__EMBED_CACHE__ = parsed;
            }
          }
        } catch (e) {
          console.warn("⚠️ No valid backup cache found:", e);
        }
      } finally {
        setLoading(false);
        globalLoading = false;
        // Notify all waiting listeners
        globalListeners.forEach((r) => r());
        globalListeners = [];
      }
    }

    fetchEmbeddings();

    // Auto-refresh embeddings every 15 minutes
    const interval = setInterval(() => {
      console.log("⏱️ Auto-refreshing embeddings cache...");
      globalEmbeddings = null;
      fetchEmbeddings();
    }, 15 * 60 * 1000);

    return () => clearInterval(interval);
  }, []);

  return { embeddings, loading };
}

/**
 * Optional manual reset (e.g., after registering or deleting a user)
 */
export function invalidateEmbeddingsCache() {
  console.log("♻️ Global embeddings cache invalidated");
  globalEmbeddings = null;
  try {
    localStorage.removeItem("face_embeddings_cache");
  } catch (e) {
    console.warn("⚠️ Failed to clear local cache:", e);
  }
}