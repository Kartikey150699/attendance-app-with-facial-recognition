import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Webcam from "react-webcam";
import { getGlobalDetector } from "./hooks/globalDetector";
import { strictMatch } from "./hooks/cosineMatcher"; // use your safe matcher
import { useEmbeddingsCache } from "./hooks/useEmbeddingsCache";

function FaceTracker({ selectedCamera, onDetectionsChange, facesRef }, ref) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [fps, setFps] = useState(0);
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
    const MEMORY_MS = 800; // keep face box longer
    const SMOOTH_ALPHA = 0.7; // smoothing for motion
    // Intersection-over-Union (IoU) — checks if boxes overlap (face area only)
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

      // reset assigned face IDs per frame (prevents reusing same backend face)
      window.__ASSIGNED_FACES__ = new Set();
      detections.forEach((d) => {
        const b = d.boundingBox;
        const mirroredX = isMobile
          ? rect.width - (b.originX + b.width) * scaleX
          : canvas.width - (b.originX + b.width);
        const y = isMobile ? b.originY * scaleY : b.originY;
        const w = isMobile ? b.width * scaleX : b.width;
        const h = isMobile ? b.height * scaleY : b.height;

// Safe multi-person assignment (prevents shared name / ghosting)
let face = null;
if (backendFaces && backendFaces.length > 0) {
  if (!window.__ASSIGNED_FACES__) window.__ASSIGNED_FACES__ = new Set();

  let bestFace = null;
  let bestDist = Infinity;

  backendFaces.forEach((f) => {
    const [fx, fy] = f.box || [];
    const dist = Math.sqrt((fx - mirroredX) ** 2 + (fy - y) ** 2);

    // skip already-used faces this frame
    const uniqueId = f.employee_id || f.name || f._id || `temp-${Math.random()}`;
    if (window.__ASSIGNED_FACES__.has(uniqueId)) return;

    if (dist < bestDist && dist < 80) {
      bestDist = dist;
      bestFace = f;
    }
  });

  if (bestFace) {
    face = { ...bestFace }; // clone so we don't mutate backendFaces
    const uniqueId = face.employee_id || face.name || face._id || `temp-${Math.random()}`;
    window.__ASSIGNED_FACES__.add(uniqueId);
    face._frameId = now; // track this frame
  }
}

// ensure every frame is fresh, no ghost embedding
if (face) {
  face._frameId = now; // mark current frame
}

        const cx = mirroredX + w / 2;
        const cy = y + h / 2;
        let box = { x: cx, y: cy, w, h };

        // --- caching + color logic ---
        let label = "Scanning...";
        let color = "rgba(56,189,248,0.9)";
        let confidence = 0;
        let foundKey = null;

// find if any cached face overlaps (IoU > 0.25 → true face overlap)
for (const key of Object.keys(faceCache.current)) {
  const cached = faceCache.current[key];
  const overlap = iou(cached.box, { x: cx, y: cy, w, h });
  if (overlap > 0.25) { // only if 25% overlap with existing box
    foundKey = key;
    break;
  }
}

        // 🧩 smoothing box motion
        if (foundKey && faceCache.current[foundKey]?.box) {
          const prev = faceCache.current[foundKey].box;
          box = {
            x: SMOOTH_ALPHA * box.x + (1 - SMOOTH_ALPHA) * prev.x,
            y: SMOOTH_ALPHA * box.y + (1 - SMOOTH_ALPHA) * prev.y,
            w: SMOOTH_ALPHA * box.w + (1 - SMOOTH_ALPHA) * prev.w,
            h: SMOOTH_ALPHA * box.h + (1 - SMOOTH_ALPHA) * prev.h,
          };
        }

        // new face if not found
        if (!foundKey) {
          foundKey = `${cx}-${cy}-${Date.now()}`;
          faceCache.current[foundKey] = {
            label: "Scanning...",
            color: "rgba(56,189,248,0.9)",
            time: now,
            box,
            streak: 0,
            lastSeenName: "Unknown",
            lastEmbedding: null, // 🔹 store per-face embedding history
          };
        }

        // Apply strict matching to backendFace if available
        if (face && face.embedding) {
          const currentEmbedding = face.embedding;
          const prevEmbedding = faceCache.current[foundKey]?.lastEmbedding;

          // Step 1: First strict check
          // eslint-disable-next-line
          const firstMatch = strictMatch(currentEmbedding, embeddings);

          // Step 2: Optional reverify within 120ms
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

          // update per-face embedding
          faceCache.current[foundKey].lastEmbedding = currentEmbedding;
        }

        // Apply updated color/label logic + persistence
        const cached = faceCache.current[foundKey];
        if (face && face.name && face.name !== "Unknown") {
          // Smooth confidence display to remove flicker
          const rawConf = (face.confidence || 0) * (face.confidence <= 1 ? 100 : 1);
          const prevConf = cached.smoothedConf ?? rawConf;
          const SMOOTH_FACTOR = 0.85;
          const smoothed = SMOOTH_FACTOR * prevConf + (1 - SMOOTH_FACTOR) * rawConf;
          confidence = Math.round(smoothed);

          label = `${face.name} (${confidence}%)`;
          color = "rgba(34,197,94,0.9)";
          cached.streak = Math.min(cached.streak + 1, 10);
          cached.lastSeenName = face.name;
          cached.smoothedConf = smoothed; // save for next frame
        } else if (face && face.name === "Unknown") {
          // if previously known, hold the name for a few frames
          if (cached.lastSeenName !== "Unknown" && cached.streak > 2) {
            label = `${cached.lastSeenName}`;
            color = "rgba(34,197,94,0.9)";
          } else {
            label = "Unknown";
            color = "rgba(239,68,68,0.9)";
          }
        } else if (foundKey && now - cached.time < MEMORY_MS) {
          label = cached.label;
          color = cached.color;
        }

        // update cache
        faceCache.current[foundKey] = {
          ...cached,
          label,
          color,
          time: now,
          box,
        };

        // cleanup old faces
        for (const key of Object.keys(faceCache.current)) {
          if (now - faceCache.current[key].time > MEMORY_MS) delete faceCache.current[key];
          // Also remove cache if face moved far away
else {
  const cached = faceCache.current[key];
  const dx = Math.abs(cached.box.x - cx);
  const dy = Math.abs(cached.box.y - cy);
  if (dx > 150 || dy > 150) delete faceCache.current[key];
}
        }

        // draw box + label
        ctx.strokeStyle = color;
        ctx.lineWidth = 3;
        ctx.strokeRect(mirroredX, y, w, h);
        ctx.font = "bold 14px sans-serif";
        const textWidth = ctx.measureText(label).width;
        ctx.fillStyle = color;
        ctx.fillRect(mirroredX - 2, y - 22, textWidth + 6, 18);
        ctx.fillStyle = "#fff";
        ctx.fillText(label, mirroredX + 2, y - 8);
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

  return (
    <div className="relative w-full max-w-[580px] rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-white/5">
      <Webcam
        key={selectedCamera}
        // eslint-disable-next-line
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
          width: 580,
          height: 355,
          deviceId: selectedCamera ? { exact: selectedCamera } : undefined,
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />
      <div className="absolute top-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
        FPS: {fps}
      </div>
    </div>
  );
}

export default forwardRef(FaceTracker);