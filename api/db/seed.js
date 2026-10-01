const bcrypt=require('bcryptjs'),{Client}=require('pg');
(async()=>{
  const email=process.env.ADMIN_EMAIL, pw=process.env.ADMIN_PASSWORD;
  if(!email||!pw||pw.length<12) throw new Error('Set ADMIN_EMAIL and ADMIN_PASSWORD (>=12 chars)');
  const c=new Client({connectionString:process.env.DATABASE_URL});await c.connect();
  await c.query("insert into users(email,password_hash,role) values($1,$2,'super_admin') on conflict(email) do nothing",[email.toLowerCase(),await bcrypt.hash(pw,12)]);
  console.log('super admin ready:',email);await c.end();
})().catch(e=>{console.error(e.message);process.exit(1)});
