import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { T } from "./tokens.mts";
import { getContrastTextColor } from "../lib/colorContrast";

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
 *      'dom-overlay' + 'plane-detection' + 'depth-sensing' optional.
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
 *      and the drag block in the animation loop below). The model SNAPS
 *      directly to that touch point's hit-test result every frame — it
 *      does not preserve wherever on the model you first grabbed it, so
 *      the model always sits exactly under the finger for the whole drag.
 *      The reticle follows along underneath it since it's pinned to the
 *      model's position.
 *   6. Model scale is fixed: it's computed once when the GLB finishes
 *      loading (normalized to a real-world target size, then multiplied by
 *      the `modelScale` prop) and never changes afterward — there is no
 *      in-session resize gesture, intentionally, so the model always reads
 *      at a single, predictable size.
 *   7. A two-finger TWIST rotates the placed model around its own vertical
 *      (Y) axis — read directly from ordinary browser TouchEvents on the
 *      dom-overlay element (see onOverlayTouchStart/Move/End below). This
 *      matches Scene Viewer's own rotate gesture: we track the angle of the
 *      line connecting the two touch points and turn the model by however
 *      much THAT angle changes, so rotating your two fingers relative to
 *      each other (like turning a dial) is what spins the model — not a
 *      one-directional horizontal pan of the midpoint. Because it's a 1:1
 *      angle mapping there's no sensitivity constant to tune: twist your
 *      fingers 90°, the model turns 90°. We only take over (preventDefault)
 *      once a second finger actually lands and a model exists, so
 *      single-finger taps/drags keep working exactly as before, routed
 *      through the normal WebXR 'select'/transient-hit-test flow untouched.
 *      Position stays locked for the entire twist (no drag applies while
 *      rotating), AND for a further 1 second after the second finger lifts
 *      — a fresh single-finger touch landing in that window won't arm a
 *      drag, so the tail end of a twist gesture can never be misread as an
 *      accidental nudge of the model's position.
 *   8. Surface detection now has THREE layers, tried in order each frame
 *      until one succeeds, so the reticle/placement can go live as early as
 *      possible instead of waiting on the slowest signal:
 *        a. The native WebXR hit test, requested against both planes AND
 *           point-cloud features, so it can succeed before ARCore/ARKit has
 *           committed to a full plane polygon.
 *        b. The depth-sensing API (if the browser/device grants it): a live
 *           per-pixel depth buffer that's often populated even earlier than
 *           (a), and independently of it — we sample the depth at screen
 *           center each frame and project it out along the camera's forward
 *           ray to get a surface point. This is a genuinely new, faster
 *           signal, not just a re-read of (a) or (c).
 *        c. A manual Three.js raycast against the plane meshes we've
 *           already built from plane-detection, used only on frames where
 *           neither (a) nor (b) produced a result.
 *      All three are purely additive fallbacks — if a browser doesn't grant
 *      depth-sensing or plane-detection, those layers simply never fire and
 *      behavior is identical to before.
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
 * does improve is *perceived* speed and reliability, by reading from every
 * surface signal the platform exposes (hit-test, depth, plane meshes) and
 * taking whichever one resolves first each frame, rather than leaving the
 * user staring at a blank camera feed until one specific signal succeeds.
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
 *  - depth-sensing is optional and device-dependent (ARCore Depth API
 *    hardware/software support varies by phone) — feature-detected at
 *    runtime, so its absence never breaks placement or the reticle.
 *
 * Persistent anchors (pre-scanned placement):
 *  - When the browser grants the optional 'anchors' feature AND exposes
 *    session.restorePersistentAnchor (the WebXR Anchors module's
 *    persistence extension), a successful tap-to-place also asks the
 *    platform to persist that anchor and stores the returned UUID in
 *    localStorage, keyed by `anchorKey` (typically the dish/model id).
 *  - On the NEXT visit to the same model, if a stored UUID exists, we try
 *    session.restorePersistentAnchor(uuid) before showing the reticle. If
 *    it resolves, the model is placed automatically from that anchor's
 *    live pose — no re-scan, no re-tap. Position is re-read from the
 *    anchor every frame (not just set once), so it self-corrects if the
 *    platform refines its understanding of that spot.
 *  - If there's no stored UUID, the browser doesn't support persistence,
 *    or the restore call rejects (stale handle, different physical
 *    location, cleared AR data, etc.), this silently falls straight
 *    through to the normal live hit-test scanning flow described above —
 *    a pre-scanned placement is only ever a shortcut on top of that flow,
 *    never a replacement for it.
 *  - Support for this specific persistence extension is currently narrow
 *    (most WebXR-capable browsers support the base 'anchors' feature for
 *    session-only anchors, but not everyone ships
 *    restorePersistentAnchor/requestPersistentHandle yet) — that's exactly
 *    why every step here is feature-detected and wrapped so its absence
 *    just means "always re-scan," not a broken session.
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
   * Stable identifier for what's being placed (e.g. the dish/model id).
   * Used as the localStorage key for that model's persisted WebXR anchor,
   * so returning to the SAME dish restores its remembered placement while
   * a different dish starts a fresh scan. If omitted, persistence is
   * skipped entirely and every session scans live, same as before.
   */
  anchorKey?: string;
  /**
   * Same exposure value the regular model-viewer preview uses
   * (scene.exposure from the API) — kept in sync so the model doesn't look
   * noticeably different in brightness between the normal preview and AR.
   * Defaults to 1 (neutral) if not supplied.
   */
  exposure?: number;
  /** Restaurant's primary brand color — same value SceneViewer themes its buttons/accents with. Falls back to the app default. */
  primaryColor?: string | null;
  /** Restaurant's secondary brand color — same value SceneViewer uses as its page background. Falls back to white. */
  secondaryColor?: string | null;
}

const ANCHOR_STORAGE_PREFIX = "dinenics-xr-anchor:";

function getStoredAnchorUuid(anchorKey: string): string | null {
  try {
    return localStorage.getItem(ANCHOR_STORAGE_PREFIX + anchorKey);
  } catch {
    return null; // localStorage unavailable (private mode, etc.) — just skip persistence
  }
}

function setStoredAnchorUuid(anchorKey: string, uuid: string) {
  try {
    localStorage.setItem(ANCHOR_STORAGE_PREFIX + anchorKey, uuid);
  } catch {
    // Ignore — worst case, next visit just re-scans instead of restoring.
  }
}

function clearStoredAnchorUuid(anchorKey: string) {
  try {
    localStorage.removeItem(ANCHOR_STORAGE_PREFIX + anchorKey);
  } catch {
    // no-op
  }
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

// Recursively disposes every geometry, material, and material texture found
// on an Object3D's subtree. THREE doesn't do this automatically when an
// object is just dropped/removed from the scene — without an explicit
// walk-and-dispose like this, every AR session entered on a model-heavy
// menu leaks that model's GPU buffers for the lifetime of the page.
function disposeObject3D(root: THREE.Object3D) {
  const seenMaterials = new Set<THREE.Material>();
  root.traverse((obj: any) => {
    if (obj.geometry) {
      obj.geometry.dispose();
    }
    const materials: THREE.Material[] = Array.isArray(obj.material)
      ? obj.material
      : obj.material
      ? [obj.material]
      : [];
    for (const material of materials) {
      if (seenMaterials.has(material)) continue;
      seenMaterials.add(material);
      for (const key of Object.keys(material)) {
        const value = (material as any)[key];
        if (value && typeof value === "object" && "isTexture" in value) {
          (value as THREE.Texture).dispose();
        }
      }
      material.dispose();
    }
  });
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
  anchorKey,
  exposure = 1,
  primaryColor: primaryColorProp,
  secondaryColor: secondaryColorProp,
}: WebXRPlacementViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const sessionRef = useRef<XRSession | null>(null);
  const [phase, setPhase] = useState<SessionPhase>("checking-support");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [domOverlaySupported, setDomOverlaySupported] = useState(true);
  // True while the placed model is sitting on a RESTORED persistent anchor
  // from a previous visit, rather than one just placed by a fresh tap —
  // purely cosmetic (drives the "remembered from last time" coaching text
  // below), cleared the moment the user taps to re-place.
  const [restoredFromMemory, setRestoredFromMemory] = useState(false);

  // Same color scheme SceneViewer computes from the same two API fields —
  // kept identical on purpose (including the same fallbacks and the same
  // getContrastTextColor helper) so the AR view doesn't look like a
  // different app from the page the user just tapped "View in AR" from.
  const primaryColor = primaryColorProp || T.primary;
  const onPrimary = getContrastTextColor(primaryColor, "#1a1a1a", "#ffffff");
  const secondaryColor = secondaryColorProp || "#ffffff";
  const onSecondary = getContrastTextColor(secondaryColor, "#1a1a1a", "#ffffff");
  const secondaryMuted = onSecondary === "#1a1a1a" ? "rgba(26,26,26,0.6)" : "rgba(255,255,255,0.7)";
  const secondaryTrack = onSecondary === "#1a1a1a" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.18)";

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
        // depth-sensing is optional and only honored by browsers/devices
        // that support ARCore's Depth API — if the device can't grant it,
        // the session still starts fine and depth simply stays unavailable
        // (guarded at every use site below via feature detection).
        optionalFeatures: ["dom-overlay", "plane-detection", "depth-sensing", "anchors"],
        depthSensing: {
          usagePreference: ["cpu-optimized", "gpu-optimized"],
          dataFormatPreference: ["luminance-alpha", "float32"],
        },
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
    // Capping pixel ratio at 2 avoids rendering 3x/4x as many pixels as a
    // 1x display on high-DPI phones for essentially no visible benefit in
    // an AR passthrough view — this is one of the single biggest wins for
    // frame time and thermal throttling on mid-range Android hardware.
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.xr.enabled = true;
    container.appendChild(renderer.domElement);

    // WebGL contexts can be lost (backgrounding the tab, OS memory
    // pressure, GPU driver reset) — without handling this, the canvas
    // would silently go blank and setAnimationLoop would keep firing
    // against a dead context. preventDefault() on the loss event signals
    // the browser we intend to try to restore rather than tearing down.
    function onContextLost(e: Event) {
      e.preventDefault();
      console.warn("[WebXRPlacementViewer] WebGL context lost.");
    }
    function onContextRestored() {
      console.warn("[WebXRPlacementViewer] WebGL context restored.");
    }
    renderer.domElement.addEventListener("webglcontextlost", onContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", onContextRestored, false);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera();

    // --- Tone mapping / color space ---
    // Three's default is a flat linear output, which is exactly why PBR
    // (MeshStandardMaterial, what glTF exports almost always use) models
    // tend to look washed out and low-contrast with no other changes at
    // all. ACES Filmic gives the same kind of highlight rolloff/contrast
    // curve a real camera has instead of just clipping to white, and
    // correct sRGB output color space is what makes colors read at their
    // real saturation instead of muted. Both are one-line renderer
    // settings — not extra draw calls or shader work — so this is
    // effectively free.
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = exposure;

    // --- Image-based lighting (free, no network fetch) ---
    // PBR materials need an actual environment to reflect for their
    // specular response — lit by only a couple of point/directional
    // lights, they read as flat and plasticky no matter how those direct
    // lights are tuned, because there's nothing for the "shiny" part of
    // the material to pick up. RoomEnvironment is a small PROCEDURALLY
    // generated neutral studio setup (no image download at all) baked
    // into a PMREM texture ONCE here at session start. After that it's
    // just one more texture sample already folded into the same PBR
    // shading pass every material does anyway — no measurable per-frame
    // cost, and it must run before renderer.xr.setSession() below (PMREM
    // generation briefly uses the renderer itself, which doesn't mix well
    // with an already-active XR session).
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    // --- Direct lights ---
    // A real key + fill pairing, rather than one flat directional light
    // plus a strong hemisphere fill (which was the actual biggest
    // contrast-killer before — a bright, even hemisphere light lifts every
    // shadow at once, which reads as "flat" no matter how bright the main
    // light is). The hemisphere here is now just a faint floor so unlit
    // undersides never crush to pure black; the key light is brighter and
    // angled for real shape/shadow definition; a dim, cool-toned fill from
    // the opposite side keeps the shadow side of the model from going
    // completely dead. This is still only 3 lights total (same as before,
    // +1) — trivial for a forward-lit PBR material, no shadow maps or
    // extra render passes involved.
    scene.add(new THREE.HemisphereLight(0xffffff, 0x666666, 0.35));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.2);
    keyLight.position.set(0.6, 1.2, 0.8);
    scene.add(keyLight);
    const fillLight = new THREE.DirectionalLight(0xbcd4ff, 0.5);
    fillLight.position.set(-0.8, 0.4, -0.6);
    scene.add(fillLight);

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
      opacity: 0.1,
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
    //
    // The model SNAPS directly to the current touch point's hit-test result
    // every frame — no offset is preserved from wherever it was first
    // grabbed, so the model always sits exactly under the finger for the
    // duration of the drag (this is the intentional "snap to finger"
    // behavior, replacing an earlier grabbed-offset approach).
    let draggingInputSource: XRInputSource | null = null;
    let dragOccurred = false;
    // Reused each time a select/selectstart fires, to check whether the tap
    // actually landed on the placed model before arming a drag — without
    // this, any tap anywhere on screen would grab the model and snap it to
    // that touch point.
    const modelHitRaycaster = new THREE.Raycaster();

    // --- Two-finger TWIST rotate state ---
    // Read directly from DOM touch events on the dom-overlay element rather
    // than XR input sources, since a 2-finger gesture is naturally expressed
    // as ordinary browser TouchEvents (dom-overlay is specifically designed
    // to receive these during an immersive session). We only take over
    // (preventDefault) once a second finger actually lands and a model
    // exists, so single-finger taps/drags keep working exactly as before,
    // routed through the normal WebXR 'select'/transient-hit-test flow
    // untouched.
    let rotateStartAngle: number | null = null;
    let rotateStartRotationY = 0;
    // Timestamp (performance.now()) up to which dragging/placement should
    // stay locked out after a twist gesture ends — set whenever the second
    // finger lifts, so a finger landing right at the tail end of a twist
    // can't be misread as the start of a drag/tap. Cleared implicitly once
    // performance.now() passes it.
    let rotateLockUntil = 0;
    const ROTATE_LOCK_MS = 1000;

    // Angle (radians) of the line connecting the two touch points, in
    // screen space. Tracking the CHANGE in this angle — rather than the
    // horizontal movement of their midpoint, as a plain 2-finger pan would
    // — is what makes this a "twist" gesture: rotating your two fingers
    // relative to each other (like turning a dial) is what spins the model,
    // matching Scene Viewer's own rotate gesture. It's also a 1:1 angle
    // mapping, so there's no separate sensitivity constant to tune.
    function twoTouchAngle(touches: TouchList): number {
      const dx = touches[1].clientX - touches[0].clientX;
      const dy = touches[1].clientY - touches[0].clientY;
      return Math.atan2(dy, dx);
    }

    function onOverlayTouchStart(e: TouchEvent) {
      if (e.touches.length === 2 && placedModel) {
        e.preventDefault();
        rotateStartAngle = twoTouchAngle(e.touches);
        rotateStartRotationY = placedModel.rotation.y;
        // Lock position for the duration of the twist — only one gesture
        // acts on the model at a time. A drag may already be in progress
        // from the first finger landing (onSelectStart arms on a single
        // touch before the second one lands), so cancel it here rather
        // than letting both a slide and a rotate apply simultaneously.
        draggingInputSource = null;
      }
    }

    function onOverlayTouchMove(e: TouchEvent) {
      if (rotateStartAngle !== null && e.touches.length === 2 && placedModel) {
        e.preventDefault();
        const currentAngle = twoTouchAngle(e.touches);
        // Screen-space angle increases clockwise, while a clockwise twist
        // (as seen from above, looking down at the placed model) should
        // turn the model in the negative Y-rotation direction under
        // Three.js's right-handed coordinate convention — hence the sign
        // flip here.
        const deltaAngle = -(currentAngle - rotateStartAngle);
        placedModel.rotation.y = rotateStartRotationY + deltaAngle;
      }
    }

    function onOverlayTouchEnd(e: TouchEvent) {
      if (e.touches.length < 2) {
        if (rotateStartAngle !== null) {
          // A twist gesture just ended — hold the drag/placement lock for
          // a further ROTATE_LOCK_MS so a finger lifting or re-landing
          // right at the tail end of the twist can't be misread as a new
          // drag starting.
          rotateLockUntil = performance.now() + ROTATE_LOCK_MS;
        }
        rotateStartAngle = null;
      }
    }

    const overlayEl = overlayRef.current;
    if (overlayEl) {
      overlayEl.addEventListener("touchstart", onOverlayTouchStart, { passive: false });
      overlayEl.addEventListener("touchmove", onOverlayTouchMove, { passive: false });
      overlayEl.addEventListener("touchend", onOverlayTouchEnd, { passive: false });
      overlayEl.addEventListener("touchcancel", onOverlayTouchEnd, { passive: false });
    }

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
      // the session — there's no resize gesture, so the model always
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
    // a full plane polygon, so testing against points too means the live hit
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

    // --- Persistent anchors: try to restore a remembered placement ---
    // anchorsSupported reflects the specific persistence extension, not
    // just the base 'anchors' feature — a browser can grant 'anchors' for
    // session-only anchors while still lacking restorePersistentAnchor.
    const anchorsSupported = typeof (session as any).restorePersistentAnchor === "function";
    // The currently-active anchor (restored OR newly created after a tap).
    // Re-read every frame below to keep the model locked to it; replaced
    // whenever the user taps to place somewhere new.
    let activeAnchor: XRAnchor | null = null;

    if (anchorsSupported && anchorKey) {
      const storedUuid = getStoredAnchorUuid(anchorKey);
      if (storedUuid) {
        try {
          activeAnchor = await (session as any).restorePersistentAnchor(storedUuid);
        } catch {
          // Stale handle, different physical location, AR data was reset,
          // etc. — forget it and fall straight through to live scanning
          // below, exactly as if nothing had ever been saved.
          clearStoredAnchorUuid(anchorKey);
          activeAnchor = null;
        }
      }
    }

    setPhase("active-searching");

    // Reused every frame for the native + fallback hit tests, so placement
    // (onSelect) always has the latest live result to work with — even
    // though, once a model exists, the *visual* reticle no longer shows
    // this and instead pins itself under the placed model (see the
    // animation loop below).
    const hitMatrix = new THREE.Matrix4();
    let hitValid = false;
    // Only layer 1 (the native hit test) produces a real XRHitTestResult
    // object with .createAnchor() — layers 2/3 (depth-sensing, plane
    // raycast) only ever produce a bare matrix. Kept separately so onSelect
    // knows whether creating a persistent anchor is even possible for
    // THIS particular tap.
    let nativeHitTestResult: any = null;

    function onSelect() {
      // A drag just ended on this same press — the model has already been
      // moved continuously to follow the finger, so skip the normal
      // tap-to-(re)place logic below to avoid an extra jump to the current
      // hit-test result right after a drag.
      if (dragOccurred) {
        dragOccurred = false;
        return;
      }

      // A two-finger rotate was just in progress on this same gesture, or
      // its post-rotate lock window is still active — don't reinterpret
      // its release as a placement tap.
      if (rotateStartAngle !== null || performance.now() < rotateLockUntil) {
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
      // The model's current Y rotation (from any prior two-finger rotate) is
      // deliberately left untouched by a re-tap/re-place.
      placedModel.position.setFromMatrixPosition(hitMatrix);
      setPhase("active-placed");
      // A fresh tap always means "place it HERE, right now" — any anchor
      // we were previously tracking (restored from last visit, or from an
      // earlier tap this same session) no longer describes where the
      // model actually is, so stop reading position from it. The block
      // below replaces it with a brand new one if the platform supports
      // anchors at all.
      setRestoredFromMemory(false);
      const staleAnchor = activeAnchor;
      activeAnchor = null;
      staleAnchor?.delete?.();

      // Best-effort: turn this tap's hit test into a real anchor, and — if
      // the browser supports it — persist it so a future visit to this
      // same dish can restore it instead of re-scanning. Both steps are
      // fire-and-forget from the tap's perspective: placement itself
      // already happened above via hitMatrix, so a slow/failed anchor
      // response never blocks or undoes what the user just saw happen.
      if (anchorsSupported && nativeHitTestResult && typeof nativeHitTestResult.createAnchor === "function") {
        nativeHitTestResult
          .createAnchor()
          .then((anchor: XRAnchor) => {
            activeAnchor = anchor;
            if (anchorKey && typeof (anchor as any).requestPersistentHandle === "function") {
              (anchor as any)
                .requestPersistentHandle()
                .then((uuid: string) => setStoredAnchorUuid(anchorKey, uuid))
                .catch(() => {
                  // Anchor works for this session either way — persistence
                  // just didn't take, so next visit will re-scan instead.
                });
            }
          })
          .catch(() => {
            // Anchor creation failed — the model is still placed correctly
            // from hitMatrix above, it just won't self-correct or persist.
          });
      }

      // eslint-disable-next-line no-console
      console.log("[WebXRPlacementViewer] Placed model at", placedModel.position, "scale", placedModel.scale);
    }

    // Press-and-hold ON THE MODEL ITSELF starts a drag; releasing ends it.
    // A tap anywhere else on screen (even once a model exists) no longer
    // arms dragging — we raycast the tap's own targetRaySpace pose against
    // the placed model first, and only start the drag if it actually hits.
    // Without that check, any tap anywhere would grab the model and snap it
    // to that touch point, which is exactly the desired "snap to finger"
    // behavior once a genuine drag is confirmed — but only for taps that
    // actually land on the model itself.
    function onSelectStart(event: any) {
      if (!placedModel) return;
      // Position is locked while a twist-rotate is active, and for a beat
      // afterward — don't arm a drag off whichever finger this
      // select-start belongs to during that window.
      if (rotateStartAngle !== null || performance.now() < rotateLockUntil) return;
      const frame = event.frame as XRFrame | undefined;
      if (!frame) return;
      const pose = frame.getPose(event.inputSource.targetRaySpace, localSpace);
      if (!pose) return;

      const m = pose.transform.matrix;
      const origin = new THREE.Vector3(m[12], m[13], m[14]);
      // The ray points down the pose's own -Z axis (the WebXR targetRay
      // convention), i.e. the negated third column of its rotation matrix.
      const direction = new THREE.Vector3(-m[8], -m[9], -m[10]).normalize();
      modelHitRaycaster.set(origin, direction);

      const hits = modelHitRaycaster.intersectObject(placedModel, true);
      if (hits.length > 0) {
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
      if (overlayEl) {
        overlayEl.removeEventListener("touchstart", onOverlayTouchStart);
        overlayEl.removeEventListener("touchmove", onOverlayTouchMove);
        overlayEl.removeEventListener("touchend", onOverlayTouchEnd);
        overlayEl.removeEventListener("touchcancel", onOverlayTouchEnd);
      }
      hitTestSource?.cancel?.();
      transientHitTestSource?.cancel?.();
      renderer.setAnimationLoop(null);
      renderer.domElement.removeEventListener("webglcontextlost", onContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", onContextRestored);
      for (const mesh of planeMeshes.values()) {
        scene.remove(mesh);
        mesh.geometry.dispose();
      }
      planeMeshes.clear();
      planeMaterial.dispose();

      // Reticle geometry/material are created fresh every runArSession call
      // (nothing shares them across sessions), so leaving them undisposed
      // here would leak one set of GPU buffers per AR session entered.
      reticle.geometry.dispose();
      reticleMaterial.dispose();

      // The loaded GLB (pendingModel covers both the placed-and-unplaced
      // cases, since placedModel is just a reference to the same object
      // once placed) can carry a meaningful number of geometries/materials/
      // textures for a detailed dish model — walk and dispose all of them
      // rather than just dropping the JS reference, otherwise every
      // enter/exit of AR on the same dish leaks that model's GPU memory.
      if (pendingModel) {
        disposeObject3D(pendingModel);
      }
      activeAnchor?.delete?.();

      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      sessionRef.current = null;
      // Session ended (user backed out via the system AR UI, or we called
      // endSession() ourselves). Re-entering AR from here requires a fresh
      // tap, so land on "idle" rather than auto-restarting.
      setPhase("idle");
      setRestoredFromMemory(false);
    }
    session.addEventListener("end", onSessionEnd);

    // Reused every frame for the plane-mesh raycast fallback below, to
    // avoid allocating new THREE objects 60 times a second.
    const fallbackRaycaster = new THREE.Raycaster();
    const fallbackViewerMatrix = new THREE.Matrix4();
    const fallbackOrigin = new THREE.Vector3();
    const fallbackDirection = new THREE.Vector3();
    // Reused every frame for the depth-sensing fallback below.
    const depthViewMatrix = new THREE.Matrix4();
    const depthOrigin = new THREE.Vector3();
    const depthForward = new THREE.Vector3();
    const depthPoint = new THREE.Vector3();
    // Reused every frame for the drag-to-move block below.
    const dragMatrix = new THREE.Matrix4();
    const dragPosition = new THREE.Vector3();
    // Reused every frame for the persistent-anchor tracking block below.
    const anchorMatrix = new THREE.Matrix4();
    const anchorPosition = new THREE.Vector3();

    renderer.setAnimationLoop((_time, frame: any) => {
      if (!frame) return;

      const viewerPose = frame.getViewerPose(localSpace);

      syncPlaneMeshes(frame, localSpace);

      // --- Layer 1: native hit test (always computed, drives placement) ---
      hitValid = false;
      nativeHitTestResult = null;
      if (hitTestSource && viewerPose) {
        const hitTestResults = frame.getHitTestResults(hitTestSource);
        if (hitTestResults.length > 0) {
          const pose = hitTestResults[0].getPose(localSpace);
          if (pose) {
            hitMatrix.fromArray(pose.transform.matrix);
            hitValid = true;
            nativeHitTestResult = hitTestResults[0];
          }
        }
      }

      // --- Layer 2: depth-sensing fallback ---
      // The depth-sensing feature (if granted — device/browser dependent)
      // gives a live per-pixel depth buffer that's frequently populated
      // even before layer 1 succeeds, and independently of it. We sample
      // the depth at screen center and project it out along the camera's
      // own forward ray to get a candidate surface point. This is wrapped
      // in a try/catch and a typeof check so browsers without the API (or
      // frames where it hasn't warmed up yet) just fall through to layer 3
      // exactly as before — nothing here can break existing behavior.
      if (!hitValid && viewerPose && typeof frame.getDepthInformation === "function") {
        try {
          const view = viewerPose.views[0];
          const depthInfo = frame.getDepthInformation(view);
          if (depthInfo) {
            const depthMeters = depthInfo.getDepthInMeters(0.5, 0.5);
            if (depthMeters > 0 && isFinite(depthMeters)) {
              depthViewMatrix.fromArray(view.transform.matrix);
              depthOrigin.setFromMatrixPosition(depthViewMatrix);
              depthForward.set(0, 0, -1).transformDirection(depthViewMatrix);
              depthPoint.copy(depthOrigin).addScaledVector(depthForward, depthMeters);
              hitMatrix.makeTranslation(depthPoint.x, depthPoint.y, depthPoint.z);
              hitValid = true;
            }
          }
        } catch {
          // Depth API present but this frame's query failed (e.g. not yet
          // warmed up) — fall through to the plane-mesh raycast below.
        }
      }

      // --- Layer 3: raycast against our own plane meshes ---
      // The native hit test can occasionally miss for a frame or two even
      // though a plane has already been detected right where the user is
      // looking (e.g. near a plane's edge, or just ARCore's own internal
      // update cadence). Rather than treat the hit as missing and waiting,
      // raycast against the plane meshes we already have from
      // plane-detection instead — using data that's already on hand,
      // without waiting on the next native hit-test or depth result.
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

      // Drag-to-move: while a press is active over the placed model (and
      // no twist-rotate is active or in its post-rotate lock window),
      // follow that specific touch point's own hit test each frame,
      // snapping the model directly onto the current hit-test position —
      // it always sits exactly under the finger for the whole drag.
      if (
        draggingInputSource &&
        placedModel &&
        transientHitTestSource &&
        rotateStartAngle === null &&
        performance.now() >= rotateLockUntil
      ) {
        const transientResults = frame.getHitTestResultsForTransientInput(transientHitTestSource);
        for (const result of transientResults) {
          if (result.inputSource === draggingInputSource && result.results.length > 0) {
            const pose = result.results[0].getPose(localSpace);
            if (pose) {
              dragMatrix.fromArray(pose.transform.matrix);
              dragPosition.setFromMatrixPosition(dragMatrix);
              placedModel.position.copy(dragPosition);
              dragOccurred = true;
            }
          }
        }
      }

      // --- Persistent anchor tracking ---
      // Runs whenever we have an active anchor (restored from a previous
      // visit, or created moments ago from this session's own tap) and
      // nothing else is currently manipulating the model. If no model is
      // placed yet, this IS the placement — the moment the anchor's pose
      // resolves, the model appears with no tap required, skipping the
      // scan/reticle phase entirely. If a model is already placed, this
      // keeps re-reading its position from the anchor every frame so it
      // self-corrects if the platform refines that spot over time.
      if (activeAnchor && !draggingInputSource && rotateStartAngle === null) {
        const anchorPose = frame.getPose((activeAnchor as any).anchorSpace, localSpace);
        if (anchorPose) {
          anchorMatrix.fromArray(anchorPose.transform.matrix);
          anchorPosition.setFromMatrixPosition(anchorMatrix);
          if (!placedModel && modelLoaded && pendingModel) {
            placedModel = pendingModel;
            scene.add(placedModel);
            placedModel.position.copy(anchorPosition);
            setPhase("active-placed");
            setRestoredFromMemory(true);
          } else if (placedModel) {
            placedModel.position.copy(anchorPosition);
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
        background: secondaryColor,
        overflow: "hidden",
      }}
    >
      <div ref={containerRef} style={{ width: "100%", height: "100%" }} />

      {/* This element becomes the WebXR DOM overlay once the session starts.
          It's also rendered normally (non-immersive) before/after the
          session, so the same JSX covers both states. pointerEvents is
          "auto" so it can receive real two-finger touch events for the
          rotate gesture — single-finger taps/drags are left alone (we only
          call preventDefault once a second finger lands), so they still
          pass through to WebXR's own 'select' handling untouched. */}
      <div ref={overlayRef} style={{ position: "absolute", inset: 0, pointerEvents: "auto", touchAction: "none" }}>
        {/* Same treatment as SceneViewer's dish-name header: left-aligned,
            white card, much less rounded than the old floating pill, with
            a small vertical accent bar in the restaurant's primaryColor —
            not just similar colors, the actual same layout, so this reads
            as the same page rather than a different screen the user
            "left" when they tapped View in AR. */}
        <div
          style={{
            position: "absolute",
            top: "1.2rem",
            left: "1.2rem",
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10,
            padding: "0.55rem 1.3rem 0.55rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.7rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
            pointerEvents: "none",
          }}
        >
          <div style={{ width: 4, alignSelf: "stretch", borderRadius: 2, background: primaryColor, flexShrink: 0 }} />
          <span
            style={{
              fontSize: "1.05rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              color: "#1a1a1a",
            }}
          >
            {name}
          </span>
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
              background: "#ffffff",
              color: "#1a1a1a",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 999,
              width: 36,
              height: 36,
              fontSize: "1rem",
              cursor: "pointer",
              pointerEvents: "auto",
              boxShadow: "0 2px 10px rgba(0,0,0,0.12)",
            }}
            aria-label="Exit AR"
          >
            ✕
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
              background: "#ffffff",
              color: "#5a5a5a",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 999,
              padding: "0.4rem 0.8rem",
              fontSize: "0.72rem",
              cursor: "pointer",
              pointerEvents: "auto",
              whiteSpace: "nowrap",
              boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
            }}
          >
            Use Scene Viewer instead
          </button>
        )}

        {phase === "active-searching" && (
          <div style={{ ...coachStyle, pointerEvents: "none" }}>
            <span style={{ fontWeight: 700, color: primaryColor }}>Move your phone slowly</span>
            <span style={{ color: "#5a5a5a", fontSize: "0.82rem" }}>
              Green highlights show surfaces found so far — tap one to place.
            </span>
          </div>
        )}

        {phase === "active-placed" && (
          <div style={{ ...coachStyle, top: "auto", bottom: "16%", pointerEvents: "none" }}>
            {restoredFromMemory && (
              <span style={{ fontWeight: 700, color: primaryColor, fontSize: "0.82rem" }}>
                📍 Placed from your last visit
              </span>
            )}
            <span style={{ color: "#5a5a5a", fontSize: "0.82rem" }}>
              Tap elsewhere to move it, drag to slide it, or twist two fingers
              to rotate it.
            </span>
          </div>
        )}

        {phase === "active-searching" && !domOverlaySupported && (
          <div style={{ ...coachStyle, top: "auto", bottom: "30%", pointerEvents: "none" }}>
            <span style={{ color: "#dc2626", fontSize: "0.78rem" }}>
              On-screen guidance isn't available in this browser — point at a
              flat surface and tap to place.
            </span>
          </div>
        )}
      </div>

      {phase === "checking-support" && (
        <div style={overlayStyle}>
          <span style={{ color: secondaryMuted, fontSize: "0.9rem" }}>Checking AR support...</span>
        </div>
      )}

      {phase === "unsupported" && (
        <div style={overlayStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: onSecondary === "#1a1a1a" ? "#dc2626" : "#fca5a5", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              This browser doesn't support WebXR AR. Try Chrome on a recent
              Android phone.
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: primaryColor,
                  color: onPrimary,
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
              background: primaryColor,
              color: onPrimary,
              border: "none",
              borderRadius: 12,
              padding: "0.85rem 2.4rem",
              fontSize: "1rem",
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
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
              width: 36, height: 36, border: `3px solid ${secondaryTrack}`,
              borderTopColor: primaryColor, borderRadius: "50%",
              animation: "xrSpin 0.8s linear infinite",
            }} />
            <span style={{ color: secondaryMuted, fontSize: "0.9rem" }}>Loading 3D model...</span>
          </div>
        </div>
      )}

      {phase === "requesting" && (
        <div style={overlayStyle}>
          <span style={{ color: secondaryMuted, fontSize: "0.9rem" }}>Starting AR session...</span>
        </div>
      )}

      {phase === "denied" && (
        <div style={overlayStyle}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem" }}>
            <span style={{ color: onSecondary === "#1a1a1a" ? "#dc2626" : "#fca5a5", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              Camera access is needed for AR. Please allow camera permissions and try again.
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: primaryColor,
                  color: onPrimary,
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
            <span style={{ color: onSecondary === "#1a1a1a" ? "#dc2626" : "#fca5a5", fontSize: "0.9rem", textAlign: "center", padding: "0 2rem" }}>
              {errorMessage}
            </span>
            {onFallbackToSceneViewer && (
              <button
                onClick={onFallbackToSceneViewer}
                style={{
                  background: primaryColor,
                  color: onPrimary,
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

// Used only for phases with no live camera feed behind them yet/anymore
// (checking-support, unsupported, idle, active-loading, requesting, denied,
// error) — background is transparent on purpose so the parent container's
// secondaryColor (set inline, since it's per-restaurant) shows through
// directly, the same flat-color approach SceneViewer uses rather than a
// separate dark scrim.
const overlayStyle: React.CSSProperties = {
  position: "absolute",
  inset: 0,
  zIndex: 9,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  background: "transparent",
};

// Used only during active AR (camera passthrough is genuinely behind this),
// so unlike overlayStyle above this DOES need its own opaque-ish surface —
// a light frosted card instead of the old dark one, to match the rest of
// the light theme while staying legible over live video.
const coachStyle: React.CSSProperties = {
  position: "absolute",
  top: "18%",
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(255,255,255,0.92)",
  backdropFilter: "blur(8px)",
  border: "1px solid rgba(0,0,0,0.08)",
  borderRadius: 14,
  padding: "0.8rem 1.3rem",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  gap: "0.3rem",
  maxWidth: "78%",
  textAlign: "center",
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
};

// Inject spinner keyframe once
if (typeof document !== "undefined" && !document.getElementById("xr-spinner-style")) {
  const s = document.createElement("style");
  s.id = "xr-spinner-style";
  s.textContent = "@keyframes xrSpin { to { transform: rotate(360deg); } }";
  document.head.appendChild(s);
}