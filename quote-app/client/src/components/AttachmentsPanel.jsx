import React, { useEffect, useState } from 'react';
import { api } from '../api.js';

const CATEGORIES = [
  { value: 'technical', label: 'Technical working' },
  { value: 'costing', label: 'Costing sheet' },
  { value: 'scan', label: 'Scanned document' },
  { value: 'other', label: 'Other' },
];
const PREVIEWABLE = new Set(['application/pdf', 'image/png', 'image/jpeg', 'image/gif', 'image/webp']);
const APPROVAL_TONE = { pending: 'warn', approved: 'ok', rejected: 'bad' };

function fmtSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(1) + ' MB';
}

export default function AttachmentsPanel({ quoteId, quote, role, onApprovalChange }) {
  const [list, setList] = useState(null);
  const [category, setCategory] = useState('other');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState(null); // { id, file_name, mime_type }
  const [rejecting, setRejecting] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');

  const load = () => api.get(`/api/quotes/${quoteId}/attachments`).then(setList);
  useEffect(() => { load(); }, [quoteId]);

  async function doUpload() {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', category);
      await api.upload(`/api/quotes/${quoteId}/attachments`, fd);
      setFile(null);
      load();
    } finally { setUploading(false); }
  }

  async function remove(a) {
    if (!window.confirm(`Remove "${a.file_name}"?`)) return;
    await api.del(`/api/attachments/${a.id}`);
    load();
  }

  async function decide(decision, notes) {
    await api.patch(`/api/quotes/${quoteId}/approval`, { decision, notes: notes || undefined });
    setRejecting(false); setRejectNotes('');
    onApprovalChange();
  }

  const approvalStatus = quote.approval_status || 'pending';

  return (
    <div>
      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Manager approval</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
          <span className={'pill ' + (APPROVAL_TONE[approvalStatus] || 'warn')}>{approvalStatus}</span>
          {quote.approved_by && (
            <span className="muted" style={{ fontSize: '0.82rem' }}>
              by <b>{quote.approved_by}</b>{quote.approved_at ? ` · ${quote.approved_at}` : ''}
            </span>
          )}
          {role === 'admin' && (
            <span style={{ display: 'flex', gap: '0.4rem', marginLeft: 'auto' }}>
              <button className="btn small" onClick={() => decide('approved')}>✓ Approve</button>
              <button className="btn danger small" onClick={() => setRejecting(true)}>✕ Reject</button>
            </span>
          )}
        </div>
        {quote.approval_notes && <p className="muted" style={{ marginBottom: 0 }}>Note: {quote.approval_notes}</p>}
        {rejecting && (
          <div className="modal-overlay" onClick={() => setRejecting(false)}>
            <div className="modal-card" role="dialog" aria-modal="true" aria-label="Reject quote" onClick={(e) => e.stopPropagation()}>
              <h3 style={{ marginTop: 0 }}>Reject this quote</h3>
              <div className="field-grid">
                <label>Reason (optional)
                  <textarea rows={3} value={rejectNotes} onChange={(e) => setRejectNotes(e.target.value)} />
                </label>
              </div>
              <div className="modal-actions">
                <button className="btn secondary" onClick={() => setRejecting(false)}>Cancel</button>
                <button className="btn danger" onClick={() => decide('rejected', rejectNotes)}>Reject</button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="card" style={{ marginBottom: '1rem' }}>
        <h3 style={{ marginTop: 0 }}>Add an attachment</h3>
        <div className="toolrow" style={{ margin: 0 }}>
          <input type="file" onChange={(e) => setFile(e.target.files[0] || null)} />
          <select value={category} onChange={(e) => setCategory(e.target.value)}>
            {CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <button className="btn small" disabled={!file || uploading} onClick={doUpload}>
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>

      {!list ? <p className="muted">Loading attachments…</p> : (
        <table className="list">
          <thead><tr><th>File</th><th>Category</th><th>Size</th><th>Uploaded</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="5" className="muted">No attachments yet.</td></tr>}
            {list.map((a) => (
              <tr key={a.id}>
                <td>{a.file_name}</td>
                <td><span className="pill gray">{a.category}</span></td>
                <td>{fmtSize(a.size_bytes)}</td>
                <td className="muted">{a.uploaded_by} · {a.uploaded_at}</td>
                <td style={{ whiteSpace: 'nowrap' }}>
                  {PREVIEWABLE.has(a.mime_type) && (
                    <button className="btn secondary small" onClick={() => setPreview(a)}>Preview</button>
                  )}{' '}
                  <a className="btn secondary small" href={`/api/attachments/${a.id}?download=1`} download={a.file_name}>Download</a>{' '}
                  <button className="btn danger small" onClick={() => remove(a)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {preview && (
        <div className="modal-overlay" onClick={() => setPreview(null)}>
          <div className="modal-card" style={{ maxWidth: '90vw', width: 820 }} role="dialog" aria-modal="true" aria-label={`Preview ${preview.file_name}`} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0 }}>{preview.file_name}</h3>
            {preview.mime_type.startsWith('image/') ? (
              <img src={`/api/attachments/${preview.id}`} alt={preview.file_name} style={{ maxWidth: '100%', maxHeight: '70vh' }} />
            ) : (
              <iframe title={preview.file_name} src={`/api/attachments/${preview.id}`} style={{ width: '100%', height: '70vh', border: 0 }} />
            )}
            <div className="modal-actions">
              <button className="btn secondary" onClick={() => setPreview(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
