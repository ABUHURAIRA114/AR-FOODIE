import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router";
import { checkAuth, getCsrfToken, logoutRequest } from "../lib/auth";
import { QRCodeSVG } from "qrcode.react";

const API_URL = (import.meta as any).env.VITE_API_URL || "";


const T = {
    bg: "#0d1a1f", bg2: "#111f25", bg3: "#16262d",
    primary: "#A65111", primaryL: "#C4621A", accent: "#DDAA00", olive: "#7C5D3D",
    text: "#e8ddd0", muted: "#85AAAA", border: "rgba(166,81,17,0.25)",
} as const;

interface Scene {
    id: string;
    name: string;
    parent: string;
    description: string;
    glb_url: string | null;
    usdz_url: string | null;
    ar_url: string;
    qr_code?: string;
    owner: string | null;
}

export function ModelsPage() {
    const navigate = useNavigate();

    const [scenes, setScenes] = useState<Scene[]>([]);
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


    const loadScenes = () => {
        setLoading(true);
        setError(null);
        fetch(`${API_URL}/api/dishes/`, { credentials: "include" })
            .then(r => {
                if (!r.ok) throw new Error(`Request failed: ${r.status}`);
                return r.json();
            })
            .then(data => setScenes(data.dishes))
            .catch(() => setError("Could not load models."))
            .finally(() => setLoading(false));
    };

    useEffect(() => { loadScenes(); }, []);

    const handleCopyLink = async (e: React.MouseEvent, s: Scene) => {
        e.preventDefault();
        e.stopPropagation();
        const url = `${window.location.origin}${s.ar_url}`;
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
        setCopiedId(s.id);
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
            ) : scenes.length === 0 ? (
                <p style={{ color: T.muted }}>No models yet.</p>
            ) : (

                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", maxWidth: 480 }}>
                    {scenes.map(s => (

                        <div key={s.id} style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 10, padding: "1rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                                <p style={{ fontWeight: 700, color: T.text }}>{s.name}</p>
                                {s.description && <p style={{ color: T.muted, fontSize: "0.85rem" }}>{s.description}</p>}
                            </div>
                            <a href={s.ar_url} target="_blank" rel="noopener noreferrer"
                                style={{ background: T.primary, color: "#fff", padding: "0.5rem 1rem", borderRadius: 8, textDecoration: "none", fontSize: "0.85rem" }}>

                                {s.parent && <p style={{ color: T.muted, fontSize: "0.75rem" }}>📁 {s.parent}</p>}

                                <div style={{ background: "#fff", borderRadius: 8, padding: 6, flexShrink: 0 }}>
                                    <QRCodeSVG value={`${window.location.origin}${s.ar_url}`} size={72} />
                                </div>

                                <button onClick={(e) => handleCopyLink(e, s)}
                                    style={{ background: copiedId === s.id ? "#22c55e" : T.bg2, border: `1px solid ${T.border}`, color: T.text, borderRadius: 8, padding: "0.5rem 1rem", fontSize: "0.85rem", cursor: "pointer", marginRight: "0.5rem" }}>
                                    {copiedId === s.id ? "✓ Copied" : "🔗 Share"}
                                </button>

                                View in AR
                            </a>
                        </div>

                    ))}

                </div>
            )}
        </div>
    );
}