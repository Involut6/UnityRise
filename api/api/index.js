// Vercel function entry (project root = this `api` folder, so this file is served under /api/*).
// All requests are rewritten here by vercel.json; Nest does the routing. `dist` is produced by `npm run build`.
module.exports = require('../dist/serverless').default;
