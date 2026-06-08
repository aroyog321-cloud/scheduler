import { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { mediaApi, postApi, platformApi, scheduleApi } from "../api";
import { useToast } from "../context";
import { Sparkles, Calendar as CalendarIcon, AlertCircle, Image as ImageIcon, Check, X, Clock, Lock } from "lucide-react";

const PLATFORMS = ["YOUTUBE","INSTAGRAM","TWITTER","LINKEDIN","TIKTOK","FACEBOOK","PINTEREST"];
const PLATFORM_META = {
  YOUTUBE:   { icon:"▶", color:"#FF0000" }, INSTAGRAM: { icon:"◈", color:"#E1306C" },
  TWITTER:   { icon:"𝕏", color:"#1DA1F2" }, LINKEDIN:  { icon:"in", color:"#0077B5" },
  TIKTOK:    { icon:"♪", color:"#69C9D0" }, FACEBOOK:  { icon:"f", color:"#1877F2" },
  PINTEREST: { icon:"P", color:"#E60023" },
};

function defaultScheduleTime() {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d.toISOString().slice(0, 16);
}

export default function CreatePost() {
  const location = useLocation();
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  const [previewPlatform, setPreviewPlatform] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  
  const fileRef = useRef();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: location.state?.topic || "", 
    caption: "", 
    description: "", 
    hashtags: "",
    platforms: [], 
    scheduledAt: defaultScheduleTime(), 
    privacyStatus: "PUBLIC",
  });

  useEffect(() => {
    platformApi.list().then(r => {
      setConnectedPlatforms(r.data.accounts.map(a => a.platform));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (form.platforms.length > 0 && !form.platforms.includes(previewPlatform)) {
      setPreviewPlatform(form.platforms[0]);
    } else if (form.platforms.length === 0) {
      setPreviewPlatform("");
    }
  }, [form.platforms, previewPlatform]);

  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const uploadFile = async () => {
    if (!file) return null;
    setUploading(true);
    try {
      const res = await mediaApi.upload(file, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setMediaFile(res.data.mediaFile);
      toast.success("File uploaded");
      return res.data.mediaFile.id;
    } catch (err) {
      toast.error(err);
      return null;
    } finally {
      setUploading(false);
    }
  };

  const generateAi = async () => {
    if (!form.title && !file?.name) {
      toast.error("Please enter a topic first.");
      return;
    }
    const topic = form.title || file?.name?.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ") || "content";
    setAiLoading(true);
    try {
      const res = await scheduleApi.aiGenerate(topic, "engaging", form.platforms.length ? form.platforms : ["YOUTUBE","INSTAGRAM"]);
      const g = res.data.generated;
      setForm(f => ({
        ...f,
        title: g.title || f.title,
        caption: g.caption || f.caption,
        description: g.description || f.description,
        hashtags: (g.hashtags || []).join(", "),
      }));
      toast.success("AI draft generated");
    } catch { toast.error("AI generation failed"); }
    finally { setAiLoading(false); }
  };

  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  const maxChars = form.platforms.includes("TWITTER") ? 280 : 2200;
  const currentChars = form.caption.length;
  const overLimit = currentChars > maxChars;
  
  const requiresMedia = form.platforms.some(p => ["INSTAGRAM", "YOUTUBE", "TIKTOK"].includes(p));
  const missingMedia = requiresMedia && !file && !mediaFile;

  const submit = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    if (form.platforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (!form.scheduledAt) { toast.error("Schedule time is required"); return; }
    if (overLimit) { toast.error(`Caption exceeds length for selected platforms`); return; }
    if (missingMedia) { toast.error(`Media is required for Instagram/YouTube`); return; }

    let finalMediaId = mediaFile?.id;
    if (file && !mediaFile) {
      finalMediaId = await uploadFile();
      if (!finalMediaId) return; // upload failed
    }

    setSubmitting(true);
    try {
      const hashtags = form.hashtags.split(",").map(h => h.trim().replace(/^#/, "")).filter(Boolean);
      await postApi.create({
        title: form.title,
        caption: form.caption,
        description: form.description,
        hashtags,
        platforms: form.platforms,
        scheduledAt: new Date(form.scheduledAt).toISOString(),
        mediaFileId: finalMediaId || undefined,
        privacyStatus: form.privacyStatus,
      });
      toast.success("Post scheduled successfully");
      navigate("/calendar");
    } catch (err) { toast.error(err); }
    finally { setSubmitting(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));
  
  const canSubmit = !submitting && !uploading && form.platforms.length > 0 && form.title && !overLimit && !missingMedia;

  return (
    <div style={{ paddingBottom: 60 }}>
      {/* Header */}
      <div className="page-header" style={{ position: "sticky", top: 0, zIndex: 10, background: "rgba(248, 250, 252, 0.8)", backdropFilter: "blur(12px)", padding: "24px 0", marginBottom: 32, borderBottom: "1px solid var(--border-subtle)" }}>
        <div>
          <h1 className="page-title">Create Post</h1>
          <p className="page-subtitle">Draft, preview, and schedule content across platforms.</p>
        </div>
        <div style={{ display: "flex", gap: 12 }}>
          <button className="btn btn-secondary" onClick={() => navigate("/calendar")}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={submit}
            disabled={!canSubmit}
            style={{ padding: "10px 24px", boxShadow: canSubmit ? "0 4px 12px rgba(79, 70, 229, 0.2)" : "none" }}
          >
            {submitting ? <span className="spinner" /> : <><CalendarIcon size={16}/> Schedule Post</>}
          </button>
        </div>
      </div>

      <div className="create-post-grid">
        
        {/* LEFT COLUMN: Editor Pane */}
        <div style={{ display:"flex", flexDirection:"column", gap: 32 }}>

          {/* Platforms Selection */}
          <section>
            <h3 style={{ fontSize:14, fontWeight:600, color:"var(--text-heading)", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 }}>1. Select Platforms</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap: 12 }}>
              {PLATFORMS.map(p => {
                const meta = PLATFORM_META[p];
                const connected = connectedPlatforms.includes(p);
                const selected = form.platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => connected && togglePlatform(p)}
                    title={!connected ? "Connect in Settings first" : ""}
                    style={{
                      display:"flex", alignItems:"center", gap:8,
                      padding:"10px 18px", borderRadius: "var(--radius-full)",
                      background: selected ? "var(--surface)" : "var(--bg)",
                      border: "1px solid",
                      borderColor: selected ? meta.color : "var(--border)",
                      color: selected ? "var(--text-heading)" : "var(--text-muted)",
                      cursor: connected ? "pointer" : "not-allowed", 
                      opacity: connected ? 1 : 0.5,
                      transition:"all 0.2s cubic-bezier(0.16, 1, 0.3, 1)",
                      fontSize: 14, fontWeight: 600,
                      boxShadow: selected ? `0 4px 12px ${meta.color}15, inset 0 0 0 1px ${meta.color}20` : "none",
                      transform: selected ? "translateY(-2px)" : "none"
                    }}
                  >
                    <span style={{ color: selected ? meta.color : "var(--text-placeholder)", fontSize: 16 }}>{meta.icon}</span>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                    {selected && <Check size={14} style={{ color: meta.color, marginLeft: 4 }} />}
                  </button>
                );
              })}
            </div>
            {connectedPlatforms.length === 0 && (
              <div style={{ fontSize:13, color:"#F59E0B", marginTop:16, display: "flex", alignItems: "center", gap: 8, padding: "12px 16px", background: "rgba(245, 158, 11, 0.05)", borderRadius: "var(--radius-sm)", border: "1px solid rgba(245, 158, 11, 0.2)" }}>
                <AlertCircle size={16} /> No platforms connected. Please connect them in <a href="/platforms" style={{ textDecoration:"underline", fontWeight: 600 }}>Integrations</a> first.
              </div>
            )}
          </section>

          {/* Content Editor */}
          <section className="card" style={{ padding: 32, border: "1px solid var(--border)", boxShadow: "0 4px 20px rgba(0,0,0,0.03)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 24 }}>
              <h3 style={{ fontSize:18, fontWeight:700, color: "var(--text-heading)" }}>Post Details</h3>
              <button 
                className="btn btn-secondary btn-sm" 
                onClick={generateAi} 
                disabled={aiLoading} 
                style={{ 
                  color: "var(--primary)", 
                  borderColor: "rgba(79, 70, 229, 0.3)", 
                  background: "rgba(79, 70, 229, 0.05)",
                  boxShadow: "0 2px 8px rgba(79, 70, 229, 0.1)"
                }}
              >
                {aiLoading ? <span className="spinner" /> : <><Sparkles size={14}/> Write with AI</>}
              </button>
            </div>
            
            <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
              <div className="field">
                <label className="label">Topic or Title <span style={{ color: "#EF4444" }}>*</span></label>
                <input 
                  className="input" 
                  placeholder="e.g. 5 rules of minimal design" 
                  value={form.title} 
                  onChange={set("title")} 
                  maxLength={100} 
                  style={{ fontSize: 16, padding: "14px 16px", background: "var(--bg)", border: "1px solid var(--border-subtle)" }} 
                />
              </div>
              
              <div className="field" style={{ position: "relative" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <label className="label">Caption</label>
                  <span style={{ fontSize: 12, color: overLimit ? "#EF4444" : "var(--text-muted)", fontWeight: overLimit ? 600 : 500 }}>
                    {currentChars} / {maxChars} chars
                  </span>
                </div>
                <textarea 
                  className="textarea" 
                  placeholder="Write an engaging caption..." 
                  value={form.caption} 
                  onChange={set("caption")} 
                  rows={6} 
                  style={{ 
                    fontSize: 15, lineHeight: 1.6, padding: "16px",
                    background: "var(--bg)", border: "1px solid var(--border-subtle)",
                    borderColor: overLimit ? "#EF4444" : undefined, 
                    boxShadow: overLimit ? "0 0 0 3px rgba(239, 68, 68, 0.1)" : undefined 
                  }} 
                />
              </div>
              
              <div className="field">
                <label className="label">Hashtags</label>
                <input 
                  className="input" 
                  placeholder="design, minimal, ui" 
                  value={form.hashtags} 
                  onChange={set("hashtags")}
                  style={{ background: "var(--bg)", border: "1px solid var(--border-subtle)" }} 
                />
              </div>
            </div>
          </section>

          {/* Media Dropzone */}
          <section>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom: 12 }}>
              <h3 style={{ fontSize:14, fontWeight:600, color:"var(--text-heading)", textTransform: "uppercase", letterSpacing: 0.5 }}>2. Media Assets</h3>
              {missingMedia && <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 600 }}>* Required for Instagram/YouTube</span>}
            </div>

            {!file ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={e => { e.preventDefault(); setIsDragging(false); onFile(e.dataTransfer.files[0]); }}
                style={{
                  border: missingMedia ? "2px dashed #EF4444" : isDragging ? "2px dashed var(--primary)" : "2px dashed var(--border)", 
                  background: missingMedia ? "rgba(239, 68, 68, 0.02)" : isDragging ? "rgba(79, 70, 229, 0.02)" : "var(--surface)", 
                  borderRadius: "var(--radius-md)",
                  padding: "48px 24px", textAlign: "center", cursor: "pointer", 
                  transition: "all 0.2s ease",
                  transform: isDragging ? "scale(1.01)" : "scale(1)"
                }}
              >
                <div style={{ width: 64, height: 64, borderRadius: "50%", background: "var(--bg)", border: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px auto", color: "var(--text-muted)" }}>
                  <ImageIcon size={28} />
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)", marginBottom: 8 }}>Drag and drop media here</div>
                <div style={{ fontSize: 14, color: "var(--text-muted)" }}>or click to browse from your computer</div>
                <div style={{ fontSize: 12, color: "var(--text-placeholder)", marginTop: 12 }}>Supports MP4, MOV, JPG, PNG up to 5GB</div>
                <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display:"none" }} onChange={e => onFile(e.target.files[0])} />
              </div>
            ) : (
              <div style={{ display:"flex", gap:20, alignItems:"center", padding: 16, background: "var(--surface)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", boxShadow: "0 2px 8px rgba(0,0,0,0.02)" }}>
                {preview && file?.type?.startsWith("image") ? (
                  <div style={{ width: 80, height: 80, borderRadius: 8, overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                    <img src={preview} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  </div>
                ) : (
                  <div style={{ width:80, height:80, background:"var(--bg)", borderRadius: 8, display:"flex", alignItems:"center", justifyContent:"center", fontSize:24, color: "var(--text-muted)", border: "1px solid var(--border-subtle)" }}>🎬</div>
                )}
                
                <div style={{ flex:1, minWidth: 0 }}>
                  <div style={{ fontSize:14, fontWeight:600, color:"var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{file.name}</div>
                  <div style={{ fontSize:13, color:"var(--text-muted)", marginTop: 4 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  
                  {uploading && (
                    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 12 }}>
                      <div style={{ flex: 1, height: 6, background: "var(--bg)", borderRadius: "var(--radius-full)", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${uploadProgress}%`, background: "var(--primary)", transition: "width 0.3s ease" }} />
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--primary)" }}>{uploadProgress}%</div>
                    </div>
                  )}
                  {mediaFile && !uploading && (
                    <div style={{ marginTop: 8, display: "flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 600, color: "#10B981" }}>
                      <Check size={14} /> Uploaded to CDN
                    </div>
                  )}
                </div>
                
                <button 
                  className="btn btn-ghost" 
                  onClick={() => { setFile(null); setPreview(null); setMediaFile(null); URL.revokeObjectURL(preview); }}
                  style={{ width: 40, height: 40, padding: 0, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)" }}
                >
                  <X size={20} />
                </button>
              </div>
            )}
          </section>

        </div>

        {/* RIGHT COLUMN: Settings & Preview */}
        <div style={{ display:"flex", flexDirection:"column", gap: 24, position:"sticky", top: 120 }}>
          
          <div className="card" style={{ padding: 24, border: "1px solid var(--border)" }}>
            <h3 style={{ fontSize: 16, fontWeight: 700, color: "var(--text-heading)", marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
              <Clock size={18} style={{ color: "var(--primary)" }} /> Publishing
            </h3>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div className="field">
                <label className="label">Date & Time</label>
                <input 
                  className="input" 
                  type="datetime-local" 
                  value={form.scheduledAt} 
                  onChange={set("scheduledAt")}
                  min={new Date(Date.now() + 60000).toISOString().slice(0,16)} 
                  style={{ background: "var(--bg)", border: "1px solid var(--border-subtle)", padding: "12px 14px", fontSize: 15 }}
                />
              </div>
              <div className="field">
                <label className="label">Privacy Status</label>
                <div style={{ position: "relative" }}>
                  <select 
                    className="select" 
                    value={form.privacyStatus} 
                    onChange={set("privacyStatus")}
                    style={{ background: "var(--bg)", border: "1px solid var(--border-subtle)", padding: "12px 14px", fontSize: 15, paddingLeft: 40 }}
                  >
                    <option value="PUBLIC">Public — Everyone can see</option>
                    <option value="UNLISTED">Unlisted — Anyone with link</option>
                    <option value="PRIVATE">Private — Only you</option>
                  </select>
                  <Lock size={16} style={{ position: "absolute", left: 14, top: 14, color: "var(--text-muted)", pointerEvents: "none" }} />
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "flex", flexDirection: "column", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.05)" }}>
            {/* Segmented Control Header */}
            <div style={{ padding: "16px 20px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
               <h3 style={{ fontSize:14, fontWeight:600, color: "var(--text-heading)", textTransform: "uppercase", letterSpacing: 0.5 }}>Preview</h3>
               
               {form.platforms.length > 0 && (
                 <div style={{ display: "flex", gap: 6, background: "var(--surface)", padding: 4, borderRadius: "var(--radius-full)", border: "1px solid var(--border-subtle)" }}>
                   {form.platforms.map(p => (
                     <button 
                       key={p} 
                       onClick={() => setPreviewPlatform(p)} 
                       style={{ 
                         width: 28, height: 28, borderRadius: "50%", 
                         display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, 
                         background: previewPlatform === p ? PLATFORM_META[p].color : "transparent", 
                         color: previewPlatform === p ? "#fff" : "var(--text-muted)", 
                         border: "none", cursor: "pointer", transition: "all 0.15s ease",
                         boxShadow: previewPlatform === p ? `0 2px 8px ${PLATFORM_META[p].color}60` : "none"
                       }}
                     >
                       {PLATFORM_META[p].icon}
                     </button>
                   ))}
                 </div>
               )}
            </div>
            
            {/* Social Media Mockup */}
            <div style={{ background: "#F1F5F9", display: "flex", justifyContent: "center", alignItems: "flex-start", minHeight: 480, padding: 32 }}>
              {previewPlatform === "" ? (
                 <div style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 100 }}>Select a platform to preview</div>
              ) : (
                <div style={{ width: "100%", maxWidth: 360, background: "#FFFFFF", borderRadius: 16, border: "1px solid #E2E8F0", overflow: "hidden", boxShadow: "0 20px 40px rgba(0,0,0,0.08)" }}>
                  
                  {/* Twitter Mockup specific header */}
                  {previewPlatform === "TWITTER" && (
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: "20px 20px 16px 20px" }}>
                      <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#F1F5F9", border: "1px solid #E2E8F0", flexShrink: 0 }}></div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#0F172A" }}>User Name</span>
                          <span style={{ fontSize: 15, color: "#64748B" }}>@handle · 1m</span>
                        </div>
                        <div style={{ fontSize: 15, color: "#0F172A", lineHeight: 1.5, marginTop: 4, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                          {form.caption || "What is happening?!"}
                          {form.hashtags && (
                            <div style={{ color: PLATFORM_META[previewPlatform].color, marginTop: 8 }}>
                              {form.hashtags.split(",").map(h => `#${h.trim().replace(/^#/, "")}`).join(" ")}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Generic Mockup Header (Instagram/LinkedIn/Facebook) */}
                  {previewPlatform !== "TWITTER" && previewPlatform !== "YOUTUBE" && (
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "16px 20px" }}>
                      <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#F1F5F9", border: "1px solid #E2E8F0" }}></div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#0F172A" }}>Your Account</div>
                    </div>
                  )}

                  {/* Mockup Media */}
                  {previewPlatform !== "TWITTER" && (
                    preview ? (
                      <div style={{ width: "100%", aspectRatio: previewPlatform === "YOUTUBE" ? "16/9" : "1/1", background: "#F8FAFC", overflow: "hidden" }}>
                        {file?.type?.startsWith("image") ? (
                          <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 40, color: "#94A3B8" }}>🎬</div>
                        )}
                      </div>
                    ) : (
                      <div style={{ width: "100%", aspectRatio: "16/9", background: "#F8FAFC", borderTop: "1px solid #F1F5F9", borderBottom: "1px solid #F1F5F9", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8", fontSize: 13, fontWeight: 500 }}>
                        No media attached
                      </div>
                    )
                  )}
                  
                  {/* Twitter Media */}
                  {previewPlatform === "TWITTER" && preview && (
                     <div style={{ margin: "0 20px 20px 76px", borderRadius: 16, overflow: "hidden", border: "1px solid #E2E8F0" }}>
                       {file?.type?.startsWith("image") ? (
                          <img src={preview} alt="Preview" style={{ width: "100%", maxHeight: 240, objectFit: "cover", display: "block" }} />
                        ) : (
                          <div style={{ width: "100%", height: 180, background: "#F8FAFC", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "#94A3B8" }}>🎬</div>
                        )}
                     </div>
                  )}

                  {/* YouTube Text */}
                  {previewPlatform === "YOUTUBE" && (
                    <div style={{ padding: 16 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, color: "#0F172A", lineHeight: 1.4 }}>{form.title || "Video Title goes here"}</div>
                      <div style={{ fontSize: 13, color: "#64748B", marginTop: 6 }}>Channel Name · 0 views · Just now</div>
                    </div>
                  )}

                  {/* Generic Text (Instagram/LinkedIn) */}
                  {previewPlatform !== "TWITTER" && previewPlatform !== "YOUTUBE" && (
                    <div style={{ padding: "16px 20px", fontSize: 14, color: "#0F172A", lineHeight: 1.5, whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
                      <span style={{ fontWeight: 600, color: "#0F172A", marginRight: 8 }}>Your Account</span>
                      {form.caption || "Caption preview will appear here..."}
                      {form.hashtags && (
                        <div style={{ color: PLATFORM_META[previewPlatform].color, marginTop: 6 }}>
                          {form.hashtags.split(",").map(h => `#${h.trim().replace(/^#/, "")}`).join(" ")}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
