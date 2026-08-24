// Seed (or reset) a user. Usage:
//   node seed-admin.mjs --email ramki@nexivo.co --name "Ramki" --role admin [--remote] [--password 'x']
// Generates a strong password when --password is omitted, prints it ONCE, and
// upserts the user via wrangler d1 execute (--local default, --remote for prod).
import { execFileSync } from 'node:child_process';
import { webcrypto as crypto } from 'node:crypto';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i > -1 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const email = String(arg('email', '')).trim().toLowerCase();
const role = arg('role', 'sales');
if (!email || !['admin', 'sales'].includes(role)) { console.error('need --email and role admin|sales'); process.exit(1); }
if (!/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(email)) { console.error('invalid email'); process.exit(1); }
const name = arg('name', email.split('@')[0]);

const password = arg('password') || [...crypto.getRandomValues(new Uint8Array(18))].map((b) => 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'.charAt(b % 56)).join('');
const salt = crypto.getRandomValues(new Uint8Array(16));
const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: 100000 }, key, 256);

const escapedEmail = email.replace(/'/g, "''");
const escapedName = name.replace(/'/g, "''");
const sql = `INSERT INTO users(email,name,password_hash,password_salt,role,provider,status) VALUES ('${escapedEmail}','${escapedName}','${toHex(bits)}','${toHex(salt.buffer)}','${role}','local','active')
ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash, password_salt=excluded.password_salt, name=excluded.name, role=excluded.role, status='active'`;
const db = arg('db', 'epe-quote'); // --db epe-quote-staging targets the staging database
execFileSync('npx', ['wrangler', 'd1', 'execute', db, flag('remote') ? '--remote' : '--local', '--command', sql], { stdio: ['inherit', 'inherit', 'inherit'] });
console.log(`\nUser ${email} (${role}) seeded into ${db}. PASSWORD (shown once): ${password}\n`);
