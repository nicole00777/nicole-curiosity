const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';

export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // CORS — only allow your own domain
  const origin = req.headers.origin || '';
  if (ALLOWED_ORIGIN && origin !== ALLOWED_ORIGIN) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  // Only POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Rate limit via Vercel Edge config (basic IP check)
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || '';

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const prompt = `You are a curiosity generator for Nicole — a highly open, intellectually adventurous person who loves culture, history, psychology, human nature, natural science, art, aesthetics, language, food, travel, and philosophy.

Generate exactly 5 fascinating facts — each from a completely different domain.

Each fact must:
- Feel genuinely surprising and non-obvious
- Have real depth without being verbose
- Carry a clever, slightly wicked sense of humor
- Include a sharp one-line insight
- Come from a real, verifiable source
- Make Nicole feel "wow, I'm smarter today"

Return ONLY raw valid JSON. No markdown fences, no explanation, nothing else:
{
  "date": "today's date as: Month DD, YYYY",
  "items": [
    {
      "index": 1,
      "emoji": "one relevant emoji",
      "category": "one of: Psychology / History / Nature / Culture / Philosophy / Language / Food / Art / Science / Folklore",
      "title_zh": "Chinese title under 10 characters",
      "title_en": "English title under 8 words",
      "content_zh": "Chinese content 100-150 characters, smart and fluid, like a witty well-traveled friend talking — not a textbook",
      "content_en": "English content 80-120 words, same tone: clever, light, a little wicked, never boring",
      "insight_zh": "💡 一句点睛中文洞察（20字以内）",
      "insight_en": "💡 One sharp English insight (under 20 words)",
      "source_name": "Real source: book title, journal name, or institution",
      "source_url": "Real working URL — use en.wikipedia.org, britannica.com, or pubmed.ncbi.nlm.nih.gov only"
    }
  ]
}

Absolutely forbidden: Wikipedia-style summaries, repeated domains, surface-level facts, motivational content, fabricated sources, any text outside the JSON.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.95,
            maxOutputTokens: 4096
          }
        })
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Gemini API error' });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'Empty response from AI' });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response' });

    const result = JSON.parse(jsonMatch[0]);

    // Validate structure
    if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
      return res.status(500).json({ error: 'Invalid response structure' });
    }

    return res.status(200).json(result);

  } catch (err) {
    // Never expose internal error details
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
