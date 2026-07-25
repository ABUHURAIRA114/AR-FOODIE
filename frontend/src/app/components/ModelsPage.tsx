import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { checkAuth, logoutRequest } from "../lib/auth";
import { QRCodeSVG } from "qrcode.react";
import { T } from "./tokens.mts";

const API_URL = (import.meta as any).env.VITE_API_URL || "";

interface DishModel {
    id: string;
    name: string;
    description: string;
    restaurant: string;
    category: string;
    glb_url: string | null;
    usdz_url: string | null;
    /** Link to the AR viewer, or null if this dish has no 3D model uploaded yet. */
    ar_url: string | null;
    owner: number | null;
}

export function ModelsPage() {
    const navigate = useNavigate();

    const [dishes, setDishes] = useState<DishModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [isStaff, setIsStaff] = useState(false);
    const [isUser, setIsUser] = useState(false);

    const [authChecked, setAuthChecked] = useState(false);
    const [copiedId, setCopiedId] = useState<string | null>(null);

    useEffect(() => {
        checkAuth().then(data => {
            setIsStaff(data.is_staff);
            setIsUser(data.is_user);
            setAuthChecked(true);
            if (!data.is_user) {
                navigate("/ar-viewer", { replace: true });
            }
        });
    }, []);

    const loadDishes = () => {
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/menu-api/my-dishes/`, { credentials: "include" })
            .then(r => {
                if (!r.ok) throw new Error(`Request failed: ${r.status}`);
                return r.json();
            })
            .then(data => setDishes(data.dishes))
            .catch(() => setError("Could not load models."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadDishes(); }, []);

    const handleCopyLink = async (e: React.MouseEvent, d: DishModel) => {
        e.preventDefault();
        e.stopPropagation();
        if (!d.ar_url) return;
        const url = `${window.location.origin}${d.ar_url}`;
        try {
            await navigator.clipboard.writeText(url);
        } catch {
            const textarea = document.createElement("textarea");
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand("copy");
            document.body.removeChild(textarea);
        }
        setCopiedId(d.id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    const handleLogout = async () => {
        await logoutRequest();
        setIsStaff(false);
        setIsUser(false);
        navigate("/")
    };

    if (!authChecked) {
        return (
            <div style={{ background: T.bg, color: T.text, minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <p style={{ color: T.muted }}>Loading...</p>
            </div>
        );
    }

    if (!(isStaff || isUser)) {
        return null;
    }

    return (
        <div style={{ background: T.bg, color: T.text, minHeight: "100vh", fontFamily: "'Segoe UI',system-ui,sans-serif", padding: "2rem" }}>
            <Link to="/" style={{ color: T.muted, fontSize: "0.88rem", textDecoration: "none" }}>← Back</Link>
            <h1 style={{ marginTop: "1rem", marginBottom: "1.5rem", color: T.accent }}>Models</h1>

            {(isStaff || isUser) && (
                <button onClick={handleLogout}
                    style={{ background: T.bg3, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "0.5rem 1rem", cursor: "pointer", fontSize: "0.85rem", marginBottom: "1rem" }}>
                    Log Out
                </button>
            )}

            {/* List */}
            <h2 style={{ fontSize: "1.1rem", marginBottom: "1rem", color: T.text }}>All Models</h2>
            {loading ? (
                <p style={{ color: T.muted }}>Loading...</p>
            ) : error ? (
                <p style={{ color: "#f87171" }}>{error}</p>
            ) : dishes.length === 0 ? (
                <p style={{ color: T.muted }}>No models yet.</p>
            ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: 480 }}>
                    {dishes.map(d => (
                        <div key={d.id} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", display: "flex", flexDirection: "column", gap: "0.7rem" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "0.8rem" }}>
                                <div>
                                    <p style={{ fontWeight: 700, color: T.text }}>{d.name}</p>
                                    {(d.restaurant || d.category) && (
                                        <p style={{ color: T.muted, fontSize: "0.75rem", marginTop: "0.15rem" }}>
                                            📁 {d.restaurant}{d.category ? ` / ${d.category}` : ""}
                                        </p>
                                    )}
                                    {d.description && <p style={{ color: T.muted, fontSize: "0.85rem", marginTop: "0.3rem" }}>{d.description}</p>}
                                </div>

                                {d.ar_url && (
                                    <div style={{ background: "#fff", borderRadius: 8, padding: 6, flexShrink: 0 }}>
                                        <QRCodeSVG value={`${window.location.origin}${d.ar_url}`} size={72} />
                                    </div>
                                )}
                            </div>

                            {d.ar_url ? (
                                <div style={{ display: "flex", gap: "0.5rem" }}>
                                    <a
                                        href={d.ar_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        style={{ flex: 1, textAlign: "center", background: T.primary, color: "#fff", padding: "0.5rem 1rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem" }}
                                    >
                                        View in AR
                                    </a>
                                    <button
                                        onClick={(e) => handleCopyLink(e, d)}
                                        style={{ background: copiedId === d.id ? "#22c55e" : T.bg2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.85rem", cursor: "pointer" }}
                                    >
                                        {copiedId === d.id ? "✓ Copied" : "🔗 Share"}
                                    </button>
                                </div>
                            ) : (
                                <p style={{ color: T.muted, fontSize: "0.8rem", fontStyle: "italic" }}>No 3D model uploaded yet</p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}