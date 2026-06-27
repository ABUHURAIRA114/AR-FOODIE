import { useState } from "react";
import { useNavigate } from "react-router";
import { registerRequest } from "../lib/auth";
import { T } from "./tokens.mts";


export function UserRegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [agreed, setAgreed] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        try {
            await registerRequest(username, password);
            navigate("/");
        } catch (err: any) {
            setError(err.message);
        }
    };

    return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.text }}>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: 320 }}>
            <h2 style={{ color: T.accent }}>User Register</h2>
            <input placeholder="Restaurant Name" value={username} onChange={e => setUsername(e.target.value)}
                style={{ padding: "0.6rem", borderRadius: 8, background: T.bg3, color: T.text, border: `1px solid ${T.border}` }} />
            <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                style={{ padding: "0.6rem", borderRadius: 8, background: T.bg3, color: T.text, border: `1px solid ${T.border}` }} />

            {/* ── Terms checkbox ── */}
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer" }}>
                <input
                    type="checkbox"
                    checked={agreed}
                    onChange={e => setAgreed(e.target.checked)}
                    style={{ marginTop: "3px", accentColor: T.primary, width: 15, height: 15, flexShrink: 0 }}
                />
                <span style={{ fontSize: "0.82rem", color: T.muted, lineHeight: 1.4 }}>
                    {"I agree to the"}
                    <a
                        href="/privacy-policy"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ color: T.primary, textDecoration: "underline" }}
                    >
                        Privacy Policy
                    </a>
                    {" and"}
                    <a
                        href="/terms"
                        target="_blank"
                        rel="noopener noreferrer"
                        style={{ fontSize: "0.82rem", color: "#a0a0a0", lineHeight: 1.4 }}
                    >
                        Terms of Service
                    </a>
                </span>
            </label>

            {error && <p style={{ color: "#f87171" }}>{error}</p>}
            <button
                type="submit"
                disabled={!agreed}
                style={{
                    background: agreed ? T.primary : "rgba(166,81,17,0.3)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    padding: "0.7rem",
                    cursor: agreed ? "pointer" : "not-allowed",
                    fontWeight: 700,
                    transition: "background 0.2s"
                }}
            >
                Register
            </button>
        </form>
    </div>
);
}
