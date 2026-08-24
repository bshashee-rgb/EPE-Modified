import React, { useEffect, useState } from 'react';
import { api, setActor, setUnauthorizedHandler } from './api.js';
import { subscribeToasts, dismissToast } from './toast.js';
import Catalog from './pages/Catalog.jsx';
import Configurator from './pages/Configurator.jsx';
import QuoteDetail from './pages/QuoteDetail.jsx';
import Parts from './pages/Parts.jsx';
import Admin from './pages/Admin.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Login from './pages/Login.jsx';

const PAGES = ['dashboard', 'catalog', 'configure', 'quote', 'parts', 'admin'];
// hash routes: #/dashboard (home), #/catalog, #/configure/:familyId, #/quote/:id, #/parts, #/admin
function parseHash() {
  let h = (window.location.hash || '#/dashboard').slice(2);
  const [page, ...rest] = h.split('/');
  return { page: page || 'dashboard', args: rest };
}
// UI-3: decode a hash segment without throwing on a malformed %-escape.
function safeDecode(s) { try { return decodeURIComponent(s); } catch { return s; } }
const validId = (v) => Number.isInteger(+v) && +v > 0;

function Toaster() {
  const [items, setItems] = useState([]);
  useEffect(() => subscribeToasts(setItems), []);
  if (!items.length) return null;
  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {items.map((t) => (
        <div key={t.id} className={'toast ' + (t.type || 'error')} role="status">
          <span>{t.message}</span>
          <button className="toast-x" aria-label="Dismiss" onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}

function NotFound({ nav }) {
  return (
    <div className="card" style={{ maxWidth: 480, margin: '3rem auto', textAlign: 'center' }}>
      <h2 style={{ marginTop: 0 }}>Page not found</h2>
      <p className="muted">That link doesn’t point to a valid page.</p>
      <button className="btn" onClick={() => nav('dashboard')}>← Back to Dashboard</button>
    </div>
  );
}

export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [role, setRole] = useState('sales'); // legacy actor-picker role (no server session)
  // undefined = checking session; null = needs login; {legacy:true} = no auth route
  // on the server (untouched Express); {email,name,role} = signed in.
  const [user, setUser] = useState(undefined);

  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // Session bootstrap: 200 -> signed in; 401 -> show Login; 404 -> the server
  // has no /api/auth/me route at all (unmodified local Express) -> legacy mode,
  // behave exactly as before (actor picker stays).
  useEffect(() => {
    setUnauthorizedHandler(() => setUser(null));
    api.get('/api/auth/me', { quiet: true })
      .then((u) => { setUser(u); setActor(u.name); })
      .catch((err) => { setUser(err.status === 404 ? { legacy: true } : null); });
  }, []);

  // Legacy mode still drives X-Actor from the role picker; signed-in mode
  // already set the actor to the user's name in the bootstrap effect above.
  useEffect(() => { if (user && user.legacy) setActor(role); }, [role, user]);

  const nav = (to) => { window.location.hash = '#/' + to; };
  const is = (p) => route.page === p;

  async function signOut() {
    try { await api.post('/api/auth/logout', {}, { quiet: true }); } catch { /* ignore */ }
    setUser(null);
  }

  if (user === undefined) return null; // brief flash while /api/auth/me resolves
  if (user === null) return <Login onLogin={(u) => { setUser(u); setActor(u.name); }} />;

  const legacy = !!user.legacy;
  const effectiveRole = legacy ? role : user.role;

  return (
    <>
      <header className="topbar">
        <div className="brand" style={{ cursor: 'pointer' }} onClick={() => nav('dashboard')}>EPE <span>Quote Builder</span></div>
        <nav>
          <button className={is('dashboard') || is('quote') ? 'active' : ''} onClick={() => nav('dashboard')}>Dashboard</button>
          <button className={is('catalog') || is('configure') ? 'active' : ''} onClick={() => nav('catalog')}>Catalogue</button>
          <button className={is('parts') ? 'active' : ''} onClick={() => nav('parts')}>Parts & Spares</button>
          {effectiveRole === 'admin' && <button className={is('admin') ? 'active' : ''} onClick={() => nav('admin')}>Admin</button>}
        </nav>
        {legacy ? (
          <div className="rolebox">
            Role
            <select value={role} onChange={(e) => { setRole(e.target.value); if (e.target.value !== 'admin' && is('admin')) nav('dashboard'); }}>
              <option value="sales">Sales</option>
              <option value="admin">Product Admin</option>
            </select>
          </div>
        ) : (
          <div className="rolebox">
            <span>{user.name} · {user.role}</span>
            <button className="btn secondary small" onClick={signOut}>Sign out</button>
          </div>
        )}
      </header>
      <main className="page">
        {is('dashboard') && <Dashboard nav={nav} />}
        {is('catalog') && <Catalog nav={nav} />}
        {is('configure') && (validId(route.args[0])
          ? <Configurator familyId={+route.args[0]} nav={nav} presetCode={route.args[1] ? safeDecode(route.args.slice(1).join('/')) : null} />
          : <NotFound nav={nav} />)}
        {is('quote') && (validId(route.args[0]) ? <QuoteDetail quoteId={+route.args[0]} nav={nav} /> : <NotFound nav={nav} />)}
        {is('parts') && <Parts nav={nav} />}
        {is('admin') && (effectiveRole === 'admin' ? <Admin nav={nav} /> : <NotFound nav={nav} />)}
        {!PAGES.includes(route.page) && <NotFound nav={nav} />}
      </main>
      <Toaster />
    </>
  );
}
