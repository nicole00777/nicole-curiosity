import crypto from "crypto";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const SITE_PASSWORD  = process.env.SITE_PASSWORD  || "";
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL   = process.env.CLAUDE_MODEL   || "claude-haiku-4-5-20251001";

const WINDOW_MS = 60_000;
const MAX_REQ   = 12;

function getIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  return xff.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function rateLimit(ip) {
  global.__ncb_rl = global.__ncb_rl || new Map();
  const m = global.__ncb_rl;
  const now = Date.now();
  const entry = m.get(ip) || { start: now, count: 0 };
  if (now - entry.start > WINDOW_MS) { entry.start = now; entry.count = 0; }
  entry.count += 1;
  m.set(ip, entry);
  return entry.count <= MAX_REQ;
}

function timingSafeEquals(a, b) {
  try {
    const aBuf = Buffer.from(String(a));
    const bBuf = Buffer.from(String(b));
    if (aBuf.length !== bBuf.length) return false;
    return crypto.timingSafeEqual(aBuf, bBuf);
  } catch { return false; }
}

export default async function handler(req, res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");

  const origin = req.headers.origin;
  if (ALLOWED_ORIGIN) {
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader("Access-Control-Allow-Origin", ALLOWED_ORIGIN);
      res.setHeader("Vary", "Origin");
      res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    } else if (origin) {
      return res.status(403).json({ error: "Forbidden" });
    }
  }

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const ip = getIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ error: "Too many requests" });

  if (!SITE_PASSWORD || !CLAUDE_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const body     = req.body || {};
  const password = typeof body.password === "string" ? body.password : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "";

  if (!password || !timingSafeEquals(password, SITE_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 350));
    return res.status(401).json({ error: "Unauthorized" });
  }

  let userTimezone = "UTC";
  if (timezone && timezone.length <= 64) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      userTimezone = timezone;
    } catch { userTimezone = "UTC"; }
  }

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: userTimezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const prompt = `You are a curiosity generator for Nicole — a highly open, intellectually adventurous person who loves culture, history, psychology, human nature, natural science, art, aesthetics, language, food, travel, and philosophy.

Generate exactly 5 fascinating facts — each from a completely different domain. Every generation must feel fresh and surprising — never repeat topics, regions, eras, or disciplines you've used before. Actively seek out the obscure, the counterintuitive, and the delightfully weird corners of human knowledge.

Each fact must:
- Feel genuinely surprising and non-obvious
- Have real depth without being verbose
- Carry a clever, slightly wicked sense of humor
- Include a sharp one-line insight
- Come from a real, verifiable source
- Make Nicole feel "wow, I'm smarter today"

Return ONLY raw valid JSON, no markdown fences, no explanation:
{
  "date": "${today}",
  "items": [
    {
      "index": 1,
      "emoji": "one relevant emoji",
      "category": "one of: Psychology / History / Nature / Culture / Philosophy / Language / Food / Art / Science / Folklore",
      "title_zh": "Chinese title under 10 characters",
      "title_en": "English title under 8 words",
      "content_zh": "100-150 Chinese characters, smart and fluid",
      "content_en": "80-120 words, clever, light, a little wicked",
      "insight_zh": "一句点睛中文洞察20字以内",
      "insight_en": "One sharp English insight under 20 words",
      "source_name": "Real source: journal, book, museum, or institution",
      "source_url": "A real specific URL — prefer actual study, journal article, museum page, or university page over Wikipedia"
    }
  ]
}

Forbidden: repetitive topics, surface facts, motivational content, fabricated sources, any text outside the JSON, anything that feels like a "typical fun fact", safe or predictable choices.`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 2500,
        temperature: 1.0,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const raw = await upstream.text();
    let data = null;
    try { data = JSON.parse(raw); } catch {}

    if (!upstream.ok) {
      return res.status(502).json({
        error: "Upstream AI error",
        detail: (data?.error?.message || raw || "").slice(0, 300),
      });
    }

    const text = data?.content?.[0]?.text;
    if (!text) return res.status(502).json({ error: "Empty AI response" });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return res.status(502).json({ error: "Could not parse AI response" });

    const result = JSON.parse(jsonMatch[0]);
    if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
      return res.status(502).json({ error: "Invalid response structure" });
    }

    return res.status(200).json(result);

  } catch {
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
