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

const VALID_MOODS = ["surprise", "dark", "funny", "contemplative", "beautiful", "unsettling", "any"];

const MOOD_PROMPTS = {
  surprise:      "Prioritise facts that are jaw-dropping and completely counterintuitive — things that make you question reality.",
  dark:          "Lean into the dark, unsettling and morally complicated corners of history and human nature.",
  funny:         "Find the absurd, darkly comic and embarrassing moments — wit over solemnity.",
  contemplative: "Choose facts that invite slow reflection — on meaning, time, consciousness, and the human condition.",
  beautiful:     "Seek out the quietly astonishing — natural phenomena, artistic achievements, or acts of unexpected grace.",
  unsettling:    "Prioritise facts that are deeply strange, subtly wrong, or that leave a lingering unease.",
  any:           "No particular mood — full range of tone and subject matter.",
};

const topicPool = [
  "the real cause of the Library of Alexandria decline","Byzantine Greek fire lost formula",
  "how the Black Death accidentally caused the Renaissance","the Mongol invasion that stopped at Vienna",
  "the Dancing Plague of 1518 Strasbourg","the War of Jenkins Ear absurdity",
  "the Great Molasses Flood of Boston 1919","Operation Mincemeat WWII corpse deception",
  "the Radium Girls and corporate cover-up","the man who single-handedly prevented nuclear war 1983",
  "how the CIA covertly funded abstract expressionism","forgotten female pharaohs erased from Egyptian history",
  "the Stasi secret smell archive","ancient Roman fast food thermopolia archaeology",
  "how medieval peasants had more holidays than modern workers","Viking shield-maidens DNA evidence",
  "the Dunning-Kruger effect more nuanced than memes suggest","embodied cognition changing philosophy of mind",
  "how total sleep deprivation mimics acute psychosis","why human memory is reconstructive not reproductive",
  "the rubber hand illusion and body ownership","how language shapes color discrimination ability",
  "decision fatigue in parole board judges","the replication crisis destroying classic psychology",
  "tardigrades surviving hard vacuum of space","mycorrhizal wood wide web forest communication",
  "anglerfish male dissolving into female body","the immortal jellyfish biological immortality",
  "Ophiocordyceps zombie ant fungus precise neurology","slime mold solving Tokyo subway optimization",
  "pistol shrimp cavitation bubble hotter than sun surface","mantis shrimp seeing 16 color channels",
  "Polynesian open ocean navigation by stars waves and swells","Aboriginal Australian songlines as geographic GPS",
  "the Pirahaa people with no numbers recursion or creation myth","cargo cults rational interpretation of colonial contact",
  "how the industrial clock changed human concept of time","childhood as an invented concept with a historical birth date",
  "Zhuangzi butterfly dream and the problem of identity","Stoic negative visualization as modern cognitive therapy",
  "what the trolley problem was actually designed to prove","simulation theory most serious academic arguments",
  "placebo effect working in fully open-label conditions","CRISPR discovered by accident studying yogurt bacteria",
  "Barry Marshall drinking H pylori to prove stomach ulcer cause","dark matter never directly detected yet certain it exists",
  "how anesthesia works is still genuinely not fully understood","GPS accuracy requiring Einstein general relativity correction",
  "how Vermeer likely used a camera obscura","why blue pigment was worth more than gold in medieval Europe",
  "Japanese wabi-sabi as complete philosophy of imperfection","Hieronymus Bosch monsters as illustrated Flemish proverbs",
  "how musical notation nearly disappeared in early Christianity","Freudian psychology weaponized by Bernays for mass advertising",
  "each sourdough starter having unique regional microbial fingerprint","umami discovered by Japanese scientist studying kombu 1908",
  "cilantro soap taste linked to specific olfactory receptor gene","MSG demonization as deliberate racist marketing campaign",
  "how language shapes spatial reasoning not just vocabulary","grammatical tense revealing how cultures perceive time differently",
  "bee waggle dance as genuine symbolic language with syntax","how creole languages emerge fully formed in one generation",
  "history of premature burial and the safety coffin patent industry","hysteria diagnosis as systematic medical control of women",
  "phrenology pseudoscience believed by serious 19th century scientists","solitary confinement causing measurable brain damage in weeks",
  "Toxoplasma changing human behavior and risk tolerance","how octopuses dream and change color while sleeping",
  "how Venus flytraps count to avoid false triggers","forgotten Songhai empire larger than Western Europe",
  "how salt built empires caused revolutions and mapped trade routes","fermentation as humanity oldest biotechnology predating writing",
  "how the Columbian Exchange changed every cuisine on earth","real history of witch trials as property inheritance disputes",
  "how the concept of hell changed radically across Christian history","Victorian death photography as love and grief ritual",
  "the economics of pirate democracy and their constitutions","how cartographers planted fake towns to catch plagiarists",
  "human sacrifice as debt economy and political theater","the hidden sophistication of oral tradition memory systems",
  "how cities increase innovation rates by measurable mathematics","the invention of privacy as a bourgeois modern concept",
  "gift economies and the obligation to give receive and reciprocate","the anthropology of gossip as social grooming and bonding",

  // Southeast Asia & Pacific
  "the Khmer Empire hydraulic city of Angkor Wat","Majapahit empire controlling Southeast Asian trade routes",
  "how the Austronesian migration reshaped half the world","the Toraja people of Sulawesi and their elaborate death rituals",
  "Balinese subak irrigation as UNESCO living philosophy","the tattooing traditions of Polynesia as genealogical records",
  "how Manila galleons connected Asia and the Americas for 250 years","the headhunting traditions of Borneo as spiritual ecology",

  // Islamic Golden Age & Middle East
  "how Baghdad House of Wisdom preserved Greek knowledge Europe forgot","Ibn Battuta traveling further than Marco Polo ever did",
  "Al-Khwarizmi inventing algebra to solve inheritance disputes","how Islamic geometric art encodes mathematical impossibilities",
  "the Persian postal system that inspired every modern mail service","Avicenna's Canon of Medicine used in European universities until 1700s",
  "how coffee culture began in Sufi monasteries of Yemen","the Assassins hashhashin as political terror pioneers",

  // African Empires & History
  "Mansa Musa's pilgrimage crashing the Mediterranean gold economy","the Great Zimbabwe stone city built without mortar",
  "how Timbuktu had more books than any European city in 1500","the Dahomey Amazons as the world's most feared female army",
  "Sundiata Keita founding Mali Empire from a crippled childhood","the Benin bronze plaques as sophisticated historical photography",
  "how Ethiopia defeated Italy becoming a symbol of African resistance","the Swahili coast as where Africa and Arabia fused into one culture",

  // Ancient Americas
  "how Inca khipu knotted strings may encode phonetic language","the Nazca lines visible only from above baffling archaeologists",
  "Teotihuacan being the largest city on earth in 500 CE","how Maya zero concept transformed mathematics centuries before Europe",
  "the Cahokia city near modern St Louis larger than medieval London","how chocolate was currency in Mesoamerica",
  "the Amazon as a largely human-created landscape not a wilderness","Chaco Canyon as a prehistoric astronomical observatory network",

  // Body & Medicine
  "how the appendix is actually a useful immune system reservoir","the placebo surgery that worked as well as real knee surgery",
  "why left-handedness was systematically beaten out of children","how bloodletting persisted for 2000 years despite killing patients",
  "the woman with 99 percent of pain receptors missing who feels almost nothing","how hunger hormones change moral decision making",
  "Victorian doctors diagnosing female hysteria by inducing orgasm","why yawning is contagious even in dogs watching humans",
  "the man whose stomach window gave doctors 50 years of digestion data","how the gut microbiome outnumbers human cells ten to one",

  // Language & Communication
  "how whistled languages carry across mountains where shouting fails","the Nicaraguan Sign Language created spontaneously by deaf children",
  "how swearing activates different brain regions than normal speech","the language with no past tense spoken in a timeless present",
  "how emoji are evolving their own grammar and syntax","the Oxford English Dictionary completed after 70 years and immediately outdated",
  "how bilingualism delays Alzheimer's onset by measurable years","the translation that started World War One by one ambiguous word",

  // Architecture & Cities
  "how Notre Dame cathedral was engineered without computers","the floating gardens of Tenochtitlan as Aztec hydraulic genius",
  "why Roman concrete has lasted 2000 years while modern concrete crumbles","the underground cities of Cappadocia housing 20000 people",
  "how medieval stonemasons encoded pagan symbols in Christian churches","the deliberately crooked stave churches of Norway",
  "how Haussmann demolished half of Paris to prevent revolution","the unfinished Sagrada Familia already the most visited building in Spain",

  // Crime, Law & Justice
  "how fingerprinting was invented from a dispute about a curry recipe","the Bloody Code of England hanging people for stealing a handkerchief",
  "how Prohibition created organized crime in America","the trial of a pig for murder in medieval France",
  "how forensic accounting caught Al Capone where everything else failed","the wrongful conviction rate making death penalty irreversible error",
  "how jury nullification secretly overrides unjust laws","the bounty hunter system as privatized law enforcement",

  // Economics & Trade
  "how the tulip mania bubble was not actually irrational","the Silk Road as a vector for plague not just goods",
  "how the British East India Company had its own army and courts","the potato fundamentally reshaping European population and power",
  "how spice prices motivated Columbus to accidentally discover America","the Dutch Golden Age funded entirely by herring fishing",
  "how usury laws against interest shaped medieval Christian economics","the cigarette as the most stable currency in prisoner economies",

  // Music & Sound
  "how music in minor keys sounds sad only in cultures exposed to Western theory","the castrati singers of baroque Europe sacrificed for a voice",
  "how Robert Johnson allegedly sold his soul at the crossroads and why people believed it","the talking drums of West Africa as a long-distance telephone network",
  "how silence in music is as compositionally important as sound","the brown note frequency that allegedly causes involuntary bowel movement",
  "how Beethoven composed his greatest works completely deaf","the 639-year-long organ concert playing in a German church",

  // Animals & Evolution
  "how crows hold grudges and teach their children to hate specific humans","the crow funeral behavior as possible grief ritual",
  "how elephants mourn their dead with rituals lasting days","the axolotl regenerating its own heart and brain without scarring",
  "how whales evolved from a small wolf-like land mammal","the bombardier beetle spraying boiling chemicals from its abdomen",
  "how ants wage total war with tactics mirroring human military strategy","the immortal lobster that may never die of old age",
  "how dogs have co-evolved with humans to read our facial expressions","the parasite that makes mice attracted to cat urine",

  // Philosophy & Ethics
  "Derek Parfit's personal identity thought experiments dissolving the self","Peter Singer's drowning child argument that makes most of us hypocrites",
  "how the Stoics practiced poverty to become immune to losing wealth","Diogenes the Cynic living in a barrel to embarrass Plato",
  "the experience machine thought experiment refusing a perfect simulation","how Confucian ethics centered ritual rather than rules",
  "the is-ought problem making every moral claim philosophically unjustifiable","how Pascal's wager fails even on its own terms",

  // Textiles & Fashion
  "how blue jeans were invented to survive gold rush mining not fashion","the sumptuary laws controlling who could wear what color in medieval Europe",
  "how silk production was a capital offense to reveal outside China","the paisley pattern originating as a Zoroastrian symbol of life",
  "how high heels were originally worn by men for horse riding","the corset as Victorian women's contested symbol of both oppression and power",
];

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
  const moodRaw  = typeof body.mood === "string" ? body.mood.toLowerCase().trim() : "any";
  const mood     = VALID_MOODS.includes(moodRaw) ? moodRaw : "any";

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
    year: "numeric", month: "long", day: "numeric",
  });

  const seeds = [...topicPool].sort(() => Math.random() - 0.5).slice(0, 5);
  const seedHint = seeds.join(" / ");
  const moodInstruction = MOOD_PROMPTS[mood];

  // Recent titles from request body to avoid repetition
  const recentTitles = Array.isArray(body.recentTitles)
    ? body.recentTitles.slice(0, 30).filter(t => typeof t === 'string').map(t => t.slice(0, 80))
    : [];
  const avoidHint = recentTitles.length > 0
    ? `\n\nAvoid repeating or closely resembling these recently shown topics:\n${recentTitles.map(t => '- '+t).join('\n')}`
    : '';

  const prompt = `You are a curiosity generator — fearlessly curious, covering culture, history, psychology, human nature, science, art, language, food, travel, philosophy, and everything weird and true about the world.

Today's mood: ${mood.toUpperCase()} — ${moodInstruction}

Today's random seeds (inspiration only, not literal topics): ${seedHint}

Generate exactly 5 fascinating facts — each from a completely different domain, era, culture, and corner of knowledge.

Rules:
- Something the reader has almost certainly never encountered before
- Go beyond Wikipedia — find the strange, counterintuitive, or darkly funny angle
- 40-55 English words per content_en (no lists, a small story with texture)
- Tone must match today's mood
- One sharp insight that reframes how you see the world
- source: cite the most specific real source you can. Use this format depending on type:
    Book: Lastname, Firstname. Title (Year)
    Journal article: Lastname, Firstname. "Article title." Journal Name (Year)
    Institution/museum: Institution Name
    Website/publication: Publication Name
  Include author name whenever one exists. No URLs. Must be real and verifiable.
- tags: 2-3 broad thematic tags that will be shared across many entries. Always include the category name as one tag (e.g. "psychology", "history"). Use high-level concepts only — not specific facts. Choose from themes like: memory, perception, behavior, identity, consciousness, power, death, ritual, time, evolution, ecology, language, food, art, war, religion, body, society, gender, money, science, nature, culture, philosophy, folklore, health, emotion, politics, technology, trade, empire, belief, discovery

Return ONLY this exact JSON, no markdown, no explanation, nothing else:
{
  "date": "${today}",
  "mood": "${mood}",
  "items": [
    {
      "index": 1,
      "category": "Psychology",
      "title_zh": "Chinese title under 10 characters",
      "title_en": "English title under 8 words",
      "content_zh": "55-70 Chinese characters",
      "content_en": "40-55 words",
      "insight_zh": "点睛洞察15字以内",
      "insight_en": "One sharp insight under 15 words",
      "source": "Formatted source citation",
      "tags": ["psychology", "behavior"]
    }
  ]
}

category must be exactly one of: Psychology / History / Nature / Culture / Philosophy / Language / Food / Art / Science / Folklore
Forbidden: motivational content, fabricated sources, repeated domains across 5 items, any text outside the JSON.${avoidHint}`;

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
        max_tokens: 3000,
        temperature: 0.8,
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
    if (!jsonMatch) return res.status(502).json({ error: "Could not find JSON in response" });

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch {
      const repaired = jsonMatch[0]
        .replace(/[\u0000-\u001F\u007F]/g, " ")
        .replace(/,\s*}/g, "}")
        .replace(/,\s*]/g, "]");
      try { result = JSON.parse(repaired); }
      catch { return res.status(502).json({ error: "JSON parse failed", raw_sample: cleaned.slice(0, 800) }); }
    }

    if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
      return res.status(502).json({ error: "Invalid response structure" });
    }

    result.mood = mood;
    return res.status(200).json(result);

  } catch {
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
