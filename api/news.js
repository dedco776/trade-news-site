export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

    // API kalitlar mavjudligini tekshirish
    if (!FINNHUB_KEY || !OPENROUTER_KEY) {
        return res.status(500).json({ 
            error: "API kalitlar topilmadi. Vercel Environment Variables bo'limini tekshiring." 
        });
    }

    try {
        // 1. Finnhub API'dan yangilik olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
        if (!newsResponse.ok) {
            throw new Error(`Finnhub API xatosi: ${newsResponse.statusText}`);
        }
        const newsData = await newsResponse.json();
        const topNews = newsData.slice(0, 5);

        // 2. OpenRouter AI prompt
        const aiPrompt = `Siz moliya tahlilchisiz. Quyidagi yangiliklarni o'zbek tiliga o'giring va qisqa AI Swing-Tahlil bering.
Javobni FAQAT to'g'ridan-to'g'ri JSON formatida qaytaring, boshqa hech qanday matn yozmang:
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
                'Content-Type': 'application/json',
                'HTTP-Referer': 'https://vercel.com', // OpenRouter talabi
                'X-Title': 'Financial News App'
            },
            body: JSON.stringify({
                model: "google/gemma-2-9b-it:free",
                messages: [{ role: "user", content: aiPrompt }]
            })
        });

        const aiData = await aiResponse.json();
        
        // OpenRouter xatolik qaytarganini tekshirish
        if (aiData.error) {
            console.error("OpenRouter Error:", aiData.error);
            return res.status(200).json({ 
                news: topNews, 
                analysis: "OpenRouter xatosi: " + (aiData.error.message || "Vaqtinchalik uzilish.") 
            });
        }

        const rawContent = aiData.choices?.[0]?.message?.content;
        let parsedData = null;

        if (rawContent) {
            try {
                // JSON qismini aniq ajratib olish
                const jsonStart = rawContent.indexOf('{');
                const jsonEnd = rawContent.lastIndexOf('}') + 1;
                
                if (jsonStart !== -1 && jsonEnd > jsonStart) {
                    const cleanJson = rawContent.substring(jsonStart, jsonEnd);
                    parsedData = JSON.parse(cleanJson);
                }
            } catch (e) {
                console.error("JSON Parse Error:", e, "Raw Content:", rawContent);
            }
        }

        if (parsedData && parsedData.translated_news) {
            res.status(200).json({ news: parsedData.translated_news, analysis: parsedData.analysis });
        } else {
            res.status(200).json({ 
                news: topNews, 
                analysis: "AI tarjimada xatolik yuz berdi, asl yangiliklar qaytarildi." 
            });
        }
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
}
