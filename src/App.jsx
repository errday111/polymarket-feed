import { useState, useEffect, useRef, useCallback } from "react";

const API       = "/api/polymarket";
const POLY_BASE = "https://polymarket.com";
const CATEGORIES = ["OVERALL","POLITICS","SPORTS","CRYPTO","CULTURE","ECONOMICS","TECH","FINANCE"];
const PERIODS    = ["DAY","WEEK","MONTH","ALL"];

/* ── Themes ── */
const LIGHT = { bg:"#f4f4f4", surface:"#ffffff", border:"#e2e2e2", text:"#111111", textMid:"#555555", textDim:"#aaaaaa" };
const DARK  = { bg:"#0e0e0e", surface:"#161616", border:"#2a2a2a", text:"#eeeeee", textMid:"#888888", textDim:"#444444" };
let C = LIGHT;

/* ── Static strings (EN only) ── */
const S = {
  appName:"POLY FEED", live:"LIVE", refreshing:"refreshing...", agoSuffix:" ago",
  searchPlaceholder:"search trader or market...",
  tabFeed:"Live Feed", tabTraders:"Rankings",
  tabNotifs:(n)=>`Notifications${n?` · ${n}`:""}`,
  catLabel:"CATEGORY", periodLabel:"PERIOD",
  colTrader:"TRADER / MARKET", colOutcome:"SIDE", colSize:"SIZE", colPnl:"PNL", colWhen:"WHEN",
  colRank:"#", colVol:"VOLUME", colWin:"WIN%",
  loading:"Loading...", noTrades:"Loading feed...", anonymous:"Anonymous", verified:"✓",
  activePositions:"ACTIVE POSITIONS", noPositions:"No open positions found.",
  viewOnPoly:"View on Polymarket →",
  notifFiltersTitle:"NOTIFICATION FILTERS",
  notifRecords:(n)=>`${n} records`, clearNotifs:"Clear", noNotifs:"No notifications yet",
  footerApi:"Polymarket Data API · auto-refresh every 30s",
  notifsOn:"on", notifsOff:"off",
  notifGlobalOn:"Notifications ON", notifGlobalOff:"Notifications OFF",
  notifTypes:[
    {key:"position", label:"New Positions", icon:"↗"},
    {key:"pnl",      label:"PnL Changes",   icon:"±"},
    {key:"newTrader",label:"New Traders",    icon:"+"},
    {key:"whale",    label:"Large Trades",   icon:"◈"},
  ],
  notifMsgNewTrader:(n)=>`New trader on leaderboard: ${n}`,
  notifMsgPnl:(n,v)=>`${n}: PnL change ${v}`,
  notifMsgWhale:(n,v)=>`Whale move — ${n}: ${v}`,
  notifMsgPosition:(n,m)=>`${n} opened: ${m}`,
  darkMode:"Dark mode", lightMode:"Light mode",
  apiError:"API unavailable — showing demo data.",
  timeS:(n)=>`${n}s`, timeM:(n)=>`${n}m`, timeH:(n)=>`${n}h`, timeD:(n)=>`${n}d`,
  updatesEvery:"updates every 10s",
};

/* ── Gamma API proxy ── */
const GAMMA_API = "/api/gamma";
const RSS2JSON  = "/api/rss2json";

/* ── RSS feed sources (multidisciplinary, free, no key) ── */
const RSS_SOURCES = [
  // World News
  { url:"https://feeds.bbci.co.uk/news/world/rss.xml",                label:"BBC" },
  { url:"https://feeds.reuters.com/reuters/topNews",                   label:"Reuters" },
  { url:"https://rss.nytimes.com/services/xml/rss/nyt/World.xml",      label:"NYT" },
  { url:"https://www.aljazeera.com/xml/rss/all.xml",                   label:"Al Jazeera" },
  // Business & Economy
  { url:"https://feeds.bloomberg.com/markets/news.rss",                label:"Bloomberg" },
  { url:"https://www.ft.com/?format=rss",                              label:"FT" },
  { url:"https://feeds.a.dj.com/rss/RSSMarketsMain.xml",              label:"WSJ" },
  // Tech
  { url:"https://techcrunch.com/feed/",                                label:"TechCrunch" },
  { url:"https://www.theverge.com/rss/index.xml",                      label:"Verge" },
  // Politics
  { url:"https://rss.politico.com/politics-news.xml",                  label:"Politico" },
  // Sports
  { url:"https://www.espn.com/espn/rss/news",                         label:"ESPN" },
  { url:"https://feeds.skysports.com/skysports/news.rss",             label:"Sky Sports" },
  // Science & Misc
  { url:"https://www.nasa.gov/rss/dyn/breaking_news.rss",             label:"NASA" },
  { url:"https://feeds.bbci.co.uk/news/science_and_environment/rss.xml", label:"BBC Sci" },
];

/* ── Fallback seed news — each item links to its real source ── */
const SEED_NEWS = [
  // Polymarket — prediction market context
  {text:"Polymarket volume surpasses $4B — prediction markets go mainstream",
   url:"https://polymarket.com/"},
  {text:"Fed rate decision: markets price 68% chance of cut in June",
   url:"https://polymarket.com/event/fed-rate-cut-june-2025"},
  {text:"Trump approval Q2 above 50%? — market priced at 51¢",
   url:"https://polymarket.com/event/trump-approval-above-50-in-q2-2025"},
  {text:"Gaza ceasefire before July — YES contracts at 44¢ on Polymarket",
   url:"https://polymarket.com/event/israel-hamas-ceasefire-before-july-2025"},
  {text:"NVIDIA exceeds $200 in 2025 — market moves to 44¢",
   url:"https://polymarket.com/event/nvidia-200-2025"},
  {text:"SpaceX Starship orbital success — YES at 74¢",
   url:"https://polymarket.com/event/starship-successful-orbital-flight"},
  // Reuters
  {text:"Reuters: Bitcoin holds above $82K ahead of halving anniversary",
   url:"https://www.reuters.com/technology/"},
  {text:"Reuters: IMF raises 2025 global growth forecast to 3.3%",
   url:"https://www.reuters.com/markets/"},
  {text:"Reuters: Euro 2025 groups complete — France & Spain top seeds",
   url:"https://www.reuters.com/sports/soccer/"},
  // BBC
  {text:"BBC: US CPI 2.8% — softer than expected, rate cut odds rise",
   url:"https://www.bbc.com/news/business"},
  {text:"BBC: AI regulation bill advances in Senate committee",
   url:"https://www.bbc.com/news/technology"},
  // Bloomberg
  {text:"Bloomberg: Ethereum ETF net inflows turn positive after 6-week streak",
   url:"https://www.bloomberg.com/crypto"},
  // Financial Times
  {text:"FT: Fed holds rates — two cuts priced in by year-end",
   url:"https://www.ft.com/markets"},
  // CoinDesk
  {text:"CoinDesk: Bitcoin halving anniversary — on-chain metrics bullish",
   url:"https://www.coindesk.com/markets/"},
  // ESPN
  {text:"ESPN: Champions League quarterfinals set — Real Madrid & Arsenal lead",
   url:"https://www.espn.com/soccer/"},
  // TechCrunch
  {text:"TechCrunch: OpenAI launches GPT-5 research preview to select partners",
   url:"https://techcrunch.com/artificial-intelligence/"},
  // NASA
  {text:"NASA: Artemis III crew selection confirmed — moon landing 2026 target",
   url:"https://www.nasa.gov/missions/artemis/"},
  // AP News
  {text:"AP: Middle East ceasefire talks resume in Cairo — mediators cautiously optimistic",
   url:"https://apnews.com/world-news"},
  // Al Jazeera
  {text:"Al Jazeera: UN Security Council meets on Gaza — resolution vote expected",
   url:"https://www.aljazeera.com/news/"},
  // Politico
  {text:"Politico: Senate AI bill clears committee — floor vote next month",
   url:"https://www.politico.com/news/technology"},
];

/* ── Module helpers ── */
function formatUSD(v) {
  if (!v && v !== 0) return "—";
  const abs = Math.abs(v), sign = v < 0 ? "-" : "";
  if (abs >= 1_000_000) return sign+"$"+(abs/1_000_000).toFixed(1)+"M";
  if (abs >= 1_000)     return sign+"$"+(abs/1_000).toFixed(1)+"K";
  return (v < 0 ? "-$" : "$")+abs.toFixed(0);
}
function timeAgo(ts) {
  if (!ts) return "";
  const s = Math.floor((Date.now()-new Date(ts).getTime())/1000);
  if (s < 60)    return S.timeS(s)+S.agoSuffix;
  if (s < 3600)  return S.timeM(Math.floor(s/60))+S.agoSuffix;
  if (s < 86400) return S.timeH(Math.floor(s/3600))+S.agoSuffix;
  return S.timeD(Math.floor(s/86400))+S.agoSuffix;
}
function generateDemo() {
  const names = ["CryptoProphet","PredictKing","MarketWizard","AlphaTrader",
    "WhaleHunter","ProbMaster","EdgeFinder","SharpMoney","ValueBet","InfoEdge","ContraFlow","SmartMoneyX"];
  return names.map((name,i) => ({
    rank:String(i+1),
    proxyWallet:"0x"+[...Array(40)].map(()=>"0123456789abcdef"[Math.floor(Math.random()*16)]).join(""),
    userName:name, verifiedBadge:Math.random()>0.6,
    pnl:(Math.random()*500000+5000)*(Math.random()>0.15?1:-1),
    vol:Math.random()*2_000_000+50_000,
    winRate:Math.random()*0.35+0.55,
  }));
}
const DEMO_MARKETS = [
  {title:"Fed rate cut in May 2025?",      slug:"fed-rate-cut-may-2025"},
  {title:"Bitcoin >$100K by June?",         slug:"bitcoin-100k-june-2025"},
  {title:"Trump approval >50% in Q2?",      slug:"trump-approval-q2-2025"},
  {title:"AI regulation passed in 2025?",   slug:"ai-regulation-2025"},
  {title:"Nvidia exceeds $200?",            slug:"nvidia-200-2025"},
  {title:"France in Euro 2025 final?",      slug:"euro-2025-france-final"},
];

function TraderAvatar({trader, size=32}) {
  const name  = trader?.userName || trader?.proxyWallet?.slice(2,5) || "?";
  const seed  = [...name].reduce((a,c)=>a+c.charCodeAt(0),0);
  const shade = 160+(seed%80);
  return trader?.profileImage ? (
    <img src={trader.profileImage} alt={name}
      style={{width:size,height:size,borderRadius:"50%",objectFit:"cover",border:`1px solid ${C.border}`,flexShrink:0}}/>
  ) : (
    <div style={{width:size,height:size,borderRadius:"50%",flexShrink:0,
      background:`rgb(${shade},${shade},${shade})`,border:`1px solid ${C.border}`,
      display:"flex",alignItems:"center",justifyContent:"center",
      fontSize:size*0.35,fontWeight:700,color:"#fff",fontFamily:"'DM Mono',monospace",
    }}>{name.slice(0,2).toUpperCase()}</div>
  );
}
function PnlBadge({val}) {
  return <span style={{fontFamily:"'DM Mono',monospace",fontSize:12,fontWeight:500,
    color:val>=0?C.text:C.textMid}}>{val>=0?"+":"−"}{formatUSD(Math.abs(val))}</span>;
}


/* ══ DismissibleToast — swipe up or click X to dismiss ══ */
function DismissibleToast({ n, dark: isDark, onDismiss }) {
  const theme = isDark ? DARK : LIGHT;
  const el    = useRef(null);
  const drag  = useRef({ active:false, startY:0, startX:0, dy:0 });
  const [offset, setOffset] = useState({y:0, x:0, opacity:1});
  const [dismissed, setDismissed] = useState(false);

  function dismiss() {
    if (dismissed) return;
    setDismissed(true);
    setOffset({y:-80, x:0, opacity:0});
    setTimeout(onDismiss, 280);
  }

  // pointer events (works for both mouse and touch)
  function onPointerDown(e) {
    drag.current = { active:true, startY:e.clientY, startX:e.clientX, dy:0, dx:0 };
    el.current?.setPointerCapture(e.pointerId);
  }
  function onPointerMove(e) {
    if (!drag.current.active) return;
    const dy = e.clientY - drag.current.startY;
    const dx = e.clientX - drag.current.startX;
    drag.current.dy = dy;
    drag.current.dx = dx;
    if (dy < 0) {
      const progress = Math.min(Math.abs(dy) / 80, 1);
      setOffset({ y: dy, x: dx * 0.3, opacity: 1 - progress * 0.6 });
    }
  }
  function onPointerUp(e) {
    if (!drag.current.active) return;
    drag.current.active = false;
    if (drag.current.dy < -45) {
      dismiss();
    } else {
      // snap back
      setOffset({ y:0, x:0, opacity:1 });
    }
  }

  const url = n.url || (n.trader?.proxyWallet ? `${POLY_BASE}/profile/${n.trader.proxyWallet}` : null);

  const inner = (
    <div style={{
      background: isDark ? "rgba(18,18,18,0.88)" : "rgba(255,255,255,0.88)",
      backdropFilter:"blur(14px)", WebkitBackdropFilter:"blur(14px)",
      border:`1px solid ${isDark?"rgba(255,255,255,0.08)":"rgba(0,0,0,0.08)"}`,
      borderLeft:`3px solid ${theme.text}`,
      borderRadius:9, padding:"10px 12px 10px 13px",
      boxShadow:`0 4px 22px ${isDark?"rgba(0,0,0,0.55)":"rgba(0,0,0,0.12)"}`,
      display:"flex", alignItems:"flex-start", gap:8,
      userSelect:"none", WebkitUserSelect:"none",
    }}>
      <div style={{flex:1, minWidth:0}}>
        <div style={{fontSize:12,color:theme.text,lineHeight:1.45,
          wordBreak:"break-word"}}>{n.msg}</div>
        <div style={{fontSize:10,color:theme.textDim,marginTop:3}}>{timeAgo(n.ts)}</div>
      </div>
      <button
        onClick={e=>{ e.preventDefault(); e.stopPropagation(); dismiss(); }}
        style={{background:"none",border:"none",color:theme.textDim,
          fontSize:14,padding:"0 0 0 4px",flexShrink:0,lineHeight:1,
          cursor:"pointer",opacity:0.6}}>
        ×
      </button>
    </div>
  );

  return (
    <div
      ref={el}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      style={{
        transform:`translateY(${offset.y}px) translateX(${offset.x}px)`,
        opacity: offset.opacity,
        transition: drag.current.active ? "none" : "transform 0.25s ease, opacity 0.25s ease",
        cursor: url ? "pointer" : "grab",
        touchAction:"none",
      }}
    >
      {url ? (
        <a href={url} target="_blank" rel="noopener noreferrer"
          style={{display:"block",textDecoration:"none",color:"inherit"}}>
          {inner}
        </a>
      ) : inner}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════ */
export default function App() {
  const [dark, setDark]   = useState(()=>typeof window!=="undefined"&&!!window.matchMedia?.("(prefers-color-scheme: dark)").matches);
  C = dark ? DARK : LIGHT;

  const [traders, setTraders]           = useState([]);
  const [positions, setPositions]       = useState({});
  const [feed, setFeed]                 = useState([]);
  const [category, setCategory]         = useState("OVERALL");
  const [period, setPeriod]             = useState("WEEK");
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [expandedTrader, setExpanded]   = useState(null);
  const [toasts, setToasts]             = useState([]);
  const [notifEnabled, setNotifEnabled] = useState(true);
  const [notifLog, setNotifLog]         = useState([]);
  const [notifFilters, setNotifFilters] = useState({position:true,pnl:true,newTrader:true,whale:true});
  const [lastUpdate, setLastUpdate]     = useState(null);
  const [tab, setTab]                   = useState("feed");
  const [search, setSearch]             = useState("");
  const [searchOpen, setSearchOpen]     = useState(false);
  const [searchInput, setSearchInput]   = useState("");
  const [catOpen, setCatOpen]           = useState(false);
  const [headerH, setHeaderH]           = useState(52);
  const [newsItems, setNewsItems]       = useState(SEED_NEWS);
  const [newsIdx, setNewsIdx]           = useState(0);
  const [newsAnim, setNewsAnim]         = useState(true); // true=slide-in

  const prevRef   = useRef([]);
  const notifId   = useRef(0);
  const headerRef = useRef(null);
  const searchRef = useRef(null);
  const newsIdxRef = useRef(0);

  /* carousel auto-advance */
  useEffect(()=>{
    const iv = setInterval(()=>{
      setNewsAnim(false);
      setTimeout(()=>{
        setNewsIdx(i=>{
          const next=(i+1)%Math.max(newsItems.length,1);
          newsIdxRef.current=next;
          return next;
        });
        setNewsAnim(true);
      },220);
    },5500);
    return ()=>clearInterval(iv);
  },[newsItems.length]);

  /* measure header height */
  useEffect(()=>{
    if (!headerRef.current) return;
    const ro = new ResizeObserver(e=>setHeaderH(e[0].contentRect.height));
    ro.observe(headerRef.current);
    return ()=>ro.disconnect();
  },[]);

  /* close search on outside click */
  useEffect(()=>{
    if (!searchOpen) return;
    const handler = (e)=>{ if (searchRef.current && !searchRef.current.contains(e.target)) { setSearchOpen(false); }};
    document.addEventListener("mousedown", handler);
    return ()=>document.removeEventListener("mousedown", handler);
  },[searchOpen]);

  /* ── Live news fetcher: Polymarket Gamma events + RSS sources ── */
  useEffect(()=>{
    let cancelled = false;

    async function fetchPolymarketEvents() {
      try {
        const res = await fetch(
          `${GAMMA_API}/events?active=true&closed=false&order=volume&ascending=false&limit=12`
        );
        if (!res.ok) return [];
        const data = await res.json();
        if (!Array.isArray(data)) return [];
        return data
          .filter(e => e.title && e.slug)
          .map(e => ({
            text: e.title,
            url: `https://polymarket.com/event/${e.slug}`,
            src: "Polymarket",
          }));
      } catch { return []; }
    }

    async function fetchRSSFeed(source) {
      try {
        const encoded = encodeURIComponent(source.url);
        const res = await fetch(`${RSS2JSON}?rss_url=${encoded}&count=4`);
        if (!res.ok) return [];
        const data = await res.json();
        if (data.status !== "ok" || !Array.isArray(data.items)) return [];
        return data.items
          .filter(item => item.title && item.link)
          .map(item => ({
            text: `${source.label}: ${item.title.replace(/&amp;/g,"&").replace(/&#039;/g,"'").trim()}`,
            url: item.link,
            src: source.label,
          }));
      } catch { return []; }
    }

    async function refresh() {
      // Fetch from multiple sources in parallel with a 6s timeout each
      const timeout = ms => new Promise((_,rej)=>setTimeout(()=>rej(new Error("timeout")),ms));

      const [polyItems, ...rssResults] = await Promise.allSettled([
        Promise.race([fetchPolymarketEvents(), timeout(6000)]),
        // Pick 4 random RSS sources each refresh for variety
        ...RSS_SOURCES
          .sort(()=>Math.random()-0.5)
          .slice(0,4)
          .map(src => Promise.race([fetchRSSFeed(src), timeout(6000)])),
      ]);

      if (cancelled) return;

      const poly = polyItems.status==="fulfilled" ? (polyItems.value||[]) : [];
      const rss  = rssResults
        .filter(r=>r.status==="fulfilled" && Array.isArray(r.value))
        .flatMap(r=>r.value);

      // Interleave: 1 polymarket + 2 RSS alternating
      const merged = [];
      let pi=0, ri=0;
      while (pi<poly.length || ri<rss.length) {
        if (pi<poly.length)  merged.push(poly[pi++]);
        if (ri<rss.length)   merged.push(rss[ri++]);
        if (ri<rss.length)   merged.push(rss[ri++]);
      }

      const final = merged.length >= 6 ? merged : [...merged, ...SEED_NEWS];
      setNewsItems(final.slice(0, 30));
    }

    refresh();
    const iv = setInterval(refresh, 90_000); // refresh every 90s
    return ()=>{ cancelled=true; clearInterval(iv); };
  },[]);

  /* ── notifications ── */
  const addNotif = useCallback((msg,type,trader=null)=>{
    if (!notifEnabled) return;
    const key = {position:"position",profit:"pnl",loss:"pnl",new:"newTrader",whale:"whale"}[type];
    if (key && !notifFilters[key]) return;
    const id = ++notifId.current;
    const url = trader?._notifUrl ||
      (trader?.proxyWallet ? `${POLY_BASE}/profile/${trader.proxyWallet}` : null);
    const item = {id,msg,type,trader,url,ts:new Date()};
    setToasts(prev=>[item,...prev].slice(0,3));
    setNotifLog(prev=>[item,...prev].slice(0,100));
    setTimeout(()=>setToasts(prev=>prev.filter(x=>x.id!==id)),4500);
  },[notifEnabled,notifFilters]);

  /* ── leaderboard ── */
  const fetchLeaderboard = useCallback(async()=>{
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/v1/leaderboard?category=${category}&timePeriod=${period}&orderBy=PNL&limit=20`);
      if (!res.ok) throw new Error();
      const list = await res.json();
      const prevMap = Object.fromEntries(prevRef.current.map(tr=>[tr.proxyWallet,tr]));
      const prevSet = new Set(prevRef.current.map(tr=>tr.proxyWallet));
      list.forEach(tr=>{
        const name = tr.userName||tr.proxyWallet?.slice(0,10);
        if (!prevSet.has(tr.proxyWallet)&&prevRef.current.length) addNotif(S.notifMsgNewTrader(name),"new",tr);
        const prev = prevMap[tr.proxyWallet];
        if (prev) {
          const diff=(tr.pnl||0)-(prev.pnl||0);
          if (Math.abs(diff)>1000) addNotif(S.notifMsgPnl(name,(diff>0?"+":"")+formatUSD(diff)),diff>0?"profit":"loss",tr);
          if (Math.abs(diff)>10000) addNotif(S.notifMsgWhale(name,formatUSD(diff)),"whale",tr);
        }
      });
      prevRef.current=list; setTraders(list); setLastUpdate(new Date());
    } catch {
      setError(S.apiError); setTraders(generateDemo()); setLastUpdate(new Date());
    } finally { setLoading(false); }
  },[category,period,addNotif]);

  /* ── positions ── */
  const fetchPositions = useCallback(async(wallet)=>{
    try {
      const res = await fetch(`${API}/v1/positions?user=${wallet}&sizeThreshold=0.01&limit=10`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      const list = Array.isArray(data)?data:(data.results||[]);
      setPositions(p=>({...p,[wallet]:list}));
      list.slice(0,3).forEach(pos=>{
        const trader = traders.find(tr=>tr.proxyWallet===wallet);
        const item = {
          id:`${wallet}-${pos.conditionId||Math.random()}`,
          trader,wallet,
          market:pos.title||pos.market||"Market",
          marketSlug:pos.slug||null,
          outcome:pos.outcome||(pos.currentValue>0.5?"YES":"NO"),
          size:pos.currentValue||pos.size||0,
          price:pos.price||pos.avgPrice||0,
          pnl:pos.cashPnl||pos.pnl||0,
          ts:pos.startDate||new Date().toISOString(),
        };
        setFeed(f=>f.some(x=>x.id===item.id)?f:[item,...f].slice(0,80));
        const _notifTrader = item.marketSlug
          ? {...(trader||{}), _notifUrl:marketLink(item.marketSlug)}
          : trader;
        addNotif(S.notifMsgPosition(trader?.userName||wallet.slice(0,10),item.market.slice(0,40)),"position",_notifTrader);
      });
    } catch {}
  },[traders,addNotif]);

  /* ── demo sim ── */
  useEffect(()=>{
    if (!traders.length) return;
    const iv = setInterval(()=>{
      const trader = traders[Math.floor(Math.random()*Math.min(5,traders.length))];
      if (!trader) return;
      const m = DEMO_MARKETS[Math.floor(Math.random()*DEMO_MARKETS.length)];
      const item = {
        id:`sim-${Date.now()}-${Math.random()}`,
        trader,wallet:trader.proxyWallet,
        market:m.title,marketSlug:m.slug,
        outcome:Math.random()>0.5?"YES":"NO",
        size:Math.random()*50000+500,
        price:Math.random()*0.8+0.1,
        pnl:(Math.random()-0.4)*8000,
        ts:new Date().toISOString(),isNew:true,
      };
      setFeed(f=>[item,...f].slice(0,80));
      addNotif(S.notifMsgPosition(trader.userName||trader.proxyWallet?.slice(0,10),m.title),"position",
        {...trader, _notifUrl:`${POLY_BASE}/event/${m.slug}`});
    },10_000);
    return ()=>clearInterval(iv);
  },[traders,addNotif]);

  useEffect(()=>{
    fetchLeaderboard();
    const iv=setInterval(fetchLeaderboard,30_000);
    return ()=>clearInterval(iv);
  },[fetchLeaderboard]);
  useEffect(()=>{ if(traders.length) traders.slice(0,5).forEach(tr=>fetchPositions(tr.proxyWallet)); },[traders]);

  /* filtered */
  const q = search.toLowerCase();
  const filteredTraders = traders.filter(tr=>!q||(tr.userName||"").toLowerCase().includes(q)||(tr.proxyWallet||"").toLowerCase().includes(q));
  const filteredFeed    = feed.filter(item=>!q||(item.market||"").toLowerCase().includes(q)||(item.trader?.userName||"").toLowerCase().includes(q));

  const traderLink = w=>`${POLY_BASE}/profile/${w}`;
  const marketLink = s=>s?`${POLY_BASE}/event/${s}`:"#";

  return (
    <div style={{minHeight:"100vh",background:C.bg,fontFamily:"'DM Mono','Courier New',monospace",
      color:C.text,width:"100%","--hover-bg":dark?"#222":"#f7f7f7"}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=DM+Sans:wght@500;600;700&display=swap');
        html,body{margin:0;padding:0;width:100%;overflow-x:hidden}
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        a{color:inherit;text-decoration:none}
        a:hover{text-decoration:underline;text-decoration-color:#aaa}
        @keyframes fadeSlide{from{opacity:0;transform:translateX(16px)}to{opacity:1;transform:translateX(0)}}
        @keyframes blink{0%,100%{opacity:1}50%{opacity:0.2}}
        @keyframes slideUp{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:translateY(0)}}
        @keyframes slideDown{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}
        @keyframes newsIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}
        @keyframes newsOut{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(-6px)}}
        .hrow:hover{background:var(--hover-bg)!important}
        .pill-btn:hover{background:${C.text}!important;color:${dark?"#111":"#fff"}!important;border-color:${C.text}!important}
        .tab-btn:hover{color:${C.text}!important}
        .cat-item:hover{background:${dark?"#2a2a2a":"#f0f0f0"}!important}
        input:focus{outline:none}
        button{cursor:pointer;font-family:'DM Mono',monospace}
        ::-webkit-scrollbar{width:3px}
        ::-webkit-scrollbar-thumb{background:${C.border}}
        @media(max-width:640px){
          .feed-grid{grid-template-columns:1fr 50px 80px!important}
          .feed-col-size,.feed-col-when{display:none!important}
          .traders-grid{grid-template-columns:26px 1fr 90px 20px!important}
          .traders-col-vol,.traders-col-win{display:none!important}
          .content-pad{padding:10px 12px!important}
          .filter-bar{padding:6px 12px!important}
          .tab-bar{padding:0 10px!important}
          .header-pad{padding:9px 12px!important}
          .toast-wrap{right:8px!important;left:8px!important;width:auto!important}
        }
      `}</style>

      {/* ══ NEWS CAROUSEL — sticky top:0, one item at a time ══ */}
      {(()=>{
        const item = newsItems[newsIdx] || newsItems[0];
        const itemUrl = item?.url;
        const itemText = item?.text || item || "";
        const total = newsItems.length;
        return (
          <div style={{
            width:"100%", background:C.text, color:dark?"#111":"#fff",
            height:28, display:"flex", alignItems:"center",
            position:"sticky", top:0, zIndex:110, overflow:"hidden",
          }}>
            {/* Prev button */}
            <button onClick={()=>{
              setNewsAnim(false);
              setTimeout(()=>{ setNewsIdx(i=>(i-1+total)%total); setNewsAnim(true); },150);
            }} style={{
              background:"none",border:"none",color:dark?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.5)",
              padding:"0 10px",fontSize:13,height:"100%",flexShrink:0,cursor:"pointer",
              transition:"color 0.15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=dark?"#000":"#fff"}
            onMouseLeave={e=>e.currentTarget.style.color=dark?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.5)"}>
              ‹
            </button>

            {/* News item */}
            <div style={{flex:1,overflow:"hidden",display:"flex",alignItems:"center",height:"100%"}}>
              <a
                key={newsIdx}
                href={itemUrl||"https://polymarket.com"}
                target="_blank" rel="noopener noreferrer"
                style={{
                  fontSize:11,letterSpacing:"0.01em",
                  color:"inherit",textDecoration:"none",cursor:"pointer",
                  whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",
                  display:"block",width:"100%",
                  animation: newsAnim ? "newsIn 0.22s ease" : "newsOut 0.18s ease",
                  opacity: newsAnim ? 1 : 0,
                }}
                onMouseEnter={e=>e.currentTarget.style.textDecoration="underline"}
                onMouseLeave={e=>e.currentTarget.style.textDecoration="none"}
              >
                {itemText}
              </a>
            </div>

            {/* Counter */}
            <div style={{
              flexShrink:0, padding:"0 8px",
              fontSize:9, opacity:0.45, fontFamily:"'DM Mono',monospace",
              letterSpacing:"0.05em",
            }}>
              {newsIdx+1}/{total}
            </div>

            {/* Next button */}
            <button onClick={()=>{
              setNewsAnim(false);
              setTimeout(()=>{ setNewsIdx(i=>(i+1)%total); setNewsAnim(true); },150);
            }} style={{
              background:"none",border:"none",color:dark?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.5)",
              padding:"0 10px",fontSize:13,height:"100%",flexShrink:0,cursor:"pointer",
              transition:"color 0.15s",
            }}
            onMouseEnter={e=>e.currentTarget.style.color=dark?"#000":"#fff"}
            onMouseLeave={e=>e.currentTarget.style.color=dark?"rgba(0,0,0,0.5)":"rgba(255,255,255,0.5)"}>
              ›
            </button>
          </div>
        );
      })()}

      {/* ══ TOASTS — dismissible, swipe-up or click X ══ */}
      <div className="toast-wrap" style={{
        position:"fixed",
        top:28+headerH+8,
        right:14, zIndex:200,
        display:"flex", flexDirection:"column", gap:7, width:288,
        pointerEvents:"none",
      }}>
        {toasts.map(n=>(
          <div key={n.id} style={{pointerEvents:"auto", animation:"fadeSlide 0.22s ease"}}>
            <DismissibleToast
              n={n}
              dark={dark}
              onDismiss={()=>setToasts(prev=>prev.filter(x=>x.id!==n.id))}
            />
          </div>
        ))}
      </div>

      {/* ══ HEADER ══ */}
      <div ref={headerRef} className="header-pad" style={{
        background:C.surface,borderBottom:`1px solid ${C.border}`,
        padding:"10px 20px",display:"flex",alignItems:"center",
        justifyContent:"space-between",position:"sticky",top:28,zIndex:100,width:"100%",
      }}>
        {/* Left */}
        <div style={{display:"flex",alignItems:"center",gap:12}}>
          <div style={{display:"flex",flexDirection:"column",gap:2}}>
            <span style={{fontFamily:"'DM Sans',sans-serif",fontSize:16,fontWeight:700,letterSpacing:"-0.04em"}}>{S.appName}</span>
            <a href="https://polycule.trade/join/m8nznt" target="_blank" rel="noopener noreferrer"
              style={{fontSize:9,fontWeight:700,color:"#a855f7",letterSpacing:"0.02em",
                textDecoration:"none",lineHeight:1,whiteSpace:"nowrap"}}
              onMouseEnter={e=>e.currentTarget.style.color="#c084fc"}
              onMouseLeave={e=>e.currentTarget.style.color="#a855f7"}>
              ⚡ Trade smarter. Join the bot →
            </a>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:5,border:`1px solid ${C.border}`,borderRadius:20,padding:"2px 8px"}}>
            <div style={{width:5,height:5,borderRadius:"50%",background:C.text,animation:"blink 2.5s infinite"}}/>
            <span style={{fontSize:9,fontWeight:600,letterSpacing:"0.1em"}}>{S.live}</span>
          </div>
          {lastUpdate&&(
            <span style={{fontSize:10,color:C.textDim}}>
              {loading?S.refreshing:`↻ ${timeAgo(lastUpdate)}`}
            </span>
          )}
        </div>

        {/* Right */}
        <div style={{display:"flex",alignItems:"center",gap:6,position:"relative"}} ref={searchRef}>

          {/* Search — icon only, expands on click */}
          <div style={{display:"flex",alignItems:"center",position:"relative"}}>
            <button onClick={()=>{setSearchOpen(o=>!o); if(!searchOpen) setTimeout(()=>document.getElementById("search-input")?.focus(),50);}}
              style={{
                background:searchOpen||search?C.text:"none",
                border:`1px solid ${searchOpen||search?C.text:C.border}`,
                borderRadius:6,padding:"5px 8px",
                color:searchOpen||search?(dark?"#111":"#fff"):C.textMid,
                fontSize:14,transition:"all 0.15s",
              }}>⌕</button>

            {/* Expanding search panel */}
            {searchOpen&&(
              <div style={{
                position:"absolute",top:"calc(100% + 6px)",right:0,
                background:C.surface,border:`1px solid ${C.border}`,
                borderRadius:8,padding:"8px 10px",
                display:"flex",alignItems:"center",gap:6,
                animation:"slideDown 0.15s ease",zIndex:300,
                boxShadow:`0 6px 20px ${dark?"rgba(0,0,0,0.4)":"rgba(0,0,0,0.1)"}`,
                minWidth:260,
              }}>
                <input id="search-input" value={searchInput}
                  onChange={e=>setSearchInput(e.target.value)}
                  onKeyDown={e=>{
                    if(e.key==="Enter"){setSearch(searchInput);setSearchOpen(false);}
                    if(e.key==="Escape"){setSearchOpen(false);setSearch("");setSearchInput("");}
                  }}
                  placeholder={S.searchPlaceholder}
                  style={{background:"none",border:"none",fontSize:12,color:C.text,
                    fontFamily:"'DM Mono',monospace",flex:1}}/>
                {searchInput&&(
                  <button onClick={()=>{setSearch("");setSearchInput("");}}
                    style={{background:"none",border:"none",color:C.textDim,fontSize:12}}>✕</button>
                )}
                <button onClick={()=>{setSearch(searchInput);setSearchOpen(false);}}
                  style={{background:C.text,border:"none",borderRadius:4,padding:"3px 9px",
                    color:dark?"#111":"#fff",fontSize:10,fontWeight:500}}>
                  Go
                </button>
              </div>
            )}
          </div>

          {/* Dark mode */}
          <button onClick={()=>setDark(d=>!d)} title={dark?S.lightMode:S.darkMode}
            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,
              padding:"5px 8px",fontSize:13,color:C.textMid}}>
            {dark?"☀":"☾"}
          </button>

          {/* Notif toggle */}
          <button onClick={()=>setNotifEnabled(x=>!x)} title={notifEnabled?S.notifGlobalOn:S.notifGlobalOff}
            style={{
              background:notifEnabled?C.text:"none",
              border:`1px solid ${notifEnabled?C.text:C.border}`,
              borderRadius:6,padding:"5px 8px",fontSize:12,
              color:notifEnabled?(dark?"#111":"#fff"):C.textDim,
              transition:"all 0.15s",
            }}>🔔</button>

          {/* Refresh */}
          <button onClick={fetchLeaderboard} disabled={loading}
            style={{background:"none",border:`1px solid ${C.border}`,borderRadius:6,
              padding:"5px 8px",fontSize:11,color:C.textMid,opacity:loading?0.4:1}}>⟳</button>
        </div>
      </div>

      {/* Error */}
      {error&&(
        <div style={{background:C.bg,borderBottom:`1px solid ${C.border}`,
          padding:"6px 20px",fontSize:10,color:C.textMid,textAlign:"center",width:"100%"}}>
          {error}
        </div>
      )}

      {/* ══ TABS ══ */}
      <div className="tab-bar" style={{
        background:C.surface,borderBottom:`1px solid ${C.border}`,
        padding:"0 20px",display:"flex",width:"100%",overflowX:"auto",
        position:"sticky",top:28+headerH,zIndex:90,
      }}>
        {[
          {key:"feed",          label:S.tabFeed},
          {key:"traders",       label:S.tabTraders},
          {key:"notifications", label:S.tabNotifs(notifLog.length)},
        ].map(tb=>(
          <button key={tb.key} className="tab-btn" onClick={()=>setTab(tb.key)} style={{
            background:"none",border:"none",padding:"10px 16px",
            fontSize:11,fontWeight:600,letterSpacing:"0.02em",whiteSpace:"nowrap",flexShrink:0,
            color:tab===tb.key?C.text:C.textDim,
            borderBottom:`2px solid ${tab===tb.key?C.text:"transparent"}`,
            transition:"all 0.12s",
          }}>{tb.label}</button>
        ))}
        {/* active search indicator */}
        {search&&(
          <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,padding:"0 8px",fontSize:10,color:C.textMid}}>
            <span>"{search}"</span>
            <button onClick={()=>{setSearch("");setSearchInput("");}}
              style={{background:"none",border:"none",fontSize:11,color:C.textDim}}>✕</button>
          </div>
        )}
      </div>

      {/* ══ FILTER BAR ══ */}
      <div className="filter-bar" style={{
        background:C.surface,borderBottom:`1px solid ${C.border}`,
        padding:"7px 20px",display:"flex",gap:6,flexWrap:"wrap",
        alignItems:"center",width:"100%",position:"relative",
      }}>
        {/* Period */}
        <span style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginRight:2}}>{S.periodLabel}</span>
        {PERIODS.map(p=>(
          <button key={p} className="pill-btn" onClick={()=>setPeriod(p)} style={{
            background:period===p?C.text:"none",
            border:`1px solid ${period===p?C.text:C.border}`,
            borderRadius:20,padding:"2px 9px",
            color:period===p?(dark?"#111":"#fff"):C.textMid,
            fontSize:9,fontWeight:500,transition:"all 0.12s",
          }}>{p}</button>
        ))}

        <div style={{width:1,height:12,background:C.border,margin:"0 4px"}}/>

        {/* Category dropdown trigger */}
        <span style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginRight:2}}>{S.catLabel}</span>
        <button onClick={()=>setCatOpen(o=>!o)} className="pill-btn" style={{
          background:catOpen||category!=="OVERALL"?C.text:"none",
          border:`1px solid ${catOpen||category!=="OVERALL"?C.text:C.border}`,
          borderRadius:20,padding:"2px 11px",
          color:catOpen||category!=="OVERALL"?(dark?"#111":"#fff"):C.textMid,
          fontSize:9,fontWeight:600,display:"flex",alignItems:"center",gap:5,transition:"all 0.12s",
        }}>
          {category} <span style={{fontSize:8,opacity:0.7}}>{catOpen?"▲":"▼"}</span>
        </button>

        {/* Category grid dropdown */}
        {catOpen&&(
          <div style={{
            position:"absolute",top:"100%",left:0,right:0,zIndex:150,
            background:C.surface,
            borderTop:`1px solid ${C.border}`,borderBottom:`1px solid ${C.border}`,
            padding:"12px 20px",
            display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(120px,1fr))",gap:6,
            animation:"slideDown 0.15s ease",
            boxShadow:`0 8px 24px ${dark?"rgba(0,0,0,0.45)":"rgba(0,0,0,0.08)"}`,
          }}>
            {CATEGORIES.map(c=>(
              <button key={c} className="cat-item" onClick={()=>{setCategory(c);setCatOpen(false);}} style={{
                background:category===c?C.text:(dark?"#1e1e1e":"#f7f7f7"),
                border:`1px solid ${category===c?C.text:C.border}`,
                borderRadius:8,padding:"8px 12px",
                color:category===c?(dark?"#111":"#fff"):C.text,
                fontSize:11,fontWeight:category===c?700:500,
                textAlign:"left",transition:"all 0.1s",
                display:"flex",alignItems:"center",gap:8,
              }}>
                <span style={{fontSize:15}}>
                  {{"OVERALL":"◎","POLITICS":"🏛","SPORTS":"⚽","CRYPTO":"₿","CULTURE":"🎭",
                    "ECONOMICS":"📈","TECH":"💻","FINANCE":"💵"}[c]||"·"}
                </span>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      {catOpen&&<div onClick={()=>setCatOpen(false)} style={{position:"fixed",inset:0,zIndex:140}}/>}

      {/* ══ CONTENT ══ */}
      <div className="content-pad" style={{padding:"14px 20px",width:"100%"}}>

        {/* ── FEED ── */}
        {tab==="feed"&&(
          <div>
            <div style={{fontSize:10,color:C.textDim,marginBottom:8}}>
              {filteredFeed.length} · {S.updatesEvery}
            </div>
            {/* Column header */}
            <div className="feed-grid" style={{display:"grid",
              gridTemplateColumns:"1fr 56px 88px 88px 56px",
              padding:"5px 12px",fontSize:9,color:C.textDim,letterSpacing:"0.08em",
              borderBottom:`1px solid ${C.border}`,background:C.surface}}>
              <span>{S.colTrader}</span>
              <span style={{textAlign:"center"}}>{S.colOutcome}</span>
              <span className="feed-col-size" style={{textAlign:"right"}}>{S.colSize}</span>
              <span style={{textAlign:"right"}}>{S.colPnl}</span>
              <span className="feed-col-when" style={{textAlign:"right"}}>{S.colWhen}</span>
            </div>
            {filteredFeed.length===0?(
              <div style={{padding:"50px 0",textAlign:"center",fontSize:12,color:C.textDim}}>{S.noTrades}</div>
            ):filteredFeed.map(item=>(
              <div key={item.id} className="hrow feed-grid" style={{display:"grid",
                gridTemplateColumns:"1fr 56px 88px 88px 56px",
                padding:"9px 12px",alignItems:"center",
                borderBottom:`1px solid ${C.border}`,background:C.surface,animation:"slideUp 0.25s ease"}}>
                <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                  <TraderAvatar trader={item.trader||{}} size={28}/>
                  <div style={{minWidth:0}}>
                    <a href={traderLink(item.wallet)} target="_blank" rel="noopener noreferrer"
                      style={{fontSize:12,fontWeight:600,display:"block",
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {item.trader?.userName||item.wallet?.slice(0,12)||S.anonymous}
                      {item.trader?.verifiedBadge&&<span style={{marginLeft:3,fontSize:9,color:C.textDim}}>{S.verified}</span>}
                    </a>
                    <a href={item.marketSlug?marketLink(item.marketSlug):"#"}
                      target={item.marketSlug?"_blank":"_self"} rel="noopener noreferrer"
                      style={{fontSize:10,color:C.textMid,display:"block",
                        whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                      {item.market}
                    </a>
                  </div>
                </div>
                <div style={{textAlign:"center"}}>
                  <span style={{fontSize:11,fontWeight:700,fontFamily:"'DM Mono',monospace",
                    color:item.outcome==="YES"?C.text:C.textMid}}>{item.outcome}</span>
                </div>
                <div className="feed-col-size" style={{textAlign:"right",fontSize:12,fontFamily:"'DM Mono',monospace"}}>
                  {formatUSD(item.size)}
                </div>
                <div style={{textAlign:"right"}}><PnlBadge val={item.pnl}/></div>
                <div className="feed-col-when" style={{textAlign:"right",fontSize:9,color:C.textDim}}>
                  {timeAgo(item.ts)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── TRADERS ── */}
        {tab==="traders"&&(
          <div>
            <div className="traders-grid" style={{display:"grid",
              gridTemplateColumns:"32px 1fr 130px 110px 68px 22px",
              padding:"5px 12px",fontSize:9,color:C.textDim,letterSpacing:"0.08em",
              borderBottom:`1px solid ${C.border}`,background:C.surface}}>
              <span>{S.colRank}</span><span>TRADER</span>
              <span style={{textAlign:"right"}}>{S.colPnl}</span>
              <span className="traders-col-vol" style={{textAlign:"right"}}>{S.colVol}</span>
              <span className="traders-col-win" style={{textAlign:"right"}}>{S.colWin}</span>
              <span/>
            </div>
            {loading&&!filteredTraders.length?(
              <div style={{padding:"50px 0",textAlign:"center",fontSize:12,color:C.textDim}}>{S.loading}</div>
            ):filteredTraders.map((trader,i)=>(
              <div key={trader.proxyWallet}>
                <div className="hrow traders-grid" onClick={()=>{
                  setExpanded(expandedTrader===trader.proxyWallet?null:trader.proxyWallet);
                  if (!positions[trader.proxyWallet]) fetchPositions(trader.proxyWallet);
                }} style={{display:"grid",
                  gridTemplateColumns:"32px 1fr 130px 110px 68px 22px",
                  padding:"10px 12px",alignItems:"center",
                  borderBottom:`1px solid ${C.border}`,background:C.surface,cursor:"pointer"}}>
                  <div style={{fontSize:11,fontWeight:600,color:i<3?C.text:C.textDim}}>{i+1}</div>
                  <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}>
                    <TraderAvatar trader={trader} size={28}/>
                    <div style={{minWidth:0}}>
                      <a href={traderLink(trader.proxyWallet)} target="_blank" rel="noopener noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{fontSize:13,fontWeight:600,display:"block",
                          whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                        {trader.userName||trader.proxyWallet?.slice(0,14)+"..."}
                        {trader.verifiedBadge&&<span style={{marginLeft:3,fontSize:9,color:C.textDim}}>{S.verified}</span>}
                      </a>
                      <div style={{fontSize:9,color:C.textDim}}>
                        {trader.proxyWallet?.slice(0,8)}…{trader.proxyWallet?.slice(-4)}
                      </div>
                    </div>
                  </div>
                  <div style={{textAlign:"right"}}><PnlBadge val={trader.pnl}/></div>
                  <div className="traders-col-vol" style={{textAlign:"right",fontSize:11,fontFamily:"'DM Mono',monospace",color:C.textMid}}>
                    {formatUSD(trader.vol)}
                  </div>
                  <div className="traders-col-win" style={{textAlign:"right",fontSize:11,fontFamily:"'DM Mono',monospace"}}>
                    {trader.winRate?Math.round(trader.winRate*100)+"%":"—"}
                  </div>
                  <div style={{textAlign:"right",fontSize:10,color:C.textDim}}>
                    {expandedTrader===trader.proxyWallet?"▲":"▼"}
                  </div>
                </div>
                {expandedTrader===trader.proxyWallet&&(
                  <div style={{background:C.bg,borderBottom:`1px solid ${C.border}`,
                    padding:"12px 12px 12px 52px",animation:"slideUp 0.2s ease"}}>
                    <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginBottom:8}}>{S.activePositions}</div>
                    {positions[trader.proxyWallet]===undefined?(
                      <div style={{fontSize:11,color:C.textDim}}>{S.loading}</div>
                    ):!positions[trader.proxyWallet]?.length?(
                      <div style={{fontSize:11,color:C.textDim}}>{S.noPositions}</div>
                    ):(
                      <div style={{display:"flex",flexDirection:"column",gap:3}}>
                        {positions[trader.proxyWallet].slice(0,6).map((pos,j)=>(
                          <div key={j} style={{display:"flex",alignItems:"center",gap:8,
                            padding:"6px 10px",background:C.surface,
                            border:`1px solid ${C.border}`,borderRadius:5}}>
                            <span style={{fontSize:10,fontWeight:600,fontFamily:"'DM Mono',monospace",
                              color:(pos.outcome==="YES"||pos.currentValue>0.5)?C.text:C.textMid,width:26}}>
                              {pos.outcome||(pos.currentValue>0.5?"YES":"NO")}
                            </span>
                            <a href={pos.slug?marketLink(pos.slug):"#"} target={pos.slug?"_blank":"_self"} rel="noopener noreferrer"
                              style={{flex:1,fontSize:11,color:C.textMid,
                                whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>
                              {pos.title||pos.market||"Market"}
                            </a>
                            <span style={{fontSize:11,fontFamily:"'DM Mono',monospace",flexShrink:0}}>
                              {formatUSD(pos.currentValue||pos.size)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    <div style={{marginTop:10,display:"flex",gap:10,alignItems:"center",flexWrap:"wrap"}}>
                      <a href={traderLink(trader.proxyWallet)} target="_blank" rel="noopener noreferrer"
                        style={{fontSize:10,color:C.textMid,borderBottom:`1px solid ${C.border}`}}>
                        {S.viewOnPoly}
                      </a>
                      <span style={{marginLeft:"auto"}}><PnlBadge val={trader.pnl}/></span>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── NOTIFICATIONS ── */}
        {tab==="notifications"&&(
          <div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,
              borderRadius:8,padding:"12px 14px",marginBottom:12}}>
              <div style={{fontSize:9,color:C.textDim,letterSpacing:"0.1em",marginBottom:8}}>
                {S.notifFiltersTitle}
                <span style={{marginLeft:8,color:notifEnabled?C.text:C.textDim,fontWeight:700}}>
                  — {notifEnabled?S.notifsOn:S.notifsOff}
                </span>
              </div>
              <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                {S.notifTypes.map(({key,label,icon})=>{
                  const on=notifFilters[key];
                  return (
                    <button key={key} className="pill-btn"
                      onClick={()=>setNotifFilters(f=>({...f,[key]:!f[key]}))}
                      style={{
                        background:on?C.text:"none",
                        border:`1px solid ${on?C.text:C.border}`,
                        borderRadius:20,padding:"4px 12px",
                        color:on?(dark?"#111":"#fff"):C.textMid,
                        fontSize:10,fontWeight:500,
                        display:"flex",alignItems:"center",gap:5,transition:"all 0.12s",
                      }}>
                      <span>{icon}</span>
                      <span>{label}</span>
                      <span style={{fontSize:9,opacity:0.5}}>·{on?S.notifsOn:S.notifsOff}</span>
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div style={{fontSize:10,color:C.textDim}}>{S.notifRecords(notifLog.length)}</div>
              <button onClick={()=>setNotifLog([])}
                style={{background:"none",border:`1px solid ${C.border}`,borderRadius:5,
                  padding:"3px 9px",fontSize:9,color:C.textMid}}>{S.clearNotifs}</button>
            </div>
            {notifLog.length===0?(
              <div style={{padding:"50px 0",textAlign:"center",fontSize:12,color:C.textDim}}>{S.noNotifs}</div>
            ):notifLog.map((n,i)=>(
              <div key={n.id} style={{display:"flex",alignItems:"center",gap:9,
                padding:"9px 12px",borderBottom:`1px solid ${C.border}`,
                background:C.surface,opacity:i>30?0.4:1}}>
                {n.trader&&<TraderAvatar trader={n.trader} size={26}/>}
                <div style={{flex:1,fontSize:11,color:C.text,lineHeight:1.4}}>{n.msg}</div>
                <div style={{fontSize:9,color:C.textDim,flexShrink:0}}>{timeAgo(n.ts)}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{borderTop:`1px solid ${C.border}`,padding:"10px 20px",marginTop:16,
        display:"flex",justifyContent:"space-between",fontSize:9,color:C.textDim,
        width:"100%",flexWrap:"wrap",gap:4}}>
        <span>{S.footerApi}</span>
        <span>{new Date().toLocaleString("en-US")}</span>
      </div>
    </div>
  );
}
