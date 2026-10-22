import React, { useEffect, useState } from 'react';
import { api, fmtMoney } from '../api.js';

const STATUS_TONE = { Draft: 'slate', Sent: 'blue', Won: 'green', Lost: 'red', Expired: 'amber' };

// Lazy-loads one sibling quote's lines on first expand; caches the result so re-expanding
// doesn't re-fetch.
function SiblingRow({ q, currentLines, open, onToggle }) {
  const [full, setFull] = useState(null);
  useEffect(() => { if (open && !full) api.get('/api/quotes/' + q.id).then(setFull); }, [open]); // eslint-disable-line

  const currentByCode = new Map(currentLines.map((l) => [l.ordering_code, l]));

  return (
    <>
      <tr className="clickable" onClick={onToggle}>
        <td>
          <span className="accord-caret" style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none' }}>▸</span>{' '}
          {q.number} <span className="muted">Rev {q.revision}</span>
        </td>
        <td>{q.quote_date || q.created_at?.slice(0, 10)}</td>
        <td><span className={'pill st-' + (STATUS_TONE[q.status] || 'slate')}>{q.status}</span></td>
        <td>{fmtMoney(q.subtotal, q.currency, q.fx_rate)}</td>
        <td>{q.line_count}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan="5" style={{ background: '#fafbfc' }}>
            {!full ? <p className="muted" style={{ margin: '0.4rem 0' }}>Loading lines…</p> : (
              <table className="spec-table" style={{ width: '100%' }}>
                <thead><tr><th>Ordering code</th><th>Qty</th><th>Unit price</th><th>Discount %</th><th></th></tr></thead>
                <tbody>
                  {full.lines.map((l) => {
                    const match = currentByCode.get(l.ordering_code);
                    let deltaNote = null;
                    if (match) {
                      if (match.unit_price === l.unit_price && (match.discount_pct || 0) === (l.discount_pct || 0)) deltaNote = 'same price now';
                      else if ((match.unit_price || 0) > (l.unit_price || 0)) deltaNote = 'priced higher now';
                      else deltaNote = 'priced lower now';
                    }
                    return (
                      <tr key={l.id}>
                        <td>{l.ordering_code}<div className="muted" style={{ fontSize: '0.75rem' }}>{l.description}</div></td>
                        <td>{l.qty}</td>
                        <td>{l.poa ? <span className="pill warn">PoA</span> : fmtMoney(l.unit_price, full.quote.currency, full.quote.fx_rate)}</td>
                        <td>{l.discount_pct || 0}</td>
                        <td>{match && <><span className="pill ok">also on this quote</span> <span className="muted" style={{ fontSize: '0.75rem' }}>{deltaNote}</span></>}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export default function CustomerHistoryPanel({ customerId, currentQuoteId, currentLines }) {
  const [siblings, setSiblings] = useState(null);
  const [openId, setOpenId] = useState(null);

  useEffect(() => {
    api.get(`/api/quotes?customer_id=${customerId}`).then((rows) =>
      setSiblings(rows.filter((r) => r.id !== currentQuoteId).sort((a, b) => b.id - a.id)));
  }, [customerId, currentQuoteId]);

  if (!siblings) return <p className="muted">Loading customer history…</p>;
  if (siblings.length === 0) return <div className="card"><p className="muted" style={{ margin: 0 }}>No other quotations for this customer yet.</p></div>;

  return (
    <table className="list">
      <thead><tr><th>Quote</th><th>Date</th><th>Status</th><th>Total</th><th>Lines</th></tr></thead>
      <tbody>
        {siblings.map((q) => (
          <SiblingRow key={q.id} q={q} currentLines={currentLines} open={openId === q.id}
            onToggle={() => setOpenId(openId === q.id ? null : q.id)} />
        ))}
      </tbody>
    </table>
  );
}
