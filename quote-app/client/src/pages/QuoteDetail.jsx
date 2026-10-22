import React, { useEffect, useState } from 'react';
import { api, fmtMoney, CURRENCIES } from '../api.js';
import { toast } from '../toast.js';
import AddItemDrawer from '../components/AddItemDrawer.jsx';
import CopyCode from '../components/CopyCode.jsx';
import AttachmentsPanel from '../components/AttachmentsPanel.jsx';

export default function QuoteDetail({ quoteId, nav, role }) {
  const [data, setData] = useState(null);
  const [customers, setCustomers] = useState([]);
  const [showNewCust, setShowNewCust] = useState(false);
  const [custName, setCustName] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pending, setPending] = useState(null); // live draft line streamed from the drawer
  const [editLine, setEditLine] = useState(null); // { lineId, lineNo, family_id, config, qty }
  const [versionPrompt, setVersionPrompt] = useState(false); // finalized-edit guard modal
  const [branching, setBranching] = useState(false);
  const [dragIdx, setDragIdx] = useState(null);   // line being dragged
  const [overIdx, setOverIdx] = useState(null);   // line currently dragged over
  const [tab, setTab] = useState('quotation');    // quotation | history | attachments
  const [history, setHistory] = useState(null);
  const [fx, setFx] = useState(null);             // live rate info shown next to the currency picker
  const [showCustom, setShowCustom] = useState(false);
  const loadSeq = React.useRef(0);

  // UI-2: sequence guard so an out-of-order (stale) reload can't overwrite newer state.
  const load = () => { const seq = ++loadSeq.current; return api.get('/api/quotes/' + quoteId).then((d) => { if (seq === loadSeq.current) setData(d); }); };
  const loadHistory = () => api.get(`/api/quotes/${quoteId}/audit`).then(setHistory);
  useEffect(() => { load(); api.get('/api/customers').then(setCustomers); api.get('/api/fx-rates', { quiet: true }).then(setFx).catch(() => {}); }, [quoteId]);
  useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, quoteId]); // eslint-disable-line
  // UI-5: Escape closes the version-branch modal.
  useEffect(() => {
    if (!versionPrompt) return;
    const onKey = (e) => { if (e.key === 'Escape' && !branching) setVersionPrompt(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [versionPrompt, branching]);
  if (!data) return <p className="muted">Loading quote…</p>;

  const { quote, lines } = data;
  const mny = (n) => fmtMoney(n, quote.currency, quote.fx_rate);
  // Full live currency list once /api/fx-rates resolves (~166 codes); the small
  // fallback covers the brief window before it does, plus the quote's own currency.
  const currencyOptions = [...new Set([...(fx?.currencies || CURRENCIES), quote.currency || 'INR'])];
  // Draft quotes edit freely; once finalized (Sent/Won/Lost/Expired) any content edit is
  // guarded — the user must branch to a new revision or a new quote.
  const finalized = quote.status !== 'Draft';
  const tryEdit = () => { if (finalized) { setVersionPrompt(true); return false; } return true; };
  const patch = async (body) => { await api.patch('/api/quotes/' + quoteId, body); load(); };
  const editPatch = (body) => { if (tryEdit()) patch(body); };

  // branch a finalized quote: create a new revision (same number) or a new quote (new number)
  async function branch(mode) {
    setBranching(true);
    try {
      const q = await api.post(`/api/quotes/${quoteId}/${mode === 'revision' ? 'revise' : 'clone'}`);
      setVersionPrompt(false);
      nav('quote/' + q.id);
    } finally { setBranching(false); }
  }

  // drag-and-drop reorder: move the dragged line to the dropped position
  // shared by drag-drop and keyboard reordering
  async function moveLine(from, to) {
    if (from == null || to < 0 || to >= lines.length || from === to) return;
    const ids = lines.map((l) => l.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    await api.post(`/api/quotes/${quoteId}/reorder`, { order: ids });
    load();
  }
  function dropOn(targetIdx) {
    const from = dragIdx;
    setDragIdx(null); setOverIdx(null);
    moveLine(from, targetIdx);
  }

  const lineNet = (l) => l.poa ? null : l.unit_price * l.qty * (1 - (l.discount_pct || 0) / 100);
  const subtotal = lines.reduce((s, l) => s + (lineNet(l) ?? 0), 0);
  const hasPoa = lines.some((l) => l.poa);
  const discount = subtotal * (quote.discount_pct || 0) / 100;
  const taxable = subtotal - discount;
  const tax = taxable * (quote.tax_pct || 0) / 100;
  const total = taxable + tax;

  return (
    <div className={'qd-layout' + (drawerOpen ? ' with-drawer' : '')}>
    <div className="qd-main">
      <div className="toolrow no-print">
        <button className="btn secondary small" onClick={() => nav('dashboard')}>← Dashboard</button>
        <label className="muted">Currency</label>
        <select value={quote.currency || 'INR'} disabled={finalized} onMouseDown={(e) => { if (!tryEdit()) e.preventDefault(); }}
          onChange={(e) => editPatch({ currency: e.target.value })}>
          {currencyOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        {quote.currency && quote.currency !== 'INR' && (
          <span className="muted" style={{ fontSize: '0.78rem' }}>
            1 INR = {Number(quote.fx_rate).toFixed(4)} {quote.currency}
            {fx && !fx.error && <> · rates as of {new Date(fx.fetchedAt).toLocaleString()}{fx.stale ? ' (stale)' : ''}</>}
          </span>
        )}
        <label className="muted">Customer</label>
        <select value={quote.customer_id || ''} disabled={finalized} onMouseDown={(e) => { if (!tryEdit()) e.preventDefault(); }} onChange={(e) => editPatch({ customer_id: +e.target.value || null })}>
          <option value="">— select customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn secondary small" onClick={() => { if (tryEdit()) setShowNewCust(!showNewCust); }}>+ Customer</button>
        <label className="muted">Date</label>
        <input type="date" value={quote.quote_date || ''} readOnly={finalized}
          onMouseDown={(e) => { if (!tryEdit()) e.preventDefault(); }} onChange={(e) => editPatch({ quote_date: e.target.value })} />
        <label className="muted">Validity (days)</label>
        <CommitInput type="number" min="0" style={{ width: 70 }} value={quote.validity_days ?? 30} disabled={finalized}
          onGuard={tryEdit} onCommit={(v) => editPatch({ validity_days: Math.max(0, +v || 0) })} />
        <label className="muted">Discount %</label>
        <CommitInput type="number" min="0" max="100" style={{ width: 60 }} value={quote.discount_pct || 0} disabled={finalized}
          onGuard={tryEdit} onCommit={(v) => editPatch({ discount_pct: +v || 0 })} />
        <label className="muted">GST %</label>
        <CommitInput type="number" min="0" max="100" style={{ width: 60 }} value={quote.tax_pct || 0} disabled={finalized}
          onGuard={tryEdit} onCommit={(v) => editPatch({ tax_pct: +v || 0 })} />
        <button className="btn small" onClick={() => window.print()}>🖨 Print / PDF</button>
      </div>
      <StatusPipeline status={quote.status} onChange={(s) => {
        // BUG-4: moving a finalized quote back to Draft reopens editing — confirm it.
        if (finalized && s === 'Draft' && !window.confirm(`Re-open ${quote.number} Rev ${quote.revision} as an editable Draft? It is currently ${quote.status}.`)) return;
        patch({ status: s });
      }} />
      {showNewCust && !finalized && (
        <div className="toolrow no-print">
          <input placeholder="Customer name" value={custName} onChange={(e) => setCustName(e.target.value)} />
          <button className="btn small" onClick={async () => {
            if (!custName.trim()) return;
            const c = await api.post('/api/customers', { name: custName.trim() });
            setCustomers([...customers, c]); setCustName(''); setShowNewCust(false);
            patch({ customer_id: c.id });
          }}>Save customer</button>
        </div>
      )}
      {finalized && (
        <div className="notice no-print" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          🔒 This quotation is <b>{quote.status}</b> — its contents are locked. To change it, save a new revision or create a new quote.
          <button className="btn secondary small" onClick={() => branch('revision')}>Save as new revision (Rev {String.fromCharCode(quote.revision.charCodeAt(0) + 1)})</button>
          <button className="btn secondary small" onClick={() => branch('newquote')}>Create new quote</button>
        </div>
      )}
      {hasPoa && <div className="notice no-print">This quote contains Price-on-Application lines — commercial review needed before sending.</div>}

      <div className="tabs no-print">
        <button className={tab === 'quotation' ? 'active' : ''} onClick={() => setTab('quotation')}>Quotation</button>
        <button className={tab === 'attachments' ? 'active' : ''} onClick={() => setTab('attachments')}>Attachments</button>
        <button className={tab === 'history' ? 'active' : ''} onClick={() => setTab('history')}>History</button>
      </div>

      {tab === 'attachments' ? (
        <AttachmentsPanel quoteId={quoteId} quote={quote} role={role} onApprovalChange={load} />
      ) : tab === 'history' ? (
        <QuoteHistory history={history} />
      ) : (
      <div className="quote-doc">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
          <div>
            <h2>Quotation {quote.number} <span className="muted">Rev {quote.revision}</span></h2>
            <div className="muted">EPE Process Filters & Accumulators Pvt. Ltd.<br />Techni Towers, C-54/A, APIE, Balanagar, Hyderabad 500 037<br />business@epe-india.com · www.epe-india.com</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span className={'pill st-' + statusTone(quote.status)}>{quote.status}</span>
            <div className="muted" style={{ marginTop: '0.4rem' }}>
              Date: {quote.quote_date || quote.created_at?.slice(0, 10)}<br />
              Validity: {quote.validity_days} days
              {quote.quote_date && quote.validity_days != null && (
                <><br />Valid until: {new Date(new Date(quote.quote_date).getTime() + quote.validity_days * 86400000).toISOString().slice(0, 10)}</>
              )}
              {(quote.created_by || quote.updated_by) && (
                <><br />Prepared by: {quote.created_by || '—'}{quote.updated_by && quote.updated_by !== quote.created_by ? <> · Last modified by: {quote.updated_by}</> : null}</>
              )}
            </div>
          </div>
        </div>

        <div style={{ margin: '1rem 0' }}>
          <b>To:</b> {quote.customer_name || <span className="muted">no customer selected</span>}
          {quote.customer_address && <div className="muted">{quote.customer_address}</div>}
        </div>

        <table className="list">
          <thead><tr><th>#</th><th>Ordering code / description</th><th>Qty</th><th>Unit price</th><th>Disc %</th><th>Net</th><th className="no-print"></th></tr></thead>
          <tbody>
            {lines.map((l, idx) => (
              pending && pending.editLineId === l.id ? (
                // line currently being edited in the drawer: show its LIVE state in place
                <tr key={l.id} className="pending no-print">
                  <td>{l.line_no}</td>
                  <td>
                    <CopyCode text={pending.code} className="ordering-code" title="Copy ordering code">
                      <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{pending.code || '…'}</span>
                    </CopyCode>
                    <div className="muted">
                      {pending.familyName} <span className="pill warn">editing…</span>
                      {pending.availability === 'to_confirm' && <> <span className="pill warn">availability to confirm</span></>}
                      {pending.violations > 0 && <> <span className="pill bad">{pending.violations} issue(s)</span></>}
                      {!pending.complete && pending.violations === 0 && <> <span className="pill gray">incomplete</span></>}
                    </div>
                  </td>
                  <td>{pending.qty}</td>
                  <td>{pending.price ? (pending.price.poa ? <span className="pill warn">PoA</span> : mny(pending.price.total)) : '—'}</td>
                  <td>{l.discount_pct || 0}</td>
                  <td>{pending.price && !pending.price.poa ? mny(pending.price.total * pending.qty * (1 - (l.discount_pct || 0) / 100)) : '—'}</td>
                  <td className="no-print"></td>
                </tr>
              ) : (
              <tr key={l.id}
                className={(dragIdx === idx ? 'row-dragging' : '') + (overIdx === idx && dragIdx !== null && dragIdx !== idx ? ' row-dragover' : '')}
                onDragOver={(e) => { if (dragIdx !== null) { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; } }}
                onDragEnter={() => { if (dragIdx !== null) setOverIdx(idx); }}
                onDragLeave={(e) => { if (dragIdx !== null && !e.currentTarget.contains(e.relatedTarget)) setOverIdx((o) => (o === idx ? null : o)); }}
                onDrop={(e) => { e.preventDefault(); dropOn(idx); }}>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {!finalized && lines.length > 1 && (
                    <span className="drag-handle" role="button" tabIndex={0}
                      title="Drag to reorder, or use ↑/↓ keys" aria-label={`Reorder line ${l.line_no}. Use up and down arrow keys to move it.`}
                      draggable
                      onDragStart={(e) => { setDragIdx(idx); e.dataTransfer.effectAllowed = 'move'; const row = e.currentTarget.closest('tr'); if (row) e.dataTransfer.setDragImage(row, 24, 16); }}
                      onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                      onKeyDown={(e) => {
                        if (e.key === 'ArrowUp') { e.preventDefault(); moveLine(idx, idx - 1); }
                        else if (e.key === 'ArrowDown') { e.preventDefault(); moveLine(idx, idx + 1); }
                      }}>⠿</span>
                  )}{' '}{l.line_no}
                </td>
                <td>
                  <CopyCode text={l.ordering_code} className="ordering-code" title="Copy ordering code">
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{l.ordering_code}</span>
                  </CopyCode>
                  <div className="muted">{l.description}{l.availability === 'to_confirm' && <> · <span className="pill warn">availability to confirm</span></>}</div>
                  {l.spec && (
                    <details className="screen-only">
                      <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>Specification summary</summary>
                      <table className="spec-table"><tbody>
                        {l.spec.map((s, i) => <tr key={i}><td>{s.name}</td><td>{s.value}</td></tr>)}
                      </tbody></table>
                    </details>
                  )}
                  {l.companions && l.companions.length > 0 && (
                    <details className="screen-only">
                      <summary className="muted" style={{ cursor: 'pointer', fontSize: '0.78rem' }}>Companions / spares ({l.companions.length})</summary>
                      <ul style={{ margin: '0.3rem 0', fontSize: '0.78rem' }}>
                        {l.companions.map((c, i) => <li key={i}>{c.label}: <CopyCode text={c.code || c.targetFamilyCode} title="Copy code"><code>{c.code || c.targetFamilyCode}</code></CopyCode></li>)}
                      </ul>
                    </details>
                  )}
                  {/* Printed quotation always carries the complete specification (no expanding needed on paper) */}
                  {(l.spec || (l.companions && l.companions.length > 0)) && (
                    <div className="print-only">
                      {l.spec && (
                        <>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: '0.4rem' }}>Complete specification</div>
                          <table className="spec-table"><tbody>
                            {l.spec.map((s, i) => <tr key={i}><td>{s.name}</td><td>{s.value}</td></tr>)}
                          </tbody></table>
                        </>
                      )}
                      {l.companions && l.companions.length > 0 && (
                        <>
                          <div style={{ fontSize: '0.78rem', fontWeight: 600, marginTop: '0.4rem' }}>Companion products & spares</div>
                          <ul style={{ margin: '0.2rem 0', fontSize: '0.78rem' }}>
                            {l.companions.map((c, i) => <li key={i}>{c.label}: <code>{c.code || c.targetFamilyCode}</code></li>)}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </td>
                <td><CommitInput className="no-print-input" type="number" min="1" style={{ width: 60 }} value={l.qty} disabled={finalized}
                  onGuard={tryEdit} onCommit={async (v) => { await api.patch('/api/lines/' + l.id, { qty: Math.max(1, +v || 1) }); load(); }} /></td>
                <td>{l.poa ? <span className="pill warn">PoA</span> : mny(l.unit_price)}</td>
                <td><CommitInput type="number" min="0" max="100" style={{ width: 55 }} value={l.discount_pct || 0} disabled={finalized}
                  onGuard={tryEdit} onCommit={async (v) => { await api.patch('/api/lines/' + l.id, { discount_pct: +v || 0 }); load(); }} /></td>
                <td>{l.poa ? '—' : mny(lineNet(l))}</td>
                <td className="no-print" style={{ whiteSpace: 'nowrap' }}>
                  {l.kind === 'config' && (
                    <button className="btn secondary small" title="Edit this line's configuration" aria-label="Edit line configuration" onClick={() => {
                      if (!tryEdit()) return;
                      if (!l.config || !Object.keys(l.config).length) { // UI-4: don't reset a line with no stored config
                        toast('This line has no saved configuration to edit.', 'info');
                        return;
                      }
                      setEditLine({ lineId: l.id, lineNo: l.line_no, family_id: l.family_id, config: l.config, qty: l.qty });
                      setDrawerOpen(true);
                    }}>✎</button>
                  )}{' '}
                  <button className="btn danger small" title="Remove line" aria-label="Remove line" onClick={async () => {
                    if (!tryEdit()) return;
                    if (!window.confirm(`Remove line ${l.line_no} (${l.ordering_code})?`)) return;
                    await api.del('/api/lines/' + l.id); load();
                  }}>✕</button>
                </td>
              </tr>
              )
            ))}
            {pending && !pending.editLineId && (
              <tr className="pending no-print">
                <td>{lines.length + 1}</td>
                <td>
                  <CopyCode text={pending.code} className="ordering-code" title="Copy ordering code">
                    <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{pending.code || '…'}</span>
                  </CopyCode>
                  <div className="muted">
                    {pending.familyName} <span className="pill warn">configuring…</span>
                    {pending.availability === 'to_confirm' && <> <span className="pill warn">availability to confirm</span></>}
                    {pending.violations > 0 && <> <span className="pill bad">{pending.violations} issue(s)</span></>}
                    {!pending.complete && pending.violations === 0 && <> <span className="pill gray">incomplete</span></>}
                  </div>
                </td>
                <td>{pending.qty}</td>
                <td>{pending.price ? (pending.price.poa ? <span className="pill warn">PoA</span> : mny(pending.price.total)) : '—'}</td>
                <td>—</td>
                <td>{pending.price && !pending.price.poa ? mny(pending.price.total * pending.qty) : '—'}</td>
                <td className="no-print"></td>
              </tr>
            )}
            {lines.length === 0 && !pending && <tr><td colSpan="7" className="muted">No lines yet — click “➕ Add item” below to open the catalogue.</td></tr>}
            {!finalized && !drawerOpen && (
              <tr className="add-item-row no-print">
                <td colSpan="7">
                  <div className="add-item-buttons">
                    <button className="btn add-item-btn" onClick={() => { setEditLine(null); setDrawerOpen(true); }}>➕ Add item</button>
                    <button className="btn secondary add-item-btn" onClick={() => setShowCustom(true)}>＋ Custom item</button>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
          <table className="breakdown" style={{ width: 320 }}>
            <tbody>
              <tr><td>Subtotal</td><td>{mny(subtotal)}</td></tr>
              {quote.discount_pct > 0 && <tr><td>Quote discount ({quote.discount_pct}%)</td><td>− {mny(discount)}</td></tr>}
              <tr><td>GST ({quote.tax_pct}%)</td><td>{mny(tax)}</td></tr>
              <tr className="total"><td>Total{hasPoa ? ' (excl. PoA lines)' : ''}</td><td>{mny(total)}</td></tr>
            </tbody>
          </table>
        </div>

        <p className="muted" style={{ fontSize: '0.78rem', marginTop: '1.5rem' }}>
          All options marked "availability to confirm" are subject to factory confirmation before order acceptance
          ("Before ordering, check for availability" — EPE datasheets). Prices are demo placeholders.
          {quote.currency && quote.currency !== 'INR' && ` Amounts are converted from INR at the live rate stored on this quotation (1 INR = ${Number(quote.fx_rate).toFixed(4)} ${quote.currency}) — informational, not a settlement rate.`}
        </p>
      </div>
      )}
    </div>
    {drawerOpen && (
      <AddItemDrawer quoteId={quoteId}
        edit={editLine}
        relatedFamilyIds={[...new Set(lines.filter((l) => l.kind === 'config' && l.family_id).map((l) => l.family_id))]}
        onEditCancel={() => setEditLine(null)}
        onPending={setPending}
        onAdded={() => { setPending(null); load(); }}
        onClose={() => { setDrawerOpen(false); setPending(null); setEditLine(null); }} />
    )}

    {showCustom && (
      <CustomItemModal quoteId={quoteId} onClose={() => setShowCustom(false)} onAdded={() => { setShowCustom(false); load(); }} />
    )}

    {versionPrompt && (
      <div className="modal-overlay no-print" onClick={() => !branching && setVersionPrompt(false)}>
        <div className="modal-card" role="dialog" aria-modal="true" aria-label="Edit a finalized quotation" onClick={(e) => e.stopPropagation()}>
          <h3 style={{ marginTop: 0 }}>This quotation is {quote.status}</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            {quote.number} Rev {quote.revision} has been finalized, so its contents shouldn't change silently.
            How would you like to make your edit?
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.55rem', marginTop: '0.8rem' }}>
            <button className="btn" disabled={branching} onClick={() => branch('revision')}>
              📄 Save as new revision — {quote.number} Rev {String.fromCharCode(quote.revision.charCodeAt(0) + 1)}
              <div className="modal-sub">Keeps the quote number, starts an editable Draft of the next revision.</div>
            </button>
            <button className="btn secondary" disabled={branching} onClick={() => branch('newquote')}>
              🆕 Create a new quote — new number
              <div className="modal-sub">A separate quotation (new Q-number, Rev A) copied from this one.</div>
            </button>
            <button className="btn secondary" disabled={branching} onClick={() => setVersionPrompt(false)}>Cancel</button>
          </div>
        </div>
      </div>
    )}
    </div>
  );
}

// Blank-field popup for a one-off line item that isn't in the catalogue. Price is
// entered directly in INR (the base currency); leaving it blank marks the line
// PoA, same convention as an unmapped catalogue price — never silently ₹0.
function CustomItemModal({ quoteId, onClose, onAdded }) {
  const [description, setDescription] = useState('');
  const [orderingCode, setOrderingCode] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [qty, setQty] = useState(1);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!description.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/quotes/${quoteId}/lines`, {
        kind: 'custom', description: description.trim(), ordering_code: orderingCode.trim() || undefined,
        unit_price: unitPrice === '' ? undefined : +unitPrice, qty: +qty || 1,
      });
      onAdded();
    } finally { setSaving(false); }
  }

  return (
    <div className="modal-overlay no-print" onClick={() => !saving && onClose()}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label="Add a custom item" onClick={(e) => e.stopPropagation()}>
        <h3 style={{ marginTop: 0 }}>Add a custom item</h3>
        <p className="muted" style={{ marginTop: 0, marginBottom: '1rem' }}>For a one-off product or service that isn't in the catalogue.</p>
        <div className="field-grid">
          <label>Description *
            <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Site installation & commissioning" autoFocus />
          </label>
          <div className="field-row">
            <label>Ordering code / reference
              <input type="text" value={orderingCode} onChange={(e) => setOrderingCode(e.target.value)} placeholder="CUSTOM" />
            </label>
            <label style={{ flex: '0 0 90px' }}>Qty
              <input type="number" min="1" value={qty} onChange={(e) => setQty(e.target.value)} />
            </label>
          </div>
          <label>Unit price, INR
            <input type="number" min="0" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} placeholder="Leave blank for Price on Application" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="btn secondary" disabled={saving} onClick={onClose}>Cancel</button>
          <button className="btn" disabled={saving || !description.trim()} onClick={submit}>{saving ? 'Adding…' : 'Add to quote'}</button>
        </div>
      </div>
    </div>
  );
}

// Number/date input that holds its own value and commits only on blur or Enter (UI-2),
// so editing "1"→"100" is a single PATCH, not one per keystroke. When disabled it defers
// to onGuard (e.g. the finalized-quote version prompt).
function CommitInput({ value, onCommit, onGuard, disabled, ...rest }) {
  const [v, setV] = useState(value);
  useEffect(() => { setV(value); }, [value]);
  const commit = () => { if (String(v ?? '') !== String(value ?? '')) onCommit(v); };
  return (
    <input {...rest} value={v ?? ''} readOnly={disabled}
      onMouseDown={(e) => { if (disabled && onGuard && !onGuard()) e.preventDefault(); }}
      onChange={(e) => { if (!disabled) setV(e.target.value); }}
      onBlur={commit}
      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); e.currentTarget.blur(); } }} />
  );
}

// ---- Linear status pipeline (Blueprint-style) ----
// Main progression Draft → Sent → Won, with Lost / Expired as off-track outcomes.
const STATUS_STAGES = [
  { key: 'Draft', tone: 'slate' },
  { key: 'Sent', tone: 'blue' },
  { key: 'Won', tone: 'green' },
];
const STATUS_OUTCOMES = [
  { key: 'Lost', tone: 'red' },
  { key: 'Expired', tone: 'amber' },
];
const statusTone = (s) =>
  ([...STATUS_STAGES, ...STATUS_OUTCOMES].find((x) => x.key === s) || { tone: 'slate' }).tone;

function StatusPipeline({ status, onChange }) {
  const curIdx = STATUS_STAGES.findIndex((s) => s.key === status);
  return (
    <div className="statusbar no-print">
      <span className="statusbar-label">Status</span>
      <div className="statusflow">
        {STATUS_STAGES.map((s, i) => {
          const current = s.key === status;
          const done = curIdx >= 0 && i < curIdx;
          const state = current ? 'current' : done ? 'done' : 'todo';
          return (
            <button key={s.key} className={`seg st-${s.tone} ${state}`} onClick={() => onChange(s.key)}
              title={current ? `Current status: ${s.key}` : `Set status to ${s.key}`}>
              {done ? '✓ ' : ''}{s.key}
            </button>
          );
        })}
      </div>
      <span className="statusflow-or">or</span>
      <div className="statusflow outcomes">
        {STATUS_OUTCOMES.map((s) => (
          <button key={s.key} className={`seg st-${s.tone} ${s.key === status ? 'current' : 'todo'}`}
            onClick={() => onChange(s.key)} title={`Mark ${s.key}`}>{s.key}</button>
        ))}
      </div>
    </div>
  );
}

// ---- Change-log timeline ----
const ACTION_META = {
  create: { icon: '🆕', label: 'Quote created' },
  status: { icon: '🏷️', label: 'Status changed' },
  update: { icon: '✏️', label: 'Details updated' },
  'add-line': { icon: '➕', label: 'Line added' },
  'edit-line': { icon: '✏️', label: 'Line edited' },
  'delete-line': { icon: '🗑️', label: 'Line removed' },
  'reconfigure-line': { icon: '🔧', label: 'Line reconfigured' },
  reorder: { icon: '↕️', label: 'Lines reordered' },
  archive: { icon: '📦', label: 'Archived' },
  unarchive: { icon: '♻️', label: 'Unarchived' },
  revise: { icon: '📄', label: 'Created as new revision' },
  clone: { icon: '⧉', label: 'Cloned to new quote' },
  'upload-attachment': { icon: '📎', label: 'Attachment uploaded' },
  'remove-attachment': { icon: '🗑️', label: 'Attachment removed' },
  approve: { icon: '✅', label: 'Quote approved' },
  reject: { icon: '⛔', label: 'Quote rejected' },
};
const FIELD_LABEL = { customer_id: 'customer', discount_pct: 'quote discount', tax_pct: 'GST', quote_date: 'date', validity_days: 'validity', status: 'status', notes: 'notes', terms: 'terms' };

function describeAudit(r) {
  const d = r.detail || {};
  switch (r.action) {
    case 'create': return `Quote ${d.number || ''} created`;
    case 'status': return `Status changed to “${d.status}”`;
    case 'update': return 'Updated ' + Object.keys(d).map((k) => FIELD_LABEL[k] || k).join(', ');
    case 'add-line': return `Added ${d.code || d.part || 'a line'}`;
    case 'edit-line': return `Edited ${d.code}${d.qty != null ? ` — qty ${d.qty}` : ''}${d.discount_pct != null ? ` — disc ${d.discount_pct}%` : ''}`;
    case 'delete-line': return `Removed ${d.code}`;
    case 'reconfigure-line': return `Reconfigured to ${d.code}${d.was ? ` (was ${d.was})` : ''}`;
    case 'reorder': return 'Reordered line items';
    case 'archive': return 'Quotation archived';
    case 'unarchive': return 'Quotation unarchived';
    case 'revise': return `Started as revision ${d.revision || ''} of ${d.number || ''}`;
    case 'clone': return `Cloned from quote #${d.from}`;
    case 'upload-attachment': return `Uploaded ${d.file_name || 'a file'}`;
    case 'remove-attachment': return `Removed ${d.file_name || 'a file'}`;
    case 'approve': return `Approved${d.notes ? ` — ${d.notes}` : ''}`;
    case 'reject': return `Rejected${d.notes ? ` — ${d.notes}` : ''}`;
    default: return r.action;
  }
}

function QuoteHistory({ history }) {
  if (!history) return <p className="muted">Loading history…</p>;
  if (!history.length) return <div className="card"><p className="muted" style={{ margin: 0 }}>No changes recorded yet.</p></div>;
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>Change history</h3>
      <ol className="timeline">
        {history.map((r) => {
          const meta = ACTION_META[r.action] || { icon: '•', label: r.action };
          return (
            <li key={r.id} className="tl-item">
              <span className="tl-dot" title={meta.label}>{meta.icon}</span>
              <div className="tl-body">
                <div className="tl-desc">{describeAudit(r)}</div>
                <div className="tl-meta muted">by <b>{r.actor || 'unknown'}</b> · {r.at}</div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
