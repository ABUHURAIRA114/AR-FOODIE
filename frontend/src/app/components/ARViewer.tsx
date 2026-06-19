import { useEffect, useState } from "react";
import { Link } from "react-router";
import { QRCodeSVG } from "qrcode.react";

const T = {
  bg: "#0d1a1f",
  bg2: "#111f25",
  bg3: "#16262d",
  primary: "#A65111",
  primaryL: "#C4621A",
  accent: "#DDAA00",
  text: "#e8ddd0",
  muted: "#85AAAA",
  border: "rgba(166,81,17,0.25)",
} as const;

// ── Responsive: portrait/narrow detection ─────────────────────────
function useIsNarrow(breakpoint = 860) {
  const [isNarrow, setIsNarrow] = useState(
    typeof window !== "undefined" ? window.innerWidth < breakpoint : false
  );
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const handler = () => setIsNarrow(mq.matches);
    handler();
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [breakpoint]);
  return isNarrow;
}

function QRCodeBlock({ url, label }: { url: string; label: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.5rem", textAlign: "center" }}>
      <div style={{ width: 140, height: 140, margin: "0 auto", background: "#fff", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", padding: 8 }}>
        <QRCodeSVG value={url} size={124} />
      </div>
      <p style={{ color: T.muted, fontSize: "0.78rem", marginTop: "0.8rem" }}>Scan to view {label} in AR</p>
      <p style={{ color: T.accent, fontSize: "0.72rem", marginTop: "0.3rem", wordBreak: "break-all" }}>
        {url}
      </p>
      <button onClick={handleCopy}
        style={{ marginTop: "0.8rem", background: copied ? "#22c55e" : T.bg2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.8rem", cursor: "pointer", width: "100%" }}>
        {copied ? "✓ Copied!" : "📋 Copy Link"}
      </button>
    </div>
  );
}
const API_URL = (import.meta as any).env.VITE_API_URL || "";
const DEMO_MODEL = {
  name: "DEMO-Dinenics",
  description: "Sample AR model — scan the QR code to view it on your phone.",
 glb_url: `${API_URL}/media/<actual-path-from-step-1>`,
  usdz_url: null as string | null,
 ar_url: `${API_URL}/view/<new-real-uuid>/`,
};

// ── Info panel content (shared between sidebar layout and drawer) ──
function InfoPanelContent({ model, showQR, setShowQR }: { model: typeof DEMO_MODEL; showQR: boolean; setShowQR: (v: boolean) => void }) {
  return (
    <>
      {/* Model info */}
      <div style={{ background: T.bg3, borderRadius: 14, border: `1px solid ${T.border}`, padding: "1.4rem" }}>
        <h2 style={{ fontSize: "1.3rem", fontWeight: 800, color: T.text, marginBottom: "0.5rem" }}>{model.name}</h2>
        <p style={{ color: T.muted, fontSize: "0.88rem", lineHeight: 1.65 }}>{model.description}</p>
        <a href={`${window.location.origin}${model.ar_url}`} target="_blank" rel="noopener noreferrer"
          style={{ display: "inline-block", marginTop: "0.8rem", color: T.accent, fontSize: "0.82rem", textDecoration: "none" }}>
          Open AR view directly →
        </a>
      </div>

      {/* QR / AR button */}
      <div>
        <button onClick={() => setShowQR(!showQR)}
          style={{ width: "100%", background: T.primary, color: "#fff", border: "none", borderRadius: 10, padding: "0.85rem", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer", transition: "transform 0.2s", boxShadow: `0 4px 20px rgba(166,81,17,0.3)` }}>
          {showQR ? "Hide QR Code" : "📱 Show QR Code"}
        </button>
        {showQR && (
          <div style={{ marginTop: "1rem" }}>
            <QRCodeBlock url={`${window.location.origin}${model.ar_url}`} label={model.name} />
          </div>
        )}
      </div>

      {/* How AR works */}
      <div style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.2rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.8rem" }}>How AR Works on Phone</p>
        {[
          ["1", "Customer scans QR on menu"],
          ["2", "Browser opens — no app needed"],
          ["3", "Camera activates, dish appears on their table"],
          ["4", "They place the order with confidence"],
        ].map(([n, s]) => (
          <div key={n} style={{ display: "flex", gap: "0.75rem", marginBottom: "0.6rem", alignItems: "flex-start" }}>
            <span style={{ width: 22, height: 22, borderRadius: "50%", background: "rgba(166,81,17,0.2)", border: `1px solid ${T.primary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.7rem", fontWeight: 700, color: T.accent, flexShrink: 0 }}>{n}</span>
            <p style={{ color: T.muted, fontSize: "0.85rem", lineHeight: 1.5 }}>{s}</p>
          </div>
        ))}
      </div>

      {/* CTA */}
      <Link to="/#pricing"
        style={{ display: "block", background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.2rem 1.4rem", textDecoration: "none", textAlign: "center" }}>
        <p style={{ color: T.text, fontWeight: 700, fontSize: "0.95rem" }}>Want this for your restaurant?</p>
        <p style={{ color: T.accent, fontSize: "0.85rem", marginTop: "0.25rem" }}>Starting at Rs 1,200 / model →</p>
      </Link>
    </>
  );
}

// ── AR Viewer Page ────────────────────────────────────────────────
export function ARViewer() {
  const [showQR, setShowQR] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isNarrow = useIsNarrow();

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Segoe UI',system-ui,sans-serif", overflowX: "hidden" }}>

      {/* Top bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: isNarrow ? "1rem 1.25rem" : "1rem 2rem", borderBottom: `1px solid ${T.border}`, background: "rgba(13,26,31,0.85)", backdropFilter: "blur(14px)", position: "sticky", top: 0, zIndex: 50 }}>
        <Link to="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", color: T.muted, fontSize: "0.88rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 12H5M12 5l-7 7 7 7" /></svg>
          {!isNarrow && "Back to Dinenics"}
        </Link>
        <span style={{ fontSize: isNarrow ? "1.05rem" : "1.2rem", fontWeight: 800, color: T.accent }}>
          Dinenics Viewer
        </span>

        {isNarrow ? (
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8,
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T.text, padding: 0, flexShrink: 0,
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="5" r="1.8" fill="currentColor" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              <circle cx="12" cy="19" r="1.8" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <span style={{ background: "rgba(166,81,17,0.12)", border: `1px solid rgba(166,81,17,0.4)`, color: T.accent, fontSize: "0.72rem", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", padding: "0.25rem 0.7rem", borderRadius: 999 }}>
            AR Preview
          </span>
        )}
      </div>

      <div style={{ display: isNarrow ? "block" : "grid", gridTemplateColumns: isNarrow ? undefined : "1fr 360px", minHeight: "calc(100vh - 65px)" }}>

        {/* 3D preview */}
        <div style={{ position: "relative", background: T.bg, height: isNarrow ? "60vh" : "auto", minHeight: isNarrow ? 380 : undefined }}>
          <div style={{ position: "absolute", top: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 10, background: "rgba(13,26,31,0.7)", border: `1px solid ${T.border}`, backdropFilter: "blur(10px)", borderRadius: 999, padding: "0.4rem 1rem", fontSize: "0.78rem", color: T.muted, whiteSpace: "nowrap" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e", display: "inline-block", boxShadow: "0 0 8px #22c55e", marginRight: "0.5rem" }} />
            Drag to rotate · 3D Preview
          </div>

          <model-viewer
            key="demo"
            src={DEMO_MODEL.glb_url}
            alt={DEMO_MODEL.name}
            camera-controls
            auto-rotate
            shadow-intensity="1"
            style={{ width: "100%", height: "100%", background: "transparent" }}
          />

          <div style={{ position: "absolute", bottom: "1.5rem", left: "50%", transform: "translateX(-50%)", zIndex: 10, textAlign: "center", padding: "0 1rem" }}>
            <p style={{ color: T.muted, fontSize: "0.78rem" }}>
              {isNarrow ? "Tap the menu icon above to view the QR code" : "Scan QR code on the right to view this model in real AR on your phone"}
            </p>
          </div>
        </div>

        {/* Right: info panel — only rendered inline on wide screens */}
        {!isNarrow && (
          <div style={{ background: T.bg2, borderLeft: `1px solid ${T.border}`, padding: "2rem", display: "flex", flexDirection: "column", gap: "1.5rem", overflowY: "auto" }}>
            <InfoPanelContent model={DEMO_MODEL} showQR={showQR} setShowQR={setShowQR} />
          </div>
        )}
      </div>

      {/* Backdrop + sidebar drawer for narrow/portrait screens */}
      {isNarrow && (
        <>
          <div
            onClick={closeDrawer}
            style={{
              position: "fixed", inset: 0, zIndex: 199,
              background: "rgba(0,0,0,0.5)",
              opacity: drawerOpen ? 1 : 0,
              pointerEvents: drawerOpen ? "auto" : "none",
              transition: "opacity 0.3s ease",
            }}
          />
          <aside style={{
            position: "fixed", top: 0, right: 0, height: "100vh", width: "min(86vw, 360px)",
            background: T.bg2, borderLeft: `1px solid ${T.border}`, zIndex: 200,
            transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
            transition: "transform 0.32s ease",
            display: "flex", flexDirection: "column", gap: "1.5rem", padding: "1.25rem",
            overflowY: "auto",
            boxShadow: drawerOpen ? "-8px 0 30px rgba(0,0,0,0.35)" : "none",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontSize: "1.2rem", fontWeight: 800, color: T.accent }}>Model Info</span>
              <button
                aria-label="Close menu"
                onClick={closeDrawer}
                style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, padding: 0 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>
            <InfoPanelContent model={DEMO_MODEL} showQR={showQR} setShowQR={setShowQR} />
          </aside>
        </>
      )}
    </div>
  );
}
