import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { authApi } from "../api";
import { useAuth, useToast } from "../context";

export default function Login() {
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await authApi.login(form);
      login(res.data.token, res.data.user);
      navigate("/dashboard");
    } catch (err) {
      toast.error(err?.response?.data?.error || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight:"100vh", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
      <div style={{ width:"100%", maxWidth:400 }}>
        {/* Logo */}
        <div style={{ textAlign:"center", marginBottom:36 }}>
          <div style={{ width:44, height:44, background:"linear-gradient(135deg,#00d4ff,#a78bfa)", borderRadius:12, margin:"0 auto 14px" }} />
          <h1 style={{ fontSize:24, fontWeight:800, letterSpacing:-0.5 }}>Welcome back</h1>
          <p style={{ color:"var(--muted2)", fontSize:14, marginTop:6 }}>Sign in to ContentOS</p>
        </div>

        <form onSubmit={submit} style={{ display:"flex", flexDirection:"column", gap:16 }}>
          <div className="field">
            <label className="label">Email</label>
            <input
              className="input" type="email" placeholder="you@example.com"
              value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required autoFocus
            />
          </div>
          <div className="field">
            <label className="label">Password</label>
            <input
              className="input" type="password" placeholder="••••••••"
              value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
          </div>
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ marginTop:4, padding:"12px" }}>
            {loading ? <span className="spinner" /> : "Sign In"}
          </button>
        </form>

        <p style={{ textAlign:"center", marginTop:24, fontSize:14, color:"var(--muted2)" }}>
          Don't have an account?{" "}
          <Link to="/register" style={{ color:"var(--accent)", fontWeight:600 }}>Sign up</Link>
        </p>
      </div>
    </div>
  );
}
