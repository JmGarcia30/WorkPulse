/* eslint-disable @typescript-eslint/no-require-imports -- Public official-source evidence, no WorkPulse credentials. */
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { createServer } = require('node:http');
const directory = 'docs/payroll-v2/review';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const server = createServer((req, res) => { res.setHeader('Content-Type', 'application/pdf'); fs.createReadStream(`${directory}/rr29-2025.pdf`).pipe(res); });
  await new Promise(resolve => server.listen(3142, '127.0.0.1', resolve));
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--disable-background-networking', '--remote-debugging-port=9249', '--user-data-dir=' + path.resolve('storage/payroll-v2-review/public-browser'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws;
  try {
    let page;
    for (let i = 0; i < 50; i++) { try { page = (await (await fetch('http://127.0.0.1:9249/json')).json()).find(p => p.type === 'page'); if (page) break; } catch {} await pause(200); }
    if (!page) throw Error('PUBLIC_BROWSER_UNAVAILABLE');
    ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    let id = 0; const pending = new Map();
    ws.onmessage = e => { const r = JSON.parse(e.data); if (r.id && pending.has(r.id)) { const p = pending.get(r.id); pending.delete(r.id); if (r.error) p.reject(Error('CDP_ERROR')); else p.resolve(r.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const current = ++id; pending.set(current, { resolve, reject }); ws.send(JSON.stringify({ id: current, method, params })); });
    await send('Page.enable'); await send('Runtime.enable');
    await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 1600, deviceScaleFactor: 1, mobile: false });
    for (const pageNumber of [1, 2]) {
      await send('Page.navigate', { url: `http://127.0.0.1:3142/rr29.pdf#page=${pageNumber}&zoom=page-fit` });
      await pause(2500);
      if (pageNumber === 2) {
        await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: 150, y: 350, button: 'left', clickCount: 1 });
        await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: 150, y: 350, button: 'left', clickCount: 1 });
        await pause(800);
      }
      const screenshot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${directory}/rr29-page-${pageNumber}.png`, Buffer.from(screenshot.data, 'base64'));
    }
    for (const [name, url] of [['bir-2026-regulations', 'https://www.bir.gov.ph/2026-Revenue-Regulations'], ['bir-2026-circulars', 'https://www.bir.gov.ph/2026-Revenue-Memorandum-Circulars'], ['bir-2025-regulations', 'https://www.bir.gov.ph/2025-Revenue-Regulations']]) {
      if (process.argv.includes('--pdf-only')) break;
      await send('Page.navigate', { url }); await pause(7000);
      const result = await send('Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true });
      fs.writeFileSync(`${directory}/${name}.txt`, result.result.value || 'Unavailable');
      console.log(JSON.stringify({ source: url, characters: (result.result.value || '').length }));
    }
  } finally { ws?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
