import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redis = Redis.fromEnv();
const ratelimit = new Ratelimit({
  redis,
  // 12 requests per 60 seconds per IP
  limiter: Ratelimit.slidingWindow(12, '60 s'),
  analytics: true
});

const allowedDomains = [
  // Encyclopedias
  'en.wikipedia.org',
  'britannica.com',

  // Journals / Databases
  'nature.com',
  'science.org',
  'nejm.org',
  'thelancet.com',
  'cell.com',
  'pnas.org',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov',
  'jstor.org',

  // Museums
  'britishmuseum.org',
  'metmuseum.org',
  'louvre.fr',
  'rijksmuseum.nl',
  'museodelprado.es',
  'vam.ac.uk',
  'tate.org.uk',
  'moma.org',
  'guggenheim.org',
  'getty.edu',
  'nga.gov',
  'npg.org.uk',
  'ashmolean.org',
  'smb.museum',
  'musee-orsay.fr',
  'centrepompidou.fr',
  'si.edu',
  'americanart.si.edu',
  'asia.si.edu',
  'nmaahc.si.edu',
  'airandspace.si.edu',
  'naturalhistory.si.edu',

  // Universities
  'harvard.edu',
  'stanford.edu',
  'mit.edu',
  'ox.ac.uk',
  'cam.ac.uk',
  'ucl.ac.uk',
  'columbia.edu',
  'uchicago.edu',
  'yale.edu',
  'princeton.edu',
  'berkeley.edu',
  'utoronto.ca',
  'ethz.ch',
  'epfl.ch'
];

const museumDomains = new Set([
  'britishmuseum.org','metmuseum.org','louvre.fr','rijksmuseum.nl','museodelprado.es',
  'vam.ac.uk','tate.org.uk','moma.org','guggenheim.org','getty.edu','nga.gov','npg.org.uk',
  'ashmolean.org','smb.museum','musee-orsay.fr','centrepompidou.fr','si.edu',
  'americanart.si.edu','asia.si.edu','nmaahc.si.edu','airandspace.si.edu','naturalhistory.si.edu'
]);

const academicDomains = new Set([
  'nature.com','science.org','nejm.org','thelancet.com','cell.com','pnas.org',
  'pubmed.ncbi.nlm.nih.gov','ncbi.nlm.nih.gov','jstor.org',
  'harvard.edu','stanford.edu','mit.edu','ox.ac.uk','cam.ac.uk','ucl.ac.uk',
  'columbia.edu','uchicago.edu','yale.edu','princeton.edu','berkeley.edu',
  'utoronto.ca','ethz.ch','epfl.ch'
]);

function hostnameInSet(host, set) {
  const h = (host || '').toLowerCase();
  for (const d of set) {
    if (h === d || h.endsWith(`.${d}`)) return true;
  }
  return false;
}

function isAllowedUrl(u) {
  try {
    if (typeof u !== 'string') return false;
    const trimmed = u.trim();
    if (!trimmed.startsWith('https://')) return false;

    const url = new URL(trimmed);

    // Disallow obvious shorteners
    const forbiddenHosts = new Set(['bit.ly', 't.co', 'tinyurl.com', 'goo.gl']);
    if (forbiddenHosts.has(url.hostname.toLowerCase())) return false;

    // Must be a specific page, not homepage
    if (!url.pathname || url.pathname === '/' || url.pathname.length < 2) return false;

    const host = url.hostname.toLowerCase();
    return allowedDomains.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

function extractJsonByBraces(text) {
  const s = text || '';
  const start = s.indexOf('{');
  if (start === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (inString) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') inString = false;
      continue;
    } else {
      if (ch === '"') {
        inString = true;
        continue;
      }
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

function validateResult(result) {
  if (!result || typeof result !== 'object') return 'Invalid structure';
  if (!Array.isArray(result.items) || result.items.length !== 5) return 'Must return exactly 5 items';

  const allowedCategories = new Set([
    'Psychology','History','Nature','Culture','Philosophy','Language','Food','Art','Science','Folklore'
  ]);

  const seenIdx = new Set();
  let museumHit = 0;
  let academicHit = 0;

  for (const item of result.items) {
    if (!item || typeof item !== 'object') return 'Invalid item';
    if (typeof item.index !== 'number' || item.index < 1 || item.index > 5) return 'Invalid index';
    if (seenIdx.has(item.index)) return 'Duplicate index';
    seenIdx.add(item.index);

    if (!allowedCategories.has(item.category)) return 'Invalid category';

    const zh = String(item.content_zh || '');
    const en = String(item.content_en || '');
    if (!zh.includes('[1]') || !en.includes('[1]')) return 'Missing inline citation marker';

    if (!Array.isArray(item.citations) || item.citations.length < 1 || item.citations.length > 2) {
      return 'Each item must have 1-2 citations';
    }

    for (const c of item.citations) {
      if (!c || typeof c !== 'object') return 'Invalid citation';
      if (!c.source_name || !c.source_url) return 'Citation missing fields';
      if (!isAllowedUrl(c.source_url)) return 'Invalid citation URL/domain';

      const host = new URL(c.source_url).hostname;
      if (hostnameInSet(host, museumDomains)) museumHit++;
      if (hostnameInSet(host, academicDomains)) academicHit++;
    }
  }

  if (museumHit < 1) return 'Must include at least one museum source';
  if (academicHit < 1) return 'Must include at least one academic source';

  return null;
}

export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none';");

  // Strict CORS
  const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN;
  const origin = req.headers.origin;

  if (ALLOWED_ORIGIN) {
    if (origin === ALLOWED_ORIGIN) {
      res.setHeader('Access-Control-Allow-Origin', ALLOWED_ORIGIN);
      res.setHeader('Vary', 'Origin');
      res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    } else if (origin) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  }

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit (Upstash)
  const ip =
    (req.headers['x-forwarded-for'] || '').toString().split(',')[0].trim() ||
    req.socket?.remoteAddress ||
    'unknown';

  const { success } = await ratelimit.limit(`ip:${ip}`);
  if (!success) return res.status(429).json({ error: 'Too many requests' });

  // Auth
  const { password, timezone } = req.body || {};
  const SITE_PASSWORD = process.env.SITE_PASSWORD;

  if (!SITE_PASSWORD || typeof password !== 'string' || password !== SITE_PASSWORD) {
    // minimal delay to slow brute forcing
    await new Promise(r => setTimeout(r, 400));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
  if (!CLAUDE_API_KEY) return res.status(500).json({ error: 'Server misconfigured' });

  // Safe timezone
  let userTimezone = 'UTC';
  if (typeof timezone === 'string' && timezone.length <= 64) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: timezone });
      userTimezone = timezone;
    } catch {
      userTimezone = 'UTC';
    }
  }

  const today = new Date().toLocaleDateString('en-US', {
    timeZone: userTimezone,
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  const prompt = `
You are a curiosity generator for Nicole — a highly open, intellectually adventurous person who loves culture, history, psychology, human nature, natural science, art, aesthetics, language, food, travel, and philosophy.

Generate exactly 5 fascinating facts — each from a completely different domain.

Hard rules:
- Exactly 5 items.
- Each item must include 1–2 citations in "citations".
- content_en and content_zh MUST include inline citation markers like [1] or [1][2].
- At least 1 item must cite a Museum domain.
- At least 1 item must cite a Journal, University, or Database domain.
- source_url must be a direct https URL to a specific page (not a homepage).
- Only use allowed domains listed below. Never fabricate sources or URLs. If unsure, choose a different fact.

Allowed domains:
Encyclopedia: en.wikipedia.org, britannica.com
Journals/Databases: nature.com, science.org, nejm.org, thelancet.com, cell.com, pnas.org, pubmed.ncbi.nlm.nih.gov, ncbi.nlm.nih.gov, jstor.org
Museums: britishmuseum.org, metmuseum.org, louvre.fr, rijksmuseum.nl, museodelprado.es, vam.ac.uk, tate.org.uk, moma.org, guggenheim.org, getty.edu, nga.gov, npg.org.uk, ashmolean.org, smb.museum, musee-orsay.fr, centrepompidou.fr, si.edu, americanart.si.edu, asia.si.edu, nmaahc.si.edu, airandspace.si.edu, naturalhistory.si.edu
Universities: harvard.edu, stanford.edu, mit.edu, ox.ac.uk, cam.ac.uk, ucl.ac.uk, columbia.edu, uchicago.edu, yale.edu, princeton.edu, berkeley.edu, utoronto.ca, ethz.ch, epfl.ch

Return ONLY raw valid JSON:
{
  "date": "${today}",
  "items": [
    {
      "index": 1,
      "emoji": "one relevant emoji",
      "category": "one of: Psychology / History / Nature / Culture / Philosophy / Language / Food / Art / Science / Folklore",
      "title_zh": "Chinese title under 10 characters",
      "title_en": "English title under 8 words",
      "content_zh": "Chinese content 100-150 characters with [1]",
      "content_en": "English content 80-120 words with [1]",
      "insight_zh": "💡 一句点睛中文洞察（20字以内）",
      "insight_en": "💡 One sharp English insight under 20 words",
      "citations": [
        {
          "label": "[1]",
          "source_type": "Museum / Journal / Encyclopedia / University / Institution / Media / Database",
          "source_name": "Publisher + page title",
          "source_url": "https://... (direct page)",
          "locator": "optional: section/heading, object ID, DOI, PMID, or page anchor"
        }
      ]
    }
  ]
}
`;

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-3-5-haiku-20241022',
        max_tokens: 4096,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data) return res.status(502).json({ error: 'Upstream AI error' });

    const rawText = data?.content?.[0]?.text;
    if (!rawText || typeof rawText !== 'string') return res.status(502).json({ error: 'Empty AI response' });

    const trimmed = rawText.trim();

    let result = null;
    try {
      result = JSON.parse(trimmed);
    } catch {
      const extracted = extractJsonByBraces(trimmed);
      if (!extracted) return res.status(502).json({ error: 'Invalid AI output format' });
      try {
        result = JSON.parse(extracted);
      } catch {
        return res.status(502).json({ error: 'Invalid AI JSON' });
      }
    }

    const validationError = validateResult(result);
    if (validationError) return res.status(502).json({ error: 'AI output failed validation' });

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: 'Server error. Please try again.' });
  }
}
