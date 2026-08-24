// Full-catalogue verification sweep (in-process, no HTTP).
// For every published family it checks:
//   1. The fresh/default configuration produces zero violations.
//   2. Every option shown as ENABLED in the fresh state is selectable alone without violation.
//   3. PAIRWISE: for every enabled option of every "parent" segment (a segment referenced in
//      any rule's `when`), every option shown as enabled UNDER that parent is selectable
//      without violation.
//   4. A full sequential configuration (walking segments in order, picking the current/std/first
//      enabled option, filling required numerics) is complete, violation-free, renders an
//      ordering code and prices (or is explicitly PoA).
//   5. No DEFAULT rule is unreachable — i.e. no DEFAULT names a value that a FILTER rule active
//      under the same `when` condition excludes (the two are authored independently; nothing
//      else catches this — see engine.js findUnreachableDefaults for why this matters).
// Usage: node sweep.js
import { openDb } from './db.js';
import { loadFamilyMeta, evaluate, priceConfiguration, findUnreachableDefaults } from './engine.js';

const db = openDb();
const NUMERIC_SAMPLES = { stroke: '50', cable: '5000', reliefpressure: '210', setpressure: '', precharge: '', oilfill: '' };

const families = db.prepare("SELECT id, code, name FROM families WHERE status='published' ORDER BY id").all();
let totalChecks = 0, failures = [];
const fail = (fam, what, detail) => failures.push(`${fam.code}: ${what} => ${detail}`);

function selectable(seg) { return seg.selection_type === 'single' || seg.selection_type === 'multi'; }
function pick(seg, code) { return seg.selection_type === 'multi' ? [code] : code; }

for (const fam of families) {
  const meta = loadFamilyMeta(db, fam.id);

  // 1. fresh default state
  const fresh = evaluate(meta, {});
  totalChecks++;
  if (fresh.violations.length) fail(fam, 'fresh default state has violations', JSON.stringify(fresh.violations.map(v => v.message)));

  // 2. every enabled option alone
  for (const seg of fresh.segments.filter(selectable)) {
    for (const opt of seg.options.filter(o => o.enabled)) {
      totalChecks++;
      const r = evaluate(meta, { [seg.key]: pick(seg, opt.code) });
      if (r.violations.length) fail(fam, `enabled option ${seg.key}=${opt.code} violates when selected alone`, JSON.stringify(r.violations.map(v => v.message)));
    }
  }

  // 3. pairwise parent x child
  const parentKeys = new Set();
  for (const r of meta.rules) if (r.when) for (const k of Object.keys(r.when)) parentKeys.add(k);
  for (const pKey of parentKeys) {
    const pSeg = fresh.segments.find(s => s.key === pKey);
    if (!pSeg || !selectable(pSeg)) continue;
    for (const pOpt of pSeg.options.filter(o => o.enabled)) {
      const base = { [pKey]: pick(pSeg, pOpt.code) };
      const under = evaluate(meta, base);
      totalChecks++;
      if (under.violations.length) { fail(fam, `parent ${pKey}=${pOpt.code} violates alone`, JSON.stringify(under.violations.map(v => v.message))); continue; }
      for (const seg of under.segments.filter(s => selectable(s) && s.key !== pKey)) {
        for (const opt of seg.options.filter(o => o.enabled)) {
          totalChecks++;
          const r = evaluate(meta, { ...base, [seg.key]: pick(seg, opt.code) });
          // only count violations — dropped defaults / incompleteness are fine mid-configuration
          if (r.violations.length) fail(fam, `under ${pKey}=${pOpt.code}, enabled ${seg.key}=${opt.code} violates`, JSON.stringify(r.violations.map(v => v.message)));
        }
      }
    }
  }

  // 4. full sequential configuration
  let sel = {};
  let state = evaluate(meta, sel);
  for (const seg of state.segments) {
    if (seg.selection_type === 'numeric' || seg.selection_type === 'text') {
      const sample = NUMERIC_SAMPLES[seg.key] ?? (seg.required ? '10' : '');
      if (sample !== '') sel[seg.key] = sample;
    } else {
      const cur = state.segments.find(s => s.key === seg.key);
      const enabled = cur.options.filter(o => o.enabled);
      if (!enabled.length) { if (cur.required) fail(fam, `segment ${seg.key} has no enabled options in walk`, ''); continue; }
      const choice = (cur.value && (!Array.isArray(cur.value) || cur.value.length))
        ? cur.value
        : (enabled.find(o => o.is_standard) || enabled[0]).code;
      sel[seg.key] = seg.selection_type === 'multi'
        ? (Array.isArray(choice) ? choice : [choice])
        : (Array.isArray(choice) ? choice[0] : choice);
    }
    state = evaluate(meta, sel);
  }
  totalChecks++;
  if (!state.complete) fail(fam, 'sequential walk did not complete', JSON.stringify(state.segments.filter(s => s.required && (s.value === '' || s.value == null || (Array.isArray(s.value) && !s.value.length))).map(s => s.key)));
  if (state.violations.length) fail(fam, 'sequential walk has violations', JSON.stringify(state.violations.map(v => v.message)));
  if (!state.code || state.code.includes('_')) fail(fam, 'sequential walk code has blanks', state.code);
  const pl = db.prepare("SELECT id FROM price_lists WHERE status='published' LIMIT 1").get();
  if (pl && state.complete && !state.violations.length) {
    const price = priceConfiguration(db, pl.id, fam.id, state.effective, meta.segments);
    totalChecks++;
    if (!price.poa && !(price.total > 0)) fail(fam, 'priced configuration has non-positive total', String(price.total));
  }

  // 5. no DEFAULT rule is unreachable under a FILTER rule active for the same condition
  const singleSelectDefaults = meta.rules.filter((r) => r.type === 'DEFAULT' &&
    meta.segments.find((s) => s.key === r.target)?.selection_type === 'single');
  totalChecks += singleSelectDefaults.length;
  for (const problem of findUnreachableDefaults(meta)) fail(fam, 'unreachable DEFAULT rule', problem.message);
}

console.log(`Sweep: ${families.length} families, ${totalChecks} checks, ${failures.length} failures`);
for (const f of failures) console.log('FAIL', f);
process.exit(failures.length ? 1 : 0);
