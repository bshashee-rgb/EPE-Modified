// Temporary local-credential auth. Zoho swap contract: only verifyCredentials
// (and the login form) get replaced by the Zoho OAuth exchange; sessions,
// middleware, and roles stay. Identity key is EMAIL throughout.
import { sign, verify } from 'hono/jwt';
import { setCookie, getCookie, deleteCookie } from 'hono/cookie';

export const COOKIE_NAME = 'epe_session';
export const PBKDF2_ITERATIONS = 100000;
const SESSION_HOURS = 8;

const toHex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex) => new Uint8Array(hex.match(/.{2}/g).map((h) => parseInt(h, 16)));

export async function hashPassword(password, saltHex) {
  const salt = saltHex ? fromHex(saltHex) : crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS }, key, 256);
  return { hash: toHex(bits), salt: toHex(salt.buffer ?? salt) };
}

export async function verifyPassword(password, saltHex, hashHex) {
  const { hash } = await hashPassword(password, saltHex);
  // constant-time compare
  if (hash.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < hash.length; i++) diff |= hash.charCodeAt(i) ^ hashHex.charCodeAt(i);
  return diff === 0;
}

// THE ZOHO SEAM: everything above/below this function survives the swap.
export async function verifyCredentials(DB, email, password) {
  const user = await DB.prepare("SELECT * FROM users WHERE email=? AND status='active'").bind(String(email || '').trim().toLowerCase()).first();
  if (!user) return null;
  const ok = await verifyPassword(String(password || ''), user.password_salt, user.password_hash);
  return ok ? user : null;
}

export async function createSession(c, user) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_HOURS * 3600;
  const token = await sign({ sub: user.email, name: user.name, role: user.role, exp }, c.env.SESSION_SECRET);
  setCookie(c, COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'Lax', path: '/', maxAge: SESSION_HOURS * 3600 });
}

export async function getSession(c) {
  const token = getCookie(c, COOKIE_NAME);
  if (!token) return null;
  try { return await verify(token, c.env.SESSION_SECRET, 'HS256'); } catch { return null; }
}

export function clearSession(c) {
  deleteCookie(c, COOKIE_NAME, { path: '/' });
}
