(function () {
  if (window.__DS) return;
  window.__DS = true;

  let on = false, auto = true, lastClick = 0;
  const GAP = 1800;
  let badge = null, ripple = null;

  chrome.runtime.onMessage.addListener((msg) => {
    if (msg.type === 'start')   { on = true; auto = msg.auto !== false; showBadge(); }
    if (msg.type === 'stop')    { on = false; badge && badge.remove(); badge = null; }
    if (msg.type === 'setMode') { auto = msg.auto; if (badge) badge.querySelector('span').textContent = 'DocuSnap · ' + (auto ? 'AUTO' : 'MANUAL'); }
  });

  document.addEventListener('click', (e) => {
    if (!on || !auto) return;
    const now = Date.now();
    if (now - lastClick < GAP) return;
    lastClick = now;
    const t = nearest(e.target);
    const el = {
      tag: t.tagName?.toLowerCase() || '',
      text: (t.innerText || t.value || t.getAttribute('aria-label') || t.title || t.alt || '').trim().slice(0, 80),
      href: t.href || '',
    };
    rippleAt(e.clientX, e.clientY);
    chrome.runtime.sendMessage({ type: 'click', x: e.clientX, y: e.clientY, el }).catch(() => {});
  }, true);

  function nearest(el) {
    for (let i = 0, cur = el; i < 5 && cur && cur !== document.body; i++, cur = cur.parentElement) {
      const tag = cur.tagName?.toLowerCase();
      const role = (cur.getAttribute?.('role') || '').toLowerCase();
      const cursor = getComputedStyle(cur).cursor;
      if (tag === 'a' || tag === 'button' || tag === 'select' || (tag === 'input' && cur.type !== 'hidden') ||
          role === 'button' || role === 'link' || role === 'tab' || role === 'menuitem' ||
          cur.hasAttribute('onclick') || cursor === 'pointer') return cur;
    }
    return el;
  }

  function rippleAt(x, y) {
    ripple && ripple.remove();
    ripple = document.createElement('div');
    Object.assign(ripple.style, {
      position:'fixed', left:x+'px', top:y+'px', width:'52px', height:'52px',
      marginLeft:'-26px', marginTop:'-26px', borderRadius:'50%',
      border:'3px solid #f97316', background:'rgba(249,115,22,.18)',
      pointerEvents:'none', zIndex:'2147483647',
      transition:'transform .5s ease, opacity .5s ease', transform:'scale(0)', opacity:'1',
    });
    document.body.appendChild(ripple);
    requestAnimationFrame(() => Object.assign(ripple.style, { transform:'scale(2)', opacity:'0' }));
    setTimeout(() => { ripple?.remove(); ripple = null; }, 560);
  }

  function showBadge() {
    if (badge) return;
    if (!document.getElementById('__ds_sty')) {
      const s = document.createElement('style');
      s.id = '__ds_sty';
      s.textContent = '#__ds_b{font-family:system-ui,sans-serif!important}@keyframes __dsb{0%,100%{opacity:1}50%{opacity:.15}}#__ds_d{animation:__dsb 1.3s ease-in-out infinite}';
      document.head.appendChild(s);
    }
    badge = document.createElement('div');
    badge.id = '__ds_b';
    Object.assign(badge.style, {
      position:'fixed', bottom:'16px', right:'16px',
      background:'rgba(15,23,42,.92)', backdropFilter:'blur(10px)',
      color:'#f1f5f9', padding:'6px 12px', borderRadius:'100px',
      fontSize:'12px', fontWeight:'700', zIndex:'2147483647',
      display:'flex', alignItems:'center', gap:'7px',
      boxShadow:'0 4px 20px rgba(0,0,0,.4)', border:'1px solid rgba(255,255,255,.1)',
      pointerEvents:'none', userSelect:'none', lineHeight:'1',
    });
    const dot = document.createElement('span');
    dot.id = '__ds_d';
    Object.assign(dot.style, { width:'7px', height:'7px', background:'#ef4444', borderRadius:'50%', display:'inline-block' });
    const txt = document.createElement('span');
    txt.textContent = 'DocuSnap · AUTO';
    badge.appendChild(dot);
    badge.appendChild(txt);
    document.body.appendChild(badge);
  }
})();
