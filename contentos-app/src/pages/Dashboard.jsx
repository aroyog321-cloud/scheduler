import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { analyticsApi, postApi } from "../api";
import { PenSquare, Sparkles, ArrowRight, CheckCircle2, Clock, Calendar as CalendarIcon, XCircle } from "lucide-react";

function StatCard({ label, value, progress = 0, index = 0, trend }) {
  const accents = ["var(--accent)", "var(--blue)", "var(--green)"];
  const color = accents[index % accents.length];
  
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 36, fontWeight: 700, color: "var(--text-heading)", lineHeight: 1 }}>{value}</div>
        {trend !== undefined && (
          <div style={{ fontSize: 13, fontWeight: 600, color: trend > 0 ? "var(--green)" : "var(--text-muted)" }}>
            {trend > 0 ? "+" : ""}{trend}%
          </div>
        )}
      </div>
      <div style={{ width: "100%", height: 4, background: "var(--bg)", borderRadius: 4, overflow: "hidden" }}>
        <div style={{ width: `${Math.max(2, Math.min(100, progress))}%`, height: "100%", background: color, borderRadius: 4, transition: "width 1s ease-out" }} />
      </div>
    </div>
  );
}

function ActivityItem({ icon, title, time }) {
  return (
    <div style={{ display: "flex", gap: 12, alignItems: "flex-start", padding: "12px 0", borderBottom: "1px solid var(--border-subtle)" }}>
      <div style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--bg)", color: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-heading)" }}>{title}</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{time}</div>
      </div>
    </div>
  );
}

function formatRelativeTime(dateString) {
  const diff = Date.now() - new Date(dateString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return minutes <= 1 ? "Just now" : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function Dashboard() {
  const [overview, setOverview] = useState(null);
  const [upcoming, setUpcoming] = useState([]);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loading, setLoading] = useState(true);
  const [aiPrompt, setAiPrompt] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      analyticsApi.overview().catch(() => ({ data: { overview: {} } })),
      postApi.list({ limit: 4, status: "SCHEDULED" }).catch(() => ({ data: { posts: [] } })),
      postApi.list({ limit: 5 }).catch(() => ({ data: { posts: [] } }))
    ]).then(([resO, resUpcoming, resRecent]) => {
      setOverview(resO.data.overview || { publishedPosts: 0, scheduledPosts: 0, successRate: 0 });
      setUpcoming(resUpcoming.data.posts || []);
      
      // Sort recent activity by createdAt descending
      const activities = (resRecent.data.posts || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setRecentActivity(activities);
    }).finally(() => setLoading(false));
  }, []);

  const handleGenerate = () => {
    if (!aiPrompt.trim()) return;
    navigate("/create", { state: { topic: aiPrompt } });
  };

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", height: "50vh" }}>
        <div className="spinner" style={{ width: 32, height: 32, color: "var(--primary)" }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p className="page-subtitle">Your content performance and upcoming schedule.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          <PenSquare size={16} /> New Post
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
        
        {/* ── Left Column (Main Content) ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24, gridColumn: "1 / -1" }}>
          <div className="grid-3" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
            <StatCard label="Published" value={overview?.publishedPosts ?? 0} progress={Math.min(100, (overview?.publishedPosts || 0) * 10)} index={0} />
            <StatCard label="Scheduled" value={overview?.scheduledPosts ?? 0} progress={Math.min(100, (overview?.scheduledPosts || 0) * 10)} index={1} />
            <StatCard label="Success Rate" value={`${overview?.successRate ?? 0}%`} progress={overview?.successRate ?? 0} index={2} />
          </div>
        </div>

        {/* Dense Grid for Lower Section */}
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) 340px", gap: 24, gridColumn: "1 / -1", alignItems: "start" }}>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Quick AI Draft */}
            <div className="card" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Sparkles size={18} color="var(--primary)" />
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)" }}>AI Quick Draft</h3>
              </div>
              <p style={{ fontSize: 14, color: "var(--text-muted)" }}>What do you want to write about today? Describe it briefly.</p>
              <div style={{ display: "flex", gap: 8 }}>
                <input 
                  className="input" 
                  placeholder="e.g. 5 tips for growing an audience on Twitter..." 
                  value={aiPrompt}
                  onChange={e => setAiPrompt(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleGenerate()}
                />
                <button className="btn btn-primary" onClick={handleGenerate}>Generate</button>
              </div>
            </div>

            {/* Upcoming Schedule */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center", background: "var(--bg)" }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)" }}>Upcoming Posts</h3>
                <Link to="/calendar" className="btn btn-ghost btn-sm" style={{ display: "flex", gap: 6, alignItems: "center" }}>
                  View Calendar <ArrowRight size={14} />
                </Link>
              </div>
              {upcoming.length === 0 ? (
                <div className="empty" style={{ padding: "32px 24px" }}>
                  <CalendarIcon className="empty-icon" />
                  <div className="empty-text">No upcoming posts</div>
                  <div className="empty-subtext">You have a blank slate. Schedule something!</div>
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                  <tbody>
                    {upcoming.map((post) => (
                      <tr key={post.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <td style={{ padding: "16px 24px" }}>
                          <div style={{ fontWeight: 600, color: "var(--text-heading)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 400 }}>
                            {post.title}
                          </div>
                          <div style={{ color: "var(--text-muted)", fontSize: 13, display: "flex", gap: 12 }}>
                            <span>{new Date(post.scheduledAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}</span>
                            <span style={{ color: "var(--primary)", fontWeight: 500 }}>{post.platforms.join(", ")}</span>
                          </div>
                        </td>
                        <td style={{ padding: "16px 24px", textAlign: "right" }}>
                          <span className={`badge badge-${post.status.toLowerCase()}`}>{post.status}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ── Right Column (Context Panel) ── */}
          <div className="card" style={{ position: "sticky", top: 24, padding: "20px 24px" }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)", marginBottom: 20 }}>Recent Activity</h3>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {recentActivity.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px 0" }}>No recent activity.</div>
              ) : (
                recentActivity.map(post => {
                  let icon = <PenSquare size={16} />;
                  let actionText = "Drafted post";
                  
                  if (post.status === "PUBLISHED") { icon = <CheckCircle2 size={16} />; actionText = "Published post"; }
                  else if (post.status === "SCHEDULED") { icon = <Clock size={16} />; actionText = "Scheduled post"; }
                  else if (post.status === "FAILED") { icon = <XCircle size={16} style={{ color: "#EF4444" }} />; actionText = "Failed to publish"; }

                  return (
                    <ActivityItem 
                      key={post.id} 
                      icon={icon} 
                      title={
                        <span style={{ display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 220 }}>
                          {actionText}: <span style={{ fontWeight: 600 }}>{post.title}</span>
                        </span>
                      } 
                      time={formatRelativeTime(post.createdAt)} 
                    />
                  );
                })
              )}
            </div>
            
            <div style={{ marginTop: 24, padding: 16, background: "var(--bg)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-subtle)" }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>Pro Tip</h4>
              <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
                Connect more platforms in the Settings to cross-post automatically and increase your reach.
              </p>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
