import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { platformApi } from "../api";
import { useToast } from "../context";
import { Check, Plus, AlertCircle, Info } from "lucide-react";

const PLATFORMS = [
  { key:"YOUTUBE",   label:"YouTube",    icon:"▶",  color:"#FF0000", desc:"Upload and schedule videos, Shorts", available:true },
  { key:"INSTAGRAM", label:"Instagram",  icon:"◈",  color:"#E1306C", desc:"Photos, Reels, Stories (Business)",  available:true },
  { key:"TWITTER",   label:"X / Twitter",icon:"𝕏",  color:"#1DA1F2", desc:"Tweets, threads, media posts",       available:false },
  { key:"LINKEDIN",  label:"LinkedIn",   icon:"in", color:"#0077B5", desc:"Posts, articles, company pages",     available:false },
  { key:"TIKTOK",    label:"TikTok",     icon:"♪",  color:"#69C9D0", desc:"Short videos, series",              available:false },
  { key:"FACEBOOK",  label:"Facebook",   icon:"f",  color:"#1877F2", desc:"Posts, Reels, Stories",             available:false },
  { key:"PINTEREST", label:"Pinterest",  icon:"P",  color:"#E60023", desc:"Pins, boards, idea pins",           available:false },
];

export default function Platforms() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const toast = useToast();
  const [params] = useSearchParams();

  useEffect(() => {
    const connected = params.get("connected");
    const error = params.get("error");
    const msg = params.get("msg");
    if (connected) toast.success(`${connected.charAt(0).toUpperCase() + connected.slice(1)} connected`);
    if (error) toast.error(msg ? decodeURIComponent(msg) : `Failed to connect: ${error}`);

    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    setLoading(true);
    try {
      const res = await platformApi.list();
      setAccounts(res.data.accounts || []);
    } catch { toast.error("Failed to load accounts"); }
    finally { setLoading(false); }
  };

  const connect = async (platform) => {
    setConnecting(platform);
    try {
      let res;
      if (platform === "YOUTUBE") res = await platformApi.connectYoutube();
      else if (platform === "INSTAGRAM") res = await platformApi.connectInstagram();
      else { toast.info("Coming soon"); setConnecting(null); return; }
      window.location.href = res.data.authUrl;
    } catch (err) {
      toast.error(err);
      setConnecting(null);
    }
  };

  const disconnect = async (account) => {
    if (!confirm(`Disconnect ${account.platform}? Scheduled posts won't be cancelled.`)) return;
    setDisconnecting(account.id);
    try {
      await platformApi.disconnect(account.id);
      toast.success("Account disconnected");
      setAccounts(a => a.filter(x => x.id !== account.id));
    } catch { toast.error("Failed to disconnect"); }
    finally { setDisconnecting(null); }
  };

  const connectedMap = {};
  accounts.forEach(a => { connectedMap[a.platform] = a; });

  return (
    <div>
      <div className="page-header" style={{ marginBottom: 40 }}>
        <h1 className="page-title">Integrations</h1>
        <p className="page-subtitle">Connect your social media accounts to enable scheduling and analytics.</p>
      </div>

      {/* Info Banner */}
      <div className="card" style={{ marginBottom: 32, background: "rgba(79, 70, 229, 0.03)", borderColor: "rgba(79, 70, 229, 0.15)", display: "flex", gap: 16, alignItems: "flex-start", padding: 20 }}>
        <Info style={{ color: "var(--primary)" }} size={24} />
        <div>
          <h4 style={{ fontSize: 14, fontWeight: 600, color: "var(--primary)", marginBottom: 4 }}>Instagram Requirements</h4>
          <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Instagram's API strictly requires a Business or Creator account connected to a Facebook Page. Personal accounts cannot be used for scheduling through third-party apps like Flux.
          </p>
        </div>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 120 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 24 }}>
          {PLATFORMS.map(p => {
            const connected = connectedMap[p.key];
            const isConnecting = connecting === p.key;
            const isDisconnecting = connected && disconnecting === connected.id;
            
            return (
              <div 
                key={p.key} 
                className="card" 
                style={{ 
                  display: "flex", flexDirection: "column", 
                  padding: 24, 
                  opacity: p.available ? 1 : 0.6,
                  position: "relative",
                  overflow: "hidden",
                  transition: "transform 0.2s ease, box-shadow 0.2s ease"
                }}
                onMouseEnter={e => {
                  if (p.available) {
                    e.currentTarget.style.transform = "translateY(-4px)";
                    e.currentTarget.style.boxShadow = `0 12px 24px -8px ${p.color}30, 0 4px 12px rgba(0,0,0,0.05)`;
                    e.currentTarget.style.borderColor = `${p.color}50`;
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = "translateY(0)";
                  e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.02)";
                  e.currentTarget.style.borderColor = "var(--border)";
                }}
              >
                {/* Header */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 20 }}>
                  <div style={{ width: 48, height: 48, borderRadius: 12, background: `${p.color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, color: p.color, flexShrink: 0, boxShadow: `inset 0 0 0 1px ${p.color}30` }}>
                    {p.icon}
                  </div>
                  
                  {!p.available ? (
                    <span className="badge" style={{ background: "var(--bg)", border: "1px solid var(--border)", color: "var(--text-placeholder)" }}>Coming Soon</span>
                  ) : connected ? (
                    <span className="badge" style={{ background: "rgba(16, 185, 129, 0.1)", border: "1px solid rgba(16, 185, 129, 0.3)", color: "#059669" }}>
                      <Check size={12} style={{ marginRight: 2 }} /> Connected
                    </span>
                  ) : null}
                </div>

                {/* Content */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: 16, fontWeight: 600, color: "var(--text-heading)", marginBottom: 6 }}>{p.label}</h3>
                  <p style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5, minHeight: 40 }}>{p.desc}</p>
                </div>

                {/* Footer Action */}
                <div style={{ marginTop: 24, paddingTop: 20, borderTop: "1px solid var(--border-subtle)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  {connected ? (
                    <>
                      <div style={{ fontSize: 13, fontWeight: 500, color: "var(--text-heading)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: 160 }}>
                        @{connected.platformUsername || connected.platformUserId}
                      </div>
                      <button 
                        className="btn btn-ghost btn-sm" 
                        onClick={() => disconnect(connected)} 
                        disabled={isDisconnecting}
                        style={{ color: "#EF4444", padding: "6px 12px" }}
                      >
                        {isDisconnecting ? <span className="spinner" /> : "Disconnect"}
                      </button>
                    </>
                  ) : (
                    <>
                      <div style={{ fontSize: 13, color: "var(--text-placeholder)" }}>Not connected</div>
                      <button 
                        className="btn btn-primary btn-sm" 
                        onClick={() => connect(p.key)} 
                        disabled={!p.available || isConnecting}
                        style={{ background: p.available ? p.color : "var(--border)", color: p.available ? "#fff" : "var(--text-muted)" }}
                      >
                        {isConnecting ? <span className="spinner" /> : <><Plus size={14} /> Connect</>}
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
