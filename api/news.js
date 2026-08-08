export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

    try {
        // 1. Finnhub API'dan yangilik olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
        const newsData = await newsResponse.json();
        const topNews = newsData.slice(0, 5);

        // 2. OpenRouter AI (Bepul model)
        const aiPrompt = `Siz moliya tahlilchisiz. Quyidagi yangiliklarni o'zbek tiliga o'giring va qisqa AI Swing-Tahlil beringsiz.
        Javobni FAQAT quyidagi JSON formatida qaytaring:
        {
          "analysis": "Umumiy o'zbekcha tahlil",
          "translated_news": [
             {"headline": "O'zbekcha sarlavha", "summary": "O'zbekcha qisqa mazmun", "url": "original_url"}
          ]
        }

        Yangiliklar:
        ${JSON.stringify(topNews.map(n => ({headline: n.headline, summary: n.summary, url: n.url})))}`;

        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "google/gemma-2-9b-it:free",
                messages: [{ role: "user", content: aiPrompt }]
            })
        });

        const aiData = await aiResponse.json();
        const rawContent = aiData.choices?.[0]?.message?.content;
        
        let parsedData = null;
        try {
            // JSON matnini ajratib olish
            const cleanJson = rawContent.substring(rawContent.indexOf('{'), rawContent.lastIndexOf('}') + 1);
            parsedData = JSON.parse(cleanJson);
        } catch(e) {
            console.log("JSON Parse Error", e);
        }

        if (parsedData && parsedData.translated_news) {
            res.status(200).json({ news: parsedData.translated_news, analysis: parsedData.analysis });
        } else {
            res.status(200).json({ news: topNews, analysis: "AI orqali tarjima qilishda vaqtinchalik uzilish bo'ldi." });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}
