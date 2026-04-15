'use strict';

/* ══════════ CONFIG ══════════ */
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
const LANGS = ['javascript','typescript','python','bash','sql','json','yaml','html','css','jsx','go','rust','java','csharp','dockerfile'];
const CALS  = { info:'ℹ️', tip:'💡', warning:'⚠️', danger:'🚨' };
const CAL_COLORS = {
  info:    { bg:'#eff6ff', color:'#1d4ed8' },
  tip:     { bg:'#ecfdf5', color:'#065f46' },
  warning: { bg:'#fffbeb', color:'#92400e' },
  danger:  { bg:'#fef2f2', color:'#b91c1c' },
};

/* ══════════ STATE ══════════ */
const S = {
  screen:'idle', docType:'process', autoMode:true,
  steps:[], selId:null, elapsed:0, timer:null,
  tabId:null, tabUrl:'', tabTitle:'',
};
const EO = { fmt:'html', theme:'light' };

/* ══════════ PORT ══════════ */
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

/* ══════════ HELPERS ══════════ */
const G = id => document.getElementById(id);
const esc = s => String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pad = n => String(n).padStart(2,'0');
const fmt = s => pad(Math.floor(s/60))+':'+pad(s%60);
const uid = ()  => Date.now()+Math.random().toString(36).slice(2,7);
function ce(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls)  el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

/* ══════════ INIT ══════════ */
document.addEventListener('DOMContentLoaded', () => {
  buildDtypeGrid();
  wireStaticButtons();
  setTimeout(fetchTab, 120);
});

function buildDtypeGrid() {
  const grid = G('dtype-grid');
  Object.entries(DT).forEach(([k, d]) => {
    const card = ce('div','dtype-card'+(k==='process'?' sel':''));
    card.style.setProperty('--cc', d.color);
    card.dataset.key = k;
    card.append(
      ce('div','dtype-check','✓'),
      Object.assign(ce('div','dtype-icon'),{textContent:d.icon}),
      ce('div','dtype-name',d.label),
      ce('div','dtype-desc',d.desc)
    );
    card.addEventListener('click', () => selectDocType(k));
    grid.appendChild(card);
  });
}

function wireStaticButtons() {
  G('idle-btn-auto').addEventListener('click',    () => setIdleMode(true));
  G('idle-btn-manual').addEventListener('click',  () => setIdleMode(false));
  G('btn-tab-refresh').addEventListener('click',  fetchTab);
  G('btn-start').addEventListener('click',        startRec);
  G('rec-btn-auto').addEventListener('click',     () => setRecMode(true));
  G('rec-btn-manual').addEventListener('click',   () => setRecMode(false));
  G('btn-cap').addEventListener('click',          manualCap);
  G('btn-stop').addEventListener('click',         stopRec);
  G('btn-back-rec').addEventListener('click',     backToRec);
  G('btn-open-exp').addEventListener('click',     () => { flushForm(); openExp(); });
  G('btn-export').addEventListener('click',       () => { flushForm(); openExp(); });
  G('btn-reset').addEventListener('click',        resetAll);
  G('btn-save-session').addEventListener('click', saveSession);
  G('btn-sessions').addEventListener('click',     openSessions);
  G('btn-sessions-back').addEventListener('click',closeSessions);
  G('btn-exp-back').addEventListener('click',     closeExp);
  G('btn-do-export').addEventListener('click',    doExport);
  G('fmt-html').addEventListener('click',  () => pickFmt('html'));
  G('fmt-pdf').addEventListener('click',   () => pickFmt('pdf'));
  G('fmt-md').addEventListener('click',    () => pickFmt('md'));
  G('fmt-docx').addEventListener('click',  () => pickFmt('docx'));
  G('theme-light').addEventListener('click', () => pickTheme('light'));
  G('theme-dark').addEventListener('click',  () => pickTheme('dark'));
  ['tog-toc','tog-shots','tog-code','tog-types'].forEach(id => {
    G(id).addEventListener('click', () => G(id).classList.toggle('tog-on'));
  });
}

/* ══════════ SCREENS ══════════ */
function showScreen(name) {
  ['screen-idle','screen-rec','screen-editor'].forEach(id => G(id).classList.add('hidden'));
  G('screen-'+name).classList.remove('hidden');
  S.screen = name;
}

/* ══════════ TAB ══════════ */
function fetchTab() { toBg({ type:'getTab' }); }
function renderTabUrl() {
  const el = G('tab-url'); if (!el) return;
  try { el.textContent = new URL(S.tabUrl).hostname || S.tabUrl || 'Unknown'; }
  catch { el.textContent = S.tabUrl || 'Unknown'; }
}

/* ══════════ IDLE ══════════ */
function selectDocType(k) {
  document.querySelectorAll('.dtype-card').forEach(c => c.classList.toggle('sel', c.dataset.key === k));
  S.docType = k;
}
function setIdleMode(auto) {
  S.autoMode = auto;
  G('idle-btn-auto').className   = 'mode-btn' + (auto?' mode-auto-on':'');
  G('idle-btn-manual').className = 'mode-btn' + (auto?'':' mode-manual-on');
}

/* ══════════ RECORDING ══════════ */
function startRec() {
  S.steps=[]; S.elapsed=0; S.selId=null;
  clearInterval(S.timer);
  S.timer = setInterval(() => { S.elapsed++; G('rtimer').textContent = fmt(S.elapsed); }, 1000);
  showScreen('rec');
  renderSteps();
  applyRecMode();
  G('btn-export').classList.remove('hidden');
  G('btn-reset').classList.remove('hidden');
  G('btn-save-session').classList.remove('hidden');
  toBg({ type:'start', auto:S.autoMode });
}

function stopRec() {
  clearInterval(S.timer);
  toBg({ type:'stop' });
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
  toBg({ type:'setMode', auto });
}
function applyRecMode() {
  const a = S.autoMode;
  G('rec-btn-auto').className   = 'rm-btn'+(a?' rm-auto':'');
  G('rec-btn-manual').className = 'rm-btn'+(a?'':' rm-manual');
  const b = G('mode-badge');
  b.textContent = a ? 'AUTO' : 'MANUAL';
  b.className   = 'mode-badge '+(a?'mode-badge-auto':'mode-badge-manual');
}

function manualCap() {
  const btn = G('btn-cap');
  btn.classList.remove('flash'); void btn.offsetWidth; btn.classList.add('flash');
  toBg({ type:'capture' });
}

function resetAll() {
  if (!confirm('Reset everything?')) return;
  S.steps=[]; S.selId=null; clearInterval(S.timer);
  toBg({ type:'stop' });
  showScreen('idle');
  ['btn-export','btn-reset','btn-save-session'].forEach(id => G(id).classList.add('hidden'));
  toast('Reset');
}

/* ══════════ CAPTURE ══════════ */
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
      [{ r:r*2.2, fs:'rgba(249,115,22,.13)', fill:true },
       { r:r*1.35, ss:'rgba(249,115,22,.42)', lw:Math.max(1.5,img.width*.0015), stroke:true },
       { r, fs:'rgba(249,115,22,.2)', fill:true, ss:'#f97316', lw:Math.max(2.5,img.width*.002), stroke:true },
       { r:r*.22, fs:'#ea580c', fill:true }
      ].forEach(o => {
        ctx.beginPath(); ctx.arc(msg.x, msg.y, o.r, 0, Math.PI*2);
        if (o.fill)   { ctx.fillStyle = o.fs; ctx.fill(); }
        if (o.stroke) { ctx.strokeStyle = o.ss; ctx.lineWidth = o.lw; ctx.stroke(); }
      });
      ctx.restore();
    }
    const shot = c.toDataURL('image/jpeg', .92);
    let host = '';
    try { host = new URL(msg.url).hostname; } catch {}
    const step = {
      id:uid(), shot, origShot:shot, desc:'', stepType:'action',
      code:{lang:'javascript',content:'',show:false},
      api:{method:'GET',endpoint:'',request:'',response:''},
      tags:[], callout:'', calloutType:'info',
      ts:fmt(S.elapsed), url:msg.url||'', host,
      el:msg.el||null, busy:true,
    };
    S.steps.push(step);
    renderSteps();
    if (S.screen==='editor') buildRail();
    aiDescribe(step);
  };
  img.src = msg.dataUrl;
}

/* ══════════ RENDER STEPS ══════════ */
function renderSteps() {
  G('rec-ct').textContent = S.steps.length + ' step' + (S.steps.length!==1?'s':'');
  const area = G('steps-area');
  while (area.firstChild) area.removeChild(area.firstChild);
  if (!S.steps.length) {
    const e = ce('div','empty-state');
    e.innerHTML='<div class="ei">🖼️</div><p>Steps appear here automatically.<br>Interact with the page.</p>';
    area.appendChild(e); return;
  }
  S.steps.forEach((s, i) => {
    const card = ce('div','sc'+(s.id===S.selId?' sel':''));
    card.dataset.sid = s.id;
    const iw = ce('div','sc-imgw');
    const im = ce('img','sc-img'); im.src=s.shot; im.alt='S'+(i+1);
    iw.appendChild(im);
    if (s.host) iw.appendChild(ce('div','sc-host',s.host));
    card.appendChild(iw);
    const body = ce('div','sc-body');
    const top  = ce('div','sc-top');
    top.append(ce('span','sc-num','S'+pad(i+1)), Object.assign(ce('span','sc-ts'),{textContent:s.ts,style:'margin-left:auto'}));
    body.appendChild(top);
    const desc = ce('div','sc-desc'+(s.busy?' ai-loading':''));
    desc.dataset.sid = s.id;
    if (s.busy) { desc.appendChild(ce('span','spin')); desc.appendChild(document.createTextNode(' Analyzing…')); }
    else desc.textContent = s.desc || 'Captured';
    body.appendChild(desc);
    if (s.el?.text) body.appendChild(ce('div','sc-el', s.el.tag+' · '+s.el.text));
    card.appendChild(body);
    card.addEventListener('click', () => { S.selId=s.id; renderSteps(); showScreen('editor'); buildRail(); pickStep(s.id); });
    area.appendChild(card);
  });
  area.scrollTop = area.scrollHeight;
}

/* ══════════ AI ══════════ */
async function aiDescribe(step) {
  try {
    const b64 = step.shot.split(',')[1];
    const hint = step.el?.text ? ` User clicked "${step.el.tag}" with text "${step.el.text}".` : '';
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body:JSON.stringify({ model:'claude-sonnet-4-20250514', max_tokens:80,
        messages:[{role:'user',content:[
          {type:'image',source:{type:'base64',media_type:'image/jpeg',data:b64}},
          {type:'text',text:`ONE clear sentence (10–18 words) for a documentation guide.${hint} Orange ring = click point. Start with action verb. ONLY the sentence.`}
        ]}]
      }),
    });
    const d = await res.json();
    step.desc = (d.content?.[0]?.text||'').trim().replace(/^["']|["']$/g,'') || (step.el?.text?`Click "${step.el.text}"`:'Step captured');
  } catch { step.desc = step.el?.text?`Click "${step.el.text}"`:'Step captured'; }
  step.busy = false;
  const n = document.querySelector(`.sc-desc[data-sid="${step.id}"]`);
  if (n) { n.classList.remove('ai-loading'); n.textContent = step.desc; }
  const th = G('eth-'+step.id); if (th) th.title = step.desc;
  if (S.screen==='editor' && S.selId===step.id) {
    const ta = G('ed-desc'); if (ta && !ta.value) ta.value = step.desc;
    G('ai-note-'+step.id)?.remove();
  }
}

/* ══════════ EDITOR RAIL ══════════ */
function buildRail() {
  const rail = G('e-rail');
  while (rail.firstChild) rail.removeChild(rail.firstChild);
  S.steps.forEach((s, i) => {
    const w = ce('div','e-thumb-wrap'+(s.id===S.selId?' sel':''));
    w.id = 'eth-'+s.id; w.title = s.desc||'Step '+(i+1);
    const n = ce('div','e-thumb-n','S'+pad(i+1));
    const img = ce('img','e-thumb'); img.src=s.shot; img.alt='S'+(i+1);
    w.append(n,img);
    w.addEventListener('click', () => pickStep(s.id));
    rail.appendChild(w);
  });
}

/* ══════════ EDITOR FORM ══════════ */
function showNoSel() {
  const w = G('e-form-wrap'); w.innerHTML='';
  const ns = ce('div','no-sel');
  ns.innerHTML='<div class="no-sel-icon">✦</div><p>Select a step</p>';
  w.appendChild(ns);
}

function flushForm() {
  if (!S.selId) return;
  const s = S.steps.find(x=>x.id===S.selId); if (!s) return;
  const v = id => G(id)?G(id).value:null;
  if (v('ed-desc') !==null) s.desc          = v('ed-desc');
  if (v('ed-cb')   !==null) s.code.content  = v('ed-cb');
  if (v('ed-cl')   !==null) s.code.lang     = v('ed-cl');
  if (v('ed-ep')   !==null) s.api.endpoint  = v('ed-ep');
  if (v('ed-req')  !==null) s.api.request   = v('ed-req');
  if (v('ed-resp') !==null) s.api.response  = v('ed-resp');
  if (v('ed-cal')  !==null) s.callout       = v('ed-cal');
}

function pickStep(id) {
  flushForm(); S.selId = id;
  document.querySelectorAll('.e-thumb-wrap').forEach(e=>e.classList.toggle('sel',e.id==='eth-'+id));
  const s = S.steps.find(x=>x.id===id);
  if (!s) { showNoSel(); return; }
  buildForm(s);
  G('eth-'+id)?.scrollIntoView({block:'nearest',behavior:'smooth'});
}

function buildForm(s) {
  const idx   = S.steps.indexOf(s);
  const isAPI = S.docType==='api' || s.stepType==='api';
  const showC = S.docType==='docascode' || s.stepType==='code' || s.code.show;
  const w = G('e-form-wrap'); w.innerHTML='';
  const form = ce('div','e-form');

  form.appendChild(ce('span','e-meta',`STEP ${idx+1}/${S.steps.length} · ${s.host||'–'} · ${s.ts}`));

  // Screenshot
  const sc = ce('div','shot-card');
  if (s.shot) { const im=ce('img','shot-img'); im.id='ed-shot'; im.src=s.shot; sc.appendChild(im); }
  else { const ph=ce('div'); ph.style.cssText='aspect-ratio:16/9;background:var(--bg);border-radius:7px;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:12px'; ph.textContent='No screenshot'; sc.appendChild(ph); }
  const sb = ce('div','shot-btns');
  const ba=ce('button','shot-btn','✏️ Annotate'); ba.addEventListener('click',()=>openAnnotateWindow(s.id));
  const br=ce('button','shot-btn','↩ Reset');     br.addEventListener('click',()=>resetShot(s.id));
  const bu=ce('button','shot-btn','📁 Replace');  bu.addEventListener('click',()=>uploadShot(s.id));
  sb.append(ba,br,bu); sc.appendChild(sb); form.appendChild(sc);

  // Step type
  const stF = ce('div','field');
  stF.appendChild(ce('span','field-label','Step Type'));
  const stW = ce('div','stype-wrap');
  Object.entries(ST).forEach(([k,v]) => {
    const b = ce('button','st-btn'+(s.stepType===k?' st-'+k:''), v.icon+' '+v.label);
    b.addEventListener('click',()=>{ flushForm(); s.stepType=k; buildRail(); buildForm(s); });
    stW.appendChild(b);
  });
  stF.appendChild(stW); form.appendChild(stF);

  // Description
  const df = ce('div','field');
  df.appendChild(ce('span','field-label','Description'));
  const ta=ce('textarea','desc-ta'); ta.id='ed-desc'; ta.placeholder='Describe this step…'; ta.value=s.desc;
  df.appendChild(ta);
  if (s.busy) { const note=ce('div','ai-note'); note.id='ai-note-'+s.id; const sp=ce('span','spin'); note.append(sp,document.createTextNode(' AI writing…')); df.appendChild(note); }
  form.appendChild(df);

  // API
  if (isAPI) {
    const af = ce('div','field'); af.appendChild(ce('span','field-label','API Endpoint'));
    const ab = ce('div','api-box');
    const ms = ce('div','method-seg');
    ['GET','POST','PUT','PATCH','DELETE'].forEach(m => {
      const b=ce('button','meth-btn'+(s.api.method===m?' meth-on-'+m:''),m);
      b.addEventListener('click',()=>{ s.api.method=m; ms.querySelectorAll('.meth-btn').forEach(x=>{x.className='meth-btn';}); b.className='meth-btn meth-on-'+m; });
      ms.appendChild(b);
    });
    const ep=ce('input','ep-in'); ep.id='ed-ep'; ep.type='text'; ep.placeholder='/api/v1/resource'; ep.value=s.api.endpoint;
    const rq=ce('textarea','sm-ta'); rq.id='ed-req'; rq.placeholder='{ "key": "value" }'; rq.value=s.api.request;
    const rp=ce('textarea','sm-ta'); rp.id='ed-resp'; rp.placeholder='{ "data": "..." }'; rp.value=s.api.response;
    ab.append(ms,ep,ce('span','api-lbl','Request Body'),rq,ce('span','api-lbl','Response'),rp);
    af.appendChild(ab); form.appendChild(af);
  }

  // Code
  const cf = ce('div','field'); cf.id='code-field';
  if (showC) {
    cf.appendChild(ce('span','field-label','Code Block'));
    const box=ce('div','code-box');
    const hd=ce('div','code-hd');
    const sel=ce('select','lang-sel'); sel.id='ed-cl';
    LANGS.forEach(l=>{ const o=ce('option',null,l); o.value=l; if(l===s.code.lang) o.selected=true; sel.appendChild(o); });
    const rm=ce('button','rm-code-btn','Remove'); rm.addEventListener('click',()=>{ s.code.show=false; s.code.content=''; buildForm(s); });
    hd.append(sel,rm);
    const cta=ce('textarea','code-ta'); cta.id='ed-cb'; cta.placeholder='Paste code…'; cta.spellcheck=false; cta.value=s.code.content;
    box.append(hd,cta); cf.appendChild(box);
  } else {
    const add=ce('button','add-code-btn','💻 Add Code Block');
    add.addEventListener('click',()=>{ s.code.show=true; buildForm(s); });
    cf.appendChild(add);
  }
  form.appendChild(cf);

  // Tags
  const tf = ce('div','field'); tf.appendChild(ce('span','field-label','Tags'));
  const tw = ce('div','tags-wrap'); tw.id='tags-wrap';
  s.tags.forEach(t=>tw.appendChild(makeTagChip(s.id,t)));
  const tin=ce('input','tag-in'); tin.id='tag-in'; tin.placeholder=s.tags.length?'':'Add tags…';
  tin.addEventListener('keydown',e=>{ if(e.key==='Enter'||e.key===','){ e.preventDefault(); const v=tin.value.trim().replace(',',''); if(v&&!s.tags.includes(v)){s.tags.push(v);tw.insertBefore(makeTagChip(s.id,v),tin);tin.value='';} } });
  tw.append(tin); tw.addEventListener('click',()=>tin.focus());
  tf.appendChild(tw); form.appendChild(tf);

  // Callout
  const calf = ce('div','field');
  const clbl = ce('span','field-label'); clbl.innerHTML='Callout <span style="font-weight:400;color:var(--muted)">(optional)</span>';
  calf.appendChild(clbl);
  const cr = ce('div','cal-type-row');
  ['info','tip','warning','danger'].forEach(t => {
    const cc=CAL_COLORS[t];
    const b=ce('button','cal-type-btn',CALS[t]+' '+t);
    b.style.background=cc.bg; b.style.color=cc.color; b.style.borderColor=s.calloutType===t?cc.color:'transparent';
    b.addEventListener('click',()=>{
      flushForm(); s.calloutType=t;
      cr.querySelectorAll('.cal-type-btn').forEach((x,i)=>{ const tt=Object.keys(CAL_COLORS)[i]; x.style.borderColor=tt===t?CAL_COLORS[t].color:'transparent'; });
      calBlock.className='cal-block cal-'+t; calIco.textContent=CALS[t];
    });
    cr.appendChild(b);
  });
  calf.appendChild(cr);
  const calBlock=ce('div','cal-block cal-'+s.calloutType);
  const calIco=ce('span'); calIco.style.cssText='font-size:13px;flex-shrink:0'; calIco.textContent=CALS[s.calloutType];
  const calTa=ce('textarea','cal-ta'); calTa.id='ed-cal'; calTa.rows=2; calTa.placeholder='Add a note or warning…'; calTa.value=s.callout;
  calBlock.append(calIco,calTa); calf.appendChild(calBlock); form.appendChild(calf);

  // Nav
  const nav=ce('div','step-nav');
  if(idx>0){ const b=ce('button','btn btn-sm btn-o','← Prev'); b.addEventListener('click',()=>pickStep(S.steps[idx-1].id)); nav.appendChild(b); }
  const del=ce('button','btn btn-xs btn-red','🗑 Delete');
  del.addEventListener('click',()=>{ if(!confirm('Delete?'))return; flushForm(); S.steps.splice(idx,1); S.selId=null; buildRail(); showNoSel(); toast('Deleted'); });
  const dup=ce('button','btn btn-xs btn-o','⧉ Dupe');
  dup.addEventListener('click',()=>{ flushForm(); const c={...JSON.parse(JSON.stringify(s)),id:uid()}; S.steps.splice(idx+1,0,c); buildRail(); pickStep(c.id); toast('Duplicated'); });
  nav.append(del,dup);
  if(idx<S.steps.length-1){ const b=ce('button','btn btn-xs btn-p','Next →'); b.addEventListener('click',()=>pickStep(S.steps[idx+1].id)); nav.appendChild(b); }
  form.appendChild(nav);
  w.appendChild(form);
}

function makeTagChip(stepId, t) {
  const chip=ce('span','tag-chip',t);
  const rm=ce('button','tag-rm','×');
  rm.addEventListener('click',()=>{ const s=S.steps.find(x=>x.id===stepId); if(s) s.tags=s.tags.filter(x=>x!==t); chip.remove(); });
  chip.appendChild(rm); return chip;
}

function resetShot(id) {
  if(!confirm('Reset to original?')) return;
  const s=S.steps.find(x=>x.id===id); if(!s) return;
  s.shot=s.origShot;
  const img=G('ed-shot'); if(img) img.src=s.shot;
  G('eth-'+id)?.querySelector('.e-thumb')&&(G('eth-'+id).querySelector('.e-thumb').src=s.shot);
}
function uploadShot(id) {
  const inp=document.createElement('input'); inp.type='file'; inp.accept='image/*';
  inp.addEventListener('change',()=>{ const f=inp.files[0]; if(!f) return; const fr=new FileReader(); fr.onload=e=>{ const s=S.steps.find(x=>x.id===id); if(!s) return; s.shot=s.origShot=e.target.result; const img=G('ed-shot'); if(img) img.src=s.shot; G('eth-'+id)?.querySelector('.e-thumb')&&(G('eth-'+id).querySelector('.e-thumb').src=s.shot); }; fr.readAsDataURL(f); });
  inp.click();
}

/* ══════════ ANNOTATION POPUP ══════════ */
let annCh = null;
let annWin = null;

function openAnnotateWindow(id) {
  const s = S.steps.find(x=>x.id===id);
  if (!s||!s.shot) { toast('⚠️ No screenshot to annotate'); return; }
  const w=800, h=620;
  const left=Math.round((screen.width-w)/2), top=Math.round((screen.height-h)/2);
  annWin = window.open(chrome.runtime.getURL('annotate.html'), 'ds_ann', `width=${w},height=${h},left=${left},top=${top},resizable=yes`);
  if (!annWin) { toast('⚠️ Allow popups for this extension'); return; }

  if (annCh) try { annCh.close(); } catch (_) {}
  annCh = new BroadcastChannel('ds_annotate');
  annCh.onmessage = e => {
    if (e.data.type === 'ann_ready') {
      annCh.postMessage({ type:'ann_init', src:s.shot });
    }
    if (e.data.type === 'ann_result') {
      s.shot = e.data.data;
      const img=G('ed-shot'); if(img) img.src=s.shot;
      G('eth-'+id)?.querySelector('.e-thumb')&&(G('eth-'+id).querySelector('.e-thumb').src=s.shot);
      toast('✓ Annotation saved');
      try { annCh.close(); } catch (_) {} annCh=null;
    }
    if (e.data.type === 'ann_cancel') {
      try { annCh.close(); } catch (_) {} annCh=null;
    }
  };
}

/* ══════════ SESSIONS (save / load) ══════════ */
function saveSession() {
  flushForm();
  if (!S.steps.length) { toast('⚠️ Nothing to save'); return; }
  const title = G('doc-title')?.value.trim() || 'Untitled Session';
  const session = {
    id: uid(),
    title,
    docType: S.docType,
    steps: S.steps,
    savedAt: new Date().toISOString(),
    stepCount: S.steps.length,
  };
  chrome.storage.local.get(['ds_sessions'], r => {
    const list = (r.ds_sessions || []);
    list.unshift(session);
    if (list.length > 30) list.splice(30);
    chrome.storage.local.set({ ds_sessions: list }, () => toast('💾 Session saved'));
  });
}

function openSessions() {
  G('sessions-overlay').classList.remove('hidden');
  const body = G('sessions-body');
  while (body.firstChild) body.removeChild(body.firstChild);
  const emp = ce('div','empty-state'); emp.innerHTML='<div class="ei">⏳</div><p>Loading…</p>';
  body.appendChild(emp);
  chrome.storage.local.get(['ds_sessions'], r => {
    const list = r.ds_sessions || [];
    while (body.firstChild) body.removeChild(body.firstChild);
    if (!list.length) {
      const e2=ce('div','empty-state'); e2.innerHTML='<div class="ei">📂</div><p>No saved sessions yet.<br>Click 💾 Save to save your work.</p>';
      body.appendChild(e2); return;
    }
    list.forEach(sess => {
      const dt = DT[sess.docType] || DT.process;
      const card = ce('div','session-card');
      card.appendChild(Object.assign(ce('div','session-icon'),{textContent:dt.icon}));
      const info = ce('div','session-info');
      info.appendChild(ce('div','session-title',sess.title));
      const meta = ce('div','session-meta');
      meta.innerHTML=`<span>📋 ${sess.stepCount||sess.steps?.length||0} steps</span><span>📅 ${new Date(sess.savedAt).toLocaleDateString()}</span><span>${dt.label}</span>`;
      info.appendChild(meta); card.appendChild(info);
      const del=ce('button','session-del','🗑');
      del.title='Delete session';
      del.addEventListener('click', e => {
        e.stopPropagation();
        if(!confirm('Delete this session?')) return;
        chrome.storage.local.get(['ds_sessions'], r2 => {
          const updated=(r2.ds_sessions||[]).filter(x=>x.id!==sess.id);
          chrome.storage.local.set({ds_sessions:updated},()=>{ card.remove(); toast('Session deleted'); });
        });
      });
      card.appendChild(del);
      card.addEventListener('click', () => loadSession(sess));
      body.appendChild(card);
    });
  });
}
function closeSessions() { G('sessions-overlay').classList.add('hidden'); }

function loadSession(sess) {
  if (S.steps.length && !confirm('Load this session? Current unsaved steps will be lost.')) return;
  S.steps = sess.steps || [];
  S.docType = sess.docType || 'process';
  S.selId = null;
  selectDocType(S.docType);
  closeSessions();
  if (G('doc-title')) G('doc-title').value = sess.title || '';
  showScreen('editor');
  buildRail();
  showNoSel();
  G('btn-export').classList.remove('hidden');
  G('btn-reset').classList.remove('hidden');
  G('btn-save-session').classList.remove('hidden');
  toast('✅ Session loaded');
}

/* ══════════ EXPORT ══════════ */
function openExp()  { G('exp-overlay').classList.remove('hidden'); }
function closeExp() { G('exp-overlay').classList.add('hidden'); }

function pickFmt(f) {
  EO.fmt = f;
  ['html','pdf','md','docx'].forEach(x => G('fmt-'+x).classList.toggle('exp-opt-sel', x===f));
  G('theme-section').style.display = (f==='md'||f==='docx') ? 'none' : '';
}
function pickTheme(t) {
  EO.theme = t;
  G('theme-light').classList.toggle('exp-opt-sel', t==='light');
  G('theme-dark').classList.toggle('exp-opt-sel',  t==='dark');
}

function doExport() {
  flushForm();
  if (!S.steps.length) { toast('⚠️ Nothing to export'); return; }
  const title = G('doc-title')?.value.trim() || 'Technical Guide';
  if      (EO.fmt==='html') exportHTML(title);
  else if (EO.fmt==='pdf')  exportPDF(title);
  else if (EO.fmt==='md')   exportMD(title);
  else if (EO.fmt==='docx') exportDOCX(title);
  closeExp();
}

const isOn = id => G(id)?G(id).classList.contains('tog-on'):true;

/* ── HTML Export ── */
function exportHTML(title) {
  const dark=EO.theme==='dark';
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  const dt=DT[S.docType];
  const bg=dark?'#0f172a':'#f4f6fb', fg=dark?'#e2e8f0':'#0f172a', card=dark?'#1e293b':'#fff', brd=dark?'#334155':'#e4e9f2';

  let toc='';
  if(isOn('tog-toc')){toc='<nav class="toc"><h2>Contents</h2><ul>';S.steps.forEach((s,i)=>{toc+=`<li><a href="#s${s.id}">Step ${i+1}: ${esc(s.desc||'Untitled')}</a></li>`;});toc+='</ul></nav>';}

  const body=S.steps.map((s,i)=>{
    const st=ST[s.stepType]; let h=`<section class="card" id="s${s.id}"><div class="ct"><div class="sn">Step ${i+1}</div>`;
    if(isOn('tog-types'))h+=`<span class="stb">${st.icon} ${st.label}</span>`;
    h+=`<span class="sts">@ ${s.ts}</span></div>`;
    if(isOn('tog-shots')&&s.shot)h+=`<div class="imgf"><img src="${s.shot}" alt="S${i+1}"></div>`;
    if(s.desc)h+=`<p class="sd">${esc(s.desc)}</p>`;
    if(s.callout)h+=`<div class="cal cal-${s.calloutType}"><span>${CALS[s.calloutType]}</span><span>${esc(s.callout)}</span></div>`;
    if((S.docType==='api'||s.stepType==='api')&&s.api.endpoint){
      h+=`<div class="api"><span class="mt m-${s.api.method}">${s.api.method}</span><code>${esc(s.api.endpoint)}</code></div>`;
      if(isOn('tog-code')){if(s.api.request)h+=`<div class="cw"><div class="cl">REQUEST</div><pre><code>${esc(s.api.request)}</code></pre></div>`;if(s.api.response)h+=`<div class="cw"><div class="cl">RESPONSE</div><pre><code>${esc(s.api.response)}</code></pre></div>`;}
    }
    if(isOn('tog-code')&&s.code.content)h+=`<div class="cw"><div class="cl">${s.code.lang.toUpperCase()}</div><pre><code class="language-${s.code.lang}">${esc(s.code.content)}</code></pre></div>`;
    if(s.tags.length)h+=`<div class="tags">${s.tags.map(t=>`<span class="tag">${esc(t)}</span>`).join('')}</div>`;
    return h+`</section>`;
  }).join('');

  const css=`*{box-sizing:border-box;margin:0;padding:0}body{font-family:'Inter',sans-serif;background:${bg};color:${fg};padding:44px 18px;-webkit-font-smoothing:antialiased}.wrap{max-width:880px;margin:0 auto}.cover{background:linear-gradient(135deg,${dt.color},${dt.color}bb);border-radius:18px;padding:48px;color:#fff;margin-bottom:36px;box-shadow:0 20px 60px ${dt.color}44}.cover h1{font-family:'Plus Jakarta Sans',sans-serif;font-size:clamp(24px,5vw,46px);font-weight:800;letter-spacing:-1.5px;margin-bottom:12px}.cm{display:flex;gap:10px;flex-wrap:wrap}.cm span{background:rgba(255,255,255,.2);border-radius:100px;padding:4px 12px;font-size:12px}.toc{background:${card};border:1px solid ${brd};border-radius:14px;padding:22px 26px;margin-bottom:28px}.toc h2{font-family:'Plus Jakarta Sans',sans-serif;font-size:14px;font-weight:800;margin-bottom:10px;color:${dt.color}}.toc ul{list-style:none;display:flex;flex-direction:column;gap:4px}.toc a{font-size:13px;color:${dt.color};text-decoration:none}.card{background:${card};border-radius:14px;padding:26px 28px;margin-bottom:14px;border:1px solid ${brd}}.ct{display:flex;align-items:center;gap:9px;margin-bottom:14px;flex-wrap:wrap}.sn{font-family:'Plus Jakarta Sans',sans-serif;font-size:19px;font-weight:800;background:linear-gradient(135deg,${dt.color},${dt.color}88);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}.stb{font-family:'Plus Jakarta Sans',sans-serif;font-size:10px;font-weight:700;padding:2px 7px;border-radius:100px;border:1px solid ${brd};color:${fg}}.sts{font-family:'Fira Code',monospace;font-size:10px;color:${dark?'#475569':'#94a3b8'};background:${dark?'#0f172a':'#f1f5f9'};padding:2px 8px;border-radius:100px;margin-left:auto}.imgf{padding:8px;background:${dark?'#0f172a':'#f8fafc'};border:1.5px solid ${brd};border-radius:10px;margin-bottom:14px}.imgf img{width:100%;display:block;border-radius:7px;border:1px solid ${brd}}.sd{font-size:15px;line-height:1.72;margin-bottom:12px}.cal{display:flex;gap:8px;padding:9px 12px;border-radius:8px;border-left:2.5px solid;font-size:13px;margin:10px 0}.cal-info{background:${dark?'#1e293b':'#eff6ff'};border-color:#3b82f6}.cal-tip{background:${dark?'#052e16':'#ecfdf5'};border-color:#10b981}.cal-warning{background:${dark?'#451a03':'#fffbeb'};border-color:#f59e0b}.cal-danger{background:${dark?'#450a0a':'#fef2f2'};border-color:#ef4444}.api{display:flex;align-items:center;gap:8px;margin:10px 0;padding:8px 11px;background:${dark?'#0f172a':'#f8fafc'};border:1px solid ${brd};border-radius:8px}.mt{font-family:'Fira Code',monospace;font-size:11px;font-weight:700;padding:2px 7px;border-radius:4px}.m-GET{background:#dcfce7;color:#15803d}.m-POST{background:#dbeafe;color:#1d4ed8}.m-PUT{background:#fef3c7;color:#92400e}.m-PATCH{background:#ede9fe;color:#5b21b6}.m-DELETE{background:#fee2e2;color:#b91c1c}.cw{margin:8px 0;border-radius:8px;overflow:hidden;border:1px solid ${dark?'#1e293b':'#e2e8f0'}}.cl{background:#1e293b;color:#94a3b8;font-family:'Fira Code',monospace;font-size:10px;padding:5px 12px;letter-spacing:.5px}pre{background:#0f172a!important;padding:14px;overflow-x:auto}code{font-family:'Fira Code',monospace;font-size:13px}.tags{display:flex;gap:5px;flex-wrap:wrap;margin-top:10px}.tag{background:${dark?'#1e293b':'#eef2ff'};color:${dark?'#94a3b8':'#4338ca'};font-family:'Fira Code',monospace;font-size:11px;padding:2px 7px;border-radius:3px}.foot{text-align:center;margin-top:40px;font-size:12px;color:${dark?'#334155':'#94a3b8'}}`;
  const html=`<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;700;800&family=Inter:wght@400;500&family=Fira+Code:wght@400&display=swap" rel="stylesheet"><link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/themes/prism-tomorrow.min.css"><style>${css}</style></head><body><div class="wrap"><div class="cover"><h1>${esc(title)}</h1><div class="cm"><span>📅 ${date}</span><span>📋 ${S.steps.length} steps</span><span>${DT[S.docType].icon} ${DT[S.docType].label}</span></div></div>${toc}${body}<div class="foot">Created with DocuSnap · ${date}</div></div><script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/components/prism-core.min.js"><\/script><script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.29.0/plugins/autoloader/prism-autoloader.min.js"><\/script></body></html>`;
  saveFile(html,'text/html',title+'.html');
  toast('✅ HTML exported!');
}

/* ── PDF Export (jsPDF) ── */
function exportPDF(title) {
  if (!window.jspdf) { toast('⚠️ PDF library not loaded yet, try again'); return; }
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ orientation:'portrait', unit:'mm', format:'a4' });
  const dt  = DT[S.docType];
  const pw  = 210, ph = 297;
  const ml=15, mr=15, mt=20;
  const cw  = pw - ml - mr;
  let y = mt;

  // Cover band
  doc.setFillColor(99,102,241);
  doc.rect(0, 0, pw, 50, 'F');
  doc.setTextColor(255,255,255);
  doc.setFontSize(22); doc.setFont('helvetica','bold');
  doc.text(title, ml, 24);
  doc.setFontSize(10); doc.setFont('helvetica','normal');
  const date = new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
  doc.text(`${dt.icon} ${dt.label}   ·   ${S.steps.length} steps   ·   ${date}`, ml, 34);
  doc.setTextColor(0,0,0);
  y = 62;

  S.steps.forEach((s, i) => {
    const st = ST[s.stepType];
    const pageH = doc.internal.pageSize.getHeight();

    // Step header
    if (y + 14 > pageH - 15) { doc.addPage(); y = mt; }
    doc.setFillColor(238,242,255);
    doc.roundedRect(ml, y, cw, 10, 2, 2, 'F');
    doc.setFontSize(11); doc.setFont('helvetica','bold');
    doc.setTextColor(67,56,202);
    doc.text(`Step ${i+1}  ${st.icon} ${st.label}`, ml+4, y+6.8);
    doc.setFontSize(8); doc.setFont('helvetica','normal');
    doc.setTextColor(148,163,184);
    doc.text(`@ ${s.ts}`, ml+cw-12, y+6.8);
    doc.setTextColor(0,0,0);
    y += 14;

    // Screenshot
    if (isOn('tog-shots') && s.shot) {
      try {
        const imgH = Math.round(cw * (9/16));
        if (y + imgH + 4 > pageH - 15) { doc.addPage(); y = mt; }
        doc.addImage(s.shot, 'JPEG', ml, y, cw, imgH);
        y += imgH + 4;
      } catch (_) {}
    }

    // Description
    if (s.desc) {
      if (y + 12 > pageH - 15) { doc.addPage(); y = mt; }
      doc.setFontSize(10); doc.setFont('helvetica','normal');
      doc.setTextColor(30,30,30);
      const lines = doc.splitTextToSize(s.desc, cw);
      doc.text(lines, ml, y);
      y += lines.length * 5 + 3;
    }

    // Callout
    if (s.callout) {
      if (y + 12 > pageH - 15) { doc.addPage(); y = mt; }
      const cc = { info:[239,246,255], tip:[236,253,245], warning:[255,251,235], danger:[254,242,242] }[s.calloutType] || [239,246,255];
      const calH = 10;
      doc.setFillColor(...cc);
      doc.roundedRect(ml, y, cw, calH, 2, 2, 'F');
      doc.setFontSize(9); doc.setFont('helvetica','italic');
      doc.setTextColor(70,70,70);
      const calLines = doc.splitTextToSize(CALS[s.calloutType]+' '+s.callout, cw-6);
      doc.text(calLines, ml+3, y+6.5);
      y += calH + 4;
    }

    // Code
    if (isOn('tog-code') && s.code.content) {
      if (y + 14 > pageH - 15) { doc.addPage(); y = mt; }
      const lines = s.code.content.split('\n').slice(0, 20);
      const codeH = lines.length * 4.5 + 10;
      doc.setFillColor(15,23,42);
      doc.roundedRect(ml, y, cw, codeH, 2, 2, 'F');
      doc.setFontSize(8); doc.setFont('courier','normal');
      doc.setTextColor(226,232,240);
      lines.forEach((line, li) => { if(y+8+li*4.5 < pageH-15) doc.text(line.slice(0,90), ml+3, y+8+li*4.5); });
      doc.setTextColor(0,0,0);
      y += codeH + 4;
    }

    y += 6; // gap between steps
  });

  doc.save(title.replace(/\s+/g,'-')+'.pdf');
  toast('✅ PDF exported!');
}

/* ── Markdown Export ── */
function exportMD(title) {
  const date=new Date().toLocaleDateString(); const dt=DT[S.docType];
  let md=`# ${title}\n\n> **Type:** ${dt.label} | **Date:** ${date} | **Steps:** ${S.steps.length}\n\n---\n\n`;
  S.steps.forEach((s,i)=>{
    const st=ST[s.stepType];
    md+=`### Step ${i+1}: ${s.desc||'Untitled'}\n\n> ${st.icon} **${st.label}** · \`@ ${s.ts}\`\n\n`;
    if(s.shot)md+=`![Step ${i+1}](${s.shot})\n\n`;
    if(s.desc)md+=`${s.desc}\n\n`;
    if(s.callout)md+=`> ${CALS[s.calloutType]} ${s.callout}\n\n`;
    if(s.api.endpoint)md+=`**${s.api.method}** \`${s.api.endpoint}\`\n\n`;
    if(s.api.request)md+=`\`\`\`json\n// Request\n${s.api.request}\n\`\`\`\n\n`;
    if(s.api.response)md+=`\`\`\`json\n// Response\n${s.api.response}\n\`\`\`\n\n`;
    if(s.code.content)md+=`\`\`\`${s.code.lang}\n${s.code.content}\n\`\`\`\n\n`;
    if(s.tags.length)md+=s.tags.map(t=>`\`${t}\``).join(' ')+'\n\n';
    md+=`---\n\n`;
  });
  saveFile(md,'text/markdown',title.replace(/\s+/g,'-')+'.md');
  toast('✅ Markdown exported!');
}

/* ── DOCX Export (Office Open XML) ── */
function exportDOCX(title) {
  const dt=DT[S.docType];
  const date=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});

  // Build paragraphs as WordprocessingML XML
  let bodyXml = `
  <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escXml(title)}</w:t></w:r></w:p>
  <w:p><w:r><w:rPr><w:color w:val="6B7280"/><w:sz w:val="18"/></w:rPr><w:t>${escXml(dt.label+' · '+S.steps.length+' steps · '+date)}</w:t></w:r></w:p>
  <w:p><w:r><w:t></w:t></w:r></w:p>`;

  S.steps.forEach((s,i)=>{
    const st=ST[s.stepType];
    // Step heading
    bodyXml+=`<w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Step ${i+1}: ${escXml(s.desc||'Untitled')}</w:t></w:r></w:p>`;
    // Meta line
    bodyXml+=`<w:p><w:r><w:rPr><w:color w:val="6366F1"/><w:sz w:val="18"/><w:b/></w:rPr><w:t>${escXml(st.icon+' '+st.label+' · @ '+s.ts)}</w:t></w:r></w:p>`;
    // Description
    if(s.desc)bodyXml+=`<w:p><w:r><w:t>${escXml(s.desc)}</w:t></w:r></w:p>`;
    // Callout
    if(s.callout)bodyXml+=`<w:p><w:r><w:rPr><w:i/><w:color w:val="374151"/></w:rPr><w:t>${escXml(CALS[s.calloutType]+' '+s.callout)}</w:t></w:r></w:p>`;
    // API
    if(s.api.endpoint)bodyXml+=`<w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="18"/></w:rPr><w:t>${escXml(s.api.method+' '+s.api.endpoint)}</w:t></w:r></w:p>`;
    if(s.api.request)bodyXml+=`<w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="16"/><w:color w:val="374151"/></w:rPr><w:t>${escXml(s.api.request)}</w:t></w:r></w:p>`;
    // Code
    if(s.code.content)bodyXml+=`<w:p><w:r><w:rPr><w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/><w:sz w:val="16"/><w:color w:val="374151"/></w:rPr><w:t xml:space="preserve">${escXml(s.code.content)}</w:t></w:r></w:p>`;
    // Tags
    if(s.tags.length)bodyXml+=`<w:p><w:r><w:rPr><w:color w:val="4338CA"/><w:sz w:val="16"/></w:rPr><w:t>${escXml(s.tags.map(t=>'#'+t).join(' '))}</w:t></w:r></w:p>`;
    bodyXml+=`<w:p><w:r><w:t></w:t></w:r></w:p>`;
  });

  const docXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
  xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
  xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<w:body>
${bodyXml}
<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440"/></w:sectPr>
</w:body>
</w:document>`;

  const stylesXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:style w:type="paragraph" w:styleId="Normal"><w:name w:val="Normal"/><w:rPr><w:sz w:val="22"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/><w:color w:val="1E293B"/></w:rPr></w:style>
<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="28"/><w:color w:val="4338CA"/></w:rPr></w:style>
</w:styles>`;

  const relsXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

  const appXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>DocuSnap</Application></Properties>`;

  const coreXml=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:title>${escXml(title)}</dc:title><dc:creator>DocuSnap</dc:creator>
</cp:coreProperties>`;

  const contentTypes=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml"  ContentType="application/xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
<Override PartName="/word/styles.xml"   ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
<Override PartName="/docProps/app.xml"  ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

  const rootRels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/>
</Relationships>`;

  // Build zip manually using a minimal zip writer
  buildDocxZip({
    '[Content_Types].xml': contentTypes,
    '_rels/.rels': rootRels,
    'word/document.xml': docXml,
    'word/styles.xml': stylesXml,
    'word/_rels/document.xml.rels': relsXml,
    'docProps/app.xml': appXml,
    'docProps/core.xml': coreXml,
  }, title.replace(/\s+/g,'-')+'.docx');
  toast('✅ Word document exported!');
}

function escXml(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}

/* Minimal DEFLATE-free zip builder for DOCX (stored, no compression) */
function buildDocxZip(files, filename) {
  const enc = new TextEncoder();
  const entries = [];
  let offset = 0;

  Object.entries(files).forEach(([name, content]) => {
    const nameBuf  = enc.encode(name);
    const dataBuf  = enc.encode(content);
    const modDate  = 0x5328, modTime = 0x0000;
    const crc      = crc32(dataBuf);
    const localHdr = buildLocalHeader(nameBuf, dataBuf.length, crc, modDate, modTime);
    entries.push({ nameBuf, dataBuf, localHdr, offset, crc, modDate, modTime });
    offset += localHdr.length + dataBuf.length;
  });

  const cdRecords = entries.map(e => buildCDRecord(e.nameBuf, e.dataBuf.length, e.crc, e.modDate, e.modTime, e.offset));
  const cdSize = cdRecords.reduce((s,r)=>s+r.length, 0);
  const eocd   = buildEOCD(entries.length, cdSize, offset);

  const parts = [];
  entries.forEach(e => { parts.push(e.localHdr); parts.push(e.dataBuf); });
  cdRecords.forEach(r => parts.push(r));
  parts.push(eocd);

  const total = parts.reduce((s,p)=>s+p.length, 0);
  const buf   = new Uint8Array(total);
  let pos = 0;
  parts.forEach(p => { buf.set(p, pos); pos += p.length; });

  const blob = new Blob([buf], { type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url), 5000);
}

function u16le(n){const b=new Uint8Array(2);new DataView(b.buffer).setUint16(0,n,true);return b;}
function u32le(n){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,n,true);return b;}
function cat(...arrs){const t=arrs.reduce((s,a)=>s+a.length,0),r=new Uint8Array(t);let o=0;arrs.forEach(a=>{r.set(a,o);o+=a.length;});return r;}

function buildLocalHeader(nameBuf, size, crc, modDate, modTime) {
  return cat(
    new Uint8Array([0x50,0x4B,0x03,0x04]), u16le(20), u16le(0), u16le(0),
    u16le(modTime), u16le(modDate), u32le(crc), u32le(size), u32le(size),
    u16le(nameBuf.length), u16le(0), nameBuf
  );
}
function buildCDRecord(nameBuf, size, crc, modDate, modTime, lhOffset) {
  return cat(
    new Uint8Array([0x50,0x4B,0x01,0x02]), u16le(20), u16le(20), u16le(0), u16le(0),
    u16le(modTime), u16le(modDate), u32le(crc), u32le(size), u32le(size),
    u16le(nameBuf.length), u16le(0), u16le(0), u16le(0), u16le(0), u32le(0), u32le(lhOffset),
    nameBuf
  );
}
function buildEOCD(count, cdSize, cdOffset) {
  return cat(new Uint8Array([0x50,0x4B,0x05,0x06]), u16le(0), u16le(0), u16le(count), u16le(count), u32le(cdSize), u32le(cdOffset), u16le(0));
}

function crc32(data) {
  let crc = 0xFFFFFFFF;
  const table = crc32.table || (crc32.table = (()=>{
    const t=new Uint32Array(256);
    for(let i=0;i<256;i++){let c=i;for(let j=0;j<8;j++)c=c&1?(0xEDB88320^(c>>>1)):(c>>>1);t[i]=c;}
    return t;
  })());
  for (let i=0;i<data.length;i++) crc = (crc>>>8) ^ table[(crc^data[i])&0xFF];
  return (crc^0xFFFFFFFF) >>> 0;
}

/* ── Generic file saver ── */
function saveFile(content, type, filename) {
  const blob=new Blob([content],{type});const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),5000);
}

/* ══════════ TOAST ══════════ */
let toastT;
function toast(msg) {
  const el=G('toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastT); toastT=setTimeout(()=>el.classList.remove('show'),2500);
}
