// Content generation for outreach + landing page.
//
// Strategy: the LLM generates STRUCTURED content (JSON), and we render the
// landing page from a fixed, well-tested HTML template. This keeps the markup
// always-valid and on-brand regardless of model output, and lets the whole
// thing degrade to a deterministic template when no API key is present.

import { GoogleGenAI } from '@google/genai';

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

let client = null;
function getClient() {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  client = new GoogleGenAI({ apiKey });
  return client;
}
export function llmAvailable() {
  return Boolean(process.env.GEMINI_API_KEY);
}

const TONES = {
  friendly: 'warm, approachable, and conversational',
  professional: 'polished, credible, and businesslike',
  bold: 'confident, punchy, and energetic',
};

// Sensible default services per category for the fallback path.
const CATEGORY_SERVICES = {
  restaurant: ['Online menu & ordering', 'Table reservations', 'Photo gallery'],
  cafe: ['Menu & specials', 'Loyalty sign-ups', 'Location & hours'],
  salon: ['Online booking', 'Service & price list', 'Before/after gallery'],
  gym: ['Class timetable', 'Membership sign-up', 'Trainer profiles'],
  dentist: ['Appointment booking', 'Treatments & pricing', 'Patient reviews'],
  hotel: ['Room booking', 'Photo gallery', 'Local guide & amenities'],
  retail: ['Product catalogue', 'New arrivals', 'Store locator'],
  default: ['Mobile-friendly homepage', 'Contact & enquiry form', 'Services showcase'],
};

export function normaliseProfile(input = {}) {
  return {
    businessName: (input.businessName || '').trim() || 'Your Business',
    category: (input.category || '').trim() || 'local business',
    city: (input.city || '').trim(),
    tone: TONES[input.tone] ? input.tone : 'friendly',
    senderName: (input.senderName || '').trim() || 'Adroitec Digital',
    offer: (input.offer || '').trim() || 'a fast, modern website',
  };
}

function servicesFor(category) {
  const key = Object.keys(CATEGORY_SERVICES).find((k) => category.toLowerCase().includes(k));
  return (CATEGORY_SERVICES[key] || CATEGORY_SERVICES.default).map((title) => ({
    title,
    desc: `${title}, done for you and designed to win more customers.`,
  }));
}

// Deterministic content used when no LLM is configured (still genuinely usable).
export function fallbackContent(profile) {
  const p = profile;
  const where = p.city ? ` in ${p.city}` : '';
  return {
    tagline: `${p.businessName}: ${capitalize(p.category)} done right`,
    about: `${p.businessName} is a trusted ${p.category}${where}. We make it effortless for customers to find you, learn what you offer, and get in touch, all from a clean, mobile-friendly website.`,
    services: servicesFor(p.category),
    outreach: {
      email: `Subject: A quick idea for ${p.businessName}\n\nHi ${p.businessName} team,\n\nI came across your ${p.category}${where} and loved what you do. I noticed there's a chance to reach a lot more customers online with ${p.offer}: something simple, modern, and mobile-friendly that turns searches into walk-ins and calls.\n\nI'd be happy to show you a free mock-up of what it could look like, no obligation. Would a quick 10-minute chat this week work?\n\nWarm regards,\n${p.senderName}`,
      whatsapp: `Hi! 👋 I came across ${p.businessName}${where} and really like what you do. I help ${p.category}s get more customers with ${p.offer}. I've even put together a free sample of what your site could look like. Can I send it over? 😊`,
      sms: `Hi ${p.businessName}! We help local ${p.category}s get more customers online with ${p.offer}. Free no-obligation mock-up ready, reply YES to see it. ${p.senderName}`,
    },
    source: 'fallback',
  };
}

const SYSTEM_PROMPT = `You are an expert B2B copywriter and conversion designer for a digital agency that builds websites for local businesses.

Given a business profile, produce marketing content as STRICT JSON only (no prose, no markdown fences) matching exactly:
{
  "tagline": "string (max 8 words, punchy)",
  "about": "string (2-3 sentences, customer-facing, for the business's own landing page)",
  "services": [ { "title": "string (2-4 words)", "desc": "string (one sentence)" }, ... 3 items ],
  "outreach": {
    "email": "string (a cold outreach EMAIL from the agency to the business owner; include a 'Subject:' line; ~120 words; ends with a soft CTA)",
    "whatsapp": "string (a short, friendly WhatsApp message, 1-3 sentences, may use 1-2 emojis)",
    "sms": "string (under 320 chars, plain, with a clear reply CTA)"
  }
}

Rules:
- The "about"/"tagline"/"services" are written FOR the business's own landing page (speak as the business).
- The "outreach" messages are written FROM the agency TO the business owner (speak as the agency pitching them).
- Be specific to the category and city. Sound human, not templated. No fake statistics or false claims.`;

function buildUserPrompt(p) {
  return `BUSINESS PROFILE:
- Name: ${p.businessName}
- Category: ${p.category}
- City/area: ${p.city || '(not specified)'}
- Agency sender name: ${p.senderName}
- What we're offering them: ${p.offer}
- Desired tone: ${TONES[p.tone]}

Return the JSON now.`;
}

function validateContent(obj) {
  if (!obj || typeof obj !== 'object') return false;
  if (typeof obj.tagline !== 'string' || typeof obj.about !== 'string') return false;
  if (!Array.isArray(obj.services) || obj.services.length === 0) return false;
  if (!obj.outreach || typeof obj.outreach.email !== 'string') return false;
  return true;
}

export async function generateContent(rawProfile) {
  const profile = normaliseProfile(rawProfile);
  const c = getClient();
  if (!c) return { profile, content: fallbackContent(profile) };

  try {
    const resp = await c.models.generateContent({
      model: MODEL,
      contents: buildUserPrompt(profile),
      config: { systemInstruction: SYSTEM_PROMPT, maxOutputTokens: 1200 },
    });
    const text = (resp.text || '').trim();
    const json = extractJson(text);
    if (validateContent(json)) {
      return { profile, content: { ...json, source: 'llm', model: MODEL } };
    }
    return { profile, content: fallbackContent(profile) };
  } catch (err) {
    return { profile, content: { ...fallbackContent(profile), error: err.message } };
  }
}

// Pull the first {...} JSON object out of a model response, tolerant of fences.
export function extractJson(text) {
  if (!text) return null;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf('{');
  const end = candidate.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

function capitalize(s) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** Render a complete, self-contained landing page from profile + content. */
export function renderLandingPage(profile, content) {
  const year = '2026';
  const serviceCards = content.services
    .map(
      (s) => `        <div class="svc">
          <h3>${esc(s.title)}</h3>
          <p>${esc(s.desc)}</p>
        </div>`,
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(profile.businessName)}</title>
<link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@600;700&family=Inter:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
  :root{--ink:#1a1a2e;--muted:#5b6275;--gold:#c8a24a;--bg:#faf8f3;--card:#fff;}
  *{box-sizing:border-box;margin:0;padding:0;}
  body{font-family:'Inter',system-ui,sans-serif;color:var(--ink);background:var(--bg);line-height:1.6;}
  .nav{display:flex;justify-content:space-between;align-items:center;padding:22px 7vw;}
  .logo{font-family:'Cormorant Garamond',serif;font-size:1.7rem;font-weight:700;}
  .nav a{color:var(--ink);text-decoration:none;margin-left:24px;font-size:.95rem;}
  .hero{text-align:center;padding:90px 7vw 80px;background:linear-gradient(180deg,#fff,var(--bg));}
  .hero h1{font-family:'Cormorant Garamond',serif;font-size:clamp(2.4rem,6vw,4rem);font-weight:700;line-height:1.1;}
  .hero p{color:var(--muted);font-size:1.2rem;max-width:620px;margin:20px auto 32px;}
  .cta{display:inline-block;background:var(--ink);color:#fff;padding:15px 34px;border-radius:6px;text-decoration:none;font-weight:600;letter-spacing:.02em;}
  .gold{color:var(--gold);}
  section{padding:70px 7vw;}
  .about{max-width:760px;margin:0 auto;text-align:center;}
  .about h2,.services h2{font-family:'Cormorant Garamond',serif;font-size:2.2rem;margin-bottom:18px;text-align:center;}
  .about p{color:var(--muted);font-size:1.1rem;}
  .grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:22px;margin-top:36px;max-width:1000px;margin-left:auto;margin-right:auto;}
  .svc{background:var(--card);border:1px solid #eee;border-radius:12px;padding:28px;box-shadow:0 14px 40px -24px rgba(0,0,0,.3);}
  .svc h3{font-size:1.2rem;margin-bottom:10px;}
  .svc p{color:var(--muted);font-size:.98rem;}
  .contact{background:var(--ink);color:#fff;text-align:center;}
  .contact h2{color:#fff;}.contact p{color:#c7cad8;margin:14px 0 26px;}
  .contact .cta{background:var(--gold);color:var(--ink);}
  footer{text-align:center;padding:30px;color:var(--muted);font-size:.85rem;}
  .badge{display:inline-block;background:rgba(200,162,74,.15);color:#8a6e2a;font-size:.78rem;font-weight:600;padding:5px 12px;border-radius:999px;margin-bottom:18px;letter-spacing:.04em;}
</style>
</head>
<body>
  <nav class="nav">
    <div class="logo">${esc(profile.businessName)}</div>
    <div><a href="#about">About</a><a href="#services">Services</a><a href="#contact">Contact</a></div>
  </nav>

  <header class="hero">
    <span class="badge">${esc(capitalize(profile.category))}${profile.city ? ' · ' + esc(profile.city) : ''}</span>
    <h1>${esc(content.tagline)}</h1>
    <p>${esc(content.about)}</p>
    <a class="cta" href="#contact">Get in touch</a>
  </header>

  <section id="about" class="about">
    <h2>Welcome</h2>
    <p>${esc(content.about)}</p>
  </section>

  <section id="services" class="services">
    <h2>What we <span class="gold">offer</span></h2>
    <div class="grid">
${serviceCards}
    </div>
  </section>

  <section id="contact" class="contact">
    <h2>Visit ${esc(profile.businessName)}</h2>
    <p>${profile.city ? 'Proudly serving ' + esc(profile.city) + '.' : 'We would love to hear from you.'} Get in touch today.</p>
    <a class="cta" href="#">Contact us</a>
  </section>

  <footer>© ${year} ${esc(profile.businessName)}. Demo landing page generated by AI Outreach Automation.</footer>
</body>
</html>`;
}
