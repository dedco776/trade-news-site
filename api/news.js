export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const { symbol = 'AAPL' } = req.query;

    if (!FINNHUB_KEY) {
        return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi." });
    }

    try {
        // Bugungi sanani hisoblash (YYYY-MM-DD)
        const today = new Date().toISOString().split('T')[0];
        const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Qidirilgan tiker yangiliklarini olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${pastDate}&to=${today}&token=${FINNHUB_KEY}`);
        
        let newsData = [];
        if (newsResponse.ok) {
            newsData = await newsResponse.json();
        }

        // Agar maxsus company news bo'lmasa, umumiy yangiliklarni oladi
        if (!Array.isArray(newsData) || newsData.length === 0) {
            const genNews = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
            if (genNews.ok) {
                newsData = await genNews.json();
            }
        }

        const topNews = Array.isArray(newsData) ? newsData.slice(0, 5) : [];

        // Dynamic Signal Generator (Demo Tahlil Mantiqi)
        const basePrices = {
            'AAPL': 225.0,
            'NVDA': 120.0,
            'TSLA': 210.0,
            'SPUS': 59.0,
            'HLAL': 42.0
        };

        const currentPrice = basePrices[symbol.toUpperCase()] || (Math.random() * 100 + 50);
        const isPositive = topNews.length > 0 ? topNews[0].headline.length % 2 === 0 : true;

        const action = isPositive ? 'BUY' : 'WAIT';
        const entry = `$${currentPrice.toFixed(2)}`;
        const tp = `$${(currentPrice * (isPositive ? 1.07 : 1.02)).toFixed(2)}`;
        const sl = `$${(currentPrice * 0.95).toFixed(2)}`;

        const signal = {
            action: action,
            entry: entry,
            tp: tp,
            sl: sl,
            tech: isPositive ? "Support darajasida shamlar to'planmoqda, narx yuqoriga sinib o'tish arafasida." : "Narx konsolidatsiya zonasida, aniq trend shakllanmaguncha kutgan ma'qul.",
            fund: isPositive ? `${symbol.toUpperCase()} bo'yicha so'nggi yangiliklar ijobiy fond yaratmoqda.` : "Bozorda noaniqlik va ehtiyotkorlik ustunlik qilmoqda."
        };

        return res.status(200).json({ 
            news: topNews, 
            signal: signal 
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
}
