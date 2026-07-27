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
 *      result does). Also run a hit test from the 'viewer' reference space.
 *      Before a model is placed, the reticle tracks that live hit test (in
 *      the 'local' reference space) so the user can see where a tap would
 *      place the model. Once a model IS placed, the reticle stops following
 *      the camera's aim and instead pins itself directly under the placed
 *      model at all times (see step 3/5) — the live hit test keeps running
 *      internally so a re-tap still works, it just no longer drives the
 *      reticle's visual position while something is already placed.
 *   3. On a WebXR 'select' event (the user's tap), place the model at the
 *      current live hit-test result and stop moving it — this is the
 *      explicit "tap to place" step model-viewer doesn't offer.
 *   4. After placement, the user can tap again to re-place, matching the
 *      common "tap elsewhere to move it" pattern.
 *   5. After placement, the user can also press-and-drag on the surface to
 *      slide the model around continuously, using a transient-input hit
 *      test tied to the active touch point (see onSelectStart/onSelectEnd
 *      and the drag block in the animation loop below). The reticle follows
 *      along underneath it since it's pinned to the model's position.
 *   6. Model scale is fixed: it's computed once when the GLB finishes
 *      loading (normalized to a real-world target size, then multiplied by
 *      the `modelScale` prop) and never changes afterward — there is no
 *      in-session pinch/resize gesture, intentionally, so the model always
 *      reads at a single, predictable size.
 *   7. Surface detection has two layers: the native WebXR hit test (now
 *      requested against both planes AND point-cloud features, so it can
 *      succeed before ARCore/ARKit has committed to a full plane polygon),
 *      plus a manual Three.js raycast fallback against the plane meshes
 *      we've already built from plane-detection, used only on frames where
 *      the native hit test comes back empty. This meaningfully reduces
 *      "reticle disappears for a moment" gaps before anything is placed.
 *   8. An optional flashlight/torch toggle is available once the session is
 *      active. WebXR itself has no standard API for this — it works around
 *      that by opening a separate getUserMedia stream purely to reach the
 *      MediaStreamTrack torch constraint on the same physical camera
 *      hardware. The stream explicitly requests the rear-facing camera
 *      (falling back gracefully if the browser doesn't support an exact
 *      match), re-acquires the track if it ever ends, and tries both known
 *      forms of the torch constraint before giving up — see
 *      acquireFlashlightTrack/applyTorch below. Best-effort: hidden
 *      automatically if a real attempt fails.
 *   9. A "Use Scene Viewer instead" button is available throughout the
 *      active session (not just on error/unsupported states) so the user
 *      can voluntarily switch away from WebXR even when it's working fine.
 *      It's centered on screen and, when pressed, ends the current WebXR
 *      session and calls straight into onFallbackToSceneViewer — no
 *      intermediate confirmation step.
 *
 * Note on speed: the actual scan/tracking speed is governed by ARCore's own
 * SLAM pipeline, which this component only reads from each frame — there's
 * no parameter here that makes the underlying scan itself faster. What this
 * does improve is *perceived* speed and clarity, by showing scan progress
 * (detected planes) as soon as it exists, rather than leaving the user
 * staring at a blank camera feed with no feedback until a hit-test succeeds.
 *
 * Entry flow: this component auto-starts the XR session as soon as support
 * is confirmed, reusing the user-activation from whatever click/tap sent the
 * user here (e.g. SceneViewer's "View in AR" button) — no second "Start AR"
 * button is shown on entry. A manual "Enter AR" button only reappears as a
 * fallback if that reused activation isn't accepted (NotAllowedError) or
 * after a session ends, since re-entering AR at that point requires a fresh
 * tap per the WebXR spec's transient-activation requirement.
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
  /** Called when the user wants to bail out of WebXR to model-viewer's Scene Viewer / Quick Look path instead. */
  onFallbackToSceneViewer?: () => void;
  /** Uniform scale applied to the loaded model. Fixed for the whole session — defaults to 1 (real-world scale). */
  modelScale?: number;
  /**
   * Opt-in only. Enables the in-session flashlight/torch toggle, which works
   * by opening a SECOND getUserMedia camera stream alongside the WebXR
   * session purely to reach the torch constraint. On hardware where the
   * camera driver only supports one client at a time, doing this doesn't
   * just glitch — it can crash the entire browser tab, because the failure
   * happens below the JS layer (in the OS/driver's camera pipeline), where
   * no try/catch can intervene. Defaults to false. Only enable this if
   * you've verified it's stable on the specific devices you're targeting.
   */
  experimentalInSessionFlashlight?: boolean;
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

// Builds a single rounded-square outline path (used both for the reticle's
// outer edge and, at a smaller size, its inner edge to form a "frame").
function traceRoundedSquare(path: THREE.Path | THREE.Shape, half: number, cornerRadius: number) {
  const h = half;
  const r = Math.min(cornerRadius, half);
  path.moveTo(-h + r, -h);
  path.lineTo(h - r, -h);
  path.absarc(h - r, -h + r, r, -Math.PI / 2, 0, false);
  path.lineTo(h, h - r);
  path.absarc(h - r, h - r, r, 0, Math.PI / 2, false);
  path.lineTo(-h + r, h);
  path.absarc(-h + r, h - r, r, Math.PI / 2, Math.PI, false);
  path.lineTo(-h, -h + r);
  path.absarc(-h + r, -h + r, r, Math.PI, Math.PI * 1.5, false);
}

// A flat "frame" (square annulus with rounded corners) geometry, replacing
// the plain RingGeometry the reticle used to use. Built the same way a
// washer/annulus shape would be: an outer rounded-square boundary with an
// inner rounded-square hole cut out of it.
function createRoundedSquareRingGeometry(outerHalf: number, innerHalf: number, cornerRadius: number) {
  const shape = new THREE.Shape();
  traceRoundedSquare(shape, outerHalf, cornerRadius);

  const hole = new THREE.Path();
  const innerCornerRadius = cornerRadius * (innerHalf / outerHalf);
  traceRoundedSquare(hole, innerHalf, innerCornerRadius);
  shape.holes.push(hole);

  return new THREE.ShapeGeometry(shape);
}

export function WebXRPlacementViewer({
  glbUrl,
  name,
  onExit,
  onFallbackToSceneViewer,
  modelScale = 1,
  experimentalInSessionFlashlight = true,
}: WebXRPlacementViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const flashlightTrackRef = useRef<MediaStreamTrack | null>(null);
  // Prevents a second tap from firing a second, overlapping
  // acquire/apply-constraints sequence while the first is still in flight —
  // on hardware where the flashlight stream and the AR camera contend for
  // the same physical camera, two overlapping attempts is what was causing
  // the "second tap does nothing / crashes" behavior.
  const flashlightBusyRef = useRef(false);
  const [phase, setPhase] = useState<SessionPhase>("checking-support");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domOverlaySupported, setDomOverlaySupported] = useState(true);
  const [flashlightOn, setFlashlightOn] = useState(false);
  // Optimistically true until a real attempt fails — there's no reliable way
  // to feature-detect torch support up front (getSupportedConstraints()
  // often omits "torch" even on devices where applyConstraints({torch})
  // does work), so the button is shown by default and only hidden after an
  // actual failed attempt.
  const [flashlightSupported, setFlashlightSupported] = useState(true);

  // WebXR's immersive-ar sessions manage their own internal camera pipeline
  // — there's no standard WebXR API to control torch/flashlight during an
  // active session. This works around that by opening a *separate*
  // getUserMedia camera stream purely to reach the MediaStreamTrack torch
  // constraint on the same physical camera hardware. This is a best-effort
  // workaround, not a guaranteed-supported path.
  //
  // IMPORTANT CAVEAT: on some devices/drivers, the camera hardware only
  // tolerates ONE active client at a time. ARCore already holds the camera
  // for the WebXR session, so opening a second getUserMedia stream on top
  // of it can cause the OS to forcibly kill one of the two streams a moment
  // later — which looks like "the flashlight turns off by itself and the
  // camera briefly glitches," or on some devices, crashes the tab entirely.
  // That crash happens below the JS layer (in the OS/driver's camera
  // pipeline), so no try/catch can protect against it once it happens.
  //
  // The one lever we DO have is acquisition ORDER. Rather than opening the
  // flashlight stream lazily on first tap (mid-session, after ARCore
  // already holds the camera exclusively — the ordering that was crashing
  // the tab), we now acquire it once, up front, BEFORE requesting the
  // immersive-ar session at all (see requestSessionWithPreacquiredFlashlight
  // below). Some camera HALs allow a *second* client (WebXR) in after we
  // already hold the first slot, even when the reverse order fails — this
  // is not guaranteed, but it's a genuinely different failure mode worth
  // trying. If requestSession itself fails with our stream open, we
  // release it and retry without flashlight rather than let AR itself be
  // blocked by this experiment.
  //
  // Because of that, toggleFlashlight below deliberately does NOT try to
  // re-acquire the stream if it's missing mid-session — that mid-session
  // acquisition is exactly the operation we're trying to avoid. If the
  // pre-acquired track ever dies, we just mark flashlight unavailable for
  // the rest of the session instead of trying again.
  //
  // Two more things that previously made this unreliable, both addressed:
  //  - Without an *exact* facingMode match, some devices silently handed
  //    back the FRONT camera (which has no torch), so capabilities.torch
  //    came back false even on phones that do have one. We now request an
  //    exact rear-facing camera first and only fall back to a loose match
  //    if the exact request itself fails.
  //  - The torch constraint is applied inconsistently across browsers: some
  //    only accept it wrapped in `advanced`, others want it set directly.
  //    We now try both forms instead of assuming one.

  async function acquireFlashlightTrack(): Promise<MediaStreamTrack | null> {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: "environment" } },
      });
    } catch {
      // Browser/device doesn't support an exact match for facingMode —
      // fall back to a best-effort request for a rear-ish camera.
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
      });
    }
    const track = stream.getVideoTracks()[0] ?? null;
    if (track) {
      // If the OS/driver kills this track out from under us (typically
      // because the AR session's camera claim won the contention), notice
      // right away and mark flashlight unavailable — we deliberately do
      // NOT try to re-acquire mid-session (see the caveat above), so this
      // is treated as a hard stop for the rest of the session, not a
      // transient blip to recover from.
      const handleHardwareStop = () => {
        if (flashlightTrackRef.current === track) {
          flashlightTrackRef.current = null;
        }
        setFlashlightOn(false);
        setFlashlightSupported(false);
      };
      track.addEventListener("ended", handleHardwareStop);
      track.addEventListener("mute", handleHardwareStop);
    }
    return track;
  }

  async function applyTorch(track: MediaStreamTrack, on: boolean) {
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: on }] });
    } catch {
      // Some implementations don't accept the `advanced` wrapper — retry
      // with the constraint set directly before treating this as a failure.
      await (track as any).applyConstraints({ torch: on });
    }
  }

  async function toggleFlashlight() {
    // Re-entrancy guard: ignore a tap if a previous apply is still in
    // flight, instead of letting two overlapping attempts race against the
    // same camera hardware.
    if (flashlightBusyRef.current) return;
    flashlightBusyRef.current = true;

    try {
      const track = flashlightTrackRef.current;
      // No mid-session re-acquisition here on purpose — see the caveat
      // above. If the pre-acquired track is missing or dead, flashlight is
      // simply unavailable for the rest of this session.
      if (!track || track.readyState !== "live") {
        setFlashlightSupported(false);
        return;
      }

      const next = !flashlightOn;
      await applyTorch(track, next);
      setFlashlightOn(next);
    } catch {
      // A failed apply here most likely means the camera is contended and
      // this device can't reliably run both streams at once. Give up for
      // the rest of the session rather than leaving a control the user can
      // keep tapping into the same failure.
      flashlightTrackRef.current?.stop();
      flashlightTrackRef.current = null;
      setFlashlightOn(false);
      setFlashlightSupported(false);
    } finally {
      flashlightBusyRef.current = false;
    }
  }

  function stopFlashlight() {
    if (flashlightTrackRef.current) {
      flashlightTrackRef.current.stop();
      flashlightTrackRef.current = null;
    }
    flashlightBusyRef.current = false;
    setFlashlightOn(false);
  }

  // Grabs a torch-capable camera track BEFORE requesting the immersive-ar
  // session, then requests the session with that stream still open. If the
  // session request itself fails (plausibly because our stream is still
  // holding the camera the HAL would otherwise hand to WebXR), the
  // flashlight stream is released and the session is requested again
  // without it — flashlight is an experiment, AR itself is not allowed to
  // be blocked by it.
  async function requestSessionWithPreacquiredFlashlight(
    xr: any,
    sessionInit: any
  ): Promise<XRSession> {
    let track: MediaStreamTrack | null = null;
    try {
      track = await acquireFlashlightTrack();
      if (track) {
        const capabilities: any = track.getCapabilities?.() ?? {};
        if (!capabilities.torch) {
          track.stop();
          track = null;
          setFlashlightSupported(false);
        }
      } else {
        setFlashlightSupported(false);
      }
    } catch {
      track = null;
      setFlashlightSupported(false);
    }

    try {
      const session: XRSession = await xr.requestSession("immersive-ar", sessionInit);
      // Session came up fine even with our stream open — keep the track
      // around so toggleFlashlight can use it directly. No further
      // getUserMedia calls will happen during this session.
      flashlightTrackRef.current = track;
      return session;
    } catch (err) {
      if (track) {
        track.stop();
        setFlashlightSupported(false);
      }
      // Retry once without the flashlight stream open, so this experiment
      // can't be the reason AR fails to start at all.
      return xr.requestSession("immersive-ar", sessionInit);
    }
  }

  // --- Feature-detect WebXR + hit-test support, then go straight into AR ---
  // No intermediate "Start AR" tap here: the click that navigated the user
  // into this component (e.g. SceneViewer's "View in AR" button) is the
  // activation we ride on. If requestSession rejects because that
  // activation didn't carry over (NotAllowedError), startSession() below
  // falls back to phase "idle", which does show a manual button — that's
  // the one unavoidable case where a second tap is required.
  useEffect(() => {
    let cancelled = false;

    async function checkSupportAndStart() {
      if (!("xr" in navigator)) {
        if (!cancelled) setPhase("unsupported");
        return;
      }
      try {
        const supported = await (navigator as any).xr.isSessionSupported("immersive-ar");
        if (cancelled) return;
        if (supported) {
          startSession();
        } else {
          setPhase("unsupported");
        }
      } catch {
        if (!cancelled) setPhase("unsupported");
      }
    }

    checkSupportAndStart();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      const session: XRSession = experimentalInSessionFlashlight
        ? await requestSessionWithPreacquiredFlashlight(xr, sessionInit)
        : await xr.requestSession("immersive-ar", sessionInit);
      sessionRef.current = session;

      // dom-overlay was optional — if it didn't activate, domOverlayState will
      // be absent and our coaching UI won't be available during the session.
      setDomOverlaySupported(Boolean((session as any).domOverlayState));

      await runArSession(session);
    } catch (err: any) {
      if (err?.name === "NotAllowedError") {
        // Most likely cause here: the transient user-activation from the
        // originating click didn't carry over to this requestSession call.
        // Fall back to a manual button so the user's next tap supplies a
        // fresh activation.
        setPhase("idle");
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

    // Reticle: a rounded-square "frame" outline + small axis indicator,
    // hidden until a hit is found. Before placement it tracks the live hit
    // test; once a model is placed it stops tracking the camera's aim and
    // instead pins itself directly under the placed model (updated below,
    // in the animation loop) so it always shows exactly where the model
    // currently sits.
    const reticleGeometry = createRoundedSquareRingGeometry(0.09, 0.07, 0.03).rotateX(-Math.PI / 2);
    const reticleMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const reticle = new THREE.Mesh(reticleGeometry, reticleMaterial);
    reticle.matrixAutoUpdate = false;
    reticle.visible = false;
    scene.add(reticle);

    // Detected-plane visualization: one semi-transparent mesh per XRPlane,
    // rebuilt whenever its polygon changes. This is what actually shows the
    // user "the environment as it's scanned" — distinct from the reticle,
    // which only shows where the model *would* go (or currently is). Planes
    // typically appear faster than a clean hit-test result does, so this
    // also gives earlier visual feedback that scanning is working. These
    // stay visible even after the model is placed.
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
    // to the current hit-test result right after a drag.
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

      // Scale is computed once here and never touched again for the rest of
      // the session — there's no pinch/resize gesture, so the model always
      // renders at this same fixed size.
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
        `Fixed scale: ${pivot.scale.x.toFixed(4)}`
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
    // entityTypes: hit-test against point-cloud features as well as full
    // planes, not just planes alone. ARCore/ARKit often have usable depth
    // points on a surface before they've built up enough data to commit to
    // a full plane polygon — testing against points too means the live hit
    // test (and therefore placement) can succeed earlier, before a plane
    // exists.
    const hitTestSource = await (session as any).requestHitTestSource({
      space: viewerSpace,
      entityTypes: ["plane", "point"],
    });
    // Transient-input hit test source: gives a per-touch-point hit test each
    // frame, independent of the viewer-center hit test above. This is what
    // powers press-and-drag — the model follows whichever finger is down,
    // not just the center of the screen.
    const transientHitTestSource = await (session as any).requestHitTestSourceForTransientInput({
      profile: "generic-touchscreen",
    });

    setPhase("active-searching");

    // Reused every frame for the native + fallback hit test, so placement
    // (onSelect) always has the latest live result to work with — even
    // though, once a model exists, the *visual* reticle no longer shows
    // this and instead pins itself under the placed model (see the
    // animation loop below).
    const hitMatrix = new THREE.Matrix4();
    let hitValid = false;

    function onSelect() {
      // A drag just ended on this same press — the model has already been
      // moved continuously to follow the finger, so skip the normal
      // tap-to-(re)place logic below to avoid an extra jump to the current
      // hit-test result right after a drag.
      if (dragOccurred) {
        dragOccurred = false;
        return;
      }

      if (!hitValid) return;
      if (!modelLoaded || !pendingModel) {
        console.warn("[WebXRPlacementViewer] Tap before model ready — should not happen now.");
        return;
      }

      if (!placedModel) {
        placedModel = pendingModel;
        scene.add(placedModel);
      }

      // Only copy position from the live hit-test result — not orientation.
      // The pivot group already has a corrective inverse quaternion baked in
      // to cancel the root node's arbitrary rotation. Overwriting it with
      // the hit pose's orientation (which encodes the floor normal, not the
      // model's up-axis) would undo that correction and tilt the model again.
      placedModel.position.setFromMatrixPosition(hitMatrix);
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
      stopFlashlight();
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
      // Session ended (user backed out via the system AR UI, or we called
      // endSession() ourselves). Re-entering AR from here requires a fresh
      // tap, so land on "idle" rather than auto-restarting.
      setPhase("idle");
    }
    session.addEventListener("end", onSessionEnd);

    // Reused every frame for the raycast fallback below, to avoid
    // allocating new THREE objects 60 times a second.
    const fallbackRaycaster = new THREE.Raycaster();
    const fallbackViewerMatrix = new THREE.Matrix4();
    const fallbackOrigin = new THREE.Vector3();
    const fallbackDirection = new THREE.Vector3();

    renderer.setAnimationLoop((_time, frame: any) => {
      if (!frame) return;

      // Everything below reads live XR frame data, which can throw
      // transiently if the underlying camera pipeline hiccups (for example,
      // from contention with the separate flashlight getUserMedia stream —
      // see toggleFlashlight above). Without this try/catch, one bad frame
      // would throw out of setAnimationLoop's callback and permanently stop
      // the loop, which is what "the camera stops working" looks like from
      // the outside. Catching here just skips the bad frame and tries
      // again next frame instead.
      try {
        runFrame(frame);
      } catch (err) {
        console.warn("[WebXRPlacementViewer] Skipped a frame after an error:", err);
      }
    });

    function runFrame(frame: any) {
      const viewerPose = frame.getViewerPose(localSpace);

      syncPlaneMeshes(frame, localSpace);

      // --- Live hit test (always computed, drives placement) ---
      hitValid = false;
      if (hitTestSource && viewerPose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localSpace);
          if (pose) {
            hitMatrix.fromArray(pose.transform.matrix);
            hitValid = true;
          }
        }
      }

      // Fallback: the native hit test can occasionally miss for a frame or
      // two even though a plane has already been detected right where the
      // user is looking (e.g. near a plane's edge, or just ARCore's own
      // internal update cadence). Rather than treat the hit as missing and
      // waiting, raycast against the plane meshes we already have from
      // plane-detection instead — this measurably reduces gaps, using data
      // that's already on hand, without waiting on the next native
      // hit-test result.
      if (!hitValid && viewerPose && planeMeshes.size > 0) {
        fallbackViewerMatrix.fromArray(viewerPose.transform.matrix);
        fallbackOrigin.setFromMatrixPosition(fallbackViewerMatrix);
        fallbackDirection.set(0, 0, -1).transformDirection(fallbackViewerMatrix);
        fallbackRaycaster.set(fallbackOrigin, fallbackDirection);

        const intersections = fallbackRaycaster.intersectObjects(Array.from(planeMeshes.values()), false);
        if (intersections.length > 0) {
          const hit = intersections[0];
          const planeMesh = hit.object as THREE.Mesh;
          const tempQuat = new THREE.Quaternion().setFromRotationMatrix(planeMesh.matrix);
          hitMatrix.compose(hit.point, tempQuat, new THREE.Vector3(1, 1, 1));
          hitValid = true;
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

      // --- Reticle: tracks the live hit test before placement; once a
      // model is placed, it's pinned directly under that model instead
      // (so it stays fixed to the model rather than following where the
      // camera happens to be pointed). ---
      if (placedModel) {
        reticle.matrix.makeTranslation(
          placedModel.position.x,
          placedModel.position.y,
          placedModel.position.z
        );
        reticle.visible = true;
      } else if (hitValid) {
        reticle.matrix.copy(hitMatrix);
        reticle.visible = true;
      } else {
        reticle.visible = false;
      }

      renderer.render(scene, camera);
    }
  }

  function endSession() {
    sessionRef.current?.end();
  }

  useEffect(() => {
    return () => {
      sessionRef.current?.end();
      flashlightTrackRef.current?.stop();
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
          session, so the same JSX covers both states. The container itself
          doesn't need to capture touches anymore (there's no in-session
          pinch/resize gesture), so it's pointer-events: none by default —
          individual buttons opt back in to "auto" so they stay clickable. */}
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
            pointerEvents: "none",
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

        {/* Flashlight toggle — off by default (see experimentalInSessionFlashlight
            on the component's props). Opening a second camera stream
            alongside the WebXR session to reach the torch constraint can
            crash the entire tab on hardware where the camera driver only
            supports one client at a time — that failure happens below the
            JS layer, so no amount of try/catch here can prevent it. Only
            rendered when the caller has explicitly opted in after verifying
            it's stable on their target devices. */}
        {experimentalInSessionFlashlight &&
          (phase === "active-searching" || phase === "active-placed") &&
          flashlightSupported && (
          <button
            onClick={toggleFlashlight}
            aria-label={flashlightOn ? "Turn off flashlight" : "Turn on flashlight"}
            style={{
              position: "absolute",
              top: "1.2rem",
              left: "1.2rem",
              background: flashlightOn ? T.accent : "rgba(13,26,31,0.75)",
              color: flashlightOn ? "#1a1410" : T.text,
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              width: 36,
              height: 36,
              fontSize: "1.05rem",
              cursor: "pointer",
              pointerEvents: "auto",
            }}
          >
            🔦
          </button>
        )}

        {/* Lets the user voluntarily switch to Scene Viewer / Quick Look
            even while WebXR is working fine — not just as an error
            fallback (see the phase === "unsupported"/"denied"/"error"
            buttons further down, which cover the case where WebXR *isn't*
            working). Centered on screen, and pressing it ends the current
            session and calls straight into onFallbackToSceneViewer with no
            intermediate step. */}
        {(phase === "active-searching" || phase === "active-placed") && onFallbackToSceneViewer && (
          <button
            onClick={() => {
              endSession();
              onFallbackToSceneViewer();
            }}
            style={{
              position: "absolute",
              top: "4.2rem",
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(13,26,31,0.75)",
              color: T.muted,
              border: `1px solid ${T.border}`,
              borderRadius: 999,
              padding: "0.4rem 0.8rem",
              fontSize: "0.72rem",
              cursor: "pointer",
              pointerEvents: "auto",
              whiteSpace: "nowrap",
            }}
          >
            Use Scene Viewer instead
          </button>
        )}

        {phase === "active-searching" && (
          <div style={{ ...coachStyle, pointerEvents: "none" }}>
            <span style={{ fontWeight: 700, color: T.accent }}>Move your phone slowly</span>
            <span style={{ color: T.muted, fontSize: "0.82rem" }}>
              Green highlights show surfaces found so far — tap one to place.
            </span>
            <span style={{ color: T.muted, fontSize: "0.72rem", opacity: 0.75, marginTop: "0.15rem" }}>
              Too dark to scan? Your phone's flashlight is locked while AR is
              active — try moving to a brighter spot instead.
            </span>
          </div>
        )}

        {phase === "active-placed" && (
          <div style={{ ...coachStyle, top: "auto", bottom: "16%", pointerEvents: "none" }}>
            <span style={{ color: T.muted, fontSize: "0.82rem" }}>
              Tap elsewhere to move it, or drag to slide it.
            </span>
          </div>
        )}

        {phase === "active-searching" && !domOverlaySupported && (
          <div style={{ ...coachStyle, top: "auto", bottom: "30%", pointerEvents: "none" }}>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              This browser doesn't support WebXR AR. Try Chrome on a recent
              Android phone.
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0.6rem 1.4rem",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Try Scene Viewer instead
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "idle" && (
        <div style={overlayStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
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
              Enter AR
            </button>
            <span style={{ color: T.muted, fontSize: "0.75rem", textAlign: "center", padding: "0 2rem", opacity: 0.8 }}>
              Scanning in a dark room? Turn on your phone's flashlight now —
              it locks off once AR starts and can't be toggled mid-session.
            </span>
          </div>
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
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              Camera access is needed for AR. Please allow camera permissions and try again.
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0.6rem 1.4rem",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Try Scene Viewer instead
              </button>
            )}
          </div>
        </div>
      )}

      {phase === "error" && (
        <div style={overlayStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: "#f87171", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              {errorMessage}
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0.6rem 1.4rem",
                  fontWeight: 700,
                  fontSize: "0.9rem",
                  cursor: "pointer",
                }}
              >
                Try Scene Viewer instead
              </button>
            )}
          </div>
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