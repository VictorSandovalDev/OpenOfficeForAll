import { spawn } from 'node:child_process';
// Browsers can carry many localhost cookies from other projects; allow large headers instead of failing with HTTP 431.
const HEADERS = '--max-http-header-size=65536';
const children = [spawn(process.execPath, [HEADERS, 'server/index.mjs'], { stdio: 'inherit' }), spawn(process.execPath, [HEADERS, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1'], { stdio: 'inherit' })];
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill('SIGTERM'); setTimeout(() => process.exit(code), 300).unref(); }
for (const child of children) { child.on('error', (error) => { console.error(error.message); stop(1); }); child.on('exit', (code) => stop(code ?? 0)); }
process.on('SIGINT', () => stop()); process.on('SIGTERM', () => stop());
