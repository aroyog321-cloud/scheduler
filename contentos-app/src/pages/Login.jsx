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
        <div style={{ textAlign:"center", marginBottom:40 }}>
          <div style={{ width:80, height:80, background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 16px" }}>
            <img src="/logo.png" alt="Flux Logo" style={{ width: "100%", height: "100%", objectFit: "contain" }} onError={(e) => e.target.style.display = 'none'} />
          </div>
          <h1 style={{ fontSize:48, fontWeight:900, letterSpacing:-2, color:"var(--text-heading)", marginBottom:8, textTransform: "uppercase" }}>Flux</h1>
          <p style={{ color:"var(--muted2)", fontSize:16, marginTop:6 }}>Sign in to Flux</p>
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
