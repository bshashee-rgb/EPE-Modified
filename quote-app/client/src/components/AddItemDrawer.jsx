import React, { useEffect, useRef, useState } from 'react';
import { api, fmtINR } from '../api.js';
import CopyCode from './CopyCode.jsx';

// Right-side panel for adding items to a quote.
// Tabs: Products (catalogue -> embedded configurator) | Parts & Spares.
// While configuring, onPending() streams the in-progress line up to the quote view
// so the quotation shows a live draft row (description, ordering code, price).
export default function AddItemDrawer({ quoteId, onPending, onAdded, onClose, edit, onEditCancel, relatedFamilyIds = [] }) {
  const [tab, setTab] = useState('products');
  const [catalog, setCatalog] = useState(null);
  const [parts, setParts] = useState(null);
  const [q, setQ] = useState('');
  const [familyId, setFamilyId] = useState(null);
  const [catTab, setCatTab] = useState(null);          // active category sub-tab
  const [showAllParts, setShowAllParts] = useState(false);
  const [pop, setPop] = useState({ families: {}, parts: {} }); // quoting recency+frequency

  useEffect(() => {
    api.get('/api/catalog').then(setCatalog);
    api.get('/api/parts').then(setParts);
    api.get('/api/popularity').then(setPop);
  }, []);

  // Order by time-decayed quoting popularity (highest first); ties keep the incoming
  // order (catalogue sort / part-number), so never-quoted items fall to the end normally.
  const famScore = (id) => pop.families[id]?.score || 0;
  const famFreq = (id) => pop.families[id]?.freq || 0;
  const partScore = (id) => pop.parts[id]?.score || 0;
  const partFreq = (id) => pop.parts[id]?.freq || 0;
  const byFamPopularity = (a, b) => famScore(b.id) - famScore(a.id);
  const byPartPopularity = (a, b) => partScore(b.id) - partScore(a.id);
  useEffect(() => { if (tab !== 'products' || familyId == null) onPending(null); }, [tab, familyId]); // eslint-disable-line
  // entering edit mode: jump straight to that line's product configurator
  useEffect(() => {
    if (edit) { setTab('products'); setFamilyId(edit.family_id); }
  }, [edit]);
  // default sub-tab = first category that has published families
  useEffect(() => {
    if (catalog && catTab == null) {
      const first = catalog.categories.find((c) => catalog.families.some((f) => f.category_id === c.id && f.status === 'published'));
      if (first) setCatTab(first.id);
    }
  }, [catalog, catTab]);

  const match = (txt) => !q || txt.toLowerCase().includes(q.toLowerCase());
  const hasRelated = relatedFamilyIds.length > 0;
  // a spare can be related to several families — match on ANY of them (fall back to legacy family_id)
  const partFamilies = (p) => (p.family_ids && p.family_ids.length ? p.family_ids : (p.family_id ? [p.family_id] : []));
  const isRelated = (p) => partFamilies(p).some((id) => relatedFamilyIds.includes(id));
  const relatedParts = parts ? parts.filter(isRelated) : [];
  // default view: related spares once the quote has products; all parts otherwise
  const effectiveShowAll = !hasRelated || showAllParts;

  return (
    <aside className="drawer no-print">
      <div className="drawerhead">
        <div className="tabs" style={{ marginBottom: 0, borderBottom: 0 }}>
          <button className={tab === 'products' ? 'active' : ''} onClick={() => { setTab('products'); setQ(''); }}>Products</button>
          <button className={tab === 'parts' ? 'active' : ''} onClick={() => { setTab('parts'); setFamilyId(null); setQ(''); }}>
            Parts & Spares{hasRelated && <span className="pill" style={{ marginLeft: '0.35rem' }}>{relatedParts.length} related</span>}
          </button>
        </div>
        <button className="btn secondary small" onClick={onClose}>✕ Close</button>
      </div>

      {tab === 'products' && familyId == null && (
        <>
          <div className="searchbar" style={{ marginTop: '0.8rem', marginBottom: '0.5rem' }}>
            <input placeholder="Search the whole catalogue… (e.g. bladder, LD, PST3)" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {!catalog ? <p className="muted">Loading catalogue…</p> : (
            <>
              {!q && (
                <div className="subtabs">
                  {catalog.categories
                    .filter((c) => catalog.families.some((f) => f.category_id === c.id && f.status === 'published'))
                    .map((c) => (
                      <button key={c.id} className={catTab === c.id ? 'active' : ''} onClick={() => setCatTab(c.id)}>{c.name}</button>
                    ))}
                </div>
              )}
              {catalog.categories.map((cat) => {
                // while searching: show matches across ALL categories; otherwise only the active sub-tab
                if (!q && cat.id !== catTab) return null;
                const fams = catalog.families
                  .filter((f) => f.category_id === cat.id && f.status === 'published' && match(f.name + ' ' + f.code + ' ' + (f.description || '')))
                  .sort(byFamPopularity);
                if (!fams.length) return null;
                return (
                  <section key={cat.id} style={{ marginBottom: '0.9rem' }}>
                    {q && <h3 style={{ fontSize: '0.85rem', color: 'var(--muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0.4rem 0' }}>{cat.name}</h3>}
                    {fams.map((f) => (
                      <div key={f.id} className="drawer-fam" onClick={() => setFamilyId(f.id)}>
                        <div>
                          <span className="pill">{f.code}</span> <b>{f.name}</b>
                          {famFreq(f.id) > 0 && <span className="pop-hint" title="Times quoted (weighted by recency)">★ {famFreq(f.id)}</span>}
                        </div>
                        <div className="muted" style={{ fontSize: '0.78rem' }}>{f.description}</div>
                      </div>
                    ))}
                  </section>
                );
              })}
            </>
          )}
        </>
      )}

      {tab === 'products' && familyId != null && (
        <DrawerConfigurator familyId={familyId} quoteId={quoteId}
          edit={edit && edit.family_id === familyId ? edit : null}
          onBack={() => { setFamilyId(null); onPending(null); if (edit) onEditCancel(); }}
          onPending={onPending}
          onAdded={() => { setFamilyId(null); onPending(null); if (edit) onEditCancel(); onAdded(); }} />
      )}

      {tab === 'parts' && (
        <>
          <div className="searchbar" style={{ marginTop: '0.8rem', marginBottom: '0.4rem' }}>
            <input placeholder="Search part number or name…" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hasRelated && (
            <div className="toolrow" style={{ margin: '0 0 0.6rem', justifyContent: 'space-between' }}>
              <span className="muted" style={{ fontSize: '0.82rem' }}>
                {effectiveShowAll
                  ? 'Showing all spare parts.'
                  : `Showing spares related to the ${relatedFamilyIds.length} quoted product famil${relatedFamilyIds.length > 1 ? 'ies' : 'y'}.`}
              </span>
              <label className="switch">
                <input type="checkbox" checked={showAllParts} onChange={(e) => setShowAllParts(e.target.checked)} />
                <span className="slider" />
                <span className="switch-label">Show all parts</span>
              </label>
            </div>
          )}
          {!parts ? <p className="muted">Loading parts…</p> : (() => {
            const shownParts = (effectiveShowAll ? parts : relatedParts)
              .filter((p) => match(p.part_number + ' ' + p.name))
              .sort(byPartPopularity);
            return (
            <table className="list">
              <thead><tr><th>Part</th><th>Price</th><th></th></tr></thead>
              <tbody>
                {shownParts.length === 0 && (
                  <tr><td colSpan="3" className="muted">
                    {effectiveShowAll ? 'No parts match the search.' : 'No related spares for the quoted products — use "Show all parts" to browse the full list.'}
                  </td></tr>
                )}
                {shownParts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <CopyCode text={p.part_number} title="Copy part number">
                          <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{p.part_number}</span>
                        </CopyCode>
                        {partFreq(p.id) > 0 && <span className="pop-hint" title="Times quoted (weighted by recency)">★ {partFreq(p.id)}</span>}
                        {hasRelated && effectiveShowAll && isRelated(p) && <span className="pill ok">related</span>}
                      </div>
                      <div className="muted" style={{ fontSize: '0.78rem' }}>{p.name}{p.family_name ? ' · ' + p.family_name : ''}</div>
                    </td>
                    <td>{p.price != null ? fmtINR(p.price) : <span className="pill warn">PoA</span>}</td>
                    <td><button className="btn small" onClick={async () => {
                      await api.post(`/api/quotes/${quoteId}/lines`, { kind: 'part', part_id: p.id, qty: 1 });
                      onAdded();
                    }}>Add</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
            );
          })()}
        </>
      )}
    </aside>
  );
}

// Compact configurator embedded in the drawer. Streams every evaluation up via
// onPending so the quote table can show the live draft line.
function DrawerConfigurator({ familyId, quoteId, onBack, onPending, onAdded, edit }) {
  const [meta, setMeta] = useState(null);
  const [selections, setSelections] = useState({});
  const [result, setResult] = useState(null);
  const [qty, setQty] = useState(1);
  const [evaluating, setEvaluating] = useState(false);
  const [adding, setAdding] = useState(false);
  const evalSeq = useRef(0);
  const segRefs = useRef({});

  useEffect(() => {
    setMeta(null); setResult(null);
    // edit mode: preload the line's stored configuration so every position shows
    // exactly what was quoted; otherwise start from standards
    setSelections(edit ? (edit.config || {}) : {});
    setQty(edit ? (edit.qty || 1) : 1);
    api.get(`/api/families/${familyId}/meta`).then(setMeta);
  }, [familyId, edit?.lineId]); // eslint-disable-line

  useEffect(() => {
    if (!meta) return;
    const seq = ++evalSeq.current;
    setEvaluating(true);
    api.post(`/api/families/${familyId}/evaluate`, { selections }).then((r) => {
      if (seq !== evalSeq.current) return;
      setResult(r); setEvaluating(false);
      onPending({
        familyName: meta.family.name, code: r.code, complete: r.complete,
        violations: r.violations.length, price: r.price || null, qty,
        availability: r.availability, editLineId: edit ? edit.lineId : null,
      });
    });
  }, [meta, selections, familyId, qty]); // eslint-disable-line

  if (!meta || !result) return <p className="muted" style={{ marginTop: '1rem' }}>Loading configurator…</p>;

  const setSeg = (key, value) => setSelections((s) => ({ ...s, [key]: value }));
  const toggleMulti = (key, code, current) => {
    const cur = Array.isArray(current) ? current : [];
    setSeg(key, cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code]);
  };
  const canAdd = result.complete && result.violations.length === 0 && !evaluating && meta.family.status === 'published';
  const missing = result.segments.filter((s) => s.missingRequired);
  const jumpTo = (key) => {
    const el = segRefs.current[key];
    if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('flash-focus'); void el.offsetWidth; el.classList.add('flash-focus'); }
  };

  async function add() {
    setAdding(true);
    try {
      if (edit) {
        await api.patch(`/api/lines/${edit.lineId}/reconfigure`, { selections: result.effective, qty });
      } else {
        await api.post(`/api/quotes/${quoteId}/lines`, { kind: 'config', family_id: familyId, selections: result.effective, qty });
      }
      onAdded();
    } catch (e) {
      alert('Could not save line: ' + e.message + (e.detail?.violations ? '\n' + e.detail.violations.map((v) => v.message).join('\n') : ''));
    } finally { setAdding(false); }
  }

  return (
    <div style={{ marginTop: '0.6rem' }}>
      <div className="toolrow" style={{ margin: '0 0 0.6rem' }}>
        <button className="btn secondary small" onClick={onBack}>{edit ? '✕ Cancel edit' : '← All products'}</button>
        <b style={{ fontSize: '0.92rem' }}>{meta.family.name}</b>
        {edit && <span className="pill warn">editing line #{edit.lineNo}</span>}
      </div>

      <div className="codebox" style={{ marginBottom: '0.6rem' }}>
        <div className="label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Ordering code (live)</span>
          {result.code && <CopyCode text={result.code} title="Copy ordering code" />}
        </div>
        {result.code || '—'}
      </div>
      {result.violations.map((v, i) => <div className="violation" key={i}>⚠ {v.message}</div>)}
      {(result.warnings || []).map((w, i) => <div className="notice" key={i} style={{ marginBottom: '0.4rem' }}>↺ {w.message}</div>)}

      {result.segments.map((seg) => (
        <div className={'seg compact' + (seg.missingRequired ? ' needs-selection' : '')} key={seg.key}
          ref={(el) => { segRefs.current[seg.key] = el; }}>
          <div className="seghead">
            <b>{seg.name}{seg.required ? '' : ' (optional)'}</b>
            {seg.missingRequired
              ? <span className="req-badge">Required</span>
              : <span className="pos">pos {seg.position}{seg.selection_type === 'multi' ? ' · multi' : ''}</span>}
          </div>
          {(seg.selection_type === 'single' || seg.selection_type === 'multi') && (
            <div className="optgrid">
              {seg.options.map((o) => {
                const selected = seg.selection_type === 'multi'
                  ? Array.isArray(seg.value) && seg.value.includes(o.code)
                  : String(seg.value) === o.code;
                return (
                  <button key={o.code}
                    className={'optbtn' + (selected ? ' selected' : '') + (o.enabled ? '' : ' disabled') + (o.on_request ? ' onreq' : '')}
                    title={o.enabled ? o.label : 'Not valid with current parent selections'}
                    onClick={() => {
                      if (!o.enabled) return;
                      if (seg.selection_type === 'multi') toggleMulti(seg.key, o.code, seg.value);
                      else setSeg(seg.key, o.code);
                    }}>
                    <span className="oc">{o.code}</span>{o.label}{o.is_standard && <span className="muted"> · std</span>}
                  </button>
                );
              })}
            </div>
          )}
          {seg.selection_type === 'numeric' && (
            <div><input type="number" value={seg.value ?? ''} placeholder={seg.numeric_unit || ''}
              onChange={(e) => setSeg(seg.key, e.target.value)} /> <span className="muted">{seg.numeric_unit}</span></div>
          )}
          {seg.selection_type === 'text' && (
            <input type="text" value={seg.value ?? ''} onChange={(e) => setSeg(seg.key, e.target.value)} />
          )}
        </div>
      ))}

      {result.facts.length > 0 && (
        <div className="card" style={{ marginBottom: '0.6rem' }}>
          <h3 style={{ margin: '0 0 0.3rem', fontSize: '0.88rem' }}>Derived facts</h3>
          <ul className="factlist">
            {result.facts.map((f, i) => <li key={i}><span>{f.label}</span><span className="fv">{f.value}</span></li>)}
          </ul>
        </div>
      )}

      <div className="drawer-footer" style={{ flexDirection: 'column', alignItems: 'stretch', gap: '0.5rem' }}>
        {missing.length > 0 && (
          <div className="still-needed">
            <span className="sn-label">Still needed:</span>
            {missing.map((s) => (
              <button type="button" className="sn-chip" key={s.key} onClick={() => jumpTo(s.key)}>{s.name}</button>
            ))}
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.8rem' }}>
          <div>
            <span className="muted" style={{ fontSize: '0.8rem' }}>Unit price </span>
            <b>{result.price ? (result.price.poa ? 'PoA' : fmtINR(result.price.total)) : '—'}</b>
            {result.availability === 'to_confirm' && <> <span className="pill warn">availability to confirm</span></>}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <label className="muted" style={{ fontSize: '0.8rem' }}>Qty</label>
            <input type="number" min="1" style={{ width: 70 }} value={qty} onChange={(e) => setQty(+e.target.value || 1)} />
            <button className="btn" disabled={!canAdd || adding} onClick={add}>
              {adding ? 'Saving…' : (edit ? '💾 Save changes' : 'Add to quote')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
