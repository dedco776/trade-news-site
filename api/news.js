export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const { symbol = 'AAPL', lang = 'uz' } = req.query;

    if (!FINNHUB_KEY) {
        return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi." });
    }

    // Google Translate orqali avtomatik tarjima qilish funksiyasi
    async function translateText(text, targetLang) {
        if (!text || targetLang === 'en') return text;
        try {
            const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            const response = await fetch(url);
            const data = await response.json();
            return data[0].map(item => item[0]).join('');
        } catch (e) {
            return text; // Xatolik yuz bersa, asl inglizcha matn qaytadi
        }
    }

    try {
        const today = new Date().toISOString().split('T')[0];
        const pastDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // 1. Yangiliklarni Finnhub'dan olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/company-news?symbol=${symbol.toUpperCase()}&from=${pastDate}&to=${today}&token=${FINNHUB_KEY}`);
        
        let newsData = [];
        if (newsResponse.ok) {
            newsData = await newsResponse.json();
        }

        if (!Array.isArray(newsData) || newsData.length === 0) {
            const genNews = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
            if (genNews.ok) {
                newsData = await genNews.json();
            }
        }

        const rawNews = Array.isArray(newsData) ? newsData.slice(0, 5) : [];

        // 2. Yangilik sarlavhalari va izohlarini tanlangan tilga tarjima qilish
        const translatedNews = await Promise.all(rawNews.map(async (item) => {
            const headline = await translateText(item.headline, lang);
            const summary = await translateText(item.summary, lang);
            return {
                ...item,
                headline,
                summary
            };
        }));

        // Dynamic Signal Generator (Demo Tahlil Mantiqi)
        const basePrices = {
            'AAPL': 225.0,
            'NVDA': 120.0,
            'TSLA': 210.0,
            'SPUS': 59.0,
            'HLAL': 42.0
        };

        const currentPrice = basePrices[symbol.toUpperCase()] || (Math.random() * 100 + 50);
        const isPositive = rawNews.length > 0 ? rawNews[0].headline.length % 2 === 0 : true;

        const action = isPositive ? 'BUY' : 'WAIT';
        const entry = `$${currentPrice.toFixed(2)}`;
        const tp = `$${(currentPrice * (isPositive ? 1.07 : 1.02)).toFixed(2)}`;
        const sl = `$${(currentPrice * 0.95).toFixed(2)}`;

        const signal = {
            action: action,
            entry: entry,
            tp: tp,
            sl: sl
        };

        return res.status(200).json({ 
            news: translatedNews, 
            signal: signal 
        });

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
}
