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
 * axis is exposed. See onTouchStart/Move/End below.
 *
 * Position: a single-finger press-and-drag directly on the model moves it
 * around, as a position OFFSET from the marker image's own center — the
 * model is a child of the anchor, so this never breaks tracking, it just
 * shifts where on top of the (still-tracked) marker the model sits. Like
 * the WebXR drag, the model snaps directly under the finger every frame
 * (via a raycast against the marker's own flat plane, projected out from
 * the touch point) rather than preserving a grabbed offset. Movement is
 * confined to the marker's flat plane — it can't be dragged toward or away
 * from the camera, only around across the surface of the image.
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

// Stops the underlying getUserMedia MediaStream directly, rather than
// relying solely on mindarThree.stop() to release the camera. This matters
// because start()/stop() can race with an unmount: if start() is still
// mid-flight when the component unmounts, calling stop() at that moment can
// land before the camera stream even exists yet, silently doing nothing —
// leaving the camera (and its still-live video element) running with
// nothing left in our React tree to ever stop it again.
function stopCameraStream(mindarThree: any) {
  const video: HTMLVideoElement | undefined = mindarThree?.video;
  const stream = video?.srcObject as MediaStream | undefined | null;
  stream?.getTracks().forEach((track) => track.stop());
  if (video) {
    video.pause();
    video.srcObject = null;
  }
}

export function ImageTrackingViewer({ glbUrl, mindTargetUrl, name, onExit, modelScale = 1 }: ImageTrackingViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mindarRef = useRef<any>(null);
  // Holds the spin group (see init() below) once the model has finished
  // loading, so the touch handlers — set up independently of the async
  // load — can rotate/move it as soon as it exists.
  const spinGroupRef = useRef<THREE.Group | null>(null);
  // A second group, decoupled from MindAR's own anchor.group, that the
  // render loop below eases toward the anchor's raw tracked pose every
  // frame (see the animation loop for why) rather than following it
  // directly. spinGroup/model live under THIS, not under anchor.group.
  const smoothGroupRef = useRef<THREE.Group | null>(null);
  // The anchor's own group, and the (fixed, non-moving) tracking camera —
  // both needed by the drag handler to turn a screen-space touch point into
  // a position on the marker's plane. Populated once init() creates them.
  const anchorGroupRef = useRef<THREE.Group | null>(null);
  const cameraRef = useRef<THREE.Camera | null>(null);
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
          // MindAR's own built-in loading/scanning/error UI renders full-
          // screen elements appended to document.body — NOT to our
          // container div — as a separate DOM subtree from the rest of
          // this component. We already show our own coaching UI (the
          // "scanning" / "found" overlays below), so disable MindAR's
          // copy entirely. Left enabled, it's what was staying on screen
          // and blocking the whole page after exiting: it lives outside
          // our container, so React unmounting this component doesn't
          // remove it, and it sits on top of everything else with
          // pointer-events capturing every tap.
          uiLoading: "no",
          uiScanning: "no",
          uiError: "no",
          // Jitter reduction, part 1: MindAR smooths its raw per-frame pose
          // estimate through an internal One-Euro filter before ever
          // exposing it — these two knobs are that filter's own tuning,
          // not something layered on top. filterBeta controls how strongly
          // fast movement is allowed to "cut through" the smoothing (its
          // default of 1000 barely restrains anything, so the phone's own
          // hand-shake reads straight through as visible shake); dropping
          // it to 10 makes the filter hold steady through normal hand
          // tremor and only respond to genuinely deliberate movement, at
          // the cost of a little added lag when the phone or marker really
          // is moving fast. filterMinCF is the filter's noise floor when
          // basically stationary — 0.0001 (down from the 0.001 default)
          // keeps a "resting" marker from visibly buzzing in place.
          filterMinCF: 0.0001,
          filterBeta: 10,
          // Jitter reduction, part 2: raising missTolerance (default 5)
          // means a few frames of motion blur, brief occlusion, or a
          // shaky hand don't immediately flip the target to "lost" — every
          // lost→found transition re-acquires a fresh pose with none of
          // the above smoothing warmed up yet, which is what produces the
          // sharp visual "jump" that reads as jitter's worst moments.
          // Tolerating more misses means that cycle happens far less often.
          missTolerance: 10,
        });
        mindarRef.current = mindarThree;

        const { renderer: r, scene, camera } = mindarThree;
        renderer = r;
        cameraRef.current = camera;

        // Force an explicitly transparent clear color. MindARThree sets
        // alpha:true on its internal renderer by default, but relying on
        // that default silently is what caused the camera feed to render
        // as solid black in testing — the canvas must clear to alpha 0 on
        // every frame so the <video> element underneath shows through in
        // every area the 3D scene doesn't cover.
        renderer.setClearColor(0x000000, 0);

        const anchor = mindarThree.addAnchor(0);
        anchorGroupRef.current = anchor.group;

        anchor.onTargetFound = () => {
          if (!cancelled) setPhase("found");
          const smoothGroup = smoothGroupRef.current;
          const anchorGroup = anchorGroupRef.current;
          if (smoothGroup && anchorGroup) {
            // Snap instantly to the freshly (re)acquired pose rather than
            // letting the lerp/slerp below ease in from wherever the
            // group happened to be sitting before — otherwise every single
            // target acquisition (including the very first one, starting
            // from the group's default (0,0,0)) would visibly animate the
            // model sliding in from the wrong place instead of just
            // appearing where the marker actually is. The per-frame
            // smoothing in the animation loop only needs to catch the much
            // smaller, continuous jitter WITHIN a tracking session, not
            // this one-time re-acquisition jump.
            anchorGroup.matrix.decompose(smoothGroup.position, smoothGroup.quaternion, smoothGroup.scale);
            smoothGroup.visible = true;
          }
        };
        anchor.onTargetLost = () => {
          if (!cancelled) setPhase("scanning");
          // anchor.group itself is hidden by MindAR on loss, which used to
          // hide the model "for free" back when it was a direct child of
          // anchor.group. Now that it lives under a separate smoothGroup
          // (see below), that has to be done explicitly instead — without
          // this, the model would stay frozen on screen, drifting toward
          // whatever stale pose the smoothing keeps easing toward, instead
          // of disappearing the moment tracking is actually lost.
          if (smoothGroupRef.current) smoothGroupRef.current.visible = false;
        };

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
        spinGroupRef.current = spinGroup;

        // Smoothing group: added directly to the scene, NOT to
        // anchor.group. MindAR updates anchor.group's transform every
        // single frame straight from its own (already-filtered, but still
        // not perfectly still) tracked pose — parenting our content
        // directly under it means every remaining flicker in that pose
        // reads as visible model jitter. Instead we ease this group's
        // transform toward anchor.group's current transform each frame
        // (see the animation loop below) — a second, independent low-pass
        // filter on top of MindAR's own, which is what actually kills the
        // remaining shake that filterMinCF/filterBeta alone don't catch.
        const smoothGroup = new THREE.Group();
        smoothGroup.add(spinGroup);
        scene.add(smoothGroup);
        smoothGroupRef.current = smoothGroup;

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
        if (cancelled) {
          // The component was unmounted while start() was still in flight
          // (e.g. the user exited right as the camera was spinning up).
          // The cleanup function below already ran and couldn't stop
          // anything yet, since the session didn't exist until just now —
          // so stop it here instead, rather than leaving the camera (and
          // MindAR's internal state) running with nothing left to ever
          // tear it down.
          try {
            mindarThree.stop?.();
          } catch {
            // Session may not have been fully in a stoppable state — the
            // explicit stopCameraStream call below is the real safety net.
          }
          stopCameraStream(mindarThree);
          return;
        }
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

        // Scratch objects reused every frame below to decompose
        // anchor.group's raw tracked matrix, so smoothing doesn't allocate
        // on a 60fps loop.
        const anchorPos = new THREE.Vector3();
        const anchorQuat = new THREE.Quaternion();
        const anchorScale = new THREE.Vector3();
        let lastFrameTime = performance.now();
        // Half-life (ms) of the extra smoothing filter: after this many
        // milliseconds, the smoothed group has closed half the remaining
        // gap to the anchor's actual current pose. ~90ms is short enough
        // that deliberate movement (walking around, tilting the phone)
        // still tracks the marker responsively, but long enough to average
        // out ordinary hand-shake between frames.
        const SMOOTHING_HALF_LIFE_MS = 90;

        renderer.setAnimationLoop((time: number) => {
          renderer!.setClearColor(0x000000, 0);

          const anchorGroup = anchorGroupRef.current;
          const smoothGroup = smoothGroupRef.current;
          if (anchorGroup && smoothGroup && smoothGroup.visible) {
            // MindAR writes each frame's tracked pose straight into
            // anchor.group.matrix itself (not into .position/.quaternion,
            // which it never touches) — decompose that directly rather
            // than calling anchor.group.updateMatrix(), which would
            // silently rebuild .matrix FROM those untouched properties and
            // overwrite the real tracked pose with a stale identity one.
            // anchor.group is a direct child of `scene` with no transform
            // of its own above it, so .matrix already equals its effective
            // world matrix here — no need to wait on updateMatrixWorld().
            anchorPos.setFromMatrixPosition(anchorGroup.matrix);
            anchorQuat.setFromRotationMatrix(anchorGroup.matrix);
            anchorScale.setFromMatrixScale(anchorGroup.matrix);

            const dt = Math.max(0, time - lastFrameTime);
            // Converts the half-life above into a per-frame lerp/slerp
            // factor that's correct regardless of the device's actual
            // frame rate — a fixed alpha (e.g. always 0.2) would smooth
            // far less per second on a 120Hz display than a 30Hz one.
            const alpha = 1 - Math.pow(0.5, dt / SMOOTHING_HALF_LIFE_MS);

            smoothGroup.position.lerp(anchorPos, alpha);
            smoothGroup.quaternion.slerp(anchorQuat, alpha);
            smoothGroup.scale.lerp(anchorScale, alpha);
          }
          lastFrameTime = time;

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

      const mindarThree = mindarRef.current;
      try {
        mindarThree?.stop?.();
      } catch {
        // Ignore — the explicit stopCameraStream call below is what
        // actually guarantees the camera is released, regardless of
        // whether MindAR's own stop() succeeded or was even in a state
        // where it could run.
      }
      stopCameraStream(mindarThree);
      mindarThree?.renderer?.dispose?.();

      // Safety net: in case any older/cached build of MindAR's bundle still
      // appended its built-in overlay UI to document.body before the
      // uiLoading/uiScanning/uiError: "no" options above took effect, sweep
      // it away explicitly. This is exactly the fixed, full-screen element
      // that was staying on screen and swallowing every tap after exiting.
      document.querySelectorAll(".mindar-ui-overlay").forEach((el) => el.remove());

      spinGroupRef.current = null;
      anchorGroupRef.current = null;
      cameraRef.current = null;
    };
  }, [glbUrl, mindTargetUrl]);

  // --- Single-finger DRAG (move) + two-finger TWIST (rotate) ---
  // Set up independently of the async model load in init() above: these
  // listeners attach to the container div as soon as it mounts, and each
  // handler just checks the relevant ref(s) before doing anything, so
  // touches before the model is ready are harmlessly ignored.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let rotateStartAngle: number | null = null;
    let rotateStartRotationZ = 0;
    // Timestamp (performance.now()) up to which starting a new drag is
    // locked out after a twist gesture ends — set whenever the second
    // finger lifts, mirroring WebXRPlacementViewer, so a finger lingering
    // or re-landing right at the tail end of a twist can't be misread as
    // the start of a drag.
    let dragLockUntil = 0;
    const DRAG_LOCK_MS = 1000;

    let dragging = false;
    // Reused on every touchstart to test whether the touch actually landed
    // on the model before arming a drag — without this, any single-finger
    // tap anywhere on screen would grab the model and snap it there.
    const raycaster = new THREE.Raycaster();
    // Reused every touchmove while dragging, to project the touch point
    // out onto the marker's own flat plane (its local Z=0 plane, in world
    // space) and recover a 3D position on it.
    const dragPlane = new THREE.Plane();
    const planeHitPoint = new THREE.Vector3();

    // Converts a touch's screen coordinates into normalized device
    // coordinates (-1..1) relative to the container, for use with
    // THREE.Raycaster.setFromCamera.
    function touchToNDC(touch: Touch): THREE.Vector2 {
      const rect = container.getBoundingClientRect();
      const x = ((touch.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -((touch.clientY - rect.top) / rect.height) * 2 + 1;
      return new THREE.Vector2(x, y);
    }

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
      const spinGroup = spinGroupRef.current;
      const anchorGroup = anchorGroupRef.current;
      const camera = cameraRef.current;

      if (e.touches.length === 2 && spinGroup) {
        e.preventDefault();
        // A second finger landing cancels any drag in progress — only one
        // gesture acts on the model at a time.
        dragging = false;
        rotateStartAngle = twoTouchAngle(e.touches);
        rotateStartRotationZ = spinGroup.rotation.z;
        return;
      }

      if (
        e.touches.length === 1 &&
        spinGroup &&
        anchorGroup &&
        camera &&
        rotateStartAngle === null &&
        performance.now() >= dragLockUntil
      ) {
        // Only arm the drag if this touch actually landed on the model —
        // raycast against its real geometry first, exactly like the
        // WebXR path does before starting its own drag.
        raycaster.setFromCamera(touchToNDC(e.touches[0]), camera);
        const hits = raycaster.intersectObject(spinGroup, true);
        if (hits.length > 0) {
          e.preventDefault();
          dragging = true;
        }
      }
    }

    function onTouchMove(e: TouchEvent) {
      const spinGroup = spinGroupRef.current;
      const anchorGroup = anchorGroupRef.current;
      const camera = cameraRef.current;

      if (rotateStartAngle !== null && e.touches.length === 2 && spinGroup) {
        e.preventDefault();
        const currentAngle = twoTouchAngle(e.touches);
        // Sign flip for the same reason as the WebXR path: a clockwise
        // twist, as seen face-on looking at the marker, should turn the
        // model in the negative-angle direction under Three.js's
        // right-handed convention for rotation about the anchor's Z axis.
        const deltaAngle = -(currentAngle - rotateStartAngle);
        spinGroup.rotation.z = rotateStartRotationZ + deltaAngle;
        return;
      }

      if (dragging && e.touches.length === 1 && spinGroup && anchorGroup && camera) {
        e.preventDefault();

        // The marker's own flat plane, in world space: origin at the
        // anchor's current (tracked) position, normal along the anchor's
        // local Z axis (the axis perpendicular to the image — see the
        // spin-group comment above for why Z is "up off the marker" here).
        // Recomputed fresh every move since the anchor's pose updates each
        // frame as tracking refines, so the plane always matches where the
        // physical marker currently is.
        const planeOrigin = new THREE.Vector3().setFromMatrixPosition(anchorGroup.matrixWorld);
        const planeNormal = new THREE.Vector3(0, 0, 1)
          .transformDirection(anchorGroup.matrixWorld)
          .normalize();
        dragPlane.setFromNormalAndCoplanarPoint(planeNormal, planeOrigin);

        raycaster.setFromCamera(touchToNDC(e.touches[0]), camera);
        const hit = raycaster.ray.intersectPlane(dragPlane, planeHitPoint);
        if (hit) {
          // Convert the world-space hit point into the anchor's own local
          // space, then snap the spin group directly there — this is the
          // model's position OFFSET from the marker's center, exactly like
          // the WebXR path snapping the model to the finger, just confined
          // to the marker's flat plane (X/Y) instead of full 3D space.
          const localPoint = anchorGroup.worldToLocal(planeHitPoint.clone());
          spinGroup.position.x = localPoint.x;
          spinGroup.position.y = localPoint.y;
        }
      }
    }

    function onTouchEnd(e: TouchEvent) {
      if (e.touches.length < 1) {
        dragging = false;
      }
      if (e.touches.length < 2) {
        if (rotateStartAngle !== null) {
          // A twist gesture just ended — hold off on arming a new drag for
          // a moment so a finger lifting or re-landing right at the tail
          // end of the twist can't be misread as a drag starting.
          dragLockUntil = performance.now() + DRAG_LOCK_MS;
        }
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