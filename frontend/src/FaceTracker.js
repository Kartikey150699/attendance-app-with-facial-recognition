import { useEffect, useRef, useState, useImperativeHandle, forwardRef } from "react";
import Webcam from "react-webcam";
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

function FaceTracker({ selectedCamera, onDetectionsChange, facesRef }, ref) {
  const webcamRef = useRef(null);
  const canvasRef = useRef(null);
  const detectorRef = useRef(null);
  const rafRef = useRef(null);
  const [videoReady, setVideoReady] = useState(false);
  const [fps, setFps] = useState(0);
  const lastTimeRef = useRef(performance.now());
  const localCache = useRef({});

  useImperativeHandle(ref, () => ({
    // eslint-disable-next-line react-hooks/exhaustive-deps
    getScreenshot: () => webcamRef.current?.getScreenshot(),
  }));

  // Initialize Mediapipe
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        console.log("🟢 Initializing FaceDetector...");
        const vision = await FilesetResolver.forVisionTasks("/wasm");
        const detector = await FaceDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "/models/blaze_face_short_range.tflite",
            delegate: "GPU",
          },
          runningMode: "VIDEO",
          minDetectionConfidence: 0.5,
        });
        if (!cancelled) {
          detectorRef.current = detector;
          console.log("✅ FaceDetector initialized successfully");
        }
      } catch (err) {
        console.error("❌ Failed to initialize FaceDetector:", err);
      }
    })();

    return () => {
      cancelled = true;
      // eslint-disable-next-line react-hooks/exhaustive-deps
      const localWebcam = webcamRef.current;
      if (detectorRef.current) {
        try {
          detectorRef.current.close();
          console.log("🧹 FaceDetector closed safely");
        } catch (e) {
          console.warn("⚠️ FaceDetector cleanup failed:", e);
        }
      }
      if (localWebcam?.video?.srcObject) {
        localWebcam.video.srcObject.getTracks().forEach((t) => t.stop());
      }
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Main loop
  useEffect(() => {
    if (!videoReady || !detectorRef.current) return;

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const drawDetections = (detections, backendFaces) => {
      if (!video) return;

      const rect = video.getBoundingClientRect();
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

      // always clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // 🔧 dynamic canvas sizing
      if (isMobile) {
        canvas.width = rect.width;
        canvas.height = rect.height;
      } else {
        if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
        }
      }

      const scaleX = isMobile ? rect.width / video.videoWidth : 1;
      const scaleY = isMobile ? rect.height / video.videoHeight : 1;

      detections.forEach((d, i) => {
        const b = d.boundingBox;

        // mirrored X coordinate
        const mirroredX = isMobile
          ? rect.width - (b.originX + b.width) * scaleX
          : canvas.width - (b.originX + b.width);
        const y = isMobile ? b.originY * scaleY : b.originY;
        const w = isMobile ? b.width * scaleX : b.width;
        const h = isMobile ? b.height * scaleY : b.height;

        // Base rectangle
        ctx.lineWidth = 2;
        ctx.strokeStyle = "rgba(56,189,248,0.9)";
        ctx.strokeRect(mirroredX, y, w, h);

        // match with backend faces
        let face = null;
        if (backendFaces && backendFaces.length > 0) {
          face =
            backendFaces.find((f) => {
              const [fx, fy] = f.box || [];
              return Math.abs(fx - mirroredX) < 80 && Math.abs(fy - y) < 80;
            }) || null;
        }

// --- Ultra-stable cache (handles z-movement & resizing) ---
const now = Date.now();
let foundKey = null;
// eslint-disable-next-line no-unused-vars
let foundBox = null;

// Calculate box center
const cx = mirroredX + b.width / 2;
const cy = b.originY + b.height / 2;

// Try to find a cached face near this position *and* similar size
for (const k of Object.keys(localCache.current)) {
  const cached = localCache.current[k];
  const { x: kx, y: ky, w: kw} = cached.box || {};
  if (!kx) continue;

  const dist = Math.sqrt((kx - cx) ** 2 + (ky - cy) ** 2);
  const sizeRatio = Math.min(b.width / (kw || 1), kw / (b.width || 1));

  // Within ~80px center distance & within 40% size change
  if (dist < 80 && sizeRatio > 0.6) {
    foundKey = k;
    // eslint-disable-next-line no-unused-vars
    foundBox = cached.box;
    break;
  }
}

// fallback key
const key = foundKey || `${Math.round(cx)}-${Math.round(cy)}`;
const cached = localCache.current[key] || {
  seen: 0,
  name: null,
  confidence: 0,
  lastSeen: 0,
  box: { x: cx, y: cy, w: b.width, h: b.height },
};

if (face && face.name && face.name !== "Unknown") {
  cached.name = face.name;
  cached.confidence = face.confidence;
  cached.box = { x: cx, y: cy, w: b.width, h: b.height };
  cached.seen = Math.min((cached.seen || 0) + 1, 6);
  cached.lastSeen = now;
  localCache.current[key] = cached;
} else if (cached.name && now - cached.lastSeen < 500) {
  // keep showing last name for 0.5s if tracking lost
  localCache.current[key] = cached;
} else {
  cached.lastSeen = now;
  cached.box = { x: cx, y: cy, w: b.width, h: b.height };
  localCache.current[key] = cached;
}

        // expire cache
        Object.keys(localCache.current).forEach((k) => {
          if (Date.now() - localCache.current[k].lastSeen > 5000) delete localCache.current[k];
        });

        // label
        let label = "Face";
        let color = "rgba(56,189,248,0.9)";
        let percent = 0;

        const cachedFace = localCache.current[key];
        if (cachedFace && cachedFace.seen >= 3) {
          label = `${cachedFace.name} (${Math.round(
            (cachedFace.confidence || 0) * (cachedFace.confidence <= 1 ? 100 : 1)
          )}%)`;
          color = "rgba(34,197,94,0.9)";
        } else if (face) {
          const isKnown =
            face.status === "known" ||
            (face.name && face.name !== "Unknown" && (face.confidence || 0) > 0.4);
          color = isKnown ? "rgba(34,197,94,0.9)" : "rgba(239,68,68,0.9)";
          percent = Math.round(
            (face.confidence || 0) * (face.confidence <= 1 ? 100 : 1)
          );
          label = isKnown ? `${face.name} (${percent}%)` : "Unknown";
        } else {
          label = `Face ${i + 1}`;
        }

        // draw final label
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
  }, [videoReady, onDetectionsChange, facesRef]);

  return (
    <div className="relative w-full max-w-[580px] rounded-2xl overflow-hidden shadow-lg border border-white/20 bg-white/5">
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