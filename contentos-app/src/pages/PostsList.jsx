// ─── PostsList.jsx ────────────────────────────────────────────────────
import { useState, useEffect } from "react";
import { postApi, scheduleApi } from "../api";
import { useToast } from "../context";
import { useNavigate } from "react-router-dom";

const PLATFORM_META = {
  YOUTUBE:{color:"#FF0000"}, INSTAGRAM:{color:"#E1306C"}, TWITTER:{color:"#1DA1F2"},
  LINKEDIN:{color:"#0077B5"}, TIKTOK:{color:"#69C9D0"}, FACEBOOK:{color:"#1877F2"}, PINTEREST:{color:"#E60023"},
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
      const params = { page, limit:20 };
      if (filter !== "ALL") params.status = filter;
      const res = await postApi.list(params);
      setPosts(res.data.posts || []);
      setTotal(res.data.pagination?.total || 0);
    } catch { toast.error("Failed to load posts"); }
    finally { setLoading(false); }
  };

  const cancel = async (id) => {
    if (!confirm("Cancel this post?")) return;
    try { await scheduleApi.cancel(id); toast.success("Cancelled"); load(); }
    catch { toast.error("Failed to cancel"); }
  };

  const FILTERS = ["ALL","SCHEDULED","PUBLISHED","FAILED","DRAFT","CANCELLED"];

  return (
    <div className="page">
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h1 className="page-title">All Posts</h1>
          <p className="page-subtitle">{total} posts total</p>
        </div>
        <button className="btn btn-primary" onClick={() => navigate("/create")}>＋ New Post</button>
      </div>

      {/* Filters */}
      <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap" }}>
        {FILTERS.map(f => (
          <button key={f} className="btn btn-ghost btn-sm" onClick={() => { setFilter(f); setPage(1); }}
            style={{ background: filter===f ? "rgba(0,212,255,0.12)" : undefined, borderColor: filter===f ? "rgba(0,212,255,0.3)" : undefined, color: filter===f ? "var(--accent)" : undefined }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:60 }}><div className="spinner" /></div> :
      posts.length === 0 ? (
        <div className="empty"><div className="empty-icon">📭</div><div className="empty-text">No posts found</div></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {posts.map(p => (
            <div key={p.id} className="card" style={{ display:"flex", gap:14, alignItems:"center" }}>
              <div style={{ width:44, height:44, borderRadius:8, background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, flexShrink:0 }}>
                {p.mediaFile?.mimeType?.startsWith("video") ? "🎬" : p.mediaFile ? "🖼" : "📝"}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:14, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{p.title}</div>
                <div style={{ fontSize:12, color:"var(--muted)", marginTop:2 }}>
                  {p.status === "PUBLISHED" ? `Published ${new Date(p.publishedAt || p.scheduledAt).toLocaleString()}` : `Scheduled for ${new Date(p.scheduledAt).toLocaleString()}`}
                </div>
                <div style={{ display:"flex", gap:4, marginTop:6, flexWrap:"wrap" }}>
                  {p.platforms.map(pl => (
                    <span key={pl} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:`${PLATFORM_META[pl]?.color||"#888"}20`, color:PLATFORM_META[pl]?.color||"#888", fontWeight:600 }}>{pl}</span>
                  ))}
                </div>
              </div>
              <div style={{ display:"flex", gap:8, alignItems:"center", flexShrink:0 }}>
                <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                {(p.status === "SCHEDULED" || p.status === "DRAFT") && (
                  <button className="btn btn-danger btn-sm" onClick={() => cancel(p.id)}>Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {total > 20 && (
        <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:20 }}>
          <button className="btn btn-ghost btn-sm" disabled={page===1} onClick={() => setPage(p=>p-1)}>← Prev</button>
          <span style={{ lineHeight:"30px", fontSize:13, color:"var(--muted2)" }}>Page {page}</span>
          <button className="btn btn-ghost btn-sm" disabled={posts.length < 20} onClick={() => setPage(p=>p+1)}>Next →</button>
        </div>
      )}
    </div>
  );
}
export default PostsList;
