const $ = (id) => document.getElementById(id);
const els = {
  form: $('gen-form'), btn: $('gen-btn'), spinner: document.querySelector('.spinner'),
  btnLabel: document.querySelector('.btn-label'), output: $('output'), error: $('error'),
  msgText: $('msg-text'), copyBtn: $('copy-btn'), preview: $('preview'), openTab: $('open-tab'),
  mode: $('mode'), tabs: document.querySelector('.tabs'),
};

let outreach = null;
let activeTab = 'email';

async function checkMode() {
  try {
    const data = await (await fetch('/api/health')).json();
    els.mode.textContent = data.llm === 'enabled'
      ? '✨ AI generation enabled (Gemini) - content is tailored per business.'
      : 'Running in template mode. Add GEMINI_API_KEY for fully AI-tailored copy.';
  } catch { /* ignore */ }
}

function setLoading(v) {
  els.btn.disabled = v; els.spinner.hidden = !v;
  els.btnLabel.textContent = v ? 'Generating…' : 'Generate pitch + landing page';
}

function showTab(tab) {
  activeTab = tab;
  els.tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === tab));
  els.msgText.textContent = outreach ? outreach[tab] : '';
}

els.form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    businessName: $('businessName').value.trim(),
    category: $('category').value.trim(),
    city: $('city').value.trim(),
    tone: $('tone').value,
    senderName: $('senderName').value.trim(),
    offer: $('offer').value.trim(),
  };
  if (!payload.businessName) return;

  setLoading(true);
  els.error.hidden = true;
  try {
    const res = await fetch('/api/generate', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');
    outreach = data.outreach;
    showTab('email');
    // Cache-bust the preview iframe so it shows the latest generation.
    const bust = `?t=${encodeURIComponent(data.profile.businessName)}-${Math.floor(performance.now())}`;
    els.preview.src = `/preview${bust}`;
    els.openTab.href = `/preview${bust}`;
    els.output.hidden = false;
    els.output.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    els.error.textContent = `⚠️ ${err.message}`;
    els.error.hidden = false;
  } finally {
    setLoading(false);
  }
});

els.tabs.addEventListener('click', (e) => {
  const tab = e.target.closest('.tab');
  if (tab) showTab(tab.dataset.tab);
});

els.copyBtn.addEventListener('click', async () => {
  if (!outreach) return;
  try {
    await navigator.clipboard.writeText(outreach[activeTab]);
    els.copyBtn.textContent = 'Copied ✓';
    setTimeout(() => (els.copyBtn.textContent = 'Copy'), 1500);
  } catch {
    els.copyBtn.textContent = 'Press Ctrl+C';
  }
});

checkMode();
