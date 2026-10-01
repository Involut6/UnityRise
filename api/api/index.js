// Vercel function entry (project root = this `api` folder, so this file is served under /api/*).
// All requests are rewritten here by vercel.json; Nest does the routing. `dist` is produced by `npm run build`.
let handler;
try {
  handler = require('../dist/serverless').default;
} catch (e) {
  // Typically a missing/invalid environment variable. Say so plainly (and with CORS headers, so the browser shows
  // this message instead of an opaque "CORS error"). The message only names settings; it never contains values.
  let message = 'Server failed to start: ' + String(e && e.message).split('\n').slice(0, 6).join(' ').slice(0, 400);
  if (/require\(\) of ES Module|ERR_REQUIRE_ESM/.test(message)) {
    message = `Node ${process.version} is too old for this app (needs 22.12 or newer). In Vercel: Project Settings > Build & Development > Node.js Version = 22.x (or 24.x), then redeploy. (${message.slice(0, 120)}...)`;
  }
  console.error(message);
  handler = (req, res) => {
    res.setHeader('access-control-allow-origin', '*');
    res.setHeader('access-control-allow-headers', 'content-type, authorization');
    res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
    if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
    res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ statusCode: 500, message }));
  };
}
module.exports = handler;
