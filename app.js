// ==========================================
// Café Station Support — data-driven engine
// Phone-first UI with guided intake (v3)
// Loads knowledge from Supabase Storage (with local + cache fallback)
// ==========================================

// ---- Config ----
const SUPABASE_URL = 'https://ghudwqytclfpiouzqzvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodWR3cXl0Y2xmcGlvdXpxenZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTk0MTIsImV4cCI6MjA5MDA5NTQxMn0.DoDwit2k5NRkt6x5EynQg3RJ5CrlqaTH5U6Ufgf-MoY';
const KB_REMOTE_BASE = SUPABASE_URL + '/storage/v1/object/public/cafe-station-knowledge';
const KB_LOCAL_BASE = 'data';
const REPORT_EMAIL = 'maximillian.lundin@bluewatergroup.com';
const DEFAULT_SUPPORT_EMAIL = 'support@bluewatergroup.com';

// ---- Supabase client (session logging only) ----
let db;
try {
  const { createClient } = window.supabase || {};
  if (createClient) db = createClient(SUPABASE_URL, SUPABASE_KEY);
} catch (e) { console.warn('Supabase could not be initialized:', e); }

// ---- State ----
window.currentLang = localStorage.getItem('cafestation_lang') || 'en';   // English by default; a stored choice wins
let KB = null;                       // knowledge base for current language
let currentProduct = 'cafe_station';
let currentPurifier = null;          // 'spirit' | 'other' | null — asked every session, after the product
let history = [];                    // stack of targets: 'home' | 'product' | 'purifier' | 'ask' | 'intake' | 'maintenance' | 'install' | 'step:x' | 'solution:y' | 'end:z'
let intakeText = '';                 // what the user typed on the "What's happening?" screen
let intakeMatches = [];              // scored issue matches for intakeText
let matchBanner = null;              // { title } shown once on the first step after an automatic match

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

function isSv() { return window.currentLang === 'sv'; }

// Screen-level strings that are not part of the knowledge base
function pickerStrings() {
  const m = {
    sv: {
      // home
      contact_title: 'Bluewater support',
      contact_btn: 'Mejla',
      contact_attach: 'Bifoga en skärmbild av About-sidan i Bluewater Serve-appen och ett foto på hela systemet.',
      mode_h: 'Hur kan vi hjälpa dig?', mode_sub: 'Välj vad du vill göra',
      tile_support: 'Support', tile_support_sub: 'Felsök ditt system',
      tile_maintenance: 'Underhållsguide', tile_maintenance_sub: 'Dagliga kontroller och Coffee Rock-byte',
      tile_install: 'Installationsvideor', tile_install_sub: 'Hela installationen, kapitel för kapitel',
      // product picker
      product_h: 'Vilken produkt behöver du hjälp med?', product_sub: 'Välj produkt för att fortsätta', product_tap: 'Tryck för att börja',
      // ask
      ask_title: 'Vad händer?',
      ask_placeholder: 'T.ex. "TDS stämmer inte" eller "Lampor blinkar"',
      ask_go: 'Hitta lösning',
      suggest_label: 'Menar du…',
      or_label: 'eller',
      tile_troubleshoot: 'Felsök steg för steg', tile_troubleshoot_sub: 'Välj problem från en lista istället',
      tile_tds: 'Så kontrollerar och åtgärdar du TDS-problem', tile_tds_sub: 'Mät TDS och åtgärda för höga eller låga värden',
      setup_label: 'Din anläggning', setup_with: 'med',
      // intake
      intake_you_wrote: 'Du skrev',
      intake_title_many: 'Vilket stämmer bäst?',
      intake_title_none: 'Vi hittade ingen direkt matchning',
      intake_none_text: 'Börja med grunderna så smalnar vi av problemet steg för steg.',
      intake_basics: 'Börja med grunderna',
      intake_all: 'Visa alla problemtyper',
      intake_none_of_these: 'Inget av dessa',
      banner_matched: 'Tolkat som', banner_wrong: 'Inte rätt?',
      // purifier picker
      purifier_h: 'Vilken reningsstation används med Café Station?', purifier_sub: 'Vi anpassar felsökningen efter din reningsstation.',
      purifier_pro: 'Bluewater PRO', purifier_spirit: 'Bluewater Spirit', purifier_cleone: 'Bluewater Cleone',
      purifier_spirit_sub: 'Bluewaters egen reningsstation', purifier_other: 'Annat märke', purifier_other_sub: 'Reningsstation från annan leverantör',
      purifier_unknown: 'Vet ej',
      // installation picker
      install_h: 'Vilken produkt installerar du?', install_sub: 'Välj produkt för att se installationsvideo',
      soon: 'Kommer snart',
      // solution / end
      did_it_work: 'Fungerade det?', step_done: 'Markera som klar',
      copy_summary: 'Kopiera sammanfattning', copied: 'Kopierat', diag_label: 'Diagnostikväg', attach_label: 'Bifoga',
      mail_preview: 'Förhandsvisning av mejlet', still_need_help: 'Behöver du ändå hjälp?',
      back: 'Tillbaka', home: 'Start', chapters: 'Kapitel', full_video: 'Hela installationsvideon',
      // privacy
      privacy_short: 'För att förbättra guiden loggar vi vilka steg du klickar på och vilken typ av webbläsare du använder. Inga namn eller kontaktuppgifter samlas in.',
      privacy_link: 'Integritetsmeddelande', privacy_footer: 'Integritet',
    },
    en: {
      // home
      contact_title: 'Bluewater support',
      contact_btn: 'Email',
      contact_attach: 'Attach a screenshot of the About page in the Bluewater Serve app and a photo of the whole system.',
      mode_h: 'What can we help you with?', mode_sub: 'Choose what you want to do',
      tile_support: 'Support', tile_support_sub: 'Troubleshoot your system',
      tile_maintenance: 'Maintenance guide', tile_maintenance_sub: 'Daily checks and Coffee Rock replacement',
      tile_install: 'Installation videos', tile_install_sub: 'The full installation, chapter by chapter',
      // product picker
      product_h: 'Which product do you need help with?', product_sub: 'Choose a product to continue', product_tap: 'Tap to start',
      // ask
      ask_title: "What's happening?",
      ask_placeholder: 'e.g. "TDS is wrong" or "Lights blinking"',
      ask_go: 'Find solution',
      suggest_label: 'Do you mean…',
      or_label: 'or',
      tile_troubleshoot: 'Troubleshoot step by step', tile_troubleshoot_sub: 'Pick the problem from a list instead',
      tile_tds: 'How to check and handle TDS issues', tile_tds_sub: 'Measure TDS and fix readings that are too high or too low',
      setup_label: 'Your setup', setup_with: 'with',
      // intake
      intake_you_wrote: 'You wrote',
      intake_title_many: 'Which is closest?',
      intake_title_none: "We couldn't match that",
      intake_none_text: "Let's start with the basics and narrow it down step by step.",
      intake_basics: 'Start with the basics',
      intake_all: 'Show all issue types',
      intake_none_of_these: 'None of these',
      banner_matched: 'Matched as', banner_wrong: 'Not right?',
      // purifier picker
      purifier_h: 'Which purifier is used with the Café Station?', purifier_sub: 'We tailor the troubleshooting to your purifier.',
      purifier_pro: 'Bluewater PRO', purifier_spirit: 'Bluewater Spirit', purifier_cleone: 'Bluewater Cleone',
      purifier_spirit_sub: "Bluewater's own purifier", purifier_other: 'Other brand', purifier_other_sub: 'Purifier from another supplier',
      purifier_unknown: "Don't know",
      // installation picker
      install_h: 'Which product are you installing?', install_sub: 'Choose a product to watch the installation video',
      soon: 'Coming soon',
      // solution / end
      did_it_work: 'Did it work?', step_done: 'Mark as done',
      copy_summary: 'Copy summary', copied: 'Copied', diag_label: 'Diagnostic path', attach_label: 'Please attach',
      mail_preview: 'Email preview', still_need_help: 'Still need help?',
      back: 'Back', home: 'Home', chapters: 'Chapters', full_video: 'Full installation video',
      // privacy
      privacy_short: 'To improve this guide we log which steps you tap and the type of browser you use. No names or contact details are collected.',
      privacy_link: 'Privacy notice', privacy_footer: 'Privacy',
    },
  };
  return m[window.currentLang] || m.en;
}
function sevLabel() { return isSv() ? 'Säkerhet' : 'Safety'; }

// Short example chips per issue (keyed by start_step); falls back to the issue title
const ISSUE_CHIPS = {
  sv: { noWater1: 'Inget vatten', tasteBad1: 'TDS stämmer inte', lights1: 'Lampor blinkar', leak1: 'Läckage', noPower1: 'Ingen ström', dosing_connect: 'Doseringen fungerar inte', slow_flow: 'Vattnet kommer långsamt' },
  en: { noWater1: 'No water', tasteBad1: 'TDS is wrong', lights1: 'Lights blinking', leak1: 'Leak', noPower1: 'No power', dosing_connect: 'Dosing not working', slow_flow: 'Water is slow' },
};

// ==========================================
// ICONS (1.5px stroke, rounded caps — per brand icon rules)
// ==========================================
const ICON = (() => {
  const w = (body, size) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" width="${size || 20}" height="${size || 20}" aria-hidden="true">${body}</svg>`;
  return {
    mail: w('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    arrow: w('<path d="M5 12h14"/><path d="M13 6l6 6-6 6"/>'),
    chevron: w('<path d="M9 6l6 6-6 6"/>', 18),
    back: w('<path d="M19 12H5"/><path d="M11 6l-6 6 6 6"/>'),
    check: w('<path d="M5 12l5 5L20 7"/>', 18),
    home: w('<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>', 16),
    copy: w('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h10"/>', 18),
    search: w('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 22),
    tool: w('<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>', 22),
    play: w('<circle cx="12" cy="12" r="9"/><path d="M10 8.5v7l6-3.5z"/>', 22),
    clock: w('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', 18),
    calendar: w('<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>', 18),
    bottle: w('<path d="M9 3h6l1 4H8z"/><path d="M8 7v13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"/><path d="M12 11v6"/>', 18),
    warn: w('<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>', 18),
    info: w('<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>', 18),
    route: w('<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>', 16),
    drop: w('<path d="M12 3l5.66 5.66a8 8 0 1 1-11.31 0z"/>', 22),
    box: w('<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18"/>', 22),
    camera: w('<path d="M4 8h3l2-2h6l2 2h3v11H4z"/><circle cx="12" cy="13" r="3"/>', 18),
    globe: w('<circle cx="12" cy="12" r="9"/><path d="M3 12h18"/><path d="M12 3a14 14 0 0 1 0 18a14 14 0 0 1 0-18z"/>', 18),
    cup: w('<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><path d="M6 1v3M10 1v3M14 1v3"/>', 22),
    kettle: w('<path d="M4 11h16"/><path d="M6 11V7a6 6 0 0 1 12 0v4"/><path d="M5 11l1.5 8a2 2 0 0 0 2 1.7h7a2 2 0 0 0 2-1.7L20 11"/>', 22),
    monitor: w('<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>', 22),
    success: w('<circle cx="12" cy="12" r="10"/><path d="M8 12.5l2.5 2.5L16 9.5"/>', 40),
  };
})();

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
  matchBanner = null;
  renderTarget(history[history.length - 1] || 'home');
}

function renderTrail() {
  const el = document.getElementById('trail');
  if (!el) return;
  const onHome = history.length <= 1;
  if (!session.steps.length || onHome) { el.innerHTML = ''; el.hidden = true; return; }
  const L = pickerStrings();
  el.hidden = false;
  el.innerHTML = `<button class="trail-home" id="trailHome" aria-label="${esc(L.home)}">${ICON.home}</button>` +
    session.steps.map((s, i) => `<button class="trail-chip" data-step="${i}" title="${esc(s.question)} → ${esc(s.answer)}">${esc(s.answer)}</button>`).join('');
  el.querySelectorAll('.trail-chip').forEach(item => { item.onclick = () => jumpToStep(+item.dataset.step); });
  const h = document.getElementById('trailHome');
  if (h) h.onclick = showHome;
  requestAnimationFrame(() => { el.scrollLeft = el.scrollWidth; });
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
function animateCard() {
  const c = cardEl(); if (!c) return;
  c.style.animation = 'none'; c.offsetHeight; c.style.animation = '';
  window.scrollTo({ top: 0, behavior: 'auto' });
}
function esc(s) { return (s == null ? '' : String(s)).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function nl2br(s) { return esc(s).replace(/\n/g, '<br>'); }
function btnClass(type) { return type === 'dont_know' ? 'btn-dont-know' : type === 'secondary' ? 'btn-secondary' : type === 'restart' ? 'btn-restart' : 'btn-primary'; }
function optClass(type) { return type === 'dont_know' ? 'opt opt-dk' : type === 'secondary' ? 'opt opt-secondary' : 'opt'; }
function optionsHtml(options) {
  return '<div class="options">' + options.map((o, i) =>
    `<button class="${optClass(o.type)}" data-i="${i}"><span class="opt-title">${esc(subP(o.label))}</span>${o.type === 'dont_know' ? '' : ICON.chevron}</button>`
  ).join('') + '</div>';
}

function imageHtml(src, alt) {
  if (!src) return '';
  return `<div class="media-img"><img src="${esc(src)}" alt="${esc(alt || '')}" loading="lazy"></div>`;
}
function audioHtml(src, label) {
  if (!src) return '';
  return `<div class="media-audio">${label ? `<span class="media-audio-label">${esc(label)}</span>` : ''}<audio controls preload="none" src="${esc(src)}"></audio></div>`;
}
function vimeoSrc(vimeoId, showcase, hash) {
  // Unlisted videos outside the showcase play directly with their privacy hash (?h=)
  if (hash) return `https://player.vimeo.com/video/${vimeoId}?h=${hash}&dnt=1`;
  const show = showcase || (KB && KB.product && KB.product.video_showcase) || '';
  return show
    ? `https://vimeo.com/showcase/${show}/embed2?video=${vimeoId}&autoplay=0&dnt=1`
    : `https://player.vimeo.com/video/${vimeoId}?dnt=1`;
}
function videoFrame(src) {
  return `<div class="video-wrapper"><div class="video-container"><iframe src="${src}" loading="lazy" allow="autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media" allowfullscreen></iframe></div></div>`;
}
function videoEmbed(v) {
  if (!v || !v.vimeo_id) return '';
  return videoFrame(vimeoSrc(v.vimeo_id, v.showcase, v.vimeo_hash));
}
function safetyHtml(text) {
  return `<div class="callout callout-safety">${ICON.warn}<span>${esc(text)}</span></div>`;
}
function aboutPageHtml() {
  const e = (KB && KB.escalation) || {};
  return `<div class="callout callout-info">${ICON.info}<div><strong>${esc(ui('about_page_label'))}</strong>${e.about_page_hint ? `<p>${esc(e.about_page_hint)}</p>` : ''}</div></div>`;
}
function backBtnHtml() {
  const L = pickerStrings();
  return history.length > 1 ? `<button class="btn-back" id="backBtn">${ICON.back}<span>${esc(L.back)}</span></button>` : '';
}
function bindBack() { const b = document.getElementById('backBtn'); if (b) b.onclick = goBack; }
function bannerHtml() {
  if (!matchBanner) return '';
  const L = pickerStrings();
  const b = matchBanner; matchBanner = null;
  return `<div class="match-banner">${ICON.check}<span>${esc(L.banner_matched)}: <strong>${esc(b.title)}</strong></span><button class="link-btn" id="bannerWrong">${esc(L.banner_wrong)}</button></div>`;
}
function bindBanner() {
  const b = document.getElementById('bannerWrong');
  if (!b) return;
  b.onclick = () => {
    // Drop the automatic interpretation and let the user pick from the candidates instead
    history.pop();
    session.steps.pop();
    intakeMatches = matchIssues(intakeText);
    navTo('intake');
  };
}

// ==========================================
// SUPPORT EMAIL TEMPLATE (shared by home screen and end screen)
// ==========================================
function supportEmail() {
  const e = (KB && KB.escalation) || {};
  return e.email || (KB && KB.product && KB.product.support_email) || DEFAULT_SUPPORT_EMAIL;
}
function attachList() {
  const e = (KB && KB.escalation) || {};
  if (Array.isArray(e.attachments) && e.attachments.length) return e.attachments;
  return isSv() ? [
    'Skärmbild av About-sidan i Bluewater Serve-appen (mjukvaru- och firmwareversioner)',
    'Foto på hela systemet där alla delar syns: reningsstation, tank, kontrollbox, doseringspump och boosterpump',
    'Om möjligt: närbilder på slangar och lampor, samt en kort video av problemet',
  ] : [
    'Screenshot of the About page in the Bluewater Serve app (software and firmware versions)',
    'Photo of the whole system showing all components: purifier, tank, control box, dosing pump and booster pump',
    'If possible: close-ups of tubing and lights, and a short video of the issue',
  ];
}
function mailSubject() {
  const e = (KB && KB.escalation) || {};
  return ui('mail_subject_value') || e.subject_hint || 'Café Station support';
}
function buildMailBody(includePath) {
  const L = pickerStrings();
  const sv = isSv();
  const lines = [];
  if (includePath && session.steps.length) {
    lines.push(sv
      ? '// Så här långt kom felsökningen. Stämmer det? Lägg till detaljer och skicka.\n// Stämmer det inte, ta bort det och beskriv problemet med egna ord.'
      : '// This is how far the troubleshooting got. If it matches, add details and send.\n// If it does not match, delete it and describe the issue in your own words.');
    lines.push('');
    lines.push(L.diag_label + ':');
    session.steps.forEach((s, i) => lines.push(`${i + 1}. ${s.question} → ${s.answer}`));
    lines.push('');
  }
  lines.push(sv ? 'Plats/adress:' : 'Site address:');
  lines.push(sv ? 'Kontaktperson på plats:' : 'On-site contact:');
  lines.push(sv ? 'När började det:' : 'When it started:');
  lines.push(sv ? 'Vad har ändrats:' : 'What changed:');
  lines.push('');
  lines.push(L.attach_label + ':');
  attachList().forEach(a => lines.push('• ' + a));
  return lines.join('\n');
}
function mailHref(includePath) {
  return `mailto:${supportEmail()}?subject=${encodeURIComponent(mailSubject())}&body=${encodeURIComponent(buildMailBody(includePath))}`;
}
async function copyToClipboard(text) {
  try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
  try {
    const ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select(); const ok = document.execCommand('copy'); ta.remove(); return ok;
  } catch (e) { return false; }
}

// ==========================================
// INTAKE MATCHER — free text → knowledge-base issue
// ==========================================
// Synonyms per issue start_step, on top of the KB's routing_keywords. Word-prefix matched
// ("leak" also hits "leaking", "blink" hits "blinkar"), plus typo tolerance for single words.
const INTAKE_SYNONYMS = {
  noWater1: ['no water', 'not coming', 'nothing comes', "doesn't come", 'does not come', 'stopped', 'empty', 'dry', 'no flow', 'inget vatten', 'kommer inget', 'kommer inte', 'slutat', 'tomt', 'torrt', 'inget flöde', 'vatten saknas'],
  tasteBad1: ['tds', 'ppm', 'taste', 'flat', 'acidic', 'sour', 'bitter', 'mineral', 'wrong value', 'too high', 'too low', 'conductivity', 'smak', 'platt', 'surt', 'besk', 'fel värde', 'för högt', 'för lågt', 'kaffet'],
  lights1: ['blink', 'flash', 'light', 'lamp', 'led', 'red', 'orange', 'purple', 'yellow', 'error', 'warning', 'lampa', 'lampor', 'lampan', 'ljus', 'röd', 'rött', 'lila', 'gul', 'felkod', 'varning'],
  leak1: ['leak', 'drip', 'overflow', 'flood', 'wet', 'puddle', 'water on the floor', 'läck', 'dropp', 'svämmar', 'översvämning', 'blött', 'vatten på golvet'],
  noPower1: ['power', 'no power', "won't start", 'wont start', 'not starting', 'dead', 'turn on', 'switch on', 'no lights', 'nothing on', 'ström', 'strömlös', 'startar inte', 'går inte igång', 'inga lampor', 'helt dött', 'slå på'],
  dosing_connect: ['dosing', 'dosing pump', 'pair', 'bluetooth', 'app', 'serve', 'connected', 'disconnected', 'not connected', 'mineral level', 'level zero', 'dosering', 'doseringspump', 'parkoppla', 'parkoppling', 'ansluten', 'frånkopplad', 'mineralnivå'],
  slow_flow: ['slow', 'trickle', 'weak', 'takes long', 'takes time', 'delay', 'low pressure', 'pressure', 'långsam', 'rinner sakta', 'sakta', 'svag', 'tar lång tid', 'dröjer', 'fördröjning', 'lågt tryck', 'tryck'],
};
function normalizeText(s) { return (s || '').toLowerCase().replace(/[’`´]/g, "'").replace(/\s+/g, ' ').trim(); }
function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasWordPrefix(q, phrase) {
  try { return new RegExp('(^|[^\\p{L}\\p{N}])' + escapeRe(phrase), 'iu').test(q); } catch (e) { return q.includes(phrase); }
}
function levenshtein(a, b) {
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[n];
}
function matchIssues(text) {
  const q = normalizeText(text);
  if (!q || !KB) return [];
  const tokens = q.split(/[^\p{L}\p{N}]+/u).filter(t => t.length >= 4);
  const out = [];
  for (const iss of (KB.issues || [])) {
    let score = 0, synScore = 0;
    for (const kw of (iss.routing_keywords || [])) {
      try { if (new RegExp(kw, 'i').test(q)) score += 3; } catch (e) {}
    }
    for (const s of (INTAKE_SYNONYMS[iss.start_step] || [])) {
      if (hasWordPrefix(q, s)) { synScore += 2; continue; }
      if (!s.includes(' ') && s.length >= 4) {
        const tol = s.length >= 7 ? 2 : 1;
        if (tokens.some(t => Math.abs(t.length - s.length) <= 2 && levenshtein(t, s) <= tol)) synScore += 1;
      }
    }
    score += Math.min(synScore, 6);   // overlapping synonyms ("lamp", "lampor") must not inflate one issue
    if (score > 0) out.push({ issue: iss, score });
  }
  return out.sort((a, b) => b.score - a.score);
}
// Route automatically only when one issue clearly dominates. If a second issue also has a real
// keyword hit (score >= 3), the text probably describes two things — ask instead.
function isClearMatch(m) {
  if (!m.length || m[0].score < 2) return false;
  if (m.length === 1) return true;
  if (m[1].score < 3) return m[0].score >= m[1].score * 1.6;
  return m[0].score >= m[1].score * 2.5;
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
    session.steps = session.steps.filter(s => s.historySnapshot.length < history.length);
    matchBanner = null;
    renderTarget(history[history.length - 1]);
  } else {
    showHome();
  }
}
function renderTarget(target) {
  renderTrail();
  if (target === 'home' || target === 'mode') return renderHome();
  if (target === 'product') return renderProductPicker();
  if (target === 'purifier') return renderPurifierPicker();
  if (target === 'ask' || target === 'start' || target === 'describe') return renderAsk();
  if (target === 'intake') return renderIntake();
  if (target === 'maintenance') return renderMaintenance();
  if (target === 'install') return renderInstallationPicker();
  if (target === 'install:cafe_station') return renderInstallationVideo();
  if (target === 'privacy') return renderPrivacy();
  const [kind, id] = target.split(':');
  if (kind === 'step') {
    const node = KB.diagnostic_steps[id];
    if (node && node.type === 'checklist') return renderChecklist(id);
    return renderQuestion(id);
  }
  if (kind === 'solution') return renderSolution(id);
  if (kind === 'end') return id === 'resolved' ? renderResolved() : renderNotResolved();
  return renderNotResolved();
}

function showHome() { history = ['home']; currentPurifier = null; matchBanner = null; renderTrail(); renderHome(); }
function restart() {
  session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
  intakeText = ''; intakeMatches = [];
  createSession();
  showHome();
}

// ==========================================
// START, PRODUCT, PURIFIER, ASK
// ==========================================
function contactCardHtml(includePath, withButton) {
  const L = pickerStrings();
  return `
    <section class="contact" aria-label="${esc(L.contact_title)}">
      <div class="contact-row">
        <div class="contact-ic">${ICON.mail}</div>
        <div class="contact-text">
          <span class="contact-title">${esc(L.contact_title)}</span>
          <a class="contact-email" href="${mailHref(includePath)}">${esc(supportEmail())}</a>
        </div>
        ${withButton ? `<a class="btn btn-primary btn-compact" href="${mailHref(includePath)}">${esc(L.contact_btn)}</a>` : ''}
      </div>
      <p class="contact-attach">${ICON.camera}<span>${esc(L.contact_attach)}</span></p>
    </section>`;
}

function tileHtml(id, icon, title, sub) {
  return `
      <button class="tile" id="${id}">
        <span class="tile-ic">${icon}</span>
        <span class="tile-text"><span class="tile-title">${esc(title)}</span><span class="tile-sub">${esc(sub)}</span></span>
        ${ICON.chevron}
      </button>`;
}
function soonTileHtml(name, icon) {
  const L = pickerStrings();
  return `
      <button class="tile disabled" disabled aria-disabled="true">
        <span class="tile-ic">${icon}</span>
        <span class="tile-text"><span class="tile-title">${esc(name)}</span><span class="tile-sub">${esc(L.soon)}</span></span>
      </button>`;
}

// Start page: contact up front, then choose Support / Maintenance / Installation
function renderHome() {
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    ${contactCardHtml(false, true)}
    <h2>${esc(L.mode_h)}</h2>
    <p>${esc(L.mode_sub)}</p>
    <div class="tiles">
      ${tileHtml('tileSupport', ICON.search, L.tile_support, L.tile_support_sub)}
      ${tileHtml('tileMaintenance', ICON.tool, L.tile_maintenance, L.tile_maintenance_sub)}
      ${tileHtml('tileInstall', ICON.play, L.tile_install, L.tile_install_sub)}
    </div>
    <p class="fineprint center privacy-hint">${esc(L.privacy_short)} <a class="inline-link" href="#privacy" id="privacyLinkHome">${esc(L.privacy_link)}</a></p>`;
  document.getElementById('privacyLinkHome').onclick = (e) => { e.preventDefault(); navTo('privacy'); };
  document.getElementById('tileSupport').onclick = () => navTo('product');
  document.getElementById('tileMaintenance').onclick = () => navTo('maintenance');
  document.getElementById('tileInstall').onclick = () => navTo('install');
}

// Privacy notice screen (text in privacy.js; sv/en, other languages fall back to en)
function renderPrivacy() {
  animateCard();
  const P = (typeof PRIVACY_TEXT !== 'undefined' && (PRIVACY_TEXT[window.currentLang] || PRIVACY_TEXT.en)) || null;
  if (!P) return renderHome();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <div class="privacy">
      <h2>${esc(P.title)}</h2>
      <p class="eyebrow">Café Station Support · ${esc(P.updated)}</p>
      ${P.sections.map(sec => `<h3>${esc(sec.h)}</h3>${sec.p.map(t => `<p>${esc(t)}</p>`).join('')}`).join('')}
    </div>`;
  bindBack();
}
function updatePrivacyLink() {
  const a = document.getElementById('privacyLink');
  if (!a) return;
  a.textContent = pickerStrings().privacy_footer;
  a.onclick = (e) => { e.preventDefault(); if (history[history.length - 1] !== 'privacy') navTo('privacy'); window.scrollTo({ top: 0 }); };
}

// Support step 1: which product
function renderProductPicker() {
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(L.product_h)}</h2>
    <p>${esc(L.product_sub)}</p>
    <div class="tiles">
      ${tileHtml('prodCafe', ICON.cup, 'Café Station', L.product_tap)}
      ${soonTileHtml('Bluewater Spirit', ICON.drop)}
      ${soonTileHtml('Brew Station', ICON.kettle)}
    </div>`;
  bindBack();
  document.getElementById('prodCafe').onclick = () => {
    currentProduct = 'cafe_station'; currentPurifier = null;
    navTo('purifier', { question: L.product_h, answer: 'Café Station' });
  };
}

// Support step 2: which purifier (asked every session)
function renderPurifierPicker() {
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(L.purifier_h)}</h2>
    <p>${esc(L.purifier_sub)}</p>
    <div class="options">
      <button class="opt" id="purSpirit"><span class="opt-ic">${ICON.drop}</span><span class="opt-text"><span class="opt-title">${esc(L.purifier_spirit)}</span><span class="opt-sub">${esc(L.purifier_spirit_sub)}</span></span>${ICON.chevron}</button>
      <button class="opt" id="purOther"><span class="opt-ic">${ICON.box}</span><span class="opt-text"><span class="opt-title">${esc(L.purifier_other)}</span><span class="opt-sub">${esc(L.purifier_other_sub)}</span></span>${ICON.chevron}</button>
    </div>`;
  bindBack();
  const pick = (purifier, label) => { currentPurifier = purifier; navTo('ask', { question: L.purifier_h, answer: label }); };
  document.getElementById('purSpirit').onclick = () => pick('spirit', L.purifier_spirit);
  document.getElementById('purOther').onclick = () => pick('other', L.purifier_other);
}

// Support step 3: "What's happening?" — free text with live suggestions, example chips, or the step-by-step list
function chipLabel(iss) {
  const m = ISSUE_CHIPS[window.currentLang] || ISSUE_CHIPS.en;
  return m[iss.start_step] || iss.title;
}
function goToIssue(iss, answerLabel, withBanner) {
  const L = pickerStrings();
  if (withBanner) matchBanner = { title: iss.title };
  navTo('step:' + iss.start_step, { question: L.ask_title, answer: answerLabel || iss.title });
}
function renderAsk() {
  animateCard();
  const L = pickerStrings();
  const productName = (KB && KB.product && KB.product.name) || 'Café Station 1™';
  const issues = (KB && KB.issues) || [];
  const purifierLabel = currentPurifier === 'other' ? L.purifier_other : L.purifier_spirit;

  cardEl().innerHTML = `
    ${backBtnHtml()}
    <p class="eyebrow">${esc(productName)} ${esc(L.setup_with)} ${esc(purifierLabel)}</p>
    <h2 class="ask-title">${esc(L.ask_title)}</h2>
    <form class="ask" id="askForm" autocomplete="off">
      <input class="ask-input" id="askInput" type="text" name="q" enterkeyhint="search" autocomplete="off" autocapitalize="sentences" placeholder="${esc(L.ask_placeholder)}" value="${esc(intakeText)}">
      <button class="ask-go" type="submit" aria-label="${esc(L.ask_go)}">${ICON.arrow}</button>
    </form>
    <div class="suggest" id="suggest" hidden></div>
    <div class="chips" id="chips">
      ${issues.map((iss, i) => `<button class="chip-btn" data-i="${i}">${esc(chipLabel(iss))}</button>`).join('')}
    </div>

    <div class="divider"><span>${esc(L.or_label)}</span></div>

    <div class="tiles">
      ${tileHtml('tileTroubleshoot', ICON.search, L.tile_troubleshoot, L.tile_troubleshoot_sub)}
      ${tileHtml('tileTds', ICON.drop, L.tile_tds, L.tile_tds_sub)}
    </div>`;
  bindBack();

  const form = document.getElementById('askForm');
  const input = document.getElementById('askInput');
  const suggest = document.getElementById('suggest');

  function renderSuggestions() {
    const text = input.value.trim();
    if (text.length < 2) { suggest.hidden = true; suggest.innerHTML = ''; return; }
    const m = matchIssues(text).filter(x => x.score >= 2).slice(0, 3);
    if (!m.length) { suggest.hidden = true; suggest.innerHTML = ''; return; }
    suggest.hidden = false;
    suggest.innerHTML = `<span class="suggest-label">${esc(L.suggest_label)}</span>` +
      m.map((x, i) => `<button class="suggest-item" type="button" data-i="${i}"><span>${esc(x.issue.title)}</span>${ICON.arrow}</button>`).join('');
    suggest.querySelectorAll('.suggest-item').forEach(btn => {
      btn.onclick = () => {
        intakeText = text;
        recordStep(L.ask_title, text);
        goToIssue(m[+btn.dataset.i].issue, null, false);
      };
    });
  }
  input.addEventListener('input', renderSuggestions);
  if (intakeText) renderSuggestions();

  form.onsubmit = (ev) => {
    ev.preventDefault();
    const text = input.value.trim();
    if (!text) { input.focus(); return; }
    intakeText = text;
    recordStep(L.ask_title, text);
    intakeMatches = matchIssues(text);
    if (isClearMatch(intakeMatches)) return goToIssue(intakeMatches[0].issue, null, true);
    navTo('intake');
  };

  document.querySelectorAll('#chips .chip-btn').forEach(btn => {
    btn.onclick = () => { const iss = issues[+btn.dataset.i]; intakeText = ''; goToIssue(iss, chipLabel(iss), false); };
  });
  document.getElementById('tileTroubleshoot').onclick = () => navTo('step:welcome', { question: L.ask_title, answer: L.tile_troubleshoot });
  document.getElementById('tileTds').onclick = () => { intakeText = ''; navTo('step:tasteBad1', { question: L.ask_title, answer: L.tile_tds }); };
}

function renderIntake() {
  animateCard();
  const L = pickerStrings();
  const m = intakeMatches.slice(0, 4);
  let html = backBtnHtml();
  html += `<p class="eyebrow">${esc(L.intake_you_wrote)}</p><blockquote class="quote">${esc(intakeText)}</blockquote>`;
  if (m.length) {
    html += `<h2>${esc(L.intake_title_many)}</h2>`;
    html += '<div class="options">' + m.map((x, i) => `<button class="opt" data-i="${i}"><span class="opt-title">${esc(x.issue.title)}</span>${ICON.chevron}</button>`).join('') + '</div>';
    html += `<div class="options options-tail"><button class="opt opt-dk" id="basicsBtn"><span class="opt-title">${esc(L.intake_none_of_these)} — ${esc(L.intake_basics).toLowerCase()}</span></button></div>`;
  } else {
    html += `<h2>${esc(L.intake_title_none)}</h2><p>${esc(L.intake_none_text)}</p>`;
    html += `<div class="options"><button class="btn btn-primary" id="basicsBtn">${esc(L.intake_basics)}</button><button class="btn btn-secondary" id="allBtn">${esc(L.intake_all)}</button></div>`;
  }
  cardEl().innerHTML = html;
  bindBack();
  cardEl().querySelectorAll('button[data-i]').forEach(btn => { btn.onclick = () => goToIssue(m[+btn.dataset.i].issue, null, false); });
  const basics = document.getElementById('basicsBtn');
  if (basics) basics.onclick = () => navTo(KB.diagnostic_steps.unknown1 ? 'step:unknown1' : 'step:welcome', { question: L.ask_title, answer: L.intake_basics });
  const all = document.getElementById('allBtn');
  if (all) all.onclick = () => navTo('step:welcome', { question: L.ask_title, answer: L.intake_all });
}

// ==========================================
// GUIDES
// ==========================================
function renderMaintenance() {
  animateCard();
  const sv = isSv();
  const title = sv ? 'Underhållsguide' : 'Maintenance guide';
  const intro = sv
    ? 'Bluewater rekommenderar följande rutinkontroller för att minimera risken för driftstopp.'
    : 'Bluewater recommends the following routine checks to minimise the risk of downtime.';
  const dailyTitle = sv ? 'Dagligen' : 'Daily';
  const standstillTitle = sv ? 'Efter 3 dagars stillestånd' : 'After 3 days of standstill';
  const replTitle = sv ? 'Påfyllning av Coffee Rock' : 'Coffee Rock replenishment';
  const dailyItems = sv ? [
    'Kontrollera lamporna på reningen och mineraliseraren.',
    'Grön lampa på reningen → OK. Annan färg → se manualen.',
    'Blå lampa på pumpenheten → OK. Annan färg → se manualen.',
    'Kontrollera Coffee Rock-nivån — byt flaska när vätskan når den svarta markeringen.',
    'Torka av Café Station 1™ med en trasa.',
  ] : [
    'Check the indicator lights on the purifier and the mineraliser.',
    'Green light on purifier → OK. Other colour → check the manual.',
    'Blue light on the pump head → OK. Any other colour → check the manual.',
    'Check Coffee Rock levels — replace the bottle when liquid reaches the black bar.',
    'Wipe down the Café Station 1™ with a cloth.',
  ];
  const standstillItems = sv ? [
    'Töm och spola ur vattentanken om systemet inte har använts på 3 dagar.',
  ] : [
    'Purge the water tank if the system has not been used for 3 days.',
  ];
  const replItems = sv ? [
    'Skruva loss pumpen från den tomma flaskan.',
    'Sätt fast pumpen på den nya Coffee Rock-flaskan — skruva åt ordentligt.',
    'Kontrollera att slangarna sitter korrekt och att det inte läcker.',
  ] : [
    'Unscrew the pump from the empty Coffee Rock bottle.',
    'Attach the pump to the new bottle — tighten securely.',
    'Check that the tubes are correctly seated and there are no leaks.',
  ];
  const techNote = sv
    ? 'Filterbyten och membranservice utförs av certifierad tekniker — kontakta din distributör för service.'
    : 'Filter replacements and membrane servicing are performed by a certified technician — contact your distributor for service.';

  const li = items => items.map(i => `<li>${esc(i)}</li>`).join('');
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(title)}</h2>
    <p>${esc(intro)}</p>
    <div class="maint-section">
      <div class="maint-freq">${ICON.clock}${esc(dailyTitle)}</div>
      <ul class="maint-list">${li(dailyItems)}</ul>
    </div>
    <div class="maint-section">
      <div class="maint-freq">${ICON.calendar}${esc(standstillTitle)}</div>
      <ul class="maint-list">${li(standstillItems)}</ul>
    </div>
    <div class="maint-section">
      <div class="maint-freq">${ICON.bottle}${esc(replTitle)}</div>
      <ul class="maint-list">${li(replItems)}</ul>
    </div>
    <div class="callout callout-info">${ICON.info}<span>${esc(techNote)}</span></div>`;
  bindBack();
}

function renderInstallationPicker() {
  animateCard();
  const L = pickerStrings();
  const soon = (name, icon) => `
      <button class="tile disabled" disabled aria-disabled="true">
        <span class="tile-ic">${icon}</span>
        <span class="tile-text"><span class="tile-title">${esc(name)}</span><span class="tile-sub">${esc(L.soon)}</span></span>
      </button>`;
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(L.install_h)}</h2>
    <p>${esc(L.install_sub)}</p>
    <div class="tiles">
      <button class="tile" id="installCafe">
        <span class="tile-ic">${ICON.cup}</span>
        <span class="tile-text"><span class="tile-title">Café Station</span><span class="tile-sub">${esc(L.tile_install_sub)}</span></span>
        ${ICON.chevron}
      </button>
      ${soon('Brew Station', ICON.kettle)}
      ${soon('Bluewater PRO', ICON.monitor)}
      ${soon('Bluewater Spirit', ICON.drop)}
    </div>`;
  bindBack();
  document.getElementById('installCafe').onclick = () => navTo('install:cafe_station');
}

function renderInstallationVideo() {
  animateCard();
  const L = pickerStrings();
  const sv = isSv();
  const showcase = KB && KB.product && KB.product.video_showcase ? KB.product.video_showcase : '12116945';
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
  // Chapters are collapsed; the iframe is only inserted when a chapter is opened (saves data on phones)
  const chaptersHtml = chapters.map((c, i) => `
    <details class="chapter" data-src="${esc(vimeoSrc(c.id, showcase))}">
      <summary><span class="chapter-num">${i + 1}</span><span class="chapter-title">${esc(c.label)}</span>${ICON.chevron}</summary>
      <div class="chapter-body"></div>
    </details>`).join('');
  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>Café Station ${sv ? 'installation' : 'installation'}</h2>
    <p>${sv ? 'Se hela installationsvideon, eller hoppa direkt till ett kapitel.' : 'Watch the full installation video, or jump straight to a chapter.'}</p>
    <p class="eyebrow">${esc(L.full_video)}</p>
    ${videoFrame(vimeoSrc('1235342432', null, '81bf2f2c32'))}
    <p class="eyebrow">${esc(L.chapters)}</p>
    <div class="chapters">${chaptersHtml}</div>
    <button class="btn btn-restart" id="installDoneBtn">${esc(ui('restart'))}</button>`;
  bindBack();
  cardEl().querySelectorAll('details.chapter').forEach(d => {
    d.addEventListener('toggle', () => {
      const body = d.querySelector('.chapter-body');
      if (d.open && body && !body.innerHTML) body.innerHTML = videoFrame(d.dataset.src);
    });
  });
  document.getElementById('installDoneBtn').onclick = restart;
}

// ==========================================
// DIAGNOSTIC SCREENS
// ==========================================
function renderQuestion(id) {
  const node = KB.diagnostic_steps[id];
  if (!node) return renderNotResolved();
  animateCard();
  const options = node.options
    .filter(o => !(currentPurifier === 'other' && SPIRIT_ONLY_NEXTS.has(o.next)))
    .map(o => (currentPurifier === 'other' && OTHER_REROUTE[o.next])
      ? { ...o, next: OTHER_REROUTE[o.next] } : o);
  let html = backBtnHtml();
  html += bannerHtml();
  html += `<h2>${esc(subP(node.question))}</h2>`;
  if (node.safety_warning && node.safety_warning.text) html += safetyHtml(subP(node.safety_warning.text));
  if (node.help_text) html += `<p>${nl2br(subP(node.help_text))}</p>`;
  if (node.image) html += imageHtml(node.image, node.image_alt);
  html += optionsHtml(options);
  cardEl().innerHTML = html;
  bindBack();
  bindBanner();
  cardEl().querySelectorAll('button[data-i]').forEach((btn) => {
    const o = options[+btn.dataset.i];
    btn.onclick = () => navTo(o.next, { question: node.question, answer: o.label });
  });
}

function renderChecklist(id) {
  const node = KB.diagnostic_steps[id];
  if (!node) return renderNotResolved();
  animateCard();
  const sv = isSv();
  const answers = {};
  const labels = {
    yes: sv ? 'Ja, ser normal ut' : 'Yes, looks normal',
    no: sv ? 'Nej, något är fel' : 'No, something is wrong',
    dontknow: sv ? 'Vet ej, kan inte se den' : "Don't know, can't see it",
    cont: sv ? 'Fortsätt' : 'Continue',
    progress: (a, b) => sv ? `${a} av ${b} kontrollerade` : `${a} of ${b} checked`,
  };
  const banner = bannerHtml();

  function partsHtml() {
    return node.parts.map(p => {
      const a = answers[p.id];
      return `
        <div class="checklist-part ${a ? 'answered' : ''}" data-part="${esc(p.id)}">
          <div class="checklist-part-header">
            <span class="checklist-part-label">${esc(subP(p.label))}</span>
            <span class="checklist-part-state">${esc(subP(p.normal_state))}</span>
          </div>
          <div class="checklist-btns">
            <button class="btn-check ${a === 'yes' ? 'selected' : ''}" data-part="${esc(p.id)}" data-val="yes">${esc(labels.yes)}</button>
            <button class="btn-check btn-check-no ${a === 'no' ? 'selected' : ''}" data-part="${esc(p.id)}" data-val="no">${esc(labels.no)}</button>
            <button class="btn-check btn-check-dk ${a === 'dontknow' ? 'selected' : ''}" data-part="${esc(p.id)}" data-val="dontknow">${esc(labels.dontknow)}</button>
          </div>
        </div>`;
    }).join('');
  }

  function render() {
    const answered = node.parts.filter(p => answers[p.id]).length;
    const allAnswered = answered === node.parts.length;
    cardEl().innerHTML = `
      ${backBtnHtml()}
      ${banner}
      <h2>${esc(subP(node.question))}</h2>
      ${node.help_text ? `<p>${esc(subP(node.help_text))}</p>` : ''}
      <div class="checklist-parts">${partsHtml()}</div>
      <p class="fineprint">${esc(labels.progress(answered, node.parts.length))}</p>
      <button class="btn btn-primary" id="checklistContinue" ${allAnswered ? '' : 'disabled'}>${esc(labels.cont)}</button>`;
    bindBack();
    bindBanner();
    bindChecklist();
  }

  function bindChecklist() {
    cardEl().querySelectorAll('.btn-check').forEach(btn => {
      btn.onclick = () => {
        const partId = btn.dataset.part;
        const val = btn.dataset.val;
        if (val === 'dontknow') {
          showCantSeePopup(node.cant_see_hint, () => { answers[partId] = 'dontknow'; render(); });
        } else {
          answers[partId] = val;
          render();
        }
      };
    });
    const cont = document.getElementById('checklistContinue');
    if (cont) cont.onclick = () => {
      const sorted = [...node.parts].sort((a, b) => a.priority - b.priority);
      const firstNo = sorted.find(p => answers[p.id] === 'no');
      const answerSummary = node.parts.map(p => `${p.label}: ${answers[p.id]}`).join(', ');
      if (firstNo) navTo(firstNo.no_route, { question: node.question, answer: answerSummary });
      else navTo(node.all_ok_route, { question: node.question, answer: answerSummary });
    };
  }

  render();
}

function showCantSeePopup(hint, onDismiss) {
  const overlay = document.createElement('div');
  overlay.className = 'popup-overlay';
  overlay.innerHTML = `
    <div class="popup-box" role="dialog" aria-modal="true">
      <p>${esc(hint)}</p>
      <button class="btn btn-primary" id="popupOk">OK</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.querySelector('#popupOk').onclick = () => { overlay.remove(); onDismiss(); };
}

function renderSolution(id) {
  let s = KB.solutions[id];
  if (!s) return renderNotResolved();
  // For Other brand: replace the RO-membrane step in tasteBad_sol_high with a purifier-supplier redirect
  if (currentPurifier === 'other' && id === 'tasteBad_sol_high') {
    s = { ...s, steps: s.steps.map(st => st.number === 3 ? { ...st, text: 'Measure TDS directly from the purifier output (before mineral dosing). If it reads above 10 ppm, the filter in the purifier may need attention — contact the purifier supplier.' } : st) };
  }
  animateCard();
  const L = pickerStrings();
  let html = backBtnHtml();

  // meta chips
  let chips = '';
  if (s.fix_type === 'quick') chips += `<span class="chip chip-quick">${esc(ui('fix_type_quick'))}</span>`;
  if (s.fix_type === 'long_term') chips += `<span class="chip chip-long">${esc(ui('fix_type_long'))}</span>`;
  if (s.estimated_time_minutes) chips += `<span class="chip chip-time">${ICON.clock}${esc(ui('est_time_label') || '~')} ${s.estimated_time_minutes} min</span>`;
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
      html += `<div class="sol-step"><button class="sol-step-num" type="button" aria-pressed="false" aria-label="${esc(L.step_done)}"><span class="num">${st.number}</span>${ICON.check}</button><div class="sol-step-body"><div class="sol-step-text">${nl2br(subP(st.text))}</div>`;
      html += imageHtml(st.image, st.image_alt);
      html += imageHtml(st.gif, st.image_alt);
      html += audioHtml(st.audio, st.audio_label);
      if (st.badge && st.badge.text) html += `<span class="step-badge">${esc(st.badge.text)}</span>`;
      html += `</div></div>`;
    });
    html += '</div>';
  }
  if (s.note) html += `<div class="callout callout-note">${ICON.info}<span>${nl2br(subP(s.note))}</span></div>`;

  (s.videos || []).forEach((v) => { html += videoEmbed(v); });
  (s.documents || []).forEach((d) => { html += `<a href="${esc(d.url)}" target="_blank" rel="noopener" class="btn btn-secondary">${esc(d.label)}</a>`; });

  if (s.photo_gallery && s.photo_gallery.length) {
    html += '<div class="photo-gallery">';
    s.photo_gallery.forEach((p) => { html += `<figure>${imageHtml(p.url, p.caption)}${p.caption ? `<figcaption>${esc(p.caption)}</figcaption>` : ''}</figure>`; });
    html += '</div>';
  }

  if (s.options) {
    if (s.after_text) html += `<p class="afterq">${esc(subP(s.after_text))}</p>`;
    html += optionsHtml(s.options);
  } else if (s.follow_up) {
    html += `<p class="afterq">${esc(L.did_it_work)}</p>`;
    html += '<div class="options">';
    html += `<button class="btn btn-primary" data-fu="solved">${esc(s.follow_up.solved_label)}</button>`;
    html += `<button class="btn btn-secondary" data-fu="not_solved">${esc(s.follow_up.not_solved_label)}</button>`;
    html += '</div>';
  }

  if (ui('need_help_step')) html += `<button class="link-btn help-link" id="helpLink">${esc(ui('need_help_step'))} &rarr;</button>`;

  cardEl().innerHTML = html;
  bindBack();
  cardEl().querySelectorAll('.sol-step-num').forEach(btn => {
    btn.onclick = () => {
      const done = btn.getAttribute('aria-pressed') !== 'true';
      btn.setAttribute('aria-pressed', done ? 'true' : 'false');
      btn.closest('.sol-step').classList.toggle('done', done);
    };
  });
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

// ==========================================
// END SCREENS
// ==========================================
function renderResolved() {
  endSession(true, false);
  animateCard();
  const L = pickerStrings();
  cardEl().innerHTML = `
    <div class="success">
      <div class="success-ic">${ICON.success}</div>
      <h2>${esc(ui('success_title'))}</h2>
      <p>${esc(ui('success_text'))}</p>
    </div>
    <button class="btn btn-primary" id="restartBtn">${esc(ui('restart'))}</button>
    <p class="fineprint center">${esc(L.still_need_help)} <a class="inline-link" href="${mailHref(true)}">${esc(supportEmail())}</a></p>`;
  document.getElementById('restartBtn').onclick = restart;
}

function renderNotResolved() {
  endSession(false, false);
  animateCard();
  const L = pickerStrings();
  const e = (KB && KB.escalation) || {};
  const hasBypass = KB && KB.solutions && KB.solutions.bypass;
  const subject = mailSubject();
  const body = buildMailBody(true);

  const diagPathHtml = session.steps.length ? `
    <div class="diag-path">
      <div class="diag-path-header">${ICON.route}<span>${esc(L.diag_label)}</span></div>
      <ol class="diag-path-list">
        ${session.steps.map(s => `<li><span class="diag-q">${esc(s.question)}</span><span class="diag-a">${esc(s.answer)}</span></li>`).join('')}
      </ol>
    </div>` : '';

  cardEl().innerHTML = `
    ${backBtnHtml()}
    <h2>${esc(ui('not_resolved_title'))}</h2>
    <p>${esc(e.local_support_msg || e.intro || ui('contact_text'))}</p>
    ${e.about_page_hint ? aboutPageHtml() : ''}
    <section class="contact">
      <div class="contact-row">
        <div class="contact-ic">${ICON.mail}</div>
        <div class="contact-text">
          <span class="contact-title">${esc(L.contact_title)}</span>
          <a class="contact-email" href="${mailHref(true)}">${esc(supportEmail())}</a>
        </div>
      </div>
      <a class="btn btn-primary" href="${mailHref(true)}">${esc(ui('mail_open_btn'))}</a>
      <button class="btn btn-secondary" id="copyBtn">${ICON.copy}<span>${esc(L.copy_summary)}</span></button>
    </section>
    <details class="mail-template">
      <summary>${esc(L.mail_preview)}${ICON.chevron}</summary>
      <p class="mail-row"><span class="mail-label">${esc(ui('mail_to_label'))}</span> ${esc(supportEmail())}</p>
      <p class="mail-row"><span class="mail-label">${esc(ui('mail_subject_label'))}</span> ${esc(subject)}</p>
      <pre class="mail-body">${esc(body)}</pre>
    </details>
    ${diagPathHtml}
    ${hasBypass ? `<button class="btn btn-bypass" id="bypassBtn">${esc(ui('bypass_cta'))}</button>` : ''}
    <button class="btn btn-restart" id="restartBtn">${esc(ui('restart'))}</button>`;
  bindBack();
  const bp = document.getElementById('bypassBtn');
  if (bp) bp.onclick = () => navTo('solution:bypass', { question: ui('not_resolved_title'), answer: ui('bypass_cta') });
  document.getElementById('restartBtn').onclick = restart;
  const copy = document.getElementById('copyBtn');
  copy.onclick = async () => {
    const ok = await copyToClipboard(`${ui('mail_to_label')}: ${supportEmail()}\n${ui('mail_subject_label')}: ${subject}\n\n${body}`);
    if (ok) { copy.querySelector('span').textContent = L.copied; copy.classList.add('is-copied'); setTimeout(() => { copy.querySelector('span').textContent = L.copy_summary; copy.classList.remove('is-copied'); }, 2000); }
  };
}

function renderLoadError() {
  const sv = isSv();
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
    const open = dropdown.classList.toggle('open');
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { search.value = ''; renderList(''); search.focus(); }
  });
  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('click', (e) => e.stopPropagation());
  document.addEventListener('click', () => { dropdown.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); });
  renderList('');
}

async function switchLang(code, label, dropdown) {
  window.currentLang = code;
  localStorage.setItem('cafestation_lang', code);
  document.documentElement.lang = code;
  if (label) label.textContent = code.toUpperCase();
  if (dropdown) dropdown.classList.remove('open');
  const next = await loadKB(code);
  if (next) KB = next;
  updatePrivacyLink();
  showHome();
}

// ==========================================
// INIT
// ==========================================
async function init() {
  document.documentElement.lang = window.currentLang;
  initLangSwitcher();
  updatePrivacyLink();
  createSession();
  resetInactivityTimer();
  const c = cardEl();
  if (c) c.innerHTML = '<div class="loading"><span class="spinner"></span></div>';
  KB = await loadKB(window.currentLang);
  if (!KB) return renderLoadError();
  showHome();

  const logo = document.getElementById('logoHome');
  if (logo) logo.addEventListener('click', () => restart());
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
