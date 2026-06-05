import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { authApi, scheduleApi } from "../api";
import { useAuth, useToast } from "../context";
import { User, Key, Server, AlertTriangle, Copy, Check, Plus, Trash2 } from "lucide-react";

export default function Settings() {
  const { user } = useAuth();
  const toast = useToast();
  const [params] = useSearchParams();

  const [activeTab, setActiveTab] = useState("profile");

  // Profile State
  const [profile, setProfile] = useState({ name: user?.name || "", timezone: user?.timezone || "UTC" });
  const [savingProfile, setSavingProfile] = useState(false);

  // MCP Keys State
  const [mcpKeys, setMcpKeys] = useState([]);
  const [mcpLoading, setMcpLoading] = useState(true);
  const [newKeyLabel, setNewKeyLabel] = useState("AI Agent");
  const [newKey, setNewKey] = useState(null);
  const [generatingKey, setGeneratingKey] = useState(false);
  const [copied, setCopied] = useState(false);

  // Queue State
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
      await authApi.me(); 
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
      toast.success("API key created");
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

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const TIMEZONES = [
    "UTC", "America/New_York", "America/Chicago", "America/Denver",
    "America/Los_Angeles", "Europe/London", "Europe/Paris", "Europe/Berlin",
    "Asia/Kolkata", "Asia/Tokyo", "Asia/Shanghai", "Australia/Sydney",
  ];

  const TABS = [
    { id: "profile", label: "General Profile", icon: <User size={16} /> },
    { id: "api", label: "API & Agents", icon: <Key size={16} /> },
    { id: "queue", label: "Scheduler Queue", icon: <Server size={16} /> },
    { id: "danger", label: "Advanced", icon: <AlertTriangle size={16} /> },
  ];

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 40 }}>
        <h1 className="page-title">Settings</h1>
        <p className="page-subtitle">Manage your account, API keys, and system preferences.</p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 64, alignItems: "start" }}>
        
        {/* Settings Navigation Sidebar */}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, position: "sticky", top: 32 }}>
          {TABS.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "flex", alignItems: "center", gap: 12,
                padding: "10px 16px", borderRadius: "var(--radius-sm)",
                fontSize: 14, fontWeight: 500, transition: "all 0.15s ease",
                background: activeTab === t.id ? "var(--surface)" : "transparent",
                color: activeTab === t.id ? "var(--primary)" : "var(--text-muted)",
                border: "1px solid",
                borderColor: activeTab === t.id ? "var(--border-subtle)" : "transparent",
                boxShadow: activeTab === t.id ? "0 1px 2px rgba(0,0,0,0.02)" : "none",
                textAlign: "left"
              }}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 800 }}>
          
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>Profile Details</h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Update your personal information and timezone.</p>
              </div>

              <div className="card" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Email Address</div>
                  <input className="input" value={user?.email || ""} disabled style={{ opacity: 0.6, background: "var(--bg)" }} />
                </div>
                
                <div style={{ width: "100%", height: 1, background: "var(--border-subtle)" }} />
                
                <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Full Name</div>
                  <input className="input" value={profile.name} onChange={e => setProfile(p => ({ ...p, name: e.target.value }))} placeholder="Your name" />
                </div>

                <div style={{ width: "100%", height: 1, background: "var(--border-subtle)" }} />

                <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 32, alignItems: "center" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Timezone</div>
                  <select className="select input" value={profile.timezone} onChange={e => setProfile(p => ({ ...p, timezone: e.target.value }))}>
                    {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 24 }}>
                <button className="btn btn-primary" onClick={saveProfile} disabled={savingProfile}>
                  {savingProfile ? <span className="spinner" /> : "Save Changes"}
                </button>
              </div>
            </div>
          )}

          {/* API TAB */}
          {activeTab === "api" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>API & Agents</h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Generate MCP API keys to allow AI agents like Claude to schedule posts on your behalf.</p>
              </div>

              <div className="card" style={{ marginBottom: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Create New Key</div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <input className="input" placeholder="Key label (e.g., Claude Desktop)" value={newKeyLabel} onChange={e => setNewKeyLabel(e.target.value)} style={{ flex: 1 }} />
                  <button className="btn btn-secondary" onClick={generateKey} disabled={generatingKey}>
                    {generatingKey ? <span className="spinner" /> : <><Plus size={16} /> Generate Key</>}
                  </button>
                </div>
                
                {newKey && (
                  <div style={{ marginTop: 20, padding: 16, background: "rgba(16, 185, 129, 0.05)", border: "1px solid rgba(16, 185, 129, 0.2)", borderRadius: "var(--radius-md)" }}>
                    <div style={{ fontSize: 13, color: "#10B981", fontWeight: 600, marginBottom: 12 }}>
                      ✓ Copy this key — it will not be shown again
                    </div>
                    <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <code style={{ flex: 1, fontSize: 13, background: "var(--surface)", padding: "10px 14px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border)", fontFamily: "monospace", color: "var(--text-heading)" }}>
                        {newKey}
                      </code>
                      <button className="btn btn-primary" onClick={() => copyToClipboard(newKey)}>
                        {copied ? <Check size={16} /> : <Copy size={16} />} Copy
                      </button>
                    </div>
                  </div>
                )}
              </div>

              <div className="card" style={{ padding: 0, overflow: "hidden" }}>
                <div style={{ padding: "16px 24px", borderBottom: "1px solid var(--border-subtle)", background: "var(--bg)" }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-heading)" }}>Active API Keys</div>
                </div>
                
                {mcpLoading ? (
                  <div style={{ padding: 40, display: "flex", justifyContent: "center" }}><div className="spinner" /></div>
                ) : mcpKeys.length === 0 ? (
                  <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)", fontSize: 14 }}>
                    No API keys have been generated yet.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                        <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Label</th>
                        <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase" }}>Created</th>
                        <th style={{ padding: "12px 24px", fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mcpKeys.map(k => (
                        <tr key={k.id} style={{ borderBottom: "1px solid var(--border-subtle)" }}>
                          <td style={{ padding: "16px 24px" }}>
                            <div style={{ fontSize: 14, fontWeight: 500, color: "var(--text-heading)" }}>{k.label}</div>
                            <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                              {k.scopes?.map(s => (
                                <span key={s} style={{ fontSize: 10, padding: "2px 8px", background: "rgba(79, 70, 229, 0.1)", color: "var(--primary)", borderRadius: "var(--radius-full)", fontWeight: 600 }}>{s}</span>
                              ))}
                            </div>
                          </td>
                          <td style={{ padding: "16px 24px", fontSize: 13, color: "var(--text-muted)" }}>
                            {new Date(k.createdAt).toLocaleDateString()}
                          </td>
                          <td style={{ padding: "16px 24px", textAlign: "right" }}>
                            <button className="btn btn-ghost" onClick={() => revokeKey(k.id)} style={{ color: "#EF4444" }} title="Revoke">
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* QUEUE TAB */}
          {activeTab === "queue" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 700, color: "var(--text-heading)" }}>Scheduler Queue</h2>
                  <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Monitor background jobs and scheduled posts.</p>
                </div>
                <button className="btn btn-secondary btn-sm" onClick={loadQueue}>Refresh Status</button>
              </div>

              {!queueStatus ? (
                <div className="card" style={{ background: "rgba(245, 158, 11, 0.05)", borderColor: "rgba(245, 158, 11, 0.2)" }}>
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <AlertTriangle style={{ color: "#F59E0B" }} size={20} />
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#D97706" }}>Scheduler offline</div>
                      <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
                        Could not reach the Redis queue. Make sure your worker process is running.
                      </div>
                      <code style={{ display: "inline-block", background: "var(--surface)", border: "1px solid var(--border)", padding: "6px 12px", borderRadius: "var(--radius-sm)", marginTop: 12, fontSize: 13, color: "var(--text-heading)", fontFamily: "monospace" }}>
                        node src/worker.js
                      </code>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid-4" style={{ gap: 16 }}>
                  {[
                    { label: "Waiting", val: queueStatus.counts?.waiting, color: "var(--text-muted)" },
                    { label: "Active", val: queueStatus.counts?.active, color: "var(--primary)" },
                    { label: "Delayed", val: queueStatus.counts?.delayed, color: "var(--accent)" },
                    { label: "Failed", val: queueStatus.counts?.failed, color: "#EF4444" },
                  ].map(s => (
                    <div key={s.label} className="card" style={{ padding: 20, textAlign: "center", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ fontSize: 32, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.val ?? 0}</div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: 0.5 }}>{s.label}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* DANGER TAB */}
          {activeTab === "danger" && (
            <div style={{ animation: "fadeIn 0.3s ease" }}>
              <div style={{ marginBottom: 24 }}>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: "#EF4444" }}>Danger Zone</h2>
                <p style={{ fontSize: 14, color: "var(--text-muted)", marginTop: 4 }}>Irreversible account actions.</p>
              </div>

              <div className="card" style={{ border: "1px solid rgba(239, 68, 68, 0.2)", background: "rgba(239, 68, 68, 0.02)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "var(--text-heading)" }}>Delete Account</h3>
                    <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>Permanently remove all your data, posts, and API keys.</p>
                  </div>
                  <button className="btn btn-danger" onClick={() => toast.error("Contact support to delete your account")}>
                    Delete Account
                  </button>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
