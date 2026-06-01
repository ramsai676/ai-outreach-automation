import 'dotenv/config';
import express from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { generateContent, renderLandingPage, normaliseProfile, llmAvailable } from './src/generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3004;

// Cache the most recent generation so /preview can render its landing page.
let lastGeneration = null;

app.use(express.json({ limit: '64kb' }));
app.use(express.static(join(__dirname, 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', llm: llmAvailable() ? 'enabled' : 'fallback' });
});

// Generate outreach messages + landing-page content for a business.
app.post('/api/generate', async (req, res) => {
  const { businessName } = req.body || {};
  if (!businessName || !businessName.trim()) {
    return res.status(400).json({ error: 'Please provide at least a "businessName".' });
  }
  try {
    const { profile, content } = await generateContent(req.body);
    const landingPageHtml = renderLandingPage(profile, content);
    lastGeneration = { profile, content, landingPageHtml };
    res.json({
      profile,
      tagline: content.tagline,
      about: content.about,
      services: content.services,
      outreach: content.outreach,
      source: content.source,
      model: content.model || null,
      previewUrl: '/preview',
    });
  } catch (err) {
    console.error('generate error:', err);
    res.status(500).json({ error: 'Failed to generate content.' });
  }
});

// Render the most recently generated landing page (used by the preview iframe
// and the "open in new tab" button).
app.get('/preview', (_req, res) => {
  if (!lastGeneration) {
    return res
      .status(404)
      .type('html')
      .send('<p style="font-family:sans-serif;padding:40px">No landing page generated yet. Generate one first.</p>');
  }
  res.type('html').send(lastGeneration.landingPageHtml);
});

// Direct render without caching (POST a profile, get HTML back).
app.post('/api/landing-page', async (req, res) => {
  const profile = normaliseProfile(req.body);
  const { content } = await generateContent(req.body);
  res.type('html').send(renderLandingPage(profile, content));
});

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, () => {
    console.log(`\n  ✉️  AI Outreach Automation on http://localhost:${PORT}`);
    console.log(`      Generation: ${llmAvailable() ? 'ENABLED (Gemini)' : 'fallback/template mode'}\n`);
  });
}

export default app;
