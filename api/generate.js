export default async function handler(req, res) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Password check
  const { password } = req.body;
  if (!password || password !== process.env.SITE_PASSWORD) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) {
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
      "content_zh": "Chinese content 100-150 characters, smart and fluid, like a witty well-traveled friend",
      "content_en": "English content 80-120 words, clever, light, a little wicked, never boring",
      "insight_zh": "💡 一句点睛中文洞察（20字以内）",
      "insight_en": "💡 One sharp English insight under 20 words",
      "source_name": "Real source name",
      "source_url": "Real URL from en.wikipedia.org or britannica.com only"
    }
  ]
}

Forbidden: repetitive topics, surface facts, motivational content, fabricated sources, any text outside the JSON.`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(500).json({ error: 'Claude API error', detail: data?.error?.message || '' });
    }

    const text = data.content?.[0]?.text;
    if (!text) return res.status(500).json({ error: 'Empty response from AI' });

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(500).json({ error: 'Could not parse AI response' });

    const result = JSON.parse(jsonMatch[0]);
    if (!result.items || !Array.isArray(result.items)) {
      return res.status(500).json({ error: 'Invalid response structure' });
    }

    return res.status(200).json(result);

  } catch (err) {
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
