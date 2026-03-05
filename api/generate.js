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

const TOPIC_POOL_BY_CAT = {
  Psychology: [
    "the Dunning-Kruger effect more nuanced than memes suggest","embodied cognition changing philosophy of mind",
    "how total sleep deprivation mimics acute psychosis","why human memory is reconstructive not reproductive",
    "the rubber hand illusion and body ownership","decision fatigue in parole board judges",
    "the replication crisis destroying classic psychology","placebo effect working in fully open-label conditions",
    "how hunger hormones change moral decision making","why yawning is contagious even in dogs watching humans",
    "Toxoplasma changing human behavior and risk tolerance","the parasite that makes mice attracted to cat urine",
    "solitary confinement causing measurable brain damage in weeks","hysteria diagnosis as systematic medical control of women",
    "how language shapes color discrimination ability","the woman with 99 percent of pain receptors missing",
    "how bilingualism delays Alzheimer's onset by measurable years","how swearing activates different brain regions than normal speech",
  ],
  History: [
    "the real cause of the Library of Alexandria decline","Byzantine Greek fire lost formula",
    "how the Black Death accidentally caused the Renaissance","the Mongol invasion that stopped at Vienna",
    "the Dancing Plague of 1518 Strasbourg","the War of Jenkins Ear absurdity",
    "the Great Molasses Flood of Boston 1919","Operation Mincemeat WWII corpse deception",
    "the Radium Girls and corporate cover-up","the man who single-handedly prevented nuclear war 1983",
    "how the CIA covertly funded abstract expressionism","forgotten female pharaohs erased from Egyptian history",
    "the Stasi secret smell archive","how medieval peasants had more holidays than modern workers",
    "Viking shield-maidens DNA evidence","real history of witch trials as property inheritance disputes",
    "the economics of pirate democracy and their constitutions","how cartographers planted fake towns to catch plagiarists",
    "human sacrifice as debt economy and political theater","Mansa Musa's pilgrimage crashing the Mediterranean gold economy",
    "the Great Zimbabwe stone city built without mortar","how Timbuktu had more books than any European city in 1500",
    "the Dahomey Amazons as the world's most feared female army","how Ethiopia defeated Italy becoming a symbol of African resistance",
    "how Manila galleons connected Asia and the Americas for 250 years","the Khmer Empire hydraulic city of Angkor Wat",
    "Ibn Battuta traveling further than Marco Polo ever did","Baghdad House of Wisdom preserved Greek knowledge Europe forgot",
    "how Prohibition created organized crime in America","the trial of a pig for murder in medieval France",
    "the Bloody Code of England hanging people for stealing a handkerchief","Victorian death photography as love and grief ritual",
    "how Haussmann demolished half of Paris to prevent revolution","how the industrial clock changed human concept of time",
    "childhood as an invented concept with a historical birth date",
  ],
  Nature: [
    "tardigrades surviving hard vacuum of space","mycorrhizal wood wide web forest communication",
    "anglerfish male dissolving into female body","the immortal jellyfish biological immortality",
    "Ophiocordyceps zombie ant fungus precise neurology","slime mold solving Tokyo subway optimization",
    "pistol shrimp cavitation bubble hotter than sun surface","mantis shrimp seeing 16 color channels",
    "how Venus flytraps count to avoid false triggers","how octopuses dream and change color while sleeping",
    "how crows hold grudges and teach their children to hate specific humans","the crow funeral behavior as possible grief ritual",
    "how elephants mourn their dead with rituals lasting days","the axolotl regenerating its own heart and brain without scarring",
    "how whales evolved from a small wolf-like land mammal","the bombardier beetle spraying boiling chemicals from its abdomen",
    "how ants wage total war with tactics mirroring human military strategy","the immortal lobster that may never die of old age",
    "how dogs have co-evolved with humans to read our facial expressions","bee waggle dance as genuine symbolic language with syntax",
    "the Amazon as a largely human-created landscape not a wilderness",
  ],
  Culture: [
    "Polynesian open ocean navigation by stars waves and swells","Aboriginal Australian songlines as geographic GPS",
    "the Pirahaa people with no numbers recursion or creation myth","cargo cults rational interpretation of colonial contact",
    "the hidden sophistication of oral tradition memory systems","how cities increase innovation rates by measurable mathematics",
    "the invention of privacy as a bourgeois modern concept","gift economies and the obligation to give receive and reciprocate",
    "the anthropology of gossip as social grooming and bonding","the Toraja people of Sulawesi and their elaborate death rituals",
    "Balinese subak irrigation as UNESCO living philosophy","the tattooing traditions of Polynesia as genealogical records",
    "the headhunting traditions of Borneo as spiritual ecology","the Swahili coast as where Africa and Arabia fused into one culture",
    "Sundiata Keita founding Mali Empire from a crippled childhood","the Benin bronze plaques as sophisticated historical photography",
    "how chocolate was currency in Mesoamerica","the sumptuary laws controlling who could wear what color in medieval Europe",
    "how high heels were originally worn by men for horse riding","how blue jeans were invented to survive gold rush mining not fashion",
    "the corset as Victorian women's contested symbol of both oppression and power",
  ],
  Philosophy: [
    "Zhuangzi butterfly dream and the problem of identity","Stoic negative visualization as modern cognitive therapy",
    "what the trolley problem was actually designed to prove","simulation theory most serious academic arguments",
    "Derek Parfit's personal identity thought experiments dissolving the self","Peter Singer's drowning child argument that makes most of us hypocrites",
    "how the Stoics practiced poverty to become immune to losing wealth","Diogenes the Cynic living in a barrel to embarrass Plato",
    "the experience machine thought experiment refusing a perfect simulation","how Confucian ethics centered ritual rather than rules",
    "the is-ought problem making every moral claim philosophically unjustifiable","how Pascal's wager fails even on its own terms",
    "how Avicenna's Canon of Medicine was used in European universities until 1700s","the Persian postal system that inspired every modern mail service",
    "how Islamic geometric art encodes mathematical impossibilities","how the concept of hell changed radically across Christian history",
  ],
  Language: [
    "how language shapes spatial reasoning not just vocabulary","grammatical tense revealing how cultures perceive time differently",
    "how creole languages emerge fully formed in one generation","the Nicaraguan Sign Language created spontaneously by deaf children",
    "how whistled languages carry across mountains where shouting fails","the language with no past tense spoken in a timeless present",
    "how emoji are evolving their own grammar and syntax","the Oxford English Dictionary completed after 70 years and immediately outdated",
    "the translation that started World War One by one ambiguous word","the talking drums of West Africa as a long-distance telephone network",
    "how bilingualism restructures brain architecture",
  ],
  Food: [
    "each sourdough starter having unique regional microbial fingerprint","umami discovered by Japanese scientist studying kombu 1908",
    "cilantro soap taste linked to specific olfactory receptor gene","MSG demonization as deliberate racist marketing campaign",
    "fermentation as humanity oldest biotechnology predating writing","how the Columbian Exchange changed every cuisine on earth",
    "how salt built empires caused revolutions and mapped trade routes","how spice prices motivated Columbus to accidentally discover America",
    "the Dutch Golden Age funded entirely by herring fishing","the potato fundamentally reshaping European population and power",
    "how coffee culture began in Sufi monasteries of Yemen","ancient Roman fast food thermopolia archaeology",
    "how chocolate was used as bitter ceremonial drink not sweet treat","the cigarette as the most stable currency in prisoner economies",
  ],
  Art: [
    "how Caravaggio used dramatic chiaroscuro to revolutionize Western painting",
    "the real story behind the Mona Lisa and why she became the world's most famous painting",
    "how Vermeer used optics to achieve impossible photographic precision in his paintings",
    "why Hieronymus Bosch's Garden of Earthly Delights remains genuinely unsettling 500 years later",
    "how Klimt's The Kiss encodes Viennese Secessionist eroticism in gold leaf",
    "the dark biography behind Frida Kahlo's self-portraits as pain made visible",
    "how Michelangelo painted the Sistine Chapel standing not lying on his back",
    "the Japanese art of kintsugi repairing broken pottery with gold to honor its history",
    "how Impressionism was rejected as incompetent by the Paris Salon establishment",
    "Picasso's Guernica as a political weapon painted in response to the bombing of civilians",
    "how ancient Greek sculpture was actually painted in vivid garish colors not white marble",
    "Duchamp's urinal as the most subversive artwork in Western art history",
    "Rembrandt's bankruptcy and how he painted his greatest works while deeply in debt",
    "how cave paintings at Chauvet were created 36000 years ago with sophisticated technique",
    "how Diego Rivera's Rockefeller Center mural was destroyed overnight for depicting Lenin",
    "how the color ultramarine blue was so expensive it was reserved only for the Virgin Mary",
    "how Turner's late atmospheric paintings predicted Impressionism by fifty years",
    "the real hidden symbolism inside Jan van Eyck's Arnolfini Portrait",
    "how Banksy turned street vandalism into one of the most valuable art brands in the world",
    "how Andy Warhol turned commercial imagery into high art",
    "how the Surrealists used dreams and automatic writing to unlock the unconscious in paint",
    "the story of Artemisia Gentileschi painting revenge on her rapist through biblical scenes",
    "how Pointillism emerged from a scientific theory of color perception",
    "the Degenerate Art exhibition where Nazis mocked modernism and inadvertently promoted it",
  ],
  Science: [
    "CRISPR discovered by accident studying yogurt bacteria","Barry Marshall drinking H pylori to prove stomach ulcer cause",
    "dark matter never directly detected yet certain it exists","how anesthesia works is still genuinely not fully understood",
    "GPS accuracy requiring Einstein general relativity correction","how the appendix is actually a useful immune system reservoir",
    "the placebo surgery that worked as well as real knee surgery","how bloodletting persisted for 2000 years despite killing patients",
    "the man whose stomach window gave doctors 50 years of digestion data","how the gut microbiome outnumbers human cells ten to one",
    "phrenology pseudoscience believed by serious 19th century scientists","how Notre Dame cathedral was engineered without computers",
    "why Roman concrete has lasted 2000 years while modern concrete crumbles","how Maya zero concept transformed mathematics centuries before Europe",
    "Teotihuacan being the largest city on earth in 500 CE","Chaco Canyon as a prehistoric astronomical observatory network",
  ],
  Folklore: [
    "the hidden sophistication of oral tradition memory systems","how the concept of hell changed radically across Christian history",
    "Aboriginal Australian songlines encoding geographical data over 10000 years","cargo cults as rational interpretation of colonial contact",
    "the real origins of werewolf legends in ergot poisoning","fairy rings as fungal phenomena mythologized across cultures",
    "how vampire folklore tracked real outbreaks of rabies and premature burial","the global flood myth appearing independently in 200 cultures",
    "how the Wild Hunt legend mapped migratory bird patterns","Baba Yaga as a pre-Christian Slavic death goddess",
    "the origins of the evil eye belief in evolutionary biology","how the Green Man appears in churches across Europe",
    "the Pied Piper of Hamelin as possible memory of a real catastrophe","how dragons appear independently in cultures with no contact",
  ],
};

function pickBalancedSeeds(n = 5) {
  const cats = Object.keys(TOPIC_POOL_BY_CAT);
  const shuffledCats = [...cats].sort(() => Math.random() - 0.5).slice(0, n);
  return shuffledCats.map(cat => {
    const pool = TOPIC_POOL_BY_CAT[cat];
    return pool[Math.floor(Math.random() * pool.length)];
  });
}

function buildPrompt({ today, mood, moodInstruction, seedHint, avoidHint }) {
  return `You are a curiosity generator — fearlessly curious, covering culture, history, psychology, human nature, science, art, language, food, travel, philosophy, and everything weird and true about the world.

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
}

function parseResult(text) {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return null;
  try {
    return JSON.parse(jsonMatch[0]);
  } catch {
    const repaired = jsonMatch[0]
      .replace(/[\u0000-\u001F\u007F]/g, " ")
      .replace(/,\s*}/g, "}")
      .replace(/,\s*]/g, "]");
    try { return JSON.parse(repaired); } catch { return null; }
  }
}

async function callClaude(prompt) {
  const upstream = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": CLAUDE_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 4000,   // ↑ from 3000 — prevents JSON truncation
      temperature: 0.7,   // ↓ from 0.8 — more reliable formatting
      messages: [{ role: "user", content: prompt }],
    }),
  });

  const raw = await upstream.text();
  let data = null;
  try { data = JSON.parse(raw); } catch {}

  if (!upstream.ok) {
    throw new Error(data?.error?.message || raw.slice(0, 300) || "Upstream error");
  }

  const text = data?.content?.[0]?.text;
  if (!text) throw new Error("Empty AI response");
  return text;
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

  const seeds = pickBalancedSeeds(5);
  const seedHint = seeds.join(" / ");
  const moodInstruction = MOOD_PROMPTS[mood];

  const recentTitles = Array.isArray(body.recentTitles)
    ? body.recentTitles.slice(0, 30).filter(t => typeof t === 'string').map(t => t.slice(0, 80))
    : [];
  const avoidHint = recentTitles.length > 0
    ? `\n\nAvoid repeating or closely resembling these recently shown topics:\n${recentTitles.map(t => '- '+t).join('\n')}`
    : '';

  const prompt = buildPrompt({ today, mood, moodInstruction, seedHint, avoidHint });

  // ── Try up to 2 times before giving up ──────────────────────────────────
  const MAX_ATTEMPTS = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const text = await callClaude(prompt);
      const result = parseResult(text);

      if (!result || !Array.isArray(result.items) || result.items.length === 0) {
        lastError = "Invalid response structure";
        continue; // silent retry
      }

      result.mood = mood;
      return res.status(200).json(result);

    } catch (err) {
      lastError = err.message || "Unknown error";
      // don't retry on auth errors
      if (lastError.includes("401")) break;
    }
  }

  return res.status(502).json({ error: "The AI is having a moment. Please try again.", detail: lastError });
}
