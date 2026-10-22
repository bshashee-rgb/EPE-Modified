import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const TYPE_LABEL = { technical: 'Technical', commercial: 'Commercial' };

// Plain elapsed-time TAT (hours/days) — not business-day-aware.
function fmtTAT(raisedAt, respondedAt) {
  const ms = new Date(respondedAt.replace(' ', 'T') + 'Z') - new Date(raisedAt.replace(' ', 'T') + 'Z');
  const hours = ms / 3600000;
  if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))} min`;
  if (hours < 24) return `${hours.toFixed(1)} hr`;
  const days = Math.floor(hours / 24);
  const rem = Math.round(hours % 24);
  return `${days}d ${rem}h`;
}

export default function ClarificationsPanel({ quoteId, finalized }) {
  const [list, setList] = useState(null);
  const [queryType, setQueryType] = useState('technical');
  const [question, setQuestion] = useState('');
  const [saving, setSaving] = useState(false);
  const [respondingId, setRespondingId] = useState(null);
  const [responseText, setResponseText] = useState('');

  const load = () => api.get(`/api/quotes/${quoteId}/clarifications`).then(setList);
  useEffect(() => { load(); }, [quoteId]);

  async function submit() {
    if (!question.trim()) return;
    setSaving(true);
    try {
      await api.post(`/api/quotes/${quoteId}/clarifications`, { query_type: queryType, question: question.trim() });
      setQuestion('');
      load();
    } finally { setSaving(false); }
  }

  async function respond(id) {
    if (!responseText.trim()) return;
    await api.patch(`/api/clarifications/${id}/respond`, { response: responseText.trim() });
    setRespondingId(null); setResponseText('');
    load();
  }

  async function remove(c) {
    if (!window.confirm('Remove this clarification?')) return;
    await api.del(`/api/clarifications/${c.id}`);
    load();
  }

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Log a clarification</h3>
        {!finalized ? (
          <p className="muted">Clarifications can only be logged once this quote has been sent as an offer.</p>
        ) : (
          <div className="toolrow" style={{ margin: 0, alignItems: 'start' }}>
            <select value={queryType} onChange={(e) => setQueryType(e.target.value)}>
              <option value="technical">Technical</option>
              <option value="commercial">Commercial</option>
            </select>
            <textarea rows={2} style={{ flex: 1, minWidth: 260, border: '1px solid var(--line)', borderRadius: 8, padding: '0.4rem 0.6rem' }}
              placeholder="Customer's question…" value={question} onChange={(e) => setQuestion(e.target.value)} />
            <button className="btn small" disabled={!question.trim() || saving} onClick={submit}>{saving ? 'Saving…' : 'Log query'}</button>
          </div>
        )}
      </div>

      {!list ? <p className="muted">Loading clarifications…</p> : list.length === 0 ? (
        <div className="card"><p className="muted" style={{ margin: 0 }}>No clarifications logged yet.</p></div>
      ) : (
        <ol className="timeline">
          {list.map((c) => (
            <li key={c.id} className="tl-item" style={{ alignItems: 'flex-start' }}>
              <span className="tl-dot" title={c.status}>{c.status === 'answered' ? '✅' : '❓'}</span>
              <div className="tl-body" style={{ flex: 1 }}>
                <div className="tl-desc">
                  <span className="pill gray">{TYPE_LABEL[c.query_type] || c.query_type}</span>{' '}
                  {c.question}
                </div>
                <div className="tl-meta muted">raised by <b>{c.raised_by}</b> · {c.raised_at}</div>
                {c.status === 'answered' ? (
                  <div style={{ marginTop: '0.4rem' }}>
                    <div><b>Response:</b> {c.response}</div>
                    <div className="tl-meta muted">
                      by <b>{c.responded_by}</b> · {c.responded_at} · <span className="pill ok">Responded in {fmtTAT(c.raised_at, c.responded_at)}</span>
                    </div>
                  </div>
                ) : respondingId === c.id ? (
                  <div style={{ marginTop: '0.4rem', display: 'flex', gap: '0.4rem', alignItems: 'start' }}>
                    <textarea rows={2} style={{ flex: 1, minWidth: 220, border: '1px solid var(--line)', borderRadius: 8, padding: '0.4rem 0.6rem' }}
                      placeholder="Your response…" value={responseText} onChange={(e) => setResponseText(e.target.value)} autoFocus />
                    <button className="btn small" disabled={!responseText.trim()} onClick={() => respond(c.id)}>Send</button>
                    <button className="btn secondary small" onClick={() => { setRespondingId(null); setResponseText(''); }}>Cancel</button>
                  </div>
                ) : (
                  <div style={{ marginTop: '0.3rem' }}>
                    <span className="pill warn">open</span>{' '}
                    <button className="btn secondary small" onClick={() => { setRespondingId(c.id); setResponseText(''); }}>Respond</button>{' '}
                    <button className="btn danger small" onClick={() => remove(c)}>Remove</button>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
