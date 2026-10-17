/* eslint-disable @typescript-eslint/no-require-imports -- Direct Node CommonJS browser diagnostic. */
// Normal password login and content checks. No credentials/cookies/page text saved.
const {spawn}=require('node:child_process');
const path=require('node:path');
const pause=ms=>new Promise(r=>setTimeout(r,ms));
module.exports=async function browser({port,production,email,password,employeeLogin=false}){
  const debugPort=production?9231:9230,origin='http://saga.localhost:'+port;
  const chrome=spawn('C:/Program Files/Google/Chrome/Application/chrome.exe',['--headless=new','--disable-gpu','--no-proxy-server','--no-first-run','--no-default-browser-check','--disable-background-networking','--host-resolver-rules=MAP saga.localhost 127.0.0.1','--remote-debugging-port='+debugPort,'--user-data-dir='+path.resolve('.next/recovery-browser-'+port),'about:blank'],{windowsHide:true,stdio:'ignore'});
  let ws;const pending=new Map();let next=0,events=[];
  const error=code=>Object.assign(new Error(code),{code});
  try{
    let page;
    for(let i=0;i<100;i++){try{const list=await(await fetch('http://127.0.0.1:'+debugPort+'/json')).json();page=list.find(p=>p.type==='page');if(page)break;}catch{}await pause(100);}
    if(!page)throw error('BROWSER_UNAVAILABLE');
    ws=new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
    ws.onmessage=({data})=>{const m=JSON.parse(data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);if(m.error)p.reject(error('CDP_COMMAND_FAILED'));else p.resolve(m.result);}}else events.push(m);};
    ws.onclose=()=>{for(const p of pending.values()){clearTimeout(p.timer);p.reject(error('BROWSER_CLOSED'));}pending.clear();};
    function send(method,params={}){return new Promise((resolve,reject)=>{const id=++next,timer=setTimeout(()=>{pending.delete(id);reject(error('CDP_TIMEOUT'));},90000);pending.set(id,{resolve,reject,timer});ws.send(JSON.stringify({id,method,params}));});}
    async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw error('BROWSER_EVALUATION_FAILED');return r.result.value;}
    await send('Page.enable');await send('Network.enable');await send('Runtime.enable');await send('Network.clearBrowserCookies');await send('Network.clearBrowserCache');
    await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
    const nav=await send('Page.navigate',{url:origin+'/login'});if(nav.errorText)throw error('LOGIN_NAVIGATION_FAILED');
    let ready=false;
    for(let i=0;i<900;i++){ready=await evaluate('document.readyState==="complete"&&!!document.querySelector("input[name=password]")');if(ready)break;await pause(100);}
    if(!ready)throw error('LOGIN_FORM_UNAVAILABLE');await pause(1200);
    await evaluate('(()=>{document.querySelector("input[name=email]").value='+JSON.stringify(email)+';document.querySelector("input[name=password]").value='+JSON.stringify(password)+';document.querySelector("input[name=password]").form.requestSubmit();return true})()');
    let loggedIn=false;
    for(let i=0;i<900;i++){const state=await evaluate('({path:location.pathname,success:'+ (employeeLogin?'location.pathname==="/employee"&&/My Dashboard/i.test(document.querySelector("main")?.innerText||"")':'!!document.querySelector("aside")&&/Welcome Back,/.test(document.querySelector("main")?.innerText||"")')+',loginError:!!document.querySelector("form p[role=alert]")})');if(state.success){loggedIn=true;break;}if(state.loginError)throw error('NORMAL_LOGIN_REJECTED');await pause(100);}
    if(!loggedIn)throw error('NORMAL_LOGIN_TIMEOUT');
    const cookies=(await send('Network.getAllCookies')).cookies.filter(c=>c.name===(production?'__Host-workpulse_session':'workpulse_session'));
    if(cookies.length!==1)throw error('NORMAL_SESSION_COOKIE_MISSING');
    const cookie=cookies.map(c=>c.name+'='+c.value).join('; ');
    async function navigate({name,route,expected,sidebar}){
      if(sidebar){await evaluate('document.querySelectorAll("aside button[aria-expanded=false]").forEach(b=>b.click())');await pause(200);}
      events=[];
      const expression='(()=>{const a=[...document.querySelectorAll('+JSON.stringify((sidebar?'aside':'main')+' a')+')].find(a=>a.getAttribute("href")==='+JSON.stringify(route)+');if(!a)return false;window.__recoveryStart=performance.now();window.__recoveryLast=performance.now();window.__recoveryMutations=0;window.__recoveryObserver?.disconnect();window.__recoveryObserver=new MutationObserver(()=>{window.__recoveryLast=performance.now();window.__recoveryMutations++});window.__recoveryObserver.observe(document.querySelector("main"),{subtree:true,childList:true,characterData:true});a.click();return true})()';
      if(!await evaluate(expression))return {route:name,status:'Not measured: rendered link unavailable'};
      let state,completed=false;
      for(let i=0;i<900;i++){
        await pause(100);
        state=await evaluate('(()=>{const t=document.querySelector("main")?.innerText||"";return {path:location.pathname,expected:'+JSON.stringify(expected)+'.every(x=>t.toLowerCase().includes(x.toLowerCase())),error:/Something went wrong while loading|could not be completed|Unable to load|Access Denied/.test(t),loading:!!document.querySelector("main [role=status]"),quiet:performance.now()-window.__recoveryLast,mutations:window.__recoveryMutations,ms:window.__recoveryLast-window.__recoveryStart}})()');
        if(state.error)break;if(state.path===route&&state.expected&&!state.loading&&state.mutations>0&&state.quiet>600){completed=true;break;}
      }
      const requests=events.filter(e=>e.method==='Network.requestWillBeSent');
      return {route:name,completed,expectedContent:state?.expected||false,renderedError:state?.error||false,navigationMs:Math.round(state?.ms||0),networkRequests:requests.length,documentRequests:requests.filter(e=>e.params.type==='Document').length,failedHttpResponses:events.filter(e=>e.method==='Network.responseReceived'&&e.params.response.status>=400).map(e=>e.params.response.status),runtimeExceptions:events.filter(e=>e.method==='Runtime.exceptionThrown').length};
    }
    return {cookie,navigate,close:async()=>{await send('Network.clearBrowserCookies').catch(()=>{});await send('Network.clearBrowserCache').catch(()=>{});ws?.close();chrome.kill();await pause(200);}};
  }catch(e){ws?.close();chrome.kill();throw e;}
};
