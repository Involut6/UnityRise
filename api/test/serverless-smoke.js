// Exercises the serverless handler through a plain Node http server (no Vercel CLI needed):
//   node --env-file=.env test/serverless-smoke.js   (after `npm run build`; needs PAYSTACK_WEBHOOK_SECRET set)
const http = require('http'); const { createHmac } = require('crypto');
const handler = require('../dist/serverless').default;
const srv = http.createServer((req, res) => handler(req, res));
const secret = process.env.PAYSTACK_WEBHOOK_SECRET || 'whsec_test_123';
const call = (port, method, path, body, headers = {}) => new Promise((resolve, reject) => {
  const data = body === undefined ? undefined : (typeof body === 'string' ? body : JSON.stringify(body));
  const r = http.request({ port, method, path, headers: { ...(data && { 'content-type': 'application/json', 'content-length': Buffer.byteLength(data) }), ...headers } }, res => { let t = ''; res.on('data', c => (t += c)); res.on('end', () => resolve({ s: res.statusCode, t })); });
  r.on('error', reject); if (data) r.write(data); r.end();
});
(async () => {
  await new Promise(r => srv.listen(0, r)); const port = srv.address().port; let bad = 0;
  const ok = (n, c, x) => { console.log((c ? 'PASS ' : 'FAIL ') + n + (c ? '' : ' ' + JSON.stringify(x))); if (!c) bad++; };
  let r = await call(port, 'GET', '/api/health'); ok('GET /api/health reaches the database', r.s === 200 && JSON.parse(r.t).ok, r);
  r = await call(port, 'POST', '/api/auth/login', { email: process.env.ADMIN_EMAIL, password: process.env.ADMIN_PASSWORD }); ok('POST JSON body is parsed (login)', r.s === 201 && !!JSON.parse(r.t).token, r);
  r = await call(port, 'POST', '/api/auth/login', '{bad json', { 'content-type': 'application/json' }); ok('malformed JSON -> 400', r.s === 400, r);
  r = await call(port, 'GET', '/api/auth/me'); ok('protected route without token -> 401', r.s === 401, r);
  const body = JSON.stringify({ data: { reference: 'does-not-exist', status: 'success', amount: 100000 } });
  r = await call(port, 'POST', '/api/payments/webhook/paystack', body, { 'x-paystack-signature': createHmac('sha512', secret).update(body).digest('hex'), 'content-type': 'application/json' });
  ok('webhook raw-body signature verifies (valid sig reaches business logic, unknown ref -> 400)', r.s === 400, r);
  r = await call(port, 'POST', '/api/payments/webhook/paystack', body, { 'x-paystack-signature': 'deadbeef', 'content-type': 'application/json' }); ok('webhook bad signature -> 401', r.s === 401, r);
  r = await call(port, 'GET', '/api/cron/daily'); ok('cron disabled/unauthorised without secret', [401, 404].includes(r.s), r);
  if (process.env.CRON_SECRET) { r = await call(port, 'GET', '/api/cron/daily', undefined, { authorization: 'Bearer ' + process.env.CRON_SECRET }); ok('cron runs with the secret', r.s === 200 && 'penalties' in JSON.parse(r.t), r); }
  srv.close(); process.exit(bad ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
