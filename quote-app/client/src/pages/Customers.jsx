import React, { useEffect, useState } from 'react';
import { api } from '../api.js';
import { INDIAN_STATES, gstType } from '../data/indianStates.js';

const BLANK = { name: '', contact: '', phone: '', email: '', gstin: '', address: '', source_state: 'Telangana', place_of_supply_state: '' };

function CustomerForm({ value, onChange, onSave, onCancel, saveLabel = 'Save' }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div className="toolrow" style={{ margin: 0 }}>
        <input placeholder="Customer / company name *" style={{ flex: '1 1 220px' }} value={value.name} onChange={set('name')} />
        <input placeholder="Contact person" style={{ flex: '1 1 160px' }} value={value.contact} onChange={set('contact')} />
      </div>
      <div className="toolrow" style={{ margin: '0.5rem 0 0' }}>
        <input placeholder="Phone" style={{ flex: '1 1 150px' }} value={value.phone} onChange={set('phone')} />
        <input placeholder="Email" style={{ flex: '1 1 200px' }} value={value.email} onChange={set('email')} />
        <input placeholder="GSTIN" style={{ flex: '1 1 180px' }} value={value.gstin} onChange={set('gstin')} />
      </div>
      <div className="toolrow" style={{ margin: '0.5rem 0 0' }}>
        <input placeholder="Billing address" style={{ flex: '1 1 100%' }} value={value.address} onChange={set('address')} />
      </div>
      <div className="toolrow" style={{ margin: '0.5rem 0 0' }}>
        <label className="muted">Source of Supply (EPE)</label>
        <select value={value.source_state} onChange={set('source_state')}>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <label className="muted">Place of Supply (customer)</label>
        <select value={value.place_of_supply_state} onChange={set('place_of_supply_state')}>
          <option value="">— not set —</option>
          {INDIAN_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>
      <div className="modal-actions" style={{ marginTop: '0.8rem', justifyContent: 'flex-start' }}>
        <button className="btn small" disabled={!value.name.trim()} onClick={onSave}>{saveLabel}</button>
        {onCancel && <button className="btn secondary small" onClick={onCancel}>Cancel</button>}
      </div>
    </div>
  );
}

export default function Customers() {
  const [customers, setCustomers] = useState(null);
  const [q, setQ] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [newCust, setNewCust] = useState(BLANK);
  const [editId, setEditId] = useState(null);
  const [edit, setEdit] = useState(BLANK);

  const load = () => api.get('/api/customers').then(setCustomers);
  useEffect(() => { load(); }, []);

  async function addCustomer() {
    if (!newCust.name.trim()) return;
    await api.post('/api/customers', newCust);
    setNewCust(BLANK); setShowNew(false); load();
  }
  async function saveEdit(id) {
    await api.patch('/api/customers/' + id, edit);
    setEditId(null); load();
  }

  if (!customers) return <p className="muted">Loading customers…</p>;

  const needle = q.trim().toLowerCase();
  const shown = customers.filter((c) => !needle ||
    (c.name + ' ' + (c.code || '') + ' ' + (c.gstin || '') + ' ' + (c.email || '')).toLowerCase().includes(needle));

  return (
    <div>
      <h1>Customers</h1>
      <div className="toolrow">
        <button className="btn" onClick={() => setShowNew(!showNew)}>➕ New customer</button>
        <input style={{ flex: 1, minWidth: 220 }} placeholder="Search by name, customer ID, GSTIN or email…" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="muted" style={{ fontSize: '0.82rem' }}>{shown.length} of {customers.length}</span>
      </div>

      {showNew && (
        <CustomerForm value={newCust} onChange={setNewCust} onSave={addCustomer} onCancel={() => setShowNew(false)} saveLabel="Add customer" />
      )}

      <table className="list">
        <thead><tr><th>ID</th><th>Name</th><th>Contact</th><th>GSTIN</th><th>Place of Supply</th><th>GST type</th><th></th></tr></thead>
        <tbody>
          {shown.length === 0 && <tr><td colSpan="7" className="muted">No customers match.</td></tr>}
          {shown.map((c) => editId === c.id ? (
            <tr key={c.id}><td colSpan="7" style={{ padding: 0 }}>
              <CustomerForm value={edit} onChange={setEdit} onSave={() => saveEdit(c.id)} onCancel={() => setEditId(null)} />
            </td></tr>
          ) : (
            <tr key={c.id}>
              <td style={{ fontFamily: 'ui-monospace, Menlo, monospace' }}>{c.code || '—'}</td>
              <td>{c.name}</td>
              <td className="muted">{[c.contact, c.phone, c.email].filter(Boolean).join(' · ') || '—'}</td>
              <td className="muted">{c.gstin || '—'}</td>
              <td>{c.place_of_supply_state || <span className="pill warn">not set</span>}</td>
              <td>
                {(() => {
                  const t = gstType(c.source_state, c.place_of_supply_state);
                  if (t === 'intra') return <span className="pill ok">Intra (CGST+SGST)</span>;
                  if (t === 'inter') return <span className="pill">Inter (IGST)</span>;
                  return <span className="muted">—</span>;
                })()}
              </td>
              <td><button className="btn secondary small" onClick={() => {
                setEditId(c.id);
                setEdit({ name: c.name || '', contact: c.contact || '', phone: c.phone || '', email: c.email || '',
                  gstin: c.gstin || '', address: c.address || '', source_state: c.source_state || 'Telangana',
                  place_of_supply_state: c.place_of_supply_state || '' });
              }}>Edit</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
