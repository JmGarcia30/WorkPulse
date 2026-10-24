/* eslint-disable @typescript-eslint/no-require-imports -- Local actual-component browser harness; server actions are explicit test doubles. */
const fs = require('node:fs'), path = require('node:path'), http = require('node:http'), assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const esbuild = require('esbuild');
const directory = process.argv.includes('--phase3') ? 'docs/payroll-phase-3' : 'docs/payroll-phase-2b-2';
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
async function main() {
  const assets = '.next/payroll-ui-browser'; fs.mkdirSync(assets, { recursive: true });
  const actions = ['createCompensationAction', 'createPayrollPeriodAction', 'createPayrollPolicyAction', 'finalizePayrollAction', 'generatePayrollAction', 'movePayrollToReviewAction', 'saveStatutorySetupAction', 'saveTaxOpeningAction'];
  await esbuild.build({ entryPoints: ['scripts/payroll-ui-fixture.tsx'], bundle: true, platform: 'browser', jsx: 'automatic', outfile: `${assets}/bundle.js`, define: { 'process.env.NODE_ENV': '"production"' }, plugins: [{ name: 'payroll-test-bindings', setup(build) {
    build.onResolve({ filter: /^@\/features\/payroll\/actions$/ }, () => ({ path: 'actions', namespace: 'payroll-test' }));
    build.onResolve({ filter: /^next\/navigation$/ }, () => ({ path: 'navigation', namespace: 'payroll-test' }));
    build.onResolve({ filter: /^next\/(link|image)$/ }, args => ({ path: args.path, namespace: 'payroll-test' }));
    build.onLoad({ filter: /.*/, namespace: 'payroll-test' }, args => ({ contents: args.path === 'actions'
      ? actions.map(name => `export async function ${name}(state,form){window.__calls.push({name:${JSON.stringify(name)},fields:[...form.entries()]});await new Promise(r=>setTimeout(r,500));return window.__result==='error'?{error:'SETUP_REQUIRED: Review missing inputs.'}:{success:'Saved reviewed payroll setup.'}}`).join('\n')
      : args.path === 'navigation' ? 'export const usePathname=()=>"/dashboard/payroll";'
      : 'import React from "react";export default function Element({children,priority,unoptimized,prefetch,replace,scroll,...props}){return React.createElement(' + JSON.stringify(args.path === 'next/link' ? 'a' : 'img') + ',props,children)}', loader: 'js', resolveDir: process.cwd() }));
  } }] });
  const css = fs.readdirSync('.next/static/css').filter(file => file.endsWith('.css')).map(file => fs.readFileSync(`.next/static/css/${file}`, 'utf8')).join('\n');
  fs.writeFileSync(`${assets}/styles.css`, css);
  const server = http.createServer((req, res) => {
    const name = req.url?.split('?')[0];
    if (name === '/fixtures.json') { res.setHeader('Content-Type', 'application/json'); return res.end(fs.readFileSync(`${directory}/fixtures.json`)); }
    if (name === '/bundle.js' || name === '/styles.css') { res.setHeader('Content-Type', name.endsWith('.js') ? 'text/javascript' : 'text/css'); return res.end(fs.readFileSync(assets + name)); }
    res.setHeader('Content-Type', 'text/html'); res.end('<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/styles.css"></head><body><main class="mx-auto min-w-0 max-w-6xl p-3 sm:p-6"><div id="root"></div></main><script>window.__calls=[];window.__dialogs=[];window.__confirmReturn=true;window.confirm=(message)=>{window.__dialogs.push(message);return window.__confirmReturn};window.__errors=[];addEventListener("error",e=>window.__errors.push(e.message));</script><script src="/bundle.js"></script></body></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); const port = server.address().port, debugPort = 9247;
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${path.resolve(assets, 'chrome')}`, 'about:blank'], { windowsHide: true, stdio: 'ignore' });
  let ws, assertions = 0, sequence = 0; const pending = new Map(), layouts = [];
  const check = (condition, message) => { assert(condition, message); assertions++; console.log('BROWSER PASS', assertions, message); };
  try {
    let page;
    for (let i = 0; i < 80; i++) { try { page = (await (await fetch(`http://127.0.0.1:${debugPort}/json`)).json()).find(item => item.type === 'page'); if (page) break; } catch {} await pause(100); }
    if (!page) throw Error('CHROME_UNAVAILABLE');
    ws = new WebSocket(page.webSocketDebuggerUrl); await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
    ws.onmessage = event => { const message = JSON.parse(event.data); const call = pending.get(message.id); if (call) { pending.delete(message.id); clearTimeout(call.timeout); if (message.error) call.reject(Error(message.error.message)); else call.resolve(message.result); } };
    const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; const timeout = setTimeout(() => { pending.delete(id); reject(Error('CDP_TIMEOUT')); }, 20_000); pending.set(id, { resolve, reject, timeout }); ws.send(JSON.stringify({ id, method, params })); });
    const evaluate = async expression => { const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (result.exceptionDetails) throw Error('BROWSER_SCRIPT_FAILED: ' + JSON.stringify(result.exceptionDetails)); return result.result.value; };
    const until = async expression => { for (let i = 0; i < 120; i++) { if (await evaluate(expression)) return; await pause(50); } throw Error('BROWSER_STATE_TIMEOUT: ' + expression); };
    await send('Page.enable');
    const goto = async mode => { await send('Page.navigate', { url: `http://127.0.0.1:${port}/?mode=${mode}` }); await until('document.readyState==="complete" && document.getElementById("root").children.length>0'); };
    for (const width of [320, 375, 768, 1280]) {
      await send('Emulation.setDeviceMetricsOverride', { width, height: 1000, deviceScaleFactor: 1, mobile: width < 768 });
      for (const mode of ['monthly', 'first', 'second', 'legacy', 'setup', 'processing-blocked']) {
        await goto(mode);
        if (mode.startsWith('processing')) await evaluate('document.querySelectorAll("details").forEach(e=>e.open=true)');
        const layout = await evaluate('({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,errors:window.__errors.length})');
        layouts.push({ mode, ...layout }); check(layout.scrollWidth <= width && layout.errors === 0, `${mode} has no page overflow/runtime errors at ${width}px`);
      }
    }
    await goto('monthly'); check(await evaluate('document.body.innerText.includes("SSS employee share") && document.body.innerText.includes("1,750.00") && document.body.innerText.includes("Employer-only EC") && document.body.innerText.includes("3,500.00")'), 'monthly payslip separates recorded employee and employer amounts');
    await goto('legacy'); check(await evaluate('document.body.innerText.includes("Historical payslip") && document.body.innerText.includes("Not recorded") && document.body.innerText.includes("34,990.00")'), 'legacy payslip preserves totals and identifies unrecorded deductions');
    await goto('second'); check(await evaluate('document.body.innerText.includes("remaining monthly contribution") && document.body.innerText.includes("875.00")'), 'second-cutoff payslip displays its allocated employee share');
    await goto('locked'); check(await evaluate('[...document.querySelectorAll("fieldset")].every(e=>e.disabled) && document.body.innerText.includes("read-only")'), 'used setup is read-only');
    await goto('processing-blocked'); check(await evaluate('[...document.querySelectorAll("button")].find(e=>e.textContent==="Finalize Payroll").disabled && document.body.innerText.includes("opening benefit history")'), 'missing setup disables finalization and explains the blocker');
    await goto('processing-ready'); await evaluate('window.__confirmReturn=false;const f=document.querySelector("input[name=confirmation]");f.checked=true;f.form.requestSubmit()');
    check(await evaluate('window.__calls.length===0 && window.__dialogs.length===1'), 'cancelled finalization confirmation sends no action');
    await evaluate('window.__confirmReturn=true;document.querySelector("input[name=confirmation]").form.requestSubmit()');
    await until('document.querySelector("form[aria-busy=true]")!==null');
    check(await evaluate('[...document.querySelectorAll("button")].some(e=>e.disabled&&e.textContent.includes("Finalizing"))'), 'finalization shows processing and disables resubmission');
    await until('document.body.innerText.includes("Saved reviewed payroll setup.")');
    check(await evaluate('document.querySelector("[role=status]")!==null'), 'successful action has an accessible compact notification');
    await goto('setup'); await evaluate('document.querySelector("form").requestSubmit()'); check(await evaluate('window.__calls.length===0 && [...document.querySelectorAll("input[type=number]")].every(e=>e.value==="")'), 'blank mandatory amounts block submission and do not default to zero');
    await evaluate(`(()=>{const f=document.querySelector('form');const set=(key,value)=>{const e=f.elements[key],select=e instanceof HTMLSelectElement;Object.getOwnPropertyDescriptor(select?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(e,value);e.dispatchEvent(new Event(select?'change':'input',{bubbles:true}))};for(const key of ['monthlySssRemuneration','monthlyPhilHealthBasic','monthlyPagIbigFundSalary'])set(key,'35000');set('unionDues','0');for(const key of ['agencyBasisReference','unionReference','evidenceReference'])set(key,'reviewed');for(const key of ['SSS','PHILHEALTH','PAGIBIG'])set('coverage.'+key,'MANDATORY');for(const key of ['late','absence','undertime'])set('treatment.'+key,'NET_DEDUCTION');f.querySelectorAll('input[type=checkbox]').forEach(e=>e.checked=true);window.__result='error'})()`);
    await evaluate('document.querySelector("form").requestSubmit()');
    await until('document.querySelector("form[aria-busy=true]")!==null'); await until('document.body.innerText.includes("SETUP_REQUIRED: Review missing inputs.")');
    check(await evaluate('document.querySelector("[role=alert]")!==null && window.__calls[0].name==="saveStatutorySetupAction"'), 'setup validation errors appear accessibly after a pending save');
    check(await evaluate('document.querySelector("input[name=monthlySssRemuneration]").value==="35000" && document.querySelector("input[name=unionDues]").value==="0"'), 'a rejected save preserves reviewed amounts for correction');
    const result = { passed: true, assertions, layouts, actualComponents: true, serverActions: 'test doubles; real authorization/contracts tested separately against recovery DB' };
    fs.writeFileSync(`${directory}/browser.json`, JSON.stringify(result, null, 2));
    const shot = await send('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(`${directory}/setup-preview.png`, Buffer.from(shot.data, 'base64'));
  } finally { ws?.close(); chrome.kill(); await new Promise(resolve => server.close(resolve)); }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
