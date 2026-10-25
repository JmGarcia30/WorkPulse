// In-memory persistence for request-boundary tests; PostgreSQL trigger/concurrency tests use the real database suite.
module.exports=function installStaffAuthModels(db){
 const sessions=new Map(),attempts=new Map();
 db.$transaction??=async operation=>operation(db);
 db.$queryRaw??=async()=>[];
 db.platformAuthenticationAttempt??={
  findUnique:async({where})=>attempts.get(where.key),
  update:async({where})=>{attempts.get(where.key).attempts++;},
  upsert:async({where,create,update})=>attempts.set(where.key,attempts.has(where.key)?update:create),
 };
 db.staffSession={
  create:async({data})=>{sessions.set(data.tokenHash,data);return data;},
  findUnique:async({where})=>{const row=sessions.get(where.tokenHash);return row?{...row,user:await db.user.findUnique({where:{id:row.userId}})}:null;},
  deleteMany:async({where})=>{let count=0;for(const [key,row]of sessions)if((!where.tokenHash||key===where.tokenHash)&&(!where.organizationId||row.organizationId===where.organizationId)){sessions.delete(key);count++;}return{count};},
 };
};
