import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { T } from "./tokens.mts";

/**
 * ImageTrackingViewer
 * ---------------------------------------------------------------------------
 * Fallback AR path for devices that don't support WebXR / Scene Viewer / Quick
 * Look (e.g. older iPhones, many budget Android phones, desktop browsers with
 * a webcam). Uses MindAR's image-tracking engine instead of markerless world
 * tracking: the user points their camera at a known target image (e.g. a menu
 * photo or table tent) and the GLB model is overlaid on top of it.
 *
 * This is a genuinely different tracking pipeline from <model-viewer>'s AR —
 * not an extension of it — so it's a separate component, switched in by the
 * parent based on AR capability detection.
 *
 * Requires:
 *  - `npm install mind-ar three`
 *  - A compiled `.mind` target file generated from a marker image, via
 *    MindAR's image-target compiler: https://hiukim.github.io/mind-ar-js-doc/tools/compile
 *  - HTTPS (getUserMedia requires a secure context, same as WebXR)
 */

interface ImageTrackingViewerProps {
  glbUrl: string;
  /** URL to the compiled .mind target file for the marker image. */
  mindTargetUrl: string;
  /** Display name shown in the UI, e.g. the dish name. */
  name: string;
  onExit?: () => void;
}

type TrackingPhase = "loading" | "ready" | "scanning" | "found" | "camera-denied" | "error";

export function ImageTrackingViewer({ glbUrl, mindTargetUrl, name, onExit }: ImageTrackingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindarRef = useRef<any>(null);
  const [phase, setPhase] = useState<TrackingPhase>("loading");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let renderer: THREE.WebGLRenderer | null = null;

    async function init() {
      if (!containerRef.current) return;

      try {
        // Dynamic import keeps MindAR (and its TensorFlow.js dependency) out of
        // the main bundle entirely — it's only fetched if this fallback path
        // actually runs, since most users will hit <model-viewer> instead.
        const { MindARThree } = await import("mind-ar/dist/mindar-image-three.prod.js");

        if (cancelled) return;

        const mindarThree = new MindARThree({
          container: containerRef.current,
          imageTargetSrc: mindTargetUrl,
        });
        mindarRef.current = mindarThree;

        const { renderer: r, scene, camera } = mindarThree;
        renderer = r;

        const anchor = mindarThree.addAnchor(0);

        anchor.onTargetFound = () => !cancelled && setPhase("found");
        anchor.onTargetLost = () => !cancelled && setPhase("scanning");

        // Load the GLB onto the anchor.
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const loader = new GLTFLoader();
        const gltf = await loader.loadAsync(glbUrl);
        const model = gltf.scene;

        // Reasonable default framing; callers can adjust per-model if needed.
        model.scale.set(0.3, 0.3, 0.3);
        model.position.set(0, 0, 0);
        anchor.group.add(model);

        // Basic lighting — image-tracked AR has no real-world light estimation,
        // so a couple of simple lights keep the model from looking flat/black.
        const hemiLight = new THREE.HemisphereLight(0xffffff, 0x444444, 1.2);
        scene.add(hemiLight);
        const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
        dirLight.position.set(0.5, 1, 0.5);
        scene.add(dirLight);

        if (cancelled) return;

        setPhase("ready");

        await mindarThree.start();
        if (cancelled) return;
        setPhase("scanning");

        renderer.setAnimationLoop(() => {
          renderer!.render(scene, camera);
        });
      } catch (err: any) {
        if (cancelled) return;
        if (err?.name === "NotAllowedError" || err?.message?.includes("Permission")) {
          setPhase("camera-denied");
        } else {
          setPhase("error");
          setErrorMessage("Couldn't start image tracking on this device.");
        }
      }
    }

    init();

    return () => {
      cancelled = true;
      renderer?.setAnimationLoop(null);
      mindarRef.current?.stop?.();
      mindarRef.current?.renderer?.dispose?.();
    };
  }, [glbUrl, mindTargetUrl]);

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        background: T.bg,
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* Name pill, consistent with the main viewer */}
      <div
        style={{
          position: "absolute",
          top: "1.2rem",
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          background: "rgba(13,26,31,0.75)",
          backdropFilter: "blur(12px)",
          border: `1px solid ${T.border}`,
          borderRadius: 999,
          padding: "0.45rem 1.4rem",
          fontSize: "1.05rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          whiteSpace: "nowrap",
          color: T.accent,
        }}
      >
        {name}
      </div>

      {onExit && (
        <button
          onClick={onExit}
          style={{
            position: "absolute",
            top: "1.2rem",
            right: "1.2rem",
            zIndex: 10,
            background: "rgba(13,26,31,0.75)",
            color: T.text,
            border: `1px solid ${T.border}`,
            borderRadius: 999,
            width: 36,
            height: 36,
            fontSize: "1rem",
            cursor: "pointer",
          }}
          aria-label="Exit image tracking"
        >
          ✕
        </button>
      )}

      {phase === "loading" && (
        <div style={overlayStyle}>
          <span style={{ color: T.muted, fontSize: "0.9rem" }}>Setting up camera...</span>
        </div>
      )}

      {phase === "scanning" && (
        <div style={coachStyle}>
          <span style={{ fontWeight: 700, color: T.accent }}>Point your camera at the menu photo</span>
          <span style={{ color: T.muted, fontSize: "0.82rem" }}>
            Hold steady and make sure it's well lit.
          </span>
        </div>
      )}

      {phase === "camera-denied" && (
        <div style={overlayStyle}>
          <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
            Camera access is needed for this. Please allow camera permissions and reload.
          </span>
        </div>
      )}

      {phase === "error" && (
        <div style={overlayStyle}>
          <span style={{ color: "#f87171", fontSize: "0.9rem" }}>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "rgba(13,26,31,0.6)",
};

const coachStyle: React.CSSProperties = {
  position: "absolute",
  top: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  zIndex: 11,
  background: "rgba(13,26,31,0.85)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 14,
  padding: "0.8rem 1.3rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.3rem",
  maxWidth: "78%",
  textAlign: "center",
};