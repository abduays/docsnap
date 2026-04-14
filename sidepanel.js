'use strict';

/* ══════════════════ CONFIG ══════════════════ */
const DT = {
  process:   { label:'Process Doc',  icon:'🔄', color:'#6366f1', desc:'SOPs & workflows' },
  api:       { label:'API Docs',     icon:'🔌', color:'#0ea5e9', desc:'REST & endpoints' },
  project:   { label:'Project Doc',  icon:'📁', color:'#10b981', desc:'Features & onboarding' },
  docascode: { label:'Doc-as-Code',  icon:'💻', color:'#f59e0b', desc:'CLI & dev workflows' },
  arch:      { label:'Architecture', icon:'🏗️', color:'#8b5cf6', desc:'System design' },
  userguide: { label:'User Guide',   icon:'📖', color:'#ec4899', desc:'Tutorials & how-tos' },
};
const ST = {
  action:  { label:'Action',  icon:'👆' },
  info:    { label:'Info',    icon:'ℹ️' },
  warning: { label:'Warning', icon:'⚠️' },
  tip:     { label:'Tip',     icon:'💡' },
  code:    { label:'Code',    icon:'💻' },
  api:     { label:'API',     icon:'🔌' },
};
const ANN_COLORS = ['#fbbf24','#f97316','#ef4444','#34d399','#60a5fa','#a78bfa','#0f172a'];
const LANGS = ['javascript','typescript','python','bash','sql','json','yaml','html','css','jsx','go','rust','java','csharp','dockerfile'];
const CALS  = { info:'ℹ️', tip:'💡', warning:'⚠️', danger:'🚨' };
const CAL_COLORS = {
  info:    { bg:'#eff6ff', color:'#1d4ed8' },
  tip:     { bg:'#ecfdf5', color:'#065f46' },
  warning: { bg:'#fffbeb', color:'#92400e' },
  danger:  { bg:'#fef2f2', color:'#b91c1c' },
};

/* ══════════════════ STATE ══════════════════ */
const S = {
  screen: 'idle', docType: 'process', autoMode: true,
  steps: [], selId: null, elapsed: 0, timer: null,
  tabId: null, tabUrl: '', tabTitle: '',
};
const EO = { fmt: 'html', theme: 'light' };
const ANN = {
  stepId: null, base: null, anns: [], tool: 'highlight',
  color: '#fbbf24', drawing: false, ds: null, arrowPt: null,
};

/* ══════════════════ PORT ══════════════════ */
let port = null;
function connectPort() {
  port = chrome.runtime.connect({ name: 'ds' });
  port.onMessage.addListener(onBg);
  port.onDisconnect.addListener(() => { port = null; setTimeout(connectPort, 300); });
}
connectPort();
function toBg(msg) { if (port) try { port.postMessage(msg); } catch (_) {} }

function onBg(msg) {
  if (msg.type === 'tabInfo')  { S.tabId = msg.tabId; S.tabUrl = msg.url; S.tabTitle = msg.title; renderTabUrl(); }
  if (msg.type === 'started')  { S.tabUrl = msg.url; S.tabTitle = msg.title; }
  if (msg.type === 'captured') { receiveCapture(msg); }
  if (msg.type === 'err')      { toast('⚠️ ' + msg.msg); }
}

/* ══════════════════ HELPERS ══════════════════ */
function G(id) { return document.getElementById(id); }
function esc(s) {
  return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function pad(n) { return String(n).padStart(2, '0'); }
function fmt(s) { return pad(Math.floor(s / 60)) + ':' + pad(s % 60); }
function uid()  { return Date.now() + Math.random().toString(36).slice(2, 7); }
function ce(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* ══════════════════ INIT ══════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildDtypeGrid();
  buildAnnColors();
  wireButtons();
  setTimeout(fetchTab, 100);
});

function buildDtypeGrid() {
  const grid = G('dtype-grid');
  Object.entries(DT).forEach(([k, d]) => {
    const card = ce('div', 'dtype-card' + (k === 'process' ? ' sel' : ''));
    card.style.setProperty('--cc', d.color);
    card.dataset.key = k;
    const check = ce('div', 'dtype-check', '✓');
    const icon  = ce('div', 'dtype-icon', d.icon);
    const name  = ce('div', 'dtype-name', d.label);
    const desc  = ce('div', 'dtype-desc', d.desc);
    card.append(check, icon, name, desc);
    card.addEventListener('click', () => selectDocType(k));
    grid.appendChild(card);
  });
}

function buildAnnColors() {
  const wrap = G('ann-cols');
  ANN_COLORS.forEach((c, i) => {
    const el = ce('div', 'ann-col' + (i === 0 ? ' sel' : ''));
    el.style.background = c;
    el.addEventListener('click', () => {
      ANN.color = c;
      document.querySelectorAll('.ann-col').forEach(e => e.classList.remove('sel'));
      el.classList.add('sel');
    });
    wrap.appendChild(el);
  });
}

function wireButtons() {
  // Idle
  G('idle-btn-auto').addEventListener('click',   () => setIdleMode(true));
  G('idle-btn-manual').addEventListener('click', () => setIdleMode(false));
  G('btn-tab-refresh').addEventListener('click', fetchTab);
  G('btn-start').addEventListener('click', startRec);

  // Recording
  G('rec-btn-auto').addEventListener('click',   () => setRecMode(true));
  G('rec-btn-manual').addEventListener('click', () => setRecMode(false));
  G('btn-cap').addEventListener('click', manualCap);
  G('btn-stop').addEventListener('click', stopRec);

  // Editor
  G('btn-back-rec').addEventListener('click', backToRec);
  G('btn-open-exp').addEventListener('click', () => { flushForm(); openExp(); });

  // Topbar
  G('btn-export').addEventListener('click', () => { flushForm(); openExp(); });
  G('btn-reset').addEventListener('click', resetAll);

  // Annotation
  G('ann-t-highlight').addEventListener('click', () => setATool('highlight'));
  G('ann-t-arrow').addEventListener('click',     () => setATool('arrow'));
  G('ann-t-text').addEventListener('click',      () => setATool('text'));
  G('ann-t-blur').addEventListener('click',      () => setATool('blur'));
  G('ann-btn-undo').addEventListener('click',    undoAnn);
  G('ann-btn-clear').addEventListener('click',   clearAnn);
  G('ann-btn-cancel').addEventListener('click',  closeAnn);
  G('ann-btn-save').addEventListener('click',    saveAnn);

  const annCanvas = G('ann-canvas');
  annCanvas.addEventListener('mousedown', annMouseDown);
  annCanvas.addEventListener('mousemove', annMouseMove);
  annCanvas.addEventListener('mouseup',   annMouseUp);

  // Export
  G('btn-exp-back').addEventListener('click',  closeExp);
  G('btn-do-export').addEventListener('click', doExport);
  G('fmt-html').addEventListener('click', () => pickFmt('html'));
  G('fmt-md').addEventListener('click',   () => pickFmt('md'));
  G('theme-light').addEventListener('click', () => pickTheme('light'));
  G('theme-dark').addEventListener('click',  () => pickTheme('dark'));
  ['tog-toc','tog-shots','tog-code','tog-types'].forEach(id => {
    G(id).addEventListener('click', () => G(id).classList.toggle('tog-on'));
  });
}

/* ══════════════════ SCREENS ══════════════════ */
function showScreen(name) {
  ['screen-idle','screen-rec','screen-editor'].forEach(id => G(id).classList.add('hidden'));
  G('screen-' + name).classList.remove('hidden');
  S.screen = name;
}

/* ══════════════════ TAB INFO ══════════════════ */
function fetchTab() { toBg({ type: 'getTab' }); }
function renderTabUrl() {
  const el = G('tab-url');
  if (!el) return;
  try { el.textContent = new URL(S.tabUrl).hostname || S.tabUrl || 'Unknown tab'; }
  catch { el.textContent = S.tabUrl || 'Unknown tab'; }
}

/* ══════════════════ IDLE ══════════════════ */
function selectDocType(k) {
  document.querySelectorAll('.dtype-card').forEach(c => c.classList.toggle('sel', c.dataset.key === k));
  S.docType = k;
}
function setIdleMode(auto) {
  S.autoMode = auto;
  G('idle-btn-auto').className   = 'mode-btn' + (auto ? ' mode-auto-on' : '');
  G('idle-btn-manual').className = 'mode-btn' + (auto ? '' : ' mode-manual-on');
}

/* ══════════════════ RECORDING ══════════════════ */
function startRec() {
  S.steps = []; S.elapsed = 0; S.selId = null;
  clearInterval(S.timer);
  S.timer = setInterval(() => { S.elapsed++; G('rtimer').textContent = fmt(S.elapsed); }, 1000);
  showScreen('rec');
  renderSteps();
  applyRecMode();
  G('btn-export').classList.remove('hidden');
  G('btn-reset').classList.remove('hidden');
  toBg({ type: 'start', auto: S.autoMode });
}

function stopRec() {
  clearInterval(S.timer);
  toBg({ type: 'stop' });
  if (!S.steps.length) { showScreen('idle'); return; }
  showScreen('editor');
  buildRail();
  showNoSel();
}

function backToRec() {
  flushForm();
  showScreen('rec');
  renderSteps();
}

function setRecMode(auto) {
  S.autoMode = auto;
  applyRecMode();
  toBg({ type: 'setMode', auto });
}
function applyRecMode() {
  const auto = S.autoMode;
  G('rec-btn-auto').className   = 'rm-btn' + (auto ? ' rm-auto' : '');
  G('rec-btn-manual').className = 'rm-btn' + (auto ? '' : ' rm-manual');
  const badge = G('mode-badge');
  badge.textContent = auto ? 'AUTO' : 'MANUAL';
  badge.className   = 'mode-badge ' + (auto ? 'mode-badge-auto' : 'mode-badge-manual');
}

function manualCap() {
  const btn = G('btn-cap');
  btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
  toBg({ type: 'capture' });
}

function resetAll() {
  if (!confirm('Reset everything?')) return;
  S.steps = []; S.selId = null; clearInterval(S.timer);
  toBg({ type: 'stop' });
  showScreen('idle');
  G('btn-export').classList.add('hidden');
  G('btn-reset').classList.add('hidden');
  toast('Reset');
}

/* ══════════════════ RECEIVE CAPTURE ══════════════════ */
function receiveCapture(msg) {
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.width; c.height = img.height;
    const ctx = c.getContext('2d');
    ctx.drawImage(img, 0, 0);

    if (msg.x != null && msg.y != null) {
      const r = Math.min(img.width, img.height) * 0.032;
      ctx.save();
      ctx.beginPath(); ctx.arc(msg.x, msg.y, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249,115,22,.13)'; ctx.fill();
      ctx.beginPath(); ctx.arc(msg.x, msg.y, r * 1.35, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(249,115,22,.42)'; ctx.lineWidth = Math.max(1.5, img.width * .0015); ctx.stroke();
      ctx.beginPath(); ctx.arc(msg.x, msg.y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(249,115,22,.2)'; ctx.fill();
      ctx.strokeStyle = '#f97316'; ctx.lineWidth = Math.max(2.5, img.width * .002); ctx.stroke();
      ctx.beginPath(); ctx.arc(msg.x, msg.y, r * .22, 0, Math.PI * 2);
      ctx.fillStyle = '#ea580c'; ctx.fill();
      ctx.restore();
    }

    const shot = c.toDataURL('image/jpeg', .92);
    let host = '';
    try { host = new URL(msg.url).hostname; } catch {}

    const step = {
      id: uid(), shot, origShot: shot, desc: '', stepType: 'action',
      code: { lang: 'javascript', content: '', show: false },
      api:  { method: 'GET', endpoint: '', request: '', response: '' },
      tags: [], callout: '', calloutType: 'info',
      ts: fmt(S.elapsed), url: msg.url || '', host,
      el: msg.el || null, busy: true,
    };
    S.steps.push(step);
    renderSteps();
    if (S.screen === 'editor') buildRail();
    aiDescribe(step);
  };
  img.src = msg.dataUrl;
}

/* ══════════════════ RENDER STEPS ══════════════════ */
function renderSteps() {
  G('rec-ct').textContent = S.steps.length + ' step' + (S.steps.length !== 1 ? 's' : '');
  const area = G('steps-area');
  // Clear
  while (area.firstChild) area.removeChild(area.firstChild);

  if (!S.steps.length) {
    const emp = ce('div', 'empty-state');
    emp.innerHTML = '<div class="ei">🖼️</div><p>Steps appear here automatically.<br>Interact with the page.</p>';
    area.appendChild(emp);
    return;
  }

  S.steps.forEach((s, i) => {
    const card = ce('div', 'sc' + (s.id === S.selId ? ' sel' : ''));
    card.dataset.sid = s.id;

    // Image wrap
    const imgw = ce('div', 'sc-imgw');
    const img = ce('img', 'sc-img'); img.src = s.shot; img.alt = 'S' + (i+1);
    imgw.appendChild(img);
    if (s.host) { const h = ce('div', 'sc-host', s.host); imgw.appendChild(h); }
    card.appendChild(imgw);

    // Body
    const body = ce('div', 'sc-body');
    const top  = ce('div', 'sc-top');
    const num  = ce('span', 'sc-num', 'S' + pad(i + 1));
    const ts   = ce('span', 'sc-ts', s.ts);
    top.append(num, ts);
    body.appendChild(top);

    const desc = ce('div', 'sc-desc' + (s.busy ? ' ai-loading' : ''));
    desc.dataset.sid = s.id;
    if (s.busy) {
      const sp = ce('span', 'spin'); desc.appendChild(sp);
      desc.appendChild(document.createTextNode(' Analyzing…'));
    } else {
      desc.textContent = s.desc || 'Captured';
    }
    body.appendChild(desc);

    if (s.el && s.el.text) {
      const el = ce('div', 'sc-el', s.el.tag + ' · ' + s.el.text);
      body.appendChild(el);
    }
    card.appendChild(body);

    card.addEventListener('click', () => { S.selId = s.id; renderSteps(); showScreen('editor'); buildRail(); pickStep(s.id); });
    area.appendChild(card);
  });
  area.scrollTop = area.scrollHeight;
}

/* ══════════════════ AI DESCRIBE ══════════════════ */
async function aiDescribe(step) {
  try {
    const b64 = step.shot.split(',')[1];
    const elHint = step.el && step.el.text ? ` The user clicked on a "${step.el.tag}" element with text "${step.el.text}".` : '';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514', max_tokens: 80,
        messages: [{ role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: b64 } },
          { type: 'text', text: `Write ONE clear sentence (10–18 words) for a technical documentation guide.${elHint} An orange ring marks where the user clicked. Start with an action verb. Output ONLY the sentence.` }
        ]}]
      }),
    });
    const d = await res.json();
    step.desc = (d.content?.[0]?.text || '').trim().replace(/^["']|["']$/g, '') ||
                (step.el?.text ? `Click "${step.el.text}"` : 'Step captured');
  } catch {
    step.desc = step.el?.text ? `Click "${step.el.text}"` : 'Step captured';
  }
  step.busy = false;

  // Patch recording list node
  const node = document.querySelector(`.sc-desc[data-sid="${step.id}"]`);
  if (node) { node.classList.remove('ai-loading'); node.textContent = step.desc; }

  // Patch editor rail tooltip
  const th = G('eth-' + step.id);
  if (th) th.title = step.desc;

  // Patch editor form if open
  if (S.screen === 'editor' && S.selId === step.id) {
    const ta = G('ed-desc');
    if (ta && !ta.value) ta.value = step.desc;
    const note = G('ai-note-' + step.id);
    if (note) note.remove();
  }
}

/* ══════════════════ EDITOR RAIL ══════════════════ */
function buildRail() {
  const rail = G('e-rail');
  while (rail.firstChild) rail.removeChild(rail.firstChild);
  S.steps.forEach((s, i) => {
    const wrap = ce('div', 'e-thumb-wrap' + (s.id === S.selId ? ' sel' : ''));
    wrap.id = 'eth-' + s.id;
    wrap.title = s.desc || 'Step ' + (i + 1);
    const n = ce('div', 'e-thumb-n', 'S' + pad(i + 1));
    const img = ce('img', 'e-thumb'); img.src = s.shot; img.alt = 'S' + (i + 1);
    wrap.append(n, img);
    wrap.addEventListener('click', () => pickStep(s.id));
    rail.appendChild(wrap);
  });
}

/* ══════════════════ EDITOR FORM ══════════════════ */
function showNoSel() {
  const w = G('e-form-wrap');
  w.innerHTML = '';
  const ns = ce('div', 'no-sel');
  ns.innerHTML = '<div class="no-sel-icon">✦</div><p>Select a step</p>';
  w.appendChild(ns);
}

function flushForm() {
  if (!S.selId) return;
  const s = S.steps.find(x => x.id === S.selId);
  if (!s) return;
  const v = id => G(id) ? G(id).value : null;
  if (v('ed-desc') !== null)  s.desc             = v('ed-desc');
  if (v('ed-cb')   !== null)  s.code.content      = v('ed-cb');
  if (v('ed-cl')   !== null)  s.code.lang         = v('ed-cl');
  if (v('ed-ep')   !== null)  s.api.endpoint      = v('ed-ep');
  if (v('ed-req')  !== null)  s.api.request       = v('ed-req');
  if (v('ed-resp') !== null)  s.api.response      = v('ed-resp');
  if (v('ed-cal')  !== null)  s.callout           = v('ed-cal');
}

function pickStep(id) {
  flushForm();
  S.selId = id;
  document.querySelectorAll('.e-thumb-wrap').forEach(e => e.classList.toggle('sel', e.id === 'eth-' + id));
  const s = S.steps.find(x => x.id === id);
  if (!s) { showNoSel(); return; }
  buildForm(s);
  G('eth-' + id)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function buildForm(s) {
  const idx    = S.steps.indexOf(s);
  const isAPI  = S.docType === 'api' || s.stepType === 'api';
  const showC  = S.docType === 'docascode' || s.stepType === 'code' || s.code.show;
  const w = G('e-form-wrap');
  w.innerHTML = '';

  const form = ce('div', 'e-form');

  // Meta
  const meta = ce('span', 'e-meta', `STEP ${idx+1}/${S.steps.length} · ${s.host || '–'} · ${s.ts}`);
  form.appendChild(meta);

  // Screenshot
  const shotCard = ce('div', 'shot-card');
  if (s.shot) {
    const sImg = ce('img', 'shot-img'); sImg.id = 'ed-shot'; sImg.src = s.shot;
    shotCard.appendChild(sImg);
  } else {
    const ph = ce('div'); ph.style.cssText = 'aspect-ratio:16/9;background:var(--bg);border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px';
    ph.textContent = 'No screenshot';
    shotCard.appendChild(ph);
  }
  const shotBtns = ce('div', 'shot-btns');
  const btnAnn  = ce('button', 'shot-btn', '✏️ Annotate');
  const btnRst  = ce('button', 'shot-btn', '↩ Reset');
  const btnUpl  = ce('button', 'shot-btn', '📁 Replace');
  btnAnn.addEventListener('click', () => openAnn(s.id));
  btnRst.addEventListener('click', () => resetShot(s.id));
  btnUpl.addEventListener('click', () => uploadShot(s.id));
  shotBtns.append(btnAnn, btnRst, btnUpl);
  shotCard.appendChild(shotBtns);
  form.appendChild(shotCard);

  // Step type
  const stField = ce('div', 'field');
  stField.appendChild(ce('span', 'field-label', 'Step Type'));
  const stWrap = ce('div', 'stype-wrap');
  Object.entries(ST).forEach(([k, v]) => {
    const b = ce('button', 'st-btn' + (s.stepType === k ? ' st-' + k : ''), v.icon + ' ' + v.label);
    b.addEventListener('click', () => { flushForm(); s.stepType = k; buildRail(); buildForm(s); });
    stWrap.appendChild(b);
  });
  stField.appendChild(stWrap);
  form.appendChild(stField);

  // Description
  const descField = ce('div', 'field');
  descField.appendChild(ce('span', 'field-label', 'Description'));
  const ta = ce('textarea', 'desc-ta'); ta.id = 'ed-desc'; ta.placeholder = 'Describe this step…'; ta.value = s.desc;
  descField.appendChild(ta);
  if (s.busy) {
    const note = ce('div', 'ai-note'); note.id = 'ai-note-' + s.id;
    const sp = ce('span', 'spin'); note.append(sp, document.createTextNode(' AI writing…'));
    descField.appendChild(note);
  }
  form.appendChild(descField);

  // API block
  if (isAPI) {
    const apiField = ce('div', 'field');
    apiField.appendChild(ce('span', 'field-label', 'API Endpoint'));
    const apiBox = ce('div', 'api-box');

    const methSeg = ce('div', 'method-seg');
    ['GET','POST','PUT','PATCH','DELETE'].forEach(m => {
      const b = ce('button', 'meth-btn' + (s.api.method === m ? ' meth-on-' + m : ''), m);
      b.addEventListener('click', () => {
        s.api.method = m;
        methSeg.querySelectorAll('.meth-btn').forEach(x => { x.className = 'meth-btn'; });
        b.className = 'meth-btn meth-on-' + m;
      });
      methSeg.appendChild(b);
    });
    apiBox.appendChild(methSeg);

    const ep = ce('input', 'ep-in'); ep.id = 'ed-ep'; ep.type = 'text'; ep.placeholder = '/api/v1/resource'; ep.value = s.api.endpoint;
    apiBox.appendChild(ce('span', 'api-lbl', 'Request Body'));
    const req = ce('textarea', 'sm-ta'); req.id = 'ed-req'; req.placeholder = '{ "key": "value" }'; req.value = s.api.request;
    apiBox.appendChild(ep);
    apiBox.appendChild(req);
    apiBox.appendChild(ce('span', 'api-lbl', 'Response'));
    const resp = ce('textarea', 'sm-ta'); resp.id = 'ed-resp'; resp.placeholder = '{ "data": "..." }'; resp.value = s.api.response;
    apiBox.appendChild(resp);
    apiField.appendChild(apiBox);
    form.appendChild(apiField);
  }

  // Code block
  const codeField = ce('div', 'field'); codeField.id = 'code-field';
  if (showC) {
    codeField.appendChild(ce('span', 'field-label', 'Code Block'));
    const box = ce('div', 'code-box');
    const hd  = ce('div', 'code-hd');
    const sel = ce('select', 'lang-sel'); sel.id = 'ed-cl';
    LANGS.forEach(l => { const o = ce('option', null, l); o.value = l; if (l === s.code.lang) o.selected = true; sel.appendChild(o); });
    const rmb = ce('button', 'rm-code-btn', 'Remove');
    rmb.addEventListener('click', () => { s.code.show = false; s.code.content = ''; buildForm(s); });
    hd.append(sel, rmb);
    const cta = ce('textarea', 'code-ta'); cta.id = 'ed-cb'; cta.placeholder = 'Paste code…'; cta.spellcheck = false; cta.value = s.code.content;
    box.append(hd, cta);
    codeField.appendChild(box);
  } else {
    const add = ce('button', 'add-code-btn', '💻 Add Code Block');
    add.addEventListener('click', () => { s.code.show = true; buildForm(s); });
    codeField.appendChild(add);
  }
  form.appendChild(codeField);

  // Tags
  const tagsField = ce('div', 'field');
  tagsField.appendChild(ce('span', 'field-label', 'Tags'));
  const tagsWrap = ce('div', 'tags-wrap'); tagsWrap.id = 'tags-wrap';
  s.tags.forEach(t => tagsWrap.appendChild(makeTagChip(s.id, t)));
  const tagIn = ce('input', 'tag-in'); tagIn.id = 'tag-in'; tagIn.placeholder = s.tags.length ? '' : 'Add tags…';
  tagIn.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      const v = tagIn.value.trim().replace(',', '');
      if (v && !s.tags.includes(v)) { s.tags.push(v); tagsWrap.insertBefore(makeTagChip(s.id, v), tagIn); tagIn.value = ''; }
    }
  });
  tagsWrap.appendChild(tagIn);
  tagsWrap.addEventListener('click', () => tagIn.focus());
  tagsField.appendChild(tagsWrap);
  form.appendChild(tagsField);

  // Callout
  const calField = ce('div', 'field');
  const calLbl = ce('span', 'field-label'); calLbl.innerHTML = 'Callout <span style="font-weight:400;color:var(--muted)">(optional)</span>';
  calField.appendChild(calLbl);
  const calRow = ce('div', 'cal-type-row');
  ['info','tip','warning','danger'].forEach(t => {
    const cc = CAL_COLORS[t];
    const b = ce('button', 'cal-type-btn', CALS[t] + ' ' + t);
    b.style.background = cc.bg; b.style.color = cc.color;
    b.style.borderColor = s.calloutType === t ? cc.color : 'transparent';
    b.addEventListener('click', () => {
      flushForm(); s.calloutType = t;
      calRow.querySelectorAll('.cal-type-btn').forEach((x, i) => { x.style.borderColor = Object.keys(CAL_COLORS)[i] === t ? CAL_COLORS[t].color : 'transparent'; });
      calBlock.className = 'cal-block cal-' + t;
      calIcon.textContent = CALS[t];
    });
    calRow.appendChild(b);
  });
  calField.appendChild(calRow);
  const calBlock = ce('div', 'cal-block cal-' + s.calloutType);
  const calIcon = ce('span'); calIcon.style.fontSize = '13px'; calIcon.style.flexShrink = '0'; calIcon.textContent = CALS[s.calloutType];
  const calTa = ce('textarea', 'cal-ta'); calTa.id = 'ed-cal'; calTa.rows = 2; calTa.placeholder = 'Add a note or warning…'; calTa.value = s.callout;
  calBlock.append(calIcon, calTa);
  calField.appendChild(calBlock);
  form.appendChild(calField);

  // Nav
  const nav = ce('div', 'step-nav');
  if (idx > 0) {
    const prev = ce('button', 'btn btn-sm btn-o', '← Prev');
    prev.addEventListener('click', () => pickStep(S.steps[idx - 1].id));
    nav.appendChild(prev);
  }
  const del = ce('button', 'btn btn-xs btn-red', '🗑 Delete');
  del.addEventListener('click', () => { if (!confirm('Delete?')) return; flushForm(); S.steps.splice(idx, 1); S.selId = null; buildRail(); showNoSel(); toast('Deleted'); });
  const dupe = ce('button', 'btn btn-xs btn-o', '⧉ Dupe');
  dupe.addEventListener('click', () => { flushForm(); const c = { ...JSON.parse(JSON.stringify(s)), id: uid() }; S.steps.splice(idx + 1, 0, c); buildRail(); pickStep(c.id); toast('Duplicated'); });
  nav.append(del, dupe);
  if (idx < S.steps.length - 1) {
    const next = ce('button', 'btn btn-xs btn-p', 'Next →');
    next.addEventListener('click', () => pickStep(S.steps[idx + 1].id));
    nav.appendChild(next);
  }
  form.appendChild(nav);

  w.appendChild(form);
}

function makeTagChip(stepId, t) {
  const chip = ce('span', 'tag-chip', t);
  const rm = ce('button', 'tag-rm', '×');
  rm.addEventListener('click', () => {
    const s = S.steps.find(x => x.id === stepId);
    if (s) s.tags = s.tags.filter(x => x !== t);
    chip.remove();
  });
  chip.appendChild(rm);
  return chip;
}

function resetShot(id) {
  if (!confirm('Reset to original?')) return;
  const s = S.steps.find(x => x.id === id); if (!s) return;
  s.shot = s.origShot;
  const img = G('ed-shot'); if (img) img.src = s.shot;
  const th = G('eth-' + id)?.querySelector('.e-thumb'); if (th) th.src = s.shot;
}

function uploadShot(id) {
  const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*';
  inp.addEventListener('change', () => {
    const f = inp.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = e => {
      const s = S.steps.find(x => x.id === id); if (!s) return;
      s.shot = e.target.result;
      const img = G('ed-shot'); if (img) img.src = s.shot;
      const th = G('eth-' + id)?.querySelector('.e-thumb'); if (th) th.src = s.shot;
    };
    fr.readAsDataURL(f);
  });
  inp.click();
}

/* ══════════════════ ANNOTATION ══════════════════ */
function setATool(t) {
  ANN.tool = t;
  document.querySelectorAll('.ann-tool[data-tool]').forEach(b => b.classList.toggle('ann-tool-on', b.dataset.tool === t));
  G('ann-hint').textContent = { highlight:'Drag to highlight', arrow:'Click start then endpoint', text:'Click to place label', blur:'Drag to redact' }[t] || '';
}

function openAnn(id) {
  const s = S.steps.find(x => x.id === id);
  if (!s || !s.shot) { toast('⚠️ No screenshot to annotate'); return; }
  ANN.stepId = id; ANN.base = s.shot; ANN.anns = []; ANN.arrowPt = null;
  setATool('highlight');
  G('ann-overlay').classList.remove('hidden');
  const img = new Image();
  img.onload = () => {
    const c = G('ann-canvas');
    c.width = img.width; c.height = img.height;
    const scale = Math.min((window.innerWidth - 24) / img.width, (window.innerHeight - 140) / img.height, 1);
    c.style.width  = (img.width  * scale) + 'px';
    c.style.height = (img.height * scale) + 'px';
    c.getContext('2d').drawImage(img, 0, 0);
  };
  img.src = s.shot;
}

function closeAnn() { G('ann-overlay').classList.add('hidden'); }

function annXY(e) {
  const c = G('ann-canvas'), r = c.getBoundingClientRect();
  return { x: (e.clientX - r.left) * (c.width / r.width), y: (e.clientY - r.top) * (c.height / r.height) };
}

function annMouseDown(e) {
  const p = annXY(e);
  if (ANN.tool === 'text') {
    const t = prompt('Label text:'); if (!t) return;
    ANN.anns.push({ type:'text', x:p.x, y:p.y, text:t, color:ANN.color });
    redrawAnn(); return;
  }
  if (ANN.tool === 'arrow') {
    if (!ANN.arrowPt) { ANN.arrowPt = p; G('ann-hint').textContent = 'Now click endpoint'; }
    else { ANN.anns.push({ type:'arrow', x1:ANN.arrowPt.x, y1:ANN.arrowPt.y, x2:p.x, y2:p.y, color:ANN.color }); ANN.arrowPt = null; G('ann-hint').textContent = 'Click start then endpoint'; redrawAnn(); }
    return;
  }
  ANN.drawing = true; ANN.ds = p;
}
function annMouseMove(e) {
  if (!ANN.drawing || ANN.tool === 'arrow' || ANN.tool === 'text') return;
  redrawAnn(annXY(e));
}
function annMouseUp(e) {
  if (!ANN.drawing) return; ANN.drawing = false;
  const pe = annXY(e);
  const x = Math.min(ANN.ds.x, pe.x), y = Math.min(ANN.ds.y, pe.y), w = Math.abs(pe.x - ANN.ds.x), h = Math.abs(pe.y - ANN.ds.y);
  if (w > 4 && h > 4) ANN.anns.push({ type:ANN.tool, x, y, w, h, color:ANN.color });
  redrawAnn();
}

function redrawAnn(prev) {
  const c = G('ann-canvas'), ctx = c.getContext('2d'), img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
    const list = [...ANN.anns];
    if (prev && ANN.ds) { const x=Math.min(ANN.ds.x,prev.x),y=Math.min(ANN.ds.y,prev.y),w=Math.abs(prev.x-ANN.ds.x),h=Math.abs(prev.y-ANN.ds.y); list.push({type:ANN.tool,x,y,w,h,color:ANN.color}); }
    list.forEach(a => drawAnn(ctx, a, c.width));
  };
  img.src = ANN.base;
}
function drawAnn(ctx, a, W) {
  ctx.save();
  if (a.type === 'highlight') { ctx.fillStyle=a.color+'55'; ctx.fillRect(a.x,a.y,a.w,a.h); ctx.strokeStyle=a.color; ctx.lineWidth=2; ctx.strokeRect(a.x,a.y,a.w,a.h); }
  else if (a.type === 'blur') { ctx.fillStyle='rgba(15,23,42,.88)'; ctx.fillRect(a.x,a.y,a.w,a.h); }
  else if (a.type === 'arrow') { const l=Math.sqrt((a.x2-a.x1)**2+(a.y2-a.y1)**2),hl=Math.min(22,l*.3),ang=Math.atan2(a.y2-a.y1,a.x2-a.x1); ctx.beginPath(); ctx.moveTo(a.x1,a.y1); ctx.lineTo(a.x2,a.y2); ctx.lineTo(a.x2-hl*Math.cos(ang-Math.PI/6),a.y2-hl*Math.sin(ang-Math.PI/6)); ctx.moveTo(a.x2,a.y2); ctx.lineTo(a.x2-hl*Math.cos(ang+Math.PI/6),a.y2-hl*Math.sin(ang+Math.PI/6)); ctx.strokeStyle=a.color; ctx.lineWidth=Math.max(2,W*.003); ctx.lineJoin='round'; ctx.lineCap='round'; ctx.stroke(); }
  else if (a.type === 'text') { const fs=Math.max(14,W*.018); ctx.font=`bold ${fs}px system-ui`; const m=ctx.measureText(a.text),pd=6; ctx.fillStyle=a.color; ctx.fillRect(a.x-pd,a.y-fs-pd/2,m.width+pd*2,fs+pd*1.4); ctx.fillStyle='#fff'; ctx.fillText(a.text,a.x,a.y); }
  ctx.restore();
}
function undoAnn() { if (ANN.anns.length) { ANN.anns.pop(); redrawAnn(); } }
function clearAnn() { if (!confirm('Clear all?')) return; ANN.anns = []; redrawAnn(); }
function saveAnn() {
  const s = S.steps.find(x => x.id === ANN.stepId); if (!s) return;
  const data = G('ann-canvas').toDataURL('image/jpeg', .93);
  s.shot = data;
  const img = G('ed-shot'); if (img) img.src = data;
  const th = G('eth-' + ANN.stepId)?.querySelector('.e-thumb'); if (th) th.src = data;
  closeAnn(); toast('✓ Annotation saved');
}

/* ══════════════════ EXPORT ══════════════════ */
function openExp()  { G('exp-overlay').classList.remove('hidden'); }
function closeExp() { G('exp-overlay').classList.add('hidden'); }

function pickFmt(f) {
  EO.fmt = f;
  G('fmt-html').classList.toggle('exp-opt-sel', f === 'html');
  G('fmt-md').classList.toggle('exp-opt-sel', f === 'md');
  G('theme-section').style.display = f === 'md' ? 'none' : '';
}
function pickTheme(t) {
  EO.theme = t;
  G('theme-light').classList.toggle('exp-opt-sel', t === 'light');
  G('theme-dark').classList.toggle('exp-opt-sel', t === 'dark');
}

function doExport() {
  if (!S.steps.length) { toast('⚠️ Nothing to export'); return; }
  const title = G('doc-title')?.value.trim() || 'Technical Guide';
  EO.fmt === 'html' ? exportHTML(title) : exportMD(title);
  closeExp();
}

function isOn(id) { return G(id) ? G(id).classList.contains('tog-on') : true; }

function exportHTML(title) {
  const dark = EO.theme === 'dark';
  const date = new Date().toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  const dt   = DT[S.docType];
  const bg=dark?'#0f172a':'#f4f6fb', fg=dark?'#e2e8f0':'#0f172a', card=dark?'#1e293b':'#fff', brd=dark?'#334155':'#e4e9f2';

  let tocHTML = '';
  if (isOn('tog-toc')) {
    tocHTML = '<nav class="toc"><h2>Contents</h2><ul>';
    S.steps.forEach((s,i) => { tocHTML += `<li><a href="#s${s.id}">Step ${i+1}: ${esc(s.desc||'Untitled')}</a></li>`; });
    tocHTML += '</ul></nav>';
  }

  const body = S.steps.map((s, i) => {
    const st = ST[s.stepType];
    let h = `<section class="card" id="s${s.id}"><div class="ct"><div class="sn">Step ${i+1}</div>`;
    if (isOn('tog-types')) h += `<span class="stb">${st.icon} ${st.label}</span>`;
    h += `<span class="sts">@ ${s.ts}</span></div>`;
    if (isOn('tog-shots') && s.shot) h += `<div class="imgf"><img src="${s.shot}" alt="S${i+1}"></div>`;
    if (s.desc) h += `<p class="sd">${esc(s.desc)}</p>`;
    if (s.callout) h += `<div class="cal cal-${s.calloutType}"><span>${CALS[s.calloutType]}</span><span>${esc(s.callout)}</span></div>`;
    if ((S.docType==='api'||s.stepType==='api') && s.api.endpoint) {
      h += `<div class="api"><span class="mt m-${s.api.method}">${s.api.method}</span><code>${esc(s.api.endpoint)}</code></div>`;
      if (isOn('tog-code')) {
        if (s.api.request)  h += `<div class="cw"><div class="cl">REQUEST</div><pre><code>${esc(s.api.request)}</code></pre></div>`;
        if (s.api.response) h += `<div class="cw"><div class="cl">RESPONSE</div><pre><code>${esc(s.api.response)}</code></pre></div>`;
      }
    }
    if (isOn('tog-code') && s.code.content) h += `<div class="cw"><div class="cl">${s.code.lang.toUpperCase()}</div><pre><code class="language-${s.code.lang}">${esc(s.code.content)}</code></pre></div>`;
    if (s.tags.length) h += `<div class="tags">${s.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`;
    return h + `</section>`;
  }).join('');

  const css = `*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:${bg};color:${fg};padding:44px 18px;-webkit-font-smoothing:antialiased}.wrap{max-width:880px;margin:0 auto}.cover{background:linear-gradient(135deg,${dt.color},${dt.color}bb);border-radius:18px;padding:48px;color:#fff;margin-bottom:36px;box-shadow:0 20px 60px ${dt.color}44}.cover h1{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(24px,5vw,46px);font-weight:800;letter-spacing:-1.5px;margin-bottom:12px}.cm{display:flex;gap:10px;flex-wrap:wrap}.cm span{background:rgba(255,255,255,.2);border-radius:100px;padding:4px 12px;font-size:12px}.toc{background:${card};border:1px solid ${brd};border-radius:14px;padding:22px 26px;margin-bottom:28px}.toc h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:800;margin-bottom:10px;color:${dt.color}}.toc ul{list-style:none;display:flex;flex-direction:column;gap:4px}.toc a{font-size:13px;color:${dt.color};text-decoration:none}.card{background:${card};border-radius:14px;padding:26px 28px;margin-bottom:14px;border:1px solid ${brd}}.ct{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}.sn{font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:800;background:linear-gradient(135deg,${dt.color},${dt.color}88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.stb{font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px;border:1px solid ${brd};color:${fg}}.sts{font-family:'Fira Code',monospace;font-size:10px;color:${dark?'#475569':'#94a3b8'};background:${dark?'#0f172a':'#f1f5f9'};padding:2px 8px;border-radius:100px;margin-left:auto}.imgf{padding:8px;background:${dark?'#0f172a':'#f8fafc'};border:1.5px solid ${brd};border-radius:10px;margin-bottom:14px}.imgf img{width:100%;display:block;border-radius:7px;border:1px solid ${brd}}.sd{font-size:15px;line-height:1.72;margin-bottom:12px}.cal{display:flex;gap:8px;padding:9px 12px;border-radius:8px;border-left:2.5px solid;font-size:13px;margin:10px 0}.cal-info{background:${dark?'#1e293b':'#eff6ff'};border-color:#3b82f6}.cal-tip{background:${dark?'#052e16':'#ecfdf5'};border-color:#10b981}.cal-warning{background:${dark?'#451a03':'#fffbeb'};border-color:#f59e0b}.cal-danger{background:${dark?'#450a0a':'#fef2f2'};border-color:#ef4444}.api{display:flex;align-items:center;gap:8px;margin:10px 0;padding:8px 11px;background:${dark?'#0f172a':'#f8fafc'};border:1px solid ${brd};border-radius:8px}.mt{font-family:'Fira Code',monospace;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px}.m-GET{background:#dcfce7;color:#15803d}.m-POST{background:#dbeafe;color:#1d4ed8}.m-PUT{background:#fef3c7;color:#92400e}.m-PATCH{background:#ede9fe;color:#5b21b6}.m-DELETE{background:#fee2e2;color:#b91c1c}.cw{margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid ${dark?'#1e293b':'#e2e8f0'}}.cl{background:#1e293b;color:#94a3b8;font-family:'Fira Code',monospace;font-size:10px;padding:5px 12px;letter-spacing:.5px}pre{background:#0f172a!important;padding:14px;overflow-x:auto}code{font-family:'Fira Code',monospace;font-size:13px}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.tag{background:${dark?'#1e293b':'#eef2ff'};color:${dark?'#94a3b8':'#4338ca'};font-family:'Fira Code',monospace;font-size:11px;padding:2px 7px;border-radius:3px}.foot{text-align:center;margin-top:40px;font-size:12px;color:${dark?'#334155':'#94a3b8'}}`;

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Inter:wght@400;500&family=Fira+Code:wght@400&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"><style>${css}</style></head><body><div class="wrap"><div class="cover"><h1>${esc(title)}</h1><div class="cm"><span>📅 ${date}</span><span>📋 ${S.steps.length} steps</span><span>${dt.icon} ${dt.label}</span></div></div>${tocHTML}${body}<div class="foot">Created with DocuSnap · ${date}</div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"><\/script></body></html>`;
  saveFile(html, 'text/html', title + '.html');
  toast('✅ HTML exported!');
}

function exportMD(title) {
  const date = new Date().toLocaleDateString(); const dt = DT[S.docType];
  let md = `# ${title}\n\n> **Type:** ${dt.label} | **Date:** ${date} | **Steps:** ${S.steps.length}\n\n---\n\n`;
  S.steps.forEach((s, i) => {
    const st = ST[s.stepType];
    md += `### Step ${i+1}: ${s.desc || 'Untitled'}\n\n> ${st.icon} **${st.label}** · \`@ ${s.ts}\`\n\n`;
    if (s.shot) md += `![Step ${i+1}](${s.shot})\n\n`;
    if (s.desc) md += `${s.desc}\n\n`;
    if (s.callout) md += `> ${CALS[s.calloutType]} ${s.callout}\n\n`;
    if (s.api.endpoint) md += `**${s.api.method}** \`${s.api.endpoint}\`\n\n`;
    if (s.api.request)  md += `\`\`\`json\n// Request\n${s.api.request}\n\`\`\`\n\n`;
    if (s.api.response) md += `\`\`\`json\n// Response\n${s.api.response}\n\`\`\`\n\n`;
    if (s.code.content) md += `\`\`\`${s.code.lang}\n${s.code.content}\n\`\`\`\n\n`;
    if (s.tags.length) md += s.tags.map(t => `\`${t}\``).join(' ') + '\n\n';
    md += `---\n\n`;
  });
  saveFile(md, 'text/markdown', title.replace(/\s+/g, '-') + '.md');
  toast('✅ Markdown exported!');
}

function saveFile(content, type, filename) {
  const blob = new Blob([content], { type });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}

/* ══════════════════ TOAST ══════════════════ */
let toastT;
function toast(msg) {
  const el = G('toast'); el.textContent = msg; el.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2500);
}
