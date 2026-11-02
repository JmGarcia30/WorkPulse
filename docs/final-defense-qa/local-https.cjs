const fs=require('node:fs'),https=require('node:https'),assert=require('node:assert/strict');
exports.createServer=handler=>https.createServer({key:fs.readFileSync('.next/final-defense-qa-tls/key.pem'),cert:fs.readFileSync('.next/final-defense-qa-tls/cert.pem')},(req,res)=>{
  const setHeader=res.setHeader;
  res.setHeader=function(name,value){
    if(String(name).toLowerCase()==='set-cookie')for(const cookie of Array.isArray(value)?value:[String(value)]){
      if(cookie.startsWith('__Host-workpulse_session=')&&/expires=Thu, 01 Jan 1970|max-age=0/i.test(cookie)){
        require('./qa-runner.cjs').save('session-deletion-header',{path:req.url.split('?')[0],name:'__Host-workpulse_session',secure:/;\s*secure(?:;|$)/i.test(cookie),httpOnly:/;\s*httponly(?:;|$)/i.test(cookie),pathRoot:/;\s*path=\/(?:;|$)/i.test(cookie),hasDomain:/;\s*domain=/i.test(cookie),expiresSession:true});
      }
    }
    return setHeader.call(this,name,value);
  };return handler(req,res);
});
exports.request=(options,callback)=>{assert.equal(options.hostname,'127.0.0.1');return https.request({...options,rejectUnauthorized:false},callback);};
