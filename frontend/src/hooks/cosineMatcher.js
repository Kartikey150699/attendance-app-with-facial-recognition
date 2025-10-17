// cosineMatcher.js — lightning-fast & safe adaptive matcher (relaxed stability mode)

// =========================
// L2 normalize (safe)
// =========================
export function normalize(vec) {
  if (!Array.isArray(vec) || vec.length === 0) return [];
  let sum = 0;
  for (let i = 0; i < vec.length; i++) sum += vec[i] * vec[i];
  const norm = Math.sqrt(sum) || 1e-10;
  const out = new Array(vec.length);
  for (let i = 0; i < vec.length; i++) out[i] = vec[i] / norm;
  return out;
}

// =========================
// Cosine similarity on normalized vectors
// =========================
export function cosine(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return 0;
  let dot = 0;
  for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
  return dot;
}

// =========================
// Global stability tracker (across frames)
// =========================
let lastStable = { name: "Unknown", confidence: 0, frames: 0 };
const STABILITY_FRAMES = 1; // ⚡ show faster (was 4)

// =========================
// Strict adaptive match (Safe + Responsive version)
// =========================
export function strictMatch(input, cache, threshOverride, reverifyEmbedding = null) {
  if (!input || !cache?.length) return { name: "Unknown", confidence: 0 };

  // Threshold parameters (tuned for balanced safety)
  const VERY_STRICT = 0.65;              // auto-accept if ≥ this
  const THRESH = threshOverride ?? 0.46; // main threshold
  const MIN_SIM = 0.40;                  // absolute floor
  const MARGIN = 0.08;                   // top-1 must beat top-2 by ≥ this
  const STABILITY_DELTA = 0.05;          // must be stable across 2 frames

  const q = normalize(input);

  // Pre-normalize cache embeddings
  const normCache = cache
    .map((u) => ({
      name: u.name || "Unknown",
      emb: Array.isArray(u?.embedding) ? normalize(u.embedding) : null,
    }))
    .filter((u) => u.emb);

  if (normCache.length === 0) return { name: "Unknown", confidence: 0 };

  // Compute cosine similarities
  const sims = new Float32Array(normCache.length);
  for (let i = 0; i < normCache.length; i++) {
    const emb = normCache[i].emb;
    let dot = 0;
    for (let j = 0; j < q.length; j++) dot += q[j] * emb[j];
    sims[i] = dot;
  }

  // Find top-2 similarities
  let bestIdx = -1, bestSim = -1, secondSim = -1;
  for (let i = 0; i < sims.length; i++) {
    const s = sims[i];
    if (s > bestSim) {
      secondSim = bestSim;
      bestSim = s;
      bestIdx = i;
    } else if (s > secondSim) {
      secondSim = s;
    }
  }

  const bestName = bestIdx >= 0 ? normCache[bestIdx].name : "Unknown";

  // ✅ Fast-path: confident match
  if (bestSim >= VERY_STRICT) {
    lastStable = { name: bestName, confidence: bestSim, frames: STABILITY_FRAMES };
    return { name: bestName, confidence: bestSim };
  }

  // Strict margin + threshold validation
  const marginOk = bestSim - (secondSim < 0 ? 0 : secondSim) >= MARGIN;
  const strongEnough = bestSim >= THRESH && bestSim >= MIN_SIM;

  // Reverify stability (compare with previous embedding if available)
  if (reverifyEmbedding && bestIdx >= 0) {
    const reverifySim = cosine(normalize(reverifyEmbedding), normCache[bestIdx].emb);
    if (Math.abs(bestSim - reverifySim) > STABILITY_DELTA) {
      return { name: "Unknown", confidence: bestSim };
    }
  }

  // Main decision logic
  let result = "Unknown";
  if (strongEnough && marginOk) {
    result = bestName;
  }

  // Temporal stability memory
  if (result === lastStable.name) {
    lastStable.frames++;
    if (lastStable.frames >= STABILITY_FRAMES) {
      lastStable.confidence = bestSim;
      return { name: lastStable.name, confidence: bestSim };
    }
  } else {
    if (result === "Unknown") {
      lastStable.frames = Math.max(0, lastStable.frames - 1);
    } else {
      lastStable = { name: result, confidence: bestSim, frames: 1 };
    }
  }

  // ✅ Relaxed fallback — show best valid name immediately if above threshold
  if (result !== "Unknown") {
    return { name: bestName, confidence: bestSim };
  }

  // fallback to Unknown
  return { name: "Unknown", confidence: bestSim };
}