import { useState, useEffect, useRef, useCallback } from "react";

const API       = "/api/polymarket";
const POLY_BASE = "https://polymarket.com";

const CATEGORIES = ["OVERALL","POLITICS","SPORTS","CRYPTO","CULTURE","ECONOMICS","TECH","FINANCE"];
const PERIODS    = ["DAY","WEEK","MONTH","ALL"];

/* ── Themes ── */
const LIGHT = { bg:"#f4f4f4", surface:"#ffffff", border:"#e2e2e2", text:"#111111", textMid:"#555555", textDim:"#aaaaaa" };
const DARK  = { bg:"#0e0e0e", surface:"#161616", border:"#2a2a2a", text:"#eeeeee", textMid:"#888888", textDim:"#444444" };
let C = LIGHT;

/* ── Translations ── */
const T = {
  en: {
    appName:          "POLY FEED",
    appSub:           "SMART MONEY TRACKER",
    live:             "LIVE",
    refreshing:       "refreshing...",
    agoSuffix:        " ago",
    refresh:          "⟳",
    search:           "Search",
    searchPlaceholder:"search trader or market...",
    clear:            "clear",
    tabFeed:          "Live Feed",
    tabTraders:       "Rankings",
    tabNotifs:        (n) => `Notifications${n ? ` · ${n}` : ""}`,
    catLabel:         "CATEGORY",
    periodLabel:      "PERIOD",
    colTrader:        "TRADER / MARKET",
    colOutcome:       "SIDE",
    colSize:          "SIZE",
    colPnl:           "PNL",
    colWhen:          "WHEN",
    colRank:          "#",
    colVol:           "VOLUME",
    colWin:           "WIN%",
    loading:          "Loading...",
    noTrades:         "Loading feed...",
    anonymous:        "Anonymous",
    verified:         "✓",
    activePositions:  "ACTIVE POSITIONS",
    noPositions:      "No open positions found.",
    viewOnPoly:       "View on Polymarket →",
    notifFiltersTitle:"NOTIFICATION FILTERS — click to toggle",
    notifRecords:     (n) => `${n} records`,
    clearNotifs:      "Clear",
    noNotifs:         "No notifications yet",
    footerApi:        "Polymarket Data API · auto-refresh every 30s",
    notifsOpen:       "·on",
    notifsClosed:     "·off",
    notifTypes: [
      { key:"position",  label:"New Positions",  icon:"↗" },
      { key:"pnl",       label:"PnL Changes",    icon:"±" },
      { key:"newTrader", label:"New Traders",     icon:"+" },
      { key:"whale",     label:"Large Trades",   icon:"◈" },
    ],
    notifMsgNewTrader: (name) => `New trader: ${name}`,
    notifMsgPnl:       (name, val) => `${name}: PnL ${val}`,
    notifMsgWhale:     (name, val) => `Large trade: ${name} ${val}`,
    notifMsgPosition:  (name, mkt) => `${name} opened position: ${mkt}`,
    darkMode:          "Dark mode",
    lightMode:         "Light mode",
    apiError:          "API connection failed — showing demo data.",
    timeS: (n) => `${n}s`,
    timeM: (n) => `${n}m`,
    timeH: (n) => `${n}h`,
    timeD: (n) => `${n}d`,
  },
  tr: {
    appName:          "POLY FEED",
    appSub:           "AKILLI PARA TAKİBİ",
    live:             "CANLI",
    refreshing:       "yükleniyor...",
    agoSuffix:        " önce",
    refresh:          "⟳",
    search:           "Ara",
    searchPlaceholder:"trader veya piyasa ara...",
    clear:            "temizle",
    tabFeed:          "Canlı Feed",
    tabTraders:       "Sıralama",
    tabNotifs:        (n) => `Bildirimler${n ? ` · ${n}` : ""}`,
    catLabel:         "KATEGORİ",
    periodLabel:      "DÖNEM",
    colTrader:        "TRADER / PİYASA",
    colOutcome:       "SONUÇ",
    colSize:          "BOYUT",
    colPnl:           "PNL",
    colWhen:          "NE ZAMAN",
    colRank:          "#",
    colVol:           "VOLüM",
    colWin:           "WIN%",
    loading:          "Yükleniyor...",
    noTrades:         "Feed yükleniyor...",
    anonymous:        "Anonim",
    verified:         "✓",
    activePositions:  "AKTİF POZİSYONLAR",
    noPositions:      "Açık pozisyon bulunamadı.",
    viewOnPoly:       "Polymarket'ta görüntüle →",
    notifFiltersTitle:"BİLDİRİM FİLTRELERİ — tıklayarak aç/kapat",
    notifRecords:     (n) => `${n} kayıt`,
    clearNotifs:      "Temizle",
    noNotifs:         "Henüz bildirim yok",
    footerApi:        "Polymarket Data API · 30s otomatik yenileme",
    notifsOpen:       "·açık",
    notifsClosed:     "·kapalı",
    notifTypes: [
      { key:"position",  label:"Yeni Pozisyonlar", icon:"↗" },
      { key:"pnl",       label:"PnL Değişimi",     icon:"±" },
      { key:"newTrader", label:"Yeni Traderlar",   icon:"+" },
      { key:"whale",     label:"Büyük İşlemler",   icon:"◈" },
    ],
    notifMsgNewTrader: (name) => `Yeni trader: ${name}`,
    notifMsgPnl:       (name, val) => `${name}: PnL ${val}`,
    notifMsgWhale:     (name, val) => `Büyük işlem: ${name} ${val}`,
    notifMsgPosition:  (name, mkt) => `${name} pozisyon açtı: ${mkt}`,
    darkMode:          "Karanlık mod",
    lightMode:         "Açık mod",
    apiError:          "API bağlantısı kurulamadı — demo veri gösteriliyor.",
    timeS: (n) => `${n}s`,
    timeM: (n) => `${n}dk`,
    timeH: (n) => `${n}sa`,
    timeD: (n) => `${n}g`,
  },
};

/* ── Helpers ── */
function formatUSD(v) {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign + "$" + (abs/1_000_000).toFixed(1) + "M";
  if (abs >= 1_000)     return sign + "$" + (abs/1_000).toFixed(1) + "K";
  return (v < 0 ? "-$" : "$") + abs.toFixed(0);
}

function timeAgo(ts, t) {
  if (!ts) return "";
  const s = Math.floor((Date.now() - new Date(ts).getTime()) / 1000);
  if (s < 60)    return t.timeS(s)    + t.agoSuffix;
  if (s < 3600)  return t.timeM(Math.floor(s/60))  + t.agoSuffix;
  if (s < 86400) return t.timeH(Math.floor(s/3600)) + t.agoSuffix;
  return t.timeD(Math.floor(s/86400)) + t.agoSuffix;
}

function TraderAvatar({ trader, size = 34 }) {
  const name  = trader?.userName || trader?.proxyWallet?.slice(2,5) || "?";
  const seed  = [...name].reduce((a,c) => a + c.charCodeAt(0), 0);
  const shade = 160 + (seed % 80);
  return trader?.profileImage ? (
    <img src={trader.profileImage} alt={name}
      style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover",
        border:`1px solid ${C.border}`, flexShrink:0 }} />
  ) : (
    <div style={{
      width:size, height:size, borderRadius:"50%", flexShrink:0,
      background:`rgb(${shade},${shade},${shade})`,
      border:`1px solid ${C.border}`,
      display:"flex", alignItems:"center", justifyContent:"center",
      fontSize:size*0.35, fontWeight:700, color:"#fff",
      fontFamily:"'DM Mono',monospace",
    }}>{name.slice(0,2).toUpperCase()}</div>
  );
}

function PnlBadge({ val }) {
  return (
    <span style={{ fontFamily:"'DM Mono',monospace", fontSize:12, fontWeight:500,
      color: val >= 0 ? C.text : C.textMid }}>
      {val >= 0 ? "+" : "−"}{formatUSD(Math.abs(val))}
    </span>
  );
}



function generateDemo() {
  const names = ["CryptoProphet","PredictKing","MarketWizard","AlphaTrader",
    "WhaleHunter","ProbMaster","EdgeFinder","SharpMoney","ValueBet","InfoEdge","ContraFlow","SmartMoneyX"];
  return names.map((name,i) => ({
    rank: String(i+1),
    proxyWallet: "0x"+[...Array(40)].map(()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join(""),
    userName: name, verifiedBadge: Math.random()>0.6,
    pnl: (Math.random()*500000+5000)*(Math.random()>0.15?1:-1),
    vol: Math.random()*2_000_000+50_000,
    winRate: Math.random()*0.35+0.55,
  }));
}

/* ── Demo market data (module-level, stable reference) ── */
const DEMO_MARKETS = [
  { title:"Fed rate cut in May 2025?",        titleTr:"Fed Mayıs'ta faiz indirir mi?",   slug:"fed-rate-cut-may-2025" },
  { title:"Bitcoin >$100K by June?",           titleTr:"Bitcoin Haziran'da >$100K?",       slug:"bitcoin-100k-june-2025" },
  { title:"Trump approval >50% in Q2?",        titleTr:"Trump onay oranı Q2'de >50%?",    slug:"trump-approval-q2-2025" },
  { title:"AI regulation passed in 2025?",     titleTr:"2025'te AI düzenlemesi gelir mi?", slug:"ai-regulation-2025" },
  { title:"Nvidia exceeds $200?",              titleTr:"Nvidia $200'ı aşar mı?",           slug:"nvidia-200-2025" },
  { title:"France in Euro 2025 final?",        titleTr:"Euro 2025 finalinde Fransa?",      slug:"euro-2025-france-final" },
];

/* ══════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark]     = useState(() => typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  const [lang, setLang]     = useState("en"); // default: English
  C = dark ? DARK : LIGHT;
  const t = T[lang];

  const [traders, setTraders]           = useState([]);
  const [positions, setPositions]       = useState({});
  const [feed, setFeed]                 = useState([]);
  const [category, setCategory]         = useState("OVERALL");
  const [period, setPeriod]             = useState("WEEK");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [expandedTrader, setExpanded]   = useState(null);
  const [toasts, setToasts]             = useState([]);
  const [notifLog, setNotifLog]         = useState([]);
  const [notifFilters, setNotifFilters] = useState({ position:true, pnl:true, newTrader:true, whale:true });
  const [lastUpdate, setLastUpdate]     = useState(null);
  const [tab, setTab]                   = useState("feed");
  const [searchInput, setSearchInput]   = useState("");
  const [search, setSearch]             = useState("");
  const prevRef = useRef([]);
  const notifId  = useRef(0);
  const langRef  = useRef(lang);
  useEffect(() => { langRef.current = lang; }, [lang]);

  /* ── notifications ── */
  const addNotif = useCallback((msg, type, trader = null) => {
    const key = { position:"position", profit:"pnl", loss:"pnl", new:"newTrader", whale:"whale" }[type];
    if (key && !notifFilters[key]) return;
    const id = ++notifId.current;
    const item = { id, msg, type, trader, ts: new Date() };
    setToasts(prev => [item, ...prev].slice(0, 4));
    setNotifLog(prev => [item, ...prev].slice(0, 100));
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 5000);
  }, [notifFilters]);

  /* ── leaderboard ── */
  const fetchLeaderboard = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/v1/leaderboard?category=${category}&timePeriod=${period}&orderBy=PNL&limit=20`);
      if (!res.ok) throw new Error();
      const list = await res.json();
      const prevMap = Object.fromEntries(prevRef.current.map(tr => [tr.proxyWallet, tr]));
      const prevSet = new Set(prevRef.current.map(tr => tr.proxyWallet));
      // Use current lang translations for notifications
      const tCurr = T[langRef.current];
      list.forEach(tr => {
        const name = tr.userName || tr.proxyWallet?.slice(0,10);
        if (!prevSet.has(tr.proxyWallet) && prevRef.current.length)
          addNotif(tCurr.notifMsgNewTrader(name), "new", tr);
        const prev = prevMap[tr.proxyWallet];
        if (prev) {
          const diff = (tr.pnl||0) - (prev.pnl||0);
          if (Math.abs(diff) > 1000)
            addNotif(tCurr.notifMsgPnl(name, (diff>0?"+":"")+formatUSD(diff)), diff>0?"profit":"loss", tr);
          if (Math.abs(diff) > 10000)
            addNotif(tCurr.notifMsgWhale(name, formatUSD(diff)), "whale", tr);
        }
      });
      prevRef.current = list;
      setTraders(list);
      setLastUpdate(new Date());
    } catch {
      setError(T[langRef.current].apiError);
      setTraders(generateDemo());
      setLastUpdate(new Date());
    } finally { setLoading(false); }
  }, [category, period, addNotif]); // lang handled via langRef to avoid interval restart

  /* ── positions ── */
  const fetchPositions = useCallback(async (wallet) => {
    try {
      const res = await fetch(`${API}/v1/positions?user=${wallet}&sizeThreshold=0.01&limit=10`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = Array.isArray(data) ? data : (data.results || []);
      setPositions(p => ({ ...p, [wallet]: list }));
      const tCurr = T[langRef.current];
      list.slice(0,3).forEach(pos => {
        const trader = traders.find(tr => tr.proxyWallet === wallet);
        const item = {
          id: `${wallet}-${pos.conditionId||Math.random()}`,
          trader, wallet,
          market:     pos.title || pos.market || "Market",
          marketSlug: pos.slug  || null, // conditionId is a hex hash, NOT a URL slug
          outcome:    pos.outcome || (pos.currentValue > 0.5 ? "YES" : "NO"),
          size:       pos.currentValue || pos.size  || 0,
          price:      pos.price        || pos.avgPrice || 0,
          pnl:        pos.cashPnl      || pos.pnl  || 0,
          ts:         pos.startDate    || new Date().toISOString(),
        };
        setFeed(f => f.some(x => x.id === item.id) ? f : [item, ...f].slice(0,80));
        addNotif(tCurr.notifMsgPosition(trader?.userName || wallet.slice(0,10), item.market.slice(0,45)), "position", trader);
      });
    } catch {}
  }, [traders, addNotif]); // lang handled via langRef

  /* generateDemo moved to module level */



  useEffect(() => {
    if (!traders.length) return;
    const interval = setInterval(() => {
      const trader = traders[Math.floor(Math.random()*Math.min(5,traders.length))];
      if (!trader) return;
      const m = DEMO_MARKETS[Math.floor(Math.random()*DEMO_MARKETS.length)];
      const tCurr = T[langRef.current];
      const title = langRef.current === "tr" ? m.titleTr : m.title;
      const item = {
        id: `sim-${Date.now()}-${Math.random()}`,
        trader, wallet: trader.proxyWallet,
        market: title, marketSlug: m.slug,
        outcome: Math.random()>0.5?"YES":"NO",
        size:  Math.random()*50000+500,
        price: Math.random()*0.8+0.1,
        pnl:   (Math.random()-0.4)*8000,
        ts:    new Date().toISOString(), isNew:true,
      };
      setFeed(f => [item,...f].slice(0,80));
      addNotif(tCurr.notifMsgPosition(trader.userName||trader.proxyWallet?.slice(0,10), title), "position", trader);
    }, 10_000);
    return () => clearInterval(interval);
  }, [traders, addNotif]); // lang handled via langRef

  useEffect(() => { fetchLeaderboard(); const iv = setInterval(fetchLeaderboard, 30_000); return () => clearInterval(iv); }, [fetchLeaderboard]);
  useEffect(() => { if (traders.length) traders.slice(0,5).forEach(tr => fetchPositions(tr.proxyWallet)); }, [traders]);

  /* ── filtered lists ── */
  const q = search.toLowerCase();
  const filteredTraders = traders.filter(tr =>
    !q || (tr.userName||"").toLowerCase().includes(q) || (tr.proxyWallet||"").toLowerCase().includes(q)
  );
  const filteredFeed = feed.filter(item =>
    !q || (item.market||"").toLowerCase().includes(q) || (item.trader?.userName||"").toLowerCase().includes(q)
  );

  const traderLink = (wallet) => `${POLY_BASE}/profile/${wallet}`;
  const marketLink = (slug)   => slug ? `${POLY_BASE}/event/${slug}` : "#";

  /* ── lang toggle button style ── */
  const langBtn = (active) => ({
    background: active ? C.text : "none",
    border: `1px solid ${active ? C.text : C.border}`,
    borderRadius: 4,
    padding: "3px 9px",
    fontSize: 10, fontWeight: 700,
    color: active ? (dark ? "#111" : "#fff") : C.textMid,
    fontFamily: "'DM Mono',monospace",
    cursor: "pointer",
    transition: "all 0.15s",
  });

  return (
    <div style={{ minHeight:"100vh", background:C.bg,
      fontFamily:"'DM Mono','Courier New',monospace", color:C.text,
      "--hover-bg": dark ? "#1f1f1f" : "#f9f9f9" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@500;600;700&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        a { color:inherit; text-decoration:none; }
        a:hover { text-decoration:underline; text-decoration-color:#aaa; }
        @keyframes fadeDown { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.2} }
        @keyframes slideUp  { from{opacity:0;transform:translateY(4px)} to{opacity:1;transform:translateY(0)} }
        .hrow:hover  { background:var(--hover-bg) !important; }
        .pill:hover  { background:${C.text} !important; color:${dark?"#111":"#fff"} !important; border-color:${C.text} !important; }
        .tab:hover   { color:${C.text} !important; }
        input:focus  { outline:none; }
        button       { cursor:pointer; }
        ::-webkit-scrollbar { width:3px; }
        ::-webkit-scrollbar-thumb { background:${C.border}; }
      `}</style>

      {/* ── Toasts ── */}
      <div style={{ position:"fixed", top:14, right:14, zIndex:9999,
        display:"flex", flexDirection:"column", gap:6, width:290 }}>
        {toasts.map(n => (
          <div key={n.id} style={{
            background:C.surface, border:`1px solid ${C.border}`,
            borderLeft:`3px solid ${C.text}`, borderRadius:6,
            padding:"9px 13px", animation:"fadeDown 0.2s ease",
            boxShadow:"0 2px 10px rgba(0,0,0,0.1)"
          }}>
            <div style={{ fontSize:12, color:C.text, lineHeight:1.4 }}>{n.msg}</div>
            <div style={{ fontSize:10, color:C.textDim, marginTop:3 }}>{timeAgo(n.ts, t)}</div>
          </div>
        ))}
      </div>

      {/* ── Header ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"11px 20px", display:"flex", alignItems:"center", justifyContent:"space-between",
        position:"sticky", top:0, zIndex:100 }}>

        {/* Left: logo + live */}
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <span style={{ fontFamily:"'DM Sans',sans-serif", fontSize:16, fontWeight:700,
            letterSpacing:"-0.04em" }}>{t.appName}</span>
          <div style={{ display:"flex", alignItems:"center", gap:5,
            border:`1px solid ${C.border}`, borderRadius:20, padding:"2px 9px" }}>
            <div style={{ width:5, height:5, borderRadius:"50%", background:C.text,
              animation:"blink 2.5s infinite" }} />
            <span style={{ fontSize:9, fontWeight:600, letterSpacing:"0.1em" }}>{t.live}</span>
          </div>
          {lastUpdate && (
            <span style={{ fontSize:10, color:C.textDim }}>
              {loading ? t.refreshing : `↻ ${timeAgo(lastUpdate, t)}`}
            </span>
          )}
        </div>

        {/* Right: search + lang + dark + refresh */}
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          {/* Search */}
          <div style={{ display:"flex", alignItems:"center", gap:6,
            background:C.bg, border:`1px solid ${C.border}`, borderRadius:6, padding:"5px 10px" }}>
            <span style={{ fontSize:12, color:C.textDim }}>⌕</span>
            <input value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
              onKeyDown={e => { if (e.key==="Enter") setSearch(searchInput); }}
              placeholder={t.searchPlaceholder}
              style={{ background:"none", border:"none", fontSize:11, color:C.text,
                fontFamily:"'DM Mono',monospace", width:170 }} />
            {searchInput && (
              <button onClick={() => { setSearch(""); setSearchInput(""); }}
                style={{ background:"none", border:"none", color:C.textDim, fontSize:12 }}>✕</button>
            )}
            <button onClick={() => setSearch(searchInput)} style={{
              background:C.text, border:"none", borderRadius:4, padding:"2px 9px",
              color: dark ? "#111" : "#fff", fontSize:10,
              fontFamily:"'DM Mono',monospace", fontWeight:500
            }}>{t.search}</button>
          </div>

          {/* Language toggle */}
          <div style={{ display:"flex", alignItems:"center", gap:2,
            border:`1px solid ${C.border}`, borderRadius:6, padding:2 }}>
            <button onClick={() => setLang("en")} style={langBtn(lang==="en")}>EN</button>
            <button onClick={() => setLang("tr")} style={langBtn(lang==="tr")}>TR</button>
          </div>

          {/* Dark mode toggle */}
          <button onClick={() => setDark(d => !d)} style={{
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            padding:"5px 10px", fontSize:13, color:C.textMid, transition:"all 0.2s"
          }} title={dark ? t.lightMode : t.darkMode}>
            {dark ? "☀" : "☾"}
          </button>

          {/* Refresh */}
          <button onClick={fetchLeaderboard} disabled={loading} style={{
            background:"none", border:`1px solid ${C.border}`, borderRadius:6,
            padding:"5px 11px", fontSize:10, color:C.textMid,
            fontFamily:"'DM Mono',monospace", opacity: loading ? 0.4 : 1
          }}>{t.refresh}</button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`,
          padding:"6px 20px", fontSize:10, color:C.textMid, textAlign:"center" }}>
          {error}
        </div>
      )}

      {/* ── Tabs ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"0 20px", display:"flex" }}>
        {[
          { key:"feed",          label: t.tabFeed },
          { key:"traders",       label: t.tabTraders },
          { key:"notifications", label: t.tabNotifs(notifLog.length) },
        ].map(tb => (
          <button key={tb.key} className="tab" onClick={() => setTab(tb.key)} style={{
            background:"none", border:"none", padding:"10px 16px",
            fontSize:11, fontWeight:600, letterSpacing:"0.02em",
            color: tab===tb.key ? C.text : C.textDim,
            borderBottom:`2px solid ${tab===tb.key ? C.text : "transparent"}`,
            fontFamily:"'DM Mono',monospace", transition:"all 0.12s"
          }}>{tb.label}</button>
        ))}
      </div>

      {/* ── Filters ── */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`,
        padding:"7px 20px", display:"flex", gap:5, flexWrap:"wrap", alignItems:"center" }}>
        <span style={{ fontSize:9, color:C.textDim, letterSpacing:"0.1em", marginRight:2 }}>{t.catLabel}</span>
        {CATEGORIES.map(c => (
          <button key={c} className="pill" onClick={() => setCategory(c)} style={{
            background: category===c ? C.text : "none",
            border:`1px solid ${category===c ? C.text : C.border}`,
            borderRadius:20, padding:"2px 9px",
            color: category===c ? (dark?"#111":"#fff") : C.textMid,
            fontSize:9, fontWeight:500, fontFamily:"'DM Mono',monospace", transition:"all 0.12s"
          }}>{c}</button>
        ))}
        <div style={{ width:1, height:12, background:C.border, margin:"0 3px" }} />
        <span style={{ fontSize:9, color:C.textDim, letterSpacing:"0.1em", marginRight:2 }}>{t.periodLabel}</span>
        {PERIODS.map(p => (
          <button key={p} className="pill" onClick={() => setPeriod(p)} style={{
            background: period===p ? C.text : "none",
            border:`1px solid ${period===p ? C.text : C.border}`,
            borderRadius:20, padding:"2px 9px",
            color: period===p ? (dark?"#111":"#fff") : C.textMid,
            fontSize:9, fontWeight:500, fontFamily:"'DM Mono',monospace", transition:"all 0.12s"
          }}>{p}</button>
        ))}
        {search && (
          <div style={{ marginLeft:"auto", fontSize:10, color:C.textMid }}>
            "{search}" &nbsp;
            <button onClick={() => { setSearch(""); setSearchInput(""); }}
              style={{ background:"none", border:"none", fontSize:10, color:C.textDim }}>
              ✕ {t.clear}
            </button>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div style={{ padding:"16px 20px", maxWidth:1080, margin:"0 auto" }}>

        {/* ════ FEED ════ */}
        {tab === "feed" && (
          <div>
            <div style={{ fontSize:10, color:C.textDim, marginBottom:10 }}>
              {filteredFeed.length} · {lang==="en" ? "updates every 10s" : "her 10s güncellenir"}
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 60px 90px 90px 60px",
              padding:"5px 14px", fontSize:9, color:C.textDim, letterSpacing:"0.08em",
              borderBottom:`1px solid ${C.border}`, background:C.surface }}>
              <span>{t.colTrader}</span>
              <span style={{ textAlign:"center" }}>{t.colOutcome}</span>
              <span style={{ textAlign:"right" }}>{t.colSize}</span>
              <span style={{ textAlign:"right" }}>{t.colPnl}</span>
              <span style={{ textAlign:"right" }}>{t.colWhen}</span>
            </div>
            {filteredFeed.length === 0 ? (
              <div style={{ padding:"50px 0", textAlign:"center", fontSize:12, color:C.textDim }}>{t.noTrades}</div>
            ) : filteredFeed.map(item => (
              <div key={item.id} className="hrow" style={{
                display:"grid", gridTemplateColumns:"1fr 60px 90px 90px 60px",
                padding:"9px 14px", alignItems:"center",
                borderBottom:`1px solid ${C.border}`,
                background:C.surface, animation:"slideUp 0.25s ease",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                  <TraderAvatar trader={item.trader||{}} size={30} />
                  <div style={{ minWidth:0 }}>
                    <a href={traderLink(item.wallet)} target="_blank" rel="noopener noreferrer"
                      style={{ fontSize:12, fontWeight:600, display:"block",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                      {item.trader?.userName || item.wallet?.slice(0,14) || t.anonymous}
                      {item.trader?.verifiedBadge && <span style={{ marginLeft:4, fontSize:9, color:C.textDim }}>{t.verified}</span>}
                    </a>
                    <a href={item.marketSlug ? marketLink(item.marketSlug) : "#"} target={item.marketSlug ? "_blank" : "_self"} rel="noopener noreferrer"
                      style={{ fontSize:10, color:C.textMid, display:"block",
                        whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:320 }}>
                      {item.market}
                    </a>
                  </div>
                </div>
                <div style={{ textAlign:"center" }}>
                  <span style={{ fontSize:11, fontWeight:600, fontFamily:"'DM Mono',monospace",
                    color: item.outcome==="YES" ? C.text : C.textMid }}>
                    {item.outcome}
                  </span>
                </div>
                <div style={{ textAlign:"right", fontSize:12, fontFamily:"'DM Mono',monospace" }}>
                  {formatUSD(item.size)}
                </div>
                <div style={{ textAlign:"right" }}><PnlBadge val={item.pnl} /></div>
                <div style={{ textAlign:"right", fontSize:9, color:C.textDim }}>{timeAgo(item.ts, t)}</div>
              </div>
            ))}
          </div>
        )}

        {/* ════ TRADERS ════ */}
        {tab === "traders" && (
          <div>
            <div style={{ display:"grid", gridTemplateColumns:"36px 1fr 130px 110px 70px 24px",
              padding:"5px 14px", fontSize:9, color:C.textDim, letterSpacing:"0.08em",
              borderBottom:`1px solid ${C.border}`, background:C.surface }}>
              <span>{t.colRank}</span><span>TRADER</span>
              <span style={{ textAlign:"right" }}>{t.colPnl}</span>
              <span style={{ textAlign:"right" }}>{t.colVol}</span>
              <span style={{ textAlign:"right" }}>{t.colWin}</span>
              <span />
            </div>
            {loading && !filteredTraders.length ? (
              <div style={{ padding:"50px 0", textAlign:"center", fontSize:12, color:C.textDim }}>{t.loading}</div>
            ) : filteredTraders.map((trader, i) => (
              <div key={trader.proxyWallet}>
                <div className="hrow" onClick={() => {
                  setExpanded(expandedTrader===trader.proxyWallet ? null : trader.proxyWallet);
                  if (!positions[trader.proxyWallet]) fetchPositions(trader.proxyWallet);
                }} style={{
                  display:"grid", gridTemplateColumns:"36px 1fr 130px 110px 70px 24px",
                  padding:"10px 14px", alignItems:"center",
                  borderBottom:`1px solid ${C.border}`, background:C.surface,
                }}>
                  <div style={{ fontSize:11, fontWeight:600, color: i<3?C.text:C.textDim }}>{i+1}</div>
                  <div style={{ display:"flex", alignItems:"center", gap:9, minWidth:0 }}>
                    <TraderAvatar trader={trader} size={30} />
                    <div style={{ minWidth:0 }}>
                      <a href={traderLink(trader.proxyWallet)} target="_blank" rel="noopener noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{ fontSize:13, fontWeight:600, display:"block",
                          whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                        {trader.userName || trader.proxyWallet?.slice(0,16)+"..."}
                        {trader.verifiedBadge && <span style={{ marginLeft:4, fontSize:9, color:C.textDim }}>{t.verified}</span>}
                      </a>
                      <div style={{ fontSize:9, color:C.textDim }}>
                        {trader.proxyWallet?.slice(0,8)}…{trader.proxyWallet?.slice(-5)}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign:"right" }}><PnlBadge val={trader.pnl} /></div>
                  <div style={{ textAlign:"right", fontSize:11, fontFamily:"'DM Mono',monospace", color:C.textMid }}>
                    {formatUSD(trader.vol)}
                  </div>
                  <div style={{ textAlign:"right", fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                    {trader.winRate ? Math.round(trader.winRate*100)+"%" : "—"}
                  </div>
                  <div style={{ textAlign:"right", fontSize:10, color:C.textDim }}>
                    {expandedTrader===trader.proxyWallet ? "▲" : "▼"}
                  </div>
                </div>

                {expandedTrader===trader.proxyWallet && (
                  <div style={{ background:C.bg, borderBottom:`1px solid ${C.border}`,
                    padding:"12px 14px 12px 59px", animation:"slideUp 0.2s ease" }}>
                    <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.1em", marginBottom:8 }}>
                      {t.activePositions}
                    </div>
                    {positions[trader.proxyWallet] === undefined ? (
                      <div style={{ fontSize:11, color:C.textDim }}>{t.loading}</div>
                    ) : !positions[trader.proxyWallet]?.length ? (
                      <div style={{ fontSize:11, color:C.textDim }}>{t.noPositions}</div>
                    ) : (
                      <div style={{ display:"flex", flexDirection:"column", gap:3 }}>
                        {positions[trader.proxyWallet].slice(0,6).map((pos,j) => (
                          <div key={j} style={{ display:"flex", alignItems:"center", gap:9,
                            padding:"6px 10px", background:C.surface,
                            border:`1px solid ${C.border}`, borderRadius:5 }}>
                            <span style={{ fontSize:10, fontWeight:600, fontFamily:"'DM Mono',monospace",
                              color:(pos.outcome==="YES"||pos.currentValue>0.5)?C.text:C.textMid, width:28 }}>
                              {pos.outcome||(pos.currentValue>0.5?"YES":"NO")}
                            </span>
                            <a href={pos.slug ? marketLink(pos.slug) : "#"} target={pos.slug ? "_blank" : "_self"} rel="noopener noreferrer"
                              style={{ flex:1, fontSize:11, color:C.textMid,
                                whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>
                              {pos.title||pos.market||"Market"}
                            </a>
                            <span style={{ fontSize:11, fontFamily:"'DM Mono',monospace" }}>
                              {formatUSD(pos.currentValue||pos.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <a href={traderLink(trader.proxyWallet)} target="_blank" rel="noopener noreferrer"
                      style={{ display:"inline-block", marginTop:10, fontSize:10, color:C.textMid,
                        borderBottom:`1px solid ${C.border}` }}>
                      {t.viewOnPoly}
                    </a>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ════ NOTIFICATIONS ════ */}
        {tab === "notifications" && (
          <div>
            <div style={{ background:C.surface, border:`1px solid ${C.border}`,
              borderRadius:8, padding:"12px 14px", marginBottom:12 }}>
              <div style={{ fontSize:9, color:C.textDim, letterSpacing:"0.1em", marginBottom:8 }}>
                {t.notifFiltersTitle}
              </div>
              <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                {t.notifTypes.map(({ key, label, icon }) => {
                  const on = notifFilters[key];
                  return (
                    <button key={key} className="pill"
                      onClick={() => setNotifFilters(f => ({...f,[key]:!f[key]}))}
                      style={{
                        background: on ? C.text : "none",
                        border:`1px solid ${on ? C.text : C.border}`,
                        borderRadius:20, padding:"4px 12px",
                        color: on ? (dark?"#111":"#fff") : C.textMid,
                        fontSize:10, fontWeight:500, fontFamily:"'DM Mono',monospace",
                        display:"flex", alignItems:"center", gap:5, transition:"all 0.12s"
                      }}>
                      <span>{icon}</span>
                      <span>{label}</span>
                      <span style={{ fontSize:9, opacity:0.55 }}>{on ? t.notifsOpen : t.notifsClosed}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
              <div style={{ fontSize:10, color:C.textDim }}>{t.notifRecords(notifLog.length)}</div>
              <button onClick={() => setNotifLog([])} style={{
                background:"none", border:`1px solid ${C.border}`, borderRadius:5,
                padding:"3px 9px", fontSize:9, color:C.textMid, fontFamily:"'DM Mono',monospace"
              }}>{t.clearNotifs}</button>
            </div>

            {notifLog.length === 0 ? (
              <div style={{ padding:"50px 0", textAlign:"center", fontSize:12, color:C.textDim }}>
                {t.noNotifs}
              </div>
            ) : notifLog.map((n,i) => (
              <div key={n.id} style={{
                display:"flex", alignItems:"center", gap:9,
                padding:"9px 14px", borderBottom:`1px solid ${C.border}`,
                background:C.surface, opacity: i > 30 ? 0.4 : 1
              }}>
                {n.trader && <TraderAvatar trader={n.trader} size={26} />}
                <div style={{ flex:1, fontSize:11, color:C.text, lineHeight:1.4 }}>{n.msg}</div>
                <div style={{ fontSize:9, color:C.textDim, flexShrink:0 }}>{timeAgo(n.ts, t)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop:`1px solid ${C.border}`, padding:"10px 20px", marginTop:16,
        display:"flex", justifyContent:"space-between", fontSize:9, color:C.textDim }}>
        <span>{t.footerApi}</span>
        <span>{new Date().toLocaleString(lang==="tr" ? "tr-TR" : "en-US")}</span>
      </div>
    </div>
  );
}
