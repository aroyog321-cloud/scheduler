import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { postApi, scheduleApi } from "../api";
import { useToast } from "../context";
import { DndContext, MouseSensor, TouchSensor, useSensor, useSensors, useDraggable, useDroppable } from "@dnd-kit/core";
import { Calendar as CalendarIcon, CheckSquare, Trash2, Plus } from "lucide-react";

const PLATFORM_META = {
  YOUTUBE:{ color:"#FF0000" }, INSTAGRAM:{ color:"#E1306C" }, TWITTER:{ color:"#1DA1F2" },
  LINKEDIN:{ color:"#0077B5" }, TIKTOK:{ color:"#69C9D0" }, FACEBOOK:{ color:"#1877F2" },
  PINTEREST:{ color:"#E60023" },
};
const DAYS = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

function DraggablePost({ post }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: post.id, data: { post } });
  
  const style = transform ? { 
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
    zIndex: 100, 
    position: "relative",
    opacity: isDragging ? 0.8 : 1,
    boxShadow: isDragging ? "0 10px 20px rgba(0,0,0,0.5)" : "none",
  } : undefined;

  return (
    <div 
      ref={setNodeRef} 
      style={{
        fontSize:11, padding:"3px 6px", borderRadius:4,
        background:`${PLATFORM_META[post.platforms[0]]?.color || "#888"}20`,
        color: PLATFORM_META[post.platforms[0]]?.color || "#888",
        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
        fontWeight:600, border: "1px solid rgba(0,0,0,0.05)",
        cursor: "grab", ...style
      }}
      {...listeners} {...attributes}
    >
      {post.title}
    </div>
  );
}

function DroppableDay({ day, isToday, isSelected, onClick, children }) {
  const { isOver, setNodeRef } = useDroppable({ id: day ? day.toString() : "empty" });

  let bg = "transparent";
  if (isOver) bg = "rgba(0,0,0,0.03)";
  else if (isSelected) bg = "rgba(79, 70, 229, 0.08)";
  else if (isToday) bg = "rgba(79, 70, 229, 0.04)";

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      style={{
        minHeight: 100, padding: 8, 
        borderRight: "1px solid var(--border-subtle)", 
        borderBottom: "1px solid var(--border-subtle)",
        background: bg,
        cursor: day ? "pointer" : "default",
        transition: "background 0.15s ease",
      }}
      onMouseEnter={e => { if (day && !isOver && !isSelected) e.currentTarget.style.background = isToday ? "rgba(79, 70, 229, 0.06)" : "var(--surface)"; }}
      onMouseLeave={e => { if (day && !isOver && !isSelected) e.currentTarget.style.background = isToday ? "rgba(79, 70, 229, 0.04)" : "transparent"; }}
    >
      {day && (
        <>
          <div style={{
            fontSize:13, fontWeight: isToday ? 600 : 500,
            color: isToday ? "var(--primary)" : "var(--text-muted)",
            width:24, height:24, borderRadius:"50%",
            background: isToday ? "rgba(79, 70, 229, 0.15)" : "transparent",
            display:"flex", alignItems:"center", justifyContent:"center",
            marginBottom:6,
          }}>{day}</div>
          <div style={{ display:"flex", flexDirection:"column", gap: 4 }}>
            {children}
          </div>
        </>
      )}
    </div>
  );
}

export default function CalendarPage() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState(null); 
  const [bulkSelection, setBulkSelection] = useState(new Set());
  
  const toast = useToast();
  const navigate = useNavigate();

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 5 } })
  );

  useEffect(() => { load(); }, [year, month]);

  const load = async () => {
    setLoading(true);
    setBulkSelection(new Set());
    try {
      const res = await postApi.calendar(year, month);
      setPosts(res.data.posts || []);
    } catch { toast.error("Failed to load calendar"); }
    finally { setLoading(false); }
  };

  const prev = () => { if (month === 1) { setYear(y => y-1); setMonth(12); } else setMonth(m => m-1); };
  const next = () => { if (month === 12) { setYear(y => y+1); setMonth(1); } else setMonth(m => m+1); };

  const firstDay = new Date(year, month-1, 1).getDay();
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells = Array(42).fill(null).map((_, i) => {
    const day = i - firstDay + 1;
    return (day >= 1 && day <= daysInMonth) ? day : null;
  });

  const byDay = {};
  for (const p of posts) {
    const d = new Date(p.scheduledAt).getDate();
    if (!byDay[d]) byDay[d] = [];
    byDay[d].push(p);
  }

  const handleDragEnd = async (event) => {
    const { active, over } = event;
    if (!over) return;

    const postId = active.id;
    const targetDay = parseInt(over.id, 10);
    if (!targetDay) return;

    const post = active.data.current.post;
    const oldDate = new Date(post.scheduledAt);
    
    if (oldDate.getDate() === targetDay) return; // No change

    const newDate = new Date(year, month - 1, targetDay, oldDate.getHours(), oldDate.getMinutes());
    
    // Optimistic update
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, scheduledAt: newDate.toISOString() } : p));
    
    try {
      await scheduleApi.reschedule(postId, newDate.toISOString());
      toast.success("Post rescheduled");
    } catch {
      toast.error("Failed to reschedule");
      load(); // revert
    }
  };

  const toggleBulk = (id) => {
    setBulkSelection(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCancelBulk = async () => {
    if (bulkSelection.size === 0) return;
    if (!confirm(`Cancel ${bulkSelection.size} selected post(s)?`)) return;
    try {
      for (const id of bulkSelection) {
        await scheduleApi.cancel(id);
      }
      toast.success("Posts cancelled successfully");
      load();
    } catch { toast.error("Failed to cancel some posts"); }
  };

  const selectedPosts = selectedDay ? (byDay[selectedDay] || []) : [];

  return (
    <div>
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap: "wrap", gap: 16 }}>
        <div>
          <h1 className="page-title">Content Calendar</h1>
          <p className="page-subtitle">Drag to reschedule. Plan your perfect pipeline.</p>
        </div>
        <div style={{ display:"flex", gap: 12, alignItems: "center" }}>
          <div style={{ display:"flex", background: "var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-full)" }}>
            <button className="btn btn-ghost" style={{ padding: "8px 16px", borderRadius: "var(--radius-full) 0 0 var(--radius-full)" }} onClick={prev}>←</button>
            <span style={{ fontWeight:600, fontSize:14, padding:"8px 16px", color: "var(--text-heading)", minWidth: 140, textAlign: "center" }}>{MONTHS[month-1]} {year}</span>
            <button className="btn btn-ghost" style={{ padding: "8px 16px", borderRadius: "0 var(--radius-full) var(--radius-full) 0" }} onClick={next}>→</button>
          </div>
          <button className="btn btn-primary" onClick={() => navigate("/create")}><Plus size={16}/> New</button>
        </div>
      </div>

      {loading ? (
        <div style={{ display:"flex", flexDirection: "column", gap: 16 }}>
           <div className="skeleton" style={{ height: 48 }} />
           <div className="skeleton" style={{ height: 600 }} />
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"minmax(0, 1fr) 320px", gap: 24, alignItems:"start" }}>
          
          <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
            <div className="card" style={{ padding:0, overflow:"hidden", border: "1px solid var(--border-subtle)" }}>
              {/* Day headers */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", background: "var(--surface)", borderBottom:"1px solid var(--border-subtle)" }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding:"12px 0", textAlign:"center", fontSize:12, fontWeight:600, color:"var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{d}</div>
                ))}
              </div>
              
              {/* Grid cells */}
              <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)" }}>
                {cells.map((day, i) => {
                  const dayPosts = day ? byDay[day] || [] : [];
                  const isToday = day === today.getDate() && month === today.getMonth()+1 && year === today.getFullYear();
                  return (
                    <DroppableDay 
                      key={i} 
                      day={day} 
                      isToday={isToday} 
                      isSelected={selectedDay === day}
                      onClick={() => day && setSelectedDay(day)}
                    >
                      {dayPosts.slice(0, 3).map(p => <DraggablePost key={p.id} post={p} />)}
                      {dayPosts.length > 3 && (
                        <div style={{ fontSize:11, color:"var(--text-muted)", fontWeight: 500, paddingLeft: 6 }}>+{dayPosts.length-3} more</div>
                      )}
                    </DroppableDay>
                  );
                })}
              </div>
            </div>
          </DndContext>

          {/* Side panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            <div className="card">
              {selectedDay ? (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                    <div style={{ fontSize:16, fontWeight:600, color: "var(--text-heading)" }}>
                      {MONTHS[month-1]} {selectedDay}
                    </div>
                    {bulkSelection.size > 0 && (
                      <button className="btn btn-danger btn-sm" onClick={handleCancelBulk} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <Trash2 size={12} /> Cancel ({bulkSelection.size})
                      </button>
                    )}
                  </div>

                  {selectedPosts.length === 0 ? (
                    <div className="empty" style={{ padding: "40px 0" }}>
                      <div className="empty-subtext" style={{ marginBottom: 16 }}>No posts scheduled.</div>
                      <button className="btn btn-secondary btn-sm" onClick={() => navigate("/create")}>
                        Schedule Post
                      </button>
                    </div>
                  ) : (
                    <div style={{ display:"flex", flexDirection:"column", gap: 12 }}>
                      {selectedPosts.map(p => (
                        <div key={p.id} style={{ background:"var(--surface)", border: "1px solid var(--border-subtle)", borderRadius: "var(--radius-sm)", padding: 16, display: "flex", gap: 12 }}>
                           <div style={{ paddingTop: 2 }}>
                             <button 
                               onClick={() => toggleBulk(p.id)}
                               style={{ width: 18, height: 18, borderRadius: 4, border: bulkSelection.has(p.id) ? "none" : "1px solid var(--border-subtle)", background: bulkSelection.has(p.id) ? "var(--primary)" : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", cursor: "pointer" }}
                             >
                               {bulkSelection.has(p.id) && <CheckSquare size={14} />}
                             </button>
                           </div>
                           <div style={{ flex: 1 }}>
                             <div style={{ fontSize:14, fontWeight:500, color: "var(--text-heading)", marginBottom:4 }}>{p.title}</div>
                             <div style={{ fontSize:12, color:"var(--text-muted)", marginBottom:10 }}>
                               {new Date(p.scheduledAt).toLocaleTimeString([], { hour:"2-digit", minute:"2-digit" })}
                             </div>
                             <div style={{ display:"flex", gap: 6, flexWrap:"wrap", marginBottom:12 }}>
                               {p.platforms.map(pl => (
                                 <span key={pl} style={{ display: "flex", alignItems: "center", gap: 4, fontSize:10, padding:"2px 8px", borderRadius:"var(--radius-full)", background:`${PLATFORM_META[pl]?.color || "#888"}15`, color:PLATFORM_META[pl]?.color || "#888", fontWeight:600 }}>
                                   {pl}
                                 </span>
                               ))}
                             </div>
                             <span className={`badge badge-${p.status.toLowerCase()}`}>{p.status}</span>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ textAlign:"center", padding:"60px 20px" }}>
                  <CalendarIcon size={32} style={{ color: "var(--text-disabled)", marginBottom: 16 }} />
                  <div style={{ fontSize:15, fontWeight: 500, color:"var(--text-heading)", marginBottom: 4 }}>Select a day</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)" }}>Click on the grid to manage posts</div>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="card">
              <div style={{ fontSize:13, fontWeight:600, color:"var(--text-heading)", marginBottom:16 }}>Platforms</div>
              <div style={{ display:"grid", gridTemplateColumns: "1fr 1fr", gap:12 }}>
                {Object.entries(PLATFORM_META).map(([k,v]) => (
                  <div key={k} style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <div style={{ width:12, height:12, borderRadius:"50%", background:v.color, flexShrink:0, boxShadow: `0 0 8px ${v.color}40` }} />
                    <span style={{ fontSize:13, color:"var(--text-muted)", fontWeight: 500 }}>{k.charAt(0)+k.slice(1).toLowerCase()}</span>
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
