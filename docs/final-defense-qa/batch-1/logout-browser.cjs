module.exports = `
    const logoutCookie=(await send('Network.getAllCookies')).cookies.find(c=>c.name==='__Host-workpulse_session'&&c.domain==='localhost');
    assert(logoutCookie,'Employee must have a session before logout');
    await evaluate(${JSON.stringify('document.querySelector(\'header button[aria-haspopup="dialog"]\').click();true')});
    await until("[...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Sign out')");
    await evaluate("[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Sign out').click();true");
    await until("location.pathname==='/saga/login'&&!!document.querySelector('input[name=password]')");
    const browserCleared=!(await send('Network.getAllCookies')).cookies.some(c=>c.name==='__Host-workpulse_session'&&c.domain==='localhost');
    ok(browserCleared,'ordinary ESS logout expires the production host-only cookie in Chrome');
    const grant=await db.staffSession.findUnique({where:{tokenHash:require('node:crypto').createHash('sha256').update(logoutCookie.value).digest('hex')},select:{userId:true}});
    const replay=await new Promise((resolve,reject)=>{const req=request({hostname:'127.0.0.1',port,path:'/saga/employee',method:'GET',headers:{host:'localhost:'+port,Cookie:logoutCookie.name+'='+logoutCookie.value}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,loginRedirect:String(res.headers.location||'').includes('/login')}));});req.on('error',reject);req.end();});
    ok(!grant&&[303,307].includes(replay.status)&&replay.loginRedirect,'ordinary logout revokes copied token and protected ESS replay redirects to login');
    require(require('node:path').resolve('docs/final-defense-qa/qa-runner.cjs')).save('ordinary-logout',{status:browserCleared&&!grant&&replay.loginRedirect?'PASS':'FAIL',cookieRemoved:browserCleared,persistedSessionExists:!!grant,protectedHttpStatus:replay.status,loginRedirect:replay.loginRedirect});
`;
