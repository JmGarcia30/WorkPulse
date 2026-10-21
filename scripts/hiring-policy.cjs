/* eslint-disable @typescript-eslint/no-require-imports -- Verified disposable fixtures and local build checks. */
const fs=require('node:fs'),path=require('node:path'),Module=require('node:module');
const {spawn,execFileSync}=require('node:child_process');
const helper=require('./batch0-recovery-environment.cjs'),config=helper.configuration();
const directory='docs/hiring-policy';fs.mkdirSync(directory,{recursive:true});
const mode=process.argv[2];
if(mode==='integration'){
 let source=fs.readFileSync('scripts/functional-rollback-browser.cjs','utf8');
 source=source.replace(/^const directory = .*;$/m,`const directory = '${directory}/integration';`);
 source=source.replace('schemaChanges: false, fallbackConnectionReadOnly: true','schemaChanges: true, schemaChangesRollbackOnly: true, fallbackConnectionReadOnly: true');
 source=source.replace('      globalThis.prisma = fixtureClient(tx);',`      await tx.$executeRawUnsafe(fs.readFileSync('prisma/migrations/20261022000100_hiring_document_policy/migration.sql','utf8'));
      globalThis.prisma = fixtureClient(tx);`);
 source=source.replace('      if (candidateOnly) {',`      await require('./test-hiring-policy-integration.cjs')({tx,org,foreign,users,primary,job,candidate,session,port,tenantHost,save,ok});
      await session.close(); session=null;
      await new Promise(resolve=>server.close(resolve)); server=null;
      await app.close(); app=null;
      throw rollback;
      if (candidateOnly) {`);
 source=source.replace('    await db.$disconnect(); helper.assertOriginalUnchanged(config);', `    const columns=await db.$queryRawUnsafe("SELECT count(*)::int AS count FROM information_schema.columns WHERE table_schema='public' AND table_name='Organization' AND column_name='hiringDocumentRequirements'");
    save('migration-rollback',{testedMigration:'20261022000100_hiring_document_policy',columnAbsentAfterRollback:columns[0].count===0,productionMigrationsRun:false});
    if(columns[0].count!==0)throw Error('TEST_SCHEMA_NOT_ROLLED_BACK');
    await db.$disconnect(); helper.assertOriginalUnchanged(config);`);
 for(const name of ['FR_IDENTITY_REVIEW','FR_CANDIDATE_DOCUMENTS','FR_PROFILE_SECURITY','FR_SECURITY_BASELINE','FR_ROLE_ONLY'])delete process.env[name];
 const filename=path.resolve('scripts/functional-rollback-browser.cjs'),mod=new Module(filename,module);mod.filename=filename;mod.paths=module.paths;mod._compile(source,filename);
}else{
 const changed=execFileSync('git',['ls-files','--modified','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(f=>f&&!f.startsWith('.impeccable/')&&fs.existsSync(f));
 const commands={build:['node_modules/next/dist/bin/next','build','--webpack'],typescript:['node_modules/typescript/bin/tsc','--noEmit'],prisma:['node_modules/prisma/build/index.js','validate'],lint:['node_modules/eslint/bin/eslint.js',...changed.filter(f=>/\.(tsx?|cjs)$/.test(f))],unit:['scripts/test-hiring-policy.cjs'],security:['scripts/test-hiring-candidate-security.cjs'],documents:['scripts/test-candidate-document-headers.cjs']};
 if(!commands[mode])throw Error('UNKNOWN_MODE');
 const env={...config.environment,NODE_ENV:'production',DATABASE_URL:helper.readOnly(config.pooled),H10_TEST_DATABASE_URL:helper.readOnly(config.direct)};
 const start=performance.now(),child=spawn(process.execPath,commands[mode],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});
 let output='';for(const stream of [child.stdout,child.stderr])stream.on('data',part=>output+=part);
 child.on('exit',code=>{fs.writeFileSync(`${directory}/${mode}.json`,JSON.stringify({exitCode:code,elapsedMs:Math.round(performance.now()-start),output:output.replace(/postgres(?:ql)?:\/\/\S+/gi,'[CONNECTION]').replace(/[\w.+-]+@[\w.-]+/g,'[EMAIL]').split(/\r?\n/).filter(Boolean).slice(-100)},null,2));helper.assertOriginalUnchanged(config);console.log(JSON.stringify({mode,exitCode:code}));process.exitCode=code||0;});
}
