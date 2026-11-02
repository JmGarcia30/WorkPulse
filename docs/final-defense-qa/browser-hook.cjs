module.exports = `
    const layoutRows=[];
    const routes=['/dashboard','/dashboard/hiring/jobs','/dashboard/hiring/jobs/new','/dashboard/hiring/pipeline','/dashboard/hiring/interviews','/dashboard/hiring/assessments','/dashboard/hiring/offers','/dashboard/hiring/onboarding','/dashboard/employees','/dashboard/employees/exit','/dashboard/attendance','/dashboard/attendance/schedules','/dashboard/attendance/rfid','/dashboard/leave','/dashboard/leave/balances','/dashboard/leave/settings','/dashboard/payroll','/dashboard/organization','/dashboard/analytics'];
    await send('Runtime.enable');
    await send('Page.addScriptToEvaluateOnNewDocument',{source:'window.__qaRuntimeErrors=0;window.addEventListener("error",()=>window.__qaRuntimeErrors++);window.addEventListener("unhandledrejection",()=>window.__qaRuntimeErrors++)'});
    for(const width of [1280,390,320]) {
      await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<768});
      for(const route of routes) {
        await go('http://'+org.slug+'.localhost:'+port+route,"!!document.querySelector('main') && !document.querySelector('main [data-wp-loading]')");
        const row=await evaluate('({path:location.pathname,heading:document.querySelector("h1")?.textContent,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth,hasMain:!!document.querySelector("main"),renderedError:/Application error|Something went wrong|Unable to load|could not be loaded/.test(document.body.innerText),runtimeErrors:window.__qaRuntimeErrors||0,emptyState:/No .*yet|No .*found|No .*available|Get started|Create your first|No employees|No payroll/.test(document.querySelector("main")?.innerText||""),forms:document.querySelectorAll("main form").length})');
        row.width=width;row.expectedRoute=route;row.status=row.path===route&&row.hasMain&&!row.renderedError&&!row.runtimeErrors&&row.scrollWidth<=width?'PASS':'FAIL';
        layoutRows.push(row);save('qa-layout-matrix',{rows:layoutRows});
        if(width===390&&['/dashboard/payroll','/dashboard/hiring/jobs/new','/dashboard/employees/exit'].includes(route)) {const shot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});fs.writeFileSync('docs/final-defense-qa/evidence/ui-'+route.split('/').slice(2).join('-')+'-390.png',Buffer.from(shot.data,'base64'));}
      }
    }
    await send('Emulation.clearDeviceMetricsOverride');
    await go('http://'+org.slug+'.localhost:'+port+'/dashboard',"!!document.querySelector('aside')");
`;
