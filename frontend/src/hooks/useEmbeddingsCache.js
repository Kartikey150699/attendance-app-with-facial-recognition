// src/hooks/useEmbeddingsCache.js
import { useEffect, useState } from "react";
import { API_BASE } from "../config";

let globalEmbeddings = null;
let globalLoading = false;
let globalListeners = [];
let globalHash = ""; // 🔹 Tracks change signature for backend updates

/**
 * Global embeddings cache (memory-only)
 * ➤ No localStorage
 * ➤ Always fetch fresh embeddings from backend
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
    // Already loaded globally → skip fetch
    if (globalEmbeddings) {
      setEmbeddings(globalEmbeddings);
      setLoading(false);
      window.__EMBED_CACHE__ = globalEmbeddings;
      return;
    }

    async function fetchEmbeddings(force = false) {
      if (globalLoading && !force) {
        await new Promise((resolve) => {
          globalListeners.push(resolve);
        });
        setEmbeddings(globalEmbeddings || []);
        setLoading(false);
        return;
      }

      try {
        globalLoading = true;
        console.log("🧠 Fetching live embeddings from backend...");
        const res = await fetch(`${API_BASE}/users/embeddings`, { cache: "no-store" });
        const data = await res.json();

        const users = Array.isArray(data.users) ? data.users : [];
        if (users.length === 0) throw new Error("Empty or invalid embeddings data");

        const newHash = computeHash(users);
        if (!force && newHash === globalHash) return;

        globalEmbeddings = users;
        globalHash = newHash;
        console.log(`✅ Loaded ${users.length} embeddings from backend`);
        setEmbeddings(users);
        window.__EMBED_CACHE__ = users;

      } catch (err) {
        console.error("⚠️ Failed to load embeddings:", err);
      } finally {
        setLoading(false);
        globalLoading = false;
        globalListeners.forEach((r) => r());
        globalListeners = [];
      }
    }

    // Initial fetch
    fetchEmbeddings(true);

    // Auto-refresh every 15 min
    const interval15 = setInterval(() => {
      console.log("⏱️ Refreshing embeddings (15 min)...");
      fetchEmbeddings(true);
    }, 15 * 60 * 1000);

    // Live backend watcher (10 sec)
    const watchInterval = setInterval(async () => {
      try {
        const res = await fetch(`${API_BASE}/users/embeddings`, { cache: "no-store" });
        const data = await res.json();
        const users = Array.isArray(data.users) ? data.users : [];
        const newHash = computeHash(users);
        if (newHash !== globalHash) {
          console.log("🧩 Backend embeddings changed — refreshing...");
          globalEmbeddings = users;
          globalHash = newHash;
          setEmbeddings(users);
          window.__EMBED_CACHE__ = users;
        }
      } catch (err) {
        console.warn("⚠️ Watcher failed:", err);
      }
    }, 10 * 1000);

    return () => {
      clearInterval(interval15);
      clearInterval(watchInterval);
    };
  }, []);

  return { embeddings, loading };
}

/**
 * Manual reset (if needed)
 */
export function invalidateEmbeddingsCache() {
  console.log("♻️ Embeddings cache (in-memory) cleared");
  globalEmbeddings = null;
  globalHash = "";
}