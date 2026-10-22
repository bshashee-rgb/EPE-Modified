import React, { useEffect, useMemo, useState } from 'react';
import { api, fmtINR } from '../api.js';

const STATUS_PILL = { Draft: 'gray', Sent: '', Won: 'ok', Lost: 'bad', Expired: 'warn' };
const SORTS = {
  recent: { label: 'Most recent', fn: (a, b) => b.id - a.id },
  number: { label: 'Quote number', fn: (a, b) => (a.number + a.revision).localeCompare(b.number + b.revision) },
  customer: { label: 'Customer', fn: (a, b) => (a.customer_name || '').localeCompare(b.customer_name || '') },
  value_desc: { label: 'Value (high→low)', fn: (a, b) => (b.subtotal || 0) - (a.subtotal || 0) },
  value_asc: { label: 'Value (low→high)', fn: (a, b) => (a.subtotal || 0) - (b.subtotal || 0) },
  status: { label: 'Status', fn: (a, b) => a.status.localeCompare(b.status) },
};

export default function Dashboard({ nav }) {
  const [d, setD] = useState(null);
  const [quotes, setQuotes] = useState(null);
  const [showArchived, setShowArchived] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [sort, setSort] = useState('recent');

  const loadQuotes = () => api.get('/api/quotes' + (showArchived ? '?archived=1' : '')).then(setQuotes);
  const loadStats = () => api.get('/api/dashboard').then(setD);
  useEffect(() => { loadStats(); }, []);
  useEffect(() => { loadQuotes(); }, [showArchived]);

  const filtered = useMemo(() => {
    if (!quotes) return [];
    const needle = q.trim().toLowerCase();
    return quotes
      .filter((x) => statusFilter === 'All' || x.status === statusFilter)
      .filter((x) => !needle
        || (x.number + ' ' + x.revision).toLowerCase().includes(needle)
        || (x.customer_name || '').toLowerCase().includes(needle)
        || (x.items || '').toLowerCase().includes(needle))
      .sort(SORTS[sort].fn);
  }, [quotes, q, statusFilter, sort]);

  if (!d || !quotes) return <p className="muted">Loading dashboard…</p>;
  const s = Object.fromEntries(d.byStatus.map((r) => [r.status, r.n]));

  async function newQuote() { const nq = await api.post('/api/quotes', {}); nav('quote/' + nq.id); }
  async function cloneQuote(id, e) { e.stopPropagation(); const nq = await api.post(`/api/quotes/${id}/clone`); nav('quote/' + nq.id); }
  async function archiveQuote(id, archived, e) {
    e.stopPropagation();
    await api.post(`/api/quotes/${id}/${archived ? 'unarchive' : 'archive'}`);
    loadQuotes(); loadStats();
  }
  async function deleteQuote(row, e) {
    e.stopPropagation();
    if (!window.confirm(`Permanently delete ${row.number} Rev ${row.revision}?\n\nThis removes the quotation and its ${row.line_count} line(s) from the database and cannot be undone. To keep it recoverable, use Archive instead.`)) return;
    await api.del(`/api/quotes/${row.id}`);
    loadQuotes(); loadStats();
  }

  return (
    <div>
      <h1>Dashboard</h1>
      <div className="statgrid">
        <div className="stat"><div className="n">{d.totals.quotes}</div><div className="l">Quotes</div></div>
        <div className="stat"><div className="n">{d.totals.lines}</div><div className="l">Quote lines</div></div>
        <div className="stat"><div className="n">{s.Draft || 0}</div><div className="l">Draft</div></div>
        <div className="stat"><div className="n">{s.Sent || 0}</div><div className="l">Sent</div></div>
        <div className="stat"><div className="n">{s.Won || 0}</div><div className="l">Won</div></div>
        <div className="stat"><div className="n">{d.poaLines}</div><div className="l">PoA lines pending pricing</div></div>
        <div className="stat"><div className="n">{d.openClarifications ?? 0}</div><div className="l">Open clarifications</div></div>
        <div className="stat"><div className="n">{d.avgResponseHours != null ? (d.avgResponseHours < 24 ? `${d.avgResponseHours.toFixed(1)}h` : `${(d.avgResponseHours / 24).toFixed(1)}d`) : '—'}</div><div className="l">Avg. clarification response</div></div>
      </div>

      {d.topFamilies.length > 0 && (
        <div className="card" style={{ marginBottom: '1.2rem' }}>
          <h3>Most-quoted product families</h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {d.topFamilies.map((f, i) => (
              <span key={i} className="pill" style={{ fontSize: '0.82rem', padding: '0.3rem 0.7rem' }}>{f.name} · {f.n}</span>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', margin: '0.4rem 0' }}>Quotes</h2>
        <button className="btn" onClick={newQuote}>➕ New quote</button>
      </div>

      <div className="toolrow" style={{ marginTop: '0.4rem' }}>
        <input style={{ flex: 1, minWidth: 240 }} placeholder="Search by ordering code / item or customer name…" value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="muted">Status</label>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          {['All', 'Draft', 'Sent', 'Won', 'Lost', 'Expired'].map((x) => <option key={x}>{x}</option>)}
        </select>
        <label className="muted">Sort</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          {Object.entries(SORTS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
        <label className="switch">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} />
          <span className="slider" /><span className="switch-label">Show archived</span>
        </label>
      </div>

      <table className="list">
        <thead><tr><th>Number</th><th>Rev</th><th>Customer</th><th>Items</th><th>Status</th><th>Lines</th><th>Value</th><th>Date</th><th className="no-print">Actions</th></tr></thead>
        <tbody>
          {filtered.map((x) => (
            <tr key={x.id} className="clickable" onClick={() => nav('quote/' + x.id)} style={x.archived ? { opacity: 0.6 } : undefined}>
              <td><b>{x.number}</b>{x.archived ? <> <span className="pill gray">archived</span></> : null}</td>
              <td>{x.revision}</td>
              <td>{x.customer_name || <span className="muted">—</span>}</td>
              <td className="muted" style={{ maxWidth: 260, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{x.items || '—'}</td>
              <td><span className={'pill ' + (STATUS_PILL[x.status] || '')}>{x.status}</span></td>
              <td>{x.line_count}</td>
              <td>{x.has_poa ? <span className="pill warn">has PoA</span> : fmtINR(x.subtotal || 0)}</td>
              <td className="muted">{x.quote_date || x.created_at?.slice(0, 10)}</td>
              <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                <button className="btn secondary small" title="Clone to a new quote" onClick={(e) => cloneQuote(x.id, e)}>⧉</button>{' '}
                <button className="btn secondary small" title={x.archived ? 'Unarchive' : 'Archive (recoverable)'} onClick={(e) => archiveQuote(x.id, x.archived, e)}>{x.archived ? '♻' : '📦'}</button>{' '}
                <button className="btn danger small" title="Delete permanently" onClick={(e) => deleteQuote(x, e)}>🗑</button>
              </td>
            </tr>
          ))}
          {filtered.length === 0 && <tr><td colSpan="9" className="muted">No quotes match. {quotes.length === 0 && 'Click “➕ New quote” to start.'}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}
