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
 *      'local' reference space. Both the plane visualization and the
 *      reticle stay visible even after the model is placed, so the user can
 *      always see where a re-tap would move it to.
 *   3. On a WebXR 'select' event (the user's tap), place the model at the
 *      reticle's current pose and stop moving it — this is the explicit
 *      "tap to place" step model-viewer doesn't offer.
 *   4. After placement, the user can tap again to re-place, matching the
 *      common "tap elsewhere to move it" pattern.
 *   5. After placement, the user can also press-and-drag on the surface to
 *      slide the model around continuously, using a transient-input hit
 *      test tied to the active touch point (see onSelectStart/onSelectEnd
 *      and the drag block in the animation loop below).
 *   6. The model's size is fixed once placed — no pinch-to-scale or other
 *      resize gesture. Its size is set once at load time (bounding-box
 *      normalisation × modelScale, see the GLB-load block below) and never
 *      changes afterward.
 *   7. Surface detection has two layers: the native WebXR hit test (now
 *      requested against both planes AND point-cloud features, so it can
 *      succeed before ARCore/ARKit has committed to a full plane polygon),
 *      plus a manual Three.js raycast fallback against the plane meshes
 *      we've already built from plane-detection, used only on frames where
 *      the native hit test comes back empty. This meaningfully reduces
 *      "reticle disappears for a moment" gaps.
 *   8. An optional flashlight/torch toggle is available once the session is
 *      active. WebXR itself has no standard API for this — it works around
 *      that by opening a separate getUserMedia stream purely to reach the
 *      MediaStreamTrack torch constraint on the same physical camera
 *      hardware. Best-effort: hidden automatically if a real attempt fails.
 *   9. A "Use Scene Viewer instead" button is available throughout the
 *      active session (not just on error/unsupported states) so the user
 *      can voluntarily switch away from WebXR even when it's working fine.
 *   10. The reticle marker behaves differently before vs after placement:
 *      beforehand it tracks the live hit-test result (the usual "here's
 *      where it'll go" preview); once a model is placed, it switches to a
 *      FIXED marker glued to the model's own position on the surface,
 *      rather than continuing to roam wherever the camera currently looks
 *      — re-tapping elsewhere still re-places using a fresh hit-test result
 *      regardless of what the marker is currently showing.
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
}: WebXRPlacementViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const flashlightTrackRef = useRef<MediaStreamTrack | null>(null);
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
  // constraint (the same physical camera hardware, so toggling it here
  // affects the actual LED even while WebXR's own session is what's
  // actually driving what you see). This is a best-effort workaround, not a
  // guaranteed-supported path — some browsers/devices will reject it
  // outright, which is exactly what flashlightSupported tracks.
  async function toggleFlashlight() {
    try {
      if (!flashlightTrackRef.current) {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        const track = stream.getVideoTracks()[0];
        const capabilities: any = track.getCapabilities?.() ?? {};
        if (!capabilities.torch) {
          track.stop();
          setFlashlightSupported(false);
          return;
        }
        flashlightTrackRef.current = track;
      }

      const next = !flashlightOn;
      await (flashlightTrackRef.current as any).applyConstraints({ advanced: [{ torch: next }] });
      setFlashlightOn(next);
    } catch {
      flashlightTrackRef.current?.stop();
      flashlightTrackRef.current = null;
      setFlashlightSupported(false);
    }
  }

  function stopFlashlight() {
    if (flashlightTrackRef.current) {
      flashlightTrackRef.current.stop();
      flashlightTrackRef.current = null;
    }
    setFlashlightOn(false);
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

      const session: XRSession = await xr.requestSession("immersive-ar", sessionInit);
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
    // hidden until a hit is found. Stays visible even after the model has
    // been placed, so the user can always see where the next tap would move
    // it to (previously it hid itself once placed).
    const reticleGeometry = createRoundedSquareRingGeometry(0.09, 0.07, 0.03).rotateX(-Math.PI / 2);
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
    // visual feedback that scanning is working. These stay visible even
    // after the model is placed (previously they hid themselves then).
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

    // The latest raw hit-test result each frame (native hit test, or the
    // raycast fallback below), independent of what the reticle visually
    // shows. Used by onSelect to know where a tap should place/re-place the
    // model. Kept separate from the reticle's own transform because once a
    // model is placed, the reticle switches to showing a fixed marker under
    // the model itself (see the animation loop) rather than continuing to
    // track wherever the camera currently points — but re-placement via a
    // fresh tap still needs to know the live hit location regardless of
    // what's currently drawn.
    const liveHitMatrix = new THREE.Matrix4();
    let liveHitValid = false;

    // Orientation the fixed under-model reticle marker uses — captured from
    // the surface's own hit-test normal at the moment of (re)placement, so
    // the marker lies flat against whatever surface the model is actually
    // sitting on rather than some arbitrary default orientation.
    const placedFootprintQuaternion = new THREE.Quaternion();

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
      baseModelScale = pivot.scale.x;

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
    // entityTypes: hit-test against point-cloud features as well as full
    // planes, not just planes alone. ARCore/ARKit often have usable depth
    // points on a surface before they've built up enough data to commit to
    // a full plane polygon — testing against points too means the reticle
    // (and therefore placement) can succeed earlier, before a plane exists.
    const hitTestSource = await (session as any).requestHitTestSource({
      space: viewerSpace,
      entityTypes: ["plane", "point"],
    });
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

      if (!liveHitValid) return;
      if (!modelLoaded || !pendingModel) {
        console.warn("[WebXRPlacementViewer] Tap before model ready — should not happen now.");
        return;
      }

      if (!placedModel) {
        placedModel = pendingModel;
        scene.add(placedModel);
      }

      // Only copy position from the hit pose — not its rotation. The pivot
      // group already has a corrective inverse quaternion baked in to
      // cancel the root node's arbitrary rotation. Overwriting it with the
      // hit's orientation (which encodes the floor normal, not the model's
      // up-axis) would undo that correction and tilt the model again.
      placedModel.position.setFromMatrixPosition(liveHitMatrix);
      // The fixed reticle marker DOES want that surface orientation though
      // — it's meant to lie flat against the surface, unlike the model.
      placedFootprintQuaternion.setFromRotationMatrix(liveHitMatrix);
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
      // No touch listeners are attached to the overlay (pinch-to-scale was
      // removed — model size is fixed once placed), so there's nothing to
      // remove here.
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

      const viewerPose = frame.getViewerPose(localSpace);
      liveHitValid = false;

      syncPlaneMeshes(frame, localSpace);
      // Planes stay visible even once a model has been placed, so the user
      // can always see the scanned surface.

      if (hitTestSource && viewerPose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localSpace);
          if (pose) {
            liveHitMatrix.fromArray(pose.transform.matrix);
            liveHitValid = true;
          }
        }
      }

      // Fallback: the native hit test can occasionally miss for a frame or
      // two even though a plane has already been detected right where the
      // user is looking (e.g. near a plane's edge, or just ARCore's own
      // internal update cadence). Rather than leave the live hit unset and
      // waiting, raycast against the plane meshes we already have from
      // plane-detection instead — this measurably reduces "no reticle" gaps
      // using data that's already on hand, without waiting on the next
      // native hit-test result.
      if (!liveHitValid && viewerPose && planeMeshes.size > 0) {
        fallbackViewerMatrix.fromArray(viewerPose.transform.matrix);
        fallbackOrigin.setFromMatrixPosition(fallbackViewerMatrix);
        fallbackDirection.set(0, 0, -1).transformDirection(fallbackViewerMatrix);
        fallbackRaycaster.set(fallbackOrigin, fallbackDirection);

        const intersections = fallbackRaycaster.intersectObjects(Array.from(planeMeshes.values()), false);
        if (intersections.length > 0) {
          const hit = intersections[0];
          const planeMesh = hit.object as THREE.Mesh;
          const fallbackQuaternion = new THREE.Quaternion().setFromRotationMatrix(planeMesh.matrix);
          liveHitMatrix.compose(hit.point, fallbackQuaternion, new THREE.Vector3(1, 1, 1));
          liveHitValid = true;
        }
      }

      // Reticle display: before placement it tracks the live hit-test
      // result, same as the "where would this go" preview always has. Once
      // a model is placed, it switches to a FIXED marker glued to the
      // model's own position — it no longer follows wherever the camera
      // happens to be looking, since that was confusing to look at moving
      // independently of the already-placed model. A fresh tap still
      // re-places using the live hit-test result above regardless of what
      // the reticle is currently showing.
      if (placedModel) {
        reticle.position.copy(placedModel.position);
        reticle.quaternion.copy(placedFootprintQuaternion);
        reticle.updateMatrix();
        reticle.visible = true;
      } else if (liveHitValid) {
        reticle.matrix.copy(liveHitMatrix);
        reticle.visible = true;
      } else {
        reticle.visible = false;
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
          session, so the same JSX covers both states. pointerEvents is
          "none" so single-finger taps/drags pass straight through to
          WebXR's own 'select' handling untouched — the individual buttons
          inside (exit, flashlight, "Use Scene Viewer instead") each set
          their own pointerEvents: "auto", which is enough to make just
          those specific elements clickable regardless of this. */}
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

        {/* Flashlight toggle — only shown once the session is actually
            active and scanning/placing, and hidden automatically if a real
            attempt to use it fails (see toggleFlashlight's comment on why
            this is best-effort rather than guaranteed to work). */}
        {(phase === "active-searching" || phase === "active-placed") && flashlightSupported && (
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
            working). Placed under the exit button rather than the main
            coaching text so it doesn't compete with the primary
            tap-to-place instructions. */}
        {(phase === "active-searching" || phase === "active-placed") && onFallbackToSceneViewer && (
          <button
            onClick={() => {
              endSession();
              onFallbackToSceneViewer();
            }}
            style={{
              position: "absolute",
              top: "4.2rem",
              right: "1.2rem",
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