import { useState } from "react";
import { scheduleApi } from "../api";
import { useToast } from "../context";

const TONES = ["engaging", "professional", "casual", "motivational", "humorous", "educational"];
const STYLES = ["shorter", "longer", "formal", "casual", "question"];
const PLATFORMS = ["YOUTUBE","INSTAGRAM","TWITTER","LINKEDIN","TIKTOK"];

export default function AiStudio() {
  const toast = useToast();

  // Generate full content
  const [genTopic, setGenTopic] = useState("");
  const [genTone, setGenTone] = useState("engaging");
  const [genPlatforms, setGenPlatforms] = useState(["YOUTUBE","INSTAGRAM"]);
  const [genLoading, setGenLoading] = useState(false);
  const [genResult, setGenResult] = useState(null);

  // Rewrite caption
  const [rwCaption, setRwCaption] = useState("");
  const [rwStyle, setRwStyle] = useState("shorter");
  const [rwLoading, setRwLoading] = useState(false);
  const [rwResult, setRwResult] = useState("");

  // Hashtags
  const [htTopic, setHtTopic] = useState("");
  const [htPlatform, setHtPlatform] = useState("INSTAGRAM");
  const [htLoading, setHtLoading] = useState(false);
  const [htResult, setHtResult] = useState([]);

  const generate = async () => {
    if (!genTopic) { toast.error("Enter a topic"); return; }
    setGenLoading(true); setGenResult(null);
    try {
      const res = await scheduleApi.aiGenerate(genTopic, genTone, genPlatforms);
      setGenResult(res.data.generated);
      toast.success("Content generated!");
    } catch { toast.error("AI generation failed. Check GEMINI_API_KEY in backend .env"); }
    finally { setGenLoading(false); }
  };

  const rewrite = async () => {
    if (!rwCaption) { toast.error("Enter a caption to rewrite"); return; }
    setRwLoading(true);
    try {
      const res = await scheduleApi.aiCaption({ caption: rwCaption, style: rwStyle });
      setRwResult(res.data.caption);
    } catch { toast.error("Rewrite failed"); }
    finally { setRwLoading(false); }
  };

  const hashtags = async () => {
    if (!htTopic) { toast.error("Enter a topic"); return; }
    setHtLoading(true);
    try {
      const res = await scheduleApi.aiHashtags(htTopic, htPlatform);
      setHtResult(res.data.hashtags || []);
    } catch { toast.error("Hashtag generation failed"); }
    finally { setHtLoading(false); }
  };

  const copy = (text) => { navigator.clipboard.writeText(text); toast.success("Copied!"); };

  const togglePlatform = (p) => setGenPlatforms(prev => prev.includes(p) ? prev.filter(x=>x!==p) : [...prev, p]);

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">✦ AI Studio</h1>
        <p className="page-subtitle">Generate titles, captions, hashtags and more using AI</p>
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:20 }}>

        {/* Generate full content */}
        <div className="card" style={{ gridColumn:"1/-1" }}>
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>🎯 Generate Full Post Content</h3>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
            <div className="field" style={{ gridColumn:"1/-1" }}>
              <label className="label">Topic / Subject</label>
              <input className="input" placeholder="e.g. morning workout routine, AI tools for productivity…" value={genTopic} onChange={e => setGenTopic(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Tone</label>
              <select className="select input" value={genTone} onChange={e => setGenTone(e.target.value)}>
                {TONES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Platforms</label>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {PLATFORMS.map(p => (
                  <button key={p} className="btn btn-ghost btn-sm" onClick={() => togglePlatform(p)}
                    style={{ fontSize:11, background: genPlatforms.includes(p) ? "rgba(0,212,255,0.12)" : undefined, borderColor: genPlatforms.includes(p) ? "rgba(0,212,255,0.3)" : undefined, color: genPlatforms.includes(p) ? "var(--accent)" : undefined }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button className="btn btn-primary" style={{ marginTop:16 }} onClick={generate} disabled={genLoading}>
            {genLoading ? <><span className="spinner" /> Generating…</> : "✦ Generate Content"}
          </button>

          {genResult && (
            <div style={{ marginTop:20, display:"flex", flexDirection:"column", gap:12 }}>
              {[
                { label:"YouTube Title", val:genResult.title, key:"title" },
                { label:"Caption", val:genResult.caption, key:"caption" },
                { label:"Description", val:genResult.description, key:"description" },
              ].filter(r => r.val).map(r => (
                <div key={r.key} style={{ background:"var(--bg3)", borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:6 }}>
                    <span style={{ fontSize:11, color:"var(--muted2)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>{r.label}</span>
                    <button className="btn btn-ghost btn-sm" style={{ padding:"2px 8px", fontSize:11 }} onClick={() => copy(r.val)}>Copy</button>
                  </div>
                  <div style={{ fontSize:13, color:"var(--text)", lineHeight:1.6 }}>{r.val}</div>
                </div>
              ))}
              {genResult.hashtags?.length > 0 && (
                <div style={{ background:"var(--bg3)", borderRadius:8, padding:"12px 14px" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:8 }}>
                    <span style={{ fontSize:11, color:"var(--muted2)", fontWeight:600, textTransform:"uppercase", letterSpacing:0.5 }}>Hashtags</span>
                    <button className="btn btn-ghost btn-sm" style={{ padding:"2px 8px", fontSize:11 }} onClick={() => copy(genResult.hashtags.map(h=>`#${h}`).join(" "))}>Copy All</button>
                  </div>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                    {genResult.hashtags.map(h => (
                      <span key={h} style={{ fontSize:12, padding:"3px 10px", background:"rgba(0,212,255,0.08)", color:"var(--accent)", borderRadius:20 }}>#{h}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Rewrite caption */}
        <div className="card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}>✏️ Rewrite Caption</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div className="field">
              <label className="label">Original Caption</label>
              <textarea className="textarea" placeholder="Paste your caption here…" value={rwCaption} onChange={e => setRwCaption(e.target.value)} rows={4} />
            </div>
            <div className="field">
              <label className="label">Style</label>
              <select className="select input" value={rwStyle} onChange={e => setRwStyle(e.target.value)}>
                {STYLES.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase()+s.slice(1)}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={rewrite} disabled={rwLoading}>
              {rwLoading ? <span className="spinner" /> : "Rewrite"}
            </button>
            {rwResult && (
              <div style={{ background:"var(--bg3)", borderRadius:8, padding:"12px", position:"relative" }}>
                <p style={{ fontSize:13, lineHeight:1.6 }}>{rwResult}</p>
                <button className="btn btn-ghost btn-sm" style={{ position:"absolute", top:8, right:8, fontSize:11, padding:"2px 8px" }} onClick={() => copy(rwResult)}>Copy</button>
              </div>
            )}
          </div>
        </div>

        {/* Hashtag generator */}
        <div className="card">
          <h3 style={{ fontSize:15, fontWeight:700, marginBottom:14 }}># Hashtag Generator</h3>
          <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
            <div className="field">
              <label className="label">Topic</label>
              <input className="input" placeholder="e.g. fitness motivation" value={htTopic} onChange={e => setHtTopic(e.target.value)} />
            </div>
            <div className="field">
              <label className="label">Platform</label>
              <select className="select input" value={htPlatform} onChange={e => setHtPlatform(e.target.value)}>
                {PLATFORMS.map(p => <option key={p} value={p}>{p}</option>)}
              </select>
            </div>
            <button className="btn btn-primary btn-sm" onClick={hashtags} disabled={htLoading}>
              {htLoading ? <span className="spinner" /> : "Generate Hashtags"}
            </button>
            {htResult.length > 0 && (
              <div>
                <div style={{ display:"flex", justifyContent:"flex-end", marginBottom:6 }}>
                  <button className="btn btn-ghost btn-sm" style={{ fontSize:11, padding:"2px 8px" }} onClick={() => copy(htResult.map(h=>`#${h}`).join(" "))}>Copy All</button>
                </div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6 }}>
                  {htResult.map(h => (
                    <span key={h} style={{ fontSize:12, padding:"3px 10px", background:"rgba(167,139,250,0.1)", color:"var(--purple)", borderRadius:20, cursor:"pointer" }}
                      onClick={() => copy(`#${h}`)}>#{h}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
