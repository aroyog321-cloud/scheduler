import { useState, useEffect, useRef } from "react";
import { mediaApi } from "../api";
import { useToast } from "../context";
import { FileText, Play, Image as ImageIcon, Folder, Hash, Search, Trash2, Edit3, X, DownloadCloud } from "lucide-react";
import ConfirmModal from "../components/ConfirmModal";

export function MediaLibrary() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  
  // Notion-style states
  const [selectedFolder, setSelectedFolder] = useState("All");
  const [selectedTag, setSelectedTag] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFile, setActiveFile] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(null);

  const fileRef = useRef();
  const toast = useToast();

  useEffect(() => { load(); }, [selectedFolder, selectedTag]);

  const load = async () => {
    setLoading(true);
    try { 
      const params = { limit: 50 };
      if (selectedFolder !== "All") params.folder = selectedFolder;
      if (selectedTag) params.tag = selectedTag;
      const res = await mediaApi.list(params); 
      setFiles(res.data.files || []); 
    }
    catch { toast.error("Failed to load media"); }
    finally { setLoading(false); }
  };

  const upload = async (file) => {
    setUploading(true); setProgress(0);
    try {
      await mediaApi.upload(file, e => setProgress(Math.round(e.loaded/e.total*100)));
      toast.success("File uploaded. AI is analyzing...");
      // Add slight delay to let AI worker finish tagging
      setTimeout(load, 2500);
    } catch { toast.error("Upload failed"); }
    finally { setUploading(false); }
  };

  const requestDelete = (file) => {
    setConfirmDelete(file);
  };

  const handleDeleteConfirm = async () => {
    if (!confirmDelete) return;
    const id = confirmDelete.id;
    setConfirmDelete(null);
    try { 
      await mediaApi.delete(id); 
      setFiles(f => f.filter(x => x.id !== id)); 
      if (activeFile?.id === id) setActiveFile(null);
      toast.success("Deleted"); 
    }
    catch { toast.error("Delete failed"); }
  };

  const updateFile = async (id, data) => {
    try {
      const res = await mediaApi.update(id, data);
      setFiles(files.map(f => f.id === id ? res.data.file : f));
      if (activeFile?.id === id) setActiveFile(res.data.file);
      toast.success("Updated");
    } catch {
      toast.error("Update failed");
    }
  };

  // Extract all unique tags
  const allTags = [...new Set(files.flatMap(f => f.tags || []))].slice(0, 15);
  const filteredFiles = files.filter(f => f.originalName.toLowerCase().includes(searchQuery.toLowerCase()));

  return (
    <div style={{ display: "flex", height: "calc(100vh - 64px)", overflow: "hidden", margin: "-32px -48px", background: "var(--bg)" }}>
      
      {/* ── Left Sidebar (Notion style) ── */}
      <div style={{ width: 260, background: "var(--surface)", borderRight: "1px solid var(--border-subtle)", padding: "24px 16px", display: "flex", flexDirection: "column", gap: 24, overflowY: "auto" }}>
        
        <div>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingLeft: 12 }}>Folders</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {["All", "Images", "Videos", "Campaigns"].map(folder => (
              <button
                key={folder}
                onClick={() => { setSelectedFolder(folder); setSelectedTag(null); }}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 6,
                  background: selectedFolder === folder && !selectedTag ? "rgba(79, 70, 229, 0.08)" : "transparent",
                  color: selectedFolder === folder && !selectedTag ? "var(--primary)" : "var(--text-heading)",
                  fontWeight: selectedFolder === folder && !selectedTag ? 600 : 500,
                  fontSize: 14, cursor: "pointer", border: "none", textAlign: "left", transition: "background 0.15s"
                }}
              >
                <Folder size={16} style={{ color: selectedFolder === folder && !selectedTag ? "var(--primary)" : "var(--text-muted)" }} />
                {folder}
              </button>
            ))}
          </div>
        </div>

        <div>
          <h2 style={{ fontSize: 12, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 12, paddingLeft: 12 }}>Smart Tags</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {allTags.map(tag => (
              <button
                key={tag}
                onClick={() => setSelectedTag(tag)}
                style={{
                  display: "flex", alignItems: "center", gap: 10, padding: "6px 12px", borderRadius: 6,
                  background: selectedTag === tag ? "rgba(79, 70, 229, 0.08)" : "transparent",
                  color: selectedTag === tag ? "var(--primary)" : "var(--text-heading)",
                  fontWeight: selectedTag === tag ? 600 : 500,
                  fontSize: 13, cursor: "pointer", border: "none", textAlign: "left", transition: "background 0.15s"
                }}
              >
                <Hash size={14} style={{ color: selectedTag === tag ? "var(--primary)" : "var(--text-muted)" }} />
                {tag}
              </button>
            ))}
            {allTags.length === 0 && <div style={{ paddingLeft: 12, fontSize: 12, color: "var(--text-disabled)" }}>Upload images to generate tags</div>}
          </div>
        </div>
      </div>

      {/* ── Main Content Area ── */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        
        {/* Header Toolbar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "24px 32px", borderBottom: "1px solid var(--border-subtle)", background: "var(--surface)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <h1 style={{ fontSize: 20, fontWeight: 600, color: "var(--text-heading)" }}>
              {selectedTag ? `#${selectedTag}` : selectedFolder}
            </h1>
            <div style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 500, padding: "2px 8px", background: "var(--bg)", borderRadius: 12 }}>
              {files.length} items
            </div>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
              <input 
                className="input" 
                placeholder="Search files..." 
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{ paddingLeft: 36, width: 240, borderRadius: "var(--radius-full)", background: "var(--bg)", border: "1px solid var(--border-subtle)" }}
              />
            </div>
            
            <input ref={fileRef} type="file" accept="video/*,image/*" style={{ display: "none" }} onChange={e => e.target.files[0] && upload(e.target.files[0])} />
            <button className="btn btn-primary" onClick={() => fileRef.current?.click()} disabled={uploading} style={{ padding: "8px 16px", borderRadius: "var(--radius-full)" }}>
              {uploading ? `Uploading ${progress}%` : <><DownloadCloud size={16} /> Upload</>}
            </button>
          </div>
        </div>

        {/* Gallery Grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: 32 }}>
          {loading ? (
            <div style={{ display: "flex", justifyContent: "center", padding: 60 }}><div className="spinner" style={{ color: "var(--primary)", width: 32, height: 32 }} /></div>
          ) : filteredFiles.length === 0 ? (
            <div className="empty" style={{ marginTop: 40, border: "1px dashed var(--border-subtle)", background: "transparent" }}>
              <div className="empty-icon" style={{ background: "var(--surface)" }}><ImageIcon size={32} color="var(--text-placeholder)" /></div>
              <div className="empty-text">No media found</div>
              <div className="empty-subtext">Drop files here or click upload to add assets</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 24 }}>
              {filteredFiles.map(f => {
                const isVideo = f.mimeType?.startsWith("video");
                return (
                  <div 
                    key={f.id} 
                    className="card" 
                    onClick={() => setActiveFile(f)}
                    style={{ 
                      padding: 0, overflow: "hidden", cursor: "pointer",
                      border: activeFile?.id === f.id ? "2px solid var(--primary)" : "1px solid var(--border-subtle)",
                      transition: "all 0.2s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "translateY(-4px)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
                  >
                    <div style={{ height: 160, background: "var(--bg)", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {f.thumbnail ? (
                        <img src={f.thumbnail} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : isVideo ? (
                        <Play size={32} style={{ color: "var(--text-placeholder)" }} />
                      ) : (
                        <ImageIcon size={32} style={{ color: "var(--text-placeholder)" }} />
                      )}
                      {f.tags?.length > 0 && (
                        <div style={{ position: "absolute", bottom: 8, left: 8, display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {f.tags.slice(0, 2).map(t => (
                            <span key={t} style={{ background: "rgba(0,0,0,0.6)", color: "#fff", fontSize: 10, padding: "2px 6px", borderRadius: 4, backdropFilter: "blur(4px)" }}>{t}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: "12px 16px" }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{f.originalName}</div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 4 }}>
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>{(Number(f.sizeBytes)/1024/1024).toFixed(1)} MB</span>
                        <span style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>{f.mimeType?.split("/")[1] || "File"}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Slide-over Detail Panel ── */}
        {activeFile && (
          <div style={{ 
            position: "absolute", top: 0, right: 0, bottom: 0, width: 360, 
            background: "var(--surface)", borderLeft: "1px solid var(--border-subtle)",
            boxShadow: "-10px 0 30px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column",
            animation: "slideInRight 0.2s ease-out"
          }}>
            <div style={{ padding: "20px 24px", borderBottom: "1px solid var(--border-subtle)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)" }}>File Details</h3>
              <button className="btn btn-ghost" style={{ padding: 6 }} onClick={() => setActiveFile(null)}><X size={16} /></button>
            </div>
            
            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ width: "100%", height: 200, background: "var(--bg)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", border: "1px solid var(--border-subtle)" }}>
                {activeFile.thumbnail ? <img src={activeFile.thumbnail} style={{ width: "100%", height: "100%", objectFit: "contain" }} alt="" /> : <FileText size={40} color="var(--text-placeholder)" />}
              </div>

              <div className="field">
                <label className="label">Filename</label>
                <div style={{ display: "flex", gap: 8 }}>
                  <input 
                    className="input" 
                    value={activeFile.originalName} 
                    onChange={e => setActiveFile({...activeFile, originalName: e.target.value})}
                    onBlur={(e) => updateFile(activeFile.id, { originalName: e.target.value })}
                  />
                </div>
              </div>

              <div className="field">
                <label className="label">Folder</label>
                <select 
                  className="select input" 
                  value={activeFile.folder || "All"}
                  onChange={e => updateFile(activeFile.id, { folder: e.target.value })}
                >
                  {["All", "Images", "Videos", "Campaigns"].map(f => <option key={f} value={f}>{f}</option>)}
                </select>
              </div>

              <div className="field">
                <label className="label">AI Generated Tags</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, padding: "12px", background: "var(--bg)", borderRadius: 8, border: "1px dashed var(--border-subtle)" }}>
                  {activeFile.tags?.map(t => (
                    <span key={t} style={{ background: "var(--surface)", color: "var(--primary)", fontSize: 12, padding: "4px 10px", borderRadius: "var(--radius-full)", border: "1px solid rgba(79, 70, 229, 0.2)", display: "flex", alignItems: "center", gap: 4 }}>
                      #{t}
                    </span>
                  ))}
                  {(!activeFile.tags || activeFile.tags.length === 0) && <span style={{ fontSize: 13, color: "var(--text-muted)" }}>No tags available.</span>}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 6 }}>Tags are generated automatically upon upload using Gemini Vision.</div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 12 }}>
                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Size</span> <span style={{ fontWeight: 500, color: "var(--text-heading)" }}>{(Number(activeFile.sizeBytes)/1024/1024).toFixed(2)} MB</span>
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", display: "flex", justifyContent: "space-between" }}>
                  <span>Uploaded</span> <span style={{ fontWeight: 500, color: "var(--text-heading)" }}>{new Date(activeFile.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            <div style={{ padding: "20px 24px", borderTop: "1px solid var(--border-subtle)", background: "var(--bg)" }}>
              <button className="btn btn-danger" style={{ width: "100%", justifyContent: "center" }} onClick={() => requestDelete(activeFile)}>
                <Trash2 size={16} /> Delete File
              </button>
            </div>
          </div>
        )}

      </div>

      <ConfirmModal 
        isOpen={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete this file?"
        message={`Are you sure you want to delete "${confirmDelete?.originalName}"? This action cannot be undone.`}
        confirmText="Delete"
        isDestructive={true}
      />
    </div>
  );
}

export default MediaLibrary;
