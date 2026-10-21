/* eslint-disable @typescript-eslint/no-require-imports -- Real client navigation with test-only read gates. */
const assert = require('node:assert/strict'), fs = require('node:fs');
module.exports = async function ({ users, candidate, session, port, tenantHost, save, ok }) {
  const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
  async function until(expression, label) {
    for (let i=0;i<250;i++) { if (await session.evaluate(expression)) return; await pause(40); }
    throw Error(label);
  }
  async function goto(route) {
    await session.send('Page.navigate',{url:`http://${tenantHost}:${port}${route}`});
    await until(`document.readyState==='complete' && location.pathname===${JSON.stringify(route)} && !!document.querySelector('main') && !document.querySelector('main [data-wp-loading]')`, 'SOURCE_NOT_READY');
    await pause(300);
  }
  await session.send('Page.addScriptToEvaluateOnNewDocument',{source:`window.__loadingErrors=[];window.addEventListener('error',()=>window.__loadingErrors.push('runtime'));window.addEventListener('unhandledrejection',()=>window.__loadingErrors.push('promise'));const report=console.error;console.error=(...args)=>{window.__loadingErrors.push('console');report.apply(console,args)};`});
  const matrix=[];
  async function transition({route, model, kind, width, employee=false}) {
    globalThis.__loadingModel=model; globalThis.__loadingReleases=[];
    try {
      await goto(employee ? (model==='payrollEntry'?'/employee/profile':'/employee/payroll') : '/dashboard/hiring/jobs');
      await session.evaluate(`window.__loadingDocument=document;window.__loadingHeader=document.querySelector('header');window.__loadingAside=document.querySelector('aside');true`);
      if (!employee && width<768) {
        await session.evaluate(`document.querySelector('button[aria-label="Open navigation"]').click();true`); await pause(100);
      }
      await session.evaluate(`document.querySelectorAll('${!employee && width<768?'dialog':'aside'} button[aria-expanded=false]').forEach(b=>b.click());true`);
      await pause(100);
      const selector=employee ? (width<768?'main nav':'aside') : (width<768?'dialog':'aside');
      assert(await session.evaluate(`(()=>{const a=document.querySelector(${JSON.stringify(selector)})?.querySelector('a[href="${route}"]');if(!a)return false;a.click();return true})()`), 'Rendered navigation link missing');
      await until(`!!document.querySelector('[data-wp-loading="${kind}"]')?.getClientRects().length`, 'FALLBACK_NOT_SHOWN');
      const result=await session.evaluate(`(()=>{const root=document.querySelector('[data-wp-loading="${kind}"]');const nodes=[root,...root.querySelectorAll('*')];return {overflow:document.documentElement.scrollWidth>innerWidth,clientNavigation:window.__loadingDocument===document,headerRetained:window.__loadingHeader===document.querySelector('header'),sidebarRetained:window.__loadingAside===document.querySelector('aside'),animated:nodes.some(e=>getComputedStyle(e).animationName!=='none'),dark:nodes.some(e=>{const c=getComputedStyle(e).backgroundColor.match(/[\\d.]+/g);return c&&c.length===3&&c.every(n=>Number(n)<100)})}})()`);
      assert(!result.overflow && result.clientNavigation && result.headerRetained && result.sidebarRetained && !result.animated && !result.dark);
      matrix.push({route,width,kind,...result}); save('transitions',matrix);
    } finally {
      globalThis.__loadingModel=null;
      for(const resolve of globalThis.__loadingReleases||[])resolve();
    }
    await until(`location.pathname===${JSON.stringify(route)} && !document.querySelector('main [data-wp-loading]')`, 'FALLBACK_DID_NOT_RESOLVE');
    assert.equal(await session.evaluate('window.__loadingErrors.length'),0,'Browser error during normal navigation');
  }
  if (!process.env.LOADING_GALLERY_ONLY) {
  const hrCases=[
    {route:'/dashboard/hiring/applicants',model:'application',kind:'hiring'},
    {route:'/dashboard/hiring/assessments',model:'assessment',kind:'hiring'},
    {route:'/dashboard/hiring/offers',model:'offer',kind:'hiring'},
    {route:'/dashboard/hiring/onboarding',model:'onboardingProcess',kind:'hiring'},
    {route:'/dashboard/employees/exit',model:'separationCase',kind:'list'},
    {route:'/dashboard/leave/balances',model:'leaveType',kind:'list'},
    {route:'/dashboard/payroll',model:'payrollPeriod',kind:'payroll'},
  ];
  for(const width of [375,768,1280]) {
    await session.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    await session.send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:width===375?'reduce':'no-preference'}]});
    for(const row of hrCases) await transition({...row,width});
  }
  ok(true,'21 real HR transitions show light, static, responsive fallbacks, preserve shell and resolve without browser errors');
  const {SignJWT}=await import('jose');
  const user=users.EMPLOYEE;
  const token=await new SignJWT({userId:user.id,organizationId:user.organizationId,role:user.role,name:user.name,email:user.email}).setProtectedHeader({alg:'HS256'}).setIssuedAt().setExpirationTime('10m').sign(new TextEncoder().encode(process.env.SESSION_SECRET));
  await session.send('Network.clearBrowserCookies');
  await session.send('Network.setCookie',{name:'__Host-workpulse_session',value:token,url:`http://${tenantHost}:${port}`,path:'/',secure:true,httpOnly:true,sameSite:'Lax'});
  for(const width of [375,768,1280]) {
    await session.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    for(const row of [
      {route:'/employee/profile',model:'employee',kind:'detail'},
      {route:'/employee/attendance',model:'dailyAttendanceRecord',kind:'calendar'},
      {route:'/employee/leave',model:'leaveRequest',kind:'list'},
      {route:'/employee/payroll',model:'payrollEntry',kind:'records'},
    ]) await transition({...row,width,employee:true});
  }
  ok(true,'12 real employee transitions preserve navigation, fit all widths and complete');
  await session.send('Network.clearBrowserCookies');
  await session.send('Network.setCookie',{name:'__Host-workpulse_session',value:session.cookie.split('=').slice(1).join('='),url:`http://${tenantHost}:${port}`,path:'/',secure:true,httpOnly:true,sameSite:'Lax'});
  globalThis.__loadingFailure='offer';
  try {
    await goto('/dashboard/hiring/jobs');
    await session.evaluate(`window.__errorHeader=document.querySelector('header');document.querySelectorAll('aside button[aria-expanded=false]').forEach(b=>b.click());true`);
    await pause(100);
    await session.evaluate(`document.querySelector('aside a[href="/dashboard/hiring/offers"]').click();true`);
    await until(`document.querySelector('main')?.innerText.includes('Something went wrong while loading this page')`, 'ERROR_BOUNDARY_NOT_SHOWN');
    assert(await session.evaluate(`!document.querySelector('main [data-wp-loading]')&&window.__errorHeader===document.querySelector('header')`));
    save('error-boundary',{injectedReadFailureReachedExistingBoundary:true,loadingRemoved:true,headerRetained:true,expectedConsoleErrorExcludedFromNormalFlows:true});
  } finally { globalThis.__loadingFailure=null; }
  ok(true,'Injected read failure reaches existing error boundary and replaces loading feedback while preserving the header');
  await session.send('Network.clearBrowserCookies');
  await goto(`/careers/${tenantHost.split('.')[0]}/portal/${candidate.id}`);
  const anonymous=await session.evaluate(`({verification:document.body.innerText.includes('Candidate email verification'),identityDisclosed:document.body.innerText.includes('Pipeline Candidate')})`);
  assert(anonymous.verification&&!anonymous.identityDisclosed); save('anonymous-candidate',anonymous);
  await session.send('Page.navigate',{url:`http://${tenantHost}:${port}/employee`});
  await until(`location.pathname==='/login' && !!document.querySelector('input[name=password]')`,'AUTH_REDIRECT_FAILED');
  ok(true,'Anonymous candidate still sees verification only; protected employee navigation still redirects to login');
  }
  // Render every actual shared variant using the production stylesheet, without
  // adding a gallery route or test delay to application code.
  const gallery=JSON.parse(fs.readFileSync('storage/loading-consistency/gallery.json'));
  await session.evaluate(`document.body.style.cssText='display:block;width:100%;min-width:0;margin:0';document.body.innerHTML='<main id="loading-gallery" style="width:100%;min-width:0;padding:24px;max-width:1100px;margin:auto"></main>';true`);
  const responsive=[];
  for(const width of [375,768,1280]) {
    await session.send('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width<768});
    for(const markup of gallery) {
      await session.evaluate(`document.querySelector('main').innerHTML=${JSON.stringify(markup)};true`);
      const row=await session.evaluate(`(()=>{const root=document.querySelector('[data-wp-loading]');return {kind:root.dataset.wpLoading,overflow:document.documentElement.scrollWidth>innerWidth,animated:[...root.querySelectorAll('*')].some(e=>getComputedStyle(e).animationName!=='none')}})()`);
      responsive.push({width,...row}); save('all-variants',responsive);
      if(row.overflow) save('overflow-detail',await session.evaluate(`({width:innerWidth,scroll:document.documentElement.scrollWidth,nodes:[...document.querySelectorAll('body *')].filter(e=>e.getClientRects().length&&e.getBoundingClientRect().right>innerWidth+1).slice(0,15).map(e=>({tag:e.tagName,cls:e.className,width:e.getBoundingClientRect().width,x:e.getBoundingClientRect().x,overflow:getComputedStyle(e).overflowX}))})`));
      assert(!row.overflow&&!row.animated, `Variant ${row.kind} overflow or motion at ${width}`);
    }
  }
  save('all-variants',responsive);
  save('browser-result',{passed:true,realTransitions:matrix.length,variants:gallery.length,variantViewportChecks:responsive.length,viewports:[375,768,1280]});
  ok(true,'All skeleton variants fit 375, 768 and 1280px without animation, including reduced motion');
};
