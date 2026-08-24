// Minimal global toast bus so no API failure is ever invisible (UI-1).
let seq = 0;
const listeners = new Set();
const items = [];

export function subscribeToasts(fn) { listeners.add(fn); return () => listeners.delete(fn); }
const emit = () => listeners.forEach((fn) => fn([...items]));

export function toast(message, type = 'error', ttl = 5000) {
  const id = ++seq;
  items.push({ id, message: String(message || 'Something went wrong'), type });
  emit();
  setTimeout(() => dismissToast(id), ttl);
  return id;
}
export function dismissToast(id) {
  const i = items.findIndex((t) => t.id === id);
  if (i >= 0) { items.splice(i, 1); emit(); }
}
