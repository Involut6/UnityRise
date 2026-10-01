const fs=require('fs'),path=require('path'),{Client}=require('pg');
(async()=>{
  const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
  await c.query('create table if not exists _migrations(name text primary key, ran_at timestamptz default now())');
  for(const f of fs.readdirSync(__dirname).filter(f=>f.endsWith('.sql')).sort()){
    if((await c.query('select 1 from _migrations where name=$1',[f])).rowCount) continue;
    await c.query('begin');try{await c.query(fs.readFileSync(path.join(__dirname,f),'utf8'));await c.query('insert into _migrations(name) values($1)',[f]);await c.query('commit');console.log('applied',f)}catch(e){await c.query('rollback');throw e}
  }
  await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
