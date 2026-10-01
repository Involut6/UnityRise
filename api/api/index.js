// Vercel function entry (project root = this `api` folder, so this file is served under /api/*).
// All requests are rewritten here by vercel.json; Nest does the routing. `dist` is produced by `npm run build`.
let handler;
try {
  handler = require('../dist/serverless').default;
} catch (e) {
  // Typically a missing/invalid environment variable. Say so plainly instead of crashing the function.
  const message = 'Server failed to start: ' + String(e && e.message).split('\n').slice(0, 6).join(' ').slice(0, 400);
  console.error(message);
  handler = (req, res) => { res.statusCode = 500; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ statusCode: 500, message })); };
}
module.exports = handler;
