/**
 * CheziousARMenu.tsx
 * AR Menu template — Dinenics Platform
 * 
 * BACKEND INTEGRATION:
 * All [BACKEND] comments show exactly where to plug in API calls.
 * This component accepts a `config` prop so any restaurant can use it.
 */

import { useState, useEffect, useRef } from "react";
import { RestaurantLogo } from "./RestaurantLogo";

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

// Restaurant branding config — passed as prop in production
// [BACKEND] fetch('/api/restaurant/{slug}/config/') → RestaurantConfig
export interface RestaurantConfig {
  name: string;
  logo: string;
  primaryColor: string;
  headerBg: string;
  appDownloadUrl?: string;
}

// ─── Default config (Cheezious) ───────────────────────────────────────────────
const DEFAULT_CONFIG: RestaurantConfig = {
  name: "Cheezious",
  logo: "/logos/cheezious.png",
  primaryColor: "#FFC200",
  headerBg: "#f7f5f5",
  appDownloadUrl: "https://cheezious.com",
};

// ─── Dummy data — replace with API calls ─────────────────────────────────────
// [BACKEND] fetch('/api/restaurant/{slug}/categories/')
const DUMMY_CATEGORIES: Category[] = [
  { id: 1, name: "Thin Crust Pizza",    image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Pizza" },
  { id: 2, name: "Malai Tikka",         image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Tikka" },
  { id: 3, name: "Beef Pepperoni Pizza",image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Beef"  },
  { id: 4, name: "Starters",            image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Start" },
  { id: 5, name: "Somewhat Local",      image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Local" },
  { id: 6, name: "Somewhat Social",     image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Social"},
  { id: 7, name: "Burgers",             image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Burger"},
  { id: 8, name: "Pasta",               image: "https://placehold.co/80x80/FFC200/1a2e1a?text=Pasta" },
];

// [BACKEND] fetch('/api/restaurant/{slug}/dishes/?category={id}&search={q}')
const DUMMY_DISHES: Dish[] = [
  { id: 1, name: "Thin Crust Beef Pizza",   description: "A Crispy Thin Crust Topped With Beef Pepperoni, Mozzarella Cheese, And Rich Marinara Sauce.", price: 1480, startingPrice: true,  image: "/cheezious_dishes/thin_crust.png",                              arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 2, name: "Thin Crust Veggie Pizza", description: "Cheese Blend, Mushrooms, Sweet Corn, Black Olives, Onions, Capsicum And Tomatoes.",           price: 1290, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Veggie+Pizza",  arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 3, name: "Thin Crust Cheese Pizza", description: "Extra Special Mozzarella Blend And Signature Sauce On A Crispy Thin Crust.",                   price: 1290, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Cheese+Pizza",  arModelUrl: null, usdzUrl: null, categoryId: 1 },
  { id: 4, name: "Malai Tikka Classic",     description: "Tender chicken marinated in creamy malai sauce, grilled to perfection.",                       price: 990,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Malai+Tikka",   arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 5, name: "Malai Tikka Platter",     description: "Full platter with naan, raita and fresh salad on the side.",                                   price: 1650, startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Tikka+Platter", arModelUrl: null, usdzUrl: null, categoryId: 2 },
  { id: 6, name: "Beef Pepperoni Pizza",    description: "Classic beef pepperoni with rich mozzarella and tangy tomato base.",                           price: 1480, startingPrice: true,  image: "https://placehold.co/340x240/f9f9f9/555?text=Pepperoni",     arModelUrl: null, usdzUrl: null, categoryId: 3 },
  { id: 7, name: "Chicken Wings",           description: "Crispy golden wings tossed in our signature sauce. Served with dip.",                          price: 890,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Wings",         arModelUrl: null, usdzUrl: null, categoryId: 4 },
  { id: 8, name: "Mozzarella Sticks",       description: "Golden fried mozzarella sticks with marinara dipping sauce.",                                  price: 690,  startingPrice: false, image: "https://placehold.co/340x240/f9f9f9/555?text=Mozz+Sticks",  arModelUrl: null, usdzUrl: null, categoryId: 4 },
];

// ─── AR Modal ─────────────────────────────────────────────────────────────────
function ARModal({ dish, onClose, dark, primaryColor }: {
  dish: Dish; onClose: () => void; dark: boolean; primaryColor: string;
}) {
  const bg    = dark ? "#1c1c1c" : "#fff";
  const text  = dark ? "#fff"    : "#1a1a1a";
  const sub   = dark ? "#aaa"    : "#666";
  const dash  = dark ? "#444"    : "#ddd";

  return (
    <div onClick={onClose} style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)",
      display: "flex", alignItems: "flex-end", justifyContent: "center",
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: bg, width: "100%", maxWidth: 560,
        borderRadius: "20px 20px 0 0", padding: "1.5rem 1.5rem 2rem",
        boxShadow: "0 -8px 40px rgba(0,0,0,0.25)",
        maxHeight: "88vh", overflowY: "auto",
      }}>
        {/* Handle */}
        <div style={{ width: 36, height: 4, background: dash, borderRadius: 2, margin: "0 auto 1.2rem" }} />

        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1rem" }}>
          <div style={{ flex: 1, paddingRight: "1rem" }}>
            <h2 style={{ margin: "0 0 0.4rem", fontSize: "1.25rem", fontWeight: 700, color: text, fontFamily: "'Poppins',sans-serif" }}>
              {dish.name}
            </h2>
            <p style={{ margin: 0, fontSize: "0.875rem", color: sub, lineHeight: 1.6 }}>{dish.description}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "1.5rem", cursor: "pointer", color: sub }}>✕</button>
        </div>

        {/* Model viewer or placeholder */}
        {dish.arModelUrl ? (
          <div style={{ borderRadius: 14, overflow: "hidden", background: dark ? "#111" : "#f5f5f5", marginBottom: "1.2rem", height: 280 }}>
            {/* @ts-ignore — model-viewer is a custom element */}
            <model-viewer
              src={dish.arModelUrl}
              ios-src={dish.usdzUrl ?? undefined}
              alt={dish.name}
              ar ar-modes="webxr scene-viewer quick-look" ar-scale="auto"
              camera-controls auto-rotate shadow-intensity="1"
              style={{ width: "100%", height: "100%", background: "transparent" }}
            >
              {/* @ts-ignore */}
              <button slot="ar-button" style={{
                position: "absolute", bottom: "1rem", left: "50%", transform: "translateX(-50%)",
                background: primaryColor, color: "#000", border: "none", borderRadius: 10,
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
            border: `2px dashed ${dash}`,
          }}>
            <p style={{ margin: 0, fontSize: "2rem" }}>🚧</p>
            <p style={{ margin: "0.5rem 0 0", color: sub, fontSize: "0.9rem" }}>AR model coming soon</p>
          </div>
        )}

        {/* Price + close */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontSize: "1.3rem", fontWeight: 700, color: "#e8472a", fontFamily: "'Poppins',sans-serif" }}>
              Rs. {dish.price.toLocaleString()}
            </span>
            {dish.startingPrice && (
              <span style={{ background: "#e8472a", color: "#fff", fontSize: "0.7rem", fontWeight: 600, padding: "0.2rem 0.6rem", borderRadius: 20 }}>
                Starting Price
              </span>
            )}
          </div>
          <button onClick={onClose} style={{
            background: primaryColor, color: "#000", border: "none",
            borderRadius: 8, padding: "0.55rem 1.4rem",
            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
          }}>Close</button>
        </div>
      </div>
    </div>
  );
}

// ─── Dish Card ────────────────────────────────────────────────────────────────
function DishCard({ dish, onShowAR, dark, primaryColor }: {
  dish: Dish; onShowAR: (d: Dish) => void; dark: boolean; primaryColor: string;
}) {
  const cardBg  = dark ? "#1e1e1e" : "#fff";
  const border  = dark ? "#2a2a2a" : "#ececec";
  const imgBg   = dark ? "#141414" : "#fff";
  const text    = dark ? "#f0f0f0" : "#1a1a1a";
  const sub     = dark ? "#999"    : "#888";
  const btnBg   = dish.arModelUrl ? primaryColor        : (dark ? "#2a2a2a" : "#f5f5f5");
  const btnColor= dish.arModelUrl ? "#000"              : (dark ? "#666"    : "#aaa");
  const btnBorder=dish.arModelUrl ? primaryColor        : (dark ? "#333"    : "#e0e0e0");

  return (
    <div
      style={{ background: cardBg, border: `1px solid ${border}`, borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column", boxShadow: dark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.05)", transition: "box-shadow 0.2s" }}
      onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 6px 20px rgba(0,0,0,0.5)" : "0 6px 20px rgba(0,0,0,0.1)"; }}
      onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.boxShadow = dark ? "0 2px 8px rgba(0,0,0,0.4)" : "0 2px 8px rgba(0,0,0,0.05)"; }}
    >
      {/* Image */}
      <div style={{ position: "relative", background: imgBg, padding: "1.2rem 1.2rem 0.5rem", textAlign: "center" }}>
        <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", color: "#e8472a", fontSize: "1.1rem", cursor: "pointer" }}>♡</div>
        {dish.arModelUrl && (
          <span style={{ position: "absolute", top: "0.75rem", left: "0.75rem", background: primaryColor, color: "#000", fontSize: "0.6rem", fontWeight: 800, padding: "0.2rem 0.5rem", borderRadius: 20, letterSpacing: "0.05em" }}>AR</span>
        )}
        <img
          src={dish.image} alt={dish.name}
          style={{ width: "100%", height: 160, objectFit: "contain", display: "block" }}
          onError={e => { (e.target as HTMLImageElement).src = `https://placehold.co/300x160/f9f9f9/aaa?text=${encodeURIComponent(dish.name)}`; }}
          loading="lazy"
        />
      </div>

      {/* Info */}
      <div style={{ padding: "0.9rem 1rem 1rem", flex: 1, display: "flex", flexDirection: "column" }}>
        <h3 style={{ margin: "0 0 0.4rem", fontSize: "1rem", fontWeight: 700, color: text, fontFamily: "'Poppins',sans-serif", lineHeight: 1.3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {dish.name}
        </h3>
        <p style={{ margin: "0 0 0.75rem", fontSize: "0.82rem", color: sub, lineHeight: 1.55, flex: 1, display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical" as const, overflow: "hidden", fontFamily: "'Poppins',sans-serif" }}>
          {dish.description}
        </p>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.75rem" }}>
          <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "#e8472a", fontFamily: "'Poppins',sans-serif" }}>
            Rs. {dish.price.toLocaleString()}
          </span>
          {dish.startingPrice && (
            <span style={{ background: "#e8472a", color: "#fff", fontSize: "0.65rem", fontWeight: 600, padding: "0.18rem 0.55rem", borderRadius: 20 }}>
              Starting Price
            </span>
          )}
        </div>
        <button
          onClick={() => onShowAR(dish)}
          style={{ width: "100%", background: btnBg, color: btnColor, border: `1px solid ${btnBorder}`, borderRadius: 8, padding: "0.65rem", fontWeight: 700, fontSize: "0.9rem", cursor: "pointer", fontFamily: "'Poppins',sans-serif", transition: "opacity 0.15s", letterSpacing: "0.01em" }}
          onMouseEnter={e => (e.currentTarget.style.opacity = "0.85")}
          onMouseLeave={e => (e.currentTarget.style.opacity = "1")}
        >
          {dish.arModelUrl ? "+ SHOW IN AR" : "+ COMING SOON"}
        </button>
      </div>
    </div>
  );
}

// ─── Category Bar ─────────────────────────────────────────────────────────────
function CategoryBar({ categories, active, onSelect, dark, primaryColor }: {
  categories: Category[]; active: number; onSelect: (id: number) => void; dark: boolean; primaryColor: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const scroll = (dir: "left" | "right") =>
    scrollRef.current?.scrollBy({ left: dir === "left" ? -200 : 200, behavior: "smooth" });

  const barBg  = dark ? "#1a1a1a" : "#fff";
  const border = dark ? "#2a2a2a" : "#ececec";
  const arrowBorder = dark ? "#444" : "#ddd";
  const arrowBg = dark ? "#1a1a1a" : "#fff";
  const arrowColor = dark ? "#ccc" : "#888";

  const arrowStyle: React.CSSProperties = {
    position: "absolute", zIndex: 2, width: 32, height: 32,
    borderRadius: "50%", border: `1.5px solid ${arrowBorder}`,
    background: arrowBg, display: "flex", alignItems: "center",
    justifyContent: "center", cursor: "pointer", color: arrowColor,
    fontSize: "0.85rem", flexShrink: 0,
  };

  return (
    <div style={{ background: barBg, borderBottom: `1px solid ${border}`, position: "sticky", top: 68, zIndex: 90 }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", position: "relative", display: "flex", alignItems: "center" }}>
        <button onClick={() => scroll("left")} style={{ ...arrowStyle, left: 0 }}>‹</button>

        <div ref={scrollRef} style={{ display: "flex", gap: 0, overflowX: "auto", scrollbarWidth: "none", padding: "0 40px", flex: 1 }}>
          {categories.map(cat => (
            <button
              key={cat.id}
              data-cat-btn={cat.id}
              onClick={() => onSelect(cat.id)}
              style={{
                flexShrink: 0,
                background: active === cat.id ? primaryColor : "transparent",
                color: active === cat.id ? "#000" : (dark ? "#ccc" : "#1a1a1a"),
                border: "none", borderRadius: active === cat.id ? 8 : 0,
                padding: "0.85rem 1.3rem", fontWeight: 700, fontSize: "0.95rem",
                cursor: "pointer", fontFamily: "'Poppins',sans-serif",
                whiteSpace: "nowrap", transition: "background 0.15s, color 0.15s",
              }}
            >
              {cat.name}
            </button>
          ))}
        </div>

        <button onClick={() => scroll("right")} style={{ ...arrowStyle, right: 0 }}>›</button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
interface Props {
  config?: RestaurantConfig;
  // [BACKEND] In production pass categories + dishes from parent after API fetch
  categories?: Category[];
  dishes?: Dish[];
}

export default function CheziousARMenu({ config = DEFAULT_CONFIG, categories = DUMMY_CATEGORIES, dishes = DUMMY_DISHES }: Props) {
  const [dark, setDark]               = useState(false);
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id ?? 1);
  const [search, setSearch]           = useState("");
  const [selectedDish, setSelectedDish] = useState<Dish | null>(null);
  const [scrolled, setScrolled]       = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const sectionRefs = useRef<{ [key: number]: HTMLDivElement | null }>({});

  // Filter + group
  const visibleDishes = dishes.filter(d =>
    search === "" ||
    d.name.toLowerCase().includes(search.toLowerCase()) ||
    d.description.toLowerCase().includes(search.toLowerCase())
  );

  const groupedDishes = categories
    .map(cat => ({ category: cat, dishes: visibleDishes.filter(d => d.categoryId === cat.id) }))
    .filter(g => g.dishes.length > 0);

  // Scroll spy — highlight active category as user scrolls
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const id = Number(entry.target.getAttribute("data-category-id"));
            if (id) setActiveCategory(id);
          }
        });
      },
      { rootMargin: "-30% 0px -60% 0px", threshold: 0 }
    );
    Object.values(sectionRefs.current).forEach(ref => ref && observer.observe(ref));
    return () => observer.disconnect();
  }, [groupedDishes.length]);

  // Scroll shadow on navbar
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Auto-scroll category bar to keep active button visible
  useEffect(() => {
    const el = document.querySelector(`[data-cat-btn="${activeCategory}"]`) as HTMLElement;
    el?.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
  }, [activeCategory]);

  const handleCategorySelect = (id: number) => {
    setActiveCategory(id);
    setSearch("");
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const { primaryColor, headerBg, logo, name: restaurantName } = config;
  const pageBg = dark ? "#111" : "#f5f5f5";

  return (
    <div style={{ background: pageBg, minHeight: "100vh", fontFamily: "'Poppins',sans-serif" }}>

      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap" />

      {/* ── Navbar ── */}
      <header style={{
        background: headerBg, position: "sticky", top: 0, zIndex: 100,
        height: 68, display: "flex", alignItems: "center",
        boxShadow: scrolled ? "0 4px 20px rgba(0,0,0,0.15)" : "none",
        transition: "box-shadow 0.3s",
      }}>

        {/* Desktop */}
        <div className="nav-desktop" style={{ width: "100%", padding: "0 1rem 0 0", display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ flexShrink: 0 }}>
            <RestaurantLogo logo={logo} name={restaurantName} height={44} />
          </div>

          <div style={{ flex: 1, position: "relative", minWidth: 0 }}>
            <span style={{ position: "absolute", left: "0.9rem", top: "50%", transform: "translateY(-50%)", color: "#999", fontSize: "0.9rem", pointerEvents: "none" }}>🔍</span>
            <input
              type="text" placeholder={`Find in ${restaurantName}`}
              value={search} onChange={e => setSearch(e.target.value)}
              style={{ width: "100%", padding: "0.6rem 1rem 0.6rem 2.4rem", borderRadius: 8, border: "1px solid #ddd", background: "#fff", color: "#1a1a1a", fontSize: "0.95rem", outline: "none", fontFamily: "'Poppins',sans-serif", boxSizing: "border-box", transition: "box-shadow 0.2s" }}
              onFocus={e => (e.target.style.boxShadow = `0 0 0 2px ${primaryColor}`)}
              onBlur={e => (e.target.style.boxShadow = "none")}
            />
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexShrink: 0 }}>
            <button onClick={() => setDark(d => !d)} style={{ background: "rgba(0,0,0,0.06)", border: "1px solid #ddd", borderRadius: 8, padding: "0.5rem 0.65rem", cursor: "pointer", fontSize: "1rem", transition: "background 0.2s" }}>
              {dark ? "☀️" : "🌙"}
            </button>

            <button
              style={{ background: "#fff", color: "#1a2e1a", border: `2px solid ${primaryColor}`, borderRadius: 8, padding: "0.5rem 1.1rem", fontWeight: 600, fontSize: "0.95rem", cursor: "pointer", fontFamily: "'Poppins',sans-serif", display: "flex", alignItems: "center", gap: "0.35rem", transition: "background 0.2s, color 0.2s, transform 0.15s, box-shadow 0.2s", whiteSpace: "nowrap" }}
              onMouseEnter={e => { e.currentTarget.style.background = primaryColor; e.currentTarget.style.transform = "translateY(-1px)"; e.currentTarget.style.boxShadow = `0 4px 12px ${primaryColor}66`; }}
              onMouseLeave={e => { e.currentTarget.style.background = "#fff"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}
            >
              👤 LOGIN
            </button>

            <div style={{ borderLeft: "1px solid #ddd", paddingLeft: "0.6rem", flexShrink: 0 }}>
              <img src="/logos/dinenics.png" alt="Dinenics" height={40} style={{ objectFit: "contain", display: "block", maxWidth: 190 }} />
            </div>
          </div>
        </div>

        {/* Mobile */}
        <div className="nav-mobile" style={{ width: "100%", padding: "0 1rem", display: "none", alignItems: "center" }}>
          <button onClick={() => setSidebarOpen(true)} style={{ background: "none", border: "none", cursor: "pointer", padding: "0.3rem", display: "flex", flexDirection: "column", gap: 5, flexShrink: 0 }}>
            {[0,1,2].map(i => <span key={i} style={{ display: "block", width: 22, height: 2, background: "#333", borderRadius: 2 }} />)}
          </button>

          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <RestaurantLogo logo={logo} name={restaurantName} height={38} />
          </div>

          <button
            onClick={() => {
              const el = document.getElementById("mobile-search-bar");
              if (el) el.style.display = el.style.display === "none" ? "block" : "none";
            }}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "1.2rem", padding: "0.3rem", flexShrink: 0 }}
          >🔍</button>
        </div>

        {/* Mobile search dropdown */}
        <div id="mobile-search-bar" style={{ display: "none", position: "absolute", top: 68, left: 0, right: 0, background: headerBg, padding: "0.75rem 1rem", borderTop: "1px solid #eee", zIndex: 99 }}>
          <input
            type="text" placeholder={`Find in ${restaurantName}`}
            value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "0.6rem 1rem", borderRadius: 8, border: "1px solid #ddd", background: "#fff", color: "#1a1a1a", fontSize: "0.95rem", outline: "none", fontFamily: "'Poppins',sans-serif", boxSizing: "border-box" }}
          />
        </div>
      </header>

      {/* ── Mobile Sidebar ── */}
      {sidebarOpen && (
        <div onClick={() => setSidebarOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 3000, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(3px)" }}>
          <div onClick={e => e.stopPropagation()} style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: 260, background: dark ? "#1a1a1a" : "#fff", padding: "1.5rem 1.25rem", display: "flex", flexDirection: "column", gap: "1.5rem", boxShadow: "-8px 0 30px rgba(0,0,0,0.2)" }}>
            <button onClick={() => setSidebarOpen(false)} style={{ alignSelf: "flex-end", background: "none", border: "none", fontSize: "1.4rem", cursor: "pointer", color: dark ? "#fff" : "#333" }}>✕</button>

            <div style={{ textAlign: "center", paddingBottom: "1rem", borderBottom: `1px solid ${dark ? "#333" : "#eee"}` }}>
              <img src="/logos/dinenics.png" alt="Dinenics" height={36} style={{ objectFit: "contain" }} />
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.75rem", color: dark ? "#888" : "#999", fontFamily: "'Poppins',sans-serif" }}>AR Menu powered by Dinenics</p>
            </div>

            <button style={{ background: primaryColor, color: "#000", border: "none", borderRadius: 10, padding: "0.75rem", fontWeight: 700, fontSize: "1rem", cursor: "pointer", fontFamily: "'Poppins',sans-serif", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
              👤 Login
            </button>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.75rem 1rem", background: dark ? "#2a2a2a" : "#f5f5f5", borderRadius: 10 }}>
              <span style={{ fontFamily: "'Poppins',sans-serif", fontSize: "0.9rem", fontWeight: 600, color: dark ? "#fff" : "#333" }}>
                {dark ? "🌙 Dark Mode" : "☀️ Light Mode"}
              </span>
              <button onClick={() => setDark(d => !d)} style={{ width: 44, height: 24, borderRadius: 12, border: "none", cursor: "pointer", background: dark ? primaryColor : "#ddd", position: "relative", transition: "background 0.2s", flexShrink: 0 }}>
                <span style={{ position: "absolute", top: 3, left: dark ? 23 : 3, width: 18, height: 18, borderRadius: "50%", background: "#fff", transition: "left 0.2s" }} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Category Bar ── */}
      <CategoryBar
        categories={categories} active={activeCategory}
        onSelect={handleCategorySelect} dark={dark} primaryColor={primaryColor}
      />

      {/* ── Dish Sections ── */}
      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "1.5rem 1.25rem 4rem" }}>
        {groupedDishes.length > 0 ? (
          groupedDishes.map(({ category, dishes: catDishes }) => (
            <div
              key={category.id}
              data-category-id={category.id}
              ref={el => { sectionRefs.current[category.id] = el; }}
              style={{ marginBottom: "2.5rem" }}
            >
              <h2 style={{ margin: "0 0 1.25rem", fontSize: "1.3rem", fontWeight: 700, color: dark ? "#f0f0f0" : "#1a1a1a", fontFamily: "'Poppins',sans-serif" }}>
                {category.name}
              </h2>
              <div className="dish-grid">
                {catDishes.map(dish => (
                  <DishCard key={dish.id} dish={dish} onShowAR={setSelectedDish} dark={dark} primaryColor={primaryColor} />
                ))}
              </div>
            </div>
          ))
        ) : (
          <div style={{ textAlign: "center", padding: "5rem 1rem", color: dark ? "#666" : "#bbb" }}>
            <p style={{ fontSize: "2.5rem", margin: "0 0 0.5rem" }}>🍽️</p>
            <p style={{ fontSize: "1rem", fontWeight: 600, fontFamily: "'Poppins',sans-serif" }}>No dishes found</p>
            <p style={{ fontSize: "0.85rem", marginTop: "0.3rem" }}>Try clearing your search</p>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer style={{ background: "#1a2e1a", color: "rgba(255,255,255,0.45)", textAlign: "center", padding: "1.1rem", fontSize: "0.78rem", fontFamily: "'Poppins',sans-serif" }}>
        AR Menu powered by{" "}
        <a href="https://dinenics.com" style={{ color: primaryColor, textDecoration: "none", fontWeight: 700 }}>Dinenics.com</a>
      </footer>

      {/* ── AR Modal ── */}
      {selectedDish && <ARModal dish={selectedDish} onClose={() => setSelectedDish(null)} dark={dark} primaryColor={primaryColor} />}

      {/* ── Styles ── */}
      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        ::-webkit-scrollbar { display: none; }
        input::placeholder { color: #aaa; font-family: 'Poppins', sans-serif; }

        .nav-desktop { display: flex !important; }
        .nav-mobile  { display: none  !important; }

        .dish-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
          gap: 1.25rem;
        }

        @media (max-width: 640px) {
          .nav-desktop { display: none  !important; }
          .nav-mobile  { display: flex  !important; }
          .dish-grid   { grid-template-columns: 1fr 1fr !important; gap: 0.65rem !important; }
        }

        @media (max-width: 340px) {
          .dish-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}