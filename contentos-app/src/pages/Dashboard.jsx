import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { analyticsApi, postApi, platformApi } from "../api";
import { useAuth } from "../context";

const PLATFORM_META = {
  YOUTUBE:   { icon: "▶", color: "#FF0000", label: "YouTube" },
  INSTAGRAM: { icon: "◈", color: "#E1306C", label: "Instagram" },
  TWITTER:   { icon: "𝕏", color: "#1DA1F2", label: "X / Twitter" },
  LINKEDIN:  { icon: "in", color: "#0077B5", label: "LinkedIn" },
  TIKTOK:    { icon: "♪", color: "#69C9D0", label: "TikTok" },
  FACEBOOK:  { icon: "f", color: "#1877F2", label: "Facebook" },
  PINTEREST: { icon: "P", color: "#E60023", label: "Pinterest" },
};

function StatCard({ label, value, sub, index = 0 }) {
  const accents = ["var(--primary)", "var(--accent)", "var(--text-muted)"];
  const accent = accents[index % accents.length];

  return (
    <div className="card" style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding: "40px 32px", textAlign: "center", position: "relative", overflow: "hidden" }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "4px", background: accent }}></div>
      <div style={{ fontFamily: "var(--font-display)", fontSize:56, color: "var(--text)", lineHeight:1, fontWeight:400 }}>
        {value}
      </div>
      <div style={{ fontSize:13, fontWeight:500, marginTop:16, color:"var(--text-muted)" }}>
        {label}
      </div>
      {sub && <div style={{ fontSize:12, color:"var(--text-muted)", marginTop:4, opacity: 0.8 }}>{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [overview, setOverview] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [platforms, setPlatforms] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      analyticsApi.overview().catch(() => ({ data: null })),
      postApi.list({ status: "SCHEDULED", limit: 5 }),
      platformApi.list(),
    ]).then(([ov, posts, plat]) => {
      setOverview(ov.data?.overview || null);
      setUpcoming(posts.data?.posts || []);
      setPlatforms(plat.data?.accounts || []);
    }).finally(() => setLoading(false));
  }, []);

  const now = new Date();

  return (
    <div>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
        <div>
          <h1 className="page-title">
            Good {now.getHours() < 12 ? "morning" : now.getHours() < 17 ? "afternoon" : "evening"},{" "}
            {user?.name?.split(" ")[0] || "there"}.
          </h1>
          <p className="page-subtitle">Here is your content command center.</p>
        </div>
        <Link to="/create" className="btn btn-primary" style={{ borderRadius: "var(--radius-full)", padding: "14px 28px" }}>New Post</Link>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:120 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: 32 }}>
          {/* Main Dashboard Content */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            
            {/* Top Stat Bento */}
            <div className="grid-3">
              <StatCard label="Published" value={overview?.publishedPosts ?? 0} index={0} />
              <StatCard label="Scheduled" value={overview?.scheduledPosts ?? 0} index={1} />
              <StatCard label="Success Rate" value={`${overview?.successRate ?? 0}%`} index={2} />
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:32 }}>
              {/* Connected Platforms */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding: "24px 32px", borderBottom: "1px solid var(--border)" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize:24, fontWeight:500 }}>Platforms</h3>
                  <Link to="/platforms" style={{ fontSize:13, fontWeight:500, color: "var(--text-muted)" }}>Manage</Link>
                </div>
                {platforms.length === 0 ? (
                  <div className="empty" style={{ padding: "48px 32px" }}>
                    <div className="empty-text">No platforms</div>
                    <Link to="/platforms" className="btn btn-secondary btn-sm" style={{ marginTop:16 }}>Connect Now</Link>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {platforms.map((p, i) => {
                      const meta = PLATFORM_META[p.platform] || { icon:"●", color:"#888", label:p.platform };
                      return (
                        <div key={p.id} style={{ display:"flex", alignItems:"center", gap:16, padding:"20px 32px", borderBottom: i === platforms.length - 1 ? "none" : "1px solid var(--border)" }}>
                          <div style={{ width:36, height:36, borderRadius:"50%", background:"var(--surface)", border: "1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, color:meta.color, flexShrink:0 }}>
                            {meta.icon}
                          </div>
                          <div>
                            <div style={{ fontSize:14, fontWeight:500 }}>{meta.label}</div>
                            <div style={{ fontSize:13, color:"var(--text-muted)" }}>@{p.platformUsername || p.platformUserId}</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Upcoming Posts */}
              <div className="card" style={{ padding: 0 }}>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding: "24px 32px", borderBottom: "1px solid var(--border)" }}>
                  <h3 style={{ fontFamily: "var(--font-display)", fontSize:24, fontWeight:500 }}>Upcoming</h3>
                  <Link to="/calendar" style={{ fontSize:13, fontWeight:500, color: "var(--text-muted)" }}>Calendar</Link>
                </div>
                {upcoming.length === 0 ? (
                  <div className="empty" style={{ padding: "48px 32px" }}>
                    <div className="empty-text">No upcoming posts</div>
                    <Link to="/create" className="btn btn-secondary btn-sm" style={{ marginTop:16 }}>Schedule First Post</Link>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column" }}>
                    {upcoming.map((p, i) => (
                      <div key={p.id} style={{ display:"flex", gap:16, padding:"20px 32px", borderBottom: i === upcoming.length - 1 ? "none" : "1px solid var(--border)" }}>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:14, fontWeight:500, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
                          <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:4 }}>
                            {new Date(p.scheduledAt).toLocaleString(undefined, { month:"short", day:"numeric", hour:"2-digit", minute:"2-digit" })}
                          </div>
                        </div>
                        <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                          {p.platforms.slice(0,3).map((pl) => (
                            <div key={pl} style={{ width:24, height:24, borderRadius:"50%", background:"var(--surface)", border: "1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, color:PLATFORM_META[pl]?.color || "var(--text-muted)" }}>
                              {PLATFORM_META[pl]?.icon}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            {/* AI Assistant Callout */}
            <div className="card" style={{ display: "flex", gap: 32, alignItems: "center", background: "linear-gradient(135deg, rgba(94, 106, 210, 0.1), rgba(124, 138, 255, 0.05))", border: "1px solid rgba(94, 106, 210, 0.2)" }}>
               <div style={{ flex: 1 }}>
                 <h3 style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 500, color: "var(--primary)" }}>Need inspiration?</h3>
                 <p style={{ color: "var(--text-muted)", marginTop: 8, fontSize: 14 }}>Let the AI Content Studio generate drafts, captions, and hashtag strategies based on trending topics in your niche.</p>
               </div>
               <Link to="/create" className="btn btn-primary">Open AI Studio</Link>
            </div>
          </div>

          {/* Right Sidebar: Activity Feed */}
          <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
            <div className="card" style={{ padding: 0, height: "100%", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "24px 32px", borderBottom: "1px solid var(--border)" }}>
                <h3 style={{ fontFamily: "var(--font-display)", fontSize:24, fontWeight:500 }}>Recent Activity</h3>
              </div>
              <div style={{ padding: "32px", display: "flex", flexDirection: "column", gap: 24, flex: 1 }}>
                
                {/* Mock Activity Feed Items */}
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--primary)", marginTop: 6, flexShrink: 0 }}></div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>Post <span style={{ fontWeight: 500 }}>"Q3 Launch Strategy"</span> was successfully published to LinkedIn.</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>2 hours ago</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--accent)", marginTop: 6, flexShrink: 0 }}></div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>New account connected: <span style={{ fontWeight: 500 }}>Twitter</span>.</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Yesterday at 4:30 PM</div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--border)", marginTop: 6, flexShrink: 0 }}></div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>Draft saved for <span style={{ fontWeight: 500 }}>"Product Update v2.0"</span>.</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Yesterday at 11:15 AM</div>
                  </div>
                </div>
                
                <div style={{ display: "flex", gap: 16 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--border)", marginTop: 6, flexShrink: 0 }}></div>
                  <div>
                    <div style={{ fontSize: 14, color: "var(--text)" }}>Welcome to ContentOS!</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>Jun 2, 2026</div>
                  </div>
                </div>

              </div>
              <div style={{ padding: "16px 32px", borderTop: "1px solid var(--border)", textAlign: "center" }}>
                <span style={{ fontSize: 13, color: "var(--text-muted)", cursor: "pointer" }}>View all activity</span>
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
