import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { checkUserAuth, logoutRequest } from "../lib/auth";
import logo from "../../assets/logo.webp";
import manAtTable from "../../assets/ManNTable.webp";
import pizzaAsset from "../../assets/Pizza.webp";
import cashAsset from "../../assets/Cash.webp";
import qrAsset from "../../assets/QR.webp";
import { T } from "./tokens.mts";

<link href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap" rel="stylesheet"></link>


// ── Tiny helpers ───────────────────────────────────────────────────
function AccentText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ color: T.accent }}>
      {children}
    </span>
  );
}

function GlowLine({ center = true }: { center?: boolean }) {
  return (
    <div style={{
      width: 80, height: 2, borderRadius: 2,
      background: T.primary,
      margin: center ? "0.75rem auto 0" : "0.75rem 0 0",
    }} />
  );
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: T.accent, marginBottom: "0.5rem" }}>
      {children}
    </p>
  );
}

// ── Small circular "tap here" cursor badge for image hotspots ─────
function TapBadge() {
  return (
    <div style={{
      position: "absolute", top: -8, right: -8, zIndex: 6,
      width: 24, height: 24, borderRadius: "50%",
      background: T.bg3, border: `1.5px solid ${T.accent}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      boxShadow: "0 3px 8px rgba(0,0,0,0.35)",
    }}>
      <svg width="12" height="12" viewBox="0 0 24 24">
        <path d="M4 3l16.5 6.7-7 2.6-2.6 7z" fill={T.accent} />
      </svg>
    </div>
  );
}

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

// ── Intersection fade ──────────────────────────────────────────────
function useFadeIn() {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    el.style.transition = "opacity 0.7s ease, transform 0.7s ease";
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return ref;
}

function FadeUp({ children, delay = 0, style = {} }: { children: React.ReactNode; delay?: number; style?: React.CSSProperties }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.opacity = "0";
    el.style.transform = "translateY(28px)";
    el.style.transition = `opacity 0.7s ease ${delay}s, transform 0.7s ease ${delay}s`;
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        el.style.opacity = "1";
        el.style.transform = "translateY(0)";
        obs.disconnect();
      }
    }, { threshold: 0.1 });
    obs.observe(el);
    return () => obs.disconnect();
  }, [delay]);
  return <div ref={ref} style={style}>{children}</div>;
}


// Add this import at the top of your file (with other imports)
// import { Link, useNavigate } from "react-router-dom";

// ── LOGO SVG (inline, matches the uploaded knife logo) ────────────
function DinenicsBrandLogo() {
  return (
    <Link
      to="/"
      style={{
        textDecoration: "none",
        display: "inline-flex",
        alignItems: "center",
        gap: "0.6rem",
        transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      <div style={{
        background: T.bg3,
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(245, 184, 0, 0.15)",
        border: "1px solid rgba(255, 255, 255, 0.03)",
        width: "55px",
        height: "55px",
        overflow: "hidden",
        flexShrink: 0,
      }}>
        <img
          src={logo}
          alt="Dinenics Logo"
          style={{ width: "200px", height: "200px", objectFit: "contain", display: "block" }}
        />
      </div>
      <span style={{
        fontFamily: "'Pacifico', cursive",
        fontSize: "1.6rem",
        color: "#f5b800",
        letterSpacing: "0.01em",
        lineHeight: 1,
      }}>
        Dinenics
      </span>
    </Link>
  );
}

// ── NAV ───────────────────────────────────────────────────────────
// ── Plain text nav link (no background, no pill) ──────────────────
function NavTextLink({ to, onClick, children }: { to: string; onClick?: () => void; children: React.ReactNode }) {
  return (
    <Link to={to} onClick={onClick}
      style={{
        color: T.muted, textDecoration: "none",
        fontSize: "0.88rem", fontWeight: 600,
        transition: "color 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.color = T.accent)}
      onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
      {children}
    </Link>
  );
}

const navLinks: [string, string][] = [["#how", "How It Works"]];
function Nav() {
  const [isUser, setIsUser] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();

  useEffect(() => {
    checkUserAuth()
      .then(data => setIsUser(data.is_user))
      .catch(() => setIsUser(false));
  }, []);

  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const handleLogout = async () => {
    await logoutRequest();
    setIsUser(false);
    setDropdownOpen(false);
    navigate("/");
  };

  return (
    <nav style={{
      position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
      display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: isNarrow ? "0.6rem 1rem" : "0.6rem 1.5rem",
      background: "rgba(5, 14, 17, 0.6)",
      backdropFilter: "blur(20px)",
      borderBottom: "1px solid rgba(245,184,0,0.12)",
    }}>

      {/* ── BRAND ── */}
      <DinenicsBrandLogo />

      {/* ── CENTER PILL (wide only) ── */}
      {!isNarrow && (
        <div style={{
          position: "absolute", left: "50%", transform: "translateX(-50%)",
          display: "flex", alignItems: "center", gap: "0.15rem",
          background: "rgba(255,255,255,0.04)",
          border: "1px solid rgba(245,184,0,0.15)",
          borderRadius: 10,
          padding: "0.3rem 0.4rem",
        }}>
          {navLinks.map(([href, label]) => (
            <a key={href} href={href}
              style={{
                color: "rgba(232,221,208,0.6)", textDecoration: "none",
                fontSize: "0.82rem", fontWeight: 600, padding: "0.4rem 1rem",
                borderRadius: 8, transition: "background 0.2s, color 0.2s",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.1)"; e.currentTarget.style.color = "#f5b800"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.6)"; }}>
              {label}
            </a>
          ))}
          <a href="#pricing"
            style={{
              color: "rgba(232,221,208,0.6)", textDecoration: "none",
              fontSize: "0.82rem", fontWeight: 600, padding: "0.4rem 1rem",
              borderRadius: 8, transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.1)"; e.currentTarget.style.color = "#f5b800"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.6)"; }}>
            Pricing
          </a>
          <a href="#video"
            style={{
              color: "rgba(232,221,208,0.6)", textDecoration: "none",
              fontSize: "0.82rem", fontWeight: 600, padding: "0.4rem 1rem",
              borderRadius: 8, transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.1)"; e.currentTarget.style.color = "#f5b800"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.6)"; }}>
            Demo
          </a>

          <a href="/restaurants"
            style={{
              color: "rgba(232,221,208,0.6)", textDecoration: "none",
              fontSize: "0.82rem", fontWeight: 600, padding: "0.4rem 1rem",
              borderRadius: 8, transition: "background 0.2s, color 0.2s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.1)"; e.currentTarget.style.color = "#f5b800"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.6)"; }}>
            Restaurants
          </a>
          
        </div>
      )}

      {/* ── RIGHT SIDE ── */}
      {isNarrow ? (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>

          {isUser ? (
            <Link to="/models" style={{
              fontSize: "0.8rem", fontWeight: 700, color: "#f5b800",
              textDecoration: "none", padding: "0.4rem 0.9rem",
              border: "1px solid rgba(245,184,0,0.35)", borderRadius: 8,
              transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,184,0,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Models
            </Link>
          ) : (
            <Link to="/user-login" style={{
              fontSize: "0.8rem", fontWeight: 700, color: "#f5b800",
              textDecoration: "none", padding: "0.4rem 0.9rem",
              border: "1px solid rgba(245,184,0,0.35)", borderRadius: 8,
              transition: "background 0.2s",
            }}
              onMouseEnter={e => (e.currentTarget.style.background = "rgba(245,184,0,0.1)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
              Log In
            </Link>
          )}

          <div ref={dropdownRef} style={{ position: "relative" }}>
            <button
              aria-label="More options"
              onClick={() => setDropdownOpen(v => !v)}
              style={{
                background: dropdownOpen ? "rgba(245,184,0,0.1)" : "transparent",
                border: "1px solid rgba(245,184,0,0.2)",
                borderRadius: 8, width: 36, height: 36,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#f5b800", padding: 0,
                transition: "background 0.2s",
              }}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="5" r="1.8" fill="currentColor" />
                <circle cx="12" cy="12" r="1.8" fill="currentColor" />
                <circle cx="12" cy="19" r="1.8" fill="currentColor" />
              </svg>
            </button>

            {dropdownOpen && (
              <div style={{
                position: "absolute", top: "calc(100% + 10px)", right: 0,
                background: "rgba(8,20,25,0.97)",
                border: "1px solid rgba(245,184,0,0.18)",
                borderRadius: 10, padding: "0.5rem", minWidth: 190,
                boxShadow: "0 16px 40px rgba(0,0,0,0.5), 0 0 0 1px rgba(245,184,0,0.05)",
                zIndex: 200,
              }}>
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,184,0,0.45)", padding: "0.3rem 0.85rem 0.5rem" }}>Navigate</p>

                {navLinks.map(([href, label]) => (
                  <a key={href} href={href} onClick={() => setDropdownOpen(false)}
                    style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                    onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                    {label}
                  </a>
                ))}
                <a href="#pricing" onClick={() => setDropdownOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                  Pricing
                </a>
                <a href="#video" onClick={() => setDropdownOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                  Demo
                </a>

                <a href="/restaurants" onClick={() => setDropdownOpen(false)}
                  style={{ display: "flex", alignItems: "center", gap: "0.6rem", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                  onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                  Restaurants
                </a>

                <div style={{ borderTop: "1px solid rgba(245,184,0,0.1)", margin: "0.4rem 0" }} />
                <p style={{ fontSize: "0.65rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "rgba(245,184,0,0.45)", padding: "0.3rem 0.85rem 0.5rem" }}>Account</p>

                {isUser ? (
                  <>
                    <Link to="/models" onClick={() => setDropdownOpen(false)}
                      style={{ display: "block", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                      My Models
                    </Link>
                    <button onClick={handleLogout}
                      style={{ display: "block", width: "100%", textAlign: "left", background: "transparent", border: "none", cursor: "pointer", color: "#f87171", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s" }}
                      onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                      onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                      Log Out
                    </button>
                  </>
                ) : (
                  <>
                    <Link to="/user-login" onClick={() => setDropdownOpen(false)}
                      style={{ display: "block", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                      Log In
                    </Link>
                    <Link to="/user-register" onClick={() => setDropdownOpen(false)}
                      style={{ display: "block", color: "rgba(232,221,208,0.7)", textDecoration: "none", fontSize: "0.88rem", padding: "0.6rem 0.85rem", borderRadius: 8, transition: "background 0.15s, color 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(245,184,0,0.08)"; e.currentTarget.style.color = "#f5b800"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "rgba(232,221,208,0.7)"; }}>
                      Register
                    </Link>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      ) : (
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {isUser ? (
            <>
              <Link to="/models" style={{
                fontSize: "0.84rem", fontWeight: 600, color: "rgba(232,221,208,0.65)",
                textDecoration: "none", padding: "0.45rem 1rem", borderRadius: 8,
                transition: "color 0.2s, background 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f5b800"; e.currentTarget.style.background = "rgba(245,184,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(232,221,208,0.65)"; e.currentTarget.style.background = "transparent"; }}>
                Models
              </Link>
              <button onClick={handleLogout} style={{
                background: "transparent", border: "1px solid rgba(248,113,113,0.3)",
                borderRadius: 8, cursor: "pointer", color: "#f87171",
                fontSize: "0.84rem", fontWeight: 600, padding: "0.45rem 1rem",
                transition: "background 0.2s",
              }}
                onMouseEnter={e => (e.currentTarget.style.background = "rgba(248,113,113,0.08)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                Log Out
              </button>
            </>
          ) : (
            <>
              <Link to="/user-login" style={{
                fontSize: "0.84rem", fontWeight: 600, color: "rgba(232,221,208,0.65)",
                textDecoration: "none", padding: "0.45rem 1rem", borderRadius: 8,
                transition: "color 0.2s, background 0.2s",
              }}
                onMouseEnter={e => { e.currentTarget.style.color = "#f5b800"; e.currentTarget.style.background = "rgba(245,184,0,0.08)"; }}
                onMouseLeave={e => { e.currentTarget.style.color = "rgba(232,221,208,0.65)"; e.currentTarget.style.background = "transparent"; }}>
                Log In
              </Link>
              <Link to="/user-register" style={{
                fontSize: "0.84rem", fontWeight: 700, color: "#0d1a1f",
                textDecoration: "none", padding: "0.45rem 1.1rem", borderRadius: 8,
                background: "#f5b800",
                transition: "opacity 0.2s, transform 0.2s",
                boxShadow: "0 0 20px rgba(245,184,0,0.3)",
              }}
                onMouseEnter={e => { e.currentTarget.style.opacity = "0.9"; e.currentTarget.style.transform = "translateY(-1px)"; }}
                onMouseLeave={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.transform = ""; }}>
                Register
              </Link>
            </>
          )}
        </div>
      )}
    </nav>
  );
}

// Small caption label for hero hotspots
function HotspotLabel({ children }: { children: string }) {
  return (
    <span style={{
      position: "absolute", bottom: "10%", left: "50%", transform: "translateX(-50%)",
      fontSize: "0.7rem", fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase",
      color: T.accent, whiteSpace: "nowrap",
      textShadow: "0 2px 6px rgba(0,0,0,0.6)",
    }}>
      {children}
    </span>
  );
}

function Hero() {
  const isNarrow = useIsNarrow();

  return (
    <section id="hero" style={{
      position: "relative",
      minHeight: "100vh",
      display: "flex", alignItems: "center", justifyContent: "center",
      overflow: "hidden",
      boxSizing: "border-box",
      paddingTop: isNarrow ? "6.5rem" : "5.5rem",
      paddingBottom: isNarrow ? "2rem" : 0,
    }}>
      {/* <HeroBurger />
      <div style={{ position: "absolute", inset: 0, background: T.bg3, pointerEvents: "none" }} /> */}

      <div style={{
        position: "relative", zIndex: 10,
        display: "grid",
        gridTemplateColumns: isNarrow ? "1fr" : "1.5fr 1fr",
        alignItems: "center",
        width: "100%", maxWidth: 1450,
        padding: isNarrow ? "0 1.5rem" : "0 3rem",
        gap: isNarrow ? "2.5rem" : "3rem",
        textAlign: isNarrow ? "center" : "left",
      }}>

        {/* LEFT — Table scene: DINENICS + AR MENU wordmark + shoppable-hotspot buttons */}
        <div style={{
          position: "relative", width: "100%", maxWidth: 900, margin: "0 auto",
          aspectRatio: "1150 / 806",
        }}>

          {/* Big DINENICS + AR MENU wordmark sitting behind the scene */}
          <div style={{
            position: "absolute", top: "35%", left: "50%", transform: "translate(-50%,-50%)",
            zIndex: 0, userSelect: "none", pointerEvents: "none",
            display: "flex", flexDirection: "column", alignItems: "center",
            
          }}>
            <span style={{
              fontSize: "clamp(3rem, 9.5vw, 6.5rem)", fontWeight: 900,
              fontFamily: "'Pacifico', cursive",
              color: T.accentL, whiteSpace: "nowrap", lineHeight: 1,
            }}>
              DINENICS
            </span>
          </div>

          {/* The 3D table scene render (backdrop only — not clickable) */}
          <img
            src={manAtTable}
            alt="Customer at a table about to scan an AR menu"
            style={{ position: "relative", zIndex: 1, width: "100%", height: "97%", objectFit: "contain", display: "block", pointerEvents: "none",
              // border: `3px solid ${T.accent}`, borderRadius: 10, background: "transparent",
            transition: "border-color 0.2s, background 0.2s, transform 0.2s"
          }}
            
          />
          {/* PRICING hotspot — hollow bg3-outlined box, cash image, tap badge */}
          <a href="#pricing" aria-label="View pricing" style={{
            position: "absolute", top: "50%", left: "20%", zIndex: 4,
            width: "14%", aspectRatio: "1 / 1", transform: "translate(-50%,-50%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `3px solid ${T.bg3}`, borderRadius: 10, background: "transparent",
            transition: "border-color 0.2s, background 0.2s, transform 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(21,88,80,0.35)"; e.currentTarget.style.transform = "translate(-50%,-50%) scale(1.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.bg3; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translate(-50%,-50%)"; }}>
            <img src={cashAsset} alt="Pricing" style={{ width: "100%", display: "block" }} />
            <TapBadge />
            <HotspotLabel>Pricing</HotspotLabel>
          </a>


          {/* DEMO hotspot — hollow bg3-outlined box, pizza (AR model) image, tap badge */}
          <Link to="/ar-viewer" aria-label="Watch the AR demo" style={{
            position: "absolute", top: "50%", left: "47%", zIndex: 4,
            width: "25%", aspectRatio: "1 / .4", transform: "translate(-50%,-50%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `3px solid ${T.bg3}`, borderRadius: 10, background: "transparent",
            transition: "border-color 0.2s, background 0.2s, transform 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(21,88,80,0.35)"; e.currentTarget.style.transform = "translate(-50%,-50%) scale(1.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.bg3; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translate(-50%,-50%)"; }}>
            <img src={pizzaAsset} alt="Watch demo" style={{ width: "100%", display: "block" }} />
            <TapBadge />
            <HotspotLabel>Demo</HotspotLabel>
          </Link>

          {/* MENUS hotspot — hollow bg3-outlined box, QR image, tap badge */}
          <Link to="/restaurants" aria-label="View the menu" style={{
            position: "absolute", top: "61%", left: "72%", zIndex: 4,
            width: "19%", aspectRatio: "1 / 1", transform: "translate(-50%,-50%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            border: `3px solid ${T.bg3}`, borderRadius: 10, background: "transparent",
            transition: "border-color 0.2s, background 0.2s, transform 0.2s",
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(21,88,80,0.35)"; e.currentTarget.style.transform = "translate(-50%,-50%) scale(1.06)"; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = T.bg3; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = "translate(-50%,-50%)"; }}>
            <img src={qrAsset} alt="View menu" style={{ width: "80%", display: "block" }} />
            <TapBadge />
            <HotspotLabel>Menus</HotspotLabel>
          </Link>
        </div>



        {/* RIGHT — tagline (kept smaller/secondary so the scene reads first) */}
        <div>
          <p style={{ fontSize: "0.68rem", fontWeight: 700, letterSpacing: "0.14em", textTransform: "uppercase", color: T.accent, marginBottom: "0.75rem" }}>
            AR Menu Technology
          </p>
          <h1 style={{
            fontSize: !isNarrow? "clamp(3rem,3.4vw,2.5rem)" :  "clamp(1.6rem,3.4vw,2.5rem)", fontWeight: 900,
            lineHeight: 1.12, letterSpacing: "-0.02em",
            color: "#fff", marginBottom: "1rem",
          }}>
            Make Your Menu<br />
            <span style={{ color: "#f5b800" }}>Come Alive</span>
          </h1>

          <p style={{
            fontSize: "clamp(0.82rem,1.3vw,0.95rem)", fontWeight: 500,
            color: "rgba(232,221,208,0.7)", lineHeight: 1.65,
            maxWidth: 1000,
            margin: isNarrow ? "0 auto" : "0 0 0 auto",
          }}>
            Turn your food photos into interactive 3D AR models. Customers see your dish on their table before they order.
          </p>

          <div style={{ marginTop: "2rem", display: "flex", justifyContent: isNarrow ? "center" : "flex-start" }}>
            <a href="#feedback" style={{
              display: "inline-flex", alignItems: "center", gap: "0.5rem",
              background: "transparent", color: T.accent,
              border: `2px solid ${T.accent}`, padding: "1rem 2rem",
              borderRadius: 10, fontSize: "0.9rem", fontWeight: 700,
              textDecoration: "none", transition: "background 0.2s, transform 0.2s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(221,170,0,0.1)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = ""; }}>
              💬 Share Feedback
            </a>
          </div>

        </div>


      </div>

      {/* Scroll hint */}
      {/* {!isNarrow && (
        <div style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", color: "rgba(232,221,208,0.4)", fontSize: "0.75rem" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.5}>
            <path d="M12 5v14M5 12l7 7 7-7" />
          </svg>
          Scroll
        </div>
      )} */}
    </section>
  );
}

// ── BUTTON HELPERS ────────────────────────────────────────────────
function BtnPrimary({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href}
      style={{ background: T.primary, color: "#fff", padding: "0.9rem 2rem", borderRadius: 10, fontSize: "1rem", fontWeight: 700, textDecoration: "none", display: "inline-block", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: `0 0 24px rgba(166,81,17,0.35)` }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = `0 0 36px rgba(166,81,17,0.55)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 0 24px rgba(166,81,17,0.35)`; }}>
      {children}
    </a>
  );
}

function BtnOutline({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href}
      style={{ background: "transparent", color: T.text, border: "1.5px solid rgba(232,221,208,0.18)", padding: "0.9rem 2rem", borderRadius: 10, fontSize: "1rem", fontWeight: 600, textDecoration: "none", display: "inline-block", transition: "border-color 0.2s, transform 0.2s, background 0.2s" }}
      onMouseEnter={e => { e.currentTarget.style.borderColor = T.accent; e.currentTarget.style.background = "rgba(221,170,0,0.08)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
      onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(232,221,208,0.18)"; e.currentTarget.style.background = "transparent"; e.currentTarget.style.transform = ""; }}>
      {children}
    </a>
  );
}

// ── HOW IT WORKS ──────────────────────────────────────────────────
const steps = [
  { num: "01", icon: "📸", title: "Upload Photos", desc: "Send us 150-200 photos of your dish from different angles. WhatsApp, Google Drive, or email — whatever works." },
  { num: "02", icon: "⚙️", title: "We Build Your Model", desc: "Our team converts your photos into a realistic 3D AR model, optimised for mobile web with no app download needed." },
  { num: "03", icon: "🔗", title: "Share Anywhere", desc: "Get a QR code and shareable link. Print it on your menu, add it to your Instagram bio, or embed it on your website." },
];

function HowItWorks() {
  return (
    <div id="how" style={{ background: T.bg, padding: "6rem 0" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
        <FadeUp>
          <SectionLabel>Process</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: T.text, marginBottom: "0.75rem" }}>
            From Photo to AR in 48 Hours
          </h2>
          <p style={{ color: T.muted, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 520, margin: "0 auto" }}>
            No technical skills needed. Just share your dish photos and we handle everything else.
          </p>
          <GlowLine />
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "1.5rem", marginTop: "3rem" }}>
          {steps.map((s, i) => (
            <FadeUp key={s.num} delay={i * 0.15}>
              <StepCard {...s} />
            </FadeUp>
          ))}
        </div>
      </div>
    </div>
  );
}

function StepCard({ num, icon, title, desc }: { num: string; icon: string; title: string; desc: string }) {
  const ref = useRef<HTMLDivElement>(null);
  return (
    <div ref={ref}
      style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 16, padding: "2rem", textAlign: "left", transition: "transform 0.3s, box-shadow 0.3s, border-color 0.3s", position: "relative", overflow: "hidden" }}
      onMouseEnter={e => { const el = e.currentTarget; el.style.transform = "translateY(-4px)"; el.style.boxShadow = `0 12px 40px rgba(166,81,17,0.12)`; el.style.borderColor = "rgba(166,81,17,0.5)"; }}
      onMouseLeave={e => { const el = e.currentTarget; el.style.transform = ""; el.style.boxShadow = ""; el.style.borderColor = T.border; }}>
      <p style={{ fontSize: "0.72rem", fontWeight: 700, color: T.accent, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "0.8rem" }}>Step {num}</p>
      <div style={{ width: 48, height: 48, background: "rgba(166,81,17,0.12)", borderRadius: 12, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", marginBottom: "1rem" }}>{icon}</div>
      <h3 style={{ fontSize: "1.1rem", fontWeight: 700, color: T.text, marginBottom: "0.5rem" }}>{title}</h3>
      <p style={{ color: T.muted, fontSize: "0.9rem", lineHeight: 1.65 }}>{desc}</p>
    </div>
  );
}

// ── VIDEO ─────────────────────────────────────────────────────────
function VideoSection() {
  return (
    <div id="video" style={{ background: T.bg2, padding: "6rem 2rem" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", textAlign: "center" }}>
        <FadeUp>
          <SectionLabel>Live Demo</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: T.text, marginBottom: "0.75rem" }}>
            See AR Menus In Action
          </h2>
          <p style={{ color: T.muted, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 540, margin: "0 auto" }}>
            This is what your customers will experience when they scan your menu.
          </p>
          <GlowLine />
        </FadeUp>


        <FadeUp delay={0.2} style={{ marginTop: "3rem" }}>
          <div style={{
            borderRadius: 16, overflow: "hidden",
            border: `2px solid rgba(166,81,17,0.45)`,
            boxShadow: `0 0 60px rgba(166,81,17,0.15)`,
            aspectRatio: "16/9", maxWidth: 800, margin: "0 auto",
          }}>
            <iframe
              src="https://www.youtube.com/embed/zyxPsv6VqpY?si=q6fV_4s5jLYdfUHV"
              title="Dinenics Demo"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
            />
          </div>
        </FadeUp>
      </div>
    </div>
  );
}

// ── PROBLEM ───────────────────────────────────────────────────────
const stats = [
  { text: "67% of customers say food looks different from photos" },
  { text: "AR experiences increase purchase intent by 40%" },
  { text: "No AR menu platform exists in Pakistan yet — we're first", highlight: true },
];

function ProblemSection() {
  return (
    <section id="problem" style={{ maxWidth: 1100, margin: "0 auto", padding: "6rem 2rem" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "4rem", alignItems: "center" }}>
        <FadeUp>
          <SectionLabel>Why Dinenics</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: T.text, marginBottom: "0.75rem" }}>
            The Problem We're Solving
          </h2>
          <GlowLine center={false} />
          <p style={{ color: T.muted, fontSize: "1.02rem", lineHeight: 1.8, marginTop: "1.5rem" }}>
            Pakistani restaurants lose customers every day because food photos lie. A burger photographed with professional lighting looks nothing like what arrives. Customers feel deceived. Orders drop. Reputation suffers.
          </p>
          <p style={{ color: T.muted, fontSize: "1.02rem", lineHeight: 1.8, marginTop: "1rem" }}>
            We replace the misleading photo with the actual dish — placed on the customer's real table through their phone camera, at real size, before they order.
          </p>
        </FadeUp>

        <FadeUp delay={0.2}>
          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            {stats.map((s, i) => (
              <div key={i}
                style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 14, padding: "1.4rem 1.6rem", display: "flex", alignItems: "flex-start", gap: "1rem", transition: "transform 0.3s, border-color 0.3s" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateX(4px)"; e.currentTarget.style.borderColor = "rgba(166,81,17,0.5)"; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = T.border; }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: s.highlight ? T.accent : T.primary, flexShrink: 0, marginTop: 4 }} />
                <p style={{ color: T.text, fontSize: "0.95rem", lineHeight: 1.55, fontWeight: 500 }}>{s.text}</p>
              </div>
            ))}
          </div>
        </FadeUp>
      </div>
    </section>
  );
}
// ── PRICING ───────────────────────────────────────────────────────
const plans = [
  {
    name: "Lite Menu",
    price: "Rs 4,950",
    per: "/ Month",
    features: [
      "Up to 5 Active AR Food Models Live On Your Menu",
      "1 Free Dish Refresh every month",
      "Standard WebAR Hosting",
      "Custom QR Codes + Shareable Links for Instagram",
      "Zero-App Scan-to-View Technology",
      "Universal Device Support (Full Android & iOS Support)",
      "Total Monthly Scan Count Dashboard",
    ],
    comingSoonFeatures: [
      "QR Codes + MOdel Viewer for Web Embedding",
      "Pre-Formatted Instagram Bio Link",
      "Analytics Dashboard with Scan Heatmaps",
    ],
    cta: "Contact Us",
    whatsappMsg: "Hi Dinenics! 👋 We're interested in the *Lite Menu Plan* (Rs 14,950/month) for our restaurant. We'd love to get started — could you share the next steps?",
    popular: false,
  },
  {
    name: "Standard Menu",
    price: "Rs 19,950",
    per: "/ Month",
    setupFee: "Rs 15,000 one-time setup",
    dishLimit: "18 to 24 Active AR Food Models",
    features: [
      "Everything in Lite, plus:",
      "2 Free Dish Refreshes every month",
      "Priority WebAR Hosting (faster load on larger menus)",
      "Fully Custom Digital Menu Design (branded landing page)",
      "Advanced Analytics Dashboard & Scan Heatmaps",
      "Monthly Performance Reports",
    ],
    comingSoonFeatures: [
      "White-Label QR Code Branding",
      "Ready-to-Use Menu Design Templates (via Canva)",
    ],
    cta: "Contact Us",
    whatsappMsg: "Hi Dinenics! 👋 We're interested in the *Standard Menu Plan* (Rs 19,950/month) for our restaurant. We'd love to get started — could you share the next steps?",
    popular: true,
  },
  {
    name: "Pro Menu",
    price: "Rs 8,950",
    per: "/ Month",
    features: [
      "Everything in Standard, plus:",
      "3 Free Dish Refreshes every month",
      "White-Label QR Code Branding",
      "Dedicated Account Manager",
    ],
    comingSoonFeatures: [
      "QR Codes + Model Viewer for Web Embedding",
      "Advanced Analytics & Scan Heatmaps",
      "Dedicated Account Manager",
      "White-Label QR Code Branding",
      "Ready-to-Use Menu Design Templates (Via Canva)",
      "AR Social Media Video Clips",
      "Monthly Performance Reports",

    ],
    cta: "Contact Us",
    whatsappMsg: "Hi Dinenics! 👋 We're interested in the *Pro Menu Plan* (Rs 8,950/month) for our restaurant. We'd love to get started — could you share the next steps?",
    popular: true,
  },
];

function Pricing() {
  return (
    <div id="pricing" style={{ background: T.bg, padding: "6rem 0" }}>
      <div style={{ maxWidth: 900, margin: "0 auto", padding: "0 2rem", textAlign: "center" }}>
        <FadeUp>
          <SectionLabel>Transparent Pricing</SectionLabel>
          <h2 style={{ fontSize: "clamp(1.8rem,4vw,2.8rem)", fontWeight: 800, letterSpacing: "-0.025em", color: T.text, marginBottom: "0.75rem" }}>Simple Pricing</h2>
          <p style={{ color: T.muted, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>Get started today! For Custom Plans, Contact Us.</p>
          <GlowLine />
        </FadeUp>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))", gap: "1.5rem", marginTop: "3.5rem" }}>
          {plans.map((p, i) => (
            <FadeUp key={p.name} delay={i * 0.15}>
              <PricingCard plan={p} />
            </FadeUp>
          ))}
        </div>
      </div>
    </div>
  );
}

function PricingCard({ plan }: { plan: typeof plans[0] }) {
  const phone = "923119042553";
  const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(plan.whatsappMsg)}`;

  return (
    <div
      style={{
        background: plan.popular ? "rgba(166,81,17,0.08)" : T.bg3,
        border: plan.popular ? `2px solid ${T.primary}` : `1px solid ${T.border}`,
        borderRadius: 18,
        padding: "2.2rem",
        textAlign: "left",
        position: "relative",
        boxShadow: plan.popular ? `0 0 40px rgba(166,81,17,0.15)` : "none",
        transition: "transform 0.3s, box-shadow 0.3s",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-6px)";
        e.currentTarget.style.boxShadow = plan.popular
          ? `0 16px 50px rgba(166,81,17,0.25)`
          : `0 16px 50px rgba(166,81,17,0.08)`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = plan.popular ? `0 0 40px rgba(166,81,17,0.15)` : "none";
      }}
    >
      {plan.popular && (
        <div
          style={{
            position: "absolute", top: -13, left: "50%", transform: "translateX(-50%)",
            background: T.primary, color: "#fff", fontSize: "0.7rem", fontWeight: 700,
            letterSpacing: "0.08em", textTransform: "uppercase", padding: "0.3rem 1rem", borderRadius: 999,
          }}
        >
          ⚡ Most Popular
        </div>
      )}

      {/* Plan name */}
      <p style={{ fontSize: "0.78rem", fontWeight: 700, color: T.accent, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: "0.5rem" }}>
        {plan.name}
      </p>

      {/* Price */}
      <p style={{ fontSize: "2rem", fontWeight: 900, letterSpacing: "-0.03em", color: T.text, marginBottom: "0.2rem" }}>
        {plan.price} <span style={{ fontSize: "0.88rem", fontWeight: 400, color: T.muted }}>{plan.per}</span>
      </p>

      <div style={{ borderTop: `1px solid ${T.border}`, margin: "1.4rem 0" }} />

      {/* Live features */}
      <ul style={{ listStyle: "none", marginBottom: "1.4rem", padding: 0 }}>
        {plan.features.map(f => (
          <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.9rem", color: T.muted, padding: "0.3rem 0" }}>
            <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0 }}>✓</span> {f}
          </li>
        ))}
      </ul>

      {/* Coming Soon section */}
      <div style={{ borderTop: `1px dashed ${T.border}`, paddingTop: "1rem", marginBottom: "1.6rem" }}>
        <p style={{ fontSize: "0.78rem", fontWeight: 800, color: T.accent, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.7rem" }}>
          🚀 Coming Soon
        </p>
        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {plan.comingSoonFeatures.map(f => (
            <li key={f} style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", fontSize: "0.9rem", color: T.muted, padding: "0.3rem 0", opacity: 0.65 }}>
              <span style={{ color: T.accent, fontWeight: 700, flexShrink: 0, fontSize: "0.85rem" }}>⏳</span> {f}
            </li>
          ))}
        </ul>
      </div>

      {/* WhatsApp CTA */}
      <a
        href={whatsappUrl}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: "block", width: "100%", padding: "0.85rem", borderRadius: 10,
          fontSize: "0.95rem", fontWeight: 700, textAlign: "center", textDecoration: "none",
          boxSizing: "border-box",
          ...(plan.popular
            ? { background: T.primary, color: "#fff", boxShadow: `0 4px 20px rgba(166,81,17,0.3)`, border: "none" }
            : { background: "transparent", color: T.text, border: "1.5px solid rgba(232,221,208,0.15)" }),
          transition: "transform 0.2s, box-shadow 0.2s, border-color 0.2s",
        }}
        onMouseEnter={e => {
          e.currentTarget.style.transform = "translateY(-2px)";
          if (!plan.popular) e.currentTarget.style.borderColor = T.accent;
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = "";
          if (!plan.popular) e.currentTarget.style.borderColor = "rgba(232,221,208,0.15)";
        }}
      >
        {plan.cta}
      </a>
    </div>
  );
}

// ── FEEDBACK ──────────────────────────────────────────────────────
function FeedbackSection() {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus("loading");
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/feedback/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error();
      setStatus("success");
      setMessage("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <section id="feedback" style={{ background: T.bg, padding: "5rem 2rem" }}>
      <div style={{ maxWidth: 580, margin: "0 auto" }}>

        {/* Heading */}
        <div style={{ textAlign: "center", marginBottom: "2.5rem" }}>
          <span style={{
            background: "rgba(166,81,17,0.15)",
            color: T.primary,
            fontSize: "0.75rem",
            fontWeight: 700,
            letterSpacing: "0.12em",
            padding: "0.3rem 1rem",
            borderRadius: 20,
            textTransform: "uppercase" as const,
            display: "inline-block",
            marginBottom: "1rem",
          }}>
            Feedback
          </span>
          <h2 style={{ fontSize: "2rem", fontWeight: 800, color: T.text, margin: "0 0 0.5rem" }}>
            Share Your Thoughts
          </h2>
          <p style={{ color: "#a0a0a0", fontSize: "0.92rem", margin: 0 }}>
            Anonymous. Honest. We read every message.
          </p>
        </div>

        {/* Card */}
        <div style={{
          background: "rgba(255,255,255,0.03)",
          border: `1.5px solid ${T.border}`,
          borderRadius: 18,
          padding: "2rem",
          boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
        }}>
          {status === "success" ? (
            <div style={{ textAlign: "center", padding: "2rem 0" }}>
              <div style={{ fontSize: "2.8rem", marginBottom: "1rem" }}>🎉</div>
              <h3 style={{ color: T.text, fontWeight: 700, margin: "0 0 0.4rem" }}>Thanks!</h3>
              <p style={{ color: "#a0a0a0", fontSize: "0.9rem", margin: "0 0 1.5rem" }}>
                Your feedback helps us improve.
              </p>
              <button
                onClick={() => setStatus("idle")}
                style={{
                  background: "transparent",
                  border: `1.5px solid ${T.border}`,
                  color: "#a0a0a0",
                  borderRadius: 8,
                  padding: "0.45rem 1.2rem",
                  cursor: "pointer",
                  fontSize: "0.85rem",
                }}
              >
                Send another
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
              <textarea
                placeholder="What's on your mind? Be honest, it's anonymous."
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={5}
                style={{
                  width: "100%",
                  background: "rgba(255,255,255,0.04)",
                  border: `1.5px solid ${T.border}`,
                  borderRadius: 12,
                  padding: "0.9rem 1rem",
                  color: T.text,
                  fontSize: "0.92rem",
                  outline: "none",
                  resize: "vertical",
                  fontFamily: "inherit",
                  boxSizing: "border-box" as const,
                  transition: "border-color 0.2s",
                  lineHeight: 1.6,
                }}
                onFocus={e => e.currentTarget.style.borderColor = T.primary}
                onBlur={e => e.currentTarget.style.borderColor = T.border}
              />

              {status === "error" && (
                <p style={{ color: "#f87171", fontSize: "0.85rem", margin: 0 }}>
                  Something went wrong. Please try again.
                </p>
              )}

              <button
                onClick={handleSubmit}
                disabled={status === "loading" || !message.trim()}
                style={{
                  background: (!message.trim() || status === "loading")
                    ? "rgba(166,81,17,0.3)"
                    : T.primary,
                  color: "#fff",
                  border: "none",
                  borderRadius: 10,
                  padding: "0.85rem",
                  fontSize: "0.95rem",
                  fontWeight: 700,
                  cursor: (!message.trim() || status === "loading") ? "not-allowed" : "pointer",
                  transition: "background 0.2s, transform 0.2s",
                  width: "100%",
                }}
                onMouseEnter={e => {
                  if (message.trim() && status !== "loading")
                    e.currentTarget.style.transform = "translateY(-2px)";
                }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
              >
                {status === "loading" ? "Sending..." : "Submit"}
              </button>

              <p style={{ color: "#a0a0a0", fontSize: "0.75rem", textAlign: "center", margin: 0 }}>
                No name, no email — completely anonymous
              </p>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}



// ── FOOTER ────────────────────────────────────────────────────────
function Footer() {
  const contacts = [
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.215a.75.75 0 0 0 .921.921l5.382-1.453A11.951 11.951 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.7-.512-5.24-1.406l-.374-.217-3.894 1.052 1.052-3.894-.217-.374A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      ),
      label: "+92 311 9042553",
      href: "https://wa.me/923119042553",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z" />
          <path d="M12 0C5.373 0 0 5.373 0 12c0 2.117.549 4.107 1.51 5.833L.057 23.215a.75.75 0 0 0 .921.921l5.382-1.453A11.951 11.951 0 0 0 12 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 22c-1.907 0-3.7-.512-5.24-1.406l-.374-.217-3.894 1.052 1.052-3.894-.217-.374A9.953 9.953 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10z" />
        </svg>
      ),
      label: "+92 313 5418240",
      href: "https://wa.me/923135418240",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4-8 5-8-5V6l8 5 8-5v2z" />
        </svg>
      ),
      label: "dinenics@gmail.com",
      href: "mailto:dinenics@gmail.com",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
        </svg>
      ),
      label: "@dinenics",
      href: "https://instagram.com/dinenics",
    },
    {
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
        </svg>
      ),
      label: "@dinenics",
      href: "https://www.linkedin.com/company/dinenics/ ",
    },
  ];

  return (
    <footer style={{ background: T.bg, borderTop: `1px solid ${T.border}`, padding: "4rem 2rem 2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto" }}>

        {/* Top row */}
        <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "3rem", marginBottom: "3rem" }}>

          {/* Brand */}
          <div style={{ maxWidth: 260 }}>
            <div style={{ fontSize: "1.5rem", fontWeight: 800, color: T.accent, marginBottom: "0.4rem" }}>Dinenics</div>
            <p style={{ color: "#a0a0a0", fontSize: "0.88rem", lineHeight: 1.6, margin: "0 0 1.5rem" }}>
              Bringing Pakistani food to life through augmented reality.
            </p>
            {/* Contact list */}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {contacts.map(({ icon, label, href }) => (
                <a
                  key={href}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.6rem",
                    color: "#a0a0a0",
                    textDecoration: "none",
                    fontSize: "0.85rem",
                    transition: "color 0.2s",
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.primary)}
                  onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
                >
                  <span style={{ opacity: 0.7, flexShrink: 0 }}>{icon}</span>
                  {label}
                </a>
              ))}
            </div>
          </div>

          {/* Nav links */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a0a0a0", marginBottom: "1rem" }}>
              Navigation
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              {[["#hero", "Home"], ["#how", "How It Works"], ["#pricing", "Pricing"]].map(([href, label]) => (
                <a
                  key={href}
                  href={href}
                  style={{ color: "#a0a0a0", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                  onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                  onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
                >
                  {label}
                </a>
              ))}
              <Link
                to="/ar-viewer"
                style={{ color: "#a0a0a0", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
              >
                View Demo
              </Link>
              <Link
                to="/restaurants"
                style={{ color: "#a0a0a0", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
              >
                Restaurants
              </Link>
            </div>
          </div>

          {/* Legal */}
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", color: "#a0a0a0", marginBottom: "1rem" }}>
              Legal
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
              <Link
                to="/privacy-policy"
                style={{ color: "#a0a0a0", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                style={{ color: "#a0a0a0", textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = "#a0a0a0")}
              >
                Terms of Service
              </Link>
            </div>
          </div>

        </div>

        {/* Bottom bar */}
        <div style={{
          paddingTop: "1.5rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          display: "flex",
          flexWrap: "wrap",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "1rem",
        }}>
          <span style={{ color: "rgba(133,170,170,0.45)", fontSize: "0.78rem" }}>
            © 2026 Dinenics. All rights reserved.
          </span>
          <span style={{ color: "rgba(133,170,170,0.3)", fontSize: "0.75rem" }}>
            Made in Pakistan 🇵🇰
          </span>
        </div>

      </div>
    </footer>
  );
}
// ── PAGE ──────────────────────────────────────────────────────────
export function LandingPage() {

  return (
    <div style={{ background: T.bg, color: T.text, fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif", overflowX: "hidden" }}>
      <Nav />
      <Hero />
      <HowItWorks />
      <VideoSection />
      <ProblemSection />
      <Pricing />
      <FeedbackSection />
      <Footer />
    </div>
  );
}