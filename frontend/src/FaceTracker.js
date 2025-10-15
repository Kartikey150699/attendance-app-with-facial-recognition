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
      const cached = faceCache.current[key];
      const overlap = iou(cached.box, { x: cx, y: cy, w, h });
      if (overlap > 0.25) {
        foundKey = key;
        break;
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
      MAX_DISTANCE = 55; // phone
    } else if (/ipad|tablet/i.test(ua)) {
      MIN_DISTANCE = 25;
      MAX_DISTANCE = 70; // tablet / iPad
    } else {
      MIN_DISTANCE = 35;
      MAX_DISTANCE = 90; // laptop / desktop
    }

    if (distanceCm < MIN_DISTANCE) {
      label = "Move further";
      color = "rgba(59,130,246,0.9)"; // blue
      confidence = 0;
    } else if (distanceCm > MAX_DISTANCE) {
      label = "Move closer";
      color = "rgba(239,68,68,0.9)"; // red
      confidence = 0;
    } else if (face && face.name && face.name !== "Unknown") {
      const rawConf = (face.confidence || 0) * (face.confidence <= 1 ? 100 : 1);
      const prevConf = cached.smoothedConf ?? rawConf;
      const SMOOTH_FACTOR = 0.85;
      const smoothed = SMOOTH_FACTOR * prevConf + (1 - SMOOTH_FACTOR) * rawConf;
      confidence = Math.round(smoothed);
      label = `${face.name} (${confidence}%)`;
      color = "rgba(34,197,94,0.9)";
      cached.streak = Math.min(cached.streak + 1, 10);
      cached.lastSeenName = face.name;
      cached.smoothedConf = smoothed;
    } else if (face && face.name === "Unknown") {
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

    faceCache.current[foundKey] = { ...cached, label, color, time: now, box };

    for (const key of Object.keys(faceCache.current)) {
      if (now - faceCache.current[key].time > MEMORY_MS) delete faceCache.current[key];
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

    // --- draw distance below box ---
    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.6)";
    const distText = `${Math.round(distanceCm)} cm`;
    const distWidth = ctx.measureText(distText).width;
    ctx.fillStyle = "rgba(34,34,34,0.7)";
    ctx.fillRect(mirroredX + w / 2 - distWidth / 2 - 4, y + h + 6, distWidth + 8, 18);
    ctx.fillStyle = "#fff";
    ctx.fillText(distText, mirroredX + w / 2 - distWidth / 2, y + h + 20);

    // --- Focus Depth Hint Bar (Cinematic HUD) ---
    const BAR_WIDTH = 120;
    const BAR_HEIGHT = 6;
    const barX = mirroredX + w / 2 - BAR_WIDTH / 2;
    const barY = y + h + 30;

    // Base outline
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 1.2;
    ctx.strokeRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);

    // Gradient heat bar (green → yellow → red)
    const grad = ctx.createLinearGradient(barX, 0, barX + BAR_WIDTH, 0);
    grad.addColorStop(0, "rgba(34,197,94,0.9)");
    grad.addColorStop(0.5, "rgba(234,179,8,0.9)");
    grad.addColorStop(1, "rgba(239,68,68,0.9)");
    ctx.fillStyle = grad;
    ctx.fillRect(barX, barY, BAR_WIDTH, BAR_HEIGHT);

    // Compute normalized marker position (0→1)
    const normalized = Math.max(0, Math.min(1, (distanceCm - MIN_DISTANCE) / (MAX_DISTANCE - MIN_DISTANCE)));
    const targetMarkerX = barX + normalized * BAR_WIDTH;

    // Smooth transition for marker
    if (!window.__prevMarkerX) window.__prevMarkerX = targetMarkerX;
    window.__prevMarkerX = 0.8 * window.__prevMarkerX + 0.2 * targetMarkerX;

    // Adaptive glow color (based on distance)
    let glowColor = "rgba(255,255,255,0.9)";
    if (distanceCm < MIN_DISTANCE) glowColor = "rgba(59,130,246,0.9)";
    else if (distanceCm > MAX_DISTANCE) glowColor = "rgba(239,68,68,0.9)";
    else glowColor = "rgba(34,197,94,0.9)";

    // Draw marker (triangle with glow)
    ctx.shadowColor = glowColor;
    ctx.shadowBlur = 10;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(window.__prevMarkerX, barY + BAR_HEIGHT + 2);
    ctx.lineTo(window.__prevMarkerX - 4, barY + BAR_HEIGHT + 10);
    ctx.lineTo(window.__prevMarkerX + 4, barY + BAR_HEIGHT + 10);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0; // reset shadow
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
<div className="absolute top-2 left-2 bg-white/10 backdrop-blur-md text-white text-[11px] px-3 py-1.5 rounded-lg shadow-md border border-white/20 font-mono">
  FPS: {fps}
</div>
      <div className="absolute top-2 right-2 bg-white/10 backdrop-blur-md text-white text-[11px] px-3 py-2 rounded-lg shadow-md border border-white/20 leading-tight font-mono">
  <div>Faces: {hudStats.faces}</div>
  <div>Core: ArcFace-Depth v1.1</div>
  <div>
  Lighting:{" "}
  <span
    style={{
      color:
        hudStats.lighting === "Too Dark"
          ? "#f87171" // red
          : hudStats.lighting === "Too Bright"
          ? "#facc15" // yellow
          : hudStats.lighting === "Slightly Uneven"
          ? "#fbbf24" // amber
          : "#4ade80", // green
    }}
  >
    {hudStats.lighting}
  </span>
</div>
</div>
    </div>
  );
}

export default forwardRef(FaceTracker);