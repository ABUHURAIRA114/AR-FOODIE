import { useEffect, useState } from "react";
import { Link } from "react-router";
import { T } from "./tokens.mts";

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
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
            maxWidth: 1100,
          }}
        >
          {filtered.map(r => (
            <Link
              key={r.id}
              to={`/menu/${r.slug}`}
              style={{
                background: T.bg3,
                border: `1px solid ${T.border}`,
                borderRadius: 12,
                padding: "1.2rem",
                textDecoration: "none",
                color: T.text,
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
                transition: "border-color 0.15s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                <div
                  style={{
                    width: 52,
                    height: 52,
                    borderRadius: 10,
                    background: r.logo ? "#fff" : T.primary,
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                    fontWeight: 700,
                    color: "#fff",
                    fontSize: "1.2rem",
                  }}
                >
                  {r.logo ? (
                    <img src={r.logo} alt={r.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  ) : (
                    r.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 700, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {r.name}
                    {r.isVerified && <span style={{ color: T.accent, marginLeft: "0.4rem", fontSize: "0.8rem" }}>✓</span>}
                  </p>
                  {r.city && <p style={{ color: T.muted, fontSize: "0.8rem" }}>{r.city}</p>}
                </div>
              </div>

              {r.description && (
                <p
                  style={{
                    color: T.muted,
                    fontSize: "0.85rem",
                    overflow: "hidden",
                    display: "-webkit-box",
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: "vertical" as const,
                  }}
                >
                  {r.description}
                </p>
              )}

              <span
                style={{
                  marginTop: "auto",
                  alignSelf: "flex-start",
                  background: T.primary,
                  color: "#fff",
                  padding: "0.4rem 0.9rem",
                  borderRadius: 8,
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                View Menu →
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export default RestaurantListPage;
