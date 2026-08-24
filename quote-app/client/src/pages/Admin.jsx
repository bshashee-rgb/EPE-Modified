import React, { useEffect, useState } from 'react';
import { api, fmtINR } from '../api.js';

// UI-6: never let a malformed stored JSON string throw during render (white-screen guard).
const safeParse = (s, fallback = {}) => { try { return JSON.parse(s || '{}'); } catch { return fallback; } };

export default function Admin() {
  const [tab, setTab] = useState('families');
  const [families, setFamilies] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selected, setSelected] = useState(null);
  const [meta, setMeta] = useState(null);
  const [prices, setPrices] = useState(null);
  const [auditRows, setAuditRows] = useState([]);
  const [showNewFamily, setShowNewFamily] = useState(false);
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');

  const [summary, setSummary] = useState(null); // record counts for the top-level tabs
  const loadFamilies = () => api.get('/api/admin/families').then(setFamilies);
  const loadCategories = () => api.get('/api/admin/categories').then(setCategories);
  const loadSummary = () => api.get('/api/admin/summary').then(setSummary);
  useEffect(() => { loadFamilies(); loadCategories(); loadSummary(); }, []);
  useEffect(() => {
    if (selected) {
      api.get(`/api/families/${selected}/meta`).then(setMeta);
      api.get(`/api/admin/prices/${selected}`).then(setPrices);
    } else { setMeta(null); setPrices(null); }
  }, [selected]);
  useEffect(() => { if (tab === 'audit') api.get('/api/admin/audit').then(setAuditRows); if (tab !== 'families') loadSummary(); }, [tab]); // eslint-disable-line

  return (
    <div>
      <h1>Product Metadata Administration</h1>
      <div className="notice">
        Archiving a product hides it from the sales catalogue and blocks new quotations, but <b>never deletes
        anything</b> — all metadata stays in the database and historical quotations remain reproducible.
        Every change is captured in the audit trail.
      </div>
      <div className="tabs">
        <button className={tab === 'categories' ? 'active' : ''} onClick={() => { setTab('categories'); setSelected(null); }}>Product Categories ({categories.length})</button>
        <button className={tab === 'families' ? 'active' : ''} onClick={() => { setTab('families'); setSelected(null); }}>Families & Specifications ({families.length})</button>
        <button className={tab === 'spares' ? 'active' : ''} onClick={() => { setTab('spares'); setSelected(null); }}>Spare Parts ({summary?.spares ?? 0})</button>
        <button className={tab === 'audit' ? 'active' : ''} onClick={() => setTab('audit')}>Audit Trail ({summary?.audit ?? 0})</button>
      </div>

      {tab === 'categories' && <CategoriesManager categories={categories} onChanged={() => { loadCategories(); loadFamilies(); }} />}

      {tab === 'spares' && <SparePartsManager onChanged={loadSummary} />}

      {tab === 'families' && !selected && (() => {
        const needle = q.trim().toLowerCase();
        const shown = families
          .filter((f) => statusFilter === 'All' || f.status === statusFilter)
          .filter((f) => !needle || (f.code + ' ' + f.name + ' ' + (f.category_name || '') + ' ' + (f.datasheet_ref || '')).toLowerCase().includes(needle));
        return (
        <>
          <div className="toolrow">
            <button className="btn" onClick={() => setShowNewFamily(!showNewFamily)}>➕ New product family</button>
            <input style={{ flex: 1, minWidth: 220 }} placeholder="Search by code, name, category or datasheet…" value={q} onChange={(e) => setQ(e.target.value)} />
            <label className="muted">Status</label>
            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
              {['All', 'published', 'draft', 'archived'].map((s) => <option key={s} value={s}>{s === 'All' ? 'All' : s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>
            <span className="muted" style={{ fontSize: '0.82rem' }}>{shown.length} of {families.length}</span>
          </div>
          {showNewFamily && (
            categories.length === 0
              ? <div className="notice">Add a product category first (the <b>Product Categories</b> tab) — every product family belongs to a category.</div>
              : <NewFamilyForm categories={categories} onCreated={(f) => { setShowNewFamily(false); loadFamilies(); setSelected(f.id); }} />
          )}
          <table className="list">
            <thead><tr><th>Family</th><th>Category</th><th>Datasheet</th><th>Segments</th><th>Rules</th><th>Status</th></tr></thead>
            <tbody>
              {shown.map((f) => (
                <tr key={f.id} className="clickable" onClick={() => setSelected(f.id)} style={f.status === 'archived' ? { opacity: 0.55 } : undefined}>
                  <td><b>{f.code}</b> — {f.name}</td>
                  <td>{f.category_name}</td>
                  <td className="muted">{f.datasheet_ref}</td>
                  <td>{f.segment_count}</td>
                  <td>{f.rule_count}</td>
                  <td><span className={'pill ' + (f.status === 'published' ? 'ok' : f.status === 'archived' ? 'gray' : 'warn')}>{f.status}</span></td>
                </tr>
              ))}
              {shown.length === 0 && <tr><td colSpan="6" className="muted">No families match your search/filter.</td></tr>}
            </tbody>
          </table>
        </>
        );
      })()}

      {tab === 'families' && selected && meta && (
        <FamilyEditor meta={meta} prices={prices}
          reload={() => { api.get(`/api/families/${selected}/meta`).then(setMeta); api.get(`/api/admin/prices/${selected}`).then(setPrices); loadFamilies(); }}
          back={() => { setSelected(null); loadFamilies(); }} />
      )}

      {tab === 'audit' && (
        <table className="list">
          <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th><th>Detail</th></tr></thead>
          <tbody>
            {auditRows.map((r) => (
              <tr key={r.id}><td className="muted">{r.at}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.entity} #{r.entity_id}</td>
                <td className="muted" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.detail}</td></tr>
            ))}
            {auditRows.length === 0 && <tr><td colSpan="5" className="muted">No audit entries yet.</td></tr>}
          </tbody>
        </table>
      )}
    </div>
  );
}

// Manage product categories: add, rename/reorder, and delete (only when unused).
function CategoriesManager({ categories, onChanged }) {
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [err, setErr] = useState('');
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState({ code: '', name: '', sort: '' });

  async function add() {
    setErr('');
    if (!code.trim() || !name.trim()) { setErr('Category code and name are required.'); return; }
    try { await api.post('/api/admin/categories', { code: code.trim(), name: name.trim() }, { quiet: true }); setCode(''); setName(''); onChanged(); }
    catch (e) { setErr(e.message); }
  }
  async function saveEdit(id) {
    setErr('');
    try { await api.patch('/api/admin/categories/' + id, { code: edit.code, name: edit.name, sort: edit.sort }, { quiet: true }); setEditId(null); onChanged(); }
    catch (e) { setErr(e.message); }
  }
  async function del(c) {
    if (!window.confirm(`Delete category '${c.name}'? (Allowed only because no families use it.)`)) return;
    setErr('');
    try { await api.del('/api/admin/categories/' + c.id, { quiet: true }); onChanged(); }
    catch (e) { setErr(e.message); }
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3>Product categories ({categories.length})</h3>
      <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
        Categories group product families in the sales catalogue. A category can only be deleted when no families use it (nothing is ever silently reassigned).
      </p>
      <table className="list">
        <thead><tr><th>Code</th><th>Name</th><th>Sort</th><th>Families</th><th></th></tr></thead>
        <tbody>
          {categories.map((c) => editId === c.id ? (
            <tr key={c.id}>
              <td><input style={{ width: 110 }} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} /></td>
              <td><input style={{ width: '100%' }} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></td>
              <td><input type="number" style={{ width: 64 }} value={edit.sort} onChange={(e) => setEdit({ ...edit, sort: e.target.value })} /></td>
              <td>{c.family_count}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn small" onClick={() => saveEdit(c.id)}>Save</button>{' '}
                <button className="btn secondary small" onClick={() => setEditId(null)}>Cancel</button>
              </td>
            </tr>
          ) : (
            <tr key={c.id}>
              <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{c.code}</td>
              <td>{c.name}</td>
              <td>{c.sort}</td>
              <td>{c.family_count}</td>
              <td style={{ whiteSpace: 'nowrap' }}>
                <button className="btn secondary small" onClick={() => { setEditId(c.id); setEdit({ code: c.code, name: c.name, sort: c.sort }); }}>Edit</button>{' '}
                <button className="btn danger small" disabled={c.family_count > 0} title={c.family_count > 0 ? 'Category in use — cannot delete' : 'Delete category'} onClick={() => del(c)}>✕</button>
              </td>
            </tr>
          ))}
          <tr>
            <td><input style={{ width: 110 }} placeholder="code" value={code} onChange={(e) => setCode(e.target.value)} /></td>
            <td><input style={{ width: '100%' }} placeholder="Category name (e.g. Accumulators)" value={name} onChange={(e) => setName(e.target.value)} /></td>
            <td className="muted">auto</td>
            <td></td>
            <td><button className="btn small" onClick={add}>Add category</button></td>
          </tr>
        </tbody>
      </table>
      {err && <div className="notice" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', margin: 0 }}>{err}</div>}
    </div>
  );
}

function NewFamilyForm({ categories, onCreated }) {
  const [f, setF] = useState({ category_id: categories[0]?.id || '', code: '', name: '', description: '', datasheet_ref: '' });
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <h3>New product family</h3>
      <div className="toolrow">
        <select value={f.category_id} onChange={set('category_id')}>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <input placeholder="Series code (e.g. XYZ)" style={{ width: 140 }} value={f.code} onChange={set('code')} />
        <input placeholder="Product name" style={{ flex: 1, minWidth: 220 }} value={f.name} onChange={set('name')} />
      </div>
      <div className="toolrow">
        <input placeholder="Description" style={{ flex: 1, minWidth: 260 }} value={f.description} onChange={set('description')} />
        <input placeholder="Datasheet ref (e.g. EPE/xx.xxx Rev.x)" style={{ width: 260 }} value={f.datasheet_ref} onChange={set('datasheet_ref')} />
        <button className="btn" onClick={async () => {
          if (!f.code.trim() || !f.name.trim()) { alert('Series code and name are required.'); return; }
          try {
            const created = await api.post('/api/admin/families', { ...f, category_id: +f.category_id });
            onCreated(created);
          } catch { /* surfaced via global toast */ }
        }}>Create family</button>
      </div>
      <p className="muted" style={{ fontSize: '0.8rem', margin: 0 }}>
        After creating, open the family to add its specification segments (ordering-code positions), options and dependency rules.
      </p>
    </div>
  );
}

function FamilyEditor({ meta, prices, reload, back }) {
  const [newOpt, setNewOpt] = useState({});
  const [newSeg, setNewSeg] = useState({ key: '', name: '', selection_type: 'single' });
  const [archiving, setArchiving] = useState(false);
  const [editingRule, setEditingRule] = useState(null);
  const [editorTab, setEditorTab] = useState('segments'); // segments | pricing | spares | rules
  const [builderOpen, setBuilderOpen] = useState(false);   // rules tab: floating add/edit dock
  const [openSegs, setOpenSegs] = useState(() => new Set()); // accordion: expanded segment ids
  const toggleSeg = (id) => setOpenSegs((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const fam = meta.family;
  const totalOptions = meta.segments.reduce((n, s) => n + s.options.length, 0);
  // Opening a rule for editing jumps to the Rules tab and unfolds the docked builder.
  const editRule = (r) => { setEditingRule(r); setEditorTab('rules'); setBuilderOpen(true);
    setTimeout(() => document.querySelector('.rulebuilder')?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 60); };

  async function toggleOption(o) {
    if (o.status === 'active') {
      const ok = window.confirm(`Retire option '${o.code}' — ${o.label}?\n\nIt will no longer be selectable in new configurations, but stays in the database and remains valid on historical quotations.`);
      if (!ok) return;
    }
    await api.patch('/api/admin/options/' + o.id, { status: o.status === 'active' ? 'retired' : 'active' });
    reload();
  }
  async function addOption(seg) {
    const v = newOpt[seg.id];
    if (!v || !v.code || !v.label) return;
    const created = await api.post('/api/admin/options', {
      segment_id: seg.id, code: v.code, label: v.label,
      is_standard: !!v.is_standard, on_request: !!v.on_request, price_on_application: !!v.poa,
    });
    // optional adder entered alongside the new option
    if (v.adder !== undefined && v.adder !== '' && !isNaN(+v.adder)) {
      await api.post('/api/admin/option-prices', {
        family_id: fam.id, segment_key: seg.key, option_code: created.code,
        kind: v.adderKind || 'abs', amount: +v.adder,
      });
    }
    setNewOpt({ ...newOpt, [seg.id]: { code: '', label: '' } });
    reload();
  }
  async function toggleFlag(o, flag) {
    await api.patch('/api/admin/options/' + o.id, { [flag]: o[flag] ? 0 : 1 });
    reload();
  }
  async function addAdder(seg, code, kind, amount) {
    if (amount === '' || isNaN(+amount)) return;
    try {
      await api.post('/api/admin/option-prices', { family_id: fam.id, segment_key: seg.key, option_code: code, kind, amount: +amount });
      reload();
    } catch { /* surfaced via global toast */ }
  }
  async function addSegment() {
    if (!newSeg.key.trim() || !newSeg.name.trim()) { alert('Segment key and name are required.'); return; }
    try {
      await api.post('/api/admin/segments', { family_id: fam.id, ...newSeg });
      setNewSeg({ key: '', name: '', selection_type: 'single' });
      reload();
    } catch { /* surfaced via global toast */ }
  }
  async function archiveFamily() {
    setArchiving(true);
    try {
      const usage = await api.get(`/api/admin/families/${fam.id}/usage`);
      const usageText = usage.total === 0
        ? 'No existing quotations reference this product.'
        : `⚠ This product is referenced in ${usage.total} quotation(s):\n` +
          usage.quotes.slice(0, 10).map((q) => `  • ${q.number} Rev ${q.revision} (${q.status}) — ${q.line_count} line(s)`).join('\n') +
          (usage.total > 10 ? `\n  …and ${usage.total - 10} more` : '') +
          '\n\nThose quotations stay intact and reproducible.';
      const ok = window.confirm(
        `Archive '${fam.name}'?\n\n${usageText}\n\nArchiving hides the product from the sales catalogue and blocks NEW quotations. Nothing is deleted from the database, and you can unarchive at any time.`
      );
      if (ok) { await api.post(`/api/admin/families/${fam.id}/archive`); reload(); }
    } finally { setArchiving(false); }
  }
  async function submitRule(type, ruleObj, note, editId) {
    try {
      if (editId) await api.patch('/api/admin/rules/' + editId, { type, rule: ruleObj, note: note || null });
      else await api.post('/api/admin/rules', { family_id: fam.id, type, rule: ruleObj, note: note || null });
      setEditingRule(null);
      reload();
    } catch { /* surfaced via global toast */ }
  }

  return (
    <div>
      <div className="toolrow">
        <button className="btn secondary small" onClick={back}>← All families</button>
        {fam.status === 'draft' && (
          <button className="btn small" onClick={async () => {
            try { await api.post(`/api/admin/families/${fam.id}/publish`, undefined, { quiet: true }); reload(); }
            catch (e) { alert('Cannot publish yet:\n' + (e.detail?.problems || [e.message]).join('\n')); }
          }}>🚀 Publish to sales catalogue</button>
        )}
        {fam.status !== 'archived'
          ? <button className="btn danger small" disabled={archiving} onClick={archiveFamily}>{archiving ? 'Checking usage…' : '📦 Archive product'}</button>
          : <button className="btn small" onClick={async () => { await api.post(`/api/admin/families/${fam.id}/unarchive`); reload(); }}>♻ Unarchive product</button>}
      </div>
      <h2 style={{ marginBottom: 0 }}>{fam.name} {fam.status === 'archived' && <span className="pill gray">archived</span>}</h2>
      <p className="muted">Datasheet: {fam.datasheet_ref || '—'} · status: {fam.status}</p>
      {fam.status === 'archived' && (
        <div className="notice">This product is archived: hidden from the sales catalogue and blocked for new quotations. All data is retained; historical quotations are unaffected.</div>
      )}

      <div className="tabs">
        <button className={editorTab === 'segments' ? 'active' : ''} onClick={() => setEditorTab('segments')}>Segments & Options ({meta.segments.length})</button>
        <button className={editorTab === 'pricing' ? 'active' : ''} onClick={() => setEditorTab('pricing')}>Base Price variants ({prices?.base?.length || 0})</button>
        <button className={editorTab === 'spares' ? 'active' : ''} onClick={() => setEditorTab('spares')}>Spare Parts ({meta.spare_count ?? 0})</button>
        <button className={editorTab === 'rules' ? 'active' : ''} onClick={() => setEditorTab('rules')}>Rules ({meta.rules.length})</button>
      </div>

      {editorTab === 'segments' && <>
      <div className="toolrow" style={{ alignItems: 'center' }}>
        <b>Specification segments ({meta.segments.length})</b>
        <span className="muted" style={{ fontSize: '0.82rem' }}>· {totalOptions} option{totalOptions === 1 ? '' : 's'} across all positions</span>
        <button className="btn secondary small" style={{ marginLeft: 'auto' }} onClick={() => setOpenSegs(new Set(meta.segments.map((s) => s.id)))}>Expand all</button>
        <button className="btn secondary small" onClick={() => setOpenSegs(new Set())}>Collapse all</button>
      </div>
      {meta.segments.map((seg) => {
        const open = openSegs.has(seg.id);
        const retired = seg.options.filter((o) => o.status !== 'active').length;
        return (
        <div className={'seg accordion' + (open ? ' open' : '')} key={seg.id}>
          <div className="seghead accord-head" role="button" tabIndex={0}
            onClick={() => toggleSeg(seg.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSeg(seg.id); } }}>
            <b><span className="accord-caret">▸</span> Position {seg.position}: {seg.name}</b>
            <span className="pos">{seg.key} · {seg.selection_type}{seg.required ? ' · required' : ''} · <span className="count-badge">{seg.options.length} option{seg.options.length === 1 ? '' : 's'}</span>{retired > 0 && <span className="muted"> ({retired} retired)</span>}</span>
          </div>
          {open && (
          <table className="list">
            <thead><tr><th>Code</th><th>Meaning</th><th>Flags</th><th>Base/adder price</th><th></th></tr></thead>
            <tbody>
              {seg.options.map((o) => {
                const adder = prices?.options?.find((p) => p.segment_key === seg.key && p.option_code === o.code);
                const base = prices?.base?.find((b) => b.match !== '{}' && safeParse(b.match)[seg.key] === o.code);
                return (
                  <tr key={o.id}>
                    <td style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}><b>{o.code}</b></td>
                    <td>{o.label}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className={'flagtog' + (o.is_standard ? ' on ok' : '')} title="Standard option" onClick={() => toggleFlag(o, 'is_standard')}>std</button>{' '}
                      <button className={'flagtog' + (o.on_request ? ' on warn' : '')} title="On request — availability to confirm" onClick={() => toggleFlag(o, 'on_request')}>on-req</button>{' '}
                      <button className={'flagtog' + (o.price_on_application ? ' on warn' : '')} title="Price on Application" onClick={() => toggleFlag(o, 'price_on_application')}>PoA</button>{' '}
                      {o.status !== 'active' && <span className="pill bad">retired</span>}
                    </td>
                    <td>
                      {base && <PriceCell row={base} kindLabel="base" onSave={async (amt) => { await api.patch('/api/admin/base-prices/' + base.id, { amount: amt }); reload(); }}
                        onDelete={async () => { await api.del('/api/admin/base-prices/' + base.id); reload(); }} />}
                      {adder && <PriceCell row={adder} kindLabel={adder.kind === 'pct' ? 'adder %' : 'adder ₹'} onSave={async (amt) => { await api.patch('/api/admin/option-prices/' + adder.id, { amount: amt }); reload(); }}
                        onDelete={async () => { await api.del('/api/admin/option-prices/' + adder.id); reload(); }} />}
                      {!adder && !o.price_on_application && <AddAdder onAdd={(kind, amt) => addAdder(seg, o.code, kind, amt)} />}
                      {!base && !adder && o.price_on_application && <span className="muted">PoA</span>}
                    </td>
                    <td><button className="btn secondary small" onClick={() => toggleOption(o)}>{o.status === 'active' ? 'Retire' : 'Reactivate'}</button></td>
                  </tr>
                );
              })}
              <tr>
                <td><input style={{ width: 90 }} placeholder="code" value={newOpt[seg.id]?.code || ''}
                  onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], code: e.target.value } })} /></td>
                <td><input style={{ width: '100%' }} placeholder="meaning / label" value={newOpt[seg.id]?.label || ''}
                  onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], label: e.target.value } })} /></td>
                <td style={{ whiteSpace: 'nowrap', fontSize: '0.78rem' }}>
                  <label><input type="checkbox" checked={!!newOpt[seg.id]?.is_standard} onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], is_standard: e.target.checked } })} /> std</label>{' '}
                  <label><input type="checkbox" checked={!!newOpt[seg.id]?.on_request} onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], on_request: e.target.checked } })} /> on-req</label>{' '}
                  <label><input type="checkbox" checked={!!newOpt[seg.id]?.poa} onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], poa: e.target.checked } })} /> PoA</label>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <select value={newOpt[seg.id]?.adderKind || 'abs'} style={{ width: 56 }} onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], adderKind: e.target.value } })}>
                    <option value="abs">₹</option><option value="pct">%</option>
                  </select>{' '}
                  <input type="number" style={{ width: 78 }} placeholder="adder" value={newOpt[seg.id]?.adder ?? ''}
                    onChange={(e) => setNewOpt({ ...newOpt, [seg.id]: { ...newOpt[seg.id], adder: e.target.value } })} />
                </td>
                <td><button className="btn small" onClick={() => addOption(seg)}>Add option</button></td>
              </tr>
            </tbody>
          </table>
          )}
        </div>
        );
      })}

      <div className="card" style={{ marginBottom: '0.9rem' }}>
        <h3>Add specification segment</h3>
        <div className="toolrow" style={{ margin: 0 }}>
          <input placeholder="key (e.g. seal)" style={{ width: 140 }} value={newSeg.key} onChange={(e) => setNewSeg({ ...newSeg, key: e.target.value })} />
          <input placeholder="Display name (e.g. Seal material)" style={{ flex: 1, minWidth: 200 }} value={newSeg.name} onChange={(e) => setNewSeg({ ...newSeg, name: e.target.value })} />
          <select value={newSeg.selection_type} onChange={(e) => setNewSeg({ ...newSeg, selection_type: e.target.value })}>
            <option value="single">single-select</option>
            <option value="multi">multi-select</option>
            <option value="numeric">numeric</option>
            <option value="text">free text</option>
          </select>
          <button className="btn small" onClick={addSegment}>Add segment</button>
        </div>
        <p className="muted" style={{ fontSize: '0.78rem', marginBottom: 0 }}>The segment is appended as the next ordering-code position. Then add its options above.</p>
      </div>
      </>}

      {editorTab === 'pricing' && <BasePricesCard fam={fam} meta={meta} prices={prices} reload={reload} />}

      {editorTab === 'spares' && <SparePartsManager scopeFamily={fam} onChanged={reload} />}

      {editorTab === 'rules' && <>
      <div className={'rule-add-dock' + (editingRule ? ' editing' : '')}>
        {(builderOpen || editingRule) ? (
          <RuleBuilder meta={meta} editing={editingRule}
            onSubmit={async (...args) => { await submitRule(...args); setBuilderOpen(false); }}
            onCancel={() => { setEditingRule(null); setBuilderOpen(false); }} />
        ) : (
          <div className="toolrow" style={{ margin: 0, alignItems: 'center' }}>
            <button className="btn small" onClick={() => setBuilderOpen(true)}>➕ Add a rule</button>
            <span className="muted" style={{ fontSize: '0.82rem' }}>Guided builder — pick a rule type and fill in the blanks; a plain-English preview updates live.</span>
          </div>
        )}
      </div>

      <div className="card">
        <h3>Dependency rules ({meta.rules.length})</h3>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
          Rules control how choices depend on each other — read in plain English below. Add new ones with the floating builder above.
        </p>
        <table className="list">
          <thead><tr><th>Type</th><th>What it does</th><th></th></tr></thead>
          <tbody>
            {meta.rules.length === 0 && <tr><td colSpan="3" className="muted">No rules yet.</td></tr>}
            {meta.rules.map((r) => (
              <tr key={r.id}>
                <td><span className="pill">{RULE_LABEL[r.type] || r.type}</span></td>
                <td>
                  {describeRule(r.type, r, meta.segments)}
                  {(r.note || r.message) && <div className="muted" style={{ fontSize: '0.75rem' }}>{r.note || ''}</div>}
                  <details className="screen-only"><summary className="muted" style={{ fontSize: '0.72rem', cursor: 'pointer' }}>JSON</summary>
                    <code style={{ fontSize: '0.72rem' }}>{JSON.stringify({ when: r.when, target: r.target, allow: r.allow, default: r.default, require: r.require, forbid: r.forbid, numeric: r.numeric, facts: r.facts, exclusive: r.exclusive, prerequisite: r.prerequisite }, (k, v) => v === undefined ? undefined : v)}</code>
                  </details>
                </td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  <button className={'btn secondary small' + (editingRule?.id === r.id ? ' active' : '')} title="Edit this rule in the floating builder above" onClick={() => editRule(r)}>✎</button>{' '}
                  <button className="btn danger small" onClick={async () => {
                    if (window.confirm('Delete this rule? (Rules are configuration logic, not quoted data — deletion is allowed.)')) {
                      if (editingRule?.id === r.id) setEditingRule(null);
                      await api.del('/api/admin/rules/' + r.id); reload();
                    }
                  }}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>}
    </div>
  );
}

// ---- Guided rule builder ----
const RULE_TYPES = [
  { type: 'FILTER', label: 'Limit choices', help: 'Restrict which options a segment offers, based on other selections. Options outside the allowed set become disabled.' },
  { type: 'DEFAULT', label: 'Preselect a value', help: 'Auto-select a value for a segment when a condition holds (the salesperson can still change it).' },
  { type: 'DERIVE', label: 'Show a fact', help: 'Display a read-only specification fact (e.g. “Max system pressure = 40 bar”) when a condition holds.' },
  { type: 'CONSTRAINT', label: 'Require / forbid / bound', help: 'Reject an invalid combination, or keep a number within limits, showing a message to the salesperson.' },
  { type: 'COMPOSE', label: 'Combination rules', help: 'For multi-select positions: two options that cannot be combined, or an option that requires another.' },
];
const RULE_LABEL = Object.fromEntries(RULE_TYPES.map((r) => [r.type, r.label]));

const segName = (segments, key) => segments.find((s) => s.key === key)?.name || key;
function condText(when, segments) {
  if (!when || !Object.keys(when).length) return null;
  return Object.entries(when).map(([k, codes]) => `${segName(segments, k)} is ${(codes || []).join(' or ')}`).join(' and ');
}
function describeRule(type, r, segments) {
  const c = condText(r.when, segments);
  const when = c ? `When ${c}, ` : '';
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  try {
    if (type === 'FILTER') return cap(`${when}only ${(r.allow || []).join(', ')} ${(r.allow || []).length === 1 ? 'is' : 'are'} available for ${segName(segments, r.target)}.`);
    if (type === 'DEFAULT') return cap(`${when}default ${segName(segments, r.target)} to ${r.default}.`);
    if (type === 'DERIVE') return cap(`${when}show ${Object.entries(r.facts || {}).map(([l, v]) => `“${l}: ${v}”`).join('; ')}.`);
    if (type === 'CONSTRAINT') {
      const msg = r.message ? ` — otherwise: “${r.message}”` : '';
      if (r.require) { const [k, codes] = Object.entries(r.require)[0]; return cap(`${when}${segName(segments, k)} must be ${codes.join(' or ')}${msg}.`); }
      if (r.forbid) { const [k, codes] = Object.entries(r.forbid)[0]; return cap(`${when}${segName(segments, k)} cannot be ${codes.join(' or ')}${msg}.`); }
      if (r.numeric) { const [k, b] = Object.entries(r.numeric)[0]; const lo = b.min != null ? `≥ ${b.min}` : ''; const hi = b.max != null ? `≤ ${b.max}` : ''; return cap(`${when}${segName(segments, k)} must be ${[lo, hi].filter(Boolean).join(' and ')}${msg}.`); }
      return cap(`${when}${r.message || 'constraint'}.`);
    }
    if (type === 'COMPOSE') {
      if (r.exclusive) return r.exclusive.map((p) => `${p.join(' and ')} cannot be combined`).join('; ') + '.';
      if (r.prerequisite) return Object.entries(r.prerequisite).map(([code, reqs]) => `${code} requires ${reqs.join(' + ')}`).join('; ') + '.';
    }
  } catch { /* fall through */ }
  return JSON.stringify(r);
}

function CodePicker({ options, value, onChange }) {
  return (
    <div className="optgrid" style={{ marginTop: '0.3rem' }}>
      {options.map((o) => {
        const on = value.includes(o.code);
        return (
          <button type="button" key={o.code} className={'optbtn' + (on ? ' selected' : '')}
            onClick={() => onChange(on ? value.filter((c) => c !== o.code) : [...value, o.code])}>
            <span className="oc">{o.code}</span>{o.label}
          </button>
        );
      })}
    </div>
  );
}

function RuleBuilder({ meta, onSubmit, editing, onCancel }) {
  const segments = meta.segments;
  const selectable = segments.filter((s) => ['single', 'multi'].includes(s.selection_type));
  const numericSegs = segments.filter((s) => s.selection_type === 'numeric');
  const multiSegs = segments.filter((s) => s.selection_type === 'multi');
  const optsOf = (key) => segments.find((s) => s.key === key)?.options || [];

  const [advanced, setAdvanced] = useState(false);
  const [type, setType] = useState('FILTER');
  const [conds, setConds] = useState([{ key: '', codes: [] }]);
  const [target, setTarget] = useState('');
  const [allow, setAllow] = useState([]);
  const [def, setDef] = useState('');
  const [facts, setFacts] = useState([{ label: '', value: '' }]);   // DERIVE — one or more facts
  const [cmode, setCmode] = useState('require');
  const [cCodes, setCCodes] = useState([]);
  const [numTarget, setNumTarget] = useState('');
  const [numMin, setNumMin] = useState('');
  const [numMax, setNumMax] = useState('');
  const [message, setMessage] = useState('');
  const [xmode, setXmode] = useState('exclusive');
  const [exclPairs, setExclPairs] = useState([{ a: '', b: '' }]);   // COMPOSE exclusive — one or more pairs
  const [prereqs, setPrereqs] = useState([{ code: '', reqs: [] }]); // COMPOSE prerequisite — one or more entries
  const [note, setNote] = useState('');
  const [rawJson, setRawJson] = useState('');

  const isEditing = !!editing;
  const whenObj = () => { const o = {}; for (const c of conds) if (c.key && c.codes.length) o[c.key] = c.codes; return o; };

  // Load an existing rule into the form. Returns false if its shape isn't guided-representable.
  function decompose(r) {
    const condsFrom = (when) => (when && Object.keys(when).length) ? Object.entries(when).map(([key, codes]) => ({ key, codes: [...codes] })) : [{ key: '', codes: [] }];
    if (r.type === 'FILTER') { setConds(condsFrom(r.when)); setTarget(r.target || ''); setAllow([...(r.allow || [])]); return true; }
    if (r.type === 'DEFAULT') { setConds(condsFrom(r.when)); setTarget(r.target || ''); setDef(r.default || ''); return true; }
    if (r.type === 'DERIVE') {
      const f = Object.entries(r.facts || {});
      setConds(condsFrom(r.when));
      setFacts(f.length ? f.map(([label, value]) => ({ label, value: String(value) })) : [{ label: '', value: '' }]);
      return true;
    }
    if (r.type === 'CONSTRAINT') {
      // only guided-representable when exactly one of require/forbid/numeric with a single target key
      const kinds = ['require', 'forbid', 'numeric'].filter((k) => r[k]);
      if (kinds.length !== 1) return false;
      const kind = kinds[0];
      const entries = Object.entries(r[kind]);
      if (entries.length !== 1) return false;
      setConds(condsFrom(r.when)); setMessage(r.message || '');
      const [k, val] = entries[0];
      if (kind === 'numeric') { if (val.maxFromSelection) return false; setCmode('numeric'); setNumTarget(k); setNumMin(val.min != null ? String(val.min) : ''); setNumMax(val.max != null ? String(val.max) : ''); return true; }
      setCmode(kind); setTarget(k); setCCodes([...val]); return true;
    }
    if (r.type === 'COMPOSE') {
      if (r.exclusive && r.prerequisite) return false; // both at once -> JSON
      if (r.exclusive) { setTarget(r.target || ''); setXmode('exclusive'); setExclPairs(r.exclusive.map(([a, b]) => ({ a, b }))); return true; }
      if (r.prerequisite) { setTarget(r.target || ''); setXmode('prerequisite'); setPrereqs(Object.entries(r.prerequisite).map(([code, reqs]) => ({ code, reqs: [...reqs] }))); return true; }
      return false;
    }
    return false;
  }

  React.useEffect(() => {
    resetFields();
    if (!editing) { setType('FILTER'); setAdvanced(false); return; }
    setType(editing.type);
    setNote(editing.note || '');
    const representable = decompose(editing);
    if (representable) { setAdvanced(false); }
    else {
      const { id, type: _t, note: _n, family_id, ...ruleFields } = editing;
      setAdvanced(true);
      setRawJson(JSON.stringify(ruleFields, null, 2));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);
  const updateCond = (i, next) => setConds(conds.map((c, j) => (j === i ? next : c)));
  const help = RULE_TYPES.find((r) => r.type === type)?.help;

  function buildRule() {
    const when = whenObj();
    const hasWhen = Object.keys(when).length > 0;
    const w = hasWhen ? { when } : {};
    if (type === 'FILTER') return { ...w, target, allow };
    if (type === 'DEFAULT') return { ...w, target, default: def };
    if (type === 'DERIVE') {
      const f = {};
      for (const { label, value } of facts) if (label) f[label] = value;
      return { ...w, facts: f };
    }
    if (type === 'CONSTRAINT') {
      const base = { ...w, message };
      if (cmode === 'require') return { ...base, require: { [target]: cCodes } };
      if (cmode === 'forbid') return { ...base, forbid: { [target]: cCodes } };
      return { ...base, numeric: { [numTarget]: { ...(numMin !== '' ? { min: +numMin } : {}), ...(numMax !== '' ? { max: +numMax } : {}) } } };
    }
    if (type === 'COMPOSE') {
      if (xmode === 'exclusive') return { target, exclusive: exclPairs.filter((p) => p.a && p.b).map((p) => [p.a, p.b]) };
      const pre = {};
      for (const { code, reqs } of prereqs) if (code && reqs.length) pre[code] = reqs;
      return { target, prerequisite: pre };
    }
    return {};
  }
  function valid() {
    if (type === 'FILTER') return target && allow.length;
    if (type === 'DEFAULT') return target && def;
    if (type === 'DERIVE') return facts.some((f) => f.label && f.value) && facts.every((f) => (!f.label && !f.value) || (f.label && f.value));
    if (type === 'CONSTRAINT') return message && (cmode === 'numeric' ? (numTarget && (numMin !== '' || numMax !== '')) : (target && cCodes.length));
    if (type === 'COMPOSE') {
      if (!target) return false;
      if (xmode === 'exclusive') return exclPairs.some((p) => p.a && p.b && p.a !== p.b) && exclPairs.every((p) => (!p.a && !p.b) || (p.a && p.b && p.a !== p.b));
      return prereqs.some((p) => p.code && p.reqs.length) && prereqs.every((p) => (!p.code && !p.reqs.length) || (p.code && p.reqs.length));
    }
    return false;
  }
  function resetFields() {
    setConds([{ key: '', codes: [] }]); setTarget(''); setAllow([]); setDef(''); setFacts([{ label: '', value: '' }]);
    setCmode('require'); setCCodes([]); setNumTarget(''); setNumMin(''); setNumMax(''); setMessage('');
    setXmode('exclusive'); setExclPairs([{ a: '', b: '' }]); setPrereqs([{ code: '', reqs: [] }]); setNote(''); setRawJson('');
  }
  function submit() {
    let ruleObj;
    if (advanced) { try { ruleObj = JSON.parse(rawJson); } catch { alert('Invalid JSON — check the syntax.'); return; } }
    else { if (!valid()) { alert('Please complete the required fields for this rule.'); return; } ruleObj = buildRule(); }
    onSubmit(type, ruleObj, note, editing?.id);   // editId present ⇒ update in place
    if (!editing) resetFields();                   // on edit, parent clears `editing`, which resets via effect
  }
  function toggleAdvanced(on) {
    if (on && valid()) setRawJson(JSON.stringify(buildRule(), null, 2)); // prefill from guided form
    setAdvanced(on);
  }

  const preview = valid() ? describeRule(type, buildRule(), segments) : null;
  const targetSel = (val, set, placeholder = '— segment —') => (
    <select value={val} onChange={(e) => set(e.target.value)}>
      <option value="">{placeholder}</option>
      {selectable.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
    </select>
  );

  return (
    <div className={'rulebuilder' + (isEditing ? ' editing' : '')}>
      <div className="toolrow" style={{ margin: '0.6rem 0 0.4rem', alignItems: 'center' }}>
        <b style={{ fontSize: '0.9rem' }}>{isEditing ? 'Edit rule' : 'Add a rule'}</b>
        {isEditing && <span className="pill warn">editing existing rule</span>}
        {isEditing && <button className="btn secondary small" onClick={onCancel}>✕ Cancel edit</button>}
        <label className="switch" style={{ marginLeft: 'auto' }}>
          <input type="checkbox" checked={advanced} onChange={(e) => toggleAdvanced(e.target.checked)} />
          <span className="slider" /><span className="switch-label">Advanced (JSON)</span>
        </label>
      </div>

      <div className="toolrow" style={{ margin: '0 0 0.4rem' }}>
        <label className="muted">Rule type</label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
          {RULE_TYPES.map((r) => <option key={r.type} value={r.type}>{r.label}</option>)}
        </select>
        <span className="muted" style={{ fontSize: '0.8rem' }}>ⓘ {help}</span>
      </div>

      {advanced ? (
        <textarea className="rb-json" rows={4} placeholder='{"when":{"size":["0145"]},"target":"connection","allow":["S103"]}'
          value={rawJson} onChange={(e) => setRawJson(e.target.value)} />
      ) : (
        <div className="rb-form">
          {type !== 'COMPOSE' && (
            <div className="rb-block">
              <div className="rb-label">When… <span className="muted">(leave empty for “always”)</span></div>
              {conds.map((c, i) => (
                <div key={i} className="rb-cond">
                  <select value={c.key} onChange={(e) => updateCond(i, { key: e.target.value, codes: [] })}>
                    <option value="">— segment —</option>
                    {selectable.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </select>
                  {c.key && <span className="muted">is</span>}
                  {c.key && <CodePicker options={optsOf(c.key)} value={c.codes} onChange={(codes) => updateCond(i, { ...c, codes })} />}
                  {conds.length > 1 && <button className="btn secondary small" onClick={() => setConds(conds.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button className="btn secondary small" onClick={() => setConds([...conds, { key: '', codes: [] }])}>＋ add another condition (AND)</button>
            </div>
          )}

          {type === 'FILTER' && (
            <div className="rb-block">
              <div className="rb-label">only allow…</div>
              {targetSel(target, (v) => { setTarget(v); setAllow([]); }, '— target segment —')}
              {target && <CodePicker options={optsOf(target)} value={allow} onChange={setAllow} />}
            </div>
          )}
          {type === 'DEFAULT' && (
            <div className="rb-block">
              <div className="rb-label">default…</div>
              {targetSel(target, (v) => { setTarget(v); setDef(''); }, '— target segment —')}
              {target && (
                <select value={def} onChange={(e) => setDef(e.target.value)} style={{ marginLeft: '0.4rem' }}>
                  <option value="">— to value —</option>
                  {optsOf(target).map((o) => <option key={o.code} value={o.code}>{o.code} — {o.label}</option>)}
                </select>
              )}
            </div>
          )}
          {type === 'DERIVE' && (
            <div className="rb-block">
              <div className="rb-label">show fact(s)…</div>
              {facts.map((f, i) => (
                <div key={i} className="rb-cond">
                  <input placeholder="Label (e.g. Max system pressure)" style={{ width: 240 }} value={f.label}
                    onChange={(e) => setFacts(facts.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} />
                  <span className="muted"> = </span>
                  <input placeholder="Value (e.g. 40 bar)" style={{ width: 180 }} value={f.value}
                    onChange={(e) => setFacts(facts.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)))} />
                  {facts.length > 1 && <button className="btn secondary small" onClick={() => setFacts(facts.filter((_, j) => j !== i))}>✕</button>}
                </div>
              ))}
              <button className="btn secondary small" onClick={() => setFacts([...facts, { label: '', value: '' }])}>＋ add another fact</button>
            </div>
          )}
          {type === 'CONSTRAINT' && (
            <div className="rb-block">
              <div className="rb-label">rule…</div>
              <div className="toolrow" style={{ margin: '0 0 0.3rem' }}>
                {['require', 'forbid', 'numeric'].map((m) => (
                  <label key={m}><input type="radio" checked={cmode === m} onChange={() => setCmode(m)} /> {m === 'numeric' ? 'keep number in range' : m}</label>
                ))}
              </div>
              {cmode !== 'numeric' ? (
                <div>
                  {targetSel(target, (v) => { setTarget(v); setCCodes([]); }, '— segment —')}
                  <span className="muted"> {cmode === 'require' ? 'must be one of' : 'cannot be'} </span>
                  {target && <CodePicker options={optsOf(target)} value={cCodes} onChange={setCCodes} />}
                </div>
              ) : (
                <div className="toolrow" style={{ margin: 0 }}>
                  <select value={numTarget} onChange={(e) => setNumTarget(e.target.value)}>
                    <option value="">— numeric segment —</option>
                    {numericSegs.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
                  </select>
                  <label className="muted">min</label><input type="number" style={{ width: 80 }} value={numMin} onChange={(e) => setNumMin(e.target.value)} />
                  <label className="muted">max</label><input type="number" style={{ width: 80 }} value={numMax} onChange={(e) => setNumMax(e.target.value)} />
                  {numericSegs.length === 0 && <span className="muted" style={{ fontSize: '0.78rem' }}>(this product has no numeric positions)</span>}
                </div>
              )}
              <input placeholder="Message shown if violated (required)" style={{ width: '100%', marginTop: '0.4rem' }} value={message} onChange={(e) => setMessage(e.target.value)} />
            </div>
          )}
          {type === 'COMPOSE' && (
            <div className="rb-block">
              <div className="rb-label">on multi-select segment…</div>
              <select value={target} onChange={(e) => { setTarget(e.target.value); setExclPairs([{ a: '', b: '' }]); setPrereqs([{ code: '', reqs: [] }]); }}>
                <option value="">— segment —</option>
                {multiSegs.map((s) => <option key={s.key} value={s.key}>{s.name}</option>)}
              </select>
              {multiSegs.length === 0 && <span className="muted" style={{ fontSize: '0.78rem' }}> (this product has no multi-select positions)</span>}
              {target && (
                <>
                  <div className="toolrow" style={{ margin: '0.4rem 0 0.3rem' }}>
                    <label><input type="radio" checked={xmode === 'exclusive'} onChange={() => setXmode('exclusive')} /> options that can't be combined</label>
                    <label><input type="radio" checked={xmode === 'prerequisite'} onChange={() => setXmode('prerequisite')} /> options that require another</label>
                  </div>
                  {xmode === 'exclusive' ? (
                    <>
                      {exclPairs.map((p, i) => (
                        <div key={i} className="rb-cond">
                          <select value={p.a} onChange={(e) => setExclPairs(exclPairs.map((x, j) => (j === i ? { ...x, a: e.target.value } : x)))}><option value="">— option —</option>{optsOf(target).map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}</select>
                          <span className="muted">and</span>
                          <select value={p.b} onChange={(e) => setExclPairs(exclPairs.map((x, j) => (j === i ? { ...x, b: e.target.value } : x)))}><option value="">— option —</option>{optsOf(target).map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}</select>
                          <span className="muted">cannot be combined</span>
                          {exclPairs.length > 1 && <button className="btn secondary small" onClick={() => setExclPairs(exclPairs.filter((_, j) => j !== i))}>✕</button>}
                        </div>
                      ))}
                      <button className="btn secondary small" onClick={() => setExclPairs([...exclPairs, { a: '', b: '' }])}>＋ add another pair</button>
                    </>
                  ) : (
                    <>
                      {prereqs.map((p, i) => (
                        <div key={i} className="rb-cond">
                          <select value={p.code} onChange={(e) => setPrereqs(prereqs.map((x, j) => (j === i ? { ...x, code: e.target.value, reqs: [] } : x)))}><option value="">— option —</option>{optsOf(target).map((o) => <option key={o.code} value={o.code}>{o.code}</option>)}</select>
                          <span className="muted"> requires: </span>
                          {p.code && <CodePicker options={optsOf(target).filter((o) => o.code !== p.code)} value={p.reqs} onChange={(reqs) => setPrereqs(prereqs.map((x, j) => (j === i ? { ...x, reqs } : x)))} />}
                          {prereqs.length > 1 && <button className="btn secondary small" onClick={() => setPrereqs(prereqs.filter((_, j) => j !== i))}>✕</button>}
                        </div>
                      ))}
                      <button className="btn secondary small" onClick={() => setPrereqs([...prereqs, { code: '', reqs: [] }])}>＋ add another prerequisite</button>
                    </>
                  )}
                </>
              )}
            </div>
          )}

          <div className="rb-block">
            <input placeholder="Note (optional — for admins)" style={{ width: '100%' }} value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
      )}

      {!advanced && (
        <div className={'rb-preview' + (preview ? '' : ' empty')}>
          {preview ? <><b>Preview:</b> {preview}</> : <span className="muted">Complete the fields above to preview the rule in plain English.</span>}
        </div>
      )}
      <div style={{ marginTop: '0.5rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn" onClick={submit} disabled={!advanced && !valid()}>{isEditing ? '💾 Save changes' : 'Add rule'}</button>
        {isEditing && <button className="btn secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

function PriceCell({ row, kindLabel, onSave, onDelete }) {
  const [v, setV] = useState(row.amount);
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <span className="muted" style={{ fontSize: '0.72rem' }}>{kindLabel} </span>
      <input type="number" style={{ width: 84 }} value={v} onChange={(e) => setV(+e.target.value)} />
      {+v !== row.amount && <button className="btn small" onClick={() => onSave(+v)}>✓</button>}
      {onDelete && <button className="btn danger small" title="Remove price" onClick={onDelete}>✕</button>}
    </span>
  );
}

// Inline "add adder" control shown on options that have no adder yet
function AddAdder({ onAdd }) {
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState('abs');
  const [amt, setAmt] = useState('');
  if (!open) return <button className="btn secondary small" onClick={() => setOpen(true)}>+ adder</button>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      <select value={kind} style={{ width: 52 }} onChange={(e) => setKind(e.target.value)}><option value="abs">₹</option><option value="pct">%</option></select>{' '}
      <input type="number" style={{ width: 76 }} placeholder="amount" value={amt} onChange={(e) => setAmt(e.target.value)} autoFocus />
      <button className="btn small" onClick={() => { onAdd(kind, amt); setOpen(false); setAmt(''); }}>✓</button>
      <button className="btn secondary small" onClick={() => { setOpen(false); setAmt(''); }}>✕</button>
    </span>
  );
}

// Base prices: generic {} plus optional per-segment-value keyed prices
function BasePricesCard({ fam, meta, prices, reload }) {
  const [matchKey, setMatchKey] = useState('');       // '' = generic
  const [matchCode, setMatchCode] = useState('');
  const [amount, setAmount] = useState('');
  const base = prices?.base || [];
  const currency = prices?.priceList?.currency || 'INR';
  const keySeg = meta.segments.find((s) => s.key === matchKey);

  const describeMatch = (m) => {
    const obj = safeParse(m);
    const keys = Object.keys(obj);
    if (!keys.length) return 'Generic (all configurations)';
    return keys.map((k) => {
      const seg = meta.segments.find((s) => s.key === k);
      return `${seg ? seg.name : k} = ${obj[k]}`;
    }).join(', ');
  };

  async function add() {
    if (amount === '' || isNaN(+amount)) { alert('Enter a base amount.'); return; }
    const match = matchKey && matchCode ? { [matchKey]: matchCode } : {};
    try {
      await api.post('/api/admin/base-prices', { family_id: fam.id, match, amount: +amount });
      setMatchKey(''); setMatchCode(''); setAmount('');
      reload();
    } catch { /* surfaced via global toast */ }
  }

  return (
    <div className="card" style={{ marginBottom: '0.9rem' }}>
      <h3>Base price variants ({currency}) — {base.length}</h3>
      <p className="muted" style={{ fontSize: '0.78rem', marginTop: 0 }}>
        A configuration's price = the most specific matching base price + option adders. Add a
        <b> Generic</b> base for the family, and optionally per-value base prices (e.g. one per size).
      </p>
      <table className="list">
        <thead><tr><th>Applies to</th><th>Amount</th><th></th></tr></thead>
        <tbody>
          {base.length === 0 && <tr><td colSpan="3" className="muted">No base price yet — add at least a Generic one so configurations can be priced.</td></tr>}
          {base.slice().sort((a, b) => a.match.length - b.match.length).map((b) => (
            <tr key={b.id}>
              <td>{describeMatch(b.match)}</td>
              <td><PriceCell row={b} kindLabel="" onSave={async (amt) => { await api.patch('/api/admin/base-prices/' + b.id, { amount: amt }); reload(); }}
                onDelete={async () => { await api.del('/api/admin/base-prices/' + b.id); reload(); }} /></td>
              <td></td>
            </tr>
          ))}
          <tr>
            <td style={{ whiteSpace: 'nowrap' }}>
              <select value={matchKey} onChange={(e) => { setMatchKey(e.target.value); setMatchCode(''); }}>
                <option value="">Generic (all)</option>
                {meta.segments.filter((s) => ['single', 'multi'].includes(s.selection_type)).map((s) => <option key={s.key} value={s.key}>per {s.name}</option>)}
              </select>{' '}
              {keySeg && (
                <select value={matchCode} onChange={(e) => setMatchCode(e.target.value)}>
                  <option value="">— value —</option>
                  {keySeg.options.map((o) => <option key={o.code} value={o.code}>{o.code} — {o.label}</option>)}
                </select>
              )}
            </td>
            <td><input type="number" style={{ width: 110 }} placeholder="amount" value={amount} onChange={(e) => setAmount(e.target.value)} /></td>
            <td><button className="btn small" onClick={add}>Add base price</button></td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------- Spare-parts administration (many-to-many with families) ----------
// Used two ways: as the top-level "Spare Parts" tab (scopeFamily=null, manage all),
// and as a card inside a family editor (scopeFamily set → only that family's spares,
// with the add form pre-linked to it).
function SparePartsManager({ scopeFamily = null, onChanged }) {
  const [parts, setParts] = useState(null);
  const [families, setFamilies] = useState([]);
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const [editId, setEditId] = useState(null);

  const load = () => api.get('/api/admin/parts').then(setParts);
  // refresh our own list AND let the parent refresh (e.g. the family tab's spare count)
  const refresh = () => { load(); if (onChanged) onChanged(); };
  useEffect(() => { load(); api.get('/api/admin/families').then(setFamilies); }, []);

  if (!parts) return <p className="muted">Loading spare parts…</p>;

  const famName = (id) => { const f = families.find((x) => x.id === id); return f ? f.name : '#' + id; };
  const scoped = scopeFamily ? parts.filter((p) => (p.family_ids || []).includes(scopeFamily.id)) : parts;
  const needle = q.trim().toLowerCase();
  const shown = scoped.filter((p) => !needle || (p.part_number + ' ' + p.name + ' ' + (p.description || '')).toLowerCase().includes(needle));

  const body = (
    <>
      <div className="toolrow">
        <button className="btn small" onClick={() => { setAdding(!adding); setEditId(null); }}>{adding ? '✕ Cancel' : '➕ Add spare part'}</button>
        {!scopeFamily && <input style={{ flex: 1, minWidth: 200 }} placeholder="Search part number, name or description…" value={q} onChange={(e) => setQ(e.target.value)} />}
        <span className="muted" style={{ fontSize: '0.82rem' }}>{shown.length}{scopeFamily ? ' linked' : ` of ${parts.length}`}</span>
      </div>
      {adding && (
        <PartForm families={families} preselect={scopeFamily ? [scopeFamily.id] : []}
          onDone={() => { setAdding(false); refresh(); }} onCancel={() => setAdding(false)} />
      )}
      <table className="list">
        <thead><tr><th>Part number</th><th>Name</th><th>Related families</th><th>Price</th><th>Status</th><th></th></tr></thead>
        <tbody>
          {shown.map((p) => editId === p.id ? (
            <tr key={p.id}><td colSpan="6">
              <PartForm families={families} part={p} onDone={() => { setEditId(null); refresh(); }} onCancel={() => setEditId(null)} />
            </td></tr>
          ) : (
            <tr key={p.id} style={p.status !== 'active' ? { opacity: 0.55 } : undefined}>
              <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontWeight: 600 }}>{p.part_number}</td>
              <td>{p.name}</td>
              <td>{(p.family_ids || []).length ? (p.family_ids || []).map(famName).join(', ') : <span className="muted">— none —</span>}</td>
              <td>{p.price == null ? <span className="muted">PoA</span> : fmtINR(p.price)}</td>
              <td><span className={'pill ' + (p.status === 'active' ? 'ok' : 'gray')}>{p.status}</span></td>
              <td><button className="btn secondary small" onClick={() => { setEditId(p.id); setAdding(false); }}>Edit</button></td>
            </tr>
          ))}
          {shown.length === 0 && <tr><td colSpan="6" className="muted">{scopeFamily ? 'No spare parts linked to this family yet — add one above.' : 'No spare parts match your search.'}</td></tr>}
        </tbody>
      </table>
    </>
  );

  if (scopeFamily) {
    return (
      <div className="card">
        <h3>Spare parts for this family ({scoped.length})</h3>
        <p className="muted" style={{ fontSize: '0.8rem', marginTop: 0 }}>
          Spares related to <b>{scopeFamily.name}</b>. A spare can be linked to several families — add or edit here, or manage every spare from the top-level <b>Spare Parts</b> tab.
        </p>
        {body}
      </div>
    );
  }
  return (
    <>
      <p className="muted">Manage spare parts and the product families each one relates to. A spare can belong to a single product or to several related products; it surfaces as a “related spare” whenever any of those products is on a quote.</p>
      {body}
    </>
  );
}

// Add / edit a spare part, including its one-or-many family links (checkbox multi-select).
function PartForm({ families, part = null, preselect = [], onDone, onCancel }) {
  const [pn, setPn] = useState(part ? part.part_number : '');
  const [name, setName] = useState(part ? part.name : '');
  const [desc, setDesc] = useState(part ? (part.description || '') : '');
  const [price, setPrice] = useState(part && part.price != null ? String(part.price) : '');
  const [status, setStatus] = useState(part ? part.status : 'active');
  const [famIds, setFamIds] = useState(part ? (part.family_ids || []) : preselect);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const toggle = (id) => setFamIds((cur) => cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]);
  const sortedFams = [...families].sort((a, b) => (a.code || '').localeCompare(b.code || ''));

  async function save() {
    setErr('');
    if (!pn.trim() || !name.trim()) { setErr('Part number and name are required.'); return; }
    setBusy(true);
    try {
      const payload = { part_number: pn.trim(), name: name.trim(), description: desc || null, family_ids: famIds, price: price === '' ? null : +price };
      if (part) await api.patch('/api/admin/parts/' + part.id, { ...payload, status }, { quiet: true });
      else await api.post('/api/admin/parts', payload, { quiet: true });
      onDone();
    } catch (e) { setErr(e.message || 'Could not save the spare part.'); }
    finally { setBusy(false); }
  }

  return (
    <div className="card partform">
      <h4 style={{ marginTop: 0 }}>{part ? `Edit spare part ${part.part_number}` : 'New spare part'}</h4>
      <div className="partform-grid">
        <label>Part number<input value={pn} onChange={(e) => setPn(e.target.value)} placeholder="e.g. BYP04/xx" /></label>
        <label>Name<input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Bypass valve assembly" /></label>
        <label>Description<input value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="optional" /></label>
        <label>Unit price (₹)<input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="blank = PoA" /></label>
        {part && (
          <label>Status<select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="active">active</option><option value="retired">retired</option>
          </select></label>
        )}
      </div>
      <div style={{ marginTop: '0.7rem' }}>
        <div className="muted" style={{ fontSize: '0.8rem', marginBottom: '0.35rem' }}>Related product families — select a single product or several related ones:</div>
        <div className="famselect">
          {sortedFams.map((f) => (
            <label key={f.id} className={'famchip' + (famIds.includes(f.id) ? ' on' : '')}>
              <input type="checkbox" checked={famIds.includes(f.id)} onChange={() => toggle(f.id)} />
              <span>{f.code} — {f.name}</span>
            </label>
          ))}
        </div>
        <div className="muted" style={{ fontSize: '0.76rem', marginTop: '0.35rem' }}>{famIds.length} famil{famIds.length === 1 ? 'y' : 'ies'} selected</div>
      </div>
      {err && <div className="notice" style={{ borderColor: 'var(--bad)', color: 'var(--bad)', marginTop: '0.6rem' }}>{err}</div>}
      <div style={{ marginTop: '0.8rem', display: 'flex', gap: '0.5rem' }}>
        <button className="btn small" disabled={busy} onClick={save}>{busy ? 'Saving…' : (part ? 'Save changes' : 'Create spare part')}</button>
        <button className="btn secondary small" disabled={busy} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
