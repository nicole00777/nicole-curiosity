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

const topicPool = [
  // History — dark, forgotten, weird
  "the real cause of the Library of Alexandria's decline","Byzantine Greek fire lost formula",
  "how the Black Death accidentally caused the Renaissance","the Mongol invasion that stopped at Vienna and why",
  "Napoleon's hemorrhoids at Waterloo","the Dancing Plague of 1518 Strasbourg",
  "the Children's Crusade that never was","the War of Jenkins' Ear absurdity",
  "the Great Molasses Flood of Boston 1919","Operation Mincemeat WWII corpse deception",
  "the Radium Girls and corporate cover-up","the man who single-handedly prevented nuclear war 1983",
  "how the CIA covertly funded abstract expressionism","the real archaeological evidence for Troy",
  "the forgotten female pharaohs erased from Egyptian history","eunuchs running the Byzantine empire",
  "the Stasi's secret smell archive","ancient Roman fast food thermopolia archaeology",
  "how medieval peasants had more holidays than modern workers","Viking shield-maidens DNA evidence",
  "how the spice trade caused more deaths than any war","the forgotten Songhai empire larger than Western Europe",
  "Cleopatra's political genius beyond the love story","how the printing press caused 150 years of religious war",
  "the real story of the Salem witch trials as class warfare","the Ottoman Tulip Mania economics",
  "how tobacco created the American political system","the Taiping Rebellion that killed more than WWI",
  "how the British Empire ran on opium profits","how medieval maps deliberately distorted geography",
  "the forgotten plague of Athens that killed Pericles","how Genghis Khan's death was concealed for months",
  "the real history of the Assassins as political operators","how the Roman Empire dissolved so slowly nobody noticed",
  "the forgotten African kingdom of Kush that conquered Egypt","how cartographers planted fake towns to catch plagiarists",
  "Victorian death photography as love","the economics of pirate democracy and their constitutions",
  "how the Aztec flower wars were more economics than religion","the history of human zoos in European capitals until 1958",
  "how the guillotine was invented as a humanitarian device","the forgotten Black soldiers of WWI and their erasure",
  "how Napoleon standardized Europe more than any ideology","the real story behind the Boston Tea Party as smuggler rebellion",
  "how ancient Rome had a functional welfare state","the history of professional mourners as paid labor",
  "how the Inquisition actually acquitted most of its defendants","the medieval Islamic Golden Age that Europe deliberately forgot",

  // Psychology & Neuroscience
  "the Dunning-Kruger effect is more nuanced than memes suggest","embodied cognition changing philosophy of mind",
  "how total sleep deprivation mimics acute psychosis","the mere exposure effect and why familiarity breeds love",
  "why human memory is reconstructive not reproductive","the rubber hand illusion and body ownership",
  "social contagion of yawning in dogs and chimps","how language shapes color discrimination ability",
  "the bouba-kiki effect across cultures","decision fatigue in parole board judges",
  "the replication crisis destroying classic psychology findings","how disgust drives political conservatism",
  "terror management theory explaining culture and religion","how false memories get implanted easily",
  "music reducing pain perception measurably","the cocktail party effect and selective attention",
  "pareidolia as evolutionary advantage","inattentional blindness and the invisible gorilla",
  "how poverty literally reduces cognitive bandwidth","loneliness activating the same brain regions as physical pain",
  "mirror neurons controversy and what they actually do","how childhood trauma physically reshapes the brain",
  "why thinking about itching causes itching","how placebos work even when patients know they're placebos",
  "the nocebo effect killing people with belief alone","why humans are uniquely susceptible to narrative transportation",
  "how choice overload leads to worse decisions paradox","the IKEA effect making us love things we build",
  "how social rejection activates pain circuits in brain","the science of awe and its measurable health effects",
  "how eye contact rules differ fundamentally across cultures","the anthropology of crying as social signal",
  "why humans uniquely point at things for communication","how boredom is a uniquely human suffering with a purpose",
  "the psychology of confession across cultures and religions","how humans rationalize decisions already made",
  "why we remember the end of experiences more than middle","the psychology of revenge and why it rarely satisfies",

  // Nature & Biology — strange and unsettling
  "tardigrades surviving hard vacuum of space","mycorrhizal wood wide web forest communication",
  "anglerfish male dissolving into female body","the immortal jellyfish biological immortality mechanism",
  "how trees recognize and favor their own offspring","electric fish generating social signals like Morse code",
  "crow funerals and long-term individual recognition","Ophiocordyceps zombie ant fungus precise neurology",
  "slime mold solving Tokyo subway optimization problem","flowers using electric fields to communicate with bees",
  "whale culture passing between generations like human tradition","pistol shrimp cavitation bubble hotter than sun surface",
  "mantis shrimp seeing 16 color channels humans cannot imagine","wood frog freezing solid and resurrection each spring",
  "migratory birds navigating via quantum entanglement in eyes","cleaner wrasse fish passing mirror self-recognition test",
  "how plants count days and measure night length precisely","dolphins sleeping with literally half their brain at a time",
  "bombardier beetle internal explosion chemistry","bacterial quorum sensing collective decision making",
  "the oldest living organism clonal aspen grove Pando","dogs evolving facial muscles specifically to manipulate humans",
  "how human gut microbiome produces neurotransmitters","why humans are nearly hairless compared to other apes",
  "the evolution of laughter from ape play signals","whales retaining vestigial hind leg bones",
  "how coral reefs communicate via chemical distress signals","Toxoplasma changing human behavior and risk tolerance",
  "how octopuses dream and change color while sleeping","the mimic octopus impersonating 15 different species",
  "how Venus flytraps count to avoid false triggers","the axolotl regrowing brain and heart tissue",
  "how some birds use tools better than great apes","the platypus detecting electric fields in complete darkness",
  "how cuttlefish hypnotize prey with shifting skin patterns","the hagfish choking predators with instant expanding slime",
  "how ants wage war with strategies resembling human military","the pistol shrimp snapping claw creating a flash of light",
  "how some trees communicate danger through airborne chemicals","the decorator crab camouflaging itself with living organisms",

  // Culture & Anthropology
  "Polynesian open ocean navigation by stars waves and swells","Aboriginal Australian songlines as geographic and cultural GPS",
  "the Pirahã people with no numbers recursion or creation myth","linguistic relativity in spatial reasoning Guugu Yimithirr people",
  "cultures recognizing five or more gender categories historically","how left-handedness was systematically beaten out of children globally",
  "food taboos and their ecological and epidemiological logic","how cultures experience and express depression differently",
  "gift economies and the obligation to give receive and reciprocate","cargo cults and their rational interpretation of colonial contact",
  "the universality of music and what it reveals about human nature","how the industrial clock changed human concept of time",
  "childhood as an invented concept with a historical birth date","how adolescence was medicalized by G. Stanley Hall 1904",
  "the anthropology of queuing as social contract and culture","death ritual diversity revealing what the living fear most",
  "the economics of bride price and dowry as social insurance","how romantic love as marriage basis is historically very recent",
  "how cities increase innovation rates by measurable mathematics","the invention of privacy as a bourgeois modern concept",
  "why some languages grammatically require evidentiality markers","how honor cultures differ from dignity cultures psychologically",
  "the anthropology of gossip as social grooming and bonding","human sacrifice as debt economy and political theater",
  "how colonialism destroyed irreplaceable indigenous agricultural knowledge","the hidden sophistication of oral tradition memory systems",
  "how the veil became political rather than religious symbol","the anthropology of humor revealing power structures",
  "how globalization is homogenizing dreams worldwide","the neuroscience of religious and mystical experiences",
  "how childhood games encode cultural values unconsciously","the anthropology of silence and what it communicates",
  "how smiling means different things across cultures","the hidden social rules of gift giving across cultures",

  // Philosophy & Ideas
  "Zhuangzi's butterfly dream and the problem of identity","Stoic negative visualization as modern cognitive therapy",
  "how Nietzsche's actual ideas differ from their weaponized version","Wittgenstein's language games dismantling all of philosophy",
  "what the trolley problem was actually designed to prove","simulation theory's most serious academic arguments",
  "the Ship of Theseus in organ transplant and identity ethics","Plato's cave updated for algorithmic filter bubbles",
  "quantum mechanics and the hard problem of consciousness","compatibilism making free will and determinism coexist",
  "effective altruism's uncomfortable utilitarian conclusions","the philosophy of boredom and its creative function",
  "why Kant never left Königsberg and what that meant","Descartes' demon argument in the age of deepfakes",
  "Epicurus as the original misunderstood hedonist","the philosophy of disgust as foundation of moral emotion",
  "why Socrates refused to escape his own execution","Buddhist no-self and what neuroscience actually confirms",
  "wu wei as management philosophy with measurable evidence","how Confucianism shaped East Asian economic behavior",
  "the sorites paradox and why categories always fall apart","Heidegger's being-toward-death and modern death denial",
  "the philosophy of time and why now feels ontologically special","Camus's absurdism as practical daily philosophy",
  "the ethics of eating and its philosophical inconsistencies","how utilitarianism fails when pushed to its conclusions",
  "the paradox of tolerance and its modern relevance","why the is-ought problem undermines most moral arguments",

  // Science & Technology
  "placebo effect working in fully open-label conditions","quantum entanglement cannot transmit information and why",
  "the replication crisis and what we thought we knew about humans","CRISPR discovered by accident studying yogurt bacteria",
  "Barry Marshall drinking H. pylori to prove stomach ulcer cause","dark matter never directly detected yet we're certain it exists",
  "Rosalind Franklin's stolen X-ray and the double helix story","the Mpemba effect and why hot water sometimes freezes faster",
  "how anesthesia works is still genuinely not fully understood","the neuroscience of musical chills and frisson phenomenon",
  "olfaction as evolutionarily the oldest and most emotional sense","how braiding mathematics connects to topology and physics",
  "GPS accuracy requiring Einstein's general relativity correction","zero invented multiple times but rejected by Europe for centuries",
  "non-Euclidean geometry revealing that space itself is curved","the butterfly effect and fundamental limits of prediction",
  "how nuclear power's safety record dwarfs all fossil fuels","the mathematics of why impossible things happen given enough time",
  "how WEIRD psychology samples distort claimed human universals","the Drake equation giving wildly different answers depending on assumptions",
  "how the ozone hole was actually fixed through cooperation","the chemistry of why aged cheese develops complex flavors",
  "how refrigeration changed human society more than electricity","the science of why horror is pleasurable for some people",
  "how magic tricks exploit specific and predictable cognitive limitations","the mathematics of fair cake cutting and its unsolved problems",

  // Art & Aesthetics
  "how Vermeer likely used a camera obscura as optical projector","hidden sacred geometry in Renaissance paintings",
  "why blue pigment was worth more than gold in medieval Europe","Japanese wabi-sabi as complete philosophy of imperfection",
  "digitalis poisoning theory explaining Van Gogh's yellow vision","Hieronymus Bosch's monsters as illustrated Flemish proverbs",
  "how musical notation nearly disappeared in early Christianity","the brutal economics of Renaissance art patronage system",
  "Chinese literati painting theory of expressing not depicting","the Mona Lisa's eyebrows and their calculated disappearance",
  "how linear perspective was invented and rewired Western thought","Kandinsky hearing colors as genuine synesthesia in painting",
  "outsider art by psychiatric patients influencing modernism","how film editing exploits brain's automatic gap-filling reflex",
  "sacred architecture using acoustic design to induce altered states","Islamic geometric infinity patterns predating Western mathematics",
  "Freudian psychology weaponized by Bernays for mass advertising","why minor keys communicate sadness cross-culturally",
  "beauty standards across centuries showing no stable universal ideal","how graffiti evolved from political speech to museum walls",
  "the hidden erotic symbolism in Dutch Golden Age still life painting","how music streaming algorithms are homogenizing global sound",
  "the psychology of horror aesthetics and why we pay for fear","how propaganda uses art history to manufacture national identity",

  // Food, Fermentation & Chemistry
  "each sourdough starter having unique regional microbial fingerprint","how spices were literally worth their weight in gold historically",
  "umami discovered by Japanese scientist studying kombu seaweed 1908","cilantro soap taste linked to specific olfactory receptor gene variant",
  "sugar trade and Atlantic slavery as single economic system","how coffee houses were the original internet for Enlightenment ideas",
  "hangover caused by congeners not just alcohol dehydration","chocolate as bitter ceremonial drug before European sugar arrived",
  "Maillard reaction creating thousands of flavor compounds under heat","how salt built empires caused revolutions and mapped trade routes",
  "religious fasting and its measurable metabolic and psychological effects","alcohol shaping human evolution over millions of years",
  "cooking as the technology that enabled human brain growth","terroir as measurable microbial and mineral soil signature",
  "MSG demonization as deliberate racist marketing campaign history","fermentation as humanity's oldest biotechnology predating writing",
  "the economics of famine as political not agricultural failure","how the Columbian Exchange changed every cuisine on earth",
  "how food corporations engineered the bliss point to override satiety","the history of cannibalism as ritual medicine and social control",

  // Language & Linguistics
  "how language shapes spatial reasoning not just vocabulary","grammatical tense revealing how cultures perceive time differently",
  "reconstructing Proto-Indo-European from living daughter languages","etymology of swear words revealing cultural taboo history",
  "evidentiality markers requiring speakers to cite information sources","universal babbling stage proving language acquisition is biological",
  "the Sapir-Whorf hypothesis evidence that actually holds up","writing systems evolving independently from pictures to symbols globally",
  "bee waggle dance as genuine symbolic language with syntax","how creole languages emerge fully formed in one generation",
  "metaphor structuring all abstract thought not just poetry","politeness systems as linguistic mirrors of social hierarchy",
  "cultures without a word for blue not perceiving it as distinct","how literacy physically rewires the reading brain's visual cortex",
  "half the world's languages dying by 2100 with no documentation","how emojis are evolving their own emergent grammar rules",
  "how bilingualism measurably delays dementia onset","the grammar of time in Hopi language debate",
  "how whistled languages carry across mountains","the language of mathematics as invented or discovered debate",

  // Strange, Dark & Wonderful
  "history of premature burial and the safety coffin patent industry","how medieval people understood and medically treated dreams",
  "hysteria diagnosis as systematic medical control of women","phrenology pseudoscience believed by serious 19th century scientists",
  "patent medicines containing cocaine morphine and radium as cure-alls","the anthropology of taboo as cultural immune system",
  "evolutionary psychology of facial symmetry preference","Victorian freak shows as early celebrity culture economy",
  "cold reading techniques explaining psychic accuracy statistically","déjà vu as temporal lobe recognition circuit misfire",
  "near death experiences consistent neurological explanation","solitary confinement causing measurable brain damage in weeks",
  "how fortune telling psychology exploits the Barnum effect","the history of self-fulfilling prophecy in financial markets",
  "the science of why horror is pleasurable for certain brains","how superstitions persist in highly educated populations",
  "why humans universally fear the dark beyond childhood utility","how smells trigger involuntary autobiographical memories uniquely",
  "the history of solitude as luxury only wealthy could historically afford","how color naming affects color memory cross-culturally",
  "the psychology of why revenge rarely satisfies when achieved","how humans are uniquely adapted to run animals to exhaustion",
  "the economics of religion as social insurance and coordination","the real history of witch trials as property and inheritance disputes",
  "how the concept of hell changed radically across Christian history","the anthropology of apology and what it reveals about power",
  "why humans are one of the only animals that can choke on food","how the fear of death shapes all human culture and civilization",
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

  // Pick 5 random seeds from pool to force variety every generation
  const seeds = [...topicPool].sort(() => Math.random() - 0.5).slice(0, 5);
  const seedHint = seeds.join(" · ");

  const prompt = `You are a curiosity generator for Nicole — fearlessly curious, loves culture, history, psychology, human nature, science, art, language, food, travel, philosophy, and everything weird and true about the world.

Today's random inspiration seeds (use as jumping-off points, not literal topics): ${seedHint}

Generate exactly 5 fascinating facts — each from a completely different domain, era, culture, and corner of knowledge.

Each fact must:
- Be something Nicole has almost certainly never encountered before
- Go beyond the Wikipedia summary — find the angle that makes it strange, counterintuitive, or darkly funny
- Have real depth in 80-120 English words (not a list, a small story with texture)
- Carry clever, slightly wicked humor — like a well-traveled friend who reads too much
- End with a one-line insight that reframes how you see the world
- Cite a real, specific, verifiable source

Actively seek out:
- The embarrassing footnotes of official history
- Science findings that contradict common sense
- Cultural practices that flip Western assumptions upside down
- Moments where the so-called civilized world turns out to be the strange one
- Connections between things that seem completely unrelated

Return ONLY raw valid JSON, no markdown, no explanation:
{
  "date": "${today}",
  "items": [
    {
      "index": 1,
      "emoji": "one relevant emoji",
      "category": "one of: Psychology / History / Nature / Culture / Philosophy / Language / Food / Art / Science / Folklore",
      "title_zh": "Chinese title under 10 characters",
      "title_en": "English title under 8 words",
      "content_zh": "60-80 Chinese characters, smart and fluid",
      "content_en": "40-55 words, clever, a little wicked",
      "insight_zh": "一句点睛中文洞察20字以内",
      "insight_en": "One sharp reframing insight under 20 words",
      "source_name": "Real source: journal, book, museum, institution, or study",
      "source_url": "Most specific real URL available — prefer original study, journal, museum or university page over Wikipedia"
    }
  ]
}

Forbidden: anything that sounds like a listicle fun fact, safe trivia, motivational content, fabricated sources, repeated domains or eras across the 5 items, any text outside the JSON.`;

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
        max_tokens: 4096,
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

    let result;
    try {
      result = JSON.parse(jsonMatch[0]);
    } catch (parseErr) {
      return res.status(502).json({ 
        error: "JSON parse failed", 
        raw_sample: cleaned.slice(0, 500) 
      });
    }
    if (!result.items || !Array.isArray(result.items) || result.items.length === 0) {
      return res.status(502).json({ error: "Invalid response structure" });
    }

    return res.status(200).json(result);

  } catch {
    return res.status(500).json({ error: "Server error. Please try again." });
  }
}
