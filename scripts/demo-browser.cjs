const fs = require('node:fs');
const pause = ms => new Promise(r => setTimeout(r, ms));
async function connect() {
  const pages = await (await fetch('http://127.0.0.1:9230/json')).json();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let next = 0; const pending = new Map(), requests = [];
  ws.onmessage = ({ data }) => { const m = JSON.parse(data); if (m.id) { const p = pending.get(m.id); if (p) { clearTimeout(p.timer); pending.delete(m.id); m.error ? p.reject(Error('CDP_FAILED')) : p.resolve(m.result); } } else if(m.method==='Network.requestWillBeSent'){ const u=new URL(m.params.request.url);requests.push({method:m.params.request.method,path:u.pathname,credentialQuery:u.searchParams.has('password')});} };
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++next; const timer = setTimeout(() => { pending.delete(id); reject(Error('CDP_TIMEOUT')); }, 60000); pending.set(id, { resolve, reject, timer }); ws.send(JSON.stringify({ id, method, params })); });
  const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); if (r.exceptionDetails) throw Error('BROWSER_EVALUATION_FAILED'); return r.result.value; };
  const until = async expression => { for (let i = 0; i < 600; i++) { if (await evaluate(expression)) return; await pause(150); } throw Error('BROWSER_WAIT_TIMEOUT'); };
  const go = async route => { await send('Page.navigate', { url: route.startsWith('http') ? route : 'http://saga.localhost:3000' + route }); await until(`document.readyState==='complete' && !!document.querySelector('main')`); await pause(900); };
  const set = async (selector, value) => { await evaluate(`(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw Error('MISSING_FIELD');const proto=el instanceof HTMLSelectElement?HTMLSelectElement.prototype:el instanceof HTMLTextAreaElement?HTMLTextAreaElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event('input',{bubbles:true}));el.dispatchEvent(new Event('change',{bubbles:true}));return true})()`); };
  const click = async text => { await evaluate(`(()=>{const el=[...document.querySelectorAll('button,a')].find(el=>el.textContent.trim()===${JSON.stringify(text)});if(!el)throw Error('MISSING_BUTTON');el.click();return true})()`); await pause(700); };
  const summary = () => evaluate(`({path:location.pathname,headings:[...document.querySelectorAll('h1,h2,h3')].map(e=>e.textContent.trim()),fields:[...document.querySelectorAll('main input,main select,main textarea')].map(e=>({tag:e.tagName,name:e.name,type:e.type,required:e.required,options:e.tagName==='SELECT'?[...e.options].map(o=>({value:o.value,label:o.textContent})):undefined})),buttons:[...document.querySelectorAll('main button')].map(e=>({text:e.textContent.trim(),disabled:e.disabled})),alerts:[...document.querySelectorAll('[role=alert]')].map(e=>e.textContent.slice(0,500))})`);
  await send('Network.enable');
  return { send, evaluate, until, go, set, click, summary, pause, requests, close: () => ws.close() };
}
if (require.main === module) (async () => { const b = await connect(); try { const step = require(require('node:path').resolve(process.argv[2])); await step(b, JSON.parse(fs.readFileSync('.next/demo-stabilization-fixture.json'))); } finally { b.close(); } })().catch(e => { console.error(JSON.stringify({ error: e.message, location: e.stack?.split('\n').slice(1,3) })); process.exitCode = 1; });
module.exports = connect;
