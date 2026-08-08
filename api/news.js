export default async function handler(req, res) {
    const FINNHUB_KEY = process.env.FINNHUB_API_KEY;
    const OPENROUTER_KEY = process.env.OPENROUTER_API_KEY;

    try {
        // 1. Finnhub API'dan yangiliklarni olish
        const newsResponse = await fetch(`https://finnhub.io/api/v1/news?category=general&token=${FINNHUB_KEY}`);
        const newsData = await newsResponse.json();
        const topNews = newsData.slice(0, 5); // Eng so'nggi 5 ta yangilik

        // 2. OpenRouter AI ga tahlil uchun yuborish
        const aiPrompt = `Siz tajribali Swing Treydersiz. Quyidagi moliya yangiliklarini tahlil qiling va o'zbek tilida qisqa, londa, aniq formatda javob bering:\n` + 
            topNews.map(n => `- ${n.headline}`).join('\n');

        const aiResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${OPENROUTER_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "openai/gpt-3.5-turbo",
                messages: [{ role: "user", content: aiPrompt }]
            })
        });

        const aiData = await aiResponse.json();
        const analysis = aiData.choices?.[0]?.message?.content || "Tahlil olishda xatolik yuz berdi.";

        // 3. Natijani frontend'ga yuborish
        res.status(200).json({ news: topNews, analysis: analysis });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

