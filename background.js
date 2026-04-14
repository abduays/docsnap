let recording = false;
let autoMode = true;
let panelPort = null;
let lastCaptureMs = 0;
const COOLDOWN = 2000;

chrome.action.onClicked.addListener((tab) => {
  chrome.sidePanel.open({ windowId: tab.windowId });
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'ds') return;
  panelPort = port;
  port.onMessage.addListener(onMsg);
  port.onDisconnect.addListener(() => { panelPort = null; recording = false; });
});

async function onMsg(msg) {
  if (msg.type === 'getTab') {
    const tab = await getTab();
    send({ type: 'tabInfo', tabId: tab?.id, url: tab?.url || '', title: tab?.title || '' });
    return;
  }
  if (msg.type === 'start') {
    recording = true;
    autoMode = msg.auto !== false;
    const tab = await getTab();
    if (!tab) { send({ type: 'err', msg: 'No active tab' }); return; }
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] });
    } catch (_) {}
    try { chrome.tabs.sendMessage(tab.id, { type: 'start', auto: autoMode }); } catch (_) {}
    send({ type: 'started', url: tab.url, title: tab.title });
    return;
  }
  if (msg.type === 'stop') {
    recording = false;
    const tab = await getTab();
    if (tab) try { chrome.tabs.sendMessage(tab.id, { type: 'stop' }); } catch (_) {}
    return;
  }
  if (msg.type === 'setMode') {
    autoMode = msg.auto;
    const tab = await getTab();
    if (tab) try { chrome.tabs.sendMessage(tab.id, { type: 'setMode', auto: autoMode }); } catch (_) {}
    return;
  }
  if (msg.type === 'capture') {
    await doCapture(null, null, null);
    return;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'click' && recording && autoMode) {
    const now = Date.now();
    if (now - lastCaptureMs < COOLDOWN) { sendResponse({}); return; }
    setTimeout(() => doCapture(msg.x, msg.y, msg.el), 380);
  }
  sendResponse({});
  return false;
});

async function doCapture(x, y, el) {
  if (!recording) return;
  lastCaptureMs = Date.now();
  try {
    const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const win = wins.find(w => w.focused) || wins[0];
    if (!win) return;
    const dataUrl = await chrome.tabs.captureVisibleTab(win.id, { format: 'jpeg', quality: 92 });
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    send({ type: 'captured', dataUrl, x, y, el, url: tab?.url || '', title: tab?.title || '' });
  } catch (e) {
    send({ type: 'err', msg: e.message });
  }
}

async function getTab() {
  try {
    const wins = await chrome.windows.getAll({ windowTypes: ['normal'] });
    const win = wins.find(w => w.focused) || wins[0];
    if (!win) return null;
    const [tab] = await chrome.tabs.query({ active: true, windowId: win.id });
    return tab || null;
  } catch { return null; }
}

function send(msg) {
  if (panelPort) try { panelPort.postMessage(msg); } catch (_) {}
}
