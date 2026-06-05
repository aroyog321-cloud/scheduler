import { useState, useEffect } from "react";
import { postApi, scheduleApi } from "../api";
import { useToast } from "../context";
import { useNavigate } from "react-router-dom";
import { FileText, Calendar, Play, CheckCircle2, AlertCircle, Trash2, PenSquare } from "lucide-react";

const PLATFORM_META = {
  YOUTUBE:{ color:"#FF0000" }, INSTAGRAM:{ color:"#E1306C" }, TWITTER:{ color:"#1DA1F2" },
  LINKEDIN:{ color:"#0077B5" }, TIKTOK:{ color:"#69C9D0" }, FACEBOOK:{ color:"#1877F2" }, PINTEREST:{ color:"#E60023" },
};

export function PostsList() {
  const [posts, setPosts] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("ALL");
  const [page, setPage] = useState(1);
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { load(); }, [filter, page]);

  const load = async () => {
    setLoading(true);
    try {
      const params = { page, limit: 12 };
      if (filter !== "ALL") params.status = filter;
      const res = await postApi.list(params);
      setPosts(res.data.posts || []);
      setTotal(res.data.pagination?.total || 0);
    } catch { toast.error("Failed to load posts"); }
    finally { setLoading(false); }
  };

  const cancel = async (id) => {
    if (!confirm("Are you sure you want to cancel this scheduled post?")) return;
    try { 
      await scheduleApi.cancel(id); 
      toast.success("Post cancelled"); 
      load(); 
    } catch { toast.error("Failed to cancel post"); }
  };

  const FILTERS = ["ALL", "SCHEDULED", "PUBLISHED", "FAILED", "DRAFT", "CANCELLED"];

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 32 }}>
        <div>
          <h1 className="page-title">All Posts</h1>
          <p className="page-subtitle">Manage your content library. {total} total posts.</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/create")}>
          <PenSquare size={16} /> New Post
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", background: "var(--surface)", padding: 6, borderRadius: "var(--radius-full)", border: "1px solid var(--border-subtle)", width: "max-content" }}>
        {FILTERS.map(f => (
          <button 
            key={f} 
            onClick={() => { setFilter(f); setPage(1); }}
            style={{ 
              padding: "8px 16px", 
              borderRadius: "var(--radius-full)",
              fontSize: 13, 
              fontWeight: filter === f ? 600 : 500,
              background: filter === f ? "var(--bg)" : "transparent", 
              color: filter === f ? "var(--text-heading)" : "var(--text-muted)", 
              border: filter === f ? "1px solid var(--border-subtle)" : "1px solid transparent",
              boxShadow: filter === f ? "0 2px 4px rgba(0,0,0,0.02)" : "none",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            {f.charAt(0) + f.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 80 }}>
          <div className="spinner" style={{ width: 32, height: 32, color: "var(--primary)" }} />
        </div>
      ) : posts.length === 0 ? (
        <div className="empty" style={{ padding: "80px 20px" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--surface)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 16 }}>
            <FileText size={24} style={{ color: "var(--text-placeholder)" }} />
          </div>
          <div className="empty-text">No posts found</div>
          <div className="empty-subtext">You haven't created any posts that match this filter.</div>
          <button className="btn btn-secondary" style={{ marginTop: 20 }} onClick={() => navigate("/create")}>Draft a new post</button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
          {posts.map(p => {
            const isVideo = p.mediaFile?.mimeType?.startsWith("video");
            const hasMedia = !!p.mediaFile;
            
            return (
              <div 
                key={p.id} 
                className="card" 
                style={{ 
                  display: "flex", flexDirection: "column", gap: 16, 
                  padding: 20, position: "relative",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = "translateY(-2px)";
                  e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.04)";
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)";
                }}
              >
                {/* Header: Title & Status */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12 }}>
                  <div style={{ fontSize: 15, fontWeight: 600, color: "var(--text-heading)", lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {p.title}
                  </div>
                  <span className={`badge badge-${p.status.toLowerCase()}`} style={{ flexShrink: 0 }}>{p.status}</span>
                </div>

                {/* Media Thumbnail & Meta */}
                <div style={{ display: "flex", gap: 16, alignItems: "center", flex: 1 }}>
                  {hasMedia ? (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: "var(--surface)", overflow: "hidden", border: "1px solid var(--border-subtle)", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {p.mediaFile.thumbnail ? (
                        <img src={p.mediaFile.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : isVideo ? (
                        <Play size={20} style={{ color: "var(--text-muted)" }} />
                      ) : (
                        <FileText size={20} style={{ color: "var(--text-muted)" }} />
                      )}
                    </div>
                  ) : (
                    <div style={{ width: 64, height: 64, borderRadius: 8, background: "rgba(79, 70, 229, 0.05)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, border: "1px dashed rgba(79, 70, 229, 0.2)" }}>
                      <FileText size={20} style={{ color: "var(--primary)" }} />
                    </div>
                  )}
                  
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)" }}>
                      <Calendar size={14} />
                      {p.status === "PUBLISHED" ? "Published " : "Scheduled for "}
                      <span style={{ fontWeight: 500, color: "var(--text)" }}>
                        {new Date(p.publishedAt || p.scheduledAt).toLocaleDateString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                      </span>
                    </div>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {p.platforms.map(pl => (
                        <span 
                          key={pl} 
                          style={{ 
                            fontSize: 10, padding: "2px 8px", borderRadius: "var(--radius-full)", 
                            background: `${PLATFORM_META[pl]?.color || "#888"}15`, 
                            color: PLATFORM_META[pl]?.color || "#888", 
                            fontWeight: 600, letterSpacing: 0.5 
                          }}
                        >
                          {pl}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid var(--border-subtle)", paddingTop: 16, marginTop: "auto" }}>
                  {(p.status === "SCHEDULED" || p.status === "DRAFT") && (
                    <button className="btn btn-ghost btn-sm" onClick={() => cancel(p.id)} style={{ color: "#EF4444", display: "flex", gap: 6, alignItems: "center" }}>
                      <Trash2 size={14} /> Cancel
                    </button>
                  )}
                  {p.status === "PUBLISHED" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#10B981", fontSize: 13, fontWeight: 500 }}>
                      <CheckCircle2 size={14} /> Live
                    </div>
                  )}
                  {p.status === "FAILED" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444", fontSize: 13, fontWeight: 500 }}>
                      <AlertCircle size={14} /> Failed
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 12 && (
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 16, marginTop: 40 }}>
          <button className="btn btn-secondary btn-sm" disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
          <span style={{ fontSize: 14, fontWeight: 500, color: "var(--text-muted)" }}>Page {page} of {Math.ceil(total / 12)}</span>
          <button className="btn btn-secondary btn-sm" disabled={posts.length < 12} onClick={() => setPage(p => p + 1)}>Next →</button>
        </div>
      )}
    </div>
  );
}

export default PostsList;
