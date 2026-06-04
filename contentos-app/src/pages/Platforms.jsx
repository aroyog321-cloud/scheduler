import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { platformApi } from "../api";
import { useToast } from "../context";

const PLATFORMS = [
  { key:"YOUTUBE",   label:"YouTube",    icon:"▶",  color:"#FF0000", desc:"Upload and schedule videos, Shorts",       available:true },
  { key:"INSTAGRAM", label:"Instagram",  icon:"◈",  color:"#E1306C", desc:"Photos, Reels, Stories (Business/Creator)", available:true },
  { key:"TWITTER",   label:"X / Twitter",icon:"𝕏",  color:"#1DA1F2", desc:"Tweets, threads, media posts",             available:false },
  { key:"LINKEDIN",  label:"LinkedIn",   icon:"in", color:"#0077B5", desc:"Posts, articles, company pages",           available:false },
  { key:"TIKTOK",    label:"TikTok",     icon:"♪",  color:"#69C9D0", desc:"Short videos, series",                    available:false },
  { key:"FACEBOOK",  label:"Facebook",   icon:"f",  color:"#1877F2", desc:"Posts, Reels, Stories",                   available:false },
  { key:"PINTEREST", label:"Pinterest",  icon:"P",  color:"#E60023", desc:"Pins, boards, idea pins",                 available:false },
];

export default function Platforms() {
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(null);
  const [disconnecting, setDisconnecting] = useState(null);
  const toast = useToast();
  const [params] = useSearchParams();

  useEffect(() => {
    // Handle OAuth callback result
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
      <div className="page-header">
        <h1 className="page-title">Accounts</h1>
        <p className="page-subtitle">Manage your connected social platforms.</p>
      </div>

      {loading ? (
        <div style={{ display:"flex", justifyContent:"center", padding:120 }}><div className="spinner" /></div>
      ) : (
        <div style={{ display:"flex", flexDirection:"column", gap:16, maxWidth: 800 }}>
          {PLATFORMS.map(p => {
            const connected = connectedMap[p.key];
            return (
              <div key={p.key} className="card" style={{ display:"flex", alignItems:"center", gap:24, opacity: p.available ? 1 : 0.5, padding: "24px 32px" }}>
                {/* Platform icon */}
                <div style={{ width:48, height:48, borderRadius:"50%", background:p.available ? "var(--surface)" : "var(--bg)", border: "1px solid var(--border)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, color:p.color, fontWeight:400, flexShrink:0 }}>
                  {p.icon}
                </div>
                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                    <span style={{ fontSize:16, fontWeight:500, color: "var(--text)" }}>{p.label}</span>
                    {!p.available && <span className="badge">Coming Soon</span>}
                  </div>
                  <div style={{ fontSize:14, color:"var(--text-muted)", marginTop:4, fontWeight:300 }}>{p.desc}</div>
                  {connected && (
                    <div style={{ fontSize:13, color:"var(--text)", fontWeight:500, marginTop:12, display: "inline-flex", alignItems: "center", gap: 8 }}>
                      <span style={{ color: "#2E7D32" }}>●</span> Connected as @{connected.platformUsername || connected.platformUserId}
                    </div>
                  )}
                </div>
                {/* Action */}
                {connected ? (
                  <button
                    className="btn btn-secondary btn-sm"
                    onClick={() => disconnect(connected)}
                    disabled={disconnecting === connected.id}
                    style={{ borderRadius: "var(--radius-full)" }}
                  >
                    {disconnecting === connected.id ? <span className="spinner" /> : "Disconnect"}
                  </button>
                ) : (
                  <button
                    className="btn btn-primary btn-sm"
                    onClick={() => connect(p.key)}
                    disabled={!p.available || connecting === p.key}
                    style={{ borderRadius: "var(--radius-full)" }}
                  >
                    {connecting === p.key ? <span className="spinner" /> : "Connect"}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Instagram note */}
      <div className="card" style={{ marginTop:48, maxWidth: 800, padding: 32 }}>
        <h4 style={{ fontSize:15, fontWeight:500, marginBottom:8 }}>Instagram Requirements</h4>
        <p style={{ fontSize:14, color:"var(--text-muted)", lineHeight:1.6, fontWeight:300 }}>
          Instagram's API requires a Business or Creator account connected to a Facebook Page.
          Personal accounts cannot be used for scheduling.
        </p>
      </div>
    </div>
  );
}
