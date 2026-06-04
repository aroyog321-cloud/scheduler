// MediaLibrary.jsx
import { useState, useEffect, useRef } from "react";
import { mediaApi } from "../api";
import { useToast } from "../context";

export function MediaLibrary() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const fileRef = useRef();
  const toast = useToast();

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try { const res = await mediaApi.list(); setFiles(res.data.files || []); }
    catch { toast.error("Failed to load media"); }
    finally { setLoading(false); }
  };

  const upload = async (file) => {
    setUploading(true); setProgress(0);
    try {
      await mediaApi.upload(file, e => setProgress(Math.round(e.loaded/e.total*100)));
      toast.success("File uploaded");
      load();
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const del = async (id) => {
    if (!confirm("Delete this file?")) return;
    try { await mediaApi.delete(id); setFiles(f => f.filter(x => x.id !== id)); toast.success("Deleted"); }
    catch { toast.error("Delete failed"); }
  };

  return (
    <div className="page">
      <div className="page-header" style={{ display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div>
          <h1 className="page-title">Media Library</h1>
          <p className="page-subtitle">{files.length} files stored</p>
        </div>
        <div>
          <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display:"none" }} onChange={e => e.target.files[0] && upload(e.target.files[0])} />
          <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading}>
            {uploading ? `Uploading ${progress}%` : "＋ Upload File"}
          </button>
        </div>
      </div>

      {loading ? <div style={{ display:"flex", justifyContent:"center", padding:60 }}><div className="spinner" /></div>
      : files.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🗂</div>
          <div className="empty-text">No media files yet</div>
          <div className="empty-sub">Upload videos and images to use in your posts</div>
          <button className="btn btn-primary btn-sm" style={{ marginTop:16 }} onClick={() => fileRef.current?.click()}>Upload First File</button>
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill, minmax(200px,1fr))", gap:14 }}>
          {files.map(f => (
            <div key={f.id} className="card" style={{ padding:0, overflow:"hidden" }}>
              <div style={{ height:120, background:"var(--bg3)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:36 }}>
                {f.mimeType?.startsWith("video") ? "🎬" : "🖼"}
              </div>
              <div style={{ padding:"10px 12px" }}>
                <div style={{ fontSize:12, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{f.originalName}</div>
                <div style={{ fontSize:11, color:"var(--muted)", marginTop:2 }}>
                  {f.mimeType?.split("/")[0]} · {(Number(f.sizeBytes)/1024/1024).toFixed(1)} MB
                </div>
                <button className="btn btn-danger btn-sm" style={{ marginTop:8, width:"100%", justifyContent:"center" }} onClick={() => del(f.id)}>Delete</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
export default MediaLibrary;
