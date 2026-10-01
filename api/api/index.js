// Vercel function entry (project root = this `api` folder, so this file is served under /api/*).
// All requests are rewritten here by vercel.json; Nest does the routing. `dist` is produced by `npm run build`.
// The app is native ES modules (Nest 12 is ESM-only) and is loaded with dynamic import(), which works on every
// Node version and in serverless runtimes that disable require() of ES modules.
let appHandler; let startupError;
const load = async () => {
  if (appHandler || startupError) return;
  try { appHandler = (await import('../dist/serverless.js')).default; }
  catch (e) {
    // Typically a missing/invalid environment variable. Say so plainly (the message only names settings, never values).
    startupError = 'Server failed to start: ' + String((e && e.message) || e).split('\n').slice(0, 6).join(' ').slice(0, 400);
    console.error(startupError);
  }
};

export default async function handler(req, res) {
  await load();
  if (appHandler) return appHandler(req, res);
  // CORS headers on the failure response so the browser shows this message instead of an opaque "CORS error".
  res.setHeader('access-control-allow-origin', '*');
  res.setHeader('access-control-allow-headers', 'content-type, authorization');
  res.setHeader('access-control-allow-methods', 'GET,POST,PUT,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.statusCode = 204; res.end(); return; }
  res.statusCode = 500; res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({ statusCode: 500, message: startupError }));
}
