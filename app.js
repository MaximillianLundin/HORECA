// ==========================================
// Café Station Support — data-driven engine
// Loads knowledge from Supabase Storage (with local + cache fallback)
// ==========================================

// ---- Config ----
const SUPABASE_URL = 'https://ghudwqytclfpiouzqzvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodWR3cXl0Y2xmcGlvdXpxenZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTk0MTIsImV4cCI6MjA5MDA5NTQxMn0.DoDwit2k5NRkt6x5EynQg3RJ5CrlqaTH5U6Ufgf-MoY';
const KB_REMOTE_BASE = SUPABASE_URL + '/storage/v1/object/public/cafe-station-knowledge';
const KB_LOCAL_BASE = 'data';
const REPORT_EMAIL = 'maximillian.lundin@bluewatergroup.com';

// ---- Supabase client (session logging only) ----
let db;
try {
  const { createClient } = window.supabase || {};
  if (createClient) db = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) { console.warn('Supabase could not be initialized:', e); }

// ---- State ----
window.currentLang = localStorage.getItem('cafestation_lang') || 'sv';
let KB = null;                       // knowledge base for current language
let currentProduct = null;
let currentPurifier = null;          // 'spirit' | 'pro' | 'cleone' | 'other' | null
let history = [];                    // stack of targets: 'product' | 'purifier' | 'start' | 'describe' | 'step:x' | 'solution:y' | 'end:z'

// Options that only apply when a Bluewater Spirit purifier is connected (hidden for Other brand)
const SPIRIT_ONLY_NEXTS = new Set([]);

// For Other brand: reroute these destinations to a simpler alternative
const OTHER_REROUTE = { 'solution:spirit_blink': 'solution:purifier_lights_off' };

let session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

// ==========================================
// KNOWLEDGE LOADING
// ==========================================
async function loadKB(lang) {
  const cacheKey = 'cafestation_kb_' + lang;
  // Dev override: ?src=local loads the bundled data/ files first and skips cache.
  const preferLocal = new URLSearchParams(location.search).get('src') === 'local';
  let cached = null;
  if (!preferLocal) { try { cached = JSON.parse(localStorage.getItem(cacheKey)); } catch (e) {} }

  const remote = KB_REMOTE_BASE + '/cafe-station.' + lang + '.json';
  const local = KB_LOCAL_BASE + '/cafe-station.' + lang + '.json';
  const sources = preferLocal ? [local, remote] : [remote, local];
  for (const url of sources) {
    try {
      const res = await fetch(url, { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        if (data && data.schema_version) {
          if (!preferLocal) localStorage.setItem(cacheKey, JSON.stringify(data));
          return data;
        }
      }
    } catch (e) { /* try next source */ }
  }
  if (cached) return cached;            // last resort: stale cache
  return null;
}

// Purifier name helpers — used to substitute "Bluewater Spirit" in KB text at render time
function purifierName() {
  if (!currentPurifier || currentPurifier === 'spirit') return 'Bluewater Spirit';
  if (currentPurifier === 'pro') return 'Bluewater PRO';
  if (currentPurifier === 'cleone') return 'Bluewater Cleone';
  return 'purifier';
}
function purifierShort() {
  if (!currentPurifier || currentPurifier === 'spirit') return 'Spirit';
  if (currentPurifier === 'pro') return 'PRO';
  if (currentPurifier === 'cleone') return 'Cleone';
  return 'purifier';
}
function subP(text) {
  if (!text) return text;
  const name = purifierName();
  const short = purifierShort();
  const isOther = currentPurifier === 'other';
  return text
    .replace(/\bthe Bluewater Spirit\b/g,    isOther ? 'the purifier'       : 'the ' + name)
    .replace(/\bBluewater Spirit\b/g,         name)
    .replace(/\bthe Spirit's\b/g,             isOther ? "the purifier's"    : 'the ' + short + "'s")
    .replace(/\bSpirit's\b/g,                 isOther ? "the purifier's"    : short + "'s")
    .replace(/\bthe Spirit\b/g,               isOther ? 'the purifier'      : 'the ' + short)
    .replace(/\bSpirit\b/g,                   short)
    .replace(/\bthe purifier \(purifier\)/g,  'the purifier');
}

// UI string lookup: KB first, then legacy translations.js t(), then raw key
function ui(key) {
  if (KB && KB.ui_strings && KB.ui_strings[key] != null) return KB.ui_strings[key];
  if (typeof t === 'function') { const v = t(key); if (v != null) return v; }
  return key;
}

function pickerStrings() {
  const m = {
    sv: {
      // mode picker
      mode_h: 'Hur kan vi hjälpa dig?', mode_sub: 'Välj ett alternativ för att fortsätta',
      mode_install: 'Installation', mode_install_sub: 'Se installationsvideor',
      mode_support: 'Support', mode_support_sub: 'Felsök ditt system',
      // product picker (support)
      h: 'Vilken produkt behöver du hjälp med?', sub: 'Välj produkt för att fortsätta',
      cafe: 'Tryck för att börja', spirit: 'Tryck för att börja',
      // purifier picker
      purifier_h: 'Vilken reningsstation används med Café Station?', purifier_sub: 'Välj din reningsstation för att fortsätta',
      purifier_pro: 'Bluewater PRO', purifier_spirit: 'Bluewater Spirit', purifier_cleone: 'Bluewater Cleone',
      purifier_other: 'Annat märke', purifier_unknown: 'Vet ej',
      // installation picker
      install_h: 'Vilken produkt installerar du?', install_sub: 'Välj produkt för att se installationsvideo',
      soon: 'Kommer snart',
    },
    en: {
      // mode picker
      mode_h: 'What can we help you with?', mode_sub: 'Choose an option to continue',
      mode_install: 'Installation', mode_install_sub: 'Watch installation videos',
      mode_support: 'Support', mode_support_sub: 'Troubleshoot your system',
      // product picker (support)
      h: 'Which product do you need help with?', sub: 'Choose a product to continue',
      cafe: 'Tap to start', spirit: 'Tap to start',
      // purifier picker
      purifier_h: 'Which purifier are you using with the Café Station?', purifier_sub: 'Select your purifier to continue',
      purifier_pro: 'Bluewater PRO', purifier_spirit: 'Bluewater Spirit', purifier_cleone: 'Bluewater Cleone',
      purifier_other: 'Other brand', purifier_unknown: "Don't know",
      // installation picker
      install_h: 'Which product are you installing?', install_sub: 'Choose a product to watch the installation video',
      soon: 'Coming soon',
    },
  };
  return m[window.currentLang] || m.en;
}
function sevLabel() { return window.currentLang === 'sv' ? 'Säkerhet' : 'Safety'; }

// ==========================================
// SESSION LOGGING (behavior unchanged)
// ==========================================
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => endSession(false, true), INACTIVITY_TIMEOUT);
}
function recordStep(question, answer) {
  session.steps.push({ question, answer, timestamp: new Date().toISOString(), historySnapshot: [...history], purifierSnapshot: currentPurifier });
  resetInactivityTimer();
}

function jumpToStep(i) {
  const step = session.steps[i];
  if (!step) return;
  history = [...step.historySnapshot];
  currentPurifier = step.purifierSnapshot;
  session.steps = session.steps.slice(0, i);
  renderTarget(history[history.length - 1]);
}

function renderTrail() {
  const el = document.getElementById('trail');
  if (!el) return;
  if (!session.steps.length) { el.innerHTML = ''; return; }
  const isSv = window.currentLang === 'sv';
  const hint = isSv ? '↩ Ändra val' : '↩ Change choice';
  const arrowSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M12 5v14"/><path d="M5 12l7 7 7-7"/></svg>';
  el.innerHTML = session.steps.map((s, i) => {
    const isLast = i === session.steps.length - 1;
    return `<div class="trail-item" data-step="${i}">
      <span class="trail-q">${esc(s.question)}</span>
      <span class="trail-a">${esc(s.answer)}</span>
      <span class="trail-hint">${hint}</span>
    </div>${!isLast ? `<div class="trail-arrow">${arrowSvg}</div>` : ''}`;
  }).join('');
  el.querySelectorAll('.trail-item').forEach(item => {
    item.onclick = () => jumpToStep(+item.dataset.step);
  });
}
async function createSession() {
  if (!db) return;
  try {
    const { data } = await db.from('support_sessions').insert({ product: 'cafe_station', steps: [], user_agent: navigator.userAgent }).select().single();
    if (data) session.id = data.id;
  } catch (e) { console.warn('Could not create session:', e); }
}
async function endSession(resolved, timedOut) {
  clearTimeout(inactivityTimer);
  const duration = Math.round((Date.now() - session.startTime) / 1000);
  const lastStep = session.steps[session.steps.length - 1];
  if (db && session.id) {
    try {
      await db.from('support_sessions').update({
        steps: session.steps, resolved, final_solution: lastStep ? lastStep.question : null,
        session_duration_seconds: duration, inactive_timeout: timedOut || false,
      }).eq('id', session.id);
    } catch (e) { console.warn('Could not update session:', e); }
  }
  if (resolved !== undefined) sendEmailReport(resolved, timedOut, duration);
}
function sendEmailReport(resolved, timedOut, duration) {
  const stepsText = session.steps.map((s, i) => `${i + 1}. ${s.question} → ${s.answer}`).join('\n');
  console.log('Session report:', { resolved, timedOut, duration, steps: stepsText });
}

// ==========================================
// UI HELPERS
// ==========================================
const cardEl = () => document.getElementById('card');
function setProgress(p) { const f = document.getElementById('progressFill'); if (f) f.style.width = p + '%'; }
function showProgressBar(show) { const b = document.querySelector('.progress-bar'); if (b) b.style.visibility = show ? 'visible' : 'hidden'; }
function animateCard() { const c = cardEl(); if (!c) return; c.style.animation = 'none'; c.offsetHeight; c.style.animation = 'fadeIn 0.3s ease'; }
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
function btnClass(type) { return type === 'dont_know' ? 'btn-dont-know' : type === 'secondary' ? 'btn-secondary' : type === 'restart' ? 'btn-restart' : 'btn-primary'; }

function imageHtml(src, alt) {
  if (!src) return '';
  return `<div class="media-img"><img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy"></div>`;
}
function audioHtml(src, label) {
  if (!src) return '';
  return `<div class="media-audio">${label ? `<span class="media-audio-label">${esc(label)}</span>` : ''}<audio controls preload="none" src="${esc(src)}"></audio></div>`;
}
function videoEmbed(v) {
  if (!v || !v.vimeo_id) return '';
  const show = v.showcase || (KB && KB.product && KB.product.video_showcase) || '';
  const src = show
    ? `https://vimeo.com/showcase/${show}/embed2?video=${v.vimeo_id}&autoplay=0`
    : `https://player.vimeo.com/video/${v.vimeo_id}`;
  return `<div class="video-wrapper"><div class="video-container"><iframe src="${src}" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" frameborder="0" allowfullscreen></iframe></div></div>`;
}
function safetyHtml(text) {
  return `<div class="safety-warn">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
    <span>${esc(text)}</span></div>`;
}
function aboutPageHtml() {
  const e = (KB && KB.escalation) || {};
  return `<div class="about-block">
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="18" height="18"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
    <div><strong>${esc(ui('about_page_label'))}</strong>${e.about_page_hint ? `<p>${esc(e.about_page_hint)}</p>` : ''}</div>
  </div>`;
}
function backBtnHtml() { return history.length > 1 ? `<button class="btn-back" id="backBtn" aria-label="Back">&larr;</button>` : ''; }
function bindBack() { const b = document.getElementById('backBtn'); if (b) b.onclick = goBack; }

function progressFor(isSolution) {
  if (isSolution) return 80;
  return Math.min(15 + history.length * 10, 65);
}

// ==========================================
// NAVIGATION
// ==========================================
function navTo(target, record) {
  if (record) recordStep(record.question, record.answer);
  history.push(target);
  renderTarget(target);
}
function goBack() {
  if (history.length > 1) {
    history.pop();
    renderTarget(history[history.length - 1]);
  } else {
    showProductPicker();
  }
}
function renderTarget(target) {
  renderTrail();
  if (target === 'mode') return renderModePicker();
  if (target === 'install') return renderInstallationPicker();
  if (target === 'install:cafe_station') return renderInstallationVideo();
  if (target === 'product') return renderProductPicker();
  if (target === 'purifier') return renderPurifierPicker();
  if (target === 'start') return renderStartScreen();
  if (target === 'describe') return renderDescribe();
  const [kind, id] = target.split(':');
  if (kind === 'step') return renderQuestion(id);
  if (kind === 'solution') return renderSolution(id);
  if (kind === 'end') return id === 'resolved' ? renderResolved() : renderNotResolved();
  return renderNotResolved();
}

function showModePicker() { currentPurifier = null; history = ['mode']; renderTrail(); renderModePicker(); }
function showProductPicker() { currentPurifier = null; history = ['mode', 'product']; renderProductPicker(); }
function showStart() { history = ['mode', 'product']; navTo('start'); }
function restart() {
  session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
  createSession();
  showModePicker();
}

// ==========================================
// SCREENS
// ==========================================
function renderModePicker() {
  showProgressBar(false);
  setProgress(0);
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    <h2 class="picker-h">${esc(L.mode_h)}</h2>
    <p class="picker-sub">${esc(L.mode_sub)}</p>
    <div class="prod-grid">
      <button class="prod" id="modeInstall">
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
        <span class="prod-name">${esc(L.mode_install)}</span>
        <span class="prod-tag">${esc(L.mode_install_sub)}</span>
      </button>
      <button class="prod" id="modeSupport">
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></div>
        <span class="prod-name">${esc(L.mode_support)}</span>
        <span class="prod-tag">${esc(L.mode_support_sub)}</span>
      </button>
    </div>`;
  document.getElementById('modeInstall').onclick = () => navTo('install');
  document.getElementById('modeSupport').onclick = () => navTo('product');
}

function renderInstallationPicker() {
  showProgressBar(false);
  setProgress(0);
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2 class="picker-h">${esc(L.install_h)}</h2>
    <p class="picker-sub">${esc(L.install_sub)}</p>
    <div class="prod-grid">
      <button class="prod" id="installCafe">
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></div>
        <span class="prod-name">Café Station</span>
        <span class="prod-tag">${esc(L.mode_install_sub)}</span>
      </button>
      <button class="prod disabled" disabled aria-disabled="true">
        <span class="soon">${esc(L.soon)}</span>
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11h16"/><path d="M6 11V7a6 6 0 0 1 12 0v4"/><path d="M5 11l1.5 8a2 2 0 0 0 2 1.7h7a2 2 0 0 0 2-1.7L20 11"/></svg></div>
        <span class="prod-name">Brew Station</span>
        <span class="prod-tag">${esc(L.soon)}</span>
      </button>
      <button class="prod disabled" disabled aria-disabled="true">
        <span class="soon">${esc(L.soon)}</span>
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg></div>
        <span class="prod-name">Bluewater PRO</span>
        <span class="prod-tag">${esc(L.soon)}</span>
      </button>
      <button class="prod disabled" disabled aria-disabled="true">
        <span class="soon">${esc(L.soon)}</span>
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>
        <span class="prod-name">Bluewater Spirit</span>
        <span class="prod-tag">${esc(L.soon)}</span>
      </button>
    </div>`;
  bindBack();
  document.getElementById('installCafe').onclick = () => navTo('install:cafe_station');
}

function renderInstallationVideo() {
  showProgressBar(true);
  setProgress(50);
  animateCard();
  const showcase = KB && KB.product && KB.product.video_showcase ? KB.product.video_showcase : '12116945';
  const src = `https://vimeo.com/showcase/${showcase}/embed2?video=1162167317&autoplay=0`;
  const sv = window.currentLang === 'sv';
  // Installation chapters (showcase clips). Labels inferred — confirm against official Vimeo titles.
  const chapters = [
    { id: '1162167921', label: sv ? 'Ström och anslutningar' : 'Power & connections' },
    { id: '1162167633', label: sv ? 'Boosterpump' : 'Booster pump' },
    { id: '1162167601', label: sv ? 'Flottörbrytare' : 'Float switch' },
    { id: '1162167862', label: sv ? 'Flottörbrytare (forts.)' : 'Float switches' },
    { id: '1162167734', label: sv ? 'Lägen på kontrollboxen' : 'Control box modes' },
    { id: '1162167532', label: sv ? 'Boosterpump till kaffemaskin' : 'Booster pump to coffee machine' },
    { id: '1162167682', label: sv ? 'Rensa mineralslangen' : 'Clear the mineral tube' },
    { id: '1162167569', label: sv ? 'Mineralslang' : 'Mineral tube' },
    { id: '1162167800', label: sv ? 'Doseringspump' : 'Dosing pump' },
    { id: '1162167889', label: sv ? 'TDS för lågt' : 'TDS too low' },
  ];
  const chaptersHtml = chapters.map(c => `
    <div class="install-chapter">
      <h3 class="install-chapter-title">${esc(c.label)}</h3>
      <div class="video-wrapper"><div class="video-container"><iframe src="https://vimeo.com/showcase/${showcase}/embed2?video=${c.id}&autoplay=0" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" frameborder="0" allowfullscreen></iframe></div></div>
    </div>`).join('');
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>Café Station Installation</h2>
    <p>${sv ? 'Se hela installationsvideon nedan.' : 'Watch the full installation video below.'}</p>
    <div class="video-wrapper"><div class="video-container"><iframe src="${src}" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" frameborder="0" allowfullscreen></iframe></div></div>
    <h3 class="install-chapters-h">${sv ? 'Kapitel' : 'Chapters'}</h3>
    ${chaptersHtml}
    <button class="btn btn-restart" id="installDoneBtn">${sv ? 'Tillbaka till start' : 'Back to start'}</button>`;
  bindBack();
  document.getElementById('installDoneBtn').onclick = restart;
}

function renderProductPicker() {
  showProgressBar(false);
  setProgress(0);
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    <h2 class="picker-h">${esc(L.h)}</h2>
    <p class="picker-sub">${esc(L.sub)}</p>
    <div class="prod-grid">
      <button class="prod" id="prodCafe">
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg></div>
        <span class="prod-name">Café Station</span>
        <span class="prod-tag">${esc(L.cafe)}</span>
      </button>
      <button class="prod disabled" disabled aria-disabled="true">
        <span class="soon">${esc(L.soon)}</span>
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/></svg></div>
        <span class="prod-name">Bluewater Spirit</span>
        <span class="prod-tag">${esc(L.soon)}</span>
      </button>
      <button class="prod disabled" disabled aria-disabled="true">
        <span class="soon">${esc(L.soon)}</span>
        <div class="prod-ic"><svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 11h16"/><path d="M6 11V7a6 6 0 0 1 12 0v4"/><path d="M5 11l1.5 8a2 2 0 0 0 2 1.7h7a2 2 0 0 0 2-1.7L20 11"/></svg></div>
        <span class="prod-name">Brew Station</span>
        <span class="prod-tag">${esc(L.soon)}</span>
      </button>
    </div>`;
  document.getElementById('prodCafe').onclick = () => { currentProduct = 'cafe_station'; currentPurifier = null; navTo('purifier'); };
}

function renderPurifierPicker() {
  showProgressBar(true);
  setProgress(5);
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(L.purifier_h)}</h2>
    <p class="picker-sub">${esc(L.purifier_sub)}</p>
    <div class="options">
      <button class="btn btn-primary" id="purSpirit">${esc(L.purifier_spirit)}</button>
      <button class="btn btn-secondary" id="purOther">${esc(L.purifier_other)}</button>
    </div>`;
  bindBack();
  const pick = (purifier, label) => { currentPurifier = purifier; recordStep(L.purifier_h, label); navTo('start'); };
  document.getElementById('purSpirit').onclick = () => pick('spirit', L.purifier_spirit);
  document.getElementById('purOther').onclick = () => pick('other', L.purifier_other);
}

function renderStartScreen() {
  showProgressBar(true);
  setProgress(8);
  animateCard();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(ui('start_title'))}</h2>
    <div class="start-grid">
      <button class="start-card" id="startDescribe">
        <div class="start-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/></svg></div>
        <span class="start-card-title">${esc(ui('start_describe'))}</span>
        <span class="start-card-sub">${esc(ui('start_describe_sub'))}</span>
      </button>
      <button class="start-card" id="startTroubleshoot">
        <div class="start-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg></div>
        <span class="start-card-title">${esc(ui('start_troubleshoot'))}</span>
        <span class="start-card-sub">${esc(ui('start_troubleshoot_sub'))}</span>
      </button>
    </div>`;
  bindBack();
  document.getElementById('startDescribe').onclick = () => { recordStep(ui('start_title'), ui('start_describe')); navTo('describe'); };
  document.getElementById('startTroubleshoot').onclick = () => { recordStep(ui('start_title'), ui('start_troubleshoot')); navTo('step:welcome'); };
}

function renderDescribe() {
  showProgressBar(true);
  setProgress(12);
  animateCard();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(ui('describe_title'))}</h2>
    <textarea class="describe-input" id="describeInput" placeholder="${esc(ui('describe_placeholder'))}" rows="4"></textarea>
    <p class="describe-hint">${esc(ui('describe_hint'))}</p>
    <button class="btn btn-primary" id="describeSubmit">${esc(ui('describe_submit'))}</button>`;
  bindBack();
  const input = document.getElementById('describeInput');
  const submit = document.getElementById('describeSubmit');
  input.focus();
  submit.onclick = () => {
    const text = input.value.trim();
    if (!text) return;
    recordStep(ui('describe_title'), text);
    submit.textContent = ui('describe_analyzing');
    submit.disabled = true;
    setTimeout(() => routeFromDescription(text), 400);
  };
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit.click(); } });
}

function routeFromDescription(text) {
  const lower = text.toLowerCase();
  for (const iss of (KB.issues || [])) {
    const kws = iss.routing_keywords || [];
    if (kws.length) {
      try { if (new RegExp(kws.join('|'), 'i').test(lower)) return navTo('step:' + iss.start_step, { question: ui('describe_title'), answer: iss.title }); }
      catch (e) {}
    }
  }
  navTo('step:welcome');
}

function renderQuestion(id) {
  const node = KB.diagnostic_steps[id];
  if (!node) return renderNotResolved();
  showProgressBar(true);
  setProgress(progressFor(false));
  animateCard();
  const options = node.options
    .filter(o => !(currentPurifier === 'other' && SPIRIT_ONLY_NEXTS.has(o.next)))
    .map(o => (currentPurifier === 'other' && OTHER_REROUTE[o.next])
      ? { ...o, next: OTHER_REROUTE[o.next] } : o);
  let html = backBtnHtml();
  html += `<h2>${esc(subP(node.question))}</h2>`;
  if (node.safety_warning && node.safety_warning.text) html += safetyHtml(subP(node.safety_warning.text));
  if (node.help_text) html += `<p>${nl2br(subP(node.help_text))}</p>`;
  if (node.image) html += imageHtml(node.image, node.image_alt);
  html += '<div class="options">';
  options.forEach((o, i) => { html += `<button class="btn ${btnClass(o.type)}" data-i="${i}">${esc(subP(o.label))}</button>`; });
  html += '</div>';
  cardEl().innerHTML = html;
  bindBack();
  cardEl().querySelectorAll('button[data-i]').forEach((btn) => {
    const o = options[+btn.dataset.i];
    btn.onclick = () => navTo(o.next, { question: node.question, answer: o.label });
  });
}

function renderSolution(id) {
  let s = KB.solutions[id];
  if (!s) return renderNotResolved();
  // For Other brand: replace the RO-membrane step in tasteBad_sol_high with a purifier-supplier redirect
  if (currentPurifier === 'other' && id === 'tasteBad_sol_high') {
    s = { ...s, steps: s.steps.map(st => st.number === 3 ? { ...st, text: 'Measure TDS directly from the purifier output (before mineral dosing). If it reads above 10 ppm, the filter in the purifier may need attention — contact the purifier supplier.' } : st) };
  }
  showProgressBar(true);
  setProgress(progressFor(true));
  animateCard();
  let html = backBtnHtml();

  // meta chips
  let chips = '';
  if (s.fix_type === 'quick') chips += `<span class="chip chip-quick">${esc(ui('fix_type_quick'))}</span>`;
  if (s.fix_type === 'long_term') chips += `<span class="chip chip-long">${esc(ui('fix_type_long'))}</span>`;
  if (s.estimated_time_minutes) chips += `<span class="chip chip-time">⏱ ${esc(ui('est_time_label') || '~')} ${s.estimated_time_minutes} min</span>`;
  if (s.severity === 'high') chips += `<span class="chip chip-sev-high">${esc(sevLabel())}</span>`;
  if (s.tools_needed && s.tools_needed.length) chips += `<span class="chip chip-tools">${esc((ui('tools_needed_label') || '') + ': ' + s.tools_needed.join(', '))}</span>`;
  if (s._placeholder) chips += `<span class="chip chip-draft">${esc(ui('placeholder_label'))}</span>`;
  if (chips) html += `<div class="sol-meta">${chips}</div>`;

  html += `<h2>${esc(subP(s.title))}</h2>`;
  if (s.intro) html += `<p class="sol-intro">${nl2br(subP(s.intro))}</p>`;
  if (s.safety_warning && s.safety_warning.text) html += safetyHtml(subP(s.safety_warning.text));
  if (s.about_page_required) html += aboutPageHtml();

  if (s.steps && s.steps.length) {
    html += '<div class="sol-steps">';
    s.steps.forEach((st) => {
      html += `<div class="sol-step"><div class="sol-step-num">${st.number}</div><div class="sol-step-body"><div class="sol-step-text">${nl2br(subP(st.text))}</div>`;
      html += imageHtml(st.image, st.image_alt);
      html += imageHtml(st.gif, st.image_alt);
      html += audioHtml(st.audio, st.audio_label);
      if (st.badge && st.badge.text) html += `<span class="step-badge">${esc(st.badge.text)}</span>`;
      html += `</div></div>`;
    });
    html += '</div>';
  }
  if (s.note) html += `<div class="sol-note">${nl2br(subP(s.note))}</div>`;

  (s.videos || []).forEach((v) => { html += videoEmbed(v); });
  (s.documents || []).forEach((d) => { html += `<a href="${esc(d.url)}" target="_blank" class="btn btn-doc">${esc(d.label)}</a>`; });

  if (s.photo_gallery && s.photo_gallery.length) {
    html += '<div class="photo-gallery">';
    s.photo_gallery.forEach((p) => { html += `<figure>${imageHtml(p.url, p.caption)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`; });
    html += '</div>';
  }

  if (s.options) {
    if (s.after_text) html += `<p class="afterq">${esc(s.after_text)}</p>`;
    html += '<div class="options">';
    s.options.forEach((o, i) => { html += `<button class="btn ${btnClass(o.type)}" data-i="${i}">${esc(o.label)}</button>`; });
    html += '</div>';
  } else if (s.follow_up) {
    html += '<div class="options">';
    html += `<button class="btn btn-primary" data-fu="solved">${esc(s.follow_up.solved_label)}</button>`;
    html += `<button class="btn btn-secondary" data-fu="not_solved">${esc(s.follow_up.not_solved_label)}</button>`;
    html += '</div>';
  }

  if (ui('need_help_step')) html += `<a class="help-link" id="helpLink">${esc(ui('need_help_step'))} &rarr;</a>`;

  cardEl().innerHTML = html;
  bindBack();
  cardEl().querySelectorAll('button[data-i]').forEach((btn) => {
    const o = s.options[+btn.dataset.i];
    btn.onclick = () => navTo(o.next, { question: s.title, answer: o.label });
  });
  cardEl().querySelectorAll('button[data-fu]').forEach((btn) => {
    btn.onclick = () => {
      if (btn.dataset.fu === 'solved') navTo(s.follow_up.solved_next || 'end:resolved', { question: s.title, answer: s.follow_up.solved_label });
      else navTo(s.follow_up.not_solved_next || 'end:notResolved', { question: s.title, answer: s.follow_up.not_solved_label });
    };
  });
  const help = document.getElementById('helpLink');
  if (help) help.onclick = () => navTo('end:notResolved', { question: s.title, answer: ui('need_help_step') });
}

function renderResolved() {
  showProgressBar(true);
  setProgress(100);
  endSession(true, false);
  animateCard();
  cardEl().innerHTML = `
    <div class="success-box"><h3>${esc(ui('success_title'))}</h3><p>${esc(ui('success_text'))}</p></div>
    <button class="btn btn-restart" id="restartBtn">${esc(ui('restart'))}</button>`;
  document.getElementById('restartBtn').onclick = restart;
}

function renderNotResolved() {
  showProgressBar(true);
  setProgress(100);
  endSession(false, false);
  animateCard();
  const e = (KB && KB.escalation) || {};
  const isSv = window.currentLang === 'sv';
  const phone = e.phone ? `<p><a href="tel:${esc(e.phone_tel || '')}">${esc(e.phone)}</a></p>` : '';
  const hasBypass = KB && KB.solutions && KB.solutions.bypass;
  const mailSubject = ui('mail_subject_value') || e.subject_hint || '';

  // Build email body with steps + instructional comment
  const stepsText = session.steps.map((s, i) => `${i + 1}. ${s.question} → ${s.answer}`).join('\n');
  const attachLines = Array.isArray(e.attachments) ? e.attachments.map(a => `• ${a}`).join('\n') : (ui('contact_attach_hint') || '');
  const comment = isSv
    ? '// Det verkar som att du har problem med nedanstående funktioner.\n// Om det stämmer, lägg till kontext eller detaljer och skicka mailet.\n// Om det inte stämmer, ta bort det och skriv din egen beskrivning.'
    : '// It seems like you have issues with the below related functions.\n// If yes, add context or specifics and send the mail.\n// If it doesn\'t match your issue, delete it and write your own description.';
  const diagLabel = isSv ? 'Diagnostikväg' : 'Diagnostic path';
  const attachLabel = isSv ? 'Bifoga' : 'Please attach';
  const mailBody = [
    comment,
    '',
    stepsText ? `${diagLabel}:\n${stepsText}` : '',
    '',
    attachLines ? `${attachLabel}:\n${attachLines}` : ''
  ].join('\n').replace(/\n{3,}/g, '\n\n').trim();

  const mailHref = `mailto:${e.email || ''}?subject=${encodeURIComponent(mailSubject)}&body=${encodeURIComponent(mailBody)}`;

  // Diagnostic path shown on page
  const diagPathHtml = session.steps.length ? `
    <div class="diag-path">
      <div class="diag-path-header">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="15" height="15"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>${isSv ? 'Din diagnostikväg' : 'Your diagnostic path'}</span>
      </div>
      <ol class="diag-path-list">
        ${session.steps.map(s => `<li><span class="diag-q">${esc(s.question)}</span><span class="diag-a">${esc(s.answer)}</span></li>`).join('')}
      </ol>
    </div>` : '';

  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(ui('not_resolved_title'))}</h2>
    ${diagPathHtml}
    ${e.about_page_hint ? aboutPageHtml() : ''}
    <div class="contact-box">
      <h3>${esc(ui('contact_support'))}</h3>
      ${e.local_support_msg ? `<p>${esc(e.local_support_msg)}</p>` : `<p>${esc(e.intro || ui('contact_text'))}</p>`}
      ${phone}
      <div class="mail-template">
        <p class="mail-row"><span class="mail-label">${esc(ui('mail_to_label'))}</span> <a href="mailto:${esc(e.email || '')}">${esc(e.email || '')}</a></p>
        <p class="mail-row"><span class="mail-label">${esc(ui('mail_subject_label'))}</span> ${esc(mailSubject)}</p>
        <p class="mail-row"><span class="mail-label">${esc(ui('mail_body_label'))}</span></p>
        <pre class="mail-body">${esc(mailBody)}</pre>
      </div>
      <a class="btn btn-mail" href="${mailHref}">${esc(ui('mail_open_btn'))}</a>
    </div>
    ${hasBypass ? `<button class="btn btn-bypass" id="bypassBtn">${esc(ui('bypass_cta'))}</button>` : ''}
    <button class="btn btn-restart" id="restartBtn">${esc(ui('restart'))}</button>`;
  bindBack();
  const bp = document.getElementById('bypassBtn');
  if (bp) bp.onclick = () => navTo('solution:bypass', { question: ui('not_resolved_title'), answer: ui('bypass_cta') });
  document.getElementById('restartBtn').onclick = restart;
}

function renderLoadError() {
  showProgressBar(false);
  const sv = window.currentLang === 'sv';
  cardEl().innerHTML = `
    <h2>${sv ? 'Kunde inte ladda innehållet' : 'Could not load content'}</h2>
    <p>${sv ? 'Kontrollera din internetanslutning och försök igen.' : 'Please check your connection and try again.'}</p>
    <button class="btn btn-primary" onclick="location.reload()">${sv ? 'Försök igen' : 'Retry'}</button>`;
}

// ==========================================
// LANGUAGE SWITCHER
// ==========================================
function initLangSwitcher() {
  const btn = document.getElementById('langBtn');
  const dropdown = document.getElementById('langDropdown');
  const search = document.getElementById('langSearch');
  const list = document.getElementById('langList');
  const label = document.getElementById('currentLangLabel');
  if (!btn) return;
  label.textContent = window.currentLang.toUpperCase();

  function renderList(filter) {
    const f = (filter || '').toLowerCase();
    list.innerHTML = '';
    LANGUAGES.filter(l => !f || l.label.toLowerCase().includes(f) || l.code.includes(f) || l.flag.toLowerCase().includes(f))
      .forEach(l => {
        const item = document.createElement('button');
        item.className = 'lang-item' + (l.code === window.currentLang ? ' active' : '');
        item.textContent = l.label;
        item.addEventListener('click', () => { switchLang(l.code, label, dropdown); });
        list.appendChild(item);
      });
  }
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) { search.value = ''; renderList(''); search.focus(); }
  });
  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => dropdown.classList.remove('open'));
  renderList('');
}

async function switchLang(code, label, dropdown) {
  window.currentLang = code;
  localStorage.setItem('cafestation_lang', code);
  if (label) label.textContent = code.toUpperCase();
  if (dropdown) dropdown.classList.remove('open');
  const next = await loadKB(code);
  if (next) KB = next;
  showModePicker();
}

// ==========================================
// INIT
// ==========================================
async function init() {
  initLangSwitcher();
  createSession();
  resetInactivityTimer();
  const c = cardEl();
  if (c) c.innerHTML = '<p style="text-align:center;color:#999;padding:1rem 0">…</p>';
  KB = await loadKB(window.currentLang);
  if (!KB) return renderLoadError();
  showModePicker();

  const logo = document.getElementById('logoHome');
  if (logo) logo.addEventListener('click', () => restart());
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
