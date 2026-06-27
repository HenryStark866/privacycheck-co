/**
 * Setea una variable en Vercel (production) con bytes EXACTOS (sin BOM/CRLF).
 * Uso: node scripts/set-vercel-env.mjs NOMBRE valor
 */
import { spawnSync } from 'node:child_process';

const name = process.argv[2];
const value = process.argv[3];
if (!name || value === undefined) {
  console.error('Uso: node scripts/set-vercel-env.mjs NOMBRE valor');
  process.exit(1);
}
const opts = { encoding: 'utf8', shell: true };

let r = spawnSync('vercel', ['env', 'rm', name, 'production', '-y'], opts);
console.log('rm:', ((r.stdout || '') + (r.stderr || '')).split('\n').slice(-2).join(' ').trim());
r = spawnSync('vercel', ['env', 'add', name, 'production'], { ...opts, input: value });
console.log('add:', ((r.stdout || '') + (r.stderr || '')).split('\n').filter((l) => l.includes('Added') || l.includes('Error')).join(' ').trim());
console.log(`${name} = ${JSON.stringify(value)}  ${r.status === 0 ? 'OK' : 'FALLO'}`);
