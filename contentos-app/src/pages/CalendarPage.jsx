import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { postApi, scheduleApi } from "../api";
import { useToast } from "../context";

const PLATFORM_META = {
  YOUTUBE:{ color:"#FF0000" }, INSTAGRAM:{ color:"#E1306C" }, TWITTER:{ color:"#1DA1F2" },
  LINKEDIN:{ color:"#0077B5" }, TIKTOK:{ color:"#69C9D0" }, FACEBOOK:{ color:"#1877F2" },
  PINTEREST:{ color:"#E60023" },
};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null); // { day, posts[] }
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => { load(); }, [year, month]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await postApi.calendar(year, month);
      setPosts(res.data.posts || []);
    } catch { toast.error("Failed to load calendar"); }
    finally { setLoading(false); }
  };

  const prev = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const next = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  // Build calendar grid
  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(42).fill(null).map((_, i) => {
    const day = i - firstDay + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  // Group posts by day
  const byDay = {};
  for (const p of posts) {
    const d = new Date(p.scheduledAt).getDate();
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(p);
  }

  const handleCancel = async (postId) => {
    if (!confirm("Cancel this post?")) return;
    try {
      await scheduleApi.cancel(postId);
      toast.success("Post cancelled");
      load();
      setSelected(null);
    } catch { toast.error("Failed to cancel"); }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h1 className="page-title">Content Calendar</h1>
          <p className="page-subtitle">{posts.length} post{posts.length !== 1 ? "s" : ""} scheduled this month</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button className="btn btn-ghost btn-sm" onClick={prev}>←</button>
          <span style={{ fontWeight:700, fontSize:15, padding:"0 8px", lineHeight:"30px" }}>{MONTHS[month-1]} {year}</span>
          <button className="btn btn-ghost btn-sm" onClick={next}>→</button>
          <button className="btn btn-primary btn-sm" onClick={() => navigate("/create")}>＋ New</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:60 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"1fr 300px", gap:20, alignItems:"start" }}>
          {/* Calendar grid */}
          <div className="card" style={{ padding:0, overflow:"hidden" }}>
            {/* Day headers */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", borderBottom:"1px solid var(--border)" }}>
              {DAYS.map(d => (
                <div key={d} style={{ padding:"10px 0", textAlign:"center", fontSize:12, fontWeight:600, color:"var(--muted2)" }}>{d}</div>
              ))}
            </div>
            {/* Day cells */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)" }}>
              {cells.map((day, i) => {
                const dayPosts = day ? byDay[day] || [] : [];
                const isToday = day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
                const isSelected = selected?.day === day;
                return (
                  <div
                    key={i}
                    onClick={() => day && setSelected({ day, posts: dayPosts })}
                    style={{
                      minHeight:88, padding:"8px", borderRight:"1px solid var(--border)", borderBottom:"1px solid var(--border)",
                      background: isSelected ? "rgba(0,212,255,0.06)" : isToday ? "rgba(0,212,255,0.04)" : "transparent",
                      cursor: day ? "pointer" : "default",
                      transition:"background 0.15s",
                    }}
                    onMouseEnter={e => { if (day) e.currentTarget.style.background = isSelected ? "rgba(0,212,255,0.08)" : "rgba(255,255,255,0.03)"; }}
                    onMouseLeave={e => { e.currentTarget.style.background = isSelected ? "rgba(0,212,255,0.06)" : isToday ? "rgba(0,212,255,0.04)" : "transparent"; }}
                  >
                    {day && (
                      <>
                        <div style={{
                          fontSize:13, fontWeight: isToday ? 700 : 400,
                          color: isToday ? "var(--accent)" : "var(--text)",
                          width:22, height:22, borderRadius:"50%",
                          background: isToday ? "rgba(0,212,255,0.15)" : "transparent",
                          display:"flex", alignItems:"center", justifyContent:"center",
                          marginBottom:4,
                        }}>{day}</div>
                        <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                          {dayPosts.slice(0,3).map(p => (
                            <div key={p.id} style={{
                              fontSize:10, padding:"2px 5px", borderRadius:4,
                              background:`${PLATFORM_META[p.platforms[0]]?.color || "#888"}20`,
                              color:PLATFORM_META[p.platforms[0]]?.color || "#888",
                              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
                              fontWeight:500,
                            }}>
                              {p.title}
                            </div>
                          ))}
                          {dayPosts.length > 3 && (
                            <div style={{ fontSize:10, color:"var(--muted)", paddingLeft:5 }}>+{dayPosts.length-3} more</div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Side panel */}
          <div>
            {selected ? (
              <div className="card">
                <div style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>
                  {MONTHS[month-1]} {selected.day}
                  <span style={{ fontSize:12, color:"var(--muted)", fontWeight:400, marginLeft:8 }}>
                    {selected.posts.length} post{selected.posts.length !== 1 ? "s" : ""}
                  </span>
                </div>
                {selected.posts.length === 0 ? (
                  <div style={{ textAlign:"center", padding:"20px 0" }}>
                    <div style={{ color:"var(--muted)", fontSize:13 }}>No posts on this day</div>
                    <button className="btn btn-primary btn-sm" style={{ marginTop:10 }} onClick={() => navigate("/create")}>
                      Schedule here
                    </button>
                  </div>
                ) : (
                  <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                    {selected.posts.map(p => (
                      <div key={p.id} style={{ background:"var(--bg3)", borderRadius:8, padding:"12px" }}>
                        <div style={{ fontSize:13, fontWeight:600, marginBottom:4 }}>{p.title}</div>
                        <div style={{ fontSize:11, color:"var(--muted)", marginBottom:8 }}>
                          {new Date(p.scheduledAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                        </div>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap", marginBottom:8 }}>
                          {p.platforms.map(pl => (
                            <span key={pl} style={{ fontSize:10, padding:"2px 7px", borderRadius:4, background:`${PLATFORM_META[pl]?.color || "#888"}20`, color:PLATFORM_META[pl]?.color || "#888", fontWeight:600 }}>{pl}</span>
                          ))}
                        </div>
                        <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                        {(p.status === "SCHEDULED" || p.status === "DRAFT") && (
                          <button className="btn btn-danger btn-sm" style={{ marginLeft:8, fontSize:11, padding:"3px 8px" }} onClick={() => handleCancel(p.id)}>Cancel</button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="card" style={{ textAlign:"center", padding:"40px 20px" }}>
                <div style={{ fontSize:28, marginBottom:10 }}>📅</div>
                <div style={{ fontSize:14, color:"var(--muted2)" }}>Click a day to see posts</div>
              </div>
            )}

            {/* Legend */}
            <div className="card" style={{ marginTop:14 }}>
              <div style={{ fontSize:12, fontWeight:600, color:"var(--muted2)", marginBottom:10 }}>Platform Colors</div>
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {Object.entries(PLATFORM_META).map(([k,v]) => (
                  <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:3, background:v.color, flexShrink:0 }} />
                    <span style={{ fontSize:12, color:"var(--muted2)" }}>{k.charAt(0)+k.slice(1).toLowerCase()}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
