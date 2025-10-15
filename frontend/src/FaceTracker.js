import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Webcam from "react-webcam";
import { getGlobalDetector } from "./hooks/globalDetector";
import { strictMatch } from "./hooks/cosineMatcher"; // use your safe matcher
import { useEmbeddingsCache } from "./hooks/useEmbeddingsCache";


// --- Estimate distance from face box width (approx) ---
  const estimateDistance = (boxWidth, videoWidth, fov = 60) => {
  const FACE_REAL_WIDTH_CM = 15.0; // average human face width
  const f = (videoWidth / 2) / Math.tan((fov / 2) * Math.PI / 180);
  return (FACE_REAL_WIDTH_CM * f) / boxWidth; // distance in centimeters
};

function FaceTracker({ selectedCamera, onDetectionsChange, facesRef }, ref) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [fps, setFps] = useState(0);
  const [hudStats, setHudStats] = useState({ faces: 0, lighting: "–" });
  const lastTimeRef = useRef(performance.now());
  const faceCache = useRef({});
  const { embeddings, loading } = useEmbeddingsCache(); // cached user embeddings

  useImperativeHandle(ref, () => ({
    // eslint-disable-next-line react-hooks/exhaustive-deps
    getScreenshot: () => webcamRef.current?.getScreenshot(),
  }));

  // Initialize Mediapipe FaceDetector (global)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log("🟢 Getting global FaceDetector...");
        const detector = await getGlobalDetector();
        if (!cancelled) {
          detectorRef.current = detector;
          console.log("✅ Using global FaceDetector instance");
        }
      } catch (err) {
        console.error("❌ Failed to initialize FaceDetector:", err);
      }
    })();

    return () => {
      cancelled = true;
      // eslint-disable-next-line
      const localWebcam = webcamRef.current;
      if (localWebcam?.video?.srcObject) {
        localWebcam.video.srcObject.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Detection + Drawing Loop
  useEffect(() => {
  if (!videoReady || !detectorRef.current || loading) return;

  // eslint-disable-next-line
  const video = webcamRef.current.video;
  const canvas = canvasRef.current;
  const ctx = canvas.getContext("2d");
  const MEMORY_MS = 7000; // keep face box longer
  const SMOOTH_ALPHA = 0.7; // smoothing for motion

  // Intersection-over-Union (IoU) — checks if boxes overlap (face area only)
  // eslint-disable-next-line
  const iou = (boxA, boxB) => {
    const xA = Math.max(boxA.x - boxA.w / 2, boxB.x - boxB.w / 2);
    const yA = Math.max(boxA.y - boxA.h / 2, boxB.y - boxB.h / 2);
    const xB = Math.min(boxA.x + boxA.w / 2, boxB.x + boxB.w / 2);
    const yB = Math.min(boxA.y + boxA.h / 2, boxB.y + boxB.h / 2);
    const interArea = Math.max(0, xB - xA) * Math.max(0, yB - yA);
    const unionArea = boxA.w * boxA.h + boxB.w * boxB.h - interArea;
    return unionArea <= 0 ? 0 : interArea / unionArea;
  };

// Helper to draw detections with stable names
const drawDetections = (detections, backendFaces) => {
  if (!video) return;
  const rect = video.getBoundingClientRect();
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (isMobile) {
    canvas.width = rect.width;
    canvas.height = rect.height;
  } else if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }

  const scaleX = isMobile ? rect.width / video.videoWidth : 1;
  const scaleY = isMobile ? rect.height / video.videoHeight : 1;
  const now = Date.now();

  window.__ASSIGNED_FACES__ = new Set();
  detections.forEach((d) => {
    const b = d.boundingBox;
    const mirroredX = isMobile
      ? rect.width - (b.originX + b.width) * scaleX
      : canvas.width - (b.originX + b.width);
    const y = isMobile ? b.originY * scaleY : b.originY;
    const w = isMobile ? b.width * scaleX : b.width;
    const h = isMobile ? b.height * scaleY : b.height;

    // --- estimate distance for this face box ---
    const distanceCm = estimateDistance(w, video.videoWidth);

    // Safe multi-person assignment
    let face = null;
    if (backendFaces && backendFaces.length > 0) {
      if (!window.__ASSIGNED_FACES__) window.__ASSIGNED_FACES__ = new Set();

      let bestFace = null;
      let bestDist = Infinity;

      backendFaces.forEach((f) => {
        const [fx, fy] = f.box || [];
        const dist = Math.sqrt((fx - mirroredX) ** 2 + (fy - y) ** 2);
        const uniqueId = f.employee_id || f.name || f._id || `temp-${Math.random()}`;
        if (window.__ASSIGNED_FACES__.has(uniqueId)) return;
        if (dist < bestDist && dist < 80) {
          bestDist = dist;
          bestFace = f;
        }
      });

      if (bestFace) {
        face = { ...bestFace };
        const uniqueId = face.employee_id || face.name || face._id || `temp-${Math.random()}`;
        window.__ASSIGNED_FACES__.add(uniqueId);
        face._frameId = now;
      }
    }

    if (face) face._frameId = now;

    const cx = mirroredX + w / 2;
    const cy = y + h / 2;
    let box = { x: cx, y: cy, w, h };

    let label = "Scanning...";
    let color = "rgba(56,189,248,0.9)";
    let confidence = 0;
    let foundKey = null;

for (const key of Object.keys(faceCache.current)) {
  if (now - faceCache.current[key].time > MEMORY_MS) {
    delete faceCache.current[key];
  }
}

    if (foundKey && faceCache.current[foundKey]?.box) {
      const prev = faceCache.current[foundKey].box;
      box = {
        x: SMOOTH_ALPHA * box.x + (1 - SMOOTH_ALPHA) * prev.x,
        y: SMOOTH_ALPHA * box.y + (1 - SMOOTH_ALPHA) * prev.y,
        w: SMOOTH_ALPHA * box.w + (1 - SMOOTH_ALPHA) * prev.w,
        h: SMOOTH_ALPHA * box.h + (1 - SMOOTH_ALPHA) * prev.h,
      };
    }

    if (!foundKey) {
      foundKey = `${cx}-${cy}-${Date.now()}`;
      faceCache.current[foundKey] = {
        label: "Scanning...",
        color: "rgba(56,189,248,0.9)",
        time: now,
        box,
        streak: 0,
        lastSeenName: "Unknown",
        lastEmbedding: null,
      };
    }

    if (face && face.embedding) {
      const currentEmbedding = face.embedding;
      const prevEmbedding = faceCache.current[foundKey]?.lastEmbedding;
      // eslint-disable-next-line
      const firstMatch = strictMatch(currentEmbedding, embeddings);

      setTimeout(() => {
        const reverify = strictMatch(currentEmbedding, embeddings, null, prevEmbedding);
        if (reverify.name === "Unknown") {
          face.name = "Unknown";
          face.confidence = reverify.confidence;
        } else {
          face.name = reverify.name;
          face.confidence = reverify.confidence;
        }
      }, 120);

      faceCache.current[foundKey].lastEmbedding = currentEmbedding;
    }

    // --- Distance-based label override (adaptive by device type) ---
    const cached = faceCache.current[foundKey];

// --- Adaptive distance range ---
let MIN_DISTANCE = 35;
let MAX_DISTANCE = 90;
const ua = navigator.userAgent.toLowerCase();
if (/iphone|android/i.test(ua)) {
  MIN_DISTANCE = 15;
  MAX_DISTANCE = 55;
} else if (/ipad|tablet/i.test(ua)) {
  MIN_DISTANCE = 25;
  MAX_DISTANCE = 70;
} else {
  MIN_DISTANCE = 35;
  MAX_DISTANCE = 90;
}

// Persistent global continuity memory (per-face)
if (!window.__FACE_CONTINUITY__) window.__FACE_CONTINUITY__ = new Map();
const continuity = window.__FACE_CONTINUITY__;

const HOLD_TIME_MS = 10000;     // hold name for 10s
const GAP_TOLERANCE_MS = 1500;  // tolerate short loss
const FORGET_TIME_MS = 20000;   // forget after 20s idle
const REGION_RADIUS = 260;      // how far movement counts as same region

// Clean stale memory
for (const [name, info] of continuity.entries()) {
  if (now - info.lastSeen > FORGET_TIME_MS) continuity.delete(name);
}

if (distanceCm < MIN_DISTANCE) {
  label = "Move further";
  color = "rgba(59,130,246,0.9)";
  confidence = 0;
} else if (distanceCm > MAX_DISTANCE) {
  label = "Move closer";
  color = "rgba(239,68,68,0.9)";
  confidence = 0;
} else if (face && face.name && face.name !== "Unknown") {
  // Face recognized → update stable continuity
  const rawConf = (face.confidence || 0) * (face.confidence <= 1 ? 100 : 1);
  const prevConf = cached.smoothedConf ?? rawConf;
  const SMOOTH_FACTOR = 0.9;
  const smoothed = SMOOTH_FACTOR * prevConf + (1 - SMOOTH_FACTOR) * rawConf;

  confidence = Math.round(smoothed);
  label = `${face.name} (${confidence}%)`;
  color = "rgba(34,197,94,0.9)";

  cached.streak = Math.min(cached.streak + 1, 12);
  cached.lastSeenName = face.name;
  cached.smoothedConf = smoothed;
  cached.lastVisible = now;

  continuity.set(face.name, {
    lastSeen: now,
    confidence,
    x: box.x,
    y: box.y,
  });
} else {
  // Unknown or lost face → region-aware anti-leak logic
  const nowFaceCenter = { x: box.x, y: box.y };
  let nearestPrev = null;
  let nearestDist = Infinity;

  for (const [name, info] of continuity.entries()) {
    const dx = info.x - nowFaceCenter.x;
    const dy = info.y - nowFaceCenter.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const age = now - info.lastSeen;
    if (dist < REGION_RADIUS && age < HOLD_TIME_MS && dist < nearestDist) {
      nearestPrev = { name, info };
      nearestDist = dist;
    }
  }

  const movedFar = cached.box
    ? Math.sqrt((cached.box.x - box.x) ** 2 + (cached.box.y - box.y) ** 2)
    : Infinity;
  const recent = now - (cached.lastVisible || 0) < 4000;
  const stable = cached.streak >= 2;

  const isNewRegion =
    !nearestPrev ||
    (movedFar > REGION_RADIUS && !(recent && stable)) ||
    cached.lastSeenName === "Unknown";

  if (isNewRegion) {
    // New region — force fresh scan
    label = "Scanning...";
    color = "rgba(56,189,248,0.9)";
  } else if (
    nearestPrev &&
    now - nearestPrev.info.lastSeen < HOLD_TIME_MS + GAP_TOLERANCE_MS
  ) {
    // Maintain stable name
    label = `${nearestPrev.name}`;
    color = "rgba(34,197,94,0.9)";
  } else if (
    cached.lastSeenName &&
    cached.lastSeenName !== "Unknown" &&
    now - (cached.lastVisible || 0) < HOLD_TIME_MS + GAP_TOLERANCE_MS
  ) {
    // Retain last name briefly
    label = `${cached.lastSeenName}`;
    color = "rgba(34,197,94,0.8)";
  } else {
    label = "Scanning...";
    color = "rgba(56,189,248,0.9)";
  }
}

faceCache.current[foundKey] = { ...cached, label, color, time: now, box };

// ---------------- Draw HUD ----------------
ctx.strokeStyle = color;
ctx.lineWidth = 3;
ctx.strokeRect(mirroredX, y, w, h);
ctx.font = "bold 14px sans-serif";
const textWidth = ctx.measureText(label).width;
ctx.fillStyle = color;
ctx.fillRect(mirroredX - 2, y - 22, textWidth + 6, 18);
ctx.fillStyle = "#fff";
ctx.fillText(label, mirroredX + 2, y - 8);

ctx.font = "bold 13px sans-serif";
const distText = `${Math.round(distanceCm)} cm`;
const distWidth = ctx.measureText(distText).width;
ctx.fillStyle = "rgba(34,34,34,0.7)";
ctx.fillRect(
  mirroredX + w / 2 - distWidth / 2 - 4,
  y + h + 6,
  distWidth + 8,
  18
);
ctx.fillStyle = "#fff";
ctx.fillText(distText, mirroredX + w / 2 - distWidth / 2, y + h + 20);

const BAR_WIDTH = 120;
const BAR_HEIGHT = 6;
const barX = mirroredX + w / 2 - BAR_WIDTH / 2;
const barY = y + h + 30;

ctx.strokeStyle = "rgba(255,255,255,0.4)";
ctx.lineWidth = 1.2;
ctx.strokeRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);

const grad = ctx.createLinearGradient(barX, 0, barX + BAR_WIDTH, 0);
grad.addColorStop(0, "rgba(34,197,94,0.9)");
grad.addColorStop(0.5, "rgba(234,179,8,0.9)");
grad.addColorStop(1, "rgba(239,68,68,0.9)");
ctx.fillStyle = grad;
ctx.fillRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);

const normalized = Math.max(
  0,
  Math.min(1, (distanceCm - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE))
);
const targetMarkerX = barX + normalized * BAR_WIDTH;

if (!window.__markerPositions) window.__markerPositions = new Map();
let prevMarkerX = window.__markerPositions.get(foundKey) ?? targetMarkerX;
const newMarkerX = 0.85 * prevMarkerX + 0.15 * targetMarkerX;
window.__markerPositions.set(foundKey, newMarkerX);

let glowColor = "rgba(255,255,255,0.9)";
if (distanceCm < MIN_DISTANCE) glowColor = "rgba(59,130,246,0.9)";
else if (distanceCm > MAX_DISTANCE) glowColor = "rgba(239,68,68,0.9)";
else glowColor = "rgba(34,197,94,0.9)";

ctx.shadowColor = glowColor;
ctx.shadowBlur = 10;
ctx.fillStyle = "#fff";
ctx.beginPath();
ctx.moveTo(newMarkerX, barY + BAR_HEIGHT + 2);
ctx.lineTo(newMarkerX - 4, barY + BAR_HEIGHT + 10);
ctx.lineTo(newMarkerX + 4, barY + BAR_HEIGHT + 10);
ctx.closePath();
ctx.fill();
ctx.shadowBlur = 0;
});
};

  let running = true;

  const loop = async () => {
    if (!running || !detectorRef.current || !video) return;
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      rafRef.current = requestAnimationFrame(loop);
      return;
    }

    if (video.readyState >= 2) {
      const now = performance.now();
      try {
        const results = await detectorRef.current.detectForVideo(video, now);
        const detections = results?.detections || [];
        const backendFaces = facesRef?.current || [];
        // --- HUD stats update ---
        const facesCount = detections.length;

        // estimate average lighting (simple brightness)
        let avgBrightness = 0;
        if (video.videoWidth && video.videoHeight) {
          const tmpCanvas = document.createElement("canvas");
          const tmpCtx = tmpCanvas.getContext("2d");
          tmpCanvas.width = 32;
          tmpCanvas.height = 18;
          tmpCtx.drawImage(video, 0, 0, 32, 18);
          const pixels = tmpCtx.getImageData(0, 0, 32, 18).data;
          for (let i = 0; i < pixels.length; i += 4) {
            avgBrightness += 0.299 * pixels[i] + 0.587 * pixels[i + 1] + 0.114 * pixels[i + 2];
          }
          avgBrightness /= pixels.length / 4;
        }
        let lighting = "Good";
        if (avgBrightness > 170) lighting = "Too Bright";
        else if (avgBrightness < 70) lighting = "Too Dark";
        else if (avgBrightness < 90 || avgBrightness > 140) lighting = "Slightly Uneven";

        setHudStats({ faces: facesCount, lighting });
        drawDetections(detections, backendFaces);

        const delta = now - lastTimeRef.current;
        setFps(Math.round(1000 / delta));
        lastTimeRef.current = now;

        if (onDetectionsChange) onDetectionsChange(detections);
      } catch (err) {
        console.warn("⚠️ Detection error:", err);
      }
    }
    rafRef.current = requestAnimationFrame(loop);
  };

  loop();
  return () => {
    running = false;
    cancelAnimationFrame(rafRef.current);
  };
}, [videoReady, onDetectionsChange, facesRef, loading, embeddings]);

// ======================================================
// Expose recognized face info for parent (via ref)
// ======================================================
useImperativeHandle(ref, () => ({
  // Capture snapshot image
  getScreenshot: () => webcamRef.current?.getScreenshot(),

  // Get the best (highest-confidence) face (used for single-person logic)
  getCurrentFace: () => {
    const faces = [];
    for (const key in faceCache.current) {
      const f = faceCache.current[key];
      if (
        f.label &&
        f.label !== "Scanning..." &&
        f.label !== "Unknown" &&
        (f.smoothedConf || 0) > 50
      ) {
        faces.push({
          name: f.label.replace(/\(\d+%\)/, "").trim(),
          confidence: Math.round(f.smoothedConf || 0),
        });
      }
    }

    if (faces.length === 0) return null;
    // Return the one with highest confidence
    return faces.reduce((a, b) => (a.confidence > b.confidence ? a : b));
  },


// Get all recognized faces (multi-person, stable, unique)
getAllFaces: () => {
  const uniqueFaces = new Map();
  const now = Date.now();

  Object.entries(faceCache.current).forEach(([key, f]) => {
    if (
      f &&
      f.label &&
      f.label !== "Scanning..." &&
      f.label !== "Unknown" &&
      (f.smoothedConf || 0) >= 50 &&
      now - f.time < 3500 // only keep fresh (3.5 sec)
    ) {
      const name = f.label.replace(/\(\d+%\)/, "").trim();
      if (!uniqueFaces.has(name)) {
        uniqueFaces.set(name, {
          name,
          confidence: Math.round(f.smoothedConf || 0),
        });
      } else {
        const existing = uniqueFaces.get(name);
        if (f.smoothedConf > existing.confidence) {
          uniqueFaces.set(name, {
            name,
            confidence: Math.round(f.smoothedConf || 0),
          });
        }
      }
    }
  });

  const allFaces = Array.from(uniqueFaces.values());
  console.log("🎭 Multi-face output →", allFaces);
  return allFaces;
},
}));

return (
  <div
    className="relative rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-white/5"
    style={{
      width: /Android|iPhone|iPod/i.test(navigator.userAgent)
        ? "320px" // 📱 square for phones
        : "580px", // 💻 keep Mac/iPad as-is
      height: /Android|iPhone|iPod/i.test(navigator.userAgent)
        ? "320px"
        : "355px",
    }}
  >
    <Webcam
      key={selectedCamera}
      ref={webcamRef}
      mirrored
      audio={false}
      onUserMedia={() => {
        console.log("🎥 Video ready");
        setVideoReady(true);
      }}
      screenshotFormat="image/jpeg"
      className="w-full h-full object-cover"
      videoConstraints={{
        width: /Android|iPhone|iPod/i.test(navigator.userAgent) ? 320 : 580,
        height: /Android|iPhone|iPod/i.test(navigator.userAgent) ? 320 : 355,
        deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
      }}
    />
    <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

    {/* HUD (FPS / Faces / Lighting) */}
    <div className="absolute top-2 left-2 bg-black/50 text-white text-[11px] px-2 py-1 rounded-md shadow font-mono">
      FPS: {fps}
    </div>

    <div className="absolute top-2 right-2 bg-black/50 text-white text-[11px] px-2 py-1 rounded-md shadow font-mono text-right leading-tight">
      <div>Faces: {hudStats.faces}</div>
      <div>Core: ArcFace</div>
      <div>
        Lighting:{" "}
        <span
          className={
            hudStats.lighting === "Too Dark"
              ? "text-red-400"
              : hudStats.lighting === "Too Bright"
              ? "text-yellow-300"
              : hudStats.lighting === "Slightly Uneven"
              ? "text-amber-300"
              : "text-green-400"
          }
        >
          {hudStats.lighting}
        </span>
      </div>
    </div>
  </div>
);
}

export default forwardRef(FaceTracker);