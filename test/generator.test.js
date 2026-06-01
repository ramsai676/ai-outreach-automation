import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  normaliseProfile, fallbackContent, renderLandingPage, extractJson,
} from '../src/generator.js';

test('normaliseProfile fills sensible defaults', () => {
  const p = normaliseProfile({ businessName: '  Cafe X  ' });
  assert.equal(p.businessName, 'Cafe X');
  assert.equal(p.category, 'local business');
  assert.equal(p.tone, 'friendly');
  assert.ok(p.senderName.length > 0);
});

test('normaliseProfile rejects unknown tone', () => {
  assert.equal(normaliseProfile({ businessName: 'X', tone: 'aggressive' }).tone, 'friendly');
  assert.equal(normaliseProfile({ businessName: 'X', tone: 'bold' }).tone, 'bold');
});

test('fallbackContent produces all required pieces', () => {
  const p = normaliseProfile({ businessName: 'Bright Smile', category: 'dentist', city: 'Pune' });
  const c = fallbackContent(p);
  assert.ok(c.tagline.length > 0);
  assert.ok(c.about.includes('Bright Smile'));
  assert.equal(c.services.length, 3);
  assert.ok(c.outreach.email.includes('Subject:'));
  assert.ok(c.outreach.whatsapp.length > 0);
  assert.ok(c.outreach.sms.length > 0 && c.outreach.sms.length < 320);
  assert.equal(c.source, 'fallback');
});

test('fallbackContent picks category-specific services', () => {
  const p = normaliseProfile({ businessName: 'Glow', category: 'salon' });
  const titles = fallbackContent(p).services.map((s) => s.title.toLowerCase());
  assert.ok(titles.some((t) => t.includes('booking')));
});

test('renderLandingPage emits valid, escaped HTML', () => {
  const p = normaliseProfile({ businessName: 'Tom & "Jerry" <b>Cafe', category: 'cafe', city: 'Goa' });
  const c = fallbackContent(p);
  const html = renderLandingPage(p, c);
  assert.match(html, /^<!DOCTYPE html>/);
  assert.match(html, /<\/html>\s*$/);
  // The unsafe characters in the name must be escaped in output.
  assert.ok(html.includes('Tom &amp; &quot;Jerry&quot; &lt;b&gt;Cafe'));
  assert.ok(!html.includes('<b>Cafe'));
  // All three service cards rendered.
  assert.equal((html.match(/class="svc"/g) || []).length, 3);
});

test('extractJson parses fenced JSON', () => {
  const out = extractJson('Here you go:\n```json\n{"tagline":"Hi","ok":true}\n```\nthanks');
  assert.equal(out.tagline, 'Hi');
  assert.equal(out.ok, true);
});

test('extractJson parses bare JSON object', () => {
  const out = extractJson('prefix {"a":1,"b":[2,3]} suffix');
  assert.deepEqual(out, { a: 1, b: [2, 3] });
});

test('extractJson returns null on garbage', () => {
  assert.equal(extractJson('no json here'), null);
  assert.equal(extractJson('{broken'), null);
  assert.equal(extractJson(''), null);
});
