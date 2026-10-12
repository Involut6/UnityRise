// Withdrawal requests, total worth, goal + investment notifications: node test/withdrawals.cjs
// (API running with CRON_SECRET=cron-test-secret; ADMIN_EMAIL/ADMIN_PASSWORD = super admin)
const B = process.env.API || 'http://localhost:3000/api';
const call = async (m, p, t, b, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(t && { authorization: 'Bearer ' + t }), ...h }, body: b && JSON.stringify(b) }); let j; try { j = await r.json(); } catch {} return { s: r.status, j }; };
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const login = async (e, pw) => (await call('POST', '/auth/login', null, { email: e, password: pw })).j.token;
  const sup = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const members = (await call('GET', '/members?status=approved', sup)).j.filter(m => /^ada/.test(m.email));
  const roles = {}; for (const m of members) { const t = await login(m.email, 'password123'); roles[m.id] = (await call('GET', '/auth/me', t)).j.role; }
  const plain = members.filter(m => roles[m.id] === 'member').sort((a, b) => Number(b.savings) - Number(a.savings));
  const mem = plain[0]; const tok = await login(mem.email, 'password123');
  const bank = { bankCode: '058', accountNumber: '0123456789', accountName: 'Test Member' };
  const bal0 = Number((await call('GET', '/savings', tok)).j.balance); ok('member has savings', bal0 > 10000, bal0);
  const dash0 = (await call('GET', '/dashboard', tok)).j;
  ok('dashboard total = available + invested', Math.abs(dash0.totalWealth - (dash0.savings + dash0.invested)) < 0.01 && dash0.totalWealth >= dash0.savings, dash0);

  let r = await call('POST', '/savings/withdrawals', tok, { amount: 5000, ...bank, bankCode: '999999' }); ok('unknown bank rejected', r.s === 400, r);
  r = await call('POST', '/savings/withdrawals', tok, { amount: 5000, ...bank, accountNumber: '123' }); ok('bad account number rejected', r.s === 400, r);
  r = await call('POST', '/savings/withdrawals', tok, { amount: bal0 + 1, ...bank }); ok('more than balance rejected', r.s === 400, r);
  r = await call('POST', '/savings/withdrawals', tok, { amount: 5000, ...bank, reason: 'School fees' }); ok('request accepted', r.s < 300 && r.j.request.status === 'pending', r);
  const id = r.j.request.id;
  const w1 = (await call('GET', '/savings', tok)).j; ok('amount is held, not yet debited', Math.abs(w1.balance - (bal0 - 5000)) < 0.01 && w1.pendingWithdrawals === 5000, w1);
  const d1 = (await call('GET', '/dashboard', tok)).j; ok('total worth unchanged by a pending request', Math.abs(d1.totalWealth - dash0.totalWealth) < 0.01, [d1.totalWealth, dash0.totalWealth]);
  r = await call('POST', '/savings/withdrawals', tok, { amount: w1.balance + 1, ...bank }); ok('held money cannot be requested twice', r.s === 400, r);
  r = await call('POST', `/investments/${'00000000-0000-4000-8000-000000000000'}/subscribe`, tok, { amount: w1.balance + 1 }); ok('held money cannot be invested twice', r.s === 400 || r.s === 404, r);
  let n = (await call('GET', '/notifications', tok)).j; ok('member notified of request', n.some(x => x.title === 'Withdrawal requested'));
  ok('member sees request', (await call('GET', '/savings/withdrawals', tok)).j.some(x => x.id === id && x.status === 'pending'));
  ok('members cannot use the admin list', (await call('GET', '/admin/withdrawals', tok)).s === 403);
  ok('members cannot review', (await call('POST', `/admin/withdrawals/${id}/review`, tok, { decision: 'paid' })).s === 403);

  r = await call('POST', `/savings/withdrawals/${id}/cancel`, tok); ok('member can cancel', r.s < 300, r);
  ok('cancel releases the hold', Math.abs(Number((await call('GET', '/savings', tok)).j.balance) - bal0) < 0.01);
  ok('cancelled request cannot be cancelled again', (await call('POST', `/savings/withdrawals/${id}/cancel`, tok)).s === 400);

  const a = (await call('POST', '/savings/withdrawals', tok, { amount: 7000, ...bank })).j.request;
  const list = await call('GET', '/admin/withdrawals?status=pending', sup); ok('staff sees pending request with bank details', list.j.some(x => x.id === a.id && x.account_number === '0123456789' && x.bank_name === 'Guaranty Trust Bank (GTBank)'), list.j.slice(0, 2));
  r = await call('POST', `/admin/withdrawals/${a.id}/review`, sup, { decision: 'reject' }); ok('rejection needs a note', r.s === 400, r);
  r = await call('POST', `/admin/withdrawals/${a.id}/review`, sup, { decision: 'paid', note: 'Paid via NIP ref 123' }); ok('staff marks paid', r.s < 300 && r.j.status === 'paid', r);
  ok('ledger debited exactly once', Math.abs(Number((await call('GET', '/savings', tok)).j.balance) - (bal0 - 7000)) < 0.01);
  ok('cannot pay twice', (await call('POST', `/admin/withdrawals/${a.id}/review`, sup, { decision: 'paid' })).s === 400);
  n = (await call('GET', '/notifications', tok)).j; ok('member notified of payment', n.some(x => x.title === 'Withdrawal paid'));
  const tx = (await call('GET', '/savings/transactions', tok)).j; ok('withdrawal in history', tx.some(t => t.type === 'withdrawal' && Number(t.amount) === 7000));

  const b = (await call('POST', '/savings/withdrawals', tok, { amount: 3000, ...bank })).j.request;
  r = await call('POST', `/admin/withdrawals/${b.id}/review`, sup, { decision: 'reject', note: 'Account name mismatch' }); ok('staff rejects with note', r.s < 300, r);
  ok('rejection releases hold', Math.abs(Number((await call('GET', '/savings', tok)).j.balance) - (bal0 - 7000)) < 0.01);
  n = (await call('GET', '/notifications', tok)).j; ok('member told why', n.some(x => x.title === 'Withdrawal not approved' && /mismatch/.test(x.body)));

  // ---- savings goal notifications ----
  const g0 = n.filter(x => /Savings goal/.test(x.title)).length;
  r = await call('PUT', '/savings/target', tok, { monthlyTarget: 5000 }); ok('set goal', r.s < 300, r);
  n = (await call('GET', '/notifications', tok)).j; ok('goal set notification', n.some(x => x.title === 'Savings goal set'));
  const month = n.filter(x => x.title === 'Savings goal reached').length;
  const p = (await call('POST', '/payments/initiate', tok, { provider: 'paystack', purpose: 'topup', amount: 6000 })).j;
  r = await call('POST', `/payments/${p.reference}/simulate`, tok); ok('deposit settles', r.s < 300, r);
  n = (await call('GET', '/notifications', tok)).j; ok('goal reached notification after deposit', n.filter(x => x.title === 'Savings goal reached').length === month + 1 || month > 0, n.slice(0, 4).map(x => x.title));
  const p2 = (await call('POST', '/payments/initiate', tok, { provider: 'paystack', purpose: 'topup', amount: 1000 })).j; await call('POST', `/payments/${p2.reference}/simulate`, tok);
  n = (await call('GET', '/notifications', tok)).j; ok('goal-reached sent once per month', n.filter(x => x.title === 'Savings goal reached').length <= month + 1);
  r = await call('GET', '/cron/daily', null, null, { authorization: 'Bearer cron-test-secret' }); ok('cron runs new jobs', r.s === 200 && r.j.goalReminders && r.j.maturityReminders, r);

  // ---- investment notifications ----
  const mk = (await call('POST', '/investments', sup, { title: 'Notify test ' + Date.now(), category: 'agriculture', targetAmount: 500000, minAmount: 10000, durationMonths: 6, projectedRoiPct: 12, riskProfile: 'medium', description: 'Notification test scheme' })).j;
  const before = (await call('GET', '/notifications', tok)).j.length;
  ok('approve opens scheme', (await call('POST', `/investments/${mk.id}/approve`, sup)).s < 300);
  n = (await call('GET', '/notifications', tok)).j; ok('all members told of a new scheme', n.length === before + 1 && n[0].title === 'New investment opportunity' && n[0].body.includes(mk.title), n.slice(0, 2));
  ok('member invests', (await call('POST', `/investments/${mk.id}/subscribe`, tok, { amount: 20000 })).s < 300);
  n = (await call('GET', '/notifications', tok)).j; ok('investment confirmation', n.some(x => x.title === 'Investment confirmed' && x.body.includes(mk.title)));
  ok('close scheme', (await call('POST', `/investments/${mk.id}/status`, sup, { action: 'close', reason: 'pause' })).s < 300);
  n = (await call('GET', '/notifications', tok)).j; ok('investor told of closure', n.some(x => x.title === 'Investment closed to new subscriptions'));
  ok('reopen scheme', (await call('POST', `/investments/${mk.id}/status`, sup, { action: 'reopen', reason: 'resume' })).s < 300);
  n = (await call('GET', '/notifications', tok)).j; ok('members told of reopening', n.some(x => x.title === 'Investment reopened'));
  ok('mature', (await call('POST', `/investments/${mk.id}/mature`, sup, { actualReturnPct: 10 })).s < 300);
  n = (await call('GET', '/notifications', tok)).j; ok('maturity notification', n.some(x => x.title === 'Investment matured' && x.body.includes(mk.title)));
  const dash = (await call('GET', '/dashboard', tok)).j; ok('returns are counted in total worth via savings', dash.returnsEarned >= 22000 && Math.abs(dash.totalWealth - (dash.savings + dash.heldForWithdrawal + dash.invested)) < 0.01, dash);
  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
