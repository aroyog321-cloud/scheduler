import { useState, useEffect } from "react";
import { Outlet, NavLink, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../context";
import { Command } from "cmdk";
import { LayoutDashboard, PenSquare, Calendar, Layers, Image as ImageIcon, Link as LinkIcon, Settings, LogOut, Search, Sparkles } from "lucide-react";

const NAV = [
  { to: "/dashboard",   icon: <LayoutDashboard />,  label: "Dashboard" },
  { to: "/create",      icon: <PenSquare />,        label: "Create Post" },
  { to: "/calendar",    icon: <Calendar />,         label: "Calendar" },
  { to: "/posts",       icon: <Layers />,           label: "Posts" },
  { to: "/media",       icon: <ImageIcon />,        label: "Media" },
  { to: "/platforms",   icon: <LinkIcon />,         label: "Platforms" },
  { to: "/ai-studio",   icon: <Sparkles />,         label: "AI Studio" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const down = (e) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="app-layout">
      {/* ── Top Header ── */}
      <header className="top-header">
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <img src="/logo.png" alt="Flux Logo" style={{ width: 36, height: 36, objectFit: "contain", borderRadius: 8 }} />
          <span style={{ fontFamily:"var(--font-display)", fontSize:20, fontWeight:800, letterSpacing:"-0.5px", color:"var(--text-heading)" }}>
            Flux
          </span>
        </div>
        
        <div style={{ display:"flex", alignItems:"center", gap:16 }}>
          <button 
            onClick={() => setOpen(true)}
            style={{ 
              display: "flex", alignItems: "center", gap: 10, padding: "8px 12px 8px 16px", 
              background: "var(--surface)", border: "1px solid var(--border)", 
              borderRadius: "var(--radius-full)", color: "var(--text-muted)", 
              fontSize: 13, cursor: "pointer", transition: "all 0.2s ease",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
            }}
            onMouseOver={e => { e.currentTarget.style.borderColor = "var(--border-subtle)"; e.currentTarget.style.background = "var(--bg)"; }}
            onMouseOut={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
          >
            <Search size={14} style={{ opacity: 0.6 }} />
            Search...
            <div style={{ display: "flex", gap: 4 }}>
              <kbd style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, fontSize: 11, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>⌘</kbd>
              <kbd style={{ background: "var(--bg)", padding: "2px 6px", borderRadius: 4, fontSize: 11, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>K</kbd>
            </div>
          </button>

          <div style={{
            width:34, height:34, borderRadius:"50%",
            background:"linear-gradient(135deg, var(--primary), var(--accent))", 
            border: "1px solid rgba(0,0,0,0.1)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:600, color:"#FFF", flexShrink:0,
            boxShadow: "0 2px 8px rgba(79, 70, 229, 0.3)"
          }}>
            {(user?.name || user?.email || "U")[0].toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Main Content Area ── */}
      <main className="main-content">
        {/* Key forces the animation to re-run when location changes */}
        <div key={location.pathname} className="page-transition">
          <Outlet />
        </div>
      </main>

      {/* ── Floating Light Mode Dock ── */}
      <div className="floating-dock-wrapper">
        <nav className="floating-dock">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`}>
              {icon}
              <div className="tooltip">{label}</div>
            </NavLink>
          ))}
          
          <div style={{ width: 1, height: 32, background: "var(--border)", margin: "0 4px" }} />
          
          <NavLink to="/settings" className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`}>
            <Settings />
            <div className="tooltip">Settings</div>
          </NavLink>
        </nav>
      </div>

      {/* ── CMDK Palette ── */}
      <Command.Dialog 
        open={open} 
        onOpenChange={setOpen}
        label="Global Command Menu"
        className="cmdk-overlay"
      >
        <div className="cmdk-modal">
          <Command.Input placeholder="Type a command or search..." />
          <Command.List>
            <Command.Empty style={{ padding: "32px", textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>No results found.</Command.Empty>
            
            <Command.Group heading="Navigation">
              {NAV.map(({ to, label, icon }) => (
                <Command.Item 
                  key={to} 
                  onSelect={() => { navigate(to); setOpen(false); }}
                >
                  <span style={{ color: "var(--text-muted)" }}>{icon}</span> {label}
                </Command.Item>
              ))}
              <Command.Item onSelect={() => { navigate("/settings"); setOpen(false); }}>
                 <span style={{ color: "var(--text-muted)" }}><Settings /></span> Settings
              </Command.Item>
            </Command.Group>
            
            <Command.Group heading="Actions">
              <Command.Item onSelect={() => { navigate("/create"); setOpen(false); }}>
                 <span style={{ color: "var(--text-muted)" }}><PenSquare /></span> Generate AI Draft
              </Command.Item>
              <Command.Item onSelect={() => { handleLogout(); setOpen(false); }}>
                 <span style={{ color: "var(--text-muted)" }}><LogOut /></span> Sign Out
              </Command.Item>
            </Command.Group>
          </Command.List>
        </div>
      </Command.Dialog>
    </div>
  );
}
