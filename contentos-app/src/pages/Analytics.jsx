import { useState, useEffect } from "react";
import { analyticsApi, platformApi } from "../api";
import { useToast } from "../context";

function StatBox({ label, value, color = "var(--accent)", sub }) {
  return (
    <div className="card" style={{ textAlign: "center" }}>
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: -1 }}>{value ?? "—"}</div>
      <div style={{ fontSize: 13, fontWeight: 600, marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: "var(--muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function Analytics() {
  const [overview, setOverview] = useState(null);
  const [platforms, setPlatforms] = useState([]);
  const [ytData, setYtData] = useState(null);
  const [igData, setIgData] = useState(null);
  const [activity, setActivity] = useState({});
  const [loading, setLoading] = useState(true);
  const toast = useToast();

  useEffect(() => {
    Promise.all([
      analyticsApi.overview().catch(() => null),
      platformApi.list().catch(() => null),
      analyticsApi.activity().catch(() => null),
    ]).then(([ov, pl, act]) => {
      if (ov) setOverview(ov.data.overview);
      if (pl) {
        const accs = pl.data.accounts || [];
        setPlatforms(accs);
        // Fetch platform-specific analytics if connected
        if (accs.find(a => a.platform === "YOUTUBE")) {
          analyticsApi.youtube().then(r => setYtData(r.data.analytics)).catch(() => {});
        }
        if (accs.find(a => a.platform === "INSTAGRAM")) {
          analyticsApi.instagram().then(r => setIgData(r.data.analytics)).catch(() => {});
        }
      }
      if (act) setActivity(act.data.activity || {});
    }).finally(() => setLoading(false));
  }, []);

  // Build activity heatmap (last 12 weeks)
  const heatmapCells = (() => {
    const cells = [];
    const today = new Date();
    for (let i = 83; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split("T")[0];
      cells.push({ date: key, count: activity[key] || 0 });
    }
    return cells;
  })();

  const maxActivity = Math.max(1, ...heatmapCells.map(c => c.count));

  const platformBreakdown = overview?.platformBreakdown || [];

  return (
    <div className="page">
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <p className="page-subtitle">Your content performance overview</p>
      </div>

      {loading ? (
        <div style={{ display: "flex", justifyContent: "center", padding: 60 }}>
          <div className="spinner" />
        </div>
      ) : (
        <>
          {/* Overview stats */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <StatBox label="Total Published" value={overview?.publishedPosts ?? 0} color="var(--green)" />
            <StatBox label="Scheduled" value={overview?.scheduledPosts ?? 0} color="var(--accent)" />
            <StatBox label="Failed" value={overview?.failedPosts ?? 0} color="var(--red)" />
            <StatBox label="Success Rate" value={`${overview?.successRate ?? 0}%`} color="var(--yellow)" />
          </div>

          {/* Activity heatmap */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
              📊 Publishing Activity — Last 12 Weeks
            </div>
            <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
              {heatmapCells.map((cell) => {
                const intensity = cell.count === 0 ? 0 : Math.max(0.15, cell.count / maxActivity);
                return (
                  <div
                    key={cell.date}
                    title={`${cell.date}: ${cell.count} post${cell.count !== 1 ? "s" : ""}`}
                    style={{
                      width: 12, height: 12, borderRadius: 2,
                      background: cell.count === 0
                        ? "rgba(255,255,255,0.06)"
                        : `rgba(0,212,255,${intensity})`,
                      cursor: "default",
                    }}
                  />
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 6, alignItems: "center", marginTop: 10 }}>
              <span style={{ fontSize: 11, color: "var(--muted)" }}>Less</span>
              {[0, 0.2, 0.4, 0.7, 1].map(o => (
                <div key={o} style={{ width: 10, height: 10, borderRadius: 2, background: o === 0 ? "rgba(255,255,255,0.06)" : `rgba(0,212,255,${o})` }} />
              ))}
              <span style={{ fontSize: 11, color: "var(--muted)" }}>More</span>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Platform breakdown */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Posts by Platform</div>
              {platformBreakdown.length === 0 ? (
                <div className="empty" style={{ padding: "20px 0" }}>
                  <div className="empty-text" style={{ fontSize: 13 }}>No published posts yet</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {platformBreakdown.map(row => {
                    const COLORS = { YOUTUBE: "#FF0000", INSTAGRAM: "#E1306C", TWITTER: "#1DA1F2", LINKEDIN: "#0077B5", TIKTOK: "#69C9D0", FACEBOOK: "#1877F2", PINTEREST: "#E60023" };
                    const color = COLORS[row.platform] || "#888";
                    const total = platformBreakdown.reduce((s, r) => s + r.count, 0);
                    const pct = total > 0 ? Math.round((row.count / total) * 100) : 0;
                    return (
                      <div key={row.platform}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 500 }}>{row.platform}</span>
                          <span style={{ fontSize: 12, color: "var(--muted2)" }}>{row.count} ({pct}%)</span>
                        </div>
                        <div style={{ height: 6, background: "var(--bg3)", borderRadius: 3, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pct}%`, background: color, borderRadius: 3, transition: "width 0.5s" }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* YouTube analytics */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                ▶ YouTube (Last 30 Days)
              </div>
              {!platforms.find(p => p.platform === "YOUTUBE") ? (
                <div className="empty" style={{ padding: "20px 0" }}>
                  <div className="empty-text" style={{ fontSize: 13 }}>YouTube not connected</div>
                </div>
              ) : ytData?.rows ? (
                <div>
                  {/* Sum totals */}
                  {(() => {
                    const totals = ytData.rows.reduce((acc, row) => ({
                      views: (acc.views || 0) + (row[1] || 0),
                      watchTime: (acc.watchTime || 0) + (row[2] || 0),
                      likes: (acc.likes || 0) + (row[4] || 0),
                      subs: (acc.subs || 0) + (row[6] || 0),
                    }), {});
                    return (
                      <div className="grid-2" style={{ gap: 10 }}>
                        {[
                          { label: "Views", val: totals.views?.toLocaleString() },
                          { label: "Watch Hours", val: Math.round((totals.watchTime || 0) / 60) + "h" },
                          { label: "Likes", val: totals.likes?.toLocaleString() },
                          { label: "New Subs", val: `+${totals.subs?.toLocaleString()}` },
                        ].map(s => (
                          <div key={s.label} style={{ background: "var(--bg3)", borderRadius: 8, padding: "10px 14px", textAlign: "center" }}>
                            <div style={{ fontSize: 20, fontWeight: 800, color: "#FF0000" }}>{s.val || "0"}</div>
                            <div style={{ fontSize: 11, color: "var(--muted2)", marginTop: 2 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 13, padding: "10px 0" }}>
                  {ytData ? "No data for this period" : "Loading YouTube data…"}
                </div>
              )}
            </div>

            {/* Instagram analytics */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>
                ◈ Instagram Insights
              </div>
              {!platforms.find(p => p.platform === "INSTAGRAM") ? (
                <div className="empty" style={{ padding: "20px 0" }}>
                  <div className="empty-text" style={{ fontSize: 13 }}>Instagram not connected</div>
                </div>
              ) : igData?.data ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {igData.data.map(metric => (
                    <div key={metric.name} style={{ display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
                      <span style={{ fontSize: 13, color: "var(--muted2)", textTransform: "capitalize" }}>{metric.name.replace(/_/g, " ")}</span>
                      <span style={{ fontSize: 13, fontWeight: 600, color: "#E1306C" }}>
                        {metric.values?.slice(-1)[0]?.value?.toLocaleString() ?? "—"}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--muted2)", fontSize: 13, padding: "10px 0" }}>
                  {igData ? "No insights available" : "Loading Instagram data…"}
                </div>
              )}
            </div>

            {/* Connected platforms summary */}
            <div className="card">
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 16 }}>Connected Accounts</div>
              {platforms.length === 0 ? (
                <div className="empty" style={{ padding: "20px 0" }}>
                  <div className="empty-text" style={{ fontSize: 13 }}>No platforms connected</div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {platforms.map(p => {
                    const COLORS = { YOUTUBE: "#FF0000", INSTAGRAM: "#E1306C", TWITTER: "#1DA1F2", LINKEDIN: "#0077B5", TIKTOK: "#69C9D0", FACEBOOK: "#1877F2", PINTEREST: "#E60023" };
                    return (
                      <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "var(--bg3)", borderRadius: 8 }}>
                        <div style={{ width: 8, height: 8, borderRadius: "50%", background: COLORS[p.platform] || "#888", flexShrink: 0 }} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>{p.platform}</div>
                          <div style={{ fontSize: 11, color: "var(--muted)" }}>@{p.platformUsername || p.platformUserId}</div>
                        </div>
                        <span className="badge badge-published" style={{ fontSize: 10 }}>Active</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
