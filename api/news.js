export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const GEMINI_KEY = process.env.GEMINI_API_KEY;

    if (!FINNHUB_KEY || !GEMINI_KEY) {
        return res.status(500).json({ 
            error: "API kalitlar topilmadi. Vercel Settings -> Environment Variables bo'limida FINNHUB_API_KEY va GEMINI_API_KEY mavjudligini tekshiring." 
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

        // 2. Gemini AI Prompt
        const aiPrompt = `Siz moliya va swing-treding bo'yicha tahlilchisiz. Quyidagi yangiliklarni o'zbek tiliga o'giring va qisqa AI Swing-Tahlil bering.
Javobni FAQAT to'g'ridan-to'g'ri JSON formatida qaytaring, boshqa hech qanday matn va markdown belgilarini (masalan \`\`\`json) yozmang:
{
  "analysis": "Umumiy o'zbekcha tahlil va swing-trederlar uchun xulosa",
  "translated_news": [
     {"headline": "O'zbekcha sarlavha", "summary": "O'zbekcha qisqa mazmun", "url": "original_url"}
  ]
}

Yangiliklar:
${JSON.stringify(topNews.map(n => ({headline: n.headline, summary: n.summary, url: n.url})))}`;

        // 3. Gemini API So'rovi (gemini-2.5-flash)
        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{ text: aiPrompt }]
                }]
            })
        });

        const aiData = await aiResponse.json();

        if (aiData.error) {
            console.error("Gemini Error:", aiData.error);
            return res.status(200).json({ 
                news: topNews, 
                analysis: "Gemini xatosi: " + (aiData.error.message || "Vaqtinchalik uzilish.") 
            });
        }

        const rawContent = aiData.candidates?.[0]?.content?.parts?.[0]?.text;
        let parsedData = null;

        if (rawContent) {
            try {
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
                analysis: "AI tarjimada xatolik yuz berdi, asl yangiliklar ko'rsatildi." 
            });
        }
    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
}
    }
}
