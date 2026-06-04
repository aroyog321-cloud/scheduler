import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api";
import { useAuth, useToast } from "../context";

export default function Register() {
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    setLoading(true);
    try {
      const res = await authApi.register(form);
      login(res.data.token, res.data.user);
      toast.success("Account created! Connect your first platform.");
      navigate("/platforms");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:44, height:44, background:"linear-gradient(135deg,#00d4ff,#a78bfa)", borderRadius:12, margin:"0 auto 14px" }} />
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5 }}>Create account</h1>
          <p style={{ color:"var(--muted2)", fontSize:14, marginTop:6 }}>Start scheduling your content</p>
        </div>

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="field">
            <label className="label">Name</label>
            <input className="input" placeholder="Your name" value={form.name} onChange={set("name")} autoFocus />
          </div>
          <div className="field">
            <label className="label">Email</label>
            <input className="input" type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input className="input" type="password" placeholder="Min 8 characters" value={form.password} onChange={set("password")} required minLength={8} />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop:4, padding:"12px" }}>
            {loading ? <span className="spinner" /> : "Create Account"}
          </button>
        </form>

        <p style={{ textAlign:"center", marginTop:24, fontSize:14, color:"var(--muted2)" }}>
          Already have an account?{" "}
          <Link to="/login" style={{ color:"var(--accent)", fontWeight:600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
