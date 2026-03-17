import { useState, useEffect, useRef, useCallback } from "react";

// Vercel proxy - CORS sorunu yok, direkt Polymarket API'sine bağlanır
const API = "/api/polymarket";

const CATEGORIES = ["OVERALL","POLITICS","SPORTS","CRYPTO","CULTURE","ECONOMICS","TECH","FINANCE"];
const PERIODS = ["DAY","WEEK","MONTH","ALL"];

function formatUSD(v) {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return (v < 0 ? "-" : "") + "$" + (abs/1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return (v < 0 ? "-" : "") + "$" + (abs/1_000).toFixed(1) + "K";
  return (v < 0 ? "-$" : "$") + abs.toFixed(0);
}

function timeAgo(ts) {
  if (!ts) return "";
  const diff = Date.now() - new Date(ts).getTime();
  const s = Math.floor(diff / 1000);
  if (s < 60) return s + "s önce";
  if (s < 3600) return Math.floor(s / 60) + "dk önce";
  if (s < 86400) return Math.floor(s / 3600) + "sa önce";
  return Math.floor(s / 86400) + "g önce";
}

function PnlBadge({ val }) {
  const pos = val >= 0;
  return (
    <span style={{
      background: pos ? "rgba(0,230,118,0.12)" : "rgba(255,70,85,0.12)",
      color: pos ? "#00e676" : "#ff4655",
      border: `1px solid ${pos ? "#00e67640" : "#ff465540"}`,
      borderRadius: 6, padding: "2px 8px",
      fontFamily: "'IBM Plex Mono', monospace",
      fontSize: 13, fontWeight: 700, letterSpacing: "0.02em"
    }}>
      {pos ? "▲" : "▼"} {formatUSD(val)}
    </span>
  );
}

function TraderAvatar({ trader, size = 40 }) {
  const [imgError, setImgError] = useState(false);
  const name = trader.userName || trader.proxyWallet?.slice(2, 6) || "??";
  const seed = name.charCodeAt(0) * 31 + (name.charCodeAt(1) || 7);
  const hue = seed % 360;
  return (trader.profileImage && !imgError) ? (
    <img src={trader.profileImage} alt={name}
      onError={() => setImgError(true)}
      style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid #1e2535", flexShrink: 0 }} />
  ) : (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: `linear-gradient(135deg, hsl(${hue},70%,45%), hsl(${(hue + 60) % 360},80%,35%))`,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'IBM Plex Mono', monospace", fontWeight: 700,
      color: "#fff", fontSize: size * 0.4, border: "2px solid #1e2535", flexShrink: 0
    }}>
      {name.slice(0, 2).toUpperCase()}
    </div>
  );
}

export default function App() {
  const [traders, setTraders] = useState([]);
  const [positions, setPositions] = useState({});
  const [feed, setFeed] = useState([]);
  const [category, setCategory] = useState("OVERALL");
  const [period, setPeriod] = useState("WEEK");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedTrader, setExpandedTrader] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifLog, setNotifLog] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [pulse, setPulse] = useState(false);
  const [tab, setTab] = useState("feed");
  const prevTradersRef = useRef([]);
  const notifIdRef = useRef(0);

  const notifEnabledRef = useRef(true);
  const addNotif = useCallback((msg, type = "info", trader = null) => {
    if (!notifEnabledRef.current) return;
    const id = ++notifIdRef.current;
    const item = { id, msg, type, trader, ts: new Date() };
    setNotifications(n => [item, ...n].slice(0, 5));
    setNotifLog(l => [item, ...l].slice(0, 100));
    setTimeout(() => setNotifications(n => n.filter(x => x.id !== id)), 5000);
  }, []);

  const fetchLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `${API}/v1/leaderboard?category=${category}&timePeriod=${period}&orderBy=PNL&limit=20`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const raw = await res.json();
      const list = Array.isArray(raw) ? raw : [];
      if (list.length === 0) throw new Error("Boş yanıt");

      // Yeni trader tespiti
      const prevWallets = new Set(prevTradersRef.current.map(t => t.proxyWallet));
      list.forEach(t => {
        if (!prevWallets.has(t.proxyWallet) && prevTradersRef.current.length > 0) {
          addNotif(`🆕 Yeni trader: ${t.userName || t.proxyWallet?.slice(0, 10)}`, "new", t);
        }
      });

      // PnL değişim tespiti
      const prevMap = Object.fromEntries(prevTradersRef.current.map(t => [t.proxyWallet, t]));
      list.forEach(t => {
        const prev = prevMap[t.proxyWallet];
        if (prev && t.pnl !== prev.pnl) {
          const diff = t.pnl - prev.pnl;
          if (Math.abs(diff) > 500) {
            addNotif(
              `💰 ${t.userName || t.proxyWallet?.slice(0, 10)}: PnL ${diff > 0 ? "+" : ""}${formatUSD(diff)}`,
              diff > 0 ? "profit" : "loss", t
            );
          }
        }
      });

      prevTradersRef.current = list;
      setTraders(list);
      setLastUpdate(new Date());
      setPulse(true);
      setTimeout(() => setPulse(false), 800);
    } catch (e) {
      setError("API bağlantısı kurulamadı — demo veri gösteriliyor.");
      setTraders(generateDemoData());
      setLastUpdate(new Date());
    } finally {
      setLoading(false);
    }
  }, [category, period, addNotif]);

  const tradersRef = useRef([]);
  useEffect(() => { tradersRef.current = traders; }, [traders]);

  const fetchPositions = useCallback(async (wallet) => {
    try {
      const res = await fetch(`${API}/v1/positions?user=${wallet}&sizeThreshold=0.01&limit=10`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || data.data || []);
      setPositions(p => ({ ...p, [wallet]: list }));

      list.slice(0, 3).forEach(pos => {
        const trader = tradersRef.current.find(t => t.proxyWallet === wallet);
        const itemId = `${wallet}-${pos.conditionId || pos.marketId || pos.market || ""}-${pos.outcome || ""}`;
        const item = {
          id: itemId,
          trader,
          market: pos.title || pos.market || "Market",
          outcome: pos.outcome || (pos.currentValue > 0.5 ? "YES" : "NO"),
          size: pos.currentValue || pos.size || 0,
          price: pos.price || pos.avgPrice || 0,
          pnl: pos.cashPnl || pos.pnl || 0,
          ts: pos.startDate || new Date().toISOString(),
          isNew: true,
        };
        setFeed(f => f.some(x => x.id === item.id) ? f : [item, ...f].slice(0, 60));
      });
    } catch {
      // sessiz hata
    }
  }, []);

  // İlk yükleme + 30s yenileme
  useEffect(() => {
    fetchLeaderboard();
    const t = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(t);
  }, [fetchLeaderboard]);

  // Top 5 trader'ın pozisyonlarını çek
  useEffect(() => {
    if (traders.length === 0) return;
    traders.slice(0, 5).forEach(t => fetchPositions(t.proxyWallet));
  }, [traders]);

  // Demo feed güncellemesi (gerçek pozisyon yokken)
  useEffect(() => {
    if (traders.length === 0) return;
    const t = setInterval(() => {
      const trader = traders[Math.floor(Math.random() * Math.min(5, traders.length))];
      if (!trader) return;
      const markets = [
        "Fed Mayıs'ta faiz indirir mi?", "Trump onay oranı Q2'de >50%?",
        "Bitcoin Haziran'da >$100K?", "2025'te AI düzenlemesi gelir mi?",
        "SpaceX Starship orbital başarı?", "Temmuz'da ateşkes?",
        "Euro Cup 2025 finalinde kim?", "Nvidia $200'ı aşar mı?",
      ];
      const item = {
        id: `sim-${Date.now()}-${Math.random()}`,
        trader,
        market: markets[Math.floor(Math.random() * markets.length)],
        outcome: Math.random() > 0.5 ? "YES" : "NO",
        size: Math.random() * 50000 + 500,
        price: Math.random() * 0.8 + 0.1,
        pnl: (Math.random() - 0.4) * 8000,
        ts: new Date().toISOString(),
        isNew: true,
      };
      setFeed(f => [item, ...f].slice(0, 60));
      addNotif(
        `📊 ${trader.userName || trader.proxyWallet?.slice(0, 10)} pozisyon açtı: ${item.market}`,
        "position", trader
      );
    }, 12_000);
    return () => clearInterval(t);
  }, [traders, addNotif]);

  function generateDemoData() {
    const names = ["CryptoProphet","PredictKing","MarketWizard","AlphaTrader",
      "WhaleHunter","ProbMaster","EdgeFinder","SharpMoney",
      "ValueBet","InfoEdge","ContraFlow","SmartMoneyX"];
    return names.map((name, i) => ({
      rank: String(i + 1),
      proxyWallet: "0x" + Array.from({length:40}, () => "0123456789abcdef"[Math.floor(Math.random()*16)]).join(""),
      userName: name,
      pnl: (Math.random() * 500000 + 10000) * (Math.random() > 0.15 ? 1 : -1),
      vol: Math.random() * 2_000_000 + 100_000,
      verifiedBadge: Math.random() > 0.6,
      winRate: Math.random() * 0.35 + 0.55,
    }));
  }

  const notifColor = {
    info: "#60a5fa", new: "#a78bfa", profit: "#00e676",
    loss: "#ff4655", position: "#fbbf24"
  };

  return (
    <div style={{ minHeight: "100vh", background: "#060b14", fontFamily: "'IBM Plex Mono','Courier New',monospace", color: "#e2e8f0" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600;700&family=Syne:wght@700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #060b14; }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: #0d1421; }
        ::-webkit-scrollbar-thumb { background: #1e3a5f; border-radius: 2px; }
        @keyframes fadeIn { from { opacity:0; transform:translateY(-8px); } to { opacity:1; transform:translateY(0); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes slideIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:translateX(0); } }
        .feed-item { animation: slideIn 0.35s ease; }
        .row-hover:hover { background: rgba(30,53,95,0.45) !important; cursor: pointer; }
        .filter-btn, .tab-btn { transition: all 0.15s; }
        .filter-btn:hover, .tab-btn:hover { opacity: 0.8; }
      `}</style>

      {/* Toast bildirimleri */}
      <div style={{ position:"fixed", top:16, right:16, zIndex:9999, display:"flex", flexDirection:"column", gap:8, width:310 }}>
        {notifications.map(n => (
          <div key={n.id} style={{
            background:"rgba(13,20,33,0.97)", border:`1px solid ${notifColor[n.type]}40`,
            borderLeft:`3px solid ${notifColor[n.type]}`, borderRadius:8,
            padding:"10px 14px", animation:"fadeIn 0.3s ease",
            backdropFilter:"blur(10px)", boxShadow:"0 4px 20px rgba(0,0,0,0.5)", fontSize:12
          }}>
            <div style={{ color:notifColor[n.type], fontWeight:600 }}>{n.msg}</div>
            <div style={{ color:"#4a5568", marginTop:2, fontSize:10 }}>{timeAgo(n.ts)}</div>
          </div>
        ))}
      </div>

      {/* Header */}
      <div style={{
        background:"linear-gradient(180deg,#0d1421 0%,#060b14 100%)",
        borderBottom:"1px solid #1e3a5f", padding:"14px 24px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100, backdropFilter:"blur(12px)"
      }}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <div style={{
            background:"linear-gradient(135deg,#00e676,#00b0ff)",
            borderRadius:10, width:36, height:36,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:18, boxShadow:"0 0 16px #00e67660"
          }}>⚡</div>
          <div>
            <div style={{ fontFamily:"'Syne',sans-serif", fontSize:20, fontWeight:800,
              background:"linear-gradient(90deg,#e2e8f0,#60a5fa)",
              WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent" }}>POLY FEED</div>
            <div style={{ color:"#4a6a8a", fontSize:10, letterSpacing:"0.15em" }}>SMART MONEY TRACKER</div>
          </div>
        </div>

        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"#0d1421",
            border:"1px solid #1e3a5f", borderRadius:20, padding:"5px 12px" }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:"#00e676",
              animation:"pulse 2s infinite", boxShadow:"0 0 8px #00e676" }} />
            <span style={{ fontSize:11, color:"#00e676", fontWeight:600 }}>LIVE</span>
          </div>
          {lastUpdate && (
            <div style={{ fontSize:10, color:"#4a6a8a" }}>
              {pulse ? "⟳ Güncelleniyor..." : `↻ ${timeAgo(lastUpdate)}`}
            </div>
          )}
          <button onClick={() => { setNotifEnabled(x => { notifEnabledRef.current = !x; return !x; }); }} style={{
            background: notifEnabled ? "rgba(0,230,118,0.1)" : "rgba(255,70,85,0.1)",
            border:`1px solid ${notifEnabled ? "#00e67640" : "#ff465540"}`,
            borderRadius:8, padding:"6px 12px", cursor:"pointer",
            color: notifEnabled ? "#00e676" : "#ff4655",
            fontSize:12, fontWeight:600, fontFamily:"'IBM Plex Mono',monospace"
          }}>
            {notifEnabled ? "🔔 ON" : "🔕 OFF"}
          </button>
          <button onClick={fetchLeaderboard} disabled={loading} style={{
            background:"rgba(96,165,250,0.1)", border:"1px solid #60a5fa40",
            borderRadius:8, padding:"6px 12px", cursor: loading ? "not-allowed" : "pointer",
            color:"#60a5fa", fontSize:12, fontWeight:600,
            fontFamily:"'IBM Plex Mono',monospace", opacity: loading ? 0.5 : 1
          }}>{loading ? "↻" : "⟳"} YENİLE</button>
        </div>
      </div>

      {error && (
        <div style={{ background:"rgba(251,191,36,0.08)", borderBottom:"1px solid #fbbf2440",
          padding:"8px 24px", fontSize:12, color:"#fbbf24", textAlign:"center" }}>
          ⚠ {error}
        </div>
      )}

      {/* Tabs */}
      <div style={{ borderBottom:"1px solid #1e3a5f", padding:"0 24px",
        display:"flex", background:"#0a1020" }}>
        {[
          { key:"feed", label:"📡 Canlı Feed" },
          { key:"traders", label:"🏆 Trader Sıralaması" },
          { key:"notifications", label:`🔔 Bildirimler${notifLog.length > 0 ? ` (${notifLog.length})` : ""}` }
        ].map(t => (
          <button key={t.key} className="tab-btn" onClick={() => setTab(t.key)} style={{
            background:"none", border:"none",
            borderBottom:`2px solid ${tab === t.key ? "#60a5fa" : "transparent"}`,
            padding:"12px 20px", cursor:"pointer",
            color: tab === t.key ? "#60a5fa" : "#4a6a8a",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:13,
            fontWeight: tab === t.key ? 700 : 400
          }}>{t.label}</button>
        ))}
      </div>

      {/* Filters */}
      <div style={{ padding:"10px 24px", background:"#080f1a", borderBottom:"1px solid #1a2940",
        display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ color:"#4a6a8a", fontSize:11, marginRight:4 }}>KATEGORİ:</span>
        {CATEGORIES.map(c => (
          <button key={c} className="filter-btn" onClick={() => setCategory(c)} style={{
            background: category === c ? "rgba(96,165,250,0.15)" : "transparent",
            border:`1px solid ${category === c ? "#60a5fa" : "#1e3a5f"}`,
            borderRadius:6, padding:"3px 9px", cursor:"pointer",
            color: category === c ? "#60a5fa" : "#4a6a8a",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600
          }}>{c}</button>
        ))}
        <span style={{ color:"#4a6a8a", fontSize:11, marginLeft:8, marginRight:4 }}>DÖNEM:</span>
        {PERIODS.map(p => (
          <button key={p} className="filter-btn" onClick={() => setPeriod(p)} style={{
            background: period === p ? "rgba(167,139,250,0.15)" : "transparent",
            border:`1px solid ${period === p ? "#a78bfa" : "#1e3a5f"}`,
            borderRadius:6, padding:"3px 9px", cursor:"pointer",
            color: period === p ? "#a78bfa" : "#4a6a8a",
            fontFamily:"'IBM Plex Mono',monospace", fontSize:11, fontWeight:600
          }}>{p}</button>
        ))}
      </div>

      <div style={{ padding:"20px 24px", maxWidth:1100, margin:"0 auto" }}>

        {/* FEED */}
        {tab === "feed" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14 }}>
              <div style={{ fontSize:12, color:"#4a6a8a" }}>
                <span style={{ color:"#60a5fa" }}>{feed.length}</span> işlem · her 12s güncellenir
              </div>
            </div>
            {feed.length === 0 ? (
              <div style={{ textAlign:"center", padding:"60px 20px", color:"#2d4a6a" }}>
                <div style={{ fontSize:40, marginBottom:12 }}>📡</div>
                <div>Feed yükleniyor...</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:7 }}>
                {feed.map((item) => (
                  <div key={item.id} className="feed-item row-hover" style={{
                    background: item.isNew ? "rgba(96,165,250,0.05)" : "rgba(13,20,33,0.8)",
                    border:`1px solid ${item.isNew ? "#60a5fa25" : "#1a2940"}`,
                    borderLeft:`3px solid ${item.pnl >= 0 ? "#00e676" : "#ff4655"}`,
                    borderRadius:10, padding:"11px 15px",
                    display:"flex", alignItems:"center", gap:13, transition:"all 0.2s"
                  }}>
                    <TraderAvatar trader={item.trader || {}} size={36} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:2 }}>
                        <span style={{ fontWeight:700, fontSize:13, color:"#e2e8f0" }}>
                          {item.trader?.userName || item.trader?.proxyWallet?.slice(0,12) || "Anonim"}
                        </span>
                        {item.trader?.verifiedBadge && <span style={{ color:"#60a5fa", fontSize:10 }}>✓</span>}
                        <span style={{ fontSize:10, color:"#2d4a6a" }}>#{item.trader?.rank}</span>
                      </div>
                      <div style={{ fontSize:12, color:"#60a5fa", whiteSpace:"nowrap",
                        overflow:"hidden", textOverflow:"ellipsis", maxWidth:360 }}>
                        {item.market}
                      </div>
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
                      <span style={{
                        background: item.outcome === "YES" ? "rgba(0,230,118,0.12)" : "rgba(255,70,85,0.12)",
                        color: item.outcome === "YES" ? "#00e676" : "#ff4655",
                        border:`1px solid ${item.outcome === "YES" ? "#00e67640" : "#ff465540"}`,
                        borderRadius:6, padding:"2px 10px", fontSize:12, fontWeight:700
                      }}>{item.outcome}</span>
                      <div style={{ textAlign:"right" }}>
                        <div style={{ fontSize:13, color:"#e2e8f0", fontWeight:600 }}>{formatUSD(item.size)}</div>
                        <div style={{ fontSize:10, color: item.pnl >= 0 ? "#00e676" : "#ff4655" }}>
                          {item.pnl >= 0 ? "+" : ""}{formatUSD(item.pnl)}
                        </div>
                      </div>
                      <div style={{ fontSize:10, color:"#2d4a6a", textAlign:"right", minWidth:48 }}>
                        <div>{Math.round(item.price * 100)}¢</div>
                        <div>{timeAgo(item.ts)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TRADERS */}
        {tab === "traders" && (
          <div>
            {loading && traders.length === 0 ? (
              <div style={{ textAlign:"center", padding:60, color:"#2d4a6a" }}>
                <div style={{ fontSize:30, animation:"pulse 1s infinite" }}>⟳</div>
                <div style={{ marginTop:8 }}>Leaderboard yükleniyor...</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {traders.map((trader, i) => (
                  <div key={trader.proxyWallet}>
                    <div className="row-hover" onClick={() => {
                      setExpandedTrader(expandedTrader === trader.proxyWallet ? null : trader.proxyWallet);
                      if (!positions[trader.proxyWallet]) fetchPositions(trader.proxyWallet);
                    }} style={{
                      background: expandedTrader === trader.proxyWallet ? "rgba(30,58,95,0.5)" : "rgba(13,20,33,0.8)",
                      border:`1px solid ${expandedTrader === trader.proxyWallet ? "#60a5fa40" : "#1a2940"}`,
                      borderRadius: expandedTrader === trader.proxyWallet ? "10px 10px 0 0" : 10,
                      padding:"13px 17px", display:"flex", alignItems:"center", gap:13, transition:"all 0.2s"
                    }}>
                      <div style={{
                        width:32, height:32, borderRadius:8, flexShrink:0,
                        background: i < 3 ? ["linear-gradient(135deg,#ffd700,#ffa500)",
                          "linear-gradient(135deg,#c0c0c0,#a0a0a0)",
                          "linear-gradient(135deg,#cd7f32,#a05020)"][i]
                          : "rgba(30,42,68,0.8)",
                        border: i < 3 ? "none" : "1px solid #1e2a44",
                        display:"flex", alignItems:"center", justifyContent:"center",
                        fontSize:12, fontWeight:800, color: i < 3 ? "#1a1a1a" : "#4a6a8a"
                      }}>#{i+1}</div>
                      <TraderAvatar trader={trader} size={40} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                          <span style={{ fontWeight:700, fontSize:14, color:"#e2e8f0" }}>
                            {trader.userName || trader.proxyWallet?.slice(0,14) + "..."}
                          </span>
                          {trader.verifiedBadge && (
                            <span style={{ background:"rgba(96,165,250,0.12)", color:"#60a5fa",
                              border:"1px solid #60a5fa30", borderRadius:4, padding:"1px 5px",
                              fontSize:10, fontWeight:700 }}>✓ VERİFİED</span>
                          )}
                        </div>
                        <div style={{ fontSize:10, color:"#2d4a6a", marginTop:2 }}>
                          {trader.proxyWallet?.slice(0,8)}...{trader.proxyWallet?.slice(-6)}
                        </div>
                      </div>
                      <div style={{ display:"flex", gap:18, alignItems:"center", flexShrink:0 }}>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:10, color:"#4a6a8a", marginBottom:2 }}>PNL</div>
                          <PnlBadge val={trader.pnl} />
                        </div>
                        <div style={{ textAlign:"center" }}>
                          <div style={{ fontSize:10, color:"#4a6a8a", marginBottom:2 }}>VOL</div>
                          <span style={{ fontSize:13, color:"#a78bfa", fontWeight:600 }}>{formatUSD(trader.vol)}</span>
                        </div>
                        {trader.winRate && (
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:10, color:"#4a6a8a", marginBottom:2 }}>WIN%</div>
                            <span style={{ fontSize:13, color:"#fbbf24", fontWeight:600 }}>
                              {Math.round(trader.winRate * 100)}%
                            </span>
                          </div>
                        )}
                        <span style={{ color:"#4a6a8a", fontSize:13 }}>
                          {expandedTrader === trader.proxyWallet ? "▲" : "▼"}
                        </span>
                      </div>
                    </div>

                    {expandedTrader === trader.proxyWallet && (
                      <div style={{
                        background:"rgba(8,15,26,0.97)", border:"1px solid #60a5fa25",
                        borderTop:"none", borderRadius:"0 0 10px 10px",
                        padding:"15px 17px", animation:"fadeIn 0.2s ease"
                      }}>
                        <div style={{ fontSize:10, color:"#4a6a8a", marginBottom:10, letterSpacing:"0.1em" }}>
                          AKTİF POZİSYONLAR
                        </div>
                        {positions[trader.proxyWallet] === undefined ? (
                          <div style={{ color:"#4a6a8a", fontSize:12, animation:"pulse 1s infinite" }}>Yükleniyor...</div>
                        ) : positions[trader.proxyWallet]?.length === 0 ? (
                          <div style={{ color:"#2d4a6a", fontSize:12 }}>Açık pozisyon bulunamadı.</div>
                        ) : (
                          <div style={{ display:"flex", flexDirection:"column", gap:5 }}>
                            {(positions[trader.proxyWallet] || []).slice(0, 6).map((pos, j) => (
                              <div key={pos.conditionId || pos.marketId || `pos-${j}`} style={{
                                background:"rgba(30,42,68,0.4)", border:"1px solid #1a2940",
                                borderRadius:7, padding:"9px 13px",
                                display:"flex", alignItems:"center", gap:10
                              }}>
                                <span style={{
                                  background: (pos.outcome === "YES" || pos.currentValue > 0.5) ? "rgba(0,230,118,0.1)" : "rgba(255,70,85,0.1)",
                                  color: (pos.outcome === "YES" || pos.currentValue > 0.5) ? "#00e676" : "#ff4655",
                                  border:`1px solid ${(pos.outcome === "YES" || pos.currentValue > 0.5) ? "#00e67630" : "#ff465530"}`,
                                  borderRadius:5, padding:"2px 8px", fontSize:11, fontWeight:700
                                }}>{pos.outcome || (pos.currentValue > 0.5 ? "YES" : "NO")}</span>
                                <span style={{ flex:1, fontSize:12, color:"#a0b4c8" }}>
                                  {pos.title || pos.market || "Market"}
                                </span>
                                <span style={{ fontSize:12, color:"#e2e8f0", fontWeight:600 }}>
                                  {formatUSD(pos.currentValue || pos.size)}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                        <div style={{ marginTop:12, display:"flex", gap:8 }}>
                          <a href={`https://polymarket.com/profile/${trader.proxyWallet}`}
                            target="_blank" rel="noopener noreferrer"
                            style={{ background:"rgba(96,165,250,0.1)", border:"1px solid #60a5fa30",
                              borderRadius:6, padding:"6px 14px", color:"#60a5fa",
                              fontSize:11, textDecoration:"none", fontWeight:600 }}>
                            🔗 Polymarket Profil
                          </a>
                          <button onClick={() => addNotif(`📌 ${trader.userName || trader.proxyWallet?.slice(0,10)} takibe alındı!`, "info", trader)}
                            style={{
                              background:"rgba(167,139,250,0.1)", border:"1px solid #a78bfa30",
                              borderRadius:6, padding:"6px 14px", cursor:"pointer",
                              color:"#a78bfa", fontSize:11, fontWeight:600,
                              fontFamily:"'IBM Plex Mono',monospace"
                            }}>⭐ Takip Et</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* NOTIFICATIONS */}
        {tab === "notifications" && (
          <div>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
              <div style={{ fontSize:12, color:"#4a6a8a" }}>
                Toplam <span style={{ color:"#60a5fa" }}>{notifLog.length}</span> bildirim
              </div>
              <button onClick={() => setNotifLog([])} style={{
                background:"rgba(255,70,85,0.08)", border:"1px solid #ff465530",
                borderRadius:6, padding:"5px 12px", cursor:"pointer",
                color:"#ff4655", fontSize:11, fontFamily:"'IBM Plex Mono',monospace"
              }}>Temizle</button>
            </div>

            <div style={{ background:"rgba(13,20,33,0.8)", border:"1px solid #1a2940",
              borderRadius:10, padding:"15px 17px", marginBottom:14 }}>
              <div style={{ fontSize:11, color:"#60a5fa", fontWeight:700, marginBottom:10 }}>
                🔧 BİLDİRİM AYARLARI
              </div>
              <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
                {[
                  { label:"Yeni Pozisyonlar", icon:"📊" },
                  { label:"PnL Değişimi", icon:"💰" },
                  { label:"Yeni Traderlar", icon:"🆕" },
                  { label:"Büyük İşlemler", icon:"🐋" },
                ].map(opt => (
                  <div key={opt.label} style={{
                    background:"rgba(96,165,250,0.1)", border:"1px solid #60a5fa40",
                    borderRadius:8, padding:"7px 13px", color:"#60a5fa",
                    fontSize:12, fontWeight:600, cursor:"pointer",
                    display:"flex", alignItems:"center", gap:5
                  }}>
                    {opt.icon} {opt.label} <span style={{ color:"#00e676" }}>●</span>
                  </div>
                ))}
              </div>
            </div>

            {notifLog.length === 0 ? (
              <div style={{ textAlign:"center", padding:"50px 20px", color:"#2d4a6a" }}>
                <div style={{ fontSize:40, marginBottom:10 }}>🔔</div>
                <div>Henüz bildirim yok</div>
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", gap:6 }}>
                {notifLog.map((n, i) => (
                  <div key={n.id} style={{
                    background:"rgba(13,20,33,0.8)",
                    border:`1px solid ${notifColor[n.type] || "#60a5fa"}20`,
                    borderLeft:`3px solid ${notifColor[n.type] || "#60a5fa"}`,
                    borderRadius:8, padding:"11px 15px",
                    display:"flex", alignItems:"center", gap:11,
                    opacity: i > 25 ? 0.5 : 1
                  }}>
                    {n.trader && <TraderAvatar trader={n.trader} size={30} />}
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color:"#c0cce0" }}>{n.msg}</div>
                    </div>
                    <div style={{ fontSize:10, color:"#2d4a6a", flexShrink:0 }}>{timeAgo(n.ts)}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div style={{ borderTop:"1px solid #1a2940", padding:"12px 24px", marginTop:20,
        display:"flex", justifyContent:"space-between", alignItems:"center" }}>
        <div style={{ fontSize:10, color:"#1e3a5f" }}>Polymarket Data API · 30s otomatik yenileme</div>
        <div style={{ fontSize:10, color:"#1e3a5f" }}>{new Date().toLocaleString("tr-TR")}</div>
      </div>
    </div>
  );
}
