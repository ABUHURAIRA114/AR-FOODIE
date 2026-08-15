import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { T } from "./tokens.mts";
import { ImageTrackingViewer } from "./ImageTrackingViewer";
import { WebXRPlacementViewer } from "./WebXRPlacementViewer";
import { getContrastTextColor } from "../lib/colorContrast";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface SceneData {
  id: string;
  name: string;
  description: string;
  glb_url: string | null;
  usdz_url: string | null;
  /** Compiled MindAR .mind target file for the image-tracking fallback. */
  mind_target_url?: string | null;
  /** The dish's restaurant's brand color — drives every accent/button on this page. */
  primary_color?: string | null;
  /** The restaurant's second brand color — this page's own background. */
  secondary_color?: string | null;
  exposure: number;
  shadow_intensity: number;
  shadow_softness: number;
  tone_mapping: string;
  environment_image: string;
  environment_image_url?: string | null;
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

    fetch(`${API_URL}/menu-api/dish/${id}/`, { credentials: "include" })
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
          background: "#ffffff",
          color: "#8a8a8a",
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
          background: "#ffffff",
          color: "#dc2626",
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
        exposure={scene.exposure}
        primaryColor={scene.primary_color}
        secondaryColor={scene.secondary_color}
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
        anchorKey={scene.id}
        exposure={scene.exposure}
        primaryColor={scene.primary_color}
        secondaryColor={scene.secondary_color}
        onExit={() => setWebXrActive(false)}
        onFallbackToSceneViewer={() => {
          setWebXrActive(false);
          setWebXrSupported(false); // forces the model-viewer AR button (Scene Viewer / Quick Look) to show
        }}
      />
    );
  }

  // Every accent on this page (header bar, AR buttons, progress fill,
  // spinner, help button) traces back to this one restaurant color,
  // falling back to the app default only if the API didn't send one.
  // Button text picks black/white automatically since restaurants choose
  // arbitrary brand colors that can be light or dark.
  const primaryColor = scene.primary_color || T.primary;
  const onPrimary = getContrastTextColor(primaryColor, "#1a1a1a", "#ffffff");

  // The restaurant's second brand color is this whole page's background —
  // also arbitrary (light or dark), so ordinary page text (captions, error
  // copy) picks its own readable color the same way button text does. The
  // header/toast/modal stay self-contained white cards regardless, so they
  // don't need this — only text sitting directly on the page background does.
  const secondaryColor = scene.secondary_color || "#ffffff";
  const onSecondary = getContrastTextColor(secondaryColor, "#1a1a1a", "#ffffff");
  const secondaryMuted = onSecondary === "#1a1a1a" ? "rgba(26,26,26,0.55)" : "rgba(255,255,255,0.65)";
  const secondaryTrack = onSecondary === "#1a1a1a" ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.18)";

  return (
    <div
      style={{
        height: "100vh",
        width: "100%",
        background: secondaryColor,
        color: onSecondary,
        fontFamily: "'Segoe UI',system-ui,sans-serif",
        display: "flex",
        flexDirection: "column",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Dish name header — shifted to the left with a small vertical accent
          bar in the restaurant's primary color, and a much less rounded
          corner treatment than the old floating pill. */}
      {!arActive && (
        <div
          style={{
            position: "absolute",
            top: "1.2rem",
            left: "1.2rem",
            zIndex: 10,
            background: "#ffffff",
            border: "1px solid rgba(0,0,0,0.08)",
            borderRadius: 10,
            padding: "0.55rem 1.3rem 0.55rem 0.9rem",
            display: "flex",
            alignItems: "center",
            gap: "0.7rem",
            boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
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
            {scene.name}
          </span>
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
            background: secondaryColor,
          }}
        >
          <div
            style={{
              width: 160,
              height: 6,
              borderRadius: 999,
              background: secondaryTrack,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                width: `${modelProgress}%`,
                height: "100%",
                background: primaryColor,
                borderRadius: 999,
                transition: "width 0.2s ease",
              }}
            />
          </div>
          <span style={{ fontSize: "0.85rem", color: secondaryMuted }}>
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
            background: secondaryColor,
            color: onSecondary === "#1a1a1a" ? "#dc2626" : "#fca5a5",
            fontSize: "0.95rem",
            textAlign: "center",
            padding: "0 2rem",
          }}
        >
          Couldn't load this 3D model. Please try again later.
        </div>
      )}

      {/*
        UNIFIED BOTTOM ACTION ROW
        ---------------------------------------------------------------
        View in AR and Scan to view in AR now sit side by side in one
        horizontal row (instead of stacked), wrapping to a second line on
        very narrow screens if both happen to be present at once. The
        optional AR status toast sits above that row in normal (not
        reversed) flex-column order, so it never needs to fight the row
        for horizontal space.

        The one thing NOT in this stack is model-viewer's native
        Scene Viewer / Quick Look button — it must stay physically
        nested inside <model-viewer> for its slot to work. It's pinned
        at a fixed bottom:10%, so this stack's own anchor shifts up by
        one row's height + gap whenever that native button is the one
        actually visible (i.e. whenever webXrSupported is false).
      */}
      {!arActive && !modelLoading && (
        <div
          style={{
            position: "absolute",
            bottom: webXrSupported ? "10%" : "calc(10% + 64px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 10,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          {arMessage && (
            <div
              style={{
                background: "#ffffff",
                border: "1px solid rgba(0,0,0,0.08)",
                borderRadius: 10,
                padding: "0.6rem 1.1rem",
                fontSize: "0.85rem",
                color: "#dc2626",
                maxWidth: "80vw",
                textAlign: "center",
                boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
              }}
            >
              {arMessage}
            </div>
          )}

          {/* View in AR + Scan to view in AR, horizontally aligned. */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              justifyContent: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            {webXrSupported && (
              <button
                onClick={() => setWebXrActive(true)}
                style={{
                  background: primaryColor,
                  color: onPrimary,
                  border: "none",
                  borderRadius: 12,
                  padding: "0.85rem 2.2rem",
                  fontSize: "1rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  whiteSpace: "nowrap",
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
              IMAGE TRACKING trigger — shown whenever a compiled .mind
              target exists for this scene, as an alternative AR method
              alongside WebXR / Scene Viewer / Quick Look (not just as a
              last-resort fallback).
            */}
            {scene.mind_target_url && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                <button
                  onClick={() => setImageTrackingActive(true)}
                  style={{
                    background: primaryColor,
                    color: onPrimary,
                    border: "none",
                    borderRadius: 12,
                    padding: "0.85rem 2.2rem",
                    fontSize: "1rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 4px 20px rgba(0,0,0,0.18)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    whiteSpace: "nowrap",
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
                    background: "#ffffff",
                    border: "1px solid rgba(0,0,0,0.1)",
                    color: primaryColor,
                    fontWeight: 700,
                    fontSize: "1rem",
                    cursor: "pointer",
                    flexShrink: 0,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
                  }}
                >
                  ?
                </button>
              </div>
            )}
          </div>
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
              background: "#ffffff",
              border: "1px solid rgba(0,0,0,0.08)",
              borderRadius: 14,
              padding: "1.5rem",
              maxWidth: 340,
            }}
          >
            <p style={{ fontWeight: 700, color: primaryColor, marginBottom: "0.6rem" }}>
              How image tracking AR works
            </p>
            {[
              'Tap "Scan to view in AR"',
              "Allow camera access when asked",
              "Point your camera at the menu photo / table tent",
              "Hold steady in good light until the dish appears on top",
            ].map((step, i) => (
              <div key={i} style={{ display: "flex", gap: "0.6rem", marginBottom: "0.5rem" }}>
                <span style={{ color: primaryColor, fontWeight: 700 }}>{i + 1}.</span>
                <span style={{ color: "#5a5a5a", fontSize: "0.88rem" }}>{step}</span>
              </div>
            ))}
            <button
              onClick={() => setShowArGuide(false)}
              style={{
                marginTop: "0.8rem",
                width: "100%",
                background: primaryColor,
                color: onPrimary,
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
            background: arSupported ? primaryColor : "rgba(0,0,0,0.08)",
            color: arSupported ? onPrimary : "#9a9a9a",
            border: "none",
            borderRadius: 12,
            padding: "0.85rem 2.4rem",
            fontSize: "1rem",
            fontWeight: 700,
            cursor: arSupported ? "pointer" : "not-allowed",
            boxShadow: arSupported ? "0 4px 20px rgba(0,0,0,0.18)" : "none",
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