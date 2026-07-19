import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { T } from "./tokens.mts";
import { ImageTrackingViewer } from "./ImageTrackingViewer";
import { WebXRPlacementViewer } from "./WebXRPlacementViewer";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface SceneData {
  id: string;
  name: string;
  description: string;
  parent: string;
  glb_url: string | null;
  usdz_url: string | null;
  /** Compiled MindAR .mind target file for the image-tracking fallback. */
  mind_target_url?: string | null;
  exposure: number;
  shadow_intensity: number;
  shadow_softness: number;
  tone_mapping: string;
  environment_image: string;
  environment_image_url: string | null;
  ar_scale: "auto" | "fixed";
  webxr_model_scale: number;
}

export function SceneViewer() {
  const { id } = useParams<{ id: string }>();

  const [scene, setScene] = useState<SceneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [arActive, setArActive] = useState(false);
  const [arSupported, setArSupported] = useState(true);
  const [arMessage, setArMessage] = useState<string | null>(null);

  const [modelLoading, setModelLoading] = useState(true);
  const [modelError, setModelError] = useState(false);
  const [modelProgress, setModelProgress] = useState(0);

  const [imageTrackingActive, setImageTrackingActive] = useState(false);
  const [showArGuide, setShowArGuide] = useState(false);

  // Custom tap-to-place WebXR path, separate from model-viewer's AR entirely.
  // This is our top-priority AR entry point (see render below): when the
  // browser supports WebXR immersive-ar + hit-test, we use OUR OWN flow
  // instead of deferring to Scene Viewer / Quick Look.
  const [webXrActive, setWebXrActive] = useState(false);
  const [webXrSupported, setWebXrSupported] = useState(false);

  const viewerRef = useRef<HTMLElement>(null);

  // --- WebXR hit-test support detection (for the custom tap-to-place path) ---
  // Independent of model-viewer's canActivateAR, since model-viewer's ar-modes
  // no longer includes "webxr" — this checks the raw browser capability that
  // WebXRPlacementViewer needs directly.
  useEffect(() => {
    let cancelled = false;
    if (!("xr" in navigator)) return;
    (navigator as any).xr
      .isSessionSupported("immersive-ar")
      .then((supported: boolean) => {
        if (!cancelled) setWebXrSupported(supported);
      })
      .catch(() => {
        if (!cancelled) setWebXrSupported(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // --- AR status (active/inactive only) ---
  // model-viewer's ar-modes no longer includes "webxr", so only Scene Viewer /
  // Quick Look fullscreen transitions fire this now. The richer WebXR-only
  // sub-states (object-placed, ar-tracking's not-tracking) can't occur
  // through model-viewer anymore — those are handled by WebXRPlacementViewer
  // instead, which talks to WebXR directly.
  useEffect(() => {
    const viewer = viewerRef.current as any;
    if (!viewer) return;

    const handleArStatus = (e: any) => {
      const status = e.detail?.status;
      setArActive(status === "session-started");
      if (status === "failed") {
        setArMessage("AR couldn't start on this device. Try a different browser or device.");
      } else if (status === "session-started") {
        setArMessage(null);
      }
    };

    viewer.addEventListener("ar-status", handleArStatus);
    return () => viewer.removeEventListener("ar-status", handleArStatus);
  }, [scene]);

  // --- Model load progress / success / error ---
  useEffect(() => {
    const viewer = viewerRef.current as any;
    if (!viewer) return;

    setModelLoading(true);
    setModelError(false);
    setModelProgress(0);

    const handleProgress = (e: any) => {
      const pct = Math.round((e.detail?.totalProgress ?? 0) * 100);
      setModelProgress(pct);
    };

    const handleLoad = () => {
      setModelLoading(false);
      setModelProgress(100);
      // canActivateAR is only reliable once the model has loaded
      setArSupported(Boolean(viewer.canActivateAR));
    };

    const handleError = () => {
      setModelLoading(false);
      setModelError(true);
    };

    viewer.addEventListener("progress", handleProgress);
    viewer.addEventListener("load", handleLoad);
    viewer.addEventListener("error", handleError);

    return () => {
      viewer.removeEventListener("progress", handleProgress);
      viewer.removeEventListener("load", handleLoad);
      viewer.removeEventListener("error", handleError);
    };
  }, [scene]);

  // --- Fetch scene data ---
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    setError(null);

    // Reset all AR/model UI state so a stale view from the previous scene
    // doesn't flash while the new one loads (matters if this component stays
    // mounted while navigating between dishes, e.g. via a carousel).
    setArActive(false);
    setArMessage(null);
    setArSupported(true);
    setModelLoading(true);
    setModelError(false);
    setModelProgress(0);
    setImageTrackingActive(false);
    setShowArGuide(false);
    setWebXrActive(false);

    fetch(`${API_URL}/api/scene/${id}/`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then((data) => setScene(data))
      .catch(() => setError("Could not load this model."))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div
        style={{
          background: T.bg,
          color: T.muted,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }}
      >
        Loading...
      </div>
    );
  }

  if (error || !scene || !scene.glb_url) {
    return (
      <div
        style={{
          background: T.bg,
          color: "#f87171",
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Segoe UI',system-ui,sans-serif",
        }}
      >
        {error || "Model not found."}
      </div>
    );
  }

  if (imageTrackingActive && scene.mind_target_url) {
    return (
      <ImageTrackingViewer
        glbUrl={scene.glb_url}
        mindTargetUrl={scene.mind_target_url}
        name={scene.name}
        onExit={() => setImageTrackingActive(false)}
      />
    );
  }

  if (webXrActive) {
    return (
      <WebXRPlacementViewer
        glbUrl={scene.glb_url}
        name={scene.name}
        modelScale={scene.webxr_model_scale}
        onExit={() => setWebXrActive(false)}
        onFallbackToSceneViewer={() => {
          setWebXrActive(false);
          setWebXrSupported(false); // forces the model-viewer AR button (Scene Viewer / Quick Look) to show
        }}
      />
    );
  }

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: T.bg,
        color: T.text,
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dish name overlay */}
      {!arActive && (
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
          {scene.name}
        </div>
      )}

      {/* Model load progress overlay */}
      {!arActive && modelLoading && !modelError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.9rem",
            background: T.bg,
          }}
        >
          <div
            style={{
              width: 160,
              height: 6,
              borderRadius: 999,
              background: "rgba(255,255,255,0.08)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${modelProgress}%`,
                height: "100%",
                background: T.primary,
                borderRadius: 999,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "0.85rem", color: T.muted }}>
            Loading model{modelProgress > 0 ? ` ${modelProgress}%` : "..."}
          </span>
        </div>
      )}

      {/* Model load error overlay */}
      {!arActive && modelError && (
        <div
          style={{
            position: "absolute",
            inset: 0,
            zIndex: 9,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: T.bg,
            color: "#f87171",
            fontSize: "0.95rem",
            textAlign: "center",
            padding: "0 2rem",
          }}
        >
          Couldn't load this 3D model. Please try again later.
        </div>
      )}

      {/* AR status / error toast */}
      {arMessage && (
        <div
          style={{
            position: "absolute",
            bottom: "16%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 11,
            background: "rgba(13,26,31,0.9)",
            border: `1px solid ${T.border}`,
            borderRadius: 10,
            padding: "0.6rem 1.1rem",
            fontSize: "0.85rem",
            color: "#f87171",
            maxWidth: "80%",
            textAlign: "center",
          }}
        >
          {arMessage}
        </div>
      )}

      {/*
        PRIMARY AR ENTRY POINT — priority order:
          1) Our own WebXR tap-to-place flow (WebXRPlacementViewer), shown
             whenever the browser supports WebXR immersive-ar + hit-test.
             This is a from-scratch AR session with real reticle + tap
             placement — no Scene Viewer / Quick Look / Google or Apple AR
             involved.
          2) If WebXR isn't supported, we fall back to model-viewer's native
             AR button (slotted below), which auto-routes per platform via
             ar-modes="scene-viewer quick-look":
               - iOS  -> Quick Look (via ios-src / quick-look-browsers)
               - Android (no WebXR hit-test) -> Scene Viewer
        Only one of the two buttons is ever visible/clickable at a time,
        controlled by webXrSupported.
      */}
      {!arActive && !modelLoading && webXrSupported && (
        <button
          onClick={() => setWebXrActive(true)}
          style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            background: T.primary,
            color: "#fff",
            border: "none",
            borderRadius: 12,
            padding: "0.85rem 2.4rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 4px 24px rgba(166,81,17,0.4)",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          View in AR
        </button>
      )}

      {/*
        IMAGE TRACKING fallback trigger — only shown once we know neither
        WebXR (our own tap-to-place flow) nor model-viewer's Scene Viewer /
        Quick Look AR is available on this device, and a compiled .mind
        target exists for this scene.
      */}
      {!arActive && !modelLoading && scene.mind_target_url && (
        <div
          style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
          }}
        >
          <button
            onClick={() => setImageTrackingActive(true)}
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
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
            Scan to view in AR
          </button>

          <button
            onClick={() => setShowArGuide(true)}
            aria-label="How does this work?"
            style={{
              width: 40,
              height: 40,
              borderRadius: "50%",
              background: "rgba(13,26,31,0.85)",
              border: `1px solid ${T.border}`,
              color: T.accent,
              fontWeight: 700,
              fontSize: "1rem",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            ?
          </button>
        </div>
      )}

      {/* Guide modal explaining the image-tracking AR flow */}
      {showArGuide && (
        <div
          onClick={() => setShowArGuide(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 20,
            background: "rgba(0,0,0,0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.5rem",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: T.bg3,
              border: `1px solid ${T.border}`,
              borderRadius: 14,
              padding: "1.5rem",
              maxWidth: 340,
            }}
          >
            <p style={{ fontWeight: 700, color: T.accent, marginBottom: "0.6rem" }}>
              How image tracking AR works
            </p>
            {[
              'Tap "Scan to view in AR"',
              "Allow camera access when asked",
              "Point your camera at the menu photo / table tent",
              "Hold steady in good light until the dish appears on top",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                <span style={{ color: T.accent, fontWeight: 700 }}>{i + 1}.</span>
                <span style={{ color: T.muted, fontSize: "0.88rem" }}>{step}</span>
              </div>
            ))}
            <button
              onClick={() => setShowArGuide(false)}
              style={{
                marginTop: "0.8rem",
                width: "100%",
                background: T.primary,
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "0.6rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}


      {/* @ts-ignore - model-viewer is a web component */}
      <model-viewer
        ref={viewerRef}
        id="viewer"
        src={scene.glb_url}
        ios-src={scene.usdz_url}
        alt={scene.name}
        ar
        ar-modes="scene-viewer quick-look"
        quick-look-browsers="safari chrome firefox"
        ar-placement="floor"
        camera-controls
        auto-rotate
        camera-orbit="0deg 75deg 105%"
        min-camera-orbit="auto 35deg 60%"
        max-camera-orbit="auto 90deg 200%"
        min-field-of-view="12deg"
        max-field-of-view="45deg"
        interaction-prompt="auto"
        interaction-prompt-style="basic"
        interaction-prompt-threshold="2000"
        exposure={String(scene.exposure)}
        shadow-intensity={String(scene.shadow_intensity)}
        shadow-softness={String(scene.shadow_softness)}
        tone-mapping={scene.tone_mapping}
        environment-image={scene.environment_image_url || scene.environment_image}
        ar-scale={scene.ar_scale}
        loading="eager"
        reveal="auto"
        style={{ width: "100%", flex: 1, background: "transparent" }}
      >
        <button
          slot="ar-button"
          disabled={!arSupported}
          style={{
            position: "absolute",
            bottom: "10%",
            left: "50%",
            transform: "translateX(-50%)",
            background: arSupported ? T.primary : "rgba(255,255,255,0.12)",
            color: arSupported ? "#fff" : T.muted,
            border: "none",
            borderRadius: 12,
            padding: "0.85rem 2.4rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: arSupported ? "pointer" : "not-allowed",
            boxShadow: arSupported ? "0 4px 24px rgba(166,81,17,0.4)" : "none",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            // Fallback button: only shown once we know WebXR (our own flow)
            // is unavailable — WebXR always takes priority when supported.
            opacity: modelLoading || webXrSupported ? 0 : 1,
            transition: "opacity 0.2s ease",
            pointerEvents: modelLoading || webXrSupported ? "none" : "auto",
          }}
          title={arSupported ? "View in AR" : "AR isn't supported on this device or browser"}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M12 2L2 7l10 5 10-5-10-5z" />
            <path d="M2 17l10 5 10-5" />
            <path d="M2 12l10 5 10-5" />
          </svg>
          {arSupported ? "View in AR" : "AR not supported"}
        </button>
      </model-viewer>
    </div>
  );
}