// Supabase setup
const SUPABASE_URL = 'https://ghudwqytclfpiouzqzvc.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdodWR3cXl0Y2xmcGlvdXpxenZjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTk0MTIsImV4cCI6MjA5MDA5NTQxMn0.DoDwit2k5NRkt6x5EynQg3RJ5CrlqaTH5U6Ufgf-MoY';
const REPORT_EMAIL = 'maximillian.lundin@bluewatergroup.com';
const SUPPORT_EMAIL = 'support@bluewatergroup.com';
const SUPPORT_PHONE = '+46 72 601 85 85';

// Video IDs
const VIDEOS = {
  full:           '1162167317',
  dosingPump:     '1162167496',
  boosterMachine: '1162167532',
  mineralTube:    '1162167569',
  floatSwitch:    '1162167601',
  boosterPump:    '1162167633',
  checkValve:     '1162167682',
  footprint:      '1162167706',
  changeModes:    '1162167734',
  espressoMode:   '1162167757',
  controlDosing:  '1162167800',
  mountControl:   '1162167825',
  troubleshoot:   '1162167862',
  priming:        '1162167889',
  powerOn:        '1162167921',
};

const SHOWCASE_URL = 'https://vimeo.com/showcase/12116945';

// Language
window.currentLang = localStorage.getItem('cafestation_lang') || 'sv';

// Supabase
let db;
try {
  const { createClient } = window.supabase || {};
  if (createClient) {
    db = createClient(SUPABASE_URL, SUPABASE_KEY);
  }
} catch (e) {
  console.warn('Supabase could not be initialized:', e);
}

// Session tracking
let session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
let inactivityTimer = null;
const INACTIVITY_TIMEOUT = 30 * 60 * 1000;

function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  inactivityTimer = setTimeout(() => endSession(false, true), INACTIVITY_TIMEOUT);
}

function recordStep(question, answer) {
  session.steps.push({ question, answer, timestamp: new Date().toISOString() });
  resetInactivityTimer();
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
        session_duration_seconds: duration, inactive_timeout: timedOut || false
      }).eq('id', session.id);
    } catch (e) { console.warn('Could not update session:', e); }
  }
  if (resolved !== undefined) sendEmailReport(resolved, timedOut, duration);
}

function sendEmailReport(resolved, timedOut, duration) {
  const stepsText = session.steps.map((s, i) => `${i + 1}. ${s.question} → ${s.answer}`).join('\n');
  console.log('Session report:', { resolved, timedOut, duration, steps: stepsText });
}

// History for back navigation
let stepHistory = [];

function pushHistory(stepName) {
  stepHistory.push(stepName);
}

// UI helpers
function setProgress(percent) {
  document.getElementById('progressFill').style.width = percent + '%';
}

function goBack() {
  if (stepHistory.length > 1) {
    stepHistory.pop(); // remove current
    const prev = stepHistory.pop(); // get previous (will be re-pushed when called)
    if (steps[prev]) steps[prev]();
  } else {
    steps.start();
  }
}

function videoLink(videoId) {
  if (!videoId) return '';
  return `<div class="video-wrapper">
    <div class="video-container">
      <iframe src="https://vimeo.com/showcase/12116945/embed2?video=${videoId}&autoplay=0"
        allow="autoplay; fullscreen; picture-in-picture; gyroscope; accelerometer; clipboard-write; encrypted-media; web-share"
        frameborder="0" allowfullscreen></iframe>
    </div>
  </div>`;
}

function renderStep(config) {
  const card = document.getElementById('card');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'fadeIn 0.3s ease';

  let html = '';
  if (stepHistory.length > 1) {
    html += `<button class="btn-back" id="backBtn">&larr;</button>`;
  }
  if (config.title) html += `<h2>${config.title}</h2>`;
  if (config.text) html += `<p>${config.text}</p>`;
  if (config.solution) {
    html += `<div class="solution-box"><h3>${t('solution')}</h3><p>${config.solution.text}</p></div>`;
    if (config.solution.videoId) html += videoLink(config.solution.videoId);
    if (config.solution.docUrl) html += `<a href="${config.solution.docUrl}" target="_blank" class="btn btn-doc">${config.solution.docLabel || t('tds_guide_link')}</a>`;
  }
  if (config.success) {
    html += `<div class="success-box"><h3>${config.success.title}</h3><p>${config.success.text}</p></div>`;
  }
  if (config.contact) {
    html += `<div class="contact-box"><h3>${t('contact_support')}</h3><p>${t('contact_text')}</p>
      <p><a href="mailto:${SUPPORT_EMAIL}">${SUPPORT_EMAIL}</a></p>
      <p><a href="https://wa.me/46726018585">${SUPPORT_PHONE}</a> (${t('whatsapp')})</p></div>`;
  }
  if (config.options) {
    html += '<div class="options">';
    config.options.forEach(opt => {
      const cls = opt.type === 'dont-know' ? 'btn-dont-know' : opt.type === 'secondary' ? 'btn-secondary' : opt.type === 'restart' ? 'btn-restart' : 'btn-primary';
      html += `<button class="btn ${cls}" data-action="${opt.action}">${opt.label}</button>`;
    });
    html += '</div>';
  }
  card.innerHTML = html;
  const backBtn = card.querySelector('#backBtn');
  if (backBtn) backBtn.addEventListener('click', goBack);
  card.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.getAttribute('data-action');
      if (steps[action]) { recordStep(config.title || '', btn.textContent); steps[action](); }
    });
  });
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
        item.textContent = `${l.label}`;
        item.addEventListener('click', () => {
          window.currentLang = l.code;
          localStorage.setItem('cafestation_lang', l.code);
          label.textContent = l.code.toUpperCase();
          dropdown.classList.remove('open');
          steps.start();
        });
        list.appendChild(item);
      });
  }

  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdown.classList.toggle('open');
    if (dropdown.classList.contains('open')) {
      search.value = '';
      renderList('');
      search.focus();
    }
  });

  search.addEventListener('input', () => renderList(search.value));
  search.addEventListener('click', (e) => e.stopPropagation());

  document.addEventListener('click', () => dropdown.classList.remove('open'));

  renderList('');
}

// ==========================================
// TROUBLESHOOTING FLOW
// ==========================================
const steps = {};

steps.start = function () {
  stepHistory = ['start'];
  setProgress(5);
  const card = document.getElementById('card');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'fadeIn 0.3s ease';
  card.innerHTML = `
    <h2>${t('start_title')}</h2>
    <div class="start-grid">
      <button class="start-card" id="startDescribe">
        <div class="start-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
            <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
        </div>
        <span class="start-card-title">${t('start_describe')}</span>
        <span class="start-card-sub">${t('start_describe_sub')}</span>
      </button>
      <button class="start-card" id="startTroubleshoot">
        <div class="start-card-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="32" height="32">
            <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
          </svg>
        </div>
        <span class="start-card-title">${t('start_troubleshoot')}</span>
        <span class="start-card-sub">${t('start_troubleshoot_sub')}</span>
      </button>
    </div>
  `;
  document.getElementById('startDescribe').addEventListener('click', () => {
    recordStep(t('start_title'), t('start_describe'));
    steps.describe();
  });
  document.getElementById('startTroubleshoot').addEventListener('click', () => {
    recordStep(t('start_title'), t('start_troubleshoot'));
    steps.welcome();
  });
};

steps.describe = function () {
  pushHistory('describe');
  setProgress(10);
  const card = document.getElementById('card');
  card.style.animation = 'none';
  card.offsetHeight;
  card.style.animation = 'fadeIn 0.3s ease';
  card.innerHTML = `
    <h2>${t('describe_title')}</h2>
    <textarea class="describe-input" id="describeInput" placeholder="${t('describe_placeholder')}" rows="4"></textarea>
    <p class="describe-hint">${t('describe_hint')}</p>
    <button class="btn btn-primary" id="describeSubmit">${t('describe_submit')}</button>
  `;
  const input = document.getElementById('describeInput');
  const submit = document.getElementById('describeSubmit');
  input.focus();

  submit.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    recordStep(t('describe_title'), text);
    submit.textContent = t('describe_analyzing');
    submit.disabled = true;
    // Route based on keywords
    setTimeout(() => routeFromDescription(text), 400);
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit.click();
    }
  });
};

function routeFromDescription(text) {
  const lower = text.toLowerCase();
  // Water-related
  if (lower.match(/inget vatten|no water|kein wasser|pas d'eau|no sale agua|vatten kommer inte|water.*not.*com|inte.*vatten/)) {
    steps.noWater1();
    return;
  }
  // TDS / taste
  if (lower.match(/tds|smak|taste|geschmack|goût|sabe|mineral|dosering|dosing/)) {
    steps.tasteBad1();
    return;
  }
  // Lights / blinking / error
  if (lower.match(/blink|light|lamp|ljus|licht|voyant|luz|error|fel.*box|control.*box|kontrollbox/)) {
    steps.lights1();
    return;
  }
  // Leak / overflow
  if (lower.match(/läck|leak|leck|fuit|fuga|overflow|svämma|översvämm|débord|desbord/)) {
    steps.leak1();
    return;
  }
  // Power / start
  if (lower.match(/start|ström|power|strom|alimentation|encien|slå på|turn on|einschalt/)) {
    steps.noPower1();
    return;
  }
  // Default: go to clickable troubleshooting
  steps.start();
}

steps.welcome = function () {
  pushHistory('welcome');
  setProgress(15);
  renderStep({
    title: t('welcome_title'), text: t('welcome_text'),
    options: [
      { label: t('no_water'), action: 'noWater1', type: 'primary' },
      { label: t('taste_bad'), action: 'tasteBad1', type: 'primary' },
      { label: t('lights_blink'), action: 'lights1', type: 'primary' },
      { label: t('leak'), action: 'leak1', type: 'primary' },
      { label: t('no_start'), action: 'noPower1', type: 'primary' },
      { label: t('dont_know'), action: 'unknown1', type: 'dont-know' }
    ]
  });
};

// NO WATER
steps.noWater1 = function () {
  pushHistory('noWater1');
  setProgress(30);
  renderStep({
    title: t('control_box_on'), text: t('control_box_on_text'),
    options: [
      { label: t('yes_lights'), action: 'noWater2_pumpCheck', type: 'primary' },
      { label: t('no_lights'), action: 'noWater_sol_power', type: 'secondary' },
      { label: t('dont_know_short'), action: 'noWater_sol_power', type: 'dont-know' }
    ]
  });
};

steps.noWater_sol_power = function () {
  pushHistory('noWater_sol_power');
  setProgress(70);
  renderStep({
    title: t('check_power_title'), solution: { text: t('check_power_text'), videoId: VIDEOS.powerOn },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

steps.noWater2_pumpCheck = function () {
  pushHistory('noWater2_pumpCheck');
  setProgress(45);
  renderStep({
    title: t('hear_pump'), text: t('hear_pump_text'),
    options: [
      { label: t('yes_buzzing'), action: 'noWater3_tankCheck', type: 'primary' },
      { label: t('no_sound'), action: 'noWater_sol_pump', type: 'secondary' },
      { label: t('dont_know_short'), action: 'noWater_sol_pump', type: 'dont-know' }
    ]
  });
};

steps.noWater_sol_pump = function () {
  pushHistory('noWater_sol_pump');
  setProgress(70);
  renderStep({
    title: t('check_pump_title'), solution: { text: t('check_pump_text'), videoId: VIDEOS.boosterPump },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

steps.noWater3_tankCheck = function () {
  pushHistory('noWater3_tankCheck');
  setProgress(55);
  renderStep({
    title: t('tank_water'), text: t('tank_water_text'),
    options: [
      { label: t('yes_water'), action: 'noWater_sol_connection', type: 'primary' },
      { label: t('no_empty'), action: 'noWater_sol_float', type: 'secondary' },
      { label: t('dont_know_short'), action: 'noWater_sol_float', type: 'dont-know' }
    ]
  });
};

steps.noWater_sol_float = function () {
  pushHistory('noWater_sol_float');
  setProgress(70);
  renderStep({
    title: t('check_float_title'), solution: { text: t('check_float_text'), videoId: VIDEOS.floatSwitch },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

steps.noWater_sol_connection = function () {
  pushHistory('noWater_sol_connection');
  setProgress(70);
  renderStep({
    title: t('check_connection_title'), solution: { text: t('check_connection_text'), videoId: VIDEOS.boosterMachine },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

// TDS
steps.tasteBad1 = function () {
  pushHistory('tasteBad1');
  setProgress(30);
  renderStep({
    title: t('measured_tds'), text: t('measured_tds_text'),
    options: [
      { label: t('yes_measured'), action: 'tasteBad2_level', type: 'primary' },
      { label: t('no_measured'), action: 'tasteBad_sol_measure', type: 'secondary' },
      { label: t('dont_know_short'), action: 'tasteBad_sol_measure', type: 'dont-know' }
    ]
  });
};

steps.tasteBad_sol_measure = function () {
  pushHistory('tasteBad_sol_measure');
  setProgress(50);
  renderStep({
    title: t('how_measure_title'),
    solution: { text: t('how_measure_text'), videoId: VIDEOS.changeModes, docUrl: 'docs/TDS-Protocol.pdf' },
    text: t('after_measure'),
    options: [
      { label: t('seems_high'), action: 'tasteBad_sol_high', type: 'primary' },
      { label: t('seems_low'), action: 'tasteBad_sol_low', type: 'secondary' },
      { label: t('dont_know_value'), action: 'tasteBad_sol_dontknow', type: 'dont-know' }
    ]
  });
};

steps.tasteBad2_level = function () {
  pushHistory('tasteBad2_level');
  setProgress(50);
  renderStep({
    title: t('tds_high_low'), text: t('tds_high_low_text'),
    options: [
      { label: t('too_high'), action: 'tasteBad_sol_high', type: 'primary' },
      { label: t('too_low'), action: 'tasteBad_sol_low', type: 'secondary' },
      { label: t('dont_know_short'), action: 'tasteBad_sol_dontknow', type: 'dont-know' }
    ]
  });
};

steps.tasteBad_sol_high = function () {
  pushHistory('tasteBad_sol_high');
  setProgress(70);
  renderStep({
    title: t('tds_high_title'), solution: { text: t('tds_high_text'), videoId: VIDEOS.changeModes, docUrl: 'docs/TDS-Protocol.pdf' },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

steps.tasteBad_sol_low = function () {
  pushHistory('tasteBad_sol_low');
  setProgress(70);
  renderStep({
    title: t('tds_low_title'), solution: { text: t('tds_low_text'), videoId: VIDEOS.priming, docUrl: 'docs/TDS-Protocol.pdf' },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

steps.tasteBad_sol_dontknow = function () {
  pushHistory('tasteBad_sol_dontknow');
  setProgress(70);
  renderStep({
    title: t('check_dosing_title'), solution: { text: t('check_dosing_text'), videoId: VIDEOS.controlDosing, docUrl: 'docs/TDS-Protocol.pdf' },
    options: [
      { label: t('solved'), action: 'resolved', type: 'primary' },
      { label: t('not_solved'), action: 'notResolved', type: 'secondary' },
    ]
  });
};

// LIGHTS
steps.lights1 = function () {
  pushHistory('lights1');
  setProgress(30);
  renderStep({
    title: t('which_light'), text: t('which_light_text'),
    options: [
      { label: t('power_light'), action: 'lights_sol_power', type: 'primary' },
      { label: t('dosing_light'), action: 'lights_sol_dosing', type: 'primary' },
      { label: t('float_light'), action: 'lights_sol_float', type: 'primary' },
      { label: t('dont_know_light'), action: 'lights_sol_general', type: 'dont-know' }
    ]
  });
};

steps.lights_sol_power = function () {
  pushHistory('lights_sol_power');
  setProgress(70);
  renderStep({
    title: t('power_light_title'), solution: { text: t('power_light_text'), videoId: VIDEOS.powerOn },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.lights_sol_dosing = function () {
  pushHistory('lights_sol_dosing');
  setProgress(70);
  renderStep({
    title: t('dosing_light_title'), solution: { text: t('dosing_light_text'), videoId: VIDEOS.controlDosing },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.lights_sol_float = function () {
  pushHistory('lights_sol_float');
  setProgress(70);
  renderStep({
    title: t('float_light_title'), solution: { text: t('float_light_text'), videoId: VIDEOS.floatSwitch },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.lights_sol_general = function () {
  pushHistory('lights_sol_general');
  setProgress(70);
  renderStep({
    title: t('check_control_title'), solution: { text: t('check_control_text'), videoId: VIDEOS.changeModes },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

// LEAK
steps.leak1 = function () {
  pushHistory('leak1');
  setProgress(30);
  renderStep({
    title: t('where_leak'), text: t('where_leak_text'),
    options: [
      { label: t('tank_overflow'), action: 'leak_sol_tank', type: 'primary' },
      { label: t('under_counter'), action: 'leak_sol_under', type: 'primary' },
      { label: t('at_machine'), action: 'leak_sol_machine', type: 'primary' },
      { label: t('dont_know_short'), action: 'leak_sol_general', type: 'dont-know' }
    ]
  });
};

steps.leak_sol_tank = function () {
  pushHistory('leak_sol_tank');
  setProgress(70);
  renderStep({
    title: t('tank_overflow_title'), solution: { text: t('tank_overflow_text'), videoId: VIDEOS.troubleshoot },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.leak_sol_under = function () {
  pushHistory('leak_sol_under');
  setProgress(70);
  renderStep({
    title: t('leak_under_title'), solution: { text: t('leak_under_text'), videoId: VIDEOS.checkValve },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.leak_sol_machine = function () {
  pushHistory('leak_sol_machine');
  setProgress(70);
  renderStep({
    title: t('leak_machine_title'), solution: { text: t('leak_machine_text'), videoId: VIDEOS.boosterMachine },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.leak_sol_general = function () {
  pushHistory('leak_sol_general');
  setProgress(70);
  renderStep({
    title: t('find_leak_title'), solution: { text: t('find_leak_text'), videoId: VIDEOS.full },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

// NO POWER
steps.noPower1 = function () {
  pushHistory('noPower1');
  setProgress(30);
  renderStep({
    title: t('cable_plugged'), text: t('cable_plugged_text'),
    options: [
      { label: t('yes_plugged'), action: 'noPower_sol_breaker', type: 'primary' },
      { label: t('no_checking'), action: 'noPower_sol_cable', type: 'secondary' },
      { label: t('dont_know_short'), action: 'noPower_sol_cable', type: 'dont-know' }
    ]
  });
};

steps.noPower_sol_cable = function () {
  pushHistory('noPower_sol_cable');
  setProgress(70);
  renderStep({
    title: t('check_cable_title'), solution: { text: t('check_cable_text'), videoId: VIDEOS.powerOn },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

steps.noPower_sol_breaker = function () {
  pushHistory('noPower_sol_breaker');
  setProgress(70);
  renderStep({
    title: t('check_breaker_title'), solution: { text: t('check_breaker_text'), videoId: VIDEOS.mountControl },
    options: [ { label: t('solved'), action: 'resolved', type: 'primary' }, { label: t('not_solved'), action: 'notResolved', type: 'secondary' } ]
  });
};

// UNKNOWN
steps.unknown1 = function () {
  pushHistory('unknown1');
  setProgress(20);
  renderStep({
    title: t('basics_title'), text: t('basics_text'),
    options: [ { label: t('next'), action: 'unknown2_water', type: 'primary' } ]
  });
};

steps.unknown2_water = function () {
  pushHistory('unknown2_water');
  setProgress(30);
  renderStep({
    title: t('water_coming'),
    options: [
      { label: t('yes_water_coming'), action: 'unknown3_lights', type: 'primary' },
      { label: t('no_water_coming'), action: 'noWater1', type: 'secondary' },
      { label: t('dont_know_short'), action: 'unknown3_lights', type: 'dont-know' }
    ]
  });
};

steps.unknown3_lights = function () {
  pushHistory('unknown3_lights');
  setProgress(40);
  renderStep({
    title: t('lights_on'), text: t('lights_on_text'),
    options: [
      { label: t('lights_normal'), action: 'tasteBad1', type: 'primary' },
      { label: t('lights_blinking'), action: 'lights1', type: 'primary' },
      { label: t('no_lights_at_all'), action: 'noPower1', type: 'secondary' },
      { label: t('dont_know_short'), action: 'notResolved', type: 'dont-know' }
    ]
  });
};

// RESOLVED / NOT RESOLVED
steps.resolved = function () {
  pushHistory('resolved');
  setProgress(100);
  endSession(true, false);
  renderStep({
    success: { title: t('success_title'), text: t('success_text') },
    options: [ { label: t('restart'), action: 'restart', type: 'restart' } ]
  });
};

steps.notResolved = function () {
  pushHistory('notResolved');
  setProgress(100);
  endSession(false, false);
  renderStep({
    title: t('not_resolved_title'), contact: true,
    options: [ { label: t('restart'), action: 'restart', type: 'restart' } ]
  });
};

steps.restart = function () {
  session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
  createSession();
  steps.start();
};

// ==========================================
// START
// ==========================================
function init() {
  initLangSwitcher();
  createSession();
  resetInactivityTimer();
  steps.start();

  // Logo click goes home
  const logo = document.getElementById('logoHome');
  if (logo) {
    logo.addEventListener('click', () => {
      session = { id: null, startTime: Date.now(), steps: [], product: 'cafe_station' };
      createSession();
      steps.start();
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
if (document.readyState !== 'loading') init();
