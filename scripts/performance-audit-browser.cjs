// Headless Chrome/CDP. Collects timing/counts only; no page data, cookies or request URLs saved.
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
module.exports = async ({ port, token, directory }) => {
  const chrome = spawn('C:/Program Files/Google/Chrome/Application/chrome.exe', ['--headless=new', '--disable-gpu', '--no-proxy-server', '--no-first-run', '--no-default-browser-check', '--disable-background-networking', '--remote-debugging-port=9228', `--user-data-dir=${path.resolve('.next/audit-browser')}`, 'about:blank'], { stdio: 'ignore', windowsHide: true });
  let ws;
  try {
    let pages;
    for (let i=0;i<100;i++) { try { pages = await (await fetch('http://127.0.0.1:9228/json')).json(); if(pages.length) break; } catch {} await pause(100); }
    if(!pages?.length) throw Object.assign(new Error(), { code: 'CHROME_UNAVAILABLE' });
    ws = new WebSocket((pages.find(p=>p.type==='page') || pages[0]).webSocketDebuggerUrl);
    await new Promise((resolve,reject) => { ws.onopen = resolve; ws.onerror=reject; });
    let id=0, events=[], pending=new Map();
    ws.onmessage = ({data}) => { const message=JSON.parse(data); if(message.id) { const p=pending.get(message.id); pending.delete(message.id); message.error ? p?.reject(new Error(message.error.message)) : p?.resolve(message.result); } else events.push(message); };
    function send(method,params={}) { return new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));}); }
    const evaluate = async expression => (await send('Runtime.evaluate', { expression, returnByValue:true, awaitPromise:true })).result.value;
    await send('Network.enable'); await send('Page.enable');
    await send('Network.setExtraHTTPHeaders', { headers: { 'x-forwarded-host':`saga.localhost:${port}`, Cookie:`__Host-workpulse_session=${token}` } });
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const base = `http://127.0.0.1:${port}`;
    const results=[];
    const navigation = await send('Page.navigate',{url:base+'/dashboard/hiring/pipeline'});
    await pause(10000);
    const initialResponses=events.filter(e=>e.method==='Network.responseReceived');
    const initialTypes=new Map(initialResponses.map(e=>[e.params.requestId,e.params.type]));
    const initialResources=await evaluate(`performance.getEntriesByType('resource').map(r=>({initiator:r.initiatorType,encodedBytes:r.encodedBodySize,decodedBytes:r.decodedBodySize,durationMs:Math.round(r.duration)}))`);
    fs.writeFileSync(`${directory}/browser-initial.json`,JSON.stringify({route:'Hiring pipeline',navigationError:navigation.errorText,documentState:await evaluate(`({protocol:location.protocol,pathname:location.pathname,main:!!document.querySelector('main'),sidebarLinks:document.querySelectorAll('aside a').length})`),networkFailures:events.filter(e=>e.method==='Network.loadingFailed').map(e=>({type:e.params.type,error:e.params.errorText})),captureWindowMs:10000,requests:events.filter(e=>e.method==='Network.requestWillBeSent').length,scriptRequests:initialResponses.filter(e=>e.params.type==='Script').length,scriptTransferredBytes:events.filter(e=>e.method==='Network.loadingFinished'&&initialTypes.get(e.params.requestId)==='Script').reduce((sum,e)=>sum+e.params.encodedDataLength,0),resources:initialResources},null,2));
    const routes=[['Applicants','/dashboard/hiring/applicants'],['Attendance','/dashboard/attendance'],['Leave','/dashboard/leave'],['Payroll','/dashboard/payroll'],['Analytics','/dashboard/analytics'],['Hiring','/dashboard/hiring/pipeline']];
    for(let cycle=0;cycle<3;cycle++) for(const [name,route] of routes) {
      // Expand navigation groups so the normal sidebar Link handles the click.
      await evaluate(`document.querySelectorAll('aside button[aria-expanded="false"]').forEach(b=>b.click())`);
      await pause(300);
      events=[];
      const clicked=await evaluate(`(()=>{const a=[...document.querySelectorAll('aside a')].find(a=>a.getAttribute('href')===${JSON.stringify(route)});if(!a)return false;window.__auditStart=performance.now();window.__auditMutations=0;window.__auditLast=performance.now();window.__auditObserver?.disconnect();window.__auditObserver=new MutationObserver(()=>{window.__auditLast=performance.now();window.__auditMutations++});window.__auditObserver.observe(document.querySelector('main'),{subtree:true,childList:true,characterData:true});a.click();return true})()`);
      if(!clicked){results.push({route:name,cycle,status:'Not measured: sidebar link unavailable'});fs.writeFileSync(`${directory}/browser.json`,JSON.stringify(results,null,2));continue;}
      let state, elapsed=0;
      while(elapsed<30000){await pause(100);elapsed+=100;state=await evaluate(`({path:location.pathname,mutations:window.__auditMutations,quiet:performance.now()-window.__auditLast,settled:window.__auditLast-window.__auditStart,loading:!!document.querySelector('main [role="status"]'),error:/Something went wrong|Unable to load|could not be loaded|Try again/i.test(document.querySelector('main')?.innerText||'')})`);if(state.path===route&&state.mutations>0&&state.quiet>600&&!state.loading)break;}
      const requests=events.filter(e=>e.method==='Network.requestWillBeSent');
      const responses=events.filter(e=>e.method==='Network.responseReceived');
      results.push({route:name,cycle,settledDomMs:Math.round(state.settled),completed:elapsed<30000,renderedError:state.error,networkRequests:requests.length,documentRequests:requests.filter(e=>e.params.type==='Document').length,rscRequests:requests.filter(e=>e.params.request.headers.RSC==='1'||e.params.request.url.includes('_rsc=')).length,failedResponses:responses.filter(e=>e.params.response.status>=400).map(e=>({type:e.params.type,status:e.params.response.status})),transferredBytes:events.filter(e=>e.method==='Network.loadingFinished').reduce((sum,e)=>sum+e.params.encodedDataLength,0)});
      fs.writeFileSync(`${directory}/browser.json`,JSON.stringify(results,null,2));
      console.log(JSON.stringify({browserRoute:name,cycle,...results.at(-1)}));
    }
  } finally { ws?.close();chrome.kill(); }
};
