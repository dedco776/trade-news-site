import crypto from "crypto";

export default async function handler(req, res) {
  const apiKey = process.env.FINNHUB_API_KEY;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const symbol = req.query.symbol || 'AAPL';
  const lang = req.query.lang || 'uz';

  if (!apiKey) {
    return res.status(500).json({ error: "FINNHUB_API_KEY topilmadi" });
  }

  try {
    // 1. Finnhub Yangiliklarini olish
    const newsRes = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${symbol}&from=2024-01-01&to=2026-12-31&token=${apiKey}`
    );
    const newsData = await newsRes.json();
    let rawNews = Array.isArray(newsData) ? newsData.slice(0, 4) : [];

    // 2. Yangilik sarlavhasi va qisqacha mazmunini tanlangan tilga tarjima qilish (keshlash bilan)
    const translatedNews = await Promise.all(
      rawNews.map(async (item) => {
        if (lang === 'en') return item;
        try {
          const targetLang = lang === 'uz' ? 'uz' : 'ru';
          const headlineTr = await translateCached(item.headline, targetLang, supabaseUrl, supabaseKey);
          const summaryTr = await translateCached(item.summary, targetLang, supabaseUrl, supabaseKey);
          return {
            ...item,
            headline: headlineTr || item.headline,
            summary: summaryTr || item.summary
          };
        } catch (e) {
          return item;
        }
      })
    );

    // 3. Finnhub Quote (Real Narx)
    const quoteRes = await fetch(
      `https://finnhub.io/api/v1/quote?symbol=${symbol}&token=${apiKey}`
    );
    const quoteData = await quoteRes.json();

    return res.status(200).json({
      news: translatedNews,
      price: quoteData ? quoteData.c : null
    });
  } catch (error) {
    return res.status(500).json({ error: "Server error" });
  }
}

// Matn + til uchun barqaror hash (kesh kaliti)
function makeHash(text, targetLang) {
  return crypto.createHash("sha256").update(`${targetLang}|${text}`).digest("hex");
}

// Avval keshdan qaraydi, topilmasa MyMemory orqali tarjima qiladi va keshga yozadi
async function translateCached(text, targetLang, supabaseUrl, supabaseKey) {
  if (!text) return "";

  const hash = makeHash(text, targetLang);

  // Supabase sozlanmagan bo'lsa, kesh o'tkazib yuboriladi (to'g'ridan-to'g'ri tarjima)
  if (!supabaseUrl || !supabaseKey) {
    return translateViaMyMemory(text, targetLang);
  }

  // 1. Keshdan qidirish
  try {
    const cacheRes = await fetch(
      `${supabaseUrl}/rest/v1/translations?text_hash=eq.${hash}&select=translated_text`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`
        }
      }
    );
    const cached = await cacheRes.json();
    if (Array.isArray(cached) && cached.length > 0) {
      return cached[0].translated_text;
    }
  } catch (e) {
    // kesh o'qishda xato bo'lsa, baribir tarjimaga davom etamiz
  }

  // 2. Keshda yo'q — yangi tarjima qilamiz
  const translated = await translateViaMyMemory(text, targetLang);
  if (!translated) return text;

  // 3. Keshga yozib qo'yamiz (keyingi safar qayta tarjima qilinmasin)
  try {
    await fetch(`${supabaseUrl}/rest/v1/translations`, {
      method: "POST",
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        "Content-Type": "application/json",
        Prefer: "resolution=ignore-duplicates,return=minimal"
      },
      body: JSON.stringify({
        text_hash: hash,
        source_text: text,
        target_lang: targetLang,
        translated_text: translated
      })
    });
  } catch (e) {
    // keshga yozib bo'lmasa ham, tarjimaning o'zi qaytariladi
  }

  return translated;
}

// MyMemory (rasmiy, bepul) tarjima xizmati
async function translateViaMyMemory(text, targetLang) {
  if (!text) return "";
  try {
    const langpair = `en|${targetLang}`;
    const email = "diyorbekghd@gmail.com";
    const res = await fetch(
      `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}&de=${encodeURIComponent(email)}`
    );
    const data = await res.json();
    return data?.responseData?.translatedText || text;
  } catch (err) {
    return text;
  }
}
