import React, { useEffect, useRef, useState } from 'react';
import { api, fmtINR } from '../api.js';
import CopyCode from '../components/CopyCode.jsx';

export default function Configurator({ familyId, nav, presetCode }) {
  const [meta, setMeta] = useState(null);
  const [selections, setSelections] = useState({});
  const [result, setResult] = useState(null);
  const [qty, setQty] = useState(1);
  const [quotes, setQuotes] = useState([]);
  const [targetQuote, setTargetQuote] = useState('new');
  const [adding, setAdding] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [pasteCode, setPasteCode] = useState('');
  const [parseMsg, setParseMsg] = useState(null);
  const evalSeq = useRef(0);
  const segRefs = useRef({});

  useEffect(() => {
    api.get(`/api/families/${familyId}/meta`).then((m) => {
      setMeta(m);
      setSelections({});
    });
    api.get('/api/quotes').then((qs) => setQuotes(qs.filter((q) => q.status === 'Draft')));
  }, [familyId]);

  // evaluate on every selection change (server is the rule authority)
  useEffect(() => {
    if (!meta) return;
    const seq = ++evalSeq.current;
    setEvaluating(true);
    api.post(`/api/families/${familyId}/evaluate`, { selections }).then((r) => {
      if (seq === evalSeq.current) { setResult(r); setEvaluating(false); }
    });
  }, [meta, selections, familyId]);

  // preset from pasted code in route
  useEffect(() => {
    if (meta && presetCode) applyCode(presetCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta]);

  if (!meta || !result) return <p className="muted">Loading configurator…</p>;

  const setSeg = (key, value) => setSelections((s) => ({ ...s, [key]: value }));
  const toggleMulti = (key, code, current) => {
    const cur = Array.isArray(current) ? current : [];
    setSeg(key, cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  };

  async function applyCode(code) {
    setParseMsg(null);
    const r = await api.post(`/api/families/${familyId}/parse-code`, { code });
    setSelections(r.selections);
    setParseMsg(r.issues.length ? r.issues.join(' · ') : 'Code decoded successfully.');
  }

  async function addToQuote() {
    setAdding(true);
    try {
      let quoteId = targetQuote;
      if (targetQuote === 'new') {
        const q = await api.post('/api/quotes', {});
        quoteId = q.id;
      }
      await api.post(`/api/quotes/${quoteId}/lines`, {
        kind: 'config', family_id: familyId, selections: result.effective, qty,
      });
      nav('quote/' + quoteId);
    } catch (e) {
      alert('Could not add line: ' + e.message + (e.detail?.violations ? '\n' + e.detail.violations.map((v) => v.message).join('\n') : ''));
    } finally {
      setAdding(false);
    }
  }

  const archived = meta.family.status === 'archived';
  const canAdd = result.complete && result.violations.length === 0 && !evaluating && !archived;
  const missing = result.segments.filter((s) => s.missingRequired);
  const jumpTo = (key) => {
    const el = segRefs.current[key];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash-focus'); void el.offsetWidth; el.classList.add('flash-focus'); }
  };

  return (
    <div>
      <button className="btn secondary small no-print" onClick={() => nav('catalog')}>← Catalogue</button>
      <h1>{meta.family.name}</h1>
      <p className="muted" style={{ marginTop: '-0.6rem' }}>{meta.family.description}</p>
      {meta.family.datasheet_ref && <p className="muted" style={{ fontSize: '0.78rem' }}>Datasheet: {meta.family.datasheet_ref}
        {meta.family.updated_at && <> · 🕒 Specs updated {meta.family.updated_at.slice(0, 10)}</>}</p>}

      <div className="toolrow">
        <input style={{ flex: 1, minWidth: 260 }} placeholder="Paste an ordering code to decode (e.g. from an old quote)…"
          value={pasteCode} onChange={(e) => setPasteCode(e.target.value)} />
        <button className="btn secondary small" onClick={() => pasteCode && applyCode(pasteCode)}>Decode code</button>
        <button className="btn secondary small" onClick={() => { setSelections({}); setParseMsg(null); }}>Reset to standards</button>
      </div>
      {parseMsg && <div className="notice">{parseMsg}</div>}
      {archived && <div className="notice">📦 This product is <b>archived</b> — shown for reference only. It cannot be added to new quotations; historical quotations that reference it remain valid.</div>}

      <div className="config-layout">
        <div>
          {result.segments.map((seg) => (
            <div className={'seg' + (seg.missingRequired ? ' needs-selection' : '')} key={seg.key}
              ref={(el) => { segRefs.current[seg.key] = el; }}>
              <div className="seghead">
                <b>{seg.name}{seg.required ? '' : ' (optional)'}</b>
                {seg.missingRequired
                  ? <span className="req-badge">Required</span>
                  : <span className="pos">position {seg.position}{seg.selection_type === 'multi' ? ' · multi-select' : ''}</span>}
              </div>
              {seg.help && <div className="muted" style={{ fontSize: '0.78rem', marginBottom: '0.4rem' }}>{seg.help}</div>}
              {(seg.selection_type === 'single' || seg.selection_type === 'multi') && (
                <div className="optgrid">
                  {seg.options.map((o) => {
                    const selected = seg.selection_type === 'multi'
                      ? Array.isArray(seg.value) && seg.value.includes(o.code)
                      : String(seg.value) === o.code;
                    return (
                      <button key={o.code}
                        className={'optbtn' + (selected ? ' selected' : '') + (o.enabled ? '' : ' disabled') + (o.on_request ? ' onreq' : '')}
                        title={o.enabled ? (o.on_request ? 'On request — availability to be confirmed' : o.label) : 'Not valid with current parent selections'}
                        onClick={() => {
                          if (!o.enabled) return;
                          if (seg.selection_type === 'multi') toggleMulti(seg.key, o.code, seg.value);
                          else setSeg(seg.key, o.code);
                        }}>
                        <span className="oc">{o.code}</span>{o.label}
                        {o.is_standard && <span className="muted"> · std</span>}
                      </button>
                    );
                  })}
                </div>
              )}
              {seg.selection_type === 'numeric' && (
                <div>
                  <input type="number" value={seg.value ?? ''} placeholder={seg.numeric_unit || ''}
                    onChange={(e) => setSeg(seg.key, e.target.value)} /> <span className="muted">{seg.numeric_unit}</span>
                </div>
              )}
              {seg.selection_type === 'text' && (
                <input type="text" value={seg.value ?? ''} onChange={(e) => setSeg(seg.key, e.target.value)} />
              )}
            </div>
          ))}
        </div>

        <aside className="sidepanel">
          <div className="codebox">
            <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span>Ordering code (live)</span>
              {result.code && <CopyCode text={result.code} title="Copy ordering code" />}
            </div>
            {result.code || '—'}
          </div>

          {result.violations.length > 0 && (
            <div>{result.violations.map((v, i) => <div className="violation" key={i}>⚠ {v.message}</div>)}</div>
          )}
          {result.warnings && result.warnings.length > 0 && (
            <div>{result.warnings.map((w, i) => <div className="notice" key={i} style={{ marginBottom: '0.5rem' }}>↺ {w.message}</div>)}</div>
          )}
          {!result.complete && <div className="notice">Configuration incomplete — required positions still open.</div>}

          {result.facts.length > 0 && (
            <div className="card">
              <h3>Derived specification facts</h3>
              <ul className="factlist">
                {result.facts.map((f, i) => <li key={i}><span>{f.label}</span><span className="fv">{f.value}</span></li>)}
              </ul>
            </div>
          )}

          <div className="card">
            <h3>Price {result.availability === 'to_confirm' && <span className="pill warn">availability to confirm</span>}</h3>
            {result.price ? (
              <table className="breakdown">
                <tbody>
                  {result.price.breakdown.map((b, i) => (
                    <tr key={i}><td>{b.label}{b.note ? <span className="muted"> — {b.note}</span> : ''}</td><td>{b.amount == null ? 'PoA' : fmtINR(b.amount)}</td></tr>
                  ))}
                  <tr className="total"><td>Unit price</td><td>{result.price.poa ? 'Price on Application' : fmtINR(result.price.total)}</td></tr>
                </tbody>
              </table>
            ) : <p className="muted" style={{ margin: 0 }}>Complete the configuration to price it.</p>}
          </div>

          {result.companions && result.companions.length > 0 && (
            <div className="card">
              <h3>Companion products & spares</h3>
              {result.companions.map((c, i) => (
                <div className="companion" key={i}>
                  <div>
                    <div><span className={'pill ' + (c.relation === 'required' ? 'bad' : c.relation === 'recommended' ? 'ok' : 'gray')}>{c.relation}</span> {c.label}</div>
                    {c.code && <CopyCode text={c.code} title="Copy code"><code>{c.code}</code></CopyCode>}
                    {c.note && <div className="muted" style={{ fontSize: '0.75rem' }}>{c.note}</div>}
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="card no-print">
            <h3>Add to quote</h3>
            {missing.length > 0 && (
              <div className="still-needed">
                <span className="sn-label">Still needed:</span>
                {missing.map((s) => (
                  <button type="button" className="sn-chip" key={s.key} onClick={() => jumpTo(s.key)}>{s.name}</button>
                ))}
              </div>
            )}
            <div className="toolrow" style={{ margin: '0.4rem 0' }}>
              <label className="muted">Qty</label>
              <input type="number" min="1" style={{ width: 80 }} value={qty} onChange={(e) => setQty(+e.target.value || 1)} />
              <select value={targetQuote} onChange={(e) => setTargetQuote(e.target.value)}>
                <option value="new">➕ New quote</option>
                {quotes.map((q) => <option key={q.id} value={q.id}>{q.number} Rev {q.revision} {q.customer_name ? '— ' + q.customer_name : ''}</option>)}
              </select>
            </div>
            <button className="btn" disabled={!canAdd || adding} onClick={addToQuote}>
              {adding ? 'Adding…' : 'Add line to quote'}
            </button>
            {!canAdd && missing.length === 0 && result.violations.length > 0 && <div className="muted" style={{ fontSize: '0.78rem', marginTop: '0.4rem' }}>Resolve the flagged violations first.</div>}
          </div>
        </aside>
      </div>
    </div>
  );
}
