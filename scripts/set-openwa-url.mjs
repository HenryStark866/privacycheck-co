/**
 * Setea OPENWA_API_URL en Vercel (production) con bytes EXACTOS:
 * sin BOM y sin salto de línea (el pipe de PowerShell los inyectaba).
 *
 * Uso: node scripts/set-openwa-url.mjs <url>
 */
import { spawnSync } from 'node:child_process';

const url = process.argv[2] || 'https://parties-stamps-mic-speak.trycloudflare.com';
const vercel = 'vercel';
const opts = { encoding: 'utf8', shell: true };

console.log('URL a guardar (exacta):', JSON.stringify(url));

let r = spawnSync(vercel, ['env', 'rm', 'OPENWA_API_URL', 'production', '-y'], opts);
console.log('--- rm ---\n' + ((r.stdout || '') + (r.stderr || '')).trim());
if (r.error) console.log('rm error:', r.error.message);

r = spawnSync(vercel, ['env', 'add', 'OPENWA_API_URL', 'production'], { ...opts, input: url });
console.log('--- add ---\n' + ((r.stdout || '') + (r.stderr || '')).trim());
if (r.error) console.log('add error:', r.error.message);

console.log(r.status === 0 ? '\nOK' : '\nFALLO (status ' + r.status + ')');
