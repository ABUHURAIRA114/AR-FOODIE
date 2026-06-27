import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";
import { T } from "./tokens.mts";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface SceneData {
  id: string;
  name: string;
  description: string;
  parent: string;
  glb_url: string | null;
  usdz_url: string | null;
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

  const viewerRef = useRef<HTMLElement>(null);

  // --- AR status + support detection ---
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

      {/* @ts-ignore - model-viewer is a web component */}
      <model-viewer
        ref={viewerRef}
        id="viewer"
        src={scene.glb_url}
        ios-src={scene.usdz_url}
        alt={scene.name}
        ar
        ar-modes="webxr scene-viewer quick-look"
        ar-scale="fixed"
        ar-placement="floor"
        camera-controls
        auto-rotate
        camera-orbit="0deg 75deg 105%"
        shadow-intensity="1"
        environment-image="neutral"
        exposure="1"
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
            opacity: modelLoading ? 0 : 1,
            transition: "opacity 0.2s ease",
            pointerEvents: modelLoading ? "none" : "auto",
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