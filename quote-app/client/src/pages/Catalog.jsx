import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function Catalog({ nav }) {
  const [data, setData] = useState(null);
  const [q, setQ] = useState('');

  useEffect(() => { api.get('/api/catalog').then(setData); }, []);
  if (!data) return <p className="muted">Loading catalogue…</p>;

  const match = (f) => !q || (f.name + ' ' + f.code + ' ' + (f.description || '')).toLowerCase().includes(q.toLowerCase());
  const anyMatch = data.families.some((f) => f.status === 'published' && match(f));

  return (
    <div>
      <h1>Product Catalogue</h1>
      <div className="searchbar">
        <input placeholder="Search product families, series codes… (e.g. bladder, LD, PST3)" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {!anyMatch && <p className="muted">No published products match “{q}”.</p>}
      {data.categories.map((cat) => {
        const fams = data.families.filter((f) => f.category_id === cat.id && f.status === 'published' && match(f));
        if (!fams.length) return null;
        return (
          <section key={cat.id} style={{ marginBottom: '1.4rem' }}>
            <h2 style={{ fontSize: '1.05rem', color: 'var(--muted)' }}>{cat.name}</h2>
            <div className="cards">
              {fams.map((f) => (
                <div key={f.id} className="card clickable" onClick={() => nav('configure/' + f.id)}>
                  <h3>{f.name}</h3>
                  <div style={{ marginBottom: '0.4rem' }}>
                    <span className="pill">{f.code}</span>{' '}
                    {f.kind !== 'configurable' && <span className="pill gray">{f.kind.replace('_', ' ')}</span>}
                  </div>
                  <div className="muted">{f.description}</div>
                  {f.datasheet_ref && <div className="muted" style={{ marginTop: '0.4rem', fontSize: '0.75rem' }}>Datasheet: {f.datasheet_ref}</div>}
                  {f.updated_at && <div className="muted" style={{ fontSize: '0.75rem' }}>🕒 Specs updated: {f.updated_at.slice(0, 10)}</div>}
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
