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
  const faceCache = useRef({}); // position + time cache

  useImperativeHandle(ref, () => ({
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

    const video = webcamRef.current.video;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const MEMORY_MS = 500; // hold face label for 0.5s
    const MOVE_TOLERANCE = 120; // px tolerance for movement continuity

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

      detections.forEach((d, i) => {
        const b = d.boundingBox;
        const mirroredX = isMobile
          ? rect.width - (b.originX + b.width) * scaleX
          : canvas.width - (b.originX + b.width);
        const y = isMobile ? b.originY * scaleY : b.originY;
        const w = isMobile ? b.width * scaleX : b.width;
        const h = isMobile ? b.height * scaleY : b.height;

        // find matching backend face
        let face = null;
        if (backendFaces && backendFaces.length > 0) {
          face =
            backendFaces.find((f) => {
              const [fx, fy] = f.box || [];
              return Math.abs(fx - mirroredX) < 80 && Math.abs(fy - y) < 80;
            }) || null;
        }

        const cx = mirroredX + w / 2;
        const cy = y + h / 2;
        const box = { x: cx, y: cy, w, h };

        // --- smart movement-aware caching ---
        let label = "Scanning...";
        let color = "rgba(56,189,248,0.9)";
        let confidence = 0;
        let foundKey = null;

        // look for a cached face near this position
        for (const key of Object.keys(faceCache.current)) {
          const cached = faceCache.current[key];
          const dist = Math.sqrt((cached.box.x - cx) ** 2 + (cached.box.y - cy) ** 2);
          if (dist < MOVE_TOLERANCE) {
            foundKey = key;
            break;
          }
        }

        if (face && face.name && face.name !== "Unknown") {
          confidence = Math.round(
            (face.confidence || 0) * (face.confidence <= 1 ? 100 : 1)
          );
          label = `${face.name} (${confidence}%)`;
          color = "rgba(34,197,94,0.9)";
          faceCache.current[foundKey || `${cx}-${cy}`] = { label, color, time: now, box };
        } else if (face && face.name === "Unknown") {
          label = "Unknown";
          color = "rgba(239,68,68,0.9)";
          faceCache.current[foundKey || `${cx}-${cy}`] = { label, color, time: now, box };
        } else if (foundKey && now - faceCache.current[foundKey].time < MEMORY_MS) {
          // reuse last known label if movement is continuous
          const cached = faceCache.current[foundKey];
          label = cached.label;
          color = cached.color;
          faceCache.current[foundKey] = { ...cached, box, time: now };
        }

        // cleanup old entries
        for (const key of Object.keys(faceCache.current)) {
          if (now - faceCache.current[key].time > MEMORY_MS) delete faceCache.current[key];
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