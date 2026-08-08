export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const GROQ_KEY = process.env.GROQ_API_KEY;

    if (!FINNHUB_KEY) {
        return res.status(500).json({ error: "FINNHUB_API_KEY Vercel'da topilmadi." });
    }

    try {
        // 1. Finnhub API'dan yangilik olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
        if (!newsResponse.ok) {
            throw new Error(`Finnhub xatosi: ${newsResponse.statusText}`);
        }
        const newsData = await newsResponse.json();
        const topNews = newsData.slice(0, 5);

        // Agar Groq kaliti bo'lmasa yoki AI ishlamasa, shunchaki yangiliklarni qaytaramiz
        if (!GROQ_KEY) {
            return res.status(200).json({ 
                news: topNews, 
                analysis: "Groq API kaliti kiritilmagan. Faqat yangiliklar ko'rsatildi." 
            });
        }

        // 2. Groq AI So'rovi
        try {
            const aiPrompt = `Siz moliya va swing-treding bo'yicha tahlilchisiz. Quyidagi yangiliklarni tahlil qilib, swing-trederlar uchun o'zbek tilida 2-3 ta jumladan iborat qisqa xulosa beringsiz:
${JSON.stringify(topNews.map(n => n.headline))}`;

            const aiResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: "llama-3.3-70b-versatile",
                    messages: [{ role: "user", content: aiPrompt }],
                    temperature: 0.5
                })
            });

            const aiData = await aiResponse.json();
            const analysisText = aiData.choices?.[0]?.message?.content || "AI xulosa bera olmadi.";

            return res.status(200).json({ news: topNews, analysis: analysisText });

        } catch (aiErr) {
            // AI da xatolik bo'lsa ham sayt to'xtamaydi
            console.error("AI Error:", aiErr);
            return res.status(200).json({ 
                news: topNews, 
                analysis: "AI tahlilida vaqtinchalik uzilish yuz berdi." 
            });
        }

    } catch (error) {
        console.error("Server Error:", error);
        res.status(500).json({ error: error.message });
    }
                                }
