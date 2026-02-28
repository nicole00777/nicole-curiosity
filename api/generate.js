// api/generate.js  (Vercel Serverless Function, NOT Next.js pages/api)
//
// Required env vars on Vercel:
// - SITE_PASSWORD
// - CLAUDE_API_KEY
// - ALLOWED_ORIGIN  (recommended): https://nicole-curiosity.vercel.app   (no trailing slash)
//
// Optional:
// - CLAUDE_MODEL (default: claude-3-5-haiku-20241022)

import crypto from 'crypto';

const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || '';
const SITE_PASSWORD = process.env.SITE_PASSWORD || '';
const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || '';
const CLAUDE_MODEL = process.env.CLAUDE_MODEL || 'claude-3-5-haiku-20241022';

// ---- Best-effort in-memory rate limit (not perfect on multi-instance) ----
const WINDOW_MS = 60_000; // 1 minute
const MAX_REQ = 12;

function getIp(req) {
  const xff = (req.headers['x-forwarded-for'] || '').toString();
  return xff.split(',')[0].trim() || req.socket?.remoteAddress || 'unknown';
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

// ---- Timing-safe password compare ----
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

// ---- Domains allowlist (for citations) ----
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

function hostMatches(host, domain) {
  const h = (host || '').toLowerCase();
  const d = domain.toLowerCase();
  return h === d || h.endsWith(`.${d}`);
}

function isAllowedUrl(u) {
  try {
    if (typeof u !== 'string') return false;
    const s = u.trim();
    if (!s.startsWith('https://')) return false;

    const url = new URL(s);

    // block common shorteners
    const forbiddenHosts = new Set(['bit.ly', 't.co', 'tinyurl.com', 'goo.gl']);
    if (forbiddenHosts.has(url.hostname.toLowerCase())) return false;

    // must be a specific page
    if (!url.pathname || url.pathname === '/' || url.pathname.length < 2) return false;

    const host = url.hostname.toLowerCase();
    return allowedDomains.some(d => hostMatches(host, d));
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

// ---- Safer JSON extraction ----
function extractJsonByBraces(text) {
  const s = (text || '').trim();
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
    }

    if (ch === '"') { inString = true; continue; }
    if (ch === '{') depth++;
    if (ch === '}') depth--;
    if (depth === 0) return s.slice(start, i + 1);
  }
  return null;
}

function validateResult(result) {
  if (!result || typeof result !== 'object') return 'Bad JSON';
  if (!Array.isArray(result.items) || result.items.length !== 5) return 'Must return exactly 5 items';

  const allowedCategories = new Set([
    'Psychology','History','Nature','Culture','Philosophy','Language','Food','Art','Science','Folklore'
  ]);

  let museumHit = 0;
  let academicHit = 0;
  const seenIdx = new Set();

  for (const item of result.items) {
    if (!item || typeof item !== 'object') return 'Invalid item';
    if (typeof item.index !== 'number' || item.index < 1 || item.index > 5) return 'Invalid index';
    if (seenIdx.has(item.index)) return 'Duplicate index';
    seenIdx.add(item.index);

    if (!allowedCategories.has(item.category)) return 'Invalid category';

    const zh = String(item.content_zh || '');
    const en = String(item.content_en || '');
    if (!zh.includes('[1]') || !en.includes('[1]')) return 'Missing inline citation markers';

    if (!Array.isArray(item.citations) || item.citations.length < 1 || item.citations.length > 2) {
      return 'Each item must have 1-2 citations';
    }

    for (const c of item.citations) {
      if (!c || typeof c !== 'object') return 'Invalid citation';
      if (!c.source_name || !c.source_url) return 'Citation missing fields';
      if (!isAllowedUrl(c.source_url)) return 'Citation URL not allowed';
      if (isMuseumUrl(c.source_url)) museumHit++;
      if (isAcademicUrl(c.source_url)) academicHit++;
    }
  }

  if (museumHit < 1) return 'Need at least one museum source';
  if (academicHit < 1) return 'Need at least one academic/journal/university source';

  return null;
}

// ---- Vercel Serverless Function handler ----
export default async function handler(req, res) {
  // Security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');

  // Strict CORS (recommended)
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

  // Best-effort rate limit
  const ip = getIp(req);
  if (!rateLimit(ip)) return res.status(429).json({ error: 'Too many requests' });

  // Required env
  if (!SITE_PASSWORD || !CLAUDE_API_KEY) {
    return res.status(500).json({ error: 'Server misconfigured' });
  }

  // Parse JSON body (Vercel should give req.body; but guard anyway)
  const body = req.body || {};
  const password = typeof body.password === 'string' ? body.password : '';
  const timezone = typeof body.timezone === 'string' ? body.timezone : '';

  if (!password || !timingSafeEquals(password, SITE_PASSWORD)) {
    await new Promise(r => setTimeout(r, 350));
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Validate timezone
  let userTimezone = 'UTC';
  if (timezone && timezone.length <= 64) {
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
          "source_type": "Museum / Journal / Encyclopedia / University / Database",
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
    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        temperature: 0.6,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    const raw = await upstream.text();
let data = null;
try { data = JSON.parse(raw); } catch {}

/**
 * Anthropic errors are JSON with shape:
 * { type: "error", error: { type, message }, request_id }
 */
if (!upstream.ok) {
  const upstreamType = data?.error?.type || 'unknown_error';
  const upstreamMsg  = data?.error?.message || '';
  const requestId    = data?.request_id || upstream.headers.get('request-id') || '';

  // return minimal debug info (safe) so you can see if it's 401/403/404/429/529 etc.
  return res.status(502).json({
    error: 'Upstream AI error',
    upstream_status: upstream.status,
    upstream_type: upstreamType,
    upstream_message: upstreamMsg.slice(0, 200),
    upstream_request_id: requestId
  });
}

if (!data) {
  return res.status(502).json({
    error: 'Upstream AI error',
    upstream_status: upstream.status,
    upstream_type: 'invalid_json_from_upstream'
  });
}

    const text = data?.content?.[0]?.text;
    if (!text || typeof text !== 'string') return res.status(502).json({ error: 'Empty AI response' });

    let result = null;

    // strict parse first
    try {
      result = JSON.parse(text.trim());
    } catch {
      const extracted = extractJsonByBraces(text);
      if (!extracted) return res.status(502).json({ error: 'Invalid AI output format' });
      try {
        result = JSON.parse(extracted);
      } catch {
        return res.status(502).json({ error: 'Invalid AI JSON' });
      }
    }

    const vErr = validateResult(result);
    if (vErr) return res.status(502).json({ error: 'AI output failed validation' });

    // Backward compatibility for your existing front-end:
    // also provide item.source_name/source_url as the first citation.
    for (const item of result.items) {
      if (!item.source_name && Array.isArray(item.citations) && item.citations[0]) {
        item.source_name = item.citations[0].source_name || '';
        item.source_url = item.citations[0].source_url || '';
      }
    }

    return res.status(200).json(result);
  } catch {
    return res.status(500).json({ error: 'Server error' });
  }
}
