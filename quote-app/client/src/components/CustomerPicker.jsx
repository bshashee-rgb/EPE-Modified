import React, { useEffect, useRef, useState } from 'react';

// Searchable customer combobox — filters by name OR customer code as you type. There's no
// existing combobox in this codebase; this is a small, self-contained one (no portal/library).
export default function CustomerPicker({ customers, value, onChange, disabled, onNewCustomer }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const boxRef = useRef(null);

  const selected = customers.find((c) => c.id === value) || null;

  useEffect(() => {
    function onDocClick(e) { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, []);

  const needle = query.trim().toLowerCase();
  const matches = !needle ? customers : customers.filter((c) =>
    (c.name + ' ' + (c.code || '')).toLowerCase().includes(needle));

  return (
    <div ref={boxRef} style={{ position: 'relative', display: 'inline-block' }}>
      <input
        disabled={disabled}
        placeholder="— select customer —"
        value={open ? query : (selected ? `${selected.name}${selected.code ? ' (' + selected.code + ')' : ''}` : '')}
        onFocus={() => { setOpen(true); setQuery(''); }}
        onChange={(e) => setQuery(e.target.value)}
        style={{ width: 240 }}
      />
      {open && !disabled && (
        <div className="card" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 50, width: 320, maxHeight: 260, overflowY: 'auto', padding: '0.3rem', marginTop: '0.2rem' }}>
          {matches.length === 0 && <div className="muted" style={{ padding: '0.4rem 0.6rem' }}>No matches.</div>}
          {matches.map((c) => (
            <div key={c.id} className="drawer-fam" style={{ marginBottom: '0.25rem' }}
              onClick={() => { onChange(c.id); setOpen(false); setQuery(''); }}>
              <b>{c.name}</b>{c.code && <span className="muted"> — {c.code}</span>}
              {c.place_of_supply_state && <div className="muted" style={{ fontSize: '0.75rem' }}>{c.place_of_supply_state}</div>}
            </div>
          ))}
          {onNewCustomer && (
            <div className="drawer-fam" style={{ color: 'var(--accent)', fontWeight: 600 }}
              onClick={() => { setOpen(false); setQuery(''); onNewCustomer(); }}>
              + New customer
            </div>
          )}
        </div>
      )}
    </div>
  );
}
