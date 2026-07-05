/**
 * Cheezious AR Menu Dashboard
 * ─────────────────────────────
 * Matches Cheezious branding: dark green header, yellow accent (#FFC200), white body.
 * Category selector shows image + name cards (like image 2).
 * Dish grid shows dish cards with "Show in AR" button.
 * Dark mode toggle included.
 * Fully responsive — mobile first.
 *
 * BACKEND INTEGRATION POINTS are marked with: // [BACKEND]
 *
 * FUTURE: Restaurant self-serve dashboard (see bottom of file for plan notes)
 */

import { useState, useEffect } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  startingPrice: boolean;
  image: string;
  arModelUrl: string | null; // GLB file URL
  usdzUrl: string | null;    // USDZ for iOS
  categoryId: number;
}

interface Category {
  id: number;
  name: string;
  image: string;
}

// ─── Dummy Data (replace with API calls) ─────────────────────────────────────
// [BACKEND] Replace this with: fetch('/api/cheezious/categories/') → Category[]
const CATEGORIES: Category[] = [
  { id: 1, name: "Thin Crust Pizza", image: "https://placehold.co/120x120/FFC200/000?text=Pizza" },
  { id: 2, name: "Malai Tikka", image: "https://placehold.co/120x120/FFC200/000?text=Tikka" },
  { id: 3, name: "Beef Pepperoni", image: "https://placehold.co/120x120/FFC200/000?text=Pepperoni" },
  { id: 4, name: "Starters", image: "https://placehold.co/120x120/FFC200/000?text=Starters" },
  { id: 5, name: "Somewhat Local", image: "https://placehold.co/120x120/FFC200/000?text=Local" },
  { id: 6, name: "Burgers", image: "https://placehold.co/120x120/FFC200/000?text=Burgers" },
];

// [BACKEND] Replace this with: fetch('/api/cheezious/dishes/?category=' + categoryId) → Dish[]
const DISHES: Dish[] = [
  { id: 1, name: "Thin Crust Beef Pizza", description: "A crispy thin crust topped with beef pepperoni, mozzarella cheese, and rich marinara sauce.", price: 1480, startingPrice: true, image: "https://placehold.co/300x220/f5f5f5/333?text=Beef+Pizza", arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 2, name: "Thin Crust Veggie Pizza", description: "Cheese blend, mushrooms, sweet corn, black olives, onions, capsicum and tomatoes.", price: 1290, startingPrice: true, image: "https://placehold.co/300x220/f5f5f5/333?text=Veggie+Pizza", arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 3, name: "Thin Crust Cheese Pizza", description: "Extra special mozzarella blend and signature sauce on a crispy thin crust.", price: 1290, startingPrice: true, image: "https://placehold.co/300x220/f5f5f5/333?text=Cheese+Pizza", arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 4, name: "Malai Tikka Classic", description: "Tender chicken marinated in creamy malai sauce, grilled to perfection.", price: 990, startingPrice: false, image: "https://placehold.co/300x220/f5f5f5/333?text=Malai+Tikka", arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 5, name: "Malai Tikka Platter", description: "Full platter with naan, raita and fresh salad on the side.", price: 1650, startingPrice: false, image: "https://placehold.co/300x220/f5f5f5/333?text=Tikka+Platter", arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 6, name: "Beef Pepperoni Pizza", description: "Classic beef pepperoni with rich mozzarella and tangy tomato base.", price: 1480, startingPrice: true, image: "https://placehold.co/300x220/f5f5f5/333?text=Pepperoni", arModelUrl: null, usdzUrl: null, categoryId: 3 },
  { id: 7, name: "Chicken Wings", description: "Crispy golden wings tossed in our signature sauce. Served with dip.", price: 890, startingPrice: false, image: "https://placehold.co/300x220/f5f5f5/333?text=Wings", arModelUrl: null, usdzUrl: null, categoryId: 4 },
  { id: 8, name: "Mozzarella Sticks", description: "Golden fried mozzarella sticks with marinara dipping sauce.", price: 690, startingPrice: false, image: "https://placehold.co/300x220/f5f5f5/333?text=Mozz+Sticks", arModelUrl: null, usdzUrl: null, categoryId: 4 },
];

// ─── Branding config (in production this comes from restaurant's settings)
// [BACKEND] fetch('/api/restaurant/branding/') → { primaryColor, logo, name, ... }
const BRAND = {
  name: "Cheezious",
  logo: "https://cheezious.com/static/images/logo.png", // Cheezious logo
  primaryColor: "#FFC200",       // Cheezious yellow
  headerBg: "#1a2e1a",           // dark green header
  accentText: "#c8341a",         // price red/orange
  tagline: "Find in Cheezious",
};

// ─── AR Modal ─────────────────────────────────────────────────────────────────
function ARModal({ dish, onClose, dark }: { dish: Dish; onClose: () => void; dark: boolean }) {
  const bg = dark ? "#1a1a1a" : "#fff";
  const text = dark ? "#f0f0f0" : "#111";
  const sub = dark ? "#aaa" : "#666";
  const border = dark ? "#333" : "#eee";

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.7)", backdropFilter: "blur(6px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
        padding: "0",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg, width: "100%", maxWidth: 540,
          borderRadius: "20px 20px 0 0", padding: "1.5rem",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
          maxHeight: "90vh", overflowY: "auto",
        }}
      >
        {/* Handle bar */}
        <div style={{ width: 40, height: 4, background: border, borderRadius: 2, margin: "0 auto 1.2rem" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "1.2rem", fontWeight: 800, color: text, fontFamily: "sans-serif" }}>{dish.name}</h2>
            <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: sub }}>{dish.description}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: sub, padding: "0 0 0 1rem" }}>✕</button>
        </div>

        {/* model-viewer embed */}
        {/* [BACKEND] dish.arModelUrl comes from Cloudflare R2 via Django API */}
        {dish.arModelUrl ? (
          <div style={{ borderRadius: 12, overflow: "hidden", background: dark ? "#111" : "#f8f8f8", marginBottom: "1rem" }}>
            {/* @ts-ignore — model-viewer is a custom element */}
            <model-viewer
              src={dish.arModelUrl}
              ios-src={dish.usdzUrl || undefined}
              alt={dish.name}
              ar
              ar-modes="webxr scene-viewer quick-look"
              ar-scale="auto"
              camera-controls
              auto-rotate
              shadow-intensity="1"
              style={{ width: "100%", height: 300, background: "transparent" }}
            >
              {/* @ts-ignore */}
              <button
                slot="ar-button"
                style={{
                  position: "absolute", bottom: "1rem", left: "50%",
                  transform: "translateX(-50%)",
                  background: BRAND.primaryColor, color: "#000",
                  border: "none", borderRadius: 10, padding: "0.7rem 1.8rem",
                  fontWeight: 800, fontSize: "0.95rem", cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📱 View on Your Table
              </button>
            </model-viewer>
          </div>
        ) : (
          <div style={{
            borderRadius: 12, background: dark ? "#111" : "#f8f8f8",
            padding: "2rem", textAlign: "center", marginBottom: "1rem",
            border: `2px dashed ${border}`,
          }}>
            <p style={{ color: sub, fontSize: "0.9rem", margin: 0 }}>
              🚧 AR model coming soon for this dish
            </p>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <span style={{ fontSize: "1.3rem", fontWeight: 900, color: BRAND.accentText, fontFamily: "sans-serif" }}>
              Rs. {dish.price.toLocaleString()}
            </span>
            {dish.startingPrice && (
              <span style={{
                marginLeft: "0.5rem", background: BRAND.accentText, color: "#fff",
                fontSize: "0.7rem", fontWeight: 700, padding: "0.2rem 0.5rem",
                borderRadius: 20,
              }}>Starting Price</span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: BRAND.primaryColor, color: "#000", border: "none",
            borderRadius: 10, padding: "0.6rem 1.4rem", fontWeight: 800,
            fontSize: "0.9rem", cursor: "pointer",
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dish Card ────────────────────────────────────────────────────────────────
function DishCard({ dish, onShowAR, dark }: { dish: Dish; onShowAR: (d: Dish) => void; dark: boolean }) {
  const bg = dark ? "#1e1e1e" : "#fff";
  const text = dark ? "#f0f0f0" : "#111";
  const sub = dark ? "#999" : "#555";
  const border = dark ? "#2a2a2a" : "#f0f0f0";

  return (
    <div style={{
      background: bg, border: `1px solid ${border}`,
      borderRadius: 14, overflow: "hidden",
      boxShadow: dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.06)",
      display: "flex", flexDirection: "column",
      transition: "transform 0.2s, box-shadow 0.2s",
      cursor: "default",
    }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(-3px)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 8px 24px rgba(0,0,0,0.5)" : "0 8px 24px rgba(0,0,0,0.12)";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
        (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 2px 12px rgba(0,0,0,0.4)" : "0 2px 12px rgba(0,0,0,0.06)";
      }}
    >
      {/* Dish image */}
      <div style={{ position: "relative", background: dark ? "#111" : "#fafafa", padding: "1rem 1rem 0" }}>
        <img
          src={dish.image} alt={dish.name}
          style={{ width: "100%", height: 160, objectFit: "contain", display: "block" }}
          onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/300x200/f5f5f5/999?text=${encodeURIComponent(dish.name)}`; }}
        />
        {/* AR badge */}
        {dish.arModelUrl && (
          <span style={{
            position: "absolute", top: 10, right: 10,
            background: BRAND.primaryColor, color: "#000",
            fontSize: "0.65rem", fontWeight: 800, padding: "0.2rem 0.5rem",
            borderRadius: 20, letterSpacing: "0.04em",
          }}>AR</span>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: "0.9rem 1rem 1rem", flex: 1, display: "flex", flexDirection: "column", gap: "0.4rem" }}>
        <h3 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: text, fontFamily: "sans-serif", lineHeight: 1.3 }}>
          {dish.name}
        </h3>
        <p style={{ margin: 0, fontSize: "0.78rem", color: sub, lineHeight: 1.5, flex: 1,
          display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
        }}>
          {dish.description}
        </p>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginTop: "0.3rem" }}>
          <span style={{ fontSize: "1rem", fontWeight: 900, color: BRAND.accentText, fontFamily: "sans-serif" }}>
            Rs. {dish.price.toLocaleString()}
          </span>
          {dish.startingPrice && (
            <span style={{
              background: BRAND.accentText, color: "#fff",
              fontSize: "0.65rem", fontWeight: 700, padding: "0.15rem 0.45rem", borderRadius: 20,
            }}>Starting Price</span>
          )}
        </div>

        {/* Show in AR button */}
        <button
          onClick={() => onShowAR(dish)}
          style={{
            marginTop: "0.5rem",
            background: dish.arModelUrl ? BRAND.primaryColor : (dark ? "#2a2a2a" : "#f5f5f5"),
            color: dish.arModelUrl ? "#000" : sub,
            border: "none", borderRadius: 8,
            padding: "0.6rem", width: "100%",
            fontWeight: 800, fontSize: "0.85rem", cursor: "pointer",
            fontFamily: "sans-serif", transition: "opacity 0.15s",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {dish.arModelUrl ? "📱 Show in AR" : "⏳ Coming Soon"}
        </button>
      </div>
    </div>
  );
}

// ─── Category Selector ────────────────────────────────────────────────────────
function CategorySelector({ categories, active, onSelect, dark }: {
  categories: Category[]; active: number; onSelect: (id: number) => void; dark: boolean;
}) {
  const bg = dark ? "#1e1e1e" : "#fff";
  const border = dark ? "#2a2a2a" : "#eee";

  return (
    <div style={{
      display: "flex", gap: "0.75rem", overflowX: "auto", padding: "1rem 1rem 0.5rem",
      scrollbarWidth: "none", msOverflowStyle: "none",
    }}>
      {categories.map(cat => (
        <button
          key={cat.id}
          onClick={() => onSelect(cat.id)}
          style={{
            flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
            gap: "0.5rem", background: bg, border: `2px solid ${active === cat.id ? BRAND.primaryColor : border}`,
            borderRadius: 14, padding: "0.6rem 0.8rem", cursor: "pointer",
            minWidth: 90, transition: "border-color 0.2s, box-shadow 0.2s",
            boxShadow: active === cat.id ? `0 0 0 1px ${BRAND.primaryColor}` : "none",
          }}
        >
          <img
            src={cat.image} alt={cat.name}
            style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 10 }}
            onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/64x64/FFC200/000?text=${encodeURIComponent(cat.name[0])}`; }}
          />
          <span style={{
            fontSize: "0.72rem", fontWeight: active === cat.id ? 800 : 600,
            color: active === cat.id ? BRAND.primaryColor : (dark ? "#ccc" : "#333"),
            textAlign: "center", fontFamily: "sans-serif", lineHeight: 1.2,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 80,
          }}>
            {cat.name.toUpperCase()}
          </span>
        </button>
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────
export default function CheziousARMenu() {
  const [dark, setDark] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [logoError, setLogoError] = useState(false);

  // Auto dark mode based on system preference
  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const handler = (e: MediaQueryListEvent) => setDark(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  // [BACKEND] Replace filter logic with API call when search/category changes:
  // fetch(`/api/cheezious/dishes/?category=${activeCategory}&search=${search}`)
  const visibleDishes = DISHES.filter(d => {
    const matchCat = d.categoryId === activeCategory;
    const matchSearch = search === "" ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const pageBg = dark ? "#121212" : "#f8f8f8";
  const cardBg = dark ? "#1e1e1e" : "#fff";
  const textColor = dark ? "#f0f0f0" : "#111";
  const subColor = dark ? "#888" : "#666";
  const inputBg = dark ? "#1e1e1e" : "#fff";
  const inputBorder = dark ? "#333" : "#ddd";

  return (
    <div style={{ background: pageBg, minHeight: "100vh", fontFamily: "sans-serif", color: textColor }}>

      {/* model-viewer script — needed for AR */}
      {/* [BACKEND] This script is already in your index.html, no change needed */}

      {/* ── Header ── */}
      <header style={{
        background: BRAND.headerBg, position: "sticky", top: 0, zIndex: 100,
        boxShadow: "0 2px 12px rgba(0,0,0,0.3)",
      }}>
        <div style={{
          maxWidth: 1100, margin: "0 auto", padding: "0 1rem",
          display: "flex", alignItems: "center", gap: "1rem", height: 60,
        }}>
          {/* Logo */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            {!logoError ? (
              <img
                src={BRAND.logo} alt={BRAND.name}
                height={36} style={{ objectFit: "contain" }}
                onError={() => setLogoError(true)}
              />
            ) : (
              <span style={{ color: BRAND.primaryColor, fontWeight: 900, fontSize: "1.2rem" }}>{BRAND.name}</span>
            )}
          </div>

          {/* Search */}
          <div style={{ flex: 1, position: "relative" }}>
            <span style={{ position: "absolute", left: "0.8rem", top: "50%", transform: "translateY(-50%)", color: subColor, pointerEvents: "none", fontSize: "0.9rem" }}>🔍</span>
            <input
              type="text"
              placeholder={BRAND.tagline}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%", padding: "0.55rem 0.8rem 0.55rem 2.2rem",
                borderRadius: 8, border: `1px solid ${inputBorder}`,
                background: inputBg, color: textColor,
                fontSize: "0.88rem", outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          {/* Dark mode toggle */}
          <button
            onClick={() => setDark(d => !d)}
            title="Toggle dark mode"
            style={{
              background: dark ? "#333" : "rgba(255,255,255,0.1)",
              border: "none", borderRadius: 8,
              padding: "0.45rem 0.7rem", cursor: "pointer",
              fontSize: "1rem", flexShrink: 0, color: "#fff",
              transition: "background 0.2s",
            }}
          >
            {dark ? "☀️" : "🌙"}
          </button>

          {/* Powered by Dinenics */}
          <a
            href="https://dinenics.com"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flexShrink: 0, background: BRAND.primaryColor, color: "#000",
              padding: "0.4rem 0.8rem", borderRadius: 8,
              fontSize: "0.7rem", fontWeight: 800, textDecoration: "none",
              whiteSpace: "nowrap", display: "none", // visible on md+
            }}
            className="powered-badge"
          >
            Powered by Dinenics
          </a>
        </div>
      </header>

      {/* ── Category Selector ── */}
      <div style={{ background: cardBg, borderBottom: `1px solid ${dark ? "#2a2a2a" : "#eee"}` }}>
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <CategorySelector
            categories={CATEGORIES}
            active={activeCategory}
            onSelect={id => { setActiveCategory(id); setSearch(""); }}
            dark={dark}
          />
        </div>
      </div>

      {/* ── Category title ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.2rem 1rem 0.5rem" }}>
        <h2 style={{ margin: 0, fontSize: "1.3rem", fontWeight: 900, color: textColor }}>
          {CATEGORIES.find(c => c.id === activeCategory)?.name}
        </h2>
        {search && (
          <p style={{ margin: "0.3rem 0 0", fontSize: "0.85rem", color: subColor }}>
            {visibleDishes.length} result{visibleDishes.length !== 1 ? "s" : ""} for "{search}"
          </p>
        )}
      </div>

      {/* ── Dish Grid ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "0.8rem 1rem 3rem" }}>
        {visibleDishes.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "1rem",
          }}>
            {visibleDishes.map(dish => (
              <DishCard key={dish.id} dish={dish} onShowAR={setSelectedDish} dark={dark} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "4rem 1rem", color: subColor }}>
            <p style={{ fontSize: "2rem", margin: "0 0 0.5rem" }}>🍽️</p>
            <p style={{ fontSize: "1rem", fontWeight: 600 }}>No dishes found</p>
            <p style={{ fontSize: "0.85rem" }}>Try a different category or search term</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{
        background: BRAND.headerBg, color: "rgba(255,255,255,0.5)",
        textAlign: "center", padding: "1rem",
        fontSize: "0.75rem",
      }}>
        AR Menu powered by{" "}
        <a href="https://dinenics.com" style={{ color: BRAND.primaryColor, textDecoration: "none", fontWeight: 700 }}>
          Dinenics.com
        </a>
      </footer>

      {/* ── AR Modal ── */}
      {selectedDish && (
        <ARModal dish={selectedDish} onClose={() => setSelectedDish(null)} dark={dark} />
      )}

      {/* ── Responsive styles ── */}
      <style>{`
        * { box-sizing: border-box; }
        body { margin: 0; }
        input::placeholder { color: #999; }
        ::-webkit-scrollbar { display: none; }

        @media (min-width: 640px) {
          .powered-badge {
            display: inline-block !important;
          }
        }

        @media (max-width: 480px) {
          /* tighter grid on small phones */
          main > div {
            grid-template-columns: repeat(auto-fill, minmax(160px, 1fr)) !important;
          }
        }
      `}</style>
    </div>
  );
}

/*
──────────────────────────────────────────────────────────────────────────────
FUTURE: Restaurant Self-Serve Dashboard Plan
──────────────────────────────────────────────────────────────────────────────

When restaurants want to create their own AR menu without coding, build this flow:

1. ONBOARDING FORM (React multi-step form)
   Step 1 — Branding
     - Restaurant name
     - Logo upload (stored in Cloudflare R2)
     - Primary color picker (hex)
     - Header background color picker

   Step 2 — Categories
     - Add category: name + image upload
     - Reorder via drag and drop

   Step 3 — Dishes
     - For each dish: name, description, price, image, AR model (GLB upload)
     - Mark as "Starting Price" toggle
     - Assign to category

   Step 4 — Preview + Publish
     - Live preview of their menu
     - Publish button → generates unique URL: dinenics.com/menu/restaurant-slug

2. DJANGO BACKEND CHANGES NEEDED
   - RestaurantProfile model (name, slug, primaryColor, headerBg, logoUrl)
   - Category model (name, image, restaurantId)
   - Dish model already exists as Scene — add categoryId + restaurantId FK
   - New API endpoints:
     GET  /api/menu/{slug}/                → full menu data for a restaurant
     POST /api/restaurant/onboard/         → create restaurant + branding
     POST /api/restaurant/dishes/          → add dish with GLB upload to R2
     GET  /api/restaurant/dashboard/       → list all their dishes + QR codes

3. DYNAMIC BRANDING
   - Pass BRAND config from API instead of hardcoded const
   - CSS variables for primaryColor so it applies everywhere dynamically
   - Each restaurant gets their own slug URL

4. QR CODE
   - Each restaurant's menu URL: dinenics.com/menu/cheezious
   - QR code generated pointing to this URL
   - Restaurant downloads QR and puts it on physical menu
──────────────────────────────────────────────────────────────────────────────
*/
