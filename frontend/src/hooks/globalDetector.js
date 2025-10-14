// src/hooks/globalDetector.js
import { FaceDetector, FilesetResolver } from "@mediapipe/tasks-vision";

let detectorInstance = null;
let initializing = false;

/**
 * Returns a shared FaceDetector instance.
 * Prevents reinitialization across pages (Home, WorkApp, etc).
 * Auto-heals if previous instance was destroyed (e.g., after hard reload).
 */
export async function getGlobalDetector() {
  // If instance exists, check it's still alive
  if (detectorInstance) {
    try {
      // Health-check to detect broken WASM/GPU context
      await detectorInstance.setOptions({});
      return detectorInstance;
    } catch (e) {
      console.warn("♻️ Detector instance invalid — reinitializing...");
      detectorInstance = null;
    }
  }

  // Wait if another init is in progress
  if (initializing) {
    while (initializing) await new Promise((r) => setTimeout(r, 50));
    return detectorInstance;
  }

  try {
    initializing = true;
    console.log("🟢 Initializing Global FaceDetector...");
    const vision = await FilesetResolver.forVisionTasks("/wasm");

    detectorInstance = await FaceDetector.createFromOptions(vision, {
      baseOptions: {
        modelAssetPath: "/models/blaze_face_short_range.tflite",
        delegate: "GPU",
      },
      runningMode: "VIDEO",
      minDetectionConfidence: 0.5,
    });

    console.log("✅ Global FaceDetector initialized");
    return detectorInstance;
  } catch (err) {
    console.error("❌ Failed to initialize Global FaceDetector:", err);
    throw err;
  } finally {
    initializing = false;
  }
}

/**
 * Optional cleanup (use only if you intentionally unload)
 */
export function releaseGlobalDetector() {
  if (detectorInstance) {
    try {
      detectorInstance.close();
      console.log("🧹 Global FaceDetector released");
    } catch (e) {
      console.warn("⚠️ Failed to release detector:", e);
    } finally {
      detectorInstance = null;
    }
  }
}