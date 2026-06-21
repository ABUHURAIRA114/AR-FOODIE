import { useState } from "react";
import { useNavigate } from "react-router";
import { registerRequest } from "../lib/auth";
import { T } from "./tokens.mts";


export function UserRegisterPage() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
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
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: 300 }}>
                <h2 style={{ color: T.accent }}>User Register</h2>
                <input placeholder="Restaurant Name" value={username} onChange={e => setUsername(e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: 8, background: T.bg3, color: T.text, border: `1px solid ${T.border}` }} />
                <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)}
                    style={{ padding: "0.6rem", borderRadius: 8, background: T.bg3, color: T.text, border: `1px solid ${T.border}` }} />
                {error && <p style={{ color: "#f87171" }}>{error}</p>}
                <button type="submit" style={{ background: T.primary, color: "#fff", border: "none", borderRadius: 8, padding: "0.7rem", cursor: "pointer", fontWeight: 700 }}>
                    Register
                </button>
            </form>
        </div>
    );
}
