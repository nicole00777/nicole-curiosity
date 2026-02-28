// api/generate.js  (Vercel Serverless Function, NOT Next.js pages/api)
//
// Required env vars on Vercel:
// - SITE_PASSWORD
// - CLAUDE_API_KEY
// - ALLOWED_ORIGIN (recommended): https://nicole-curiosity.vercel.app  (no trailing slash)
//
// Optional:
// - CLAUDE_MODEL (recommended): claude-haiku-4-5  (or claude-haiku-4-5-20251001)

import crypto from "crypto";

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "";
const SITE_PASSWORD = process.env.SITE_PASSWORD || "";
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || "";
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || "claude-haiku-4-5"; // recommended for structured outputs

// ---- Best-effort in-memory rate limit (not perfect on multi-instance) ----
const WINDOW_MS = 60_000;
const MAX_REQ = 12;

function getIp(req) {
  const xff = (req.headers["x-forwarded-for"] || "").toString();
  return xff.split(",")[0].trim() || req.socket?.remoteAddress || "unknown";
}

function rateLimit(ip) {
  global.__ncb_rl = global.__ncb_rl || new Map();
  const m = global.__ncb_rl;

  const now = Date.now();
  const entry = m.get(ip) || { start: now, count: 0 };

  if (now - entry.start > WINDOW_MS) {
    entry.start = now;
    entry.count = 0;
  }
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
  } catch {
    return false;
  }
}

// ---- Basic URL allowlist ----
const allowedDomains = [
  "en.wikipedia.org",
  "britannica.com",
  "nature.com",
  "science.org",
  "nejm.org",
  "thelancet.com",
  "cell.com",
  "pnas.org",
  "pubmed.ncbi.nlm.nih.gov",
  "ncbi.nlm.nih.gov",
  "jstor.org",
  "britishmuseum.org",
  "metmuseum.org",
  "louvre.fr",
  "rijksmuseum.nl",
  "museodelprado.es",
  "vam.ac.uk",
  "tate.org.uk",
  "moma.org",
  "guggenheim.org",
  "getty.edu",
  "nga.gov",
  "npg.org.uk",
  "ashmolean.org",
  "smb.museum",
  "musee-orsay.fr",
  "centrepompidou.fr",
  "si.edu",
  "americanart.si.edu",
  "asia.si.edu",
  "nmaahc.si.edu",
  "airandspace.si.edu",
  "naturalhistory.si.edu",
  "harvard.edu",
  "stanford.edu",
  "mit.edu",
  "ox.ac.uk",
  "cam.ac.uk",
  "ucl.ac.uk",
  "columbia.edu",
  "uchicago.edu",
  "yale.edu",
  "princeton.edu",
  "berkeley.edu",
  "utoronto.ca",
  "ethz.ch",
  "epfl.ch",
];

const museumDomains = new Set([
  "britishmuseum.org","metmuseum.org","louvre.fr","rijksmuseum.nl","museodelprado.es",
  "vam.ac.uk","tate.org.uk","moma.org","guggenheim.org","getty.edu","nga.gov","npg.org.uk",
  "ashmolean.org","smb.museum","musee-orsay.fr","centrepompidou.fr","si.edu",
  "americanart.si.edu","asia.si.edu","nmaahc.si.edu","airandspace.si.edu","naturalhistory.si.edu"
]);

const academicDomains = new Set([
  "nature.com","science.org","nejm.org","thelancet.com","cell.com","pnas.org",
  "pubmed.ncbi.nlm.nih.gov","ncbi.nlm.nih.gov","jstor.org",
  "harvard.edu","stanford.edu","mit.edu","ox.ac.uk","cam.ac.uk","ucl.ac.uk",
  "columbia.edu","uchicago.edu","yale.edu","princeton.edu","berkeley.edu",
  "utoronto.ca","ethz.ch","epfl.ch"
]);

function hostMatches(host, domain) {
  const h = (host || "").toLowerCase();
  const d = domain.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

function isAllowedUrl(u) {
  try {
    if (typeof u !== "string") return false;
    const s = u.trim();
    if (!s.startsWith("https://")) return false;
    const url = new URL(s);

    // must be a specific page
    if (!url.pathname || url.pathname === "/" || url.pathname.length < 2) return false;

    const host = url.hostname.toLowerCase();
    return allowedDomains.some((d) => hostMatches(host, d));
  } catch {
    return false;
  }
}

function isMuseumUrl(u) {
  try {
    const host = new URL(u).hostname.toLowerCase();
    for (const d of museumDomains) if (hostMatches(host, d)) return true;
  } catch {}
  return false;
}

function isAcademicUrl(u) {
  try {
    const host = new URL(u).hostname.toLowerCase();
    for (const d of academicDomains) if (hostMatches(host, d)) return true;
  } catch {}
  return false;
}

function validateResult(result) {
  if (!result || typeof result !== "object") return "Bad JSON";
  if (!Array.isArray(result.items) || result.items.length !== 5) return "Must return exactly 5 items";

  const allowedCategories = new Set([
    "Psychology","History","Nature","Culture","Philosophy","Language","Food","Art","Science","Folklore"
  ]);

  let museumHit = 0;
  let academicHit = 0;
  const seenIdx = new Set();

  for (const item of result.items) {
    if (!item || typeof item !== "object") return "Invalid item";
    if (typeof item.index !== "number" || item.index < 1 || item.index > 5) return "Invalid index";
    if (seenIdx.has(item.index)) return "Duplicate index";
    seenIdx.add(item.index);

    if (!allowedCategories.has(item.category)) return "Invalid category";

    // citations array required
    if (!Array.isArray(item.citations) || item.citations.length < 1 || item.citations.length > 2) {
      return "Each item must have 1-2 citations";
    }

    // must include [1] marker in both languages
    const zh = String(item.content_zh || "");
    const en = String(item.content_en || "");
    if (!zh.includes("[1]") || !en.includes("[1]")) return "Missing inline citation markers";

    for (const c of item.citations) {
      if (!c || typeof c !== "object") return "Invalid citation";
      if (!c.source_name || !c.source_url) return "Citation missing fields";
      if (!isAllowedUrl(c.source_url)) return "Citation URL not allowed";
      if (isMuseumUrl(c.source_url)) museumHit++;
      if (isAcademicUrl(c.source_url)) academicHit++;
    }
  }

  if (museumHit < 1) return "Need at least one museum source";
  if (academicHit < 1) return "Need at least one academic/journal/university source";

  return null;
}

// ---- JSON Schema for Anthropic Structured Outputs ----
// This makes Claude return VALID JSON in response.content[0].text (no JSON.parse failures). :contentReference[oaicite:1]{index=1}
const outputSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    date: { type: "string" },
    items: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          index: { type: "integer" },
          emoji: { type: "string" },
          category: {
            type: "string",
            enum: ["Psychology","History","Nature","Culture","Philosophy","Language","Food","Art","Science","Folklore"]
          },
          title_zh: { type: "string" },
          title_en: { type: "string" },
          content_zh: { type: "string" },
          content_en: { type: "string" },
          insight_zh: { type: "string" },
          insight_en: { type: "string" },
          citations: {
            type: "array",
            minItems: 1,
            maxItems: 2,
            items: {
              type: "object",
              additionalProperties: false,
              properties: {
                label: { type: "string" },
                source_type: { type: "string" },
                source_name: { type: "string" },
                source_url: { type: "string" },
                locator: { type: "string" }
              },
              required: ["label","source_type","source_name","source_url"]
            }
          }
        },
        required: [
          "index","emoji","category","title_zh","title_en",
          "content_zh","content_en","insight_zh","insight_en","citations"
        ]
      }
    }
  },
  required: ["date","items"]
};

export default async function handler(req, res) {
  // Security headers
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");

  // Strict CORS (recommended)
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

  // Rate limit
  const ip = getIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ error: "Too many requests" });

  // Env checks
  if (!SITE_PASSWORD || !CLAUDE_API_KEY) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const body = req.body || {};
  const password = typeof body.password === "string" ? body.password : "";
  const timezone = typeof body.timezone === "string" ? body.timezone : "";

  if (!password || !timingSafeEquals(password, SITE_PASSWORD)) {
    await new Promise((r) => setTimeout(r, 350));
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Timezone validation
  let userTimezone = "UTC";
  if (timezone && timezone.length <= 64) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      userTimezone = timezone;
    } catch {
      userTimezone = "UTC";
    }
  }

  const today = new Date().toLocaleDateString("en-US", {
    timeZone: userTimezone,
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Keep the instruction short; schema enforces JSON validity
  const prompt = `
You are a curiosity generator for Nicole.

Generate exactly 5 fascinating facts — each from a completely different domain.

Requirements:
- Non-obvious, real, verifiable.
- Clever, slightly wicked humor.
- Each item must include inline citation markers like [1] in BOTH languages.
- citations must use ONLY allowed domains.
- At least one item must use a museum domain; at least one must use an academic/journal/university/database domain.
- source_url must be https and a specific page (not homepage).

Allowed domains:
en.wikipedia.org, britannica.com,
nature.com, science.org, nejm.org, thelancet.com, cell.com, pnas.org, pubmed.ncbi.nlm.nih.gov, ncbi.nlm.nih.gov, jstor.org,
britishmuseum.org, metmuseum.org, louvre.fr, rijksmuseum.nl, museodelprado.es, vam.ac.uk, tate.org.uk, moma.org, guggenheim.org, getty.edu, nga.gov, npg.org.uk, ashmolean.org, smb.museum, musee-orsay.fr, centrepompidou.fr, si.edu, americanart.si.edu, asia.si.edu, nmaahc.si.edu, airandspace.si.edu, naturalhistory.si.edu,
harvard.edu, stanford.edu, mit.edu, ox.ac.uk, cam.ac.uk, ucl.ac.uk, columbia.edu, uchicago.edu, yale.edu, princeton.edu, berkeley.edu, utoronto.ca, ethz.ch, epfl.ch

Date string to use: "${today}"
`;

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
        max_tokens: 1700, // keep latency down to avoid Vercel 30s timeout
        temperature: 0.3,
        messages: [{ role: "user", content: prompt }],
        output_config: {
          format: {
            type: "json_schema",
            schema: outputSchema,
          },
        },
      }),
    });

    const raw = await upstream.text();
let data = null;
try { data = JSON.parse(raw); } catch {}

if (!upstream.ok) {
  return res.status(502).json({
    error: "Upstream AI error",
    upstream_status: upstream.status,
    upstream_type: data?.error?.type || "unknown",
    upstream_message: (data?.error?.message || raw || "").slice(0, 300),
    upstream_request_id: data?.request_id || upstream.headers.get("request-id") || ""
  });
}

if (!data) {
  return res.status(502).json({
    error: "Upstream AI error",
    upstream_status: upstream.status,
    upstream_type: "invalid_json_from_upstream",
    upstream_message: raw.slice(0, 300)
  });
}

    const text = data?.content?.[0]?.text;
    if (!text || typeof text !== "string") {
      return res.status(502).json({ error: "Empty AI response" });
    }

    // With structured outputs, this should be valid JSON per schema. :contentReference[oaicite:2]{index=2}
    let result;
    try {
      result = JSON.parse(text);
    } catch {
      // Extremely rare if upstream returned unexpected format
      return res.status(502).json({ error: "Invalid AI JSON" });
    }

    const vErr = validateResult(result);
    if (vErr) return res.status(502).json({ error: "AI output failed validation" });

    // Backward compatibility for your existing front-end link:
    for (const item of result.items) {
      if (!item.source_name && item.citations?.[0]) {
        item.source_name = item.citations[0].source_name || "";
        item.source_url = item.citations[0].source_url || "";
      }
    }

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: "Server error" });
  }
}
