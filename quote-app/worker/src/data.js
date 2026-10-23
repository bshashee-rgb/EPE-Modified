// D1 data-access helpers. Mirrors the sync helpers in server/index.js + the
// db-touching engine functions, in async D1 form. Shapes are parity-tested.

export async function loadFamilyMeta(DB, familyId) {
  const family = await DB.prepare('SELECT * FROM families WHERE id=?').bind(familyId).first();
  if (!family) return null;
  const segments = (await DB.prepare('SELECT * FROM segments WHERE family_id=? ORDER BY position').bind(familyId).all()).results;
  for (const s of segments) {
    s.options = (await DB.prepare("SELECT * FROM options WHERE segment_id=? AND status='active' ORDER BY sort, id").bind(s.id).all()).results;
  }
  const rules = (await DB.prepare('SELECT * FROM rules WHERE family_id=?').bind(familyId).all()).results
    .map(r => ({ id: r.id, type: r.type, note: r.note, ...JSON.parse(r.rule) }));
  const links = (await DB.prepare('SELECT * FROM companion_links WHERE family_id=?').bind(familyId).all()).results
    .map(r => ({ id: r.id, note: r.note, ...JSON.parse(r.link) }));
  family.code_template = family.code_template ? JSON.parse(family.code_template) : { separator: '-' };
  return { family, segments, rules, links };
}

export const audit = (DB, actor, action, entity, entityId, detail) =>
  DB.prepare('INSERT INTO audit_log(actor,action,entity,entity_id,detail) VALUES (?,?,?,?,?)')
    .bind(actor || 'demo', action, entity, String(entityId ?? ''), detail ? JSON.stringify(detail) : null).run();

export const touchFamily = (DB, familyId) =>
  familyId ? DB.prepare("UPDATE families SET updated_at = datetime('now') WHERE id=?").bind(familyId).run() : Promise.resolve();

export const partFamilyIds = async (DB, partId) =>
  (await DB.prepare('SELECT family_id FROM part_families WHERE part_id=? ORDER BY family_id').bind(partId).all()).results.map(r => r.family_id);

export const segmentFamilyId = async (DB, segmentId) =>
  (await DB.prepare('SELECT family_id FROM segments WHERE id=?').bind(segmentId).first())?.family_id;

export const optionFamilyId = async (DB, optionId) =>
  (await DB.prepare('SELECT s.family_id AS fid FROM options o JOIN segments s ON s.id=o.segment_id WHERE o.id=?').bind(optionId).first())?.fid;

export const stampQuote = (DB, quoteId, actor) =>
  DB.prepare("UPDATE quotes SET updated_at=datetime('now'), updated_by=? WHERE id=?").bind(actor || 'demo', quoteId).run();

export const lineQuoteId = async (DB, lineId) =>
  (await DB.prepare('SELECT quote_id FROM quote_lines WHERE id=?').bind(lineId).first())?.quote_id;

export const activePriceList = (DB) =>
  DB.prepare("SELECT * FROM price_lists WHERE status='published' ORDER BY id LIMIT 1").first();

// Finalized-quote guard (server is the authority — NFR-3). Same 404/409 semantics.
export async function requireDraft(DB, quoteId) {
  const q = await DB.prepare('SELECT * FROM quotes WHERE id=?').bind(+quoteId).first();
  if (!q) return { error: { error: 'quote not found' }, status: 404 };
  if (q.status !== 'Draft') return {
    error: { error: `Quote ${q.number} Rev ${q.revision} is ${q.status} and locked — save a new revision or a new quote to change its contents.` },
    status: 409,
  };
  return { quote: q };
}

export async function nextRevision(DB, number) {
  let max = 'A';
  for (const r of (await DB.prepare('SELECT revision FROM quotes WHERE number=?').bind(number).all()).results) {
    if (r.revision > max) max = r.revision;
  }
  return max >= 'Z' ? null : String.fromCharCode(max.charCodeAt(0) + 1);
}

export async function nextQuoteNumber(DB) {
  const year = new Date().getFullYear();
  const rows = (await DB.prepare('SELECT DISTINCT number FROM quotes WHERE number LIKE ?').bind(`Q-${year}-%`).all()).results;
  let max = 0;
  for (const r of rows) { const m = r.number.match(/-(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `Q-${year}-${String(max + 1).padStart(4, '0')}`;
}

export async function nextCustomerCode(DB) {
  const rows = (await DB.prepare("SELECT code FROM customers WHERE code LIKE 'CUST-%'").all()).results;
  let max = 0;
  for (const r of rows) { const m = r.code.match(/-(\d+)$/); if (m) max = Math.max(max, +m[1]); }
  return `CUST-${String(max + 1).padStart(4, '0')}`;
}

// GST type for a quote: compare the supplier's (EPE's) source state against the customer's
// place-of-supply state. 'unknown' when either is blank -- callers fall back to the pre-existing
// flat "GST" label rather than guessing.
export function gstType(sourceState, placeOfSupplyState) {
  if (!sourceState || !placeOfSupplyState) return 'unknown';
  return sourceState === placeOfSupplyState ? 'intra' : 'inter';
}
