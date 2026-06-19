import { useEffect, useRef, useState } from "react";
import { useParams } from "react-router";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface SceneData {
  id: string;
  name: string;
  description: string;
  parent: string;
  glb_url: string | null;
  usdz_url: string | null;
}

const T = {
  bg: "#0d1a1f",
  text: "#e8ddd0",
  primary: "#A65111",
  accent: "#DDAA00",
  muted: "#85AAAA",
  border: "rgba(166,81,17,0.4)",
} as const;

export function SceneViewer() {
  const { id } = useParams<{ id: string }>();

  const [scene, setScene] = useState<SceneData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [arActive, setArActive] = useState(false);
  const viewerRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    const handleArStatus = (e: any) => {
      setArActive(e.detail?.status === "session-started");
    };
    viewer.addEventListener("ar-status", handleArStatus);
    return () => viewer.removeEventListener("ar-status", handleArStatus);
  }, [scene]);

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
      <div style={{ background: T.bg, color: T.muted, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        Loading...
      </div>
    );
  }

  if (error || !scene || !scene.glb_url) {
    return (
      <div style={{ background: T.bg, color: "#f87171", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Segoe UI',system-ui,sans-serif" }}>
        {error || "Model not found."}
      </div>
    );
  }

  return (
    <div style={{ height: "100vh", width: "100%", background: T.bg, color: T.text, fontFamily: "'Segoe UI',system-ui,sans-serif", display: "flex", flexDirection: "column", position: "relative", overflow: "hidden" }}>
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

      {/* @ts-ignore - model-viewer is a web component */}
      <model-viewer
        ref={viewerRef}
        id="viewer"
        src={scene.glb_url}
        ios-src={scene.usdz_url || undefined}
        alt={scene.name}
        ar
        ar-modes="webxr scene-viewer quick-look"
        camera-controls
        auto-rotate
        shadow-intensity="1"
        style={{ width: "100%", flex: 1, background: "transparent" }}
      >
        <button
          slot="ar-button"
          style={{
            position: "absolute",
            bottom: "20%",
            left: "50%",
            transform: "translateX(-50%)",
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
      </model-viewer>
    </div>
  );
}