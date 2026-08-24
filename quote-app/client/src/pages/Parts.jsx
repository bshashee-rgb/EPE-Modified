import React, { useEffect, useState } from 'react';
import { api, fmtINR } from '../api.js';
import CopyCode from '../components/CopyCode.jsx';

export default function Parts({ nav }) {
  const [parts, setParts] = useState(null);
  const [quotes, setQuotes] = useState([]);
  const [q, setQ] = useState('');
  const [pickFor, setPickFor] = useState(null); // the part awaiting a quote choice
  const [busy, setBusy] = useState(false);

  // only open (Draft) quotes are editable, so those are the ones a part can be added to
  const loadQuotes = () => api.get('/api/quotes').then((qs) => setQuotes(qs.filter((x) => x.status === 'Draft')));
  useEffect(() => { api.get('/api/parts').then(setParts); loadQuotes(); }, []);
  useEffect(() => {
    if (!pickFor) return;
    const onKey = (e) => { if (e.key === 'Escape' && !busy) setPickFor(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [pickFor, busy]);
  if (!parts) return <p className="muted">Loading parts…</p>;

  const filtered = parts.filter((p) => !q || (p.part_number + ' ' + p.name).toLowerCase().includes(q.toLowerCase()));

  const openPicker = (p) => { loadQuotes(); setPickFor(p); };

  async function addLine(quoteId) {
    await api.post(`/api/quotes/${quoteId}/lines`, { kind: 'part', part_id: pickFor.id, qty: 1 });
    setPickFor(null);
    nav('quote/' + quoteId);
  }
  async function addToQuote(quoteId) { setBusy(true); try { await addLine(quoteId); } finally { setBusy(false); } }
  async function addToNewQuote() {
    setBusy(true);
    try { const nq = await api.post('/api/quotes', {}); await addLine(nq.id); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <h1>Parts & Spares (fixed part numbers)</h1>
      <div className="searchbar"><input placeholder="Search part number or name…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
      <table className="list">
        <thead><tr><th>Part number</th><th>Name</th><th>Product family</th><th>Price</th><th></th></tr></thead>
        <tbody>
          {filtered.map((p) => (
            <tr key={p.id}>
              <td><CopyCode text={p.part_number} title="Copy part number"><span style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{p.part_number}</span></CopyCode></td>
              <td>{p.name}</td>
              <td className="muted">{p.family_name || '—'}</td>
              <td>{p.price != null ? fmtINR(p.price) : <span className="pill warn">PoA</span>}</td>
              <td><button className="btn secondary small" onClick={() => openPicker(p)}>Add to Quote</button></td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan="5" className="muted">No parts match “{q}”.</td></tr>}
        </tbody>
      </table>

      {pickFor && (
        <div className="modal-overlay" onClick={() => !busy && setPickFor(null)}>
          <div className="modal-card" role="dialog" aria-modal="true" aria-label="Choose a quotation" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>Add to quote</h3>
            <p className="muted" style={{ marginTop: 0 }}>
              Add <b>{pickFor.part_number}</b> — {pickFor.name} to which quotation?
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.8rem', maxHeight: '50vh', overflowY: 'auto' }}>
              {quotes.length === 0 && (
                <p className="muted" style={{ margin: 0 }}>No open (Draft) quotations yet — create a new one below.</p>
              )}
              {quotes.map((qt) => (
                <button key={qt.id} className="btn secondary" disabled={busy} onClick={() => addToQuote(qt.id)}>
                  {qt.number} Rev {qt.revision} — {qt.customer_name || 'No customer'}
                  <div className="modal-sub">{qt.line_count} line{qt.line_count === 1 ? '' : 's'} · {qt.status} · {qt.quote_date || (qt.created_at || '').slice(0, 10)}</div>
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.9rem' }}>
              <button className="btn" disabled={busy} onClick={addToNewQuote}>＋ New quote</button>
              <button className="btn secondary" disabled={busy} onClick={() => setPickFor(null)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
