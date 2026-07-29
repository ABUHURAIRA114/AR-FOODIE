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
 * Rotation: a two-finger TWIST anywhere on the tracking view spins the model
 * sideways — around the vertical axis standing up out of the marker image —
 * the same "turn a dial" gesture used in the WebXR path. It never tilts the
 * model up/down or side-to-side; only the spin around that single vertical
 * axis is exposed. See onContainerTouchStart/Move/End below.
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
  /**
   * Multiplier applied on top of automatic bounding-box normalisation
   * (which sizes every model consistently regardless of how it was
   * originally modeled/exported). 1 = default size, 2 = twice as large, etc.
   */
  modelScale?: number;
}

type TrackingPhase = "loading" | "ready" | "scanning" | "found" | "camera-denied" | "error";

export function ImageTrackingViewer({ glbUrl, mindTargetUrl, name, onExit, modelScale = 1 }: ImageTrackingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindarRef = useRef<any>(null);
  // Holds the spin group (see init() below) once the model has finished
  // loading, so the touch handlers — set up independently of the async
  // load — can rotate it as soon as it exists.
  const spinGroupRef = useRef<THREE.Group | null>(null);
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

        // Force an explicitly transparent clear color. MindARThree sets
        // alpha:true on its internal renderer by default, but relying on
        // that default silently is what caused the camera feed to render
        // as solid black in testing — the canvas must clear to alpha 0 on
        // every frame so the <video> element underneath shows through in
        // every area the 3D scene doesn't cover.
        renderer.setClearColor(0x000000, 0);

        const anchor = mindarThree.addAnchor(0);

        anchor.onTargetFound = () => !cancelled && setPhase("found");
        anchor.onTargetLost = () => !cancelled && setPhase("scanning");

        // Load the GLB onto the anchor. DRACOLoader is required for any GLB
        // that uses Draco mesh compression — without it attached,
        // GLTFLoader can't decode the compressed geometry at all and the
        // load silently fails (this was missing entirely before, which is
        // exactly why Draco-compressed models wouldn't load here while
        // uncompressed ones worked fine). Same decoder setup already
        // proven working in WebXRPlacementViewer.tsx.
        const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
        const { DRACOLoader } = await import("three/examples/jsm/loaders/DRACOLoader.js");
        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
        dracoLoader.setDecoderConfig({ type: "wasm" });

        const loader = new GLTFLoader();
        loader.setDRACOLoader(dracoLoader);

        let model: THREE.Object3D;
        try {
          const gltf = await loader.loadAsync(glbUrl);
          model = gltf.scene;
        } catch (err: any) {
          // Caught specifically (rather than falling into the generic
          // catch below) so a broken/incompatible model gives an
          // actionable message instead of the same vague text shown for
          // camera/permission problems.
          console.error("[ImageTrackingViewer] Model load failed:", err);
          if (!cancelled) {
            setPhase("error");
            setErrorMessage(`Couldn't load the 3D model. (${err?.message ?? "Unknown error"})`);
          }
          return;
        } finally {
          dracoLoader.dispose();
        }

        // MindAR's anchor coordinate system has the tracked image lying flat
        // in the local XY plane: X = right, Y = up **within the image**, and
        // Z = perpendicular to the image, pointing toward the camera / away
        // from the marker surface (confirmed by MindAR's own examples, which
        // overlay a flat plane directly on anchor.group with zero rotation
        // to represent the image itself). Z is therefore the "vertical" axis
        // a dish would stand up out of the marker along — the axis a sideways
        // spin should turn around.
        //
        // A glTF model's native up axis (Y) therefore lines up with the
        // anchor's *in-plane* Y by default — not the axis actually
        // perpendicular to the marker — which is exactly why the dish was
        // rendering standing up on its side instead of resting flat on top
        // of the marker. Rotating 90° about X swaps the model's up axis onto
        // the anchor's Z axis, so it lies flat with its top facing the
        // camera, the way a real dish would sit on a table the marker is
        // printed on.
        //
        // Because that corrective 90° tilt is baked directly into the
        // model's own rotation.x, the model's local Y and Z axes no longer
        // match the anchor's — so the sideways-spin gesture below rotates a
        // separate parent "spin group" around the anchor's own Z axis
        // instead of touching the model's rotation directly. That keeps the
        // spin strictly to "turning like a dial on the table" and makes it
        // impossible for the gesture to accidentally tilt the model
        // up/down, no matter how the model itself is oriented inside it.
        model.rotation.x = Math.PI / 2;

        // Normalise by the model's actual bounding box instead of a blind
        // fixed scale — a flat `0.3` looks wildly different (often far too
        // small) depending on the GLB's native units/export scale. Sizing
        // relative to the target image's tracking plane (1 unit here = the
        // width of the marker image) keeps every dish's model consistently
        // sized on top of its marker, and modelScale lets it be tuned up or
        // down per-scene from there.
        model.updateWorldMatrix(true, true);
        const box = new THREE.Box3().setFromObject(model);
        const size = new THREE.Vector3();
        box.getSize(size);
        const largestDimension = Math.max(size.x, size.y, size.z);

        if (largestDimension > 0 && isFinite(largestDimension)) {
          const targetSize = 1; // model's largest dimension = the marker's own width
          const normalizingScale = targetSize / largestDimension;
          model.scale.setScalar(normalizingScale * modelScale);
        } else {
          model.scale.setScalar(modelScale);
          console.warn("[ImageTrackingViewer] Degenerate bounding box — using raw modelScale.");
        }

        // Re-center within the image plane (X/Y) so the model sits directly
        // over the marker rather than floating off to one side, then rest
        // its base on the tracking plane itself (z = 0) instead of floating
        // through it or embedding into the marker.
        box.setFromObject(model);
        const center = new THREE.Vector3();
        box.getCenter(center);
        model.position.x -= center.x;
        model.position.y -= center.y;
        model.position.z -= box.min.z;

        // Spin group: sits between the anchor and the model, and is the
        // ONLY thing the twist gesture ever rotates (around its local Z,
        // which is the anchor's own Z — the axis perpendicular to the
        // marker image). The model keeps its corrective rotation.x baked in
        // underneath, untouched by the gesture, so twisting can only ever
        // spin the dish like a lazy susan on top of the marker — never tilt
        // it up/down or side-to-side.
        const spinGroup = new THREE.Group();
        spinGroup.add(model);
        anchor.group.add(spinGroup);
        spinGroupRef.current = spinGroup;

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

        // MindARThree.start() reconfigures the renderer/canvas internally as
        // part of getting the camera stream running, which was silently
        // undoing the setClearColor call above — the canvas would end up
        // fully opaque black by the time the first frame rendered, even
        // though the <video> element underneath was playing fine. Re-assert
        // it now, AND every single frame in the loop below, so there's no
        // path left for it to drift back to opaque.
        renderer.setClearColor(0x000000, 0);

        // Some browsers (especially with restrictive autoplay policies)
        // silently pause a <video> element even once its srcObject is a
        // live camera stream — tracking still works because MindAR reads
        // pixels straight from the stream, but the visible element stays on
        // its first (black) frame forever. Force playback explicitly.
        const videoEl = containerRef.current?.querySelector("video");
        if (videoEl) {
          videoEl.muted = true;
          videoEl.setAttribute("playsinline", "true");
          videoEl.setAttribute("muted", "true");
          videoEl.play().catch(() => {
            // Autoplay was blocked outright — nothing more we can do without
            // a user gesture, but tracking itself is unaffected.
          });
        }

        renderer.setAnimationLoop(() => {
          renderer!.setClearColor(0x000000, 0);
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
      spinGroupRef.current = null;
    };
  }, [glbUrl, mindTargetUrl]);

  // --- Two-finger TWIST rotate ---
  // Rotates the model sideways only — spinning around the single vertical
  // axis standing up out of the marker image, the way you'd spin a plate on
  // a table. It never tilts the model up/down or side-to-side; those axes
  // are simply never touched by this gesture.
  //
  // Set up independently of the async model load in init() above: these
  // listeners attach to the container div as soon as it mounts, and each
  // handler just checks spinGroupRef.current before doing anything, so
  // touches before the model is ready are harmlessly ignored.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rotateStartAngle: number | null = null;
    let rotateStartRotationZ = 0;

    // Angle (radians) of the line connecting the two touch points, in
    // screen space — tracking the CHANGE in this angle (rather than the
    // midpoint's movement) is what makes this a "twist": rotating your two
    // fingers relative to each other, like turning a dial, is what spins
    // the model. Matches the same gesture used in WebXRPlacementViewer.
    function twoTouchAngle(touches: TouchList): number {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.atan2(dy, dx);
    }

    function onTouchStart(e: TouchEvent) {
      if (e.touches.length === 2 && spinGroupRef.current) {
        e.preventDefault();
        rotateStartAngle = twoTouchAngle(e.touches);
        rotateStartRotationZ = spinGroupRef.current.rotation.z;
      }
    }

    function onTouchMove(e: TouchEvent) {
      if (rotateStartAngle !== null && e.touches.length === 2 && spinGroupRef.current) {
        e.preventDefault();
        const currentAngle = twoTouchAngle(e.touches);
        // Sign flip for the same reason as the WebXR path: a clockwise
        // twist, as seen face-on looking at the marker, should turn the
        // model in the negative-angle direction under Three.js's
        // right-handed convention for rotation about the anchor's Z axis.
        const deltaAngle = -(currentAngle - rotateStartAngle);
        spinGroupRef.current.rotation.z = rotateStartRotationZ + deltaAngle;
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        rotateStartAngle = null;
      }
    }

    container.addEventListener("touchstart", onTouchStart, { passive: false });
    container.addEventListener("touchmove", onTouchMove, { passive: false });
    container.addEventListener("touchend", onTouchEnd, { passive: false });
    container.addEventListener("touchcancel", onTouchEnd, { passive: false });

    return () => {
      container.removeEventListener("touchstart", onTouchStart);
      container.removeEventListener("touchmove", onTouchMove);
      container.removeEventListener("touchend", onTouchEnd);
      container.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

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
      {/*
        Forces correct layering for the <video> and <canvas> elements MindAR
        injects into the container below. Without this, the camera feed can
        render as solid black even though tracking works fine — the video
        needs to sit behind a fully transparent canvas, sized to fill its
        parent, regardless of any global stylesheet defaults for video/canvas
        elements elsewhere in the app.
      */}
      <style>{`
        .mindar-container { position: relative; width: 100%; height: 100%; touch-action: none; }
        .mindar-container video {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          z-index: 0 !important;
          opacity: 1 !important;
          visibility: visible !important;
          display: block !important;
        }
        .mindar-container canvas {
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          width: 100% !important;
          height: 100% !important;
          z-index: 1 !important;
          background: transparent !important;
        }
      `}</style>

      <div ref={containerRef} className="mindar-container" />

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

      {phase === "found" && (
        <div style={{ ...coachStyle, top: "auto", bottom: "10%" }}>
          <span style={{ color: T.muted, fontSize: "0.82rem" }}>
            Twist two fingers to spin the dish.
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