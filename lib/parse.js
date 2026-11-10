// Turns pasted order notes (English / Sinhala / mixed) into structured quotation data
// using NVIDIA's OpenAI-compatible API. The API key never leaves the server.

const API_URL = 'https://integrate.api.nvidia.com/v1/chat/completions';
const DEFAULT_MODELS = ['nvidia/nemotron-3-ultra-550b-a55b', 'nvidia/nemotron-3.5-bolt-e4b'];

const SYSTEM_PROMPT = `You convert rough catering order notes for "The Viyana" (a Sri Lankan restaurant in Kandy) into JSON for a printed quotation.
Notes may be in English, Sinhala, or Singlish, with spelling mistakes.

Return ONLY a JSON object, no markdown, with this shape:
{
  "client": {"prepared_for": "", "event": "", "event_date": "", "venue": "", "contact": "", "guests": ""},
  "menu_title": "Buffet Menu",
  "sections": [ {"title": "Main Course", "items": [ {"name": "", "sinhala": "", "note": "", "qty": ""} ]} ],
  "pricing": {
    "type": "per_person",
    "per_person_price": 0,
    "lines": [ {"description": "", "details": "", "amount": 0} ]
  },
  "includes": [],
  "notes": []
}

Rules:
- Fix spelling and use proper Title Case English dish names (e.g. "Chicken kuruma" -> "Chicken Kurma", "Lemon grass rice" -> "Lemongrass Rice", "Papadam peenut mix" -> "Papadam & Peanut Mix", "Mango chatny" -> "Mango Chutney", "Watalapam" -> "Watalappan", "Broken july pudin" -> "Broken Jelly Pudding", "Malldive fish sambal" -> "Maldive Fish Sambol", "chopsey" -> "Chop Suey", "Ginger plan tea" -> "Ginger Plain Tea", "ඇම්බන් කෙසෙල්" -> "Ambul Banana").
- If the WHOLE dish name was written in Sinhala script, put the English name in "name" and the clean Sinhala dish name in "sinhala" (drop words like කෑලි / කැලි = pieces). If the dish was in English or mixed English+Sinhala (e.g. "Egg ෆ්‍රයිඩ් රයිස්"), leave "sinhala" empty.
- Traditional names: කිරිබත් රතු -> "Red Kiribath", සුදු කිරිබත් -> "White Kiribath", මුං කැවුම් -> "Mung Kavum", අතිරස -> "Athirasa", කොකිස් -> "Kokis", ඇම්බන් / ඇඹුල් කෙසෙල් -> "Ambul Banana" (sinhala "ඇඹුල් කෙසෙල්"), මාළු ඇඹුල් තියල් -> "Fish Ambul Thiyal", කට්ටසම්බල් -> "Katta Sambol" (sinhala "කට්ට සම්බෝල"), පුටු -> chairs.
- Words in brackets like "(Basmathi)" go in "note" (corrected, e.g. "Basmati"). "A or B" stays in one item: "Chicken Devilled or Chilli Chicken".
- "qty": only if a piece count is given for that dish (e.g. "75"). Write just the number. Otherwise "".
- Keep every dish, in the SAME ORDER as the notes. Do not add dishes.
- If the notes contain section headings (e.g. "Dessert"), use them. Otherwise group consecutive dishes: Soup (any soup goes in its own "Soup" section first), Main Course (rice, curries, fried rice, devilled, chop suey, mushroom), Salads & Accompaniments (salad, chutney, sambol, papadam), Dessert. For a traditional / kiribath / sweets order, put ALL dishes (kiribath, kavum, athirasa, kokis, banana, ambul thiyal, katta sambol) in ONE section "Traditional Items" and drinks in "Beverages" at the end. Skip empty sections.
- "menu_title": "Buffet Menu" for a rice-and-curry buffet, "Lunch Menu" / "Dinner Menu" / "Breakfast Menu" if stated, "Traditional Menu" for Sinhala sweets / kiribath / tea parties.
- A school, company, or person's name at the top is "client.prepared_for". Fill other client fields only if given.
- Pricing (NEVER invent numbers; numbers like "1500/=" are rupees):
  - A single price with no breakdown is per person: type "per_person", "per_person_price": that number, "lines": [].
  - If there are several priced lines (e.g. a package price plus chair hire), type "itemized" and one entry in "lines" per price. Make "description" a short title (e.g. "Catering Package", "Chairs with Covers × 60") and "details" a clean sentence of what it covers.
- "includes": things stated as included, as short phrases (e.g. "All cutlery with services" -> ["All cutlery & crockery", "Professional serving staff"]). Only what the notes say. For itemized pricing describe them inside the line "details" instead and leave "includes" empty.
- "notes": short clarifications worth printing (e.g. "Choice of Chicken Devilled or Chilli Chicken"). Can be empty.`;

function extractJson(text) {
  if (!text) throw new Error('Empty reply from AI');
  const cleaned = text.replace(/<think>[\s\S]*?<\/think>/g, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start < 0 || end < start) throw new Error('AI reply had no JSON');
  return JSON.parse(cleaned.slice(start, end + 1));
}

const str = (v) => (v == null ? '' : String(v).trim());
const SMALL = new Set(['of', 'or', 'and', 'with', 'in', 'a', 'the']);
const tidyName = (v) => str(v).replace(/\s+/g, ' ').split(' ')
  .map((w, i) => (i > 0 && SMALL.has(w.toLowerCase()) ? w.toLowerCase() : w)).join(' ');
const num = (v) => {
  const n = Number(String(v ?? '').replace(/[^0-9.]/g, ''));
  return Number.isFinite(n) ? n : 0;
};

// Make the AI output safe and predictable; totals are always computed here, not by the AI.
function normalize(d, text = '') {
  // Keep a Sinhala name only if it really came from the pasted notes
  const fromNotes = (si) => si.split(/\s+/).some((w) => w.length >= 3 && text.includes(w));
  const c = d.client || {};
  const sections = (Array.isArray(d.sections) ? d.sections : [])
    .map((s) => ({
      title: str(s.title),
      items: (Array.isArray(s.items) ? s.items : [])
        .map((i) => (typeof i === 'string' ? { name: i } : i))
        .map((i) => ({ name: tidyName(i.name), sinhala: fromNotes(str(i.sinhala)) ? str(i.sinhala) : '', note: str(i.note), qty: str(i.qty) }))
        .filter((i) => i.name),
    }))
    .filter((s) => s.items.length);
  const p = d.pricing || {};
  const lines = (Array.isArray(p.lines) ? p.lines : [])
    .map((l) => ({ description: str(l.description), details: str(l.details), amount: num(l.amount) }))
    .filter((l) => l.description || l.amount);
  const type = p.type === 'per_person' && num(p.per_person_price) ? 'per_person' : lines.length ? 'itemized' : 'per_person';
  return {
    client: {
      prepared_for: str(c.prepared_for), event: str(c.event), event_date: str(c.event_date),
      venue: str(c.venue), contact: str(c.contact), guests: str(c.guests),
    },
    menu_title: str(d.menu_title) || 'Menu',
    sections,
    pricing: {
      type,
      per_person_price: num(p.per_person_price) || (type === 'per_person' && lines[0] ? lines[0].amount : 0),
      lines: type === 'itemized' ? lines : [],
      total: lines.reduce((a, l) => a + l.amount, 0),
    },
    includes: (Array.isArray(d.includes) ? d.includes : []).map(str).filter(Boolean),
    notes: (Array.isArray(d.notes) ? d.notes : []).map(str).filter(Boolean),
  };
}

async function callModel(model, text, apiKey) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      temperature: 0,
      max_tokens: 3000,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: text },
      ],
    }),
    signal: AbortSignal.timeout(40000),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.detail || body.error?.message || `NVIDIA API error ${res.status}`);
  return extractJson(body.choices?.[0]?.message?.content);
}

export async function parseOrder(text, env = process.env) {
  const apiKey = env.NVIDIA_API_KEY;
  if (!apiKey) throw new Error('NVIDIA_API_KEY is not set on the server');
  if (!str(text)) throw new Error('Please paste the order details');
  const models = env.NVIDIA_MODEL ? [env.NVIDIA_MODEL, ...DEFAULT_MODELS] : DEFAULT_MODELS;
  let lastErr;
  for (const model of [...new Set(models)]) {
    try {
      return normalize(await callModel(model, text.slice(0, 6000), apiKey), text);
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr;
}

// Optional shared password (set APP_PASSWORD on the server to turn it on)
export function checkPassword(given, env = process.env) {
  return !env.APP_PASSWORD || given === env.APP_PASSWORD;
}
