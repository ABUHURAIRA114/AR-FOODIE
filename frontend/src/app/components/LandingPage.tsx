import { useEffect, useRef, useState } from "react";
import { HeroBurger } from "./HeroBurger";
import { Link, useNavigate } from "react-router";
import { checkUserAuth, logoutRequest } from "../lib/auth";
import logo from "../../assets/logo.webp";
import { T } from "./tokens.mts";


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
        transition: "transform 0.25s cubic-bezier(0.4, 0, 0.2, 1)"
      }}
      onMouseEnter={e => e.currentTarget.style.transform = "scale(1.05)"}
      onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
    >
      {/* Premium Stand-out Square Badge Container */}
      <div style={{
        background: "#051419",
        padding: "0rem 0rem",
        borderRadius: 14,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 8px 24px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(245, 184, 0, 0.15)",
        border: "1px solid rgba(255, 255, 255, 0.03)",
        /* Ensure the container doesn't grow */
        width: "70px",
        height: "70px",
        overflow: "hidden"
      }}>
        <img
          src={logo}
          alt="Dinenics Logo"
          style={{
            /* Make the image larger than the container */
            width: "200px",
            height: "200px",
            objectFit: "contain",
            display: "block"
          }}
        />
      </div>
    </Link>
  );
}

// ── NAV ───────────────────────────────────────────────────────────
function NavLinkPill({ to, onClick, children, full = false }: { to: string; onClick?: () => void; children: React.ReactNode; full?: boolean }) {
  return (
    <Link to={to} onClick={onClick}
      style={{
        background: T.primary, color: "#fff", padding: full ? "0.85rem 1.2rem" : "0.5rem 1.2rem",
        borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, textDecoration: "none",
        transition: "transform 0.2s, box-shadow 0.2s", boxShadow: `0 0 20px rgba(166,81,17,0.3)`,
        display: full ? "block" : "inline-block", textAlign: full ? "center" : "left",
        width: full ? "100%" : "auto",
      }}
      onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 0 30px rgba(166,81,17,0.5)`; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 0 20px rgba(166,81,17,0.3)`; }}>
      {children}
    </Link>
  );
}

const navLinks: [string, string][] = [["#how", "How It Works"], ["#video", "Demo"], ["#pricing", "Pricing"]];

function Nav() {
  const [isUser, setIsUser] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const isNarrow = useIsNarrow();

  useEffect(() => {
    checkUserAuth()
      .then(data => setIsUser(data.is_user))
      .catch(() => setIsUser(false));
  }, []);

  const handleLogout = async () => {
    await logoutRequest();
    setIsUser(false);
    setDrawerOpen(false);
    navigate("/");
  };

  const closeDrawer = () => setDrawerOpen(false);

  return (
    <>
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 100,
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: isNarrow ? "1rem 1.25rem" : ".6rem 2.5rem",
        background: "rgba(13,26,31,0.85)",
        backdropFilter: "blur(14px)",
        borderBottom: `1px solid ${T.border}`,
      }}>
        {/* ── BRAND (logo only) ── */}
        <DinenicsBrandLogo />

        {isNarrow ? (
          <button
            aria-label="Open menu"
            onClick={() => setDrawerOpen(true)}
            style={{
              background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8,
              width: 40, height: 40, display: "flex", alignItems: "center", justifyContent: "center",
              cursor: "pointer", color: T.text, padding: 0,
            }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="5" r="1.8" fill="currentColor" />
              <circle cx="12" cy="12" r="1.8" fill="currentColor" />
              <circle cx="12" cy="19" r="1.8" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <div style={{ display: "flex", gap: "2rem", alignItems: "center" }}>
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} style={{ color: T.muted, textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
                onMouseEnter={e => (e.currentTarget.style.color = T.text)}
                onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
                {label}
              </a>
            ))}
            <NavLinkPill to="/ar-viewer">View AR Demo</NavLinkPill>
            {isUser ? (
              <NavLinkPill to="/models">Models</NavLinkPill>
            ) : (
              <NavLinkPill to="/user-register">Register</NavLinkPill>
            )}
            {isUser ? (
              <button onClick={handleLogout} style={{ background: T.primary, color: "#fff", padding: "0.5rem 1.2rem", borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, textDecoration: "none", transition: "transform 0.2s, box-shadow 0.2s", boxShadow: `0 0 20px rgba(166,81,17,0.3)`, border: "none", cursor: "pointer" }}
                onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 0 30px rgba(166,81,17,0.5)`; }}
                onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = `0 0 20px rgba(166,81,17,0.3)`; }}>
                Log Out
              </button>
            ) : (
              <NavLinkPill to="/user-login">Log In</NavLinkPill>
            )}
          </div>
        )}
      </nav>

      {/* Backdrop */}
      {isNarrow && (
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
      )}

      {/* Sidebar drawer */}
      {isNarrow && (
        <aside style={{
          position: "fixed", top: 0, right: 0, height: "100vh", width: "min(78vw, 320px)",
          background: T.bg2, borderLeft: `1px solid ${T.border}`, zIndex: 200,
          transform: drawerOpen ? "translateX(0)" : "translateX(100%)",
          transition: "transform 0.32s ease",
          display: "flex", flexDirection: "column", padding: "1.25rem",
          boxShadow: drawerOpen ? "-8px 0 30px rgba(0,0,0,0.35)" : "none",
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <DinenicsBrandLogo />
            <button
              aria-label="Close menu"
              onClick={closeDrawer}
              style={{ background: "transparent", border: `1px solid ${T.border}`, borderRadius: 8, width: 36, height: 36, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: T.text, padding: 0 }}>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
            </button>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem", marginBottom: "1.5rem" }}>
            {navLinks.map(([href, label]) => (
              <a key={href} href={href} onClick={closeDrawer}
                style={{ color: T.muted, textDecoration: "none", fontSize: "1rem", padding: "0.75rem 0.25rem", borderBottom: `1px solid ${T.border}` }}>
                {label}
              </a>
            ))}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginTop: "auto" }}>
            <NavLinkPill to="/ar-viewer" onClick={closeDrawer} full>View AR Demo</NavLinkPill>
            {isUser ? (
              <NavLinkPill to="/models" onClick={closeDrawer} full>Models</NavLinkPill>
            ) : (
              <NavLinkPill to="/user-register" onClick={closeDrawer} full>Register</NavLinkPill>
            )}
            {isUser ? (
              <button onClick={handleLogout} style={{ background: T.primary, color: "#fff", padding: "0.85rem 1.2rem", borderRadius: 8, fontSize: "0.88rem", fontWeight: 700, border: "none", cursor: "pointer", width: "100%", boxShadow: `0 0 20px rgba(166,81,17,0.3)` }}>
                Log Out
              </button>
            ) : (
              <NavLinkPill to="/user-login" onClick={closeDrawer} full>Log In</NavLinkPill>
            )}
          </div>
        </aside>
      )}
    </>
  );
}

// ── HERO ──────────────────────────────────────────────────────────
function Hero() {
  return (
    <section id="hero" style={{ position: "relative", height: "100vh", minHeight: 600, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden" }}>
      <HeroBurger />

      {/* Subtle overlay */}
      <div style={{ position: "absolute", inset: 0, background: "rgba(13,26,31,0.45)", pointerEvents: "none" }} />

      <div style={{ position: "relative", zIndex: 10, textAlign: "center", padding: "0 1.5rem", maxWidth: 800 }}>
      

        <h1 style={{ fontSize: "clamp(2.4rem,6vw,4.4rem)", fontWeight: 900, lineHeight: 1.08, letterSpacing: "-0.03em", marginBottom: "1.4rem", color: T.text }}>
          Make Your Menu<br /><AccentText>Come Alive</AccentText>
        </h1>

        <p style={{ fontSize: "clamp(1rem,2.5vw,1.3rem)", fontWeight: 600, color: T.muted, lineHeight: 1.75, maxWidth: 560, margin: "0 auto 2.5rem" }}>
          Turn your food photos into interactive 3D AR models. Customers see your dish on their table before they order.
        </p>

        <div style={{ display: "flex", gap: "1rem", justifyContent: "center", flexWrap: "wrap" }}>
          <BtnPrimary href="#pricing">Get Started</BtnPrimary>
          <BtnOutline href="#video">See It In Action</BtnOutline>
        </div>
      </div>

      {/* Scroll hint */}
      <div style={{ position: "absolute", bottom: "2.5rem", left: "50%", transform: "translateX(-50%)", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.4rem", color: T.muted, fontSize: "0.75rem" }}
        className="animate-bounce">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity={0.5}>
          <path d="M12 5v14M5 12l7 7 7-7" />
        </svg>
        Scroll
      </div>
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
  { num: "01", icon: "📸", title: "Upload Photos", desc: "Send us 25-40 photos of your dish from different angles. WhatsApp, Google Drive, or email — whatever works." },
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
    cta: "Order Now",
    whatsappMsg: "Hi Dinenics! 👋 We're interested in the *Lite Menu Plan* (Rs 4,950/month) for our restaurant. We'd love to get started — could you share the next steps?",
    popular: false,
  },
  {
    name: "Pro Menu",
    price: "Rs 8,950",
    per: "/ Month",
    features: [
      "Up to 12 Active AR Food Models Live On Your Menu",
      "3 Free Dish Refresh every month",
      "Priority 48-Hour Model Delivery",
      "Zero-App Scan-to-View Technology",
      "Custom QR Codes + Shareable Links for Instagram",
      "Universal Device Support (Full Android & iOS Support)",
      "Total Monthly Scan Count Dashboard",

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
          <p style={{ color: T.muted, fontSize: "1.05rem", lineHeight: 1.7, maxWidth: 480, margin: "0 auto" }}>No hidden fees. No contracts. Get started today!</p>
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

// ── FOOTER ────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer style={{ background: T.bg, borderTop: `1px solid ${T.border}`, padding: "3rem 2rem" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexWrap: "wrap", justifyContent: "space-between", alignItems: "flex-start", gap: "2rem" }}>
        <div>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: T.accent, marginBottom: "0.3rem" }}>Dinenics</div>
          <p style={{ color: T.muted, fontSize: "0.88rem", marginBottom: "0.6rem" }}>Bringing Pakistani food to life</p>
          <a href="https://wa.me/923119042553" style={{ color: T.primary, textDecoration: "none", fontSize: "0.88rem" }}>
            +92 311 9042553
          </a>
          <a href="https://wa.me/923135418240" target="_blank" rel="noopener noreferrer" style={{ color: T.primary, textDecoration: "none", fontSize: "0.88rem", display: "block", marginTop: "0.4rem" }}>
            +92 313 5418240
          </a>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem", alignItems: "center" }}>
          {[["#hero", "Home"], ["#how", "How It Works"], ["#pricing", "Pricing"]].map(([href, label]) => (
            <a key={href} href={href} style={{ color: T.muted, textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = T.text)}
              onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
              {label}
            </a>
          ))}
          <Link to="/ar-viewer" style={{ color: T.muted, textDecoration: "none", fontSize: "0.88rem", transition: "color 0.2s" }}
            onMouseEnter={e => (e.currentTarget.style.color = T.text)}
            onMouseLeave={e => (e.currentTarget.style.color = T.muted)}>
            View Demo
          </Link>
        </div>
      </div>
      <div style={{ maxWidth: 1100, margin: "2rem auto 0", paddingTop: "1.5rem", borderTop: "1px solid rgba(255,255,255,0.05)", textAlign: "center", color: "rgba(133,170,170,0.45)", fontSize: "0.78rem" }}>
        © 2026 Dinenics. All rights reserved.
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
      <Footer />
    </div>
  );
}
