import { Outlet, NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context";

const ICONS = {
  dashboard: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  create: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>,
  calendar: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>,
  posts: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>,
  media: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  platforms: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" /></svg>,
  settings: <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5"><path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><circle cx="12" cy="12" r="3" /></svg>,
};

const NAV = [
  { to: "/dashboard",   icon: ICONS.dashboard,  label: "Dashboard" },
  { to: "/create",      icon: ICONS.create,     label: "Create Post" },
  { to: "/calendar",    icon: ICONS.calendar,   label: "Calendar" },
  { to: "/posts",       icon: ICONS.posts,      label: "Posts" },
  { to: "/media",       icon: ICONS.media,      label: "Media" },
  { to: "/platforms",   icon: ICONS.platforms,  label: "Platforms" },
  { to: "/settings",    icon: ICONS.settings,   label: "Settings" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => { logout(); navigate("/login"); };

  return (
    <div className="app-layout">
      {/* ── Top Header (Command Center) ── */}
      <header style={{ 
        display:"grid", 
        gridTemplateColumns: "1fr auto 1fr", 
        alignItems:"center", 
        padding: "24px 48px", 
        maxWidth: "1600px", 
        width: "100%", 
        margin: "0 auto",
        gap: "24px"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ fontFamily: "var(--font-display)", fontSize:24, fontWeight:600, color:"var(--text)" }}>
            ContentOS.
          </div>
          <div style={{ height: "24px", width: "1px", background: "var(--border)" }}></div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500 }}>
            Workspace / <span style={{ color: "var(--text)" }}>Personal</span>
          </div>
        </div>
        
        <div style={{ position: "relative", width: "400px" }}>
          <svg style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "var(--text-placeholder)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input 
            type="text" 
            placeholder="Search posts, ask AI, or jump to..." 
            style={{ 
              width: "100%", padding: "10px 16px 10px 40px", 
              background: "var(--surface)", border: "1px solid var(--border)", 
              borderRadius: "var(--radius-full)", color: "var(--text)", 
              fontSize: 14, outline: "none", boxShadow: "0 4px 12px rgba(0,0,0,0.2)" 
            }} 
          />
          <div style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", display: "flex", gap: 4 }}>
            <kbd style={{ background: "var(--card)", padding: "2px 6px", borderRadius: 4, fontSize: 11, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>⌘</kbd>
            <kbd style={{ background: "var(--card)", padding: "2px 6px", borderRadius: 4, fontSize: 11, border: "1px solid var(--border)", color: "var(--text-muted)", fontFamily: "monospace" }}>K</kbd>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:16, justifyContent: "flex-end" }}>
          <div style={{ textAlign:"right", display: "none", "@media (min-width: 600px)": { display: "block" } }}>
            <div style={{ fontSize:14, fontWeight:500, color:"var(--text)" }}>{user?.name || "User"}</div>
            <div style={{ fontSize:12, color:"var(--text-muted)" }}>{user?.email}</div>
          </div>
          <div style={{
            width:36, height:36, borderRadius:"50%",
            background:"var(--surface)", border: "1px solid var(--border)",
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:14, fontWeight:500, color:"var(--text)", flexShrink:0,
          }}>
            {(user?.name || user?.email || "U")[0].toUpperCase()}
          </div>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Sign out
          </button>
        </div>
      </header>

      {/* ── Main ── */}
      <main className="main-content">
        <Outlet />
      </main>

      {/* ── Bottom Dock (Capsule) ── */}
      <div className="bottom-dock-wrapper">
        <nav className="bottom-dock">
          {NAV.map(({ to, icon, label }) => (
            <NavLink key={to} to={to} className={({ isActive }) => `dock-item ${isActive ? "active" : ""}`}>
              {icon}
              <div className="tooltip">{label}</div>
            </NavLink>
          ))}
        </nav>
      </div>
    </div>
  );
}
