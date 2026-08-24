import React, { useState } from 'react';

// Small copy-to-clipboard control shown next to an ordering code / part number.
// `text` is what gets copied; children (optional) render the visible code, otherwise
// the button is icon-only (for compact rows). Works with a legacy fallback when the
// async clipboard API is unavailable (e.g. non-secure context).
export default function CopyCode({ text, children, className = '', title = 'Copy code' }) {
  const [copied, setCopied] = useState(false);
  if (!text) return children || null;

  function legacyCopy(value) {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  async function copy(e) {
    e.stopPropagation();
    let ok = false;
    if (navigator.clipboard && window.isSecureContext) {
      try { await navigator.clipboard.writeText(text); ok = true; }
      catch { ok = legacyCopy(text); } // async API can reject (focus/permissions) — fall back
    } else {
      ok = legacyCopy(text);
    }
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 1400); }
  }

  return (
    <span className={'copycode ' + className}>
      {children}
      <button type="button" className="copybtn" onClick={copy}
        title={copied ? 'Copied!' : title} aria-label={copied ? 'Copied' : title}>
        {copied ? '✓' : '⧉'}
      </button>
    </span>
  );
}
