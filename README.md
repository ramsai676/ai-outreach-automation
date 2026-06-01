# PitchCraft

A tool that takes a prospect's business details and produces a complete outreach package: a tailored cold-outreach message for email, WhatsApp, and SMS, plus a custom one-page landing-page mockup you can show them. It pairs naturally with a lead-generation tool, turning a discovered business into something you can pitch in one step.

![node](https://img.shields.io/badge/node-%3E%3D18-informational)
![license](https://img.shields.io/badge/license-MIT-blue)
![tests](https://img.shields.io/badge/tests-8%20passing-success)

## Overview

PitchCraft demonstrates chaining a content generator into a structured workflow with reliable output, rather than free-form chat. From a single input it produces three channel-specific messages and a full landing page.

The generator returns structured data, and the landing page is rendered from a fixed, tested HTML template. This keeps the markup valid, escaped, and consistent regardless of the generated wording. It uses the Gemini API when configured and falls back to a deterministic, category-aware template when no key is present, so it always produces output.

## Screenshots

| Enter prospect details | Generated pitch and landing page |
| :---: | :---: |
| ![Home screen](docs/01-home.png) | ![Outreach messages and landing-page preview](docs/02-result.png) |

## Getting started

```bash
git clone https://github.com/ramsai676/ai-outreach-automation.git
cd ai-outreach-automation
npm install
npm start
# open http://localhost:3004
```

Enter a business name, category, city, and tone, then generate. You get email, WhatsApp, and SMS drafts with copy buttons, and a live landing-page preview. To enable fully tailored copy, copy `.env.example` to `.env` and add a `GEMINI_API_KEY`.

Run the tests:

```bash
npm test
```

## API

| Endpoint | Body or params | Returns |
| --- | --- | --- |
| `POST /api/generate` | `{ businessName, category, city, tone, senderName, offer }` | tagline, about, services, and the three outreach messages |
| `GET /preview` | | The most recently generated landing page as HTML |
| `POST /api/landing-page` | profile | Landing-page HTML directly |
| `GET /api/health` | | Service status |

Tones: friendly, professional, bold.

## How it works

```
business profile
   -> generate structured content { tagline, about, services, outreach }
        (validated; deterministic template fallback)
   -> outreach messages shown in the UI (email / whatsapp / sms tabs)
   -> render landing page from a fixed HTML template -> /preview
```

Generating structured content and rendering through a fixed template, rather than asking the model for raw HTML, is the key reliability decision. See `src/generator.js`.

## Tech stack

- Node.js and Express
- Server-side HTML templating for the landing page (escaped and self-contained)
- Vanilla front end with channel tabs, copy-to-clipboard, and a live iframe preview
- Built-in `node:test` for normalisation, fallback content, escaping, and JSON parsing
- Optional Gemini API integration with a deterministic fallback

## Responsible use

Generated outreach is a first draft. Review and personalise it before sending, and follow anti-spam and consent rules for your region. Do not send unsolicited bulk messages.

## License

MIT. See [LICENSE](LICENSE).
