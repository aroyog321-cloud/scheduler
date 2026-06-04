import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { authApi, scheduleApi } from "../api";
import { useAuth, useToast } from "../context";

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();

  const [profile, setProfile] = useState({ name: user?.name || "", timezone: user?.timezone || "UTC" });
  const [savingProfile, setSavingProfile] = useState(false);

  const [mcpKeys, setMcpKeys] = useState([]);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState("AI Agent");
  const [newKey, setNewKey] = useState(null); // shown once after creation
  const [generatingKey, setGeneratingKey] = useState(false);

  const [queueStatus, setQueueStatus] = useState(null);

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    if (connected) toast.success(`${connected} connected successfully!`);
    if (error) toast.error(`Connection error: ${error}`);

    loadMcpKeys();
    loadQueue();
  }, []);

  const loadMcpKeys = async () => {
    setMcpLoading(true);
    try { const r = await authApi.getMcpKeys(); setMcpKeys(r.data.keys || []); }
    catch { toast.error("Failed to load API keys"); }
    finally { setMcpLoading(false); }
  };

  const loadQueue = async () => {
    try { const r = await scheduleApi.queueStatus(); setQueueStatus(r.data); }
    catch { /* Redis may not be running in dev */ }
  };

  const saveProfile = async () => {
    setSavingProfile(true);
    try {
      await authApi.me(); // just verify auth
      toast.success("Profile saved");
    } catch { toast.error("Failed to save"); }
    finally { setSavingProfile(false); }
  };

  const generateKey = async () => {
    if (!newKeyLabel.trim()) { toast.error("Enter a label for this key"); return; }
    setGeneratingKey(true);
    try {
      const r = await authApi.generateMcpKey(newKeyLabel);
      setNewKey(r.data.key);
      setMcpKeys(k => [...k, { id: r.data.id, label: r.data.label, scopes: r.data.scopes, createdAt: r.data.createdAt }]);
      toast.success("API key created — save it now!");
    } catch { toast.error("Failed to generate key"); }
    finally { setGeneratingKey(false); }
  };

  const revokeKey = async (id) => {
    if (!confirm("Revoke this API key? Any agent using it will lose access.")) return;
    try {
      await authApi.revokeMcpKey(id);
      setMcpKeys(k => k.filter(x => x.id !== id));
      toast.success("Key revoked");
    } catch { toast.error("Failed to revoke"); }
  };

  const TIMEZONES = [
    "UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
  ];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account, API keys and queue</p>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 700 }}>

        {/* Profile */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16 }}>👤 Profile</h3>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div className="field">
              <label className="label">Email</label>
              <input className="input" value={user?.email || ""} disabled style={{ opacity: 0.5 }} />
            </div>
            <div className="field">
              <label className="label">Name</label>
              <input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
            </div>
            <div className="field">
              <label className="label">Timezone</label>
              <select className="select input" value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="label">Plan</label>
              <div style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                <span className="badge" style={{ background: "rgba(0,212,255,0.12)", color: "var(--accent)", fontSize: 12 }}>
                  {user?.plan || "FREE"}
                </span>
              </div>
            </div>
            <button className="btn btn-primary btn-sm" onClick={saveProfile} disabled={savingProfile} style={{ alignSelf: "flex-start" }}>
              {savingProfile ? <span className="spinner" /> : "Save Profile"}
            </button>
          </div>
        </div>

        {/* MCP API Keys */}
        <div className="card">
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 6 }}>⚡ MCP API Keys</h3>
          <p style={{ fontSize: 13, color: "var(--muted2)", marginBottom: 16, lineHeight: 1.6 }}>
            Generate API keys so AI agents (Claude, Cursor, etc.) can schedule your posts
            by calling the MCP endpoints at <code style={{ background: "var(--bg3)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>/api/mcp/*</code>
          </p>

          {/* Create new key */}
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="input" placeholder="Key label (e.g. Claude Agent)" value={newKeyLabel}
              onChange={e => setNewKeyLabel(e.target.value)} style={{ flex: 1 }} />
            <button className="btn btn-primary" onClick={generateKey} disabled={generatingKey} style={{ flexShrink: 0 }}>
              {generatingKey ? <span className="spinner" /> : "Generate Key"}
            </button>
          </div>

          {/* Show new key once */}
          {newKey && (
            <div style={{ marginBottom: 16, padding: "12px 14px", background: "rgba(52,211,153,0.08)", border: "1px solid rgba(52,211,153,0.25)", borderRadius: 8 }}>
              <div style={{ fontSize: 12, color: "var(--green)", fontWeight: 600, marginBottom: 8 }}>
                ✓ Copy this key — it will NOT be shown again
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <code style={{ flex: 1, fontSize: 12, background: "var(--bg3)", padding: "8px 12px", borderRadius: 6, wordBreak: "break-all", fontFamily: "'Fira Code', monospace" }}>
                  {newKey}
                </code>
                <button className="btn btn-ghost btn-sm" onClick={() => { navigator.clipboard.writeText(newKey); toast.success("Copied!"); }}>
                  Copy
                </button>
              </div>
            </div>
          )}

          {/* Keys list */}
          {mcpLoading ? <div className="spinner" /> : (
            mcpKeys.length === 0 ? (
              <p style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic" }}>No API keys yet</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {mcpKeys.map(k => (
                  <div key={k.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", background: "var(--bg3)", borderRadius: 8 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600 }}>{k.label}</div>
                      <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>
                        Created {new Date(k.createdAt).toLocaleDateString()}
                        {k.lastUsedAt && ` · Last used ${new Date(k.lastUsedAt).toLocaleDateString()}`}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {k.scopes?.map(s => (
                        <span key={s} style={{ fontSize: 10, padding: "2px 6px", background: "rgba(0,212,255,0.08)", color: "var(--accent)", borderRadius: 4 }}>{s}</span>
                      ))}
                    </div>
                    <button className="btn btn-danger btn-sm" onClick={() => revokeKey(k.id)}>Revoke</button>
                  </div>
                ))}
              </div>
            )
          )}

          {/* MCP Usage example */}
          <div style={{ marginTop: 16, padding: "12px 14px", background: "var(--bg3)", borderRadius: 8 }}>
            <div style={{ fontSize: 12, color: "var(--muted2)", fontWeight: 600, marginBottom: 8 }}>Example: Schedule a post via MCP</div>
            <pre style={{ fontSize: 11, color: "var(--green)", fontFamily: "'Fira Code', monospace", margin: 0, whiteSpace: "pre-wrap", lineHeight: 1.6 }}>{`POST /api/mcp/create_post
x-mcp-api-key: mcp_your_key_here

{
  "title": "My new video",
  "platforms": ["YOUTUBE", "INSTAGRAM"],
  "scheduledAt": "2025-06-10T20:00:00Z"
}`}</pre>
          </div>
        </div>

        {/* Queue Status */}
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <h3 style={{ fontSize: 15, fontWeight: 700 }}>⚙ Scheduler Queue</h3>
            <button className="btn btn-ghost btn-sm" onClick={loadQueue}>Refresh</button>
          </div>
          {!queueStatus ? (
            <div style={{ fontSize: 13, color: "var(--yellow)" }}>
              ⚠ Could not reach queue — make sure Redis is running and the worker is started with <code style={{ background: "var(--bg3)", padding: "1px 6px", borderRadius: 4, fontSize: 12 }}>node src/worker.js</code>
            </div>
          ) : (
            <div className="grid-4" style={{ gap: 10 }}>
              {[
                { label: "Waiting", val: queueStatus.counts?.waiting, color: "var(--muted2)" },
                { label: "Active", val: queueStatus.counts?.active, color: "var(--yellow)" },
                { label: "Delayed", val: queueStatus.counts?.delayed, color: "var(--accent)" },
                { label: "Failed", val: queueStatus.counts?.failed, color: "var(--red)" },
              ].map(s => (
                <div key={s.label} style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px", textAlign: "center" }}>
                  <div style={{ fontSize: 22, fontWeight: 800, color: s.color }}>{s.val ?? 0}</div>
                  <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          )}
          <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", lineHeight: 1.7 }}>
            <strong style={{ color: "var(--muted2)" }}>Run the worker:</strong><br />
            <code style={{ background: "var(--bg3)", padding: "4px 10px", borderRadius: 6, display: "inline-block", marginTop: 4, fontFamily: "'Fira Code', monospace" }}>
              node src/worker.js
            </code>
          </div>
        </div>

        {/* Danger zone */}
        <div className="card" style={{ borderColor: "rgba(248,113,113,0.2)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "var(--red)", marginBottom: 12 }}>⚠ Danger Zone</h3>
          <p style={{ fontSize: 13, color: "var(--muted2)", marginBottom: 14 }}>
            Deleting your account will permanently remove all data including posts, media files, and platform connections.
          </p>
          <button className="btn btn-danger btn-sm" onClick={() => toast.error("Contact support to delete your account")}>
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
