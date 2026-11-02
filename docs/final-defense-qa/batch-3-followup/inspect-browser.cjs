const fs = require('node:fs');
(async () => {
  const pages = await (await fetch('http://127.0.0.1:9253/json')).json();
  const page = pages.find(p => p.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  ws.onmessage = ({ data }) => {
    const result = JSON.parse(data); if (result.id !== 1) return;
    const state = result.result.result.value;
    fs.writeFileSync(__dirname + '/evidence/browser/diagnostic.json', JSON.stringify(state, null, 2));
    console.log(JSON.stringify(state));
    if (process.argv.includes('--close')) { ws.send(JSON.stringify({ id: 2, method: 'Browser.close' })); setTimeout(() => ws.close(), 500); }
    else ws.close();
  };
  ws.send(JSON.stringify({ id: 1, method: 'Runtime.evaluate', params: { expression: '({path:location.pathname,title:document.title,state:document.readyState,text:document.querySelector("main")?.innerText.slice(0,1800),loginForm:!!document.querySelector("input[name=password]")})', returnByValue: true } }));
})().catch(e => { console.log(e.message); process.exitCode = 1; });
