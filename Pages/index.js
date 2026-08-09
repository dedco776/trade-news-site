import { useState, useEffect } from 'react';
import Head from 'next/head';

export default function Home() {
  const [currentLang, setCurrentLang] = useState('uz');
  const [currentSymbol, setCurrentSymbol] = useState('AAPL');
  const [favorites, setFavorites] = useState(['AAPL', 'NVDA', 'SPUS']);
  const [news, setNews] = useState([]);
  const [signal, setSignal] = useState({ action: 'BUY', entry: '$200.00', tp: '$214.00', sl: '$190.00' });
  const [topBuy, setTopBuy] = useState([]);
  const [topSell, setTopSell] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Position Calculator states
  const [depo, setDepo] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);

  // Market session state
  const [marketStatus, setMarketStatus] = useState('NYSE: CLOSED');
  const [marketTimer, setMarketTimer] = useState('--:--:--');
  const [isOpen, setIsOpen] = useState(false);

  // Halol tekshiruv ma'lumotlar bazasi
  const halolDatabase = {
    'SPUS': { status: '100% Halol', type: 'halal' },
    'HLAL': { status: '100% Halol', type: 'halal' },
    'AAPL': { status: 'Halol Compliant', type: 'halal' },
    'NVDA': { status: 'Halol Compliant', type: 'halal' },
    'MSFT': { status: 'Halol Compliant', type: 'halal' },
    'AMZN': { status: 'Halol Compliant', type: 'halal' },
    'TSLA': { status: 'Qayta Tekshiruvda', type: 'check' },
    'INTC': { status: 'Qayta Tekshiruvda', type: 'check' },
    'NKE':  { status: 'Halol Compliant', type: 'halal' },
    'SBUX': { status: 'Non-Compliant', type: 'non' },
    'PYPL': { status: 'Non-Compliant', type: 'non' }
  };

  const i18n = {
    uz: {
      subtitle: "Halol Swing Terminal",
      chart_title: "DCT Grafik Tahlil",
      signal_title: "Bozor Tahlili & Signal",
      news_title: "DCT Bozor Yangiliklari",
      entry: "Kirish Narxi",
      tp: "Take Profit",
      sl: "Stop Loss",
      tech_analysis: "Texnik Tahlil:",
      fund_analysis: "Fundamental Tahlil:",
      read_more: "Batafsil o'qish",
      search_ph: "Aksiya tikerini kiriting (masalan: AAPL, NVDA)...",
      loading: "Yuklanmoqda...",
      no_news: "Ushbu aksiya bo'yicha yangilik topilmadi.",
      error: "Xatolik yuz berdi.",
      tech_pos: "Support darajasida shamlar to'planmoqda, narx yuqoriga sinib o'tish arafasida.",
      tech_neg: "Narx konsolidatsiya zonasida, aniq trend shakllanmaguncha kutgan ma'qul.",
      fund_pos: "bo'yicha so'nggi yangiliklar ijobiy fond yaratmoqda.",
      fund_neg: "Bozorda noaniqlik va ehtiyotkorlik ustunlik qilmoqda.",
      top_buy_title: "TOP 5 BUY Signallar",
      top_sell_title: "TOP 5 SELL Signallar",
      calc_title: "Position Size & Risk Calculator",
      depo_label: "Depozit Qiymati ($)",
      risk_label: "Tavakkal Foizi (%)",
      risk_amt: "Risk Summasi:",
      shares_amt: "Aksiya Soni (Lot):",
      pos_amt: "Pozitsiya Hujmi:",
      rr_title: "Risk/Mukofot Nisbati (R:R):",
      watchlist_title: "Watchlist (Saralangan)",
      no_favs: "Hozircha saqlangan aksiyalar yo'q.",
      halal_status: "100% Halol"
    },
    ru: {
      subtitle: "Халяль Свинг Терминал",
      chart_title: "DCT График Анализ",
      signal_title: "Анализ Рынка и Сигнал",
      news_title: "DCT Новости Рынка",
      entry: "Точка Входа",
      tp: "Тейк Профит",
      sl: "Стоп Лосс",
      tech_analysis: "Технический Анализ:",
      fund_analysis: "Фундаментальный Анализ:",
      read_more: "Читать далее",
      search_ph: "Введите тикер (например: AAPL, NVDA)...",
      loading: "Загрузка...",
      no_news: "Новости по данной акции не найдены.",
      error: "Произошла ошибка.",
      tech_pos: "Свечи консолидируются на уровне поддержки, цена готовится к пробою вверх.",
      tech_neg: "Цена в зоне консолидации, лучше подождать формирования тренда.",
      fund_pos: "последние новости создают позитивный фон.",
      fund_neg: "На рынке преобладает неопределенность и осторожность.",
      top_buy_title: "ТОП 5 ПОКУПКА (BUY)",
      top_sell_title: "ТОП 5 ПРОДАЖА (SELL)",
      calc_title: "Калькулятор Риска и Лота",
      depo_label: "Депозит ($)",
      risk_label: "Риск (%)",
      risk_amt: "Сумма Риска:",
      shares_amt: "Кол-во Акций (Лот):",
      pos_amt: "Объем Позиции:",
      rr_title: "Соотношение Риск/Прибыль (R:R):",
      watchlist_title: "Избранное (Watchlist)",
      no_favs: "Нет сохраненных акций.",
      halal_status: "100% Халяль"
    },
    en: {
      subtitle: "Halal Swing Terminal",
      chart_title: "DCT Chart Analysis",
      signal_title: "Market Analysis & Signal",
      news_title: "DCT Market News",
      entry: "Entry Price",
      tp: "Take Profit",
      sl: "Stop Loss",
      tech_analysis: "Technical Analysis:",
      fund_analysis: "Fundamental Analysis:",
      read_more: "Read more",
      search_ph: "Enter ticker (e.g. AAPL, NVDA)...",
      loading: "Loading...",
      no_news: "No news found for this ticker.",
      error: "An error occurred.",
      tech_pos: "Candles consolidating at support level, price about to break out upward.",
      tech_neg: "Price in consolidation zone, better to wait for a clear trend.",
      fund_pos: "recent news creating positive momentum.",
      fund_neg: "Market is dominated by uncertainty and caution.",
      top_buy_title: "TOP 5 BUY Signals",
      top_sell_title: "TOP 5 SELL Signals",
      calc_title: "Position Size & Risk Calculator",
      depo_label: "Account Balance ($)",
      risk_label: "Risk Percentage (%)",
      risk_amt: "Risk Amount:",
      shares_amt: "Shares (Lot):",
      pos_amt: "Position Value:",
      rr_title: "Risk-to-Reward Ratio (R:R):",
      watchlist_title: "Watchlist (Favorites)",
      no_favs: "No saved stocks yet.",
      halal_status: "100% Halal"
    }
  };

  useEffect(() => {
    const savedFavs = localStorage.getItem('dct_favorites');
    if (savedFavs) {
      try { setFavorites(JSON.parse(savedFavs)); } catch (e) {}
    }
  }, []);

  useEffect(() => {
    fetchData(currentSymbol, currentLang);
  }, [currentSymbol, currentLang]);

  useEffect(() => {
    const timer = setInterval(updateMarketTimer, 1000);
    return () => clearInterval(timer);
  }, []);

  function updateMarketTimer() {
    const now = new Date();
    const utcDay = now.getUTCDay();
    const utcHours = now.getUTCHours();
    const utcMinutes = now.getUTCMinutes();
    const utcSeconds = now.getUTCSeconds();

    const nyHour = (utcHours - 4 + 24) % 24;
    const marketOpenTime = 9.5 * 3600;
    const marketCloseTime = 16 * 3600;
    const currentSeconds = nyHour * 3600 + utcMinutes * 60 + utcSeconds;

    const isWeekday = utcDay >= 1 && utcDay <= 5;
    const open = isWeekday && currentSeconds >= marketOpenTime && currentSeconds < marketCloseTime;
    setIsOpen(open);

    if (open) {
      setMarketStatus('NYSE: OPEN');
      setMarketTimer(formatSeconds(marketCloseTime - currentSeconds));
    } else {
      setMarketStatus('NYSE: CLOSED');
      let remaining = (currentSeconds < marketOpenTime && isWeekday) 
        ? marketOpenTime - currentSeconds 
        : (24 * 3600 - currentSeconds) + marketOpenTime;
      setMarketTimer(formatSeconds(remaining));
    }
  }

  function formatSeconds(sec) {
    const h = Math.floor(sec / 3600).toString().padStart(2, '0');
    const m = Math.floor((sec % 3600) / 60).toString().padStart(2, '0');
    const s = Math.floor(sec % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  }

  async function fetchData(symbol, lang) {
    setLoading(true);
    try {
      const res = await fetch(`/api/news?symbol=${symbol}&lang=${lang}`);
      const data = await res.json();
      if (data.news) setNews(data.news);
      if (data.signal) setSignal(data.signal);
      if (data.topBuy) setTopBuy(data.topBuy);
      if (data.topSell) setTopSell(data.topSell);
    } catch (err) {
      console.error(err);
    }
    setLoading(false);
  }

  function toggleFavorite(sym) {
    let updated = favorites.includes(sym)
      ? favorites.filter(s => s !== sym)
      : [...favorites, sym];
    setFavorites(updated);
    localStorage.setItem('dct_favorites', JSON.stringify(updated));
  }

  async function handleCheckout() {
    try {
      const res = await fetch('/api/create-checkout', { method: 'POST' });
      const data = await res.json();
      if (data.url) window.location.href = data.url;
    } catch (e) {
      alert("To'lovda xatolik yuz berdi");
    }
  }

  // Calculator calculations
  const entryVal = parseFloat(signal.entry.replace('$', '')) || 0;
  const slVal = parseFloat(signal.sl.replace('$', '')) || 0;
  const tpVal = parseFloat(signal.tp.replace('$', '')) || 0;

  const riskUSD = (depo * riskPct) / 100;
  const riskPerShare = Math.abs(entryVal - slVal);
  const shares = (entryVal && slVal && riskPerShare > 0) ? Math.floor(riskUSD / riskPerShare) : 0;
  const totalPos = shares * entryVal;

  const rrRatio = (entryVal && slVal && tpVal && Math.abs(entryVal - slVal) > 0) 
    ? (Math.abs(tpVal - entryVal) / Math.abs(entryVal - slVal)).toFixed(1)
    : '2.0';

  const currentHalol = halolDatabase[currentSymbol] || { status: 'Halol Compliant', type: 'halal' };
  const t = i18n[currentLang];

  return (
    <>
      <Head>
        <title>DEDCO TRADING | DCT Terminal</title>
        <script src="https://cdn.tailwindcss.com"></script>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
      </Head>

      <div className="bg-slate-950 text-slate-100 min-h-screen pb-10">
        {/* Header */}
        <header className="border-b border-slate-800 bg-slate-900/90 sticky top-0 z-50 p-4 backdrop-blur-md">
          <div className="max-w-7xl mx-auto flex justify-between items-center flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-cyan-500 flex items-center justify-center font-black text-slate-950 text-xl shadow-lg shadow-emerald-500/20">
                DCT
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                  DEDCO TRADING
                </h1>
                <p className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">{t.subtitle}</p>
              </div>
            </div>

            <div className="hidden md:flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-xl border border-slate-700/80 text-xs">
              <span className={`w-2.5 h-2.5 rounded-full ${isOpen ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`}></span>
              <span className="font-bold text-slate-300">{marketStatus}</span>
              <span className="text-slate-400 font-mono text-[11px] border-l border-slate-700 pl-2">{marketTimer}</span>
            </div>

            <div className="flex items-center gap-3">
              <button onClick={handleCheckout} className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-extrabold px-3.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 shadow-lg shadow-amber-500/10 transition">
                <i className="fa-solid fa-crown"></i> VIP Membership
              </button>

              <div className="flex items-center bg-slate-800 p-1 rounded-xl border border-slate-700 text-xs font-bold">
                {['uz', 'ru', 'en'].map(lang => (
                  <button key={lang} onClick={() => setCurrentLang(lang)} className={`px-2.5 py-1 rounded-lg uppercase ${currentLang === lang ? 'text-emerald-400 bg-slate-700 font-extrabold' : 'text-slate-400 hover:text-slate-200'}`}>
                    {lang}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <section className="lg:col-span-2 space-y-6">
            
            {/* TradingView Chart */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <i className="fa-solid fa-chart-candlestick text-emerald-400"></i> {t.chart_title}
                </h2>
                <span className="text-xs text-slate-400 font-mono font-bold">SYMBOL: {currentSymbol}</span>
              </div>
              <div className="w-full h-[420px] bg-slate-950/50 rounded-xl overflow-hidden border border-slate-800">
                <iframe 
                  src={`https://s.tradingview.com/widgetembed/?frameElementId=tradingview_1&symbol=${currentSymbol}&interval=D&hidesidetoolbar=1&symboledit=1&saveimage=1&toolbarbg=f1f3f6&studies=[]&theme=dark&style=1&timezone=Etc%2FUTC`}
                  className="w-full h-full border-0"
                ></iframe>
              </div>
            </div>

            {/* TOP BUY & SELL Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-slate-900/70 border-t-2 border-emerald-500 border border-slate-800 p-4 rounded-2xl">
                <h3 className="text-xs font-bold text-emerald-400 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-arrow-trend-up"></i> {t.top_buy_title}
                </h3>
                <div className="space-y-2">
                  {topBuy.length > 0 ? topBuy.map(item => (
                    <div key={item.symbol} onClick={() => setCurrentSymbol(item.symbol)} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 hover:border-slate-500 transition cursor-pointer flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">{item.symbol}</span>
                      <div className="flex gap-2 font-mono text-[11px]">
                        <span className="text-cyan-400">{item.entry}</span>
                        <span className="text-emerald-400">TP: {item.tp}</span>
                        <span className="text-slate-400">SL: {item.sl}</span>
                      </div>
                    </div>
                  )) : <p className="text-xs text-slate-500 py-2">Yuklanmoqda...</p>}
                </div>
              </div>

              <div className="bg-slate-900/70 border-t-2 border-rose-500 border border-slate-800 p-4 rounded-2xl">
                <h3 className="text-xs font-bold text-rose-400 mb-3 flex items-center gap-2">
                  <i className="fa-solid fa-arrow-trend-down"></i> {t.top_sell_title}
                </h3>
                <div className="space-y-2">
                  {topSell.length > 0 ? topSell.map(item => (
                    <div key={item.symbol} onClick={() => setCurrentSymbol(item.symbol)} className="bg-slate-800/60 p-2.5 rounded-xl border border-slate-700/60 hover:border-slate-500 transition cursor-pointer flex justify-between items-center text-xs">
                      <span className="font-bold text-slate-200">{item.symbol}</span>
                      <div className="flex gap-2 font-mono text-[11px]">
                        <span className="text-cyan-400">{item.entry}</span>
                        <span className="text-rose-400">TP: {item.tp}</span>
                        <span className="text-slate-400">SL: {item.sl}</span>
                      </div>
                    </div>
                  )) : <p className="text-xs text-slate-500 py-2">Yuklanmoqda...</p>}
                </div>
              </div>
            </div>

            {/* Signal & Tahlil Card */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl border-l-4 border-emerald-500 shadow-lg">
              <div className="flex justify-between items-center mb-3">
                <h3 className="font-bold text-slate-200 text-base flex items-center gap-2">
                  <i className="fa-solid fa-compass text-emerald-400"></i> {currentSymbol} 
                  
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold flex items-center gap-1 ${
                    currentHalol.type === 'halal' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30' :
                    currentHalol.type === 'check' ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' : 'bg-rose-500/10 text-rose-400 border border-rose-500/30'
                  }`}>
                    <i className="fa-solid fa-shield-halal"></i> {currentHalol.status}
                  </span>
                </h3>

                <div className="flex items-center gap-2">
                  <button onClick={() => toggleFavorite(currentSymbol)} className="text-slate-400 hover:text-amber-400 text-base p-1 transition">
                    <i className={favorites.includes(currentSymbol) ? "fa-solid fa-star text-amber-400" : "fa-regular fa-star"}></i>
                  </button>
                  <span className={`text-xs font-extrabold px-3 py-1 rounded-lg uppercase ${
                    signal.action === 'BUY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                  }`}>
                    {signal.action}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 my-4">
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t.entry}</p>
                  <p className="text-sm font-bold text-cyan-400 mt-1 font-mono">{signal.entry}</p>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t.tp}</p>
                  <p className="text-sm font-bold text-emerald-400 mt-1 font-mono">{signal.tp}</p>
                </div>
                <div className="bg-slate-800/80 p-3 rounded-xl border border-slate-700/80 text-center">
                  <p className="text-[10px] text-slate-400 font-bold uppercase">{t.sl}</p>
                  <p className="text-sm font-bold text-rose-400 mt-1 font-mono">{signal.sl}</p>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-1.5 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800">
                <p><strong><i class="fa-solid fa-microchip text-emerald-400 mr-1"></i> {t.tech_analysis}</strong> {signal.action === 'BUY' ? t.tech_pos : t.tech_neg}</p>
                <p><strong><i class="fa-solid fa-globe text-cyan-400 mr-1"></i> {t.fund_analysis}</strong> {signal.action === 'BUY' ? `${currentSymbol} ${t.fund_pos}` : t.fund_neg}</p>
              </div>
            </div>

            {/* Position Size Calculator */}
            <div className="bg-slate-900/70 border border-slate-800 p-5 rounded-2xl border-t-2 border-cyan-500">
              <h3 className="text-sm font-bold text-cyan-400 mb-4 flex items-center gap-2">
                <i className="fa-solid fa-calculator"></i> {t.calc_title}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold">{t.depo_label}</label>
                    <input type="number" value={depo} onChange={e => setDepo(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 mt-1" />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-semibold">{t.risk_label}</label>
                    <input type="number" value={riskPct} onChange={e => setRiskPct(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-cyan-500 mt-1" />
                  </div>
                </div>
                <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 flex flex-col justify-center space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.risk_amt}</span>
                    <span className="font-bold text-rose-400 font-mono">${riskUSD.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">{t.shares_amt}</span>
                    <span className="font-bold text-cyan-400 font-mono">{shares} ta</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-800 pt-1.5">
                    <span className="text-slate-400">{t.pos_amt}</span>
                    <span className="font-bold text-emerald-400 font-mono">${totalPos.toLocaleString('en-US', {minimumFractionDigits: 2})}</span>
                  </div>
                </div>
              </div>
            </div>

          </section>

          {/* Right Sidebar */}
          <section className="space-y-4">

            {/* Watchlist */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4">
              <h2 className="text-xs font-bold text-amber-400 mb-3 flex items-center justify-between">
                <span className="flex items-center gap-2"><i class="fa-solid fa-star"></i> {t.watchlist_title}</span>
                <span className="bg-slate-800 px-2 py-0.5 rounded-full text-slate-400 text-[10px]">{favorites.length}</span>
              </h2>
              <div className="flex flex-wrap gap-2">
                {favorites.length > 0 ? favorites.map(sym => (
                  <button key={sym} onClick={() => setCurrentSymbol(sym)} className="bg-slate-800/90 hover:bg-slate-700 text-slate-200 border border-slate-700/80 px-2.5 py-1 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
                    <i className="fa-solid fa-chart-line text-cyan-400 text-[10px]"></i> {sym}
                  </button>
                )) : <p className="text-xs text-slate-500 italic">{t.no_favs}</p>}
              </div>
            </div>

            {/* News Panel */}
            <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5">
              <h2 className="text-base font-semibold mb-4 flex items-center gap-2">
                <i className="fa-solid fa-newspaper text-cyan-400"></i> {t.news_title}
              </h2>

              <div className="flex gap-2 mb-4">
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder={t.search_ph}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-200 outline-none focus:border-emerald-500 transition"
                />
                <button onClick={() => searchQuery && setCurrentSymbol(searchQuery.toUpperCase())} className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-bold px-4 py-2 rounded-xl text-xs transition">
                  <i className="fa-solid fa-magnifying-glass"></i>
                </button>
              </div>

              <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                {loading ? (
                  <p className="text-slate-400 text-xs text-center py-6"><i className="fa-solid fa-spinner fa-spin"></i> {t.loading}</p>
                ) : news.length > 0 ? (
                  news.map((item, idx) => (
                    <div key={idx} className="p-3 bg-slate-800/40 rounded-xl border border-slate-800/80 hover:border-slate-700 transition">
                      <h4 className="font-medium text-xs text-slate-200 leading-snug">{item.headline}</h4>
                      <p className="text-[11px] text-slate-400 mt-1 line-clamp-2">{item.summary}</p>
                      <a href={item.url} target="_blank" rel="noreferrer" className="inline-block mt-2 text-[11px] text-emerald-400 hover:underline">
                        {t.read_more} <i className="fa-solid fa-arrow-up-right-from-square text-[9px]"></i>
                      </a>
                    </div>
                  ))
                ) : (
                  <p className="text-slate-500 text-xs text-center py-6">{t.no_news}</p>
                )}
              </div>
            </div>

          </section>
        </main>
      </div>
    </>
  );
    }
