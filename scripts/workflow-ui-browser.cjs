/* eslint-disable @typescript-eslint/no-require-imports -- Actual UI components with explicit action doubles; no database access. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const esbuild = require('esbuild');
const directory = 'docs/workflow-simplification', assets = '.next/workflow-ui';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  fs.mkdirSync(assets, { recursive: true }); fs.mkdirSync(directory, { recursive: true });
  const actions = ['createCompensationAction', 'createPayrollPeriodAction', 'createPayrollPolicyAction', 'finalizePayrollAction', 'generatePayrollAction', 'movePayrollToReviewAction', 'deletePayrollPeriodDirectAction', 'saveStandardPayrollProfileAction'];
  await esbuild.build({ entryPoints: ['scripts/workflow-ui-fixture.tsx'], bundle: true, platform: 'browser', jsx: 'automatic', outfile: assets + '/bundle.js', define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'ui-bindings', setup(build) {
    build.onResolve({ filter: /^@\/features\/payroll\/actions$/ }, () => ({ path: 'payroll-actions', namespace: 'fixture' }));
    build.onResolve({ filter: /^\.\/actions$/ }, args => args.importer.includes('platform-admin') ? ({ path: 'platform-actions', namespace: 'fixture' }) : null);
    build.onResolve({ filter: /^next\/(navigation|image)$/ }, args => ({ path: args.path, namespace: 'fixture' }));
    build.onResolve({ filter: /^next\/font\/google$/ }, () => ({ path: 'font', namespace: 'fixture' }));
    build.onLoad({ filter: /.*/, namespace: 'fixture' }, args => ({ contents: args.path === 'payroll-actions' ? actions.map(name => 'export async function ' + name + '(state,form){window.__submissions.push({name:' + JSON.stringify(name) + ',confirmations:form?.getAll("confirmed")});return {success:"Saved"}}').join('\n')
      : args.path === 'platform-actions' ? 'export async function platformLoginAction(state,form){window.__submissions.push({email:form.get("email")});return {error:"Sign-in failed. Check your credentials."}};export async function platformAccountAction(){return {}}'
      : args.path === 'font' ? 'export const Poppins=()=>({className:"",variable:""});'
      : args.path === 'next/navigation' ? 'export const useRouter=()=>({refresh(){},push(){}});export const usePathname=()=>"/dashboard/payroll";'
      : 'import React from "react";export default function Image({priority,...props}){return React.createElement("img",props)}', loader: 'js', resolveDir: process.cwd() }));
  } }] });
  const baseCss = fs.readdirSync('.next/static/css').filter(file => file.endsWith('.css')).map(file => fs.readFileSync('.next/static/css/' + file, 'utf8')).join('\n');
  fs.writeFileSync(assets + '/styles.css', baseCss + '\n' + fs.readFileSync(assets + '/bundle.css', 'utf8'));
  const server = http.createServer((req, res) => {
    const name = req.url.split('?')[0];
    if (name === '/bundle.js' || name === '/styles.css') { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css'); return res.end(fs.readFileSync(assets + name)); }
    if (name.startsWith('/branding/')) { res.setHeader('Content-Type', 'image/png'); return res.end(fs.readFileSync('public' + name)); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><div id="root"></div><script>window.__submissions=[];window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));</script><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port, debugPort = 9256;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=' + debugPort, '--user-data-dir=' + path.resolve(assets, 'chrome'), 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws, sequence = 0; const pending = new Map(), checks = [], layouts = [];
  const check = (value, label) => { assert(value, label); checks.push(label); console.log('BROWSER PASS', label); };
  try {
    let page;
    for (let i = 0; i < 80; i++) { try { page = (await (await fetch('http://127.0.0.1:' + debugPort + '/json')).json()).find(item => item.type === 'page'); if (page) break; } catch {} await pause(100); }
    if (!page) throw Error('CHROME_UNAVAILABLE');
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => { const message = JSON.parse(event.data), call = pending.get(message.id); if (call) { pending.delete(message.id); clearTimeout(call.timeout); if (message.error) call.reject(Error(message.error.message)); else call.resolve(message.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence, timeout = setTimeout(() => { pending.delete(id); reject(Error('CDP_TIMEOUT')); }, 20000); pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw Error('BROWSER_SCRIPT_FAILED: ' + (r.exceptionDetails.exception?.description || r.exceptionDetails.text)); return r.result.value; };
    const until = async expression => { for (let i = 0; i < 100; i++) { if (await evaluate(expression)) return; await pause(60); } throw Error('BROWSER_STATE_TIMEOUT'); };
    await send('Page.enable');
    const goto = async mode => { await send('Page.navigate', { url: 'http://127.0.0.1:' + port + '/?mode=' + mode }); await until('document.readyState==="complete" && document.getElementById("root").children.length>0'); };
    const screenshot = async name => { const result = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true }); fs.writeFileSync(directory + '/' + name + '.png', Buffer.from(result.data, 'base64')); };
    for (const appearance of ['light', 'dark']) {
      await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: appearance }] });
      for (const width of [320, 375, 768, 1280]) {
        await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
        for (const mode of ['application', 'platform', 'empty', 'standard']) {
          await goto(mode);
          const layout = await evaluate('({width:innerWidth,scroll:document.documentElement.scrollWidth,errors:window.__errors.length})');
          layouts.push({ mode, appearance, ...layout }); check(layout.scroll <= width && layout.errors === 0, mode + ' renders without overflow/errors at ' + width + 'px in ' + appearance);
          if (mode === 'application') {
            const contrast = await evaluate(`(()=>{const e=document.querySelector('input[name=firstName]'),s=getComputedStyle(e);const lum=c=>{const a=c.match(/[0-9.]+/g).slice(0,3).map(n=>{const v=Number(n)/255;return v<=.04045?v/12.92:((v+.055)/1.055)**2.4});return a[0]*.2126+a[1]*.7152+a[2]*.0722};const a=lum(s.color),b=lum(s.backgroundColor);return (Math.max(a,b)+.05)/(Math.min(a,b)+.05)})()`);
            check(contrast >= 4.5, 'application field contrast meets WCAG AA in ' + appearance + ' at ' + width);
          }
          if (width === 375 || width === 1280) await screenshot(mode + '-' + appearance + '-' + width);
        }
      }
    }
    await goto('empty');
    check(await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent==="Move to Review").disabled'), 'empty draft cannot move to Review in the UI');
    await goto('standard');
    check(await evaluate('!document.querySelector("form").checkValidity() && !document.body.innerText.includes("Review derived monthly bases")'), 'standard profile cannot save or derive all agency bases without review');
    await evaluate('document.querySelectorAll("input[type=checkbox]").forEach(e=>e.click());document.querySelector("select[name=deductionTreatment]").value="NET_DEDUCTION";document.querySelector("input[name=evidenceReference]").value="Synthetic reviewed records"');
    check(await evaluate('document.body.innerText.includes("Review derived monthly bases")'), 'basic-only confirmation reveals the salary-derived bases for review');
    await evaluate('document.querySelector("form").requestSubmit()'); await until('window.__submissions.length===1');
    check(await evaluate('window.__submissions[0].confirmations.length===4'), 'standard setup submits all four explicit confirmations');
    await goto('application');
    check(await evaluate('[...document.querySelectorAll("input:not([type=hidden]),textarea")].every(e=>e.labels.length>0)'), 'all applicant inputs have associated labels');
    await evaluate('document.querySelector("textarea").focus()'); await send('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 }); await send('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Tab', code: 'Tab', windowsVirtualKeyCode: 9 });
    check(await evaluate('document.activeElement.id==="resume-upload-input"'), 'resume picker is reachable by keyboard after the cover letter');
    const drop = async (name, size = 10) => { await evaluate(`(()=>{const d=new DataTransfer();d.items.add(new File([new Uint8Array(${size})],${JSON.stringify(name)}));document.querySelector('input[type=file]').parentElement.dispatchEvent(new DragEvent('drop',{bubbles:true,cancelable:true,dataTransfer:d}))})()`); await pause(100); };
    await drop('invalid.exe');
    check(await evaluate('document.querySelector("[role=alert]").textContent.includes("PDF") && document.querySelector("input[type=file]").files.length===0'), 'invalid drop explains file types and clears submitted file');
    await drop('oversize.pdf', 5 * 1024 * 1024 + 1);
    check(await evaluate('document.querySelector("[role=alert]").textContent.includes("5 MB") && document.querySelector("input[type=file]").files.length===0'), 'oversized drop cannot be submitted');
    await drop('resume.pdf');
    check(await evaluate('document.querySelector("[role=status]").textContent.includes("resume.pdf") && document.querySelector("input[type=file]").files[0].name==="resume.pdf"'), 'valid PDF drop shows filename and attaches the selected file');
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Remove resume").click()');
    check(await evaluate('document.querySelector("input[type=file]").files.length===0'), 'remove clears preview and attachment');
    await drop('resume.docx');
    await evaluate(`(()=>{for(const [name,value] of Object.entries({firstName:'Synthetic',lastName:'Applicant',email:'synthetic@example.test',phone:'09170000000',coverLetter:'Synthetic application'}))document.querySelector('[name='+name+']').value=value;document.querySelector('form').requestSubmit()})()`);
    await until('window.__submissions.length===1');
    check(await evaluate('window.__submissions[0].resume.name==="resume.docx" && window.__submissions[0].jobId==="fixture-job" && window.__submissions[0].organizationSlug==="fixture"'), 'DOCX and applicant fields reach the existing form action contract');
    await goto('application&brand=other');
    check(await evaluate('getComputedStyle(document.querySelector("button[type=submit]")).backgroundColor==="rgb(18, 98, 115)"'), 'a second tenant inherits its own public primary color');
    await goto('platform');
    check(await evaluate('document.querySelector("img").getAttribute("src").includes("workpulse-logo") && document.body.innerText.toLowerCase().includes("platform administration")'), 'platform login uses the actual WorkPulse logo and administration identity');
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Show password").click()');
    check(await evaluate('document.querySelector("input[name=password]").type==="text" && [...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Hide password").getAttribute("aria-pressed")==="true"'), 'password visibility button exposes its accessible state');
    await evaluate('[...document.querySelectorAll("button")].find(e=>e.getAttribute("aria-label")==="Hide password").click()');
    await evaluate('document.querySelector("input[name=email]").value="synthetic@example.test";document.querySelector("input[name=password]").value="invalid-fixture-password";document.querySelector("form").requestSubmit()');
    await until('document.querySelector("[role=alert]")!==null');
    check(await evaluate('document.querySelector("[role=alert]").textContent.includes("Sign-in failed") && document.querySelector("input[name=password]").type==="password"'), 'login action errors remain accessible and do not reveal authentication details');
    fs.writeFileSync(directory + '/browser-tests.json', JSON.stringify({ passed: true, assertions: checks.length, checks, layouts, boundary: 'Actual components; action test doubles. Database/authorization checked separately.' }, null, 2));
  } finally { ws?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
