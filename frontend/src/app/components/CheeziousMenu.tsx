/**
 * Cheezious AR Menu — Dinenics
 * Pixel-matched to cheezious.com/menu design.
 * [BACKEND] comments mark where to plug in Django API calls.
 */

import { useState, useEffect, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Dish {
  id: number;
  name: string;
  description: string;
  price: number;
  startingPrice: boolean;
  image: string;
  arModelUrl: string | null;
  usdzUrl: string | null;
  categoryId: number;
}

interface Category {
  id: number;
  name: string;
  image: string;
}

// ─── Dummy Data ───────────────────────────────────────────────────────────────
// [BACKEND] fetch('/api/cheezious/categories/') → Category[]
const CATEGORIES: Category[] = [
  { id: 1, name: "Thin Crust Pizza",   image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Pizza" },
  { id: 2, name: "Malai Tikka",        image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Tikka" },
  { id: 3, name: "Beef Pepperoni Pizza", image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Beef" },
  { id: 4, name: "Starters",           image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Start" },
  { id: 5, name: "Somewhat Local",     image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Local" },
  { id: 6, name: "Somewhat Social",    image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Social" },
  { id: 7, name: "Burgers",            image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Burger" },
  { id: 8, name: "Pasta",              image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Pasta" },
];

// [BACKEND] fetch('/api/cheezious/dishes/?category='+id) → Dish[]
const DISHES: Dish[] = [
  { id: 1,  name: "Thin Crust Beef Pizza",    description: "A Crispy Thin Crust Topped With Beef Pepperoni, Mozzarella Cheese, And Rich Marinara Sauce.",     price: 1480, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Beef+Pizza",    arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 2,  name: "Thin Crust Veggie Pizza",  description: "Cheese Blend, Mushrooms, Sweet Corn, Black Olives, Onions, Capsicum And Tomatoes.",                price: 1290, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Veggie+Pizza",  arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 3,  name: "Thin Crust Cheese Pizza",  description: "Extra Special Mozzarella Blend And Signature Sauce On A Crispy Thin Crust.",                       price: 1290, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Cheese+Pizza",  arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 4,  name: "Malai Tikka Classic",      description: "Tender chicken marinated in creamy malai sauce, grilled to perfection.",                           price: 990,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Malai+Tikka",   arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 5,  name: "Malai Tikka Platter",      description: "Full platter with naan, raita and fresh salad on the side.",                                       price: 1650, startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Tikka+Platter", arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 6,  name: "Beef Pepperoni Pizza",     description: "Classic beef pepperoni with rich mozzarella and tangy tomato base.",                               price: 1480, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Pepperoni",     arModelUrl: null, usdzUrl: null, categoryId: 3 },
  { id: 7,  name: "Chicken Wings",            description: "Crispy golden wings tossed in our signature sauce. Served with dip.",                              price: 890,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Wings",         arModelUrl: null, usdzUrl: null, categoryId: 4 },
  { id: 8,  name: "Mozzarella Sticks",        description: "Golden fried mozzarella sticks with marinara dipping sauce.",                                      price: 690,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Mozz+Sticks",  arModelUrl: null, usdzUrl: null, categoryId: 4 },
];

// ─── AR Modal (bottom sheet) ──────────────────────────────────────────────────
function ARModal({ dish, onClose, dark }: { dish: Dish; onClose: () => void; dark: boolean }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 2000,
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "flex-end", justifyContent: "center",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: dark ? "#1c1c1c" : "#fff",
          width: "100%", maxWidth: 560,
          borderRadius: "20px 20px 0 0",
          padding: "1.5rem 1.5rem 2rem",
          boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
          maxHeight: "88vh", overflowY: "auto",
        }}
      >
        <div style={{ width: 36, height: 4, background: dark ? "#444" : "#ddd", borderRadius: 2, margin: "0 auto 1.2rem" }} />

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div style={{ flex: 1, paddingRight: "1rem" }}>
            <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.25rem", fontWeight: 700, color: dark ? "#fff" : "#1a1a1a", fontFamily: "'Poppins', sans-serif" }}>{dish.name}</h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: dark ? "#aaa" : "#666", lineHeight: 1.6 }}>{dish.description}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: dark ? "#888" : "#999", padding: 0, lineHeight: 1 }}>✕</button>
        </div>

        {dish.arModelUrl ? (
          <div style={{ borderRadius: 14, overflow: "hidden", background: dark ? "#111" : "#f5f5f5", marginBottom: "1.2rem", height: 280 }}>
            {/* @ts-ignore */}
            <model-viewer
              src={dish.arModelUrl}
              ios-src={dish.usdzUrl || undefined}
              alt={dish.name}
              ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto"
              camera-controls auto-rotate shadow-intensity="1"
              style={{ width: "100%", height: "100%", background: "transparent" }}
            >
              {/* @ts-ignore */}
              <button slot="ar-button" style={{
                position: "absolute", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
                background: "#FFC200", color: "#000", border: "none", borderRadius: 10,
                padding: "0.7rem 2rem", fontWeight: 700, fontSize: "0.95rem", cursor: "pointer",
              }}>
                📱 View On Your Table
              </button>
            </model-viewer>
          </div>
        ) : (
          <div style={{
            borderRadius: 14, background: dark ? "#111" : "#f5f5f5",
            padding: "2.5rem", textAlign: "center", marginBottom: "1.2rem",
            border: `2px dashed ${dark ? "#333" : "#ddd"}`,
          }}>
            <p style={{ margin: 0, fontSize: "2rem" }}>🚧</p>
            <p style={{ margin: "0.5rem 0 0", color: dark ? "#888" : "#999", fontSize: "0.9rem" }}>AR model coming soon</p>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e8472a", fontFamily: "'Poppins', sans-serif" }}>
              Rs. {dish.price.toLocaleString()}
            </span>
            {dish.startingPrice && (
              <span style={{ background: "#e8472a", color: "#fff", fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                Starting Price
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: "#FFC200", color: "#000", border: "none", borderRadius: 8,
            padding: "0.55rem 1.4rem", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Dish Card — matches cheezious.com card exactly ───────────────────────────
function DishCard({ dish, onShowAR, dark }: { dish: Dish; onShowAR: (d: Dish) => void; dark: boolean }) {
  return (
    <div style={{
      background: dark ? "#1e1e1e" : "#fff",
      border: `1px solid ${dark ? "#2a2a2a" : "#ececec"}`,
      borderRadius: 12,
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: dark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.05)",
      transition: "box-shadow 0.2s",
      cursor: "default",
    }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 6px 20px rgba(0,0,0,0.5)" : "0 6px 20px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.05)"; }}
    >
      {/* Image area — white bg like cheezious */}
      <div style={{ position: "relative", background: dark ? "#141414" : "#fff", padding: "1.2rem 1.2rem 0.5rem", textAlign: "center" }}>
        {/* Heart icon like cheezious */}
        <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", color: "#e8472a", fontSize: "1.1rem", cursor: "pointer" }}>♡</div>
        {/* AR badge */}
        {dish.arModelUrl && (
          <span style={{
            position: "absolute", top: "0.75rem", left: "0.75rem",
            background: "#FFC200", color: "#000",
            fontSize: "0.6rem", fontWeight: 800, padding: "0.2rem 0.5rem", borderRadius: 20,
            letterSpacing: "0.05em",
          }}>AR</span>
        )}
        <img
          src={dish.image} alt={dish.name}
          style={{ width: "100%", height: 180, objectFit: "contain", display: "block" }}
          onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/300x180/f9f9f9/aaa?text=${encodeURIComponent(dish.name)}`; }}
        />
      </div>

      {/* Info */}
      <div style={{ padding: "0.9rem 1rem 1rem", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{
          margin: "0 0 0.4rem",
          fontSize: "1rem", fontWeight: 700,
          color: dark ? "#f0f0f0" : "#1a1a1a",
          fontFamily: "'Poppins', sans-serif",
          lineHeight: 1.3,
          // Truncate like cheezious "Thin Crust Beef ..."
          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
        }}>
          {dish.name}
        </h3>
        <p style={{
          margin: "0 0 0.75rem", fontSize: "0.82rem",
          color: dark ? "#999" : "#888",
          lineHeight: 1.55, flex: 1,
          display: "-webkit-box", WebkitLineClamp: 3,
          WebkitBoxOrient: "vertical" as const, overflow: "hidden",
          fontFamily: "'Poppins', sans-serif",
        }}>
          {dish.description}
        </p>

        {/* Price row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e8472a", fontFamily: "'Poppins', sans-serif" }}>
            Rs. {dish.price.toLocaleString()}
          </span>
          {dish.startingPrice && (
            <span style={{
              background: "#e8472a", color: "#fff",
              fontSize: "0.65rem", fontWeight: 600,
              padding: "0.18rem 0.55rem", borderRadius: 20,
              fontFamily: "'Poppins', sans-serif",
            }}>
              Starting Price
            </span>
          )}
        </div>

        {/* Show in AR button — replaces "Add to Cart" */}
        <button
          onClick={() => onShowAR(dish)}
          style={{
            width: "100%",
            background: dish.arModelUrl ? "#FFC200" : (dark ? "#2a2a2a" : "#f5f5f5"),
            color: dish.arModelUrl ? "#000" : (dark ? "#666" : "#aaa"),
            border: `1px solid ${dish.arModelUrl ? "#FFC200" : (dark ? "#333" : "#e0e0e0")}`,
            borderRadius: 8, padding: "0.65rem",
            fontWeight: 700, fontSize: "0.9rem",
            cursor: "pointer", fontFamily: "'Poppins', sans-serif",
            transition: "opacity 0.15s",
            letterSpacing: "0.01em",
          }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {dish.arModelUrl ? "+ SHOW IN AR" : "+ COMING SOON"}
        </button>
      </div>
    </div>
  );
}

// ─── Horizontal text-only category bar (top bar like cheezious) ───────────────
function TopCategoryBar({ categories, active, onSelect, dark }: {
  categories: Category[]; active: number; onSelect: (id: number) => void; dark: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
    }
  };

  return (
    <div style={{
      background: dark ? "#1a1a1a" : "#fff",
      borderBottom: `1px solid ${dark ? "#2a2a2a" : "#ececec"}`,
      position: "sticky", top: 68, zIndex: 90,
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", display: "flex", alignItems: "center" }}>
        {/* Left arrow */}
        <button
          onClick={() => scroll("left")}
          style={{
            position: "absolute", left: 0, zIndex: 2,
            width: 32, height: 32, borderRadius: "50%",
            border: `1.5px solid ${dark ? "#444" : "#ddd"}`,
            background: dark ? "#1a1a1a" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: dark ? "#ccc" : "#888",
            fontSize: "0.8rem", flexShrink: 0,
          }}
        >‹</button>

        {/* Scrollable category pills */}
        <div
          ref={scrollRef}
          style={{
            display: "flex", gap: 0, overflowX: "auto",
            scrollbarWidth: "none", padding: "0 40px",
            flex: 1,
          }}
        >
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                background: active === cat.id ? "#FFC200" : "transparent",
                color: active === cat.id ? "#000" : (dark ? "#ccc" : "#1a1a1a"),
                border: "none",
                borderRadius: active === cat.id ? 8 : 0,
                padding: "0.85rem 1.3rem",
                fontWeight: 700,
                fontSize: "0.95rem",
                cursor: "pointer",
                fontFamily: "'Poppins', sans-serif",
                whiteSpace: "nowrap",
                transition: "background 0.15s, color 0.15s",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Right arrow */}
        <button
          onClick={() => scroll("right")}
          style={{
            position: "absolute", right: 0, zIndex: 2,
            width: 32, height: 32, borderRadius: "50%",
            border: `1.5px solid ${dark ? "#444" : "#ddd"}`,
            background: dark ? "#1a1a1a" : "#fff",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: dark ? "#ccc" : "#888",
            fontSize: "0.8rem", flexShrink: 0,
          }}
        >›</button>
      </div>
    </div>
  );
}

// ─── Image category grid (second row like image 2 you shared) ─────────────────
function CategoryImageGrid({ categories, active, onSelect, dark }: {
  categories: Category[]; active: number; onSelect: (id: number) => void; dark: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") => {
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });
  };

  return (
    <div style={{
      background: dark ? "#141414" : "#f9f9f9",
      borderBottom: `1px solid ${dark ? "#222" : "#ececec"}`,
      padding: "1rem 0",
    }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", display: "flex", alignItems: "center", padding: "0 1rem" }}>
        <button onClick={() => scroll("left")} style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
          border: `1.5px solid ${dark ? "#444" : "#ddd"}`,
          background: dark ? "#1a1a1a" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: dark ? "#ccc" : "#888", fontSize: "0.85rem",
          marginRight: "0.5rem",
        }}>‹</button>

        <div ref={scrollRef} style={{ display: "flex", gap: "0.75rem", overflowX: "auto", scrollbarWidth: "none", flex: 1 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center",
                gap: "0.5rem", background: dark ? "#1e1e1e" : "#fff",
                border: `2px solid ${active === cat.id ? "#FFC200" : (dark ? "#2a2a2a" : "#ececec")}`,
                borderRadius: 12, padding: "0.6rem 0.8rem",
                cursor: "pointer", minWidth: 90,
                transition: "border-color 0.15s",
              }}
            >
              <img
                src={cat.image} alt={cat.name}
                style={{ width: 64, height: 64, objectFit: "cover", borderRadius: 8 }}
                onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/64x64/FFC200/1a2e1a?text=${encodeURIComponent(cat.name[0])}`; }}
              />
              <span style={{
                fontSize: "0.68rem", fontWeight: 700,
                color: active === cat.id ? "#FFC200" : (dark ? "#bbb" : "#333"),
                fontFamily: "'Poppins', sans-serif",
                textAlign: "center", lineHeight: 1.2,
                maxWidth: 80, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {cat.name.toUpperCase()}
              </span>
            </button>
          ))}
        </div>

        <button onClick={() => scroll("right")} style={{
          flexShrink: 0, width: 32, height: 32, borderRadius: "50%",
          border: `1.5px solid ${dark ? "#444" : "#ddd"}`,
          background: dark ? "#1a1a1a" : "#fff",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", color: dark ? "#ccc" : "#888", fontSize: "0.85rem",
          marginLeft: "0.5rem",
        }}>›</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CheziousARMenu() {
  const [dark, setDark] = useState(false);
  const [activeCategory, setActiveCategory] = useState(CATEGORIES[0].id);
  const [search, setSearch] = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  useEffect(() => {
  const onScroll = () => setScrolled(window.scrollY > 10);
  window.addEventListener("scroll", onScroll);
  return () => window.removeEventListener("scroll", onScroll);
}, []);


  // [BACKEND] Replace with: fetch(`/api/cheezious/dishes/?category=${activeCategory}&search=${search}`)
  const visibleDishes = DISHES.filter(d => {
    const matchCat = d.categoryId === activeCategory;
    const matchSearch = search === "" ||
      d.name.toLowerCase().includes(search.toLowerCase()) ||
      d.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const pageBg = dark ? "#111" : "#f5f5f5";
  const navBg = dark ? "#f7f5f5" : "#f7f5f5"; // always dark green like cheezious

  return (
    <div style={{ background: pageBg, minHeight: "100vh", fontFamily: "'Poppins', sans-serif" }}>

      {/* Google Fonts — Poppins (cheezious uses this) */}
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" />

  <header style={{
  background: navBg,
  position: "sticky", top: 0, zIndex: 100,
  height: 68,
  display: "flex", alignItems: "center",
  transition: "box-shadow 0.3s",
  boxShadow: scrolled ? "0 4px 20px rgba(0,0,0,0.4)" : "none",
}}>

  {/* ── Desktop navbar ── */}
  <div className="nav-desktop" style={{
    width: "100%",
    padding: "0 1rem 0 0",
    display: "flex", alignItems: "center", gap: "0.75rem",
  }}>
    <div style={{ flexShrink: 0 }}>
      <img src="/logos/cheezious.png" alt="Cheezious" height={44} style={{ objectFit: "contain", display: "block" }} />
    </div>

    <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
      <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#999", fontSize: "0.9rem", pointerEvents: "none" }}>🔍</span>
      <input
        type="text" placeholder="Find in Cheezious"
        value={search} onChange={e => setSearch(e.target.value)}
        style={{
          width: "100%", padding: "0.6rem 1rem 0.6rem 2.4rem",
          borderRadius: 8, border: "1px solid #ddd",
          background: "#fff", color: "#1a1a1a",
          fontSize: "0.95rem", outline: "none",
          fontFamily: "'Poppins', sans-serif",
          boxSizing: "border-box" as const,
          transition: "box-shadow 0.2s",
        }}
        onFocus={e => e.target.style.boxShadow = "0 0 0 2px #FFC200"}
        onBlur={e => e.target.style.boxShadow = "none"}
      />
    </div>

    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
      <button onClick={() => setDark(d => !d)} style={{
        background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
        borderRadius: 8, padding: "0.5rem 0.65rem",
        cursor: "pointer", fontSize: "1rem", color: "#fff", transition: "background 0.2s",
      }}
        onMouseEnter={e => (e.currentTarget.style.background = "rgba(255,255,255,0.2)")}
        onMouseLeave={e => (e.currentTarget.style.background = "rgba(255,255,255,0.1)")}
      >{dark ? "☀️" : "🌙"}</button>

      <button style={{
        background: "#fff", color: "#1a2e1a", border: "2px solid #FFC200",
        borderRadius: 8, padding: "0.5rem 1rem",
        fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
        fontFamily: "'Poppins', sans-serif",
        display: "flex", alignItems: "center", gap: "0.35rem",
        transition: "background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s",
        flexShrink: 0, whiteSpace: "nowrap",
      }}
        onMouseEnter={e => {
          e.currentTarget.style.background = "#FFC200";
          e.currentTarget.style.color = "#000";
          e.currentTarget.style.transform = "translateY(-1px)";
          e.currentTarget.style.boxShadow = "0 4px 12px rgba(255,194,0,0.4)";
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = "#fff";
          e.currentTarget.style.color = "#1a2e1a";
          e.currentTarget.style.transform = "translateY(0)";
          e.currentTarget.style.boxShadow = "none";
        }}
      >👤 LOGIN</button>

      <div style={{ borderLeft: "1px solid rgba(255,255,255,0.15)", paddingLeft: "0.6rem", flexShrink: 0 }}>
        <img src="/logos/dinenics.png" alt="Dinenics" height={28} style={{ objectFit: "contain", display: "block", maxWidth: 90 }} />
      </div>
    </div>
  </div>

  {/* ── Mobile navbar ── */}
  <div className="nav-mobile" style={{
    width: "100%", padding: "0 1rem",
    display: "none", alignItems: "center",
  }}>
    {/* Hamburger left */}
    <button onClick={() => setSidebarOpen(true)} style={{
      background: "none", border: "none", cursor: "pointer",
      color: "#fff", fontSize: "1.4rem", padding: "0.3rem",
      display: "flex", flexDirection: "column", gap: "5px", flexShrink: 0,
    }}>
      <span style={{ display: "block", width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
      <span style={{ display: "block", width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
      <span style={{ display: "block", width: 22, height: 2, background: "#fff", borderRadius: 2 }} />
    </button>

    {/* Cheezious logo center */}
    <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
      <img src="/logos/cheezious.png" alt="Cheezious" height={38} style={{ objectFit: "contain" }} />
    </div>

    {/* Search icon right */}
    <button
      onClick={() => {
        const el = document.getElementById("mobile-search-bar");
        if (el) el.style.display = el.style.display === "none" ? "block" : "none";
      }}
      style={{
        background: "none", border: "none", cursor: "pointer",
        color: "#fff", fontSize: "1.2rem", padding: "0.3rem", flexShrink: 0,
      }}
    >🔍</button>
  </div>

  {/* Mobile search bar — slides down when tapped */}
  <div id="mobile-search-bar" style={{
    display: "none", position: "absolute", top: 68, left: 0, right: 0,
    background: navBg, padding: "0.75rem 1rem",
    borderTop: "1px solid rgba(255,255,255,0.1)", zIndex: 99,
  }}>
    <input
      type="text" placeholder="Find in Cheezious"
      value={search} onChange={e => setSearch(e.target.value)}
      style={{
        width: "100%", padding: "0.6rem 1rem",
        borderRadius: 8, border: "1px solid #ddd",
        background: "#fff", color: "#1a1a1a",
        fontSize: "0.95rem", outline: "none",
        fontFamily: "'Poppins', sans-serif",
        boxSizing: "border-box" as const,
      }}
    />
  </div>
</header>


{/* ── Mobile Sidebar ── */}
{sidebarOpen && (
  <div
    onClick={() => setSidebarOpen(false)}
    style={{
      position: "fixed", inset: 0, zIndex: 3000,
      background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)",
    }}
  >
    <div
      onClick={e => e.stopPropagation()}
      style={{
        position: "absolute", right: 0, top: 0, bottom: 0,
        width: 260, background: dark ? "#1a1a1a" : "#fff",
        padding: "1.5rem 1.25rem",
        display: "flex", flexDirection: "column", gap: "1.5rem",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.2)",
      }}
    >
      {/* Close */}
      <button
        onClick={() => setSidebarOpen(false)}
        style={{
          alignSelf: "flex-end", background: "none", border: "none",
          fontSize: "1.4rem", cursor: "pointer",
          color: dark ? "#fff" : "#333",
        }}
      >✕</button>

      {/* Dinenics logo */}
      <div style={{ textAlign: "center", paddingBottom: "1rem", borderBottom: `1px solid ${dark ? "#333" : "#eee"}` }}>
        <img src="/logos/dinenics.png" alt="Dinenics" height={36} style={{ objectFit: "contain" }} />
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: dark ? "#888" : "#999", fontFamily: "'Poppins', sans-serif" }}>
          AR Menu powered by Dinenics
        </p>
      </div>

      {/* Login button */}
      <button style={{
        background: "#FFC200", color: "#000", border: "none",
        borderRadius: 10, padding: "0.75rem",
        fontWeight: 700, fontSize: "1rem", cursor: "pointer",
        fontFamily: "'Poppins', sans-serif",
        display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem",
      }}>
        👤 Login
      </button>

      {/* Dark mode toggle */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0.75rem 1rem",
        background: dark ? "#2a2a2a" : "#f5f5f5",
        borderRadius: 10,
      }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: "0.9rem", fontWeight: 600, color: dark ? "#fff" : "#333" }}>
          {dark ? "🌙 Dark Mode" : "☀️ Light Mode"}
        </span>
        <button
          onClick={() => setDark(d => !d)}
          style={{
            width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer",
            background: dark ? "#FFC200" : "#ddd",
            position: "relative", transition: "background 0.2s",
            flexShrink: 0,
          }}
        >
          <span style={{
            position: "absolute", top: 3,
            left: dark ? 23 : 3,
            width: 18, height: 18, borderRadius: "50%",
            background: "#fff", transition: "left 0.2s",
          }} />
        </button>
      </div>
    </div>
  </div>
)}

      {/* ── Top text category bar (exactly like cheezious) ── */}
      <TopCategoryBar
        categories={CATEGORIES} active={activeCategory}
        onSelect={id => { setActiveCategory(id); setSearch(""); }} dark={dark}
      />

      {/* ── Image category grid ── */}
      <CategoryImageGrid
        categories={CATEGORIES} active={activeCategory}
        onSelect={id => { setActiveCategory(id); setSearch(""); }} dark={dark}
      />

      {/* ── Main content ── */}
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>

        {/* Category title like cheezious */}
        <h2 style={{
          margin: "0 0 1.25rem",
          fontSize: "1.3rem", fontWeight: 700,
          color: dark ? "#f0f0f0" : "#1a1a1a",
          fontFamily: "'Poppins', sans-serif",
        }}>
          {CATEGORIES.find(c => c.id === activeCategory)?.name}
        </h2>

        {/* Dish grid */}
        {visibleDishes.length > 0 ? (
         <div className="dish-grid">
            {visibleDishes.map(dish => (
              <DishCard key={dish.id} dish={dish} onShowAR={setSelectedDish} dark={dark} />
            ))}
          </div>
        ) : (
          <div style={{ textAlign: "center", padding: "5rem 1rem", color: dark ? "#666" : "#bbb" }}>
            <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>🍽️</p>
            <p style={{ fontSize: "1rem", fontWeight: 600, fontFamily: "'Poppins', sans-serif" }}>No dishes found</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>Try a different category or clear your search</p>
          </div>
        )}
      </div>

      {/* ── Footer ── */}
      <footer style={{
        background: "#1a2e1a", color: "rgba(255,255,255,0.45)",
        textAlign: "center", padding: "1.1rem",
        fontSize: "0.78rem", fontFamily: "'Poppins', sans-serif",
      }}>
        AR Menu powered by{" "}
        <a href="https://dinenics.com" style={{ color: "#FFC200", textDecoration: "none", fontWeight: 700 }}>
          Dinenics.com
        </a>
      </footer>

      {/* ── AR Modal ── */}
      {selectedDish && <ARModal dish={selectedDish} onClose={() => setSelectedDish(null)} dark={dark} />}

      {/* ── Global styles ── */}
     <style>{`
  * { box-sizing: border-box; margin: 0; padding: 0; }
  ::-webkit-scrollbar { display: none; }
  input::placeholder { color: #aaa; font-family: 'Poppins', sans-serif; }

  .nav-desktop { display: flex !important; }
  .nav-mobile  { display: none !important; }

  .dish-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 1.25rem;
  }

  @media (max-width: 640px) {
    .nav-desktop { display: none !important; }
    .nav-mobile  { display: flex !important; }

    .dish-grid {
      grid-template-columns: 1fr 1fr !important;
      gap: 0.65rem !important;
    }
  }

  @media (max-width: 340px) {
    .dish-grid {
      grid-template-columns: 1fr !important;
    }
  }
`}</style>
    </div>
  );
}
