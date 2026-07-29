import { useEffect, useState } from "react";
import { Link } from "react-router";
import { T } from "./tokens.mts";
import { RestaurantLogo } from "./RestaurantLogo";
import { getContrastTextColor } from "../lib/colorContrast";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface Restaurant {
  id: number;
  name: string;
  slug: string;
  city: string;
  description: string;
  logo: string | null;
  primaryColor: string;
  headerBg: string;
  plan: string;
  isVerified: boolean;
}

export function RestaurantListPage() {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    fetch(`${API_URL}/menu-api/restaurants/`)
      .then(r => {
        if (!r.ok) throw new Error(`Request failed: ${r.status}`);
        return r.json();
      })
      .then(data => setRestaurants(data.restaurants))
      .catch(() => setError("Could not load restaurants."))
      .finally(() => setLoading(false));
  }, []);

  const filtered = restaurants.filter(r => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      r.name.toLowerCase().includes(q) ||
      r.city?.toLowerCase().includes(q)
    );
  });

  return (
    <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: "2rem" }}>
      <Link to="/" style={{ color: T.muted, fontSize: "0.88rem", textDecoration: "none" }}>← Back</Link>

      <h1 style={{ marginTop: "1rem", marginBottom: "0.4rem", color: T.accent }}>Restaurants</h1>
      <p style={{ color: T.muted, marginBottom: "1.5rem", fontSize: "0.9rem" }}>
        Browse restaurant menus and view their dishes in AR.
      </p>

      <input
        type="text"
        placeholder="Search by name or city..."
        value={query}
        onChange={e => setQuery(e.target.value)}
        style={{
          width: "100%",
          maxWidth: 420,
          background: T.bg3,
          border: `1px solid ${T.border}`,
          color: T.text,
          borderRadius: 8,
          padding: "0.6rem 0.9rem",
          fontSize: "0.9rem",
          marginBottom: "1.5rem",
          outline: "none",
        }}
      />

      {loading ? (
        <p style={{ color: T.muted }}>Loading...</p>
      ) : error ? (
        <p style={{ color: "#f87171" }}>{error}</p>
      ) : filtered.length === 0 ? (
        <p style={{ color: T.muted }}>
          {restaurants.length === 0 ? "No restaurants yet." : "No restaurants match your search."}
        </p>
      ) : (
        <div
          className="restaurant-list"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0.85rem",
            maxWidth: 900,
          }}
        >
          <style>{`
            @media (max-width: 520px) {
              .restaurant-list a { padding: 0.9rem 1rem !important; }
              .restaurant-list a > span:last-child {
                width: 100%;
                text-align: center;
              }
            }
            .restaurant-list a:hover {
              filter: brightness(1.06);
            }
          `}</style>
          {filtered.map(r => {
            // The whole tab is tinted with the restaurant's own primary
            // color, and the "View Menu" pill uses their header color —
            // both are arbitrary per-restaurant values, so text sitting on
            // top of either one picks black or white for readability
            // depending on how bright that color actually is.
            const cardBg = r.primaryColor || T.primary;
            const btnBg = r.headerBg || T.bg3;
            const cardText = getContrastTextColor(cardBg, "#1a1a1a", "#ffffff");
            const cardMuted = cardText === "#1a1a1a" ? "rgba(26,26,26,0.65)" : "rgba(255,255,255,0.75)";
            const btnText = getContrastTextColor(btnBg, "#1a1a1a", "#ffffff");
            return (
            <Link
              key={r.id}
              to={`/menu/${r.slug}`}
              style={{
                background: cardBg,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "1rem 1.2rem",
                textDecoration: "none",
                color: cardText,
                display: "flex",
                flexWrap: "wrap",
                alignItems: "center",
                gap: "1rem",
                transition: "filter 0.15s ease",
                width: "100%",
                boxSizing: "border-box",
              }}
            >
              {/* Same shared logo component used by the menu templates:
                  renders the logo at its natural aspect ratio (no forced
                  square crop), or falls back to the restaurant's name as
                  text if there's no logo or the image fails to load. */}
              <RestaurantLogo logo={r.logo} name={r.name} size={56} />

              {/* Name/city/description block. flex:1 + minWidth:0 lets it
                  claim whatever width the row (now full page width, not a
                  fixed grid cell) actually has, so text wraps and truncates
                  based on real available space instead of an arbitrary
                  260px card width. */}
              <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                <p style={{ fontWeight: 700, color: cardText, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {r.name}
                  {r.isVerified && <span style={{ color: cardText, marginLeft: "0.4rem", fontSize: "0.8rem" }}>✓</span>}
                </p>
                {r.city && <p style={{ color: cardMuted, fontSize: "0.8rem", marginTop: "0.1rem" }}>{r.city}</p>}
                {r.description && (
                  <p
                    style={{
                      color: cardMuted,
                      fontSize: "0.85rem",
                      marginTop: "0.3rem",
                      overflow: "hidden",
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical" as const,
                    }}
                  >
                    {r.description}
                  </p>
                )}
              </div>

              <span
                style={{
                  flexShrink: 0,
                  background: btnBg,
                  color: btnText,
                  padding: "0.5rem 1.1rem",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                }}
              >
                View Menu →
              </span>
            </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default RestaurantListPage;