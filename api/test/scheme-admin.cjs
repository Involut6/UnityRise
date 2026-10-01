// Super-admin investment management: node test/scheme-admin.cjs  (API running; ADMIN_EMAIL/ADMIN_PASSWORD = super admin)
const B = process.env.API || 'http://localhost:3000/api';
const call = async (m, p, t, b) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(t && { authorization: 'Bearer ' + t }) }, body: b && JSON.stringify(b) }); const x = await r.text(); let j; try { j = JSON.parse(x); } catch { j = x; } return { s: r.status, j }; };
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
(async () => {
  const login = async (e, pw) => (await call('POST', '/auth/login', null, { email: e, password: pw })).j.token;
  const sup = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const members = (await call('GET', '/members?status=approved', sup)).j.filter(m => /^ada/.test(m.email));
  // pick a plain member (earlier runs may have promoted some test users) with the most savings
  const roles = {}; for (const m of members) { const t = await login(m.email, 'password123'); roles[m.id] = (await call('GET', '/auth/me', t)).j.role; }
  const plain = members.filter(m => roles[m.id] === 'member').sort((a, b) => Number(b.savings) - Number(a.savings));
  const investor = plain[0]; const inv = await login(investor.email, 'password123');
  // a non-super admin to prove who may edit
  const other = plain.find(m => m.id !== investor.id); const otherTok = await login(other.email, 'password123'); const me = (await call('GET', '/auth/me', otherTok)).j;
  await call('PUT', `/admin/users/${me.id}/role`, sup, { role: 'admin' }); const adm = await login(other.email, 'password123');
  const mk = async () => (await call('POST', '/investments', sup, { title: 'Edit test ' + Date.now(), category: 'agriculture', targetAmount: 500000, minAmount: 10000, durationMonths: 12, projectedRoiPct: 15, riskProfile: 'medium', description: 'original' })).j;

  let s = await mk(); ok('draft created', s.status === 'draft', s);
  let r = await call('PATCH', `/investments/${s.id}`, sup, { title: 'Renamed draft', projectedRoiPct: 18 }); ok('draft edit needs no reason', r.s === 200 && r.j.changed.includes('title'), r);
  r = await call('PATCH', `/investments/${s.id}`, adm, { title: 'hack' }); ok('non-super admin cannot edit (403)', r.s === 403, r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { title: 'Renamed draft' }); ok('no-op edit rejected', r.s === 400, r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { targetAmount: 5, minAmount: 0 }); ok('invalid values rejected by validation', r.s === 400, r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { minAmount: 900000 }); ok('minimum above target rejected', r.s === 400, r);
  ok('approve draft', (await call('POST', `/investments/${s.id}/approve`, sup)).s < 300);
  const before = Number((await call('GET', '/savings', inv)).j.balance);
  ok('member invests 50,000', (await call('POST', `/investments/${s.id}/subscribe`, inv, { amount: 50000 })).s < 300);
  r = await call('PATCH', `/investments/${s.id}`, sup, { projectedRoiPct: 20 }); ok('live edit without reason rejected', r.s === 400 && /reason/i.test(r.j.message), r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { targetAmount: 40000, reason: 'test' }); ok('target below amount raised rejected', r.s === 400 && /already raised/.test(r.j.message), r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { projectedRoiPct: 20, durationMonths: 10, reason: 'Revised after due diligence' }); ok('live edit with reason succeeds', r.s === 200 && r.j.scheme.projected_roi_pct === '20.00', r);
  const notes = (await call('GET', '/notifications', inv)).j; ok('investors are notified of material changes', notes.some(n => n.title === 'Investment terms updated'));
  ok('investor money untouched by an edit', Number((await call('GET', '/savings', inv)).j.balance) === before - 50000);
  r = await call('PATCH', `/investments/${s.id}`, sup, { targetAmount: 50000, reason: 'Cap at exactly what is raised' }); ok('target equal to raised auto-closes', r.j.scheme.status === 'closed', r.j.scheme && r.j.scheme.status);
  r = await call('POST', `/investments/${s.id}/status`, sup, { action: 'reopen', reason: 'try' }); ok('cannot reopen a fully subscribed scheme', r.s === 400, r);
  await call('PATCH', `/investments/${s.id}`, sup, { targetAmount: 200000, reason: 'Raise target' });
  r = await call('POST', `/investments/${s.id}/status`, sup, { action: 'reopen', reason: 'More room' }); ok('reopen works once there is room', r.s < 300 && r.j.status === 'open', r);
  r = await call('POST', `/investments/${s.id}/status`, sup, { action: 'close' }); ok('status change needs a reason', r.s === 400, r);
  r = await call('POST', `/investments/${s.id}/status`, sup, { action: 'close', reason: 'Pause' }); ok('close works', r.j.status === 'closed', r);
  const m = (await call('GET', `/investments/${s.id}/manage`, sup)).j;
  ok('manage payload: investors, raised, projected figures', m.investors === 1 && m.raised === 50000 && m.projectedPayout === 60000 && m.confirmedPayout === null, { investors: m.investors, raised: m.raised, p: m.projectedPayout });
  ok('edit history recorded with before/after', m.edits.length >= 4 && m.edits.some(e => e.changes.projectedRoiPct && e.changes.projectedRoiPct.from === 18 && e.changes.projectedRoiPct.to === 20), m.edits.map(e => Object.keys(e.changes)));
  ok('admin can read manage view', (await call('GET', `/investments/${s.id}/manage`, adm)).s === 200);
  ok('member cannot read manage view', (await call('GET', `/investments/${s.id}/manage`, inv)).s === 403);
  // matured is final
  await call('POST', `/investments/${s.id}/status`, sup, { action: 'reopen', reason: 'Reopen to mature' });
  ok('declare maturity', (await call('POST', `/investments/${s.id}/mature`, sup, { actualReturnPct: 10 })).s < 300);
  r = await call('PATCH', `/investments/${s.id}`, sup, { projectedRoiPct: 99, reason: 'nope' }); ok('matured scheme: financial fields locked', r.s === 400, r);
  r = await call('PATCH', `/investments/${s.id}`, sup, { description: 'Final report added', reason: 'Add closing note' }); ok('matured scheme: description editable', r.s === 200, r);
  const f = (await call('GET', `/investments/${s.id}/manage`, sup)).j; ok('confirmed payout shown after maturity', f.confirmedPayout === 55000 && f.confirmedReturnPct === 10, { c: f.confirmedPayout, p: f.confirmedReturnPct });
  console.log(bad ? bad + ' FAILED' : 'all passed'); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
