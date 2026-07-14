import { useState } from "react";
import { useNavigate } from "react-router";
import { registerRequest } from "../lib/auth";
import { T } from "./tokens.mts";

export function UserRegisterPage() {
    const [username, setUsername]       = useState("");
    const [password, setPassword]       = useState("");
    const [businessName, setBusinessName] = useState("");
    const [ownerName, setOwnerName]     = useState("");
    const [phone, setPhone]             = useState("");
    const [city, setCity]               = useState("");
    const [agreed, setAgreed]           = useState(false);
    const [error, setError]             = useState<string | null>(null);
    const [loading, setLoading]         = useState(false);
    const navigate = useNavigate();

    const validate = (): string | null => {
        if (!username.trim() || !password || !businessName.trim() || !phone.trim()) {
            return "All fields are required.";
        }
        if (!/^(03\d{9}|\+923\d{9})$/.test(phone.trim())) {
            return "Enter a valid Pakistani phone number e.g. 03001234567";
        }
        if (password.length < 8) {
            return "Password must be at least 8 characters.";
        }
        if (!/[A-Za-z]/.test(password)) {
            return "Password must include at least one letter.";
        }
        if (!/\d/.test(password)) {
            return "Password must include at least one number.";
        }
        if (!/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return 'Password must include at least one special character e.g @,#,$.';
        }
        return null;
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        setError(null);

        const validationError = validate();
        if (validationError) {
            setError(validationError);
            return;
        }

        setLoading(true);
        try {
            await registerRequest(username, password, businessName, ownerName, phone, city);
            navigate("/");
        } catch (err: any) {
            setError(err.message || "Something went wrong. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = {
        padding: "0.6rem",
        borderRadius: 8,
        background: T.bg3,
        color: T.text,
        border: `1px solid ${T.border}`,
    };

    return (
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: T.bg, color: T.text }}>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1rem", width: 320 }}>

                <h2 style={{ color: T.accent }}>Register Your Restaurant</h2>

                <input
                    placeholder="Username"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={inputStyle}
                />

                <input
                    placeholder="Business Name"
                    value={businessName}
                    onChange={e => setBusinessName(e.target.value)}
                    style={inputStyle}
                />

                <input
                    placeholder="Owner Name"
                    value={ownerName}
                    onChange={e => setOwnerName(e.target.value)}
                    style={inputStyle}
                />

                <input
                    placeholder="Phone e.g. 03001234567"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    style={inputStyle}
                />

                <input
                    placeholder="City"
                    value={city}
                    onChange={e => setCity(e.target.value)}
                    style={inputStyle}
                />

                <input
                    type="password"
                    placeholder="Password (min 8 chars, include number & symbol)"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    style={inputStyle}
                />

                {/* ── Terms checkbox ── */}
                <label style={{ display: "flex", alignItems: "flex-start", gap: "0.6rem", cursor: "pointer" }}>
                    <input
                        type="checkbox"
                        checked={agreed}
                        onChange={e => setAgreed(e.target.checked)}
                        style={{ marginTop: "3px", accentColor: T.primary, width: 15, height: 15, flexShrink: 0 }}
                    />
                    <span style={{ fontSize: "0.82rem", color: T.muted, lineHeight: 1.4 }}>
                        {"I agree to the "}
                        <a href="/privacy-policy" target="_blank" rel="noopener noreferrer"
                            style={{ color: T.primary, textDecoration: "underline" }}>
                            Privacy Policy
                        </a>
                        {" and "}
                        <a href="/terms" target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: "0.82rem", color: "#a0a0a0", lineHeight: 1.4 }}>
                            Terms of Service
                        </a>
                    </span>
                </label>

                {error && <p style={{ color: "#f87171" }}>{error}</p>}

                <button
                    type="submit"
                    disabled={!agreed || loading}
                    style={{
                        background: agreed ? T.primary : "rgba(166,81,17,0.3)",
                        color: "#fff",
                        border: "none",
                        borderRadius: 8,
                        padding: "0.7rem",
                        cursor: agreed && !loading ? "pointer" : "not-allowed",
                        fontWeight: 700,
                        transition: "background 0.2s",
                    }}
                >
                    {loading ? "Registering..." : "Register"}
                </button>
            </form>
        </div>
    );
}