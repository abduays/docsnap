'use strict';

const COLORS = ['#fbbf24','#f97316','#ef4444','#34d399','#60a5fa','#a78bfa','#ffffff','#0f172a'];
const ch = new BroadcastChannel('ds_annotate');

let baseImage = null;     // HTMLImageElement
let anns = [];            // committed annotations
let tool = 'highlight';
let color = '#fbbf24';
let size = 4;
let drawing = false;
let ds = null;            // drag start point (canvas coords)
let arrowPt = null;
let cropRect = null;      // pending crop rect in canvas coords

const canvas = document.getElementById('main-canvas');
const ctx    = canvas.getContext('2d');
const hint   = document.getElementById('hint');
const cropSel= document.getElementById('crop-sel');
const areaEl = document.getElementById('canvas-area');
const applyBtn = document.getElementById('btn-apply-crop');

/* ── Build colour buttons ── */
const colsWrap = document.getElementById('cols');
COLORS.forEach((c, i) => {
  const el = document.createElement('div');
  el.className = 'col' + (i === 0 ? ' sel' : '');
  el.style.background = c;
  el.title = c;
  el.addEventListener('click', () => {
    color = c;
    document.querySelectorAll('.col').forEach(x => x.classList.remove('sel'));
    el.classList.add('sel');
  });
  colsWrap.appendChild(el);
});

/* ── Tool buttons ── */
['hl','ar','tx','bl','cr'].forEach(id => {
  const btn = document.getElementById('t-' + id);
  const t   = { hl:'highlight', ar:'arrow', tx:'text', bl:'blur', cr:'crop' }[id];
  btn.addEventListener('click', () => setTool(t));
});

document.getElementById('sz-sel').addEventListener('change', e => { size = Number(e.target.value); });
document.getElementById('btn-undo').addEventListener('click', undoAnn);
document.getElementById('btn-clear').addEventListener('click', clearAnns);
document.getElementById('btn-apply-crop').addEventListener('click', applyCrop);
document.getElementById('btn-cancel').addEventListener('click', () => {
  ch.postMessage({ type: 'ann_cancel' });
  window.close();
});
document.getElementById('btn-save').addEventListener('click', () => {
  const data = canvas.toDataURL('image/jpeg', 0.93);
  ch.postMessage({ type: 'ann_result', data });
  window.close();
});

function setTool(t) {
  tool = t; arrowPt = null; cropRect = null;
  hideCropSel();
  applyBtn.style.display = 'none';
  document.querySelectorAll('.tool-btn[data-t]').forEach(b => b.classList.toggle('on', b.dataset.t === t));
  const hints = { highlight:'Drag to highlight a region', arrow:'Click start point, then click endpoint', text:'Click where you want to place the label', blur:'Drag to redact / blur a region', crop:'Drag to select crop area, then click Apply Crop' };
  hint.textContent = hints[t] || '';
}

/* ── Receive image from sidepanel ── */
ch.onmessage = e => {
  if (e.data.type !== 'ann_init') return;
  const img = new Image();
  img.onload = () => {
    baseImage = img;
    setupCanvas(img);
    redraw();
  };
  img.src = e.data.src;
};
ch.postMessage({ type: 'ann_ready' });

function setupCanvas(img) {
  const areaW = areaEl.clientWidth  - 20;
  const areaH = areaEl.clientHeight - 20;
  const scale = Math.min(areaW / img.width, areaH / img.height, 1);
  canvas.width  = img.width;
  canvas.height = img.height;
  canvas.style.width  = Math.round(img.width  * scale) + 'px';
  canvas.style.height = Math.round(img.height * scale) + 'px';
}

/* ── Canvas coordinates ── */
function toCanvas(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width  / r.width),
    y: (e.clientY - r.top)  * (canvas.height / r.height),
  };
}

/* ── Mouse events ── */
canvas.addEventListener('mousedown', e => {
  const p = toCanvas(e);
  if (tool === 'text') {
    const label = prompt('Enter label text:');
    if (label) { anns.push({ type:'text', x:p.x, y:p.y, text:label, color, size }); redraw(); }
    return;
  }
  if (tool === 'arrow') {
    if (!arrowPt) { arrowPt = p; hint.textContent = 'Now click endpoint…'; }
    else { anns.push({ type:'arrow', x1:arrowPt.x, y1:arrowPt.y, x2:p.x, y2:p.y, color, size }); arrowPt = null; hint.textContent = 'Click start point, then click endpoint'; redraw(); }
    return;
  }
  drawing = true; ds = p;
  if (tool === 'crop') hideCropSel();
});

canvas.addEventListener('mousemove', e => {
  if (!drawing) return;
  const p = toCanvas(e);
  if (tool === 'crop') {
    updateCropSel(ds, p);
  } else {
    redraw([{ type:tool, x:Math.min(ds.x,p.x), y:Math.min(ds.y,p.y), w:Math.abs(p.x-ds.x), h:Math.abs(p.y-ds.y), color, size }]);
  }
});

canvas.addEventListener('mouseup', e => {
  if (!drawing) return; drawing = false;
  const p = toCanvas(e);
  const x=Math.min(ds.x,p.x), y=Math.min(ds.y,p.y), w=Math.abs(p.x-ds.x), h=Math.abs(p.y-ds.y);
  if (tool === 'crop') {
    if (w > 5 && h > 5) { cropRect = {x,y,w,h}; applyBtn.style.display = ''; }
    return;
  }
  if (w > 2 && h > 2) { anns.push({ type:tool, x, y, w, h, color, size }); }
  redraw();
});

/* ── Crop overlay in DOM space ── */
function updateCropSel(a, b) {
  const r  = canvas.getBoundingClientRect();
  const ar = areaEl.getBoundingClientRect();
  const sx = r.width  / canvas.width;
  const sy = r.height / canvas.height;
  const x1 = Math.min(a.x, b.x) * sx + (r.left - ar.left);
  const y1 = Math.min(a.y, b.y) * sy + (r.top  - ar.top);
  const w  = Math.abs(b.x - a.x) * sx;
  const h  = Math.abs(b.y - a.y) * sy;
  Object.assign(cropSel.style, { display:'block', left:x1+'px', top:y1+'px', width:w+'px', height:h+'px' });
}
function hideCropSel() { cropSel.style.display = 'none'; }

function applyCrop() {
  if (!cropRect || !baseImage) return;
  const { x, y, w, h } = cropRect;
  // Redraw anns committed, then crop
  redraw();
  const tmp = document.createElement('canvas');
  tmp.width = Math.round(w); tmp.height = Math.round(h);
  const tc = tmp.getContext('2d');
  tc.drawImage(canvas, x, y, w, h, 0, 0, w, h);
  // Update base image to cropped version
  const img = new Image();
  img.onload = () => {
    baseImage = img;
    canvas.width  = img.width;
    canvas.height = img.height;
    // Recalculate display size
    const areaW = areaEl.clientWidth  - 20;
    const areaH = areaEl.clientHeight - 20;
    const scale = Math.min(areaW / img.width, areaH / img.height, 1);
    canvas.style.width  = Math.round(img.width  * scale) + 'px';
    canvas.style.height = Math.round(img.height * scale) + 'px';
    anns = [];
    cropRect = null;
    hideCropSel();
    applyBtn.style.display = 'none';
    redraw();
    hint.textContent = 'Cropped! Continue annotating.';
  };
  img.src = tmp.toDataURL('image/jpeg', 0.95);
}

/* ── Redraw ── */
function redraw(preview) {
  if (!baseImage) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(baseImage, 0, 0);
  const list = [...anns, ...(preview || [])];
  list.forEach(a => drawAnn(a));
}

function drawAnn(a) {
  const lw = (a.size || 4);
  ctx.save();
  if (a.type === 'highlight') {
    ctx.fillStyle = a.color + '44';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    ctx.strokeStyle = a.color;
    ctx.lineWidth = lw;
    ctx.strokeRect(a.x, a.y, a.w, a.h);
  } else if (a.type === 'blur') {
    ctx.fillStyle = 'rgba(15,23,42,.88)';
    ctx.fillRect(a.x, a.y, a.w, a.h);
    // Hatching
    ctx.strokeStyle = 'rgba(255,255,255,.04)';
    ctx.lineWidth = 3;
    for (let i = a.x; i < a.x + a.w; i += 8) { ctx.beginPath(); ctx.moveTo(i, a.y); ctx.lineTo(i, a.y + a.h); ctx.stroke(); }
  } else if (a.type === 'arrow') {
    const dx = a.x2 - a.x1, dy = a.y2 - a.y1;
    const len = Math.sqrt(dx*dx + dy*dy);
    const hl  = Math.min(24, len * 0.28);
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(a.x1, a.y1);
    ctx.lineTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - hl * Math.cos(ang - Math.PI/6), a.y2 - hl * Math.sin(ang - Math.PI/6));
    ctx.moveTo(a.x2, a.y2);
    ctx.lineTo(a.x2 - hl * Math.cos(ang + Math.PI/6), a.y2 - hl * Math.sin(ang + Math.PI/6));
    ctx.strokeStyle = a.color;
    ctx.lineWidth   = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap  = 'round';
    ctx.stroke();
  } else if (a.type === 'text') {
    const fs = Math.max(16, canvas.width * 0.02);
    ctx.font = `bold ${fs}px system-ui, sans-serif`;
    const m  = ctx.measureText(a.text);
    const pd = 8;
    ctx.fillStyle = a.color;
    ctx.fillRect(a.x - pd, a.y - fs - pd/2, m.width + pd*2, fs + pd*1.4);
    ctx.fillStyle = '#fff';
    ctx.fillText(a.text, a.x, a.y);
  }
  ctx.restore();
}

function undoAnn() { if (anns.length) { anns.pop(); redraw(); } }
function clearAnns() { if (!confirm('Clear all annotations?')) return; anns = []; redraw(); }

/* Keyboard shortcuts */
document.addEventListener('keydown', e => {
  if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undoAnn(); }
  if (e.key === 'Escape') { document.getElementById('btn-cancel').click(); }
  if (e.key === 'Enter') { document.getElementById('btn-save').click(); }
});
