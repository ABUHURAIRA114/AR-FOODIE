import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { T } from "./tokens.mts";

/**
 * WebXRPlacementViewer
 * ---------------------------------------------------------------------------
 * A from-scratch WebXR AR session using the Hit Test API directly, giving a
 * true "reticle + tap to place" flow — distinct from <model-viewer>'s AR,
 * which auto-places the model the instant a surface is found and only lets
 * the user drag to adjust afterward. model-viewer does not expose a hook to
 * intercept that and wait for an explicit tap (confirmed: no public API for
 * this — see github.com/google/model-viewer/discussions/4272), so this
 * bypasses model-viewer's AR system entirely and talks to WebXR directly.
 *
 * Flow:
 *   1. Request an 'immersive-ar' session with 'hit-test' required and
 *      'dom-overlay' + 'plane-detection' optional.
 *   2. Each frame, sync detected XRPlanes to translucent green meshes so the
 *      user can see what's been scanned so far (plane-detection is additive
 *      to hit-test — it doesn't speed up ARCore's own scan, but it surfaces
 *      progress sooner, since planes often appear before a clean hit-test
 *      result does). Also run a hit test from the 'viewer' reference space
 *      and move a reticle to the first result's pose, rendered in the
 *      'local' reference space.
 *   3. On a WebXR 'select' event (the user's tap), place the model at the
 *      reticle's current pose and stop moving it — this is the explicit
 *      "tap to place" step model-viewer doesn't offer.
 *   4. After placement, the user can tap again to re-place, matching the
 *      common "tap elsewhere to move it" pattern. Plane visualization fades
 *      out once placed, to declutter the view.
 *   5. After placement, the user can also press-and-drag on the surface to
 *      slide the model around continuously, using a transient-input hit
 *      test tied to the active touch point (see onSelectStart/onSelectEnd
 *      and the drag block in the animation loop below).
 *
 * Note on speed: the actual scan/tracking speed is governed by ARCore's own
 * SLAM pipeline, which this component only reads from each frame — there's
 * no parameter here that makes the underlying scan itself faster. What this
 * does improve is *perceived* speed and clarity, by showing scan progress
 * (detected planes) as soon as it exists, rather than leaving the user
 * staring at a blank camera feed with no feedback until a hit-test succeeds.
 *
 * Requires:
 *  - HTTPS (a secure context, same requirement as model-viewer's WebXR path)
 *  - A WebXR-capable browser (effectively Chrome on Android with ARCore;
 *    iOS Safari does not support the WebXR Device API for AR as of this
 *    writing — verify current support before relying on this as iOS's
 *    primary path)
 */

interface WebXRPlacementViewerProps {
  glbUrl: string;
  name: string;
  onExit?: () => void;
  /** Uniform scale applied to the loaded model. Defaults to 1 (real-world scale). */
  modelScale?: number;
}

type SessionPhase =
  | "checking-support"
  | "unsupported"
  | "idle"
  | "requesting"
  | "denied"
  | "active-loading"   // XR session started, GLB still downloading
  | "active-searching" // GLB ready, scanning for surfaces
  | "active-placed"
  | "error";

export function WebXRPlacementViewer({
  glbUrl,
  name,
  onExit,
  modelScale = 1,
}: WebXRPlacementViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("checking-support");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domOverlaySupported, setDomOverlaySupported] = useState(true);

  // --- Feature-detect WebXR + hit-test support up front ---
  useEffect(() => {
    let cancelled = false;

    async function checkSupport() {
      if (!("xr" in navigator)) {
        if (!cancelled) setPhase("unsupported");
        return;
      }
      try {
        const supported = await (navigator as any).xr.isSessionSupported("immersive-ar");
        if (cancelled) return;
        setPhase(supported ? "idle" : "unsupported");
      } catch {
        if (!cancelled) setPhase("unsupported");
      }
    }

    checkSupport();
    return () => {
      cancelled = true;
    };
  }, []);

  async function startSession() {
    if (!containerRef.current) return;
    setPhase("requesting");
    setErrorMessage(null);

    try {
      const xr = (navigator as any).xr;

      const sessionInit: any = {
        requiredFeatures: ["local", "hit-test"],
        optionalFeatures: ["dom-overlay", "plane-detection"],
      };
      if (overlayRef.current) {
        sessionInit.domOverlay = { root: overlayRef.current };
      }

      const session: XRSession = await xr.requestSession("immersive-ar", sessionInit);
      sessionRef.current = session;

      // dom-overlay was optional — if it didn't activate, domOverlayState will
      // be absent and our coaching UI won't be visible during the session.
      setDomOverlaySupported(Boolean((session as any).domOverlayState));

      await runArSession(session);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        setPhase("denied");
      } else {
        setPhase("error");
        setErrorMessage("Couldn't start AR on this device.");
      }
    }
  }

  async function runArSession(session: XRSession) {
    const container = containerRef.current!;

    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    // Basic lighting — there's no light estimation here (that's a separate,
    // optional WebXR feature this component doesn't request), so a simple
    // fixed rig keeps the model visible and reasonably shaded.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 1.2));
    const dirLight = new THREE.DirectionalLight(0xffffff, 0.9);
    dirLight.position.set(0.5, 1, 0.5);
    scene.add(dirLight);

    // Reticle: a simple ring + small axis indicator, hidden until a hit is found.
    const reticleGeometry = new THREE.RingGeometry(0.07, 0.09, 32).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Detected-plane visualization: one semi-transparent mesh per XRPlane,
    // rebuilt whenever its polygon changes. This is what actually shows the
    // user "the environment as it's scanned" — distinct from the reticle,
    // which only shows where the model *would* go. Planes typically appear
    // faster than a clean hit-test result does, so this also gives earlier
    // visual feedback that scanning is working.
    const planeMeshes = new Map<XRPlane, THREE.Mesh>();
    const planeMaterial = new THREE.MeshBasicMaterial({
      color: 0x4ade80,
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
    });

    function buildPlaneGeometry(plane: XRPlane): THREE.BufferGeometry {
      const points = plane.polygon; // array of {x, y, z}, in plane-local space (y ~ 0)
      const shape = new THREE.Shape(points.map((p: any) => new THREE.Vector2(p.x, p.z)));
      const geometry = new THREE.ShapeGeometry(shape);
      // ShapeGeometry is built in the XY plane; rotate it flat to match the
      // detected plane's own local XZ orientation before applying its pose.
      geometry.rotateX(-Math.PI / 2);
      return geometry;
    }

    function syncPlaneMeshes(frame: any, localSpace: XRReferenceSpace) {
      const detectedPlanes: Set<XRPlane> | undefined = frame.detectedPlanes;
      if (!detectedPlanes) return; // plane-detection wasn't granted — silently skip

      // Remove meshes for planes no longer detected.
      for (const [plane, mesh] of planeMeshes) {
        if (!detectedPlanes.has(plane)) {
          scene.remove(mesh);
          mesh.geometry.dispose();
          planeMeshes.delete(plane);
        }
      }

      // Add/update meshes for currently detected planes.
      for (const plane of detectedPlanes) {
        const pose = frame.getPose(plane.planeSpace, localSpace);
        if (!pose) continue;

        let mesh = planeMeshes.get(plane);
        const lastChanged = (plane as any).lastChangedTime;

        if (!mesh) {
          mesh = new THREE.Mesh(buildPlaneGeometry(plane), planeMaterial);
          mesh.matrixAutoUpdate = false;
          (mesh as any)._lastChangedTime = lastChanged;
          planeMeshes.set(plane, mesh);
          scene.add(mesh);
        } else if ((mesh as any)._lastChangedTime !== lastChanged) {
          // Polygon geometry changed (plane grew/merged) — rebuild it.
          mesh.geometry.dispose();
          mesh.geometry = buildPlaneGeometry(plane);
          (mesh as any)._lastChangedTime = lastChanged;
        }

        mesh.matrix.fromArray(pose.transform.matrix);
      }
    }

    let placedModel: THREE.Object3D | null = null;
    let modelLoaded = false;
    let pendingModel: THREE.Object3D | null = null;

    // --- Drag-to-move state ---
    // draggingInputSource tracks which XRInputSource (touch point) is
    // currently being held down over the placed model. dragOccurred is set
    // true the moment we actually move the model during that press, so the
    // subsequent 'select' event (which always fires on release, drag or not)
    // knows to skip its own re-placement logic instead of jumping the model
    // to the viewer-center reticle right after a drag.
    let draggingInputSource: XRInputSource | null = null;
    let dragOccurred = false;

    // Load the GLB BEFORE starting the XR session so:
    // 1. We know the model is ready before the user can tap
    // 2. Any CORS/network error surfaces before the camera opens
    // 3. The "active-loading" phase shows clearly in the pre-AR UI
    setPhase("active-loading");
    const dracoLoader = new DRACOLoader();
    // Draco WASM decoder — loaded from CDN so we don't have to copy the
    // decoder files into /public ourselves. This is the same CDN Three.js
    // uses in its own examples and is safe to use in production.
    dracoLoader.setDecoderPath("https://www.gstatic.com/draco/versioned/decoders/1.5.6/");
    dracoLoader.setDecoderConfig({ type: "wasm" });

    const loader = new GLTFLoader();
    loader.setDRACOLoader(dracoLoader);
    try {
      const gltf = await loader.loadAsync(glbUrl);
      const gltfScene = gltf.scene;

      // --- Fix 1: neutralise any baked root-node rotation ---
      const pivot = new THREE.Group();
      const rootQuaternion = gltfScene.quaternion.clone();
      pivot.quaternion.copy(rootQuaternion.invert());
      pivot.add(gltfScene);

      // --- Fix 2: correct bounding box computation ---
      pivot.updateWorldMatrix(true, true);
      const box = new THREE.Box3().setFromObject(pivot);
      const size = new THREE.Vector3();
      box.getSize(size);
      const largestDimension = Math.max(size.x, size.y, size.z);

      if (largestDimension > 0 && isFinite(largestDimension)) {
        const targetSize = 0.25;
        const normalizingScale = targetSize / largestDimension;
        pivot.scale.setScalar(normalizingScale * modelScale);
      } else {
        pivot.scale.setScalar(modelScale);
        console.warn("[WebXRPlacementViewer] Degenerate bounding box — using raw modelScale.");
      }

      // Re-center: model base sits at y=0 (the surface), horizontally centered
      box.setFromObject(pivot);
      const center = new THREE.Vector3();
      box.getCenter(center);
      gltfScene.position.x -= center.x / pivot.scale.x;
      gltfScene.position.z -= center.z / pivot.scale.z;
      gltfScene.position.y -= box.min.y / pivot.scale.y;

      pendingModel = pivot;
      modelLoaded = true;
      dracoLoader.dispose();

      console.log(
        "[WebXRPlacementViewer] Model ready.",
        `Size: ${size.x.toFixed(3)}×${size.y.toFixed(3)}×${size.z.toFixed(3)} m`,
        `Scale: ${pivot.scale.x.toFixed(4)}`
      );
    } catch (err: any) {
      dracoLoader.dispose();
      console.error("[WebXRPlacementViewer] GLB load failed:", err);
      // Surface the error with as much detail as possible so we know
      // immediately whether this is CORS, a 404, or a parse error.
      const isCors = err?.message?.toLowerCase().includes("cors") ||
                     err?.message?.toLowerCase().includes("failed to fetch") ||
                     err?.message?.toLowerCase().includes("network");
      setPhase("error");
      setErrorMessage(
        isCors
          ? "Couldn't load the 3D model — possible CORS issue. Check that your API server allows cross-origin requests for /media/ files."
          : `Couldn't load the 3D model. (${err?.message ?? "Unknown error"})`
      );
      return; // abort — don't open the XR session if we have no model
    }

    renderer.xr.setReferenceSpaceType("local");
    await renderer.xr.setSession(session);

    const viewerSpace = await session.requestReferenceSpace("viewer");
    const localSpace = await session.requestReferenceSpace("local");
    const hitTestSource = await (session as any).requestHitTestSource({ space: viewerSpace });
    // Transient-input hit test source: gives a per-touch-point hit test each
    // frame, independent of the viewer-center reticle above. This is what
    // powers press-and-drag — the model follows whichever finger is down,
    // not just the center of the screen.
    const transientHitTestSource = await (session as any).requestHitTestSourceForTransientInput({
      profile: "generic-touchscreen",
    });

    setPhase("active-searching");

    function onSelect() {
      // A drag just ended on this same press — the model has already been
      // moved continuously to follow the finger, so skip the normal
      // tap-to-(re)place logic below to avoid an extra jump to the
      // viewer-center reticle.
      if (dragOccurred) {
        dragOccurred = false;
        return;
      }

      if (!reticle.visible) return;
      if (!modelLoaded || !pendingModel) {
        console.warn("[WebXRPlacementViewer] Tap before model ready — should not happen now.");
        return;
      }

      if (!placedModel) {
        placedModel = pendingModel;
        scene.add(placedModel);
      }

      // Only copy position from the reticle pose — not quaternion.
      // The pivot group already has a corrective inverse quaternion baked in
      // to cancel the root node's arbitrary rotation. Overwriting it with
      // the reticle's orientation (which encodes the floor normal, not the
      // model's up-axis) would undo that correction and tilt the model again.
      placedModel.position.setFromMatrixPosition(reticle.matrix);
      setPhase("active-placed");

      // eslint-disable-next-line no-console
      console.log("[WebXRPlacementViewer] Placed model at", placedModel.position, "scale", placedModel.scale);
    }

    // Press-and-hold on the placed model starts a drag; releasing ends it.
    // Only armed once a model exists — before that, taps go through the
    // normal placement flow above instead.
    function onSelectStart(event: any) {
      if (placedModel) {
        draggingInputSource = event.inputSource;
      }
    }

    function onSelectEnd(event: any) {
      if (draggingInputSource === event.inputSource) {
        draggingInputSource = null;
      }
    }

    session.addEventListener("select", onSelect);
    session.addEventListener("selectstart", onSelectStart);
    session.addEventListener("selectend", onSelectEnd);

    function onSessionEnd() {
      session.removeEventListener("select", onSelect);
      session.removeEventListener("selectstart", onSelectStart);
      session.removeEventListener("selectend", onSelectEnd);
      hitTestSource?.cancel?.();
      transientHitTestSource?.cancel?.();
      renderer.setAnimationLoop(null);
      for (const mesh of planeMeshes.values()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      planeMeshes.clear();
      planeMaterial.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sessionRef.current = null;
      setPhase("idle");
    }
    session.addEventListener("end", onSessionEnd);

    renderer.setAnimationLoop((_time, frame: any) => {
      if (!frame) return;

      const viewerPose = frame.getViewerPose(localSpace);
      reticle.visible = false;

      syncPlaneMeshes(frame, localSpace);
      for (const mesh of planeMeshes.values()) {
        mesh.visible = !placedModel;
      }

      if (hitTestSource && viewerPose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localSpace);
          if (pose) {
            reticle.matrix.fromArray(pose.transform.matrix);
            // Only show the reticle (i.e. invite re-placement) before the
            // first placement — once placed, hide it so it doesn't look like
            // a second target is being offered. Remove this guard if you'd
            // rather always allow re-placement via the reticle.
            reticle.visible = !placedModel;
          }
        }
      }

      // Drag-to-move: while a press is active over the placed model, follow
      // that specific touch point's own hit test each frame so the model
      // slides along the surface under the finger.
      if (draggingInputSource && placedModel && transientHitTestSource) {
        const transientResults = frame.getHitTestResultsForTransientInput(transientHitTestSource);
        for (const result of transientResults) {
          if (result.inputSource === draggingInputSource && result.results.length > 0) {
            const pose = result.results[0].getPose(localSpace);
            if (pose) {
              placedModel.position.setFromMatrixPosition(
                new THREE.Matrix4().fromArray(pose.transform.matrix)
              );
              dragOccurred = true;
            }
          }
        }
      }

      renderer.render(scene, camera);
    });
  }

  function endSession() {
    sessionRef.current?.end();
  }

  useEffect(() => {
    return () => {
      sessionRef.current?.end();
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
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* This element becomes the WebXR DOM overlay once the session starts.
          It's also rendered normally (non-immersive) before/after the
          session, so the same JSX covers both states. */}
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            top: "1.2rem",
            left: "50%",
            transform: "translateX(-50%)",
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
            onClick={() => {
              endSession();
              onExit();
            }}
            style={{
              position: "absolute",
              top: "1.2rem",
              right: "1.2rem",
              background: "rgba(13,26,31,0.75)",
              color: T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              width: 36,
              height: 36,
              fontSize: "1rem",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
            aria-label="Exit AR"
          >
            ✕
          </button>
        )}

        {phase === "active-searching" && (
          <div style={coachStyle}>
            <span style={{ fontWeight: 700, color: T.accent }}>Move your phone slowly</span>
            <span style={{ color: T.muted, fontSize: "0.82rem" }}>
              Green highlights show surfaces found so far — tap one to place.
            </span>
          </div>
        )}

        {phase === "active-placed" && (
          <div style={{ ...coachStyle, top: "auto", bottom: "16%" }}>
            <span style={{ color: T.muted, fontSize: "0.82rem" }}>
              Tap elsewhere to move it, or press and drag to slide it.
            </span>
          </div>
        )}

        {phase === "active-searching" && !domOverlaySupported && (
          <div style={{ ...coachStyle, top: "auto", bottom: "30%" }}>
            <span style={{ color: "#f87171", fontSize: "0.78rem" }}>
              On-screen guidance isn't available in this browser — point at a
              flat surface and tap to place.
            </span>
          </div>
        )}
      </div>

      {phase === "checking-support" && (
        <div style={overlayStyle}>
          <span style={{ color: T.muted, fontSize: "0.9rem" }}>Checking AR support...</span>
        </div>
      )}

      {phase === "unsupported" && (
        <div style={overlayStyle}>
          <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
            This browser doesn't support WebXR AR. Try Chrome on a recent
            Android phone.
          </span>
        </div>
      )}

      {phase === "idle" && (
        <div style={overlayStyle}>
          <button
            onClick={startSession}
            style={{
              background: T.primary,
              color: "#fff",
              border: "none",
              borderRadius: 12,
              padding: "0.85rem 2.4rem",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 24px rgba(166,81,17,0.4)",
            }}
          >
            Start AR
          </button>
        </div>
      )}

      {phase === "active-loading" && (
        <div style={overlayStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.8rem" }}>
            <div style={{
              width: 36, height: 36, border: `3px solid ${T.border}`,
              borderTopColor: T.accent, borderRadius: "50%",
              animation: "xrSpin 0.8s linear infinite",
            }} />
            <span style={{ color: T.muted, fontSize: "0.9rem" }}>Loading 3D model...</span>
          </div>
        </div>
      )}

      {phase === "requesting" && (
        <div style={overlayStyle}>
          <span style={{ color: T.muted, fontSize: "0.9rem" }}>Starting AR session...</span>
        </div>
      )}

      {phase === "denied" && (
        <div style={overlayStyle}>
          <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
            Camera access is needed for AR. Please allow camera permissions and try again.
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

// Inject spinner keyframe once
if (typeof document !== "undefined" && !document.getElementById("xr-spinner-style")) {
  const s = document.createElement("style");
  s.id = "xr-spinner-style";
  s.textContent = "@keyframes xrSpin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}