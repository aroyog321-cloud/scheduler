import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { mediaApi, postApi, platformApi, scheduleApi } from "../api";
import { useToast } from "../context";

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
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState(null);
  const [connectedPlatforms, setConnectedPlatforms] = useState([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: "", caption: "", description: "", hashtags: "",
    platforms: [], scheduledAt: defaultScheduleTime(), privacyStatus: "PUBLIC",
  });

  useEffect(() => {
    platformApi.list().then(r => {
      setConnectedPlatforms(r.data.accounts.map(a => a.platform));
    }).catch(() => {});
  }, []);

  const onFile = (f) => {
    if (!f) return;
    setFile(f);
    const url = URL.createObjectURL(f);
    setPreview(url);
  };

  const uploadFile = async () => {
    if (!file) return;
    setUploading(true);
    try {
      const res = await mediaApi.upload(file, (e) => {
        setUploadProgress(Math.round((e.loaded / e.total) * 100));
      });
      setMediaFile(res.data.mediaFile);
      toast.success("File uploaded");
    } catch (err) {
      toast.error(err);
    } finally {
      setUploading(false);
    }
  };

  const generateAi = async () => {
    if (!form.title && !file?.name) return;
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
      toast.success("AI content generated");
    } catch { toast.error("AI generation failed"); }
    finally { setAiLoading(false); }
  };

  const togglePlatform = (p) => {
    setForm(f => ({
      ...f,
      platforms: f.platforms.includes(p) ? f.platforms.filter(x => x !== p) : [...f.platforms, p],
    }));
  };

  const submit = async () => {
    if (!form.title) { toast.error("Title is required"); return; }
    if (form.platforms.length === 0) { toast.error("Select at least one platform"); return; }
    if (!form.scheduledAt) { toast.error("Schedule time is required"); return; }

    if (file && !mediaFile) {
      await uploadFile();
      return; 
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
        mediaFileId: mediaFile?.id || undefined,
        privacyStatus: form.privacyStatus,
      });
      toast.success("Post scheduled");
      navigate("/calendar");
    } catch (err) { toast.error(err); }
    finally { setSubmitting(false); }
  };

  const set = (k) => (e) => setForm(f => ({ ...f, [k]: e.target.value }));

  return (
    <div>
      <div className="page-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
        <div>
          <h1 className="page-title">Create Post</h1>
          <p className="page-subtitle">Draft, preview, and schedule content across platforms.</p>
        </div>
        <button
          className="btn btn-primary"
          onClick={submit}
          disabled={submitting || uploading || form.platforms.length === 0}
          style={{ padding: "16px 32px", fontSize: 16 }}
        >
          {submitting ? <span className="spinner" /> : "Schedule Post"}
        </button>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"55% 1fr", gap:48, alignItems:"start" }}>
        {/* LEFT: Editor Pane */}
        <div style={{ display:"flex", flexDirection:"column", gap:32 }}>

          {/* Platforms Selection */}
          <div className="card">
            <h3 style={{ fontSize:16, fontWeight:500, marginBottom:24, fontFamily: "var(--font-display)" }}>Target Platforms</h3>
            <div style={{ display:"flex", flexWrap:"wrap", gap:12 }}>
              {PLATFORMS.map(p => {
                const meta = PLATFORM_META[p];
                const connected = connectedPlatforms.includes(p);
                const selected = form.platforms.includes(p);
                return (
                  <button
                    key={p}
                    onClick={() => connected && togglePlatform(p)}
                    title={!connected ? "Not connected" : ""}
                    style={{
                      display:"flex", alignItems:"center", gap:8,
                      padding:"10px 16px", borderRadius: "var(--radius-full)",
                      border: `1px solid ${selected ? "var(--primary)" : "var(--border)"}`,
                      background: selected ? "rgba(94, 106, 210, 0.15)" : "var(--surface)",
                      color: selected ? "var(--text)" : "var(--text-muted)",
                      cursor: connected ? "pointer" : "not-allowed", 
                      opacity: connected ? 1 : 0.3,
                      transition:"all 0.2s ease",
                      fontSize: 14, fontWeight: 500
                    }}
                  >
                    <span style={{ color: selected ? meta.color : "inherit" }}>{meta.icon}</span>
                    {p.charAt(0) + p.slice(1).toLowerCase()}
                  </button>
                );
              })}
            </div>
            {connectedPlatforms.length === 0 && (
              <div style={{ fontSize:14, color:"var(--accent)", marginTop:16, fontWeight:400 }}>
                Please connect your platforms in <a href="/platforms" style={{ textDecoration:"underline" }}>Settings</a> first.
              </div>
            )}
          </div>

          {/* Details */}
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h3 style={{ fontSize:16, fontWeight:500, fontFamily: "var(--font-display)" }}>Content</h3>
              <button className="btn btn-secondary btn-sm" onClick={generateAi} disabled={aiLoading}>
                {aiLoading ? <span className="spinner" /> : "AI Generate Draft"}
              </button>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:24 }}>
              <div className="field">
                <label className="label">Title</label>
                <input className="input" placeholder="Enter headline or title" value={form.title} onChange={set("title")} maxLength={100} style={{ fontSize: 18 }} />
              </div>
              <div className="field">
                <label className="label">Caption</label>
                <textarea className="textarea" placeholder="Write your post caption..." value={form.caption} onChange={set("caption")} maxLength={2200} rows={5} />
              </div>
              <div className="field">
                <label className="label">Hashtags</label>
                <input className="input" placeholder="technology, design, minimal" value={form.hashtags} onChange={set("hashtags")} />
              </div>
            </div>
          </div>

          {/* Media Dropzone */}
          <div className="card">
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
              <h3 style={{ fontSize:16, fontWeight:500, fontFamily: "var(--font-display)" }}>Media Assets</h3>
              {mediaFile && <span className="badge badge-active">Uploaded to CDN</span>}
            </div>

            {!file ? (
              <div
                onClick={() => fileRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); onFile(e.dataTransfer.files[0]); }}
                style={{
                  border: "1px dashed var(--border)", background: "var(--surface)", borderRadius: "var(--radius-sm)",
                  padding:"64px 24px", textAlign:"center", cursor:"pointer", transition:"all 0.2s ease",
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.background = "var(--card)"; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.background = "var(--surface)"; }}
              >
                <div style={{ fontSize:32, marginBottom:16, color:"var(--text-muted)" }}>+</div>
                <div style={{ fontSize:16, fontWeight:500, marginBottom:8, color:"var(--text)" }}>Drag and drop media</div>
                <div style={{ fontSize:14, color:"var(--text-muted)", fontWeight:400 }}>Supports Video & Image files up to 5 GB</div>
                <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display:"none" }} onChange={e => onFile(e.target.files[0])} />
              </div>
            ) : (
              <div style={{ display:"flex", gap:24, alignItems:"center", padding: 24, background: "var(--surface)", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)" }}>
                {preview && file?.type?.startsWith("image") ? (
                  <img src={preview} alt="" style={{ width:100, height:100, objectFit:"cover", borderRadius: "var(--radius-sm)" }} />
                ) : (
                  <div style={{ width:100, height:100, background:"var(--bg)", borderRadius: "var(--radius-sm)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:32, color: "var(--text-muted)" }}>🎬</div>
                )}
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:16, fontWeight:500, color:"var(--text)" }}>{file.name}</div>
                  <div style={{ fontSize:14, color:"var(--text-muted)", marginTop:4, fontWeight:400 }}>{(file.size / 1024 / 1024).toFixed(1)} MB</div>
                  {uploading && (
                    <div style={{ marginTop:16 }}>
                      <div style={{ height:6, background:"var(--border)", borderRadius:"var(--radius-full)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${uploadProgress}%`, background:"var(--primary)", transition:"width 0.3s ease" }} />
                      </div>
                      <div style={{ fontSize:13, color:"var(--text-muted)", marginTop:8 }}>Uploading {uploadProgress}%</div>
                    </div>
                  )}
                  {!uploading && !mediaFile && (
                    <button className="btn btn-secondary btn-sm" style={{ marginTop:16 }} onClick={uploadFile}>Upload to Server</button>
                  )}
                </div>
                <button className="btn btn-ghost" onClick={() => { setFile(null); setPreview(null); setMediaFile(null); URL.revokeObjectURL(preview); }}>Remove</button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Live Preview & Schedule Settings */}
        <div style={{ display:"flex", flexDirection:"column", gap:32, position:"sticky", top:32 }}>
          
          <div className="card" style={{ padding: 0, overflow: "hidden", display: "flex", flexDirection: "column" }}>
            <div style={{ padding: "20px 32px", borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
               <h3 style={{ fontSize:16, fontWeight:500, fontFamily: "var(--font-display)" }}>Live Preview</h3>
            </div>
            
            {/* Social Media Mockup */}
            <div style={{ padding: 32, background: "var(--bg)", display: "flex", justifyContent: "center", alignItems: "center", minHeight: 400 }}>
              <div style={{ width: "100%", maxWidth: 360, background: "var(--card)", borderRadius: "16px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 10px 30px rgba(0,0,0,0.5)" }}>
                {/* Mockup Header */}
                <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 16 }}>
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface)", border: "1px solid var(--border)" }}></div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text)" }}>ContentOS User</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Just now</div>
                  </div>
                </div>
                
                {/* Mockup Text */}
                <div style={{ padding: "0 16px 16px 16px", fontSize: 14, color: "var(--text)", lineHeight: 1.5, whiteSpace: "pre-wrap" }}>
                  {form.caption || "Your post caption will appear here..."}
                  {form.hashtags && (
                    <div style={{ color: "var(--accent)", marginTop: 8 }}>
                      {form.hashtags.split(",").map(h => `#${h.trim().replace(/^#/, "")}`).join(" ")}
                    </div>
                  )}
                </div>

                {/* Mockup Media */}
                {preview ? (
                  <div style={{ width: "100%", height: 240, background: "var(--surface)" }}>
                    {file?.type?.startsWith("image") ? (
                      <img src={preview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    ) : (
                      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32, color: "var(--text-muted)" }}>🎬</div>
                    )}
                  </div>
                ) : (
                  <div style={{ width: "100%", height: 160, background: "var(--surface)", borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--text-muted)", fontSize: 13 }}>
                    No media attached
                  </div>
                )}
                
                {/* Mockup Footer */}
                <div style={{ padding: 16, display: "flex", gap: 24, color: "var(--text-muted)" }}>
                  <span style={{ fontSize: 14 }}>♥ Like</span>
                  <span style={{ fontSize: 14 }}>💬 Comment</span>
                  <span style={{ fontSize: 14 }}>↻ Share</span>
                </div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ fontSize:16, fontWeight:500, marginBottom:24, fontFamily: "var(--font-display)" }}>Publish Settings</h3>
            <div style={{ display:"flex", flexDirection:"column", gap:20 }}>
              <div className="field">
                <label className="label">Date & Time</label>
                <input className="input" type="datetime-local" value={form.scheduledAt} onChange={set("scheduledAt")}
                  min={new Date(Date.now() + 60000).toISOString().slice(0,16)} />
              </div>
              <div className="field">
                <label className="label">Privacy Status</label>
                <select className="select" value={form.privacyStatus} onChange={set("privacyStatus")}>
                  <option value="PUBLIC">Public</option>
                  <option value="UNLISTED">Unlisted</option>
                  <option value="PRIVATE">Private</option>
                </select>
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}
