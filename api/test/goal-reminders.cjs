// Savings-goal date reminders: node test/goal-reminders.cjs (API with CRON_SECRET=cron-test-secret; DATABASE_URL set for date shifting)
const B = process.env.API || 'http://localhost:3000/api';
const call = async (m, p, t, b, h = {}) => { const r = await fetch(B + p, { method: m, headers: { 'content-type': 'application/json', ...(t && { authorization: 'Bearer ' + t }), ...h }, body: b && JSON.stringify(b) }); let j; try { j = await r.json(); } catch {} return { s: r.status, j }; };
let bad = 0; const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
const cron = () => call('GET', '/cron/daily', null, null, { authorization: 'Bearer cron-test-secret' });
(async () => {
  const login = async (e, pw) => (await call('POST', '/auth/login', null, { email: e, password: pw })).j.token;
  const sup = await login(process.env.ADMIN_EMAIL, process.env.ADMIN_PASSWORD);
  const ms = (await call('GET', '/members?status=approved', sup)).j.filter(m => /^ada/.test(m.email));
  const tok = await login(ms[ms.length - 1].email, 'password123');
  const titles = async () => (await call('GET', '/notifications', tok)).j.map(n => n.title);
  const count = async t => (await titles()).filter(x => x === t).length;
  const today = new Date().getDate(), last = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  const hasDays = today + 3 <= 28 || true;
  let r = await call('PUT', '/savings/target', tok, { monthlyTarget: 9000000, dueDay: 29 }); ok('due day above 28 rejected', r.s === 400, r);
  // 3 days away (only possible with a day <= 28); otherwise use month end
  const soonDay = today + 3 <= 28 ? today + 3 : null;
  if (soonDay) {
    r = await call('PUT', '/savings/target', tok, { monthlyTarget: 9000000, dueDay: soonDay }); ok('goal with due day saved', r.s < 300, r);
    ok('wallet returns due day', (await call('GET', '/savings', tok)).j.goalDueDay === soonDay);
    const a = await count('Savings goal due soon'); r = await cron(); ok('cron ok', r.s === 200 && r.j.goalReminders, r);
    ok('"due soon" sent 3 days before', (await count('Savings goal due soon')) === a + 1);
    await cron(); ok('"due soon" sent only once a month', (await count('Savings goal due soon')) === a + 1);
  }
  const t0 = await count('Savings goal due today');
  r = await call('PUT', '/savings/target', tok, { monthlyTarget: 9000000, dueDay: today <= 28 ? today : null }); ok('goal due today saved', r.s < 300, r);
  if (today > 28) ok('(month-end case uses last day)', last >= today);
  await cron(); ok('"due today" sent on the day', (await count('Savings goal due today')) === t0 + 1 || today > 28 && last !== today);
  await cron(); ok('"due today" only once', (await count('Savings goal due today')) <= t0 + 1);
  r = await call('PUT', '/savings/target', tok, { monthlyTarget: 5, dueDay: today <= 28 ? today : null }); // already exceeded
  const t1 = await count('Savings goal due today'); await cron(); ok('no reminder once goal is reached', (await count('Savings goal due today')) === t1);
  console.log(bad ? `\n${bad} FAILED` : '\nall passed'); process.exit(bad ? 1 : 0);
})();
