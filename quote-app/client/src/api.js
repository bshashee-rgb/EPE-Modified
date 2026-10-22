import { toast } from './toast.js';

let actor = 'sales';
export const setActor = (a) => { actor = a; };
export const getActor = () => actor;

// Global hook so App can flip back to the Login screen when a session expires
// mid-use (any api call gets a 401). Registered by App on mount.
let onUnauthorized = null;
export const setUnauthorizedHandler = (fn) => { onUnauthorized = fn; };

// opts.quiet: caller shows its own inline error, so skip the global toast.
async function req(method, url, body, opts = {}) {
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'X-Actor': actor },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkErr) {
    if (!opts.quiet) toast('Cannot reach the server — check your connection and try again.');
    throw Object.assign(new Error('Network error'), { detail: { error: 'Network error' } });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error || 'Request failed';
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    if (!opts.quiet) toast(message);
    throw Object.assign(new Error(message), { detail: err, status: res.status });
  }
  return res.json();
}

// Multipart upload — deliberately skips the JSON Content-Type/stringify path above so the
// browser can set its own multipart boundary; mirrors req()'s error/401/toast handling.
async function upload(url, formData, opts = {}) {
  let res;
  try {
    res = await fetch(url, { method: 'POST', headers: { 'X-Actor': actor }, body: formData });
  } catch (networkErr) {
    if (!opts.quiet) toast('Cannot reach the server — check your connection and try again.');
    throw Object.assign(new Error('Network error'), { detail: { error: 'Network error' } });
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    const message = err.error || 'Upload failed';
    if (res.status === 401 && onUnauthorized) onUnauthorized();
    if (!opts.quiet) toast(message);
    throw Object.assign(new Error(message), { detail: err, status: res.status });
  }
  return res.json();
}

export const api = {
  get: (url, opts) => req('GET', url, undefined, opts),
  post: (url, body, opts) => req('POST', url, body, opts),
  patch: (url, body, opts) => req('PATCH', url, body, opts),
  del: (url, opts) => req('DELETE', url, undefined, opts),
  upload,
};

export const fmtINR = (n) =>
  n == null ? 'PoA' : new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);

// Fallback shown before GET /api/fx-rates (which offers the full ~166-currency list) resolves.
export const CURRENCIES = ['INR', 'USD', 'EUR', 'GBP'];

// Amounts are always stored in INR; fxRate is the quote's stored INR->currency
// snapshot (1 for INR itself) so a converted total stays fixed once set. Intl derives
// the correct symbol/decimal places from the currency code itself, so one locale works
// for any of the ~166 codes the FX provider returns.
export const fmtMoney = (inrAmount, currency, fxRate) => {
  if (inrAmount == null) return 'PoA';
  if (!currency || currency === 'INR') return fmtINR(inrAmount);
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(inrAmount * (fxRate || 1));
};
