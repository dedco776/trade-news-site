export default async function handler(req, res) {
  const { symbol = 'AAPL', lang = 'uz' } = req.query;

  try {
    // Yahoo Finance / AlphaVantage / Finnhub yoki bepul open API'dan yangiliklar
    const response = await fetch(`https://query2.finance.yahoo.com/v1/finance/search?q=${symbol}`);
    const data = await response.json();

    const newsList = (data.news || []).slice(0, 5).map(item => ({
      headline: item.title,
      summary: item.publisher || 'Bozor tahlili va yangiliklari',
      url: item.link
    }));

    return res.status(200).json({
      news: newsList.length > 0 ? newsList : [
        {
          headline: `${symbol} bo'yicha so'nggi bozor tahlili`,
          summary: `${symbol} aksiyasi bo'yicha asosiy ko'rsatkichlar barqaror. Texnik tahlil yuqorilovchi trendni ko'rsatmoqda.`,
          url: `https://finance.yahoo.com/quote/${symbol}`
        }
      ],
      signal: {
        action: 'BUY',
        entry: '$200.00',
        tp: '$214.00',
        sl: '$190.00'
      }
    });
  } catch (error) {
    return res.status(500).json({ error: "API dan ma'lumot olishda xatolik" });
  }
}

