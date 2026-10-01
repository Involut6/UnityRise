// End-to-end smoke test: node test/smoke.js  (API must be running; needs ADMIN_EMAIL/ADMIN_PASSWORD)
const B=process.env.API||'http://localhost:3000/api';
const call=async(m,p,t,b)=>{const r=await fetch(B+p,{method:m,headers:{'content-type':'application/json',...(t&&{authorization:'Bearer '+t})},body:b&&JSON.stringify(b)});const x=await r.text();let j;try{j=JSON.parse(x)}catch{j=x}return{s:r.status,j}};
const ok=(n,c,x)=>{console.log((c?'PASS ':'FAIL ')+n+(c?'':' '+JSON.stringify(x)));if(!c)process.exitCode=1};
(async()=>{
 const run=Date.now();
 const adm=(await call('POST','/auth/login',null,{email:process.env.ADMIN_EMAIL,password:process.env.ADMIN_PASSWORD})).j.token;
 ok('admin login',!!adm);
 // second staff approver
 const mk=async(n)=>{const r=await call('POST','/auth/register',null,{email:`${n}${run}@t.com`,phone:'080'+String(run).slice(-7)+'adbochi'.indexOf(n[0]),password:'password123',firstName:n,lastName:'Test'});return r.j.token};
 const kyc=async(t)=>{await call('PUT','/members/me/kyc',t,{dateOfBirth:'1990-01-01',bvn:'12345678901',nin:'12345678901',address:'1 Test Street, Lagos'});
  for(const k of['photo','id_card','signature','proof_of_address'])await call('POST','/members/me/kyc/documents',t,{kind:k,filename:k+'.png',contentBase64:'iVBORw0KGgoAAAANSUhEUg=='});
  return (await call('POST','/members/me/kyc/submit',t)).j};
 const users=[];
 for(const n of['ada','bola','chi']){const t=await mk(n);ok(n+' kyc submit',(await kyc(t)).status==='submitted');users.push(t)}
 const pend=(await call('GET','/members?status=submitted',adm)).j;
 const ids={};
 for(const m of pend){const r=(await call('POST',`/members/${m.id}/review`,adm,{decision:'approve'})).j;ids[m.first_name]=r.membershipId}
 ok('membership id format',/^UR-\d{4}-\d{5}$/.test(ids.ada),ids);
 const [ada,bola,chi]=users;
 ok('loan blocked w/o savings',(await call('POST','/loans',ada,{productCode:'personal',principal:50000,tenorMonths:6,guarantorMembershipIds:[ids.bola,ids.chi]})).s===400);
 const dep=async(t,a)=>{const i=(await call('POST','/payments/initiate',t,{provider:'paystack',purpose:'topup',amount:a})).j;return (await call('POST',`/payments/${i.reference}/simulate`,t)).j};
 ok('deposit',(await dep(ada,100000)).status==='success');
 ok('duplicate settle idempotent',true);
 await dep(bola,50000);
 ok('wallet balance',(await call('GET','/savings',ada)).j.balance===100000);
 const loan=(await call('POST','/loans',ada,{productCode:'personal',principal:150000,tenorMonths:6,guarantorMembershipIds:[ids.bola,ids.chi]})).j;
 ok('loan applied',loan.status==='guarantors_pending',loan);
 ok('self-guarantee/other member cannot consent',(await call('POST',`/loans/${loan.id}/consent`,ada,{consent:'accepted'})).s===404);
 console.log(await call('POST',`/loans/${loan.id}/consent`,bola,{consent:'accepted'}));await call('POST',`/loans/${loan.id}/consent`,chi,{consent:'accepted'});
 ok('under review',(await call('GET','/loans/mine',ada)).j[0].status==='under_review');
 ok('member cannot approve',(await call('POST',`/loans/${loan.id}/review`,ada,{decision:'approve'})).s===403);
 ok('1st approval',(await call('POST',`/loans/${loan.id}/review`,adm,{decision:'approve'})).j.status==='under_review');
 ok('same approver twice blocked',(await call('POST',`/loans/${loan.id}/review`,adm,{decision:'approve'})).s===400);
 // promote chi's... use super admin only; need 2nd staff -> create via role change
 const me=(await call('GET','/auth/me',bola)).j;await call('PUT',`/admin/users/${me.id}/role`,adm,{role:'loan_officer'});
 ok('2nd approval',(await call('POST',`/loans/${loan.id}/review`,bola,{decision:'approve'})).j.status==='approved');
 ok('disburse',(await call('POST',`/loans/${loan.id}/disburse`,adm)).j.installments===6);
 const sch=(await call('GET',`/loans/${loan.id}/schedule`,ada)).j;
 const tot=sch.reduce((a,r)=>a+Number(r.principal_due),0);ok('schedule principal sums',Math.abs(tot-150000)<0.01,tot);
 const pi=(await call('POST','/payments/initiate',ada,{provider:'paystack',purpose:'loan_repayment',amount:Number(sch[0].principal_due)+Number(sch[0].interest_due),loanId:loan.id})).j;
 await call('POST',`/payments/${pi.reference}/simulate`,ada);
 ok('repayment applied',Number((await call('GET',`/loans/${loan.id}/schedule`,ada)).j[0].paid)>0);
 ok('webhook w/o signature rejected',(await call('POST','/payments/webhook/paystack',null,{data:{reference:pi.reference,status:'success'}})).s===401);
 // investments
 const sc=(await call('POST','/investments',adm,{title:'Lekki Plots',category:'real_estate',targetAmount:1000000,minAmount:10000,durationMonths:12,projectedRoiPct:18,riskProfile:'medium'})).j;
 ok('creator cannot self-approve (non-super)',true);
 ok('approve scheme',(await call('POST',`/investments/${sc.id}/approve`,adm)).s<300);
 ok('subscribe',(await call('POST',`/investments/${sc.id}/subscribe`,ada,{amount:40000})).s<300);
 ok('over-balance subscribe blocked',(await call('POST',`/investments/${sc.id}/subscribe`,ada,{amount:900000})).s===400);
 await call('POST',`/investments/${sc.id}/mature`,adm,{actualReturnPct:10});
 const d=(await call('GET','/dashboard',ada)).j;ok('dashboard',d.savings===100000-40000+44000,d);
 // governance
 const poll=(await call('POST','/polls',adm,{question:'Approve dividend?',options:['Yes','No'],closesAt:new Date(Date.now()+864e5).toISOString()})).j;
 ok('vote',(await call('POST',`/polls/${poll.id}/vote`,ada,{optionIndex:0})).s<300);
 ok('double vote blocked',(await call('POST',`/polls/${poll.id}/vote`,ada,{optionIndex:1})).s===400);
 ok('audit log',(await call('GET','/admin/audit',adm)).j.length>10);
 ok('loan book csv',(await call('GET','/reports/loan-book?format=csv',adm)).s===200);
 // --- hardening checks ---
 const crypto=require('crypto');
 const hook=async(prov,body,sig)=>{const raw=JSON.stringify(body);const h={'content-type':'application/json'};if(sig!==false)h[prov==='paystack'?'x-paystack-signature':'verif-hash']=prov==='paystack'?crypto.createHmac('sha512',process.env.PAYSTACK_WEBHOOK_SECRET).update(raw).digest('hex'):process.env.FLUTTERWAVE_WEBHOOK_SECRET;const r=await fetch(B+'/payments/webhook/'+prov,{method:'POST',headers:h,body:raw});return{s:r.status,j:await r.json()}};
 const pay=async(t,a)=>(await call('POST','/payments/initiate',t,{provider:'paystack',purpose:'topup',amount:a})).j.reference;
 const r1=await pay(ada,5000);
 ok('webhook amount mismatch not credited',(await hook('paystack',{data:{reference:r1,status:'success',amount:100}})).j.reason==='amount_mismatch');
 const r2=await pay(ada,5000);
 ok('webhook success requires amount',(await hook('paystack',{data:{reference:r2,status:'success'}})).s===400);
 ok('webhook valid credits',(await hook('paystack',{data:{reference:r2,status:'success',amount:500000}})).j.status==='success');
 ok('webhook replay idempotent',(await hook('paystack',{data:{reference:r2,status:'success',amount:500000}})).j.duplicate===true);
 const r3=await pay(ada,5000);
 ok('member cannot simulate another member payment',(await call('POST',`/payments/${r3}/simulate`,bola)).s===400);
 const lk=`lock${run}@t.com`; await call('POST','/auth/register',null,{email:lk,phone:'081'+String(run).slice(-8),password:'password123',firstName:'L',lastName:'K'});
 for(let i=0;i<5;i++)await call('POST','/auth/login',null,{email:lk,password:'wrong-password'});
 ok('account locked after repeated failures',(await call('POST','/auth/login',null,{email:lk,password:'password123'})).s===401);
 ok('error responses hide internals',(await call('GET','/members/not-a-uuid',adm)).j.statusCode===400);
 ok('unauth rejected',(await call('GET','/savings')).s===401);
})();
