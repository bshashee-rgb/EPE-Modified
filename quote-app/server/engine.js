// Rule engine: evaluates a family's segments + rules against current selections.
// Implements dependency types D1-D7 from the requirements spec:
//  FILTER (D1/D2), DERIVE (D3), DEFAULT (D4), CONSTRAINT (D5), COMPOSE (D6), companion links (D7).

export function loadFamilyMeta(db, familyId) {
  const family = db.prepare('SELECT * FROM families WHERE id=?').get(familyId);
  if (!family) return null;
  const segments = db.prepare('SELECT * FROM segments WHERE family_id=? ORDER BY position').all(familyId);
  const optStmt = db.prepare("SELECT * FROM options WHERE segment_id=? AND status='active' ORDER BY sort, id");
  for (const s of segments) s.options = optStmt.all(s.id);
  const rules = db.prepare('SELECT * FROM rules WHERE family_id=?').all(familyId)
    .map(r => ({ id: r.id, type: r.type, note: r.note, ...JSON.parse(r.rule) }));
  const links = db.prepare('SELECT * FROM companion_links WHERE family_id=?').all(familyId)
    .map(r => ({ id: r.id, note: r.note, ...JSON.parse(r.link) }));
  family.code_template = family.code_template ? JSON.parse(family.code_template) : { separator: '-' };
  return { family, segments, rules, links };
}

// selections: { segKey: code | [codes] | number | string }
function selMatches(when, selections) {
  if (!when) return true;
  for (const [key, allowed] of Object.entries(when)) {
    const v = selections[key];
    if (v == null || v === '') return false;
    const allow = (Array.isArray(allowed) ? allowed : [allowed]).map(String); // SRV-3: normalise both sides
    const vals = Array.isArray(v) ? v : [String(v)];
    const ok = vals.some(x => allow.includes(String(x)));
    if (!ok) return false;
  }
  return true;
}

// Two-pass evaluation. Pass 1 resolves the effective configuration (user selections
// + auto-applied standard/conditional defaults). Pass 2 re-runs every rule against that
// effective configuration, so child options are filtered by DEFAULTED parents too —
// an option that conflicts with a parent's standard value is disabled from the start,
// not first rejected at add-to-quote time. userKeys tracks what the user explicitly
// chose: an invalid user choice raises a violation, an invalid auto-default is silently
// dropped (the segment simply becomes open again).
export function evaluate(meta, selections) {
  const userKeys = new Set(Object.entries(selections)
    .filter(([, v]) => v != null && v !== '' && !(Array.isArray(v) && !v.length))
    .map(([k]) => k));
  // Iterate to a fixpoint (max 4 passes): defaults are recomputed each pass for
  // non-user segments, so conditional defaults keyed on *defaulted* parents
  // (e.g. bypass standard depends on the defaulted pressure class) resolve correctly.
  const clean = (eff) => {
    const out = {};
    for (const [k, v] of Object.entries(eff)) {
      if (v != null && v !== '' && !(Array.isArray(v) && !v.length)) out[k] = v;
    }
    return out;
  };
  let sel = selections;
  let pass = null;
  const allWarnings = [];
  for (let i = 0; i < 4; i++) {
    pass = evaluateOnce(meta, sel, userKeys);
    for (const w of pass.warnings) allWarnings.push(w);
    const next = clean(pass.effective);
    if (JSON.stringify(next) === JSON.stringify(clean(typeof sel === 'object' ? sel : {}))) break;
    sel = next;
  }
  const seen = new Set();
  pass.warnings = allWarnings.filter(w => {
    const k = w.segment + '|' + w.message;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return pass;
}

function evaluateOnce(meta, selections, userKeys) {
  const { family, segments, rules } = meta;
  const result = {
    segments: [], facts: [], violations: [], warnings: [], code: null, codes: {},
    availability: 'standard', complete: true
  };

  // -- 1. FILTER rules: compute allowed option codes per segment
  const allowedBySeg = {};
  for (const seg of segments) {
    const filters = rules.filter(r => r.type === 'FILTER' && r.target === seg.key && selMatches(r.when, selections));
    if (filters.length) {
      // intersection of all applicable allow-lists
      let allow = null;
      for (const f of filters) {
        const set = new Set(f.allow.map(String));
        allow = allow === null ? set : new Set([...allow].filter(c => set.has(c)));
      }
      allowedBySeg[seg.key] = allow;
    } else {
      // if FILTER rules exist for this target but none matched (parent not yet chosen),
      // and segment declares dependsOn semantics -> allow all until parents chosen
      allowedBySeg[seg.key] = null; // null = all allowed
    }
  }

  // -- 2. DEFAULT rules: conditional defaults (most specific match last wins)
  const defaults = {};
  for (const seg of segments) {
    const std = seg.options.find(o => o.is_standard);
    if (std) defaults[seg.key] = std.code;
  }
  // Apply least-specific first so the most-specific matching DEFAULT wins deterministically
  // (SRV-2), regardless of rule-authoring/id order — mirrors the pricing tie-break.
  const defaultRules = rules.filter(r => r.type === 'DEFAULT')
    .sort((a, b) => (a.when ? Object.keys(a.when).length : 0) - (b.when ? Object.keys(b.when).length : 0));
  for (const r of defaultRules) {
    if (selMatches(r.when, selections)) defaults[r.target] = r.default;
  }

  // -- 3. Build per-segment view (enabled/disabled options, effective selection)
  const effective = {};
  for (const seg of segments) {
    const allow = allowedBySeg[seg.key];
    const opts = seg.options.map(o => ({
      code: o.code, label: o.label, is_standard: !!o.is_standard,
      on_request: !!o.on_request, poa: !!o.price_on_application,
      enabled: allow === null || allow.has(String(o.code)),
    }));
    let value = selections[seg.key];
    // Non-user segments are RE-defaulted every pass (defaults are ephemeral, never sticky):
    // a conditional default keyed on another defaulted parent must be able to win over a
    // standard applied in an earlier pass.
    if (!userKeys.has(seg.key)) {
      if (seg.selection_type === 'single') {
        const defOpt = defaults[seg.key] != null ? opts.find(o => o.code === String(defaults[seg.key])) : null;
        value = defOpt && defOpt.enabled ? defaults[seg.key] : '';
      } else if (seg.selection_type === 'multi') {
        const stdCodes = seg.options.filter(o => o.is_standard).map(o => o.code)
          .filter(c => { const o = opts.find(x => x.code === c); return o && o.enabled; });
        value = stdCodes;
      }
    } else if ((value == null || value === '' || (Array.isArray(value) && !value.length))) {
      if (seg.selection_type === 'single' && defaults[seg.key] != null) {
        const defOpt = opts.find(o => o.code === String(defaults[seg.key]));
        if (defOpt && defOpt.enabled) value = defaults[seg.key];
      }
    }
    // selection that is invalid under current parents: reset it so the configuration
    // can never sit in an invalid state. If the user had chosen it themselves,
    // surface a non-blocking warning explaining why the position reopened;
    // an auto-applied default is dropped silently.
    const userChose = userKeys.has(seg.key);
    if (seg.selection_type === 'single' && value != null && value !== '') {
      const opt = opts.find(o => o.code === String(value));
      if (opt && !opt.enabled) {
        if (userChose) {
          result.warnings.push({ segment: seg.key, message: `${seg.name}: option '${value}' is not available with the current parent selections — the position has been reset, please choose again.` });
        }
        value = '';
      }
    }
    if (seg.selection_type === 'multi' && Array.isArray(value)) {
      const invalid = value.filter((v) => { const o = opts.find(o => o.code === String(v)); return o && !o.enabled; });
      if (invalid.length) {
        if (userChose) {
          for (const v of invalid) result.warnings.push({ segment: seg.key, message: `${seg.name}: option '${v}' is not available with the current parent selections and was removed.` });
        }
        value = value.filter((v) => !invalid.includes(v));
      }
    }
    effective[seg.key] = value;
    const isEmpty = (value == null || value === '' || (Array.isArray(value) && !value.length));
    const missingRequired = seg.required && seg.selection_type !== 'text' && isEmpty;
    if (missingRequired) result.complete = false;
    result.segments.push({
      key: seg.key, name: seg.name, position: seg.position,
      selection_type: seg.selection_type, required: !!seg.required,
      numeric_unit: seg.numeric_unit, help: seg.help, in_code: !!seg.in_code,
      options: opts, value: value ?? (seg.selection_type === 'multi' ? [] : ''),
      default: defaults[seg.key] ?? null,
      missingRequired,
    });
  }

  // -- 4. DERIVE rules -> facts
  for (const r of rules.filter(r => r.type === 'DERIVE')) {
    if (selMatches(r.when, effective)) {
      for (const [label, val] of Object.entries(r.facts)) result.facts.push({ label, value: val });
    }
  }

  // -- 5. CONSTRAINT rules
  for (const r of rules.filter(r => r.type === 'CONSTRAINT')) {
    if (!selMatches(r.when, effective)) continue;
    let violated = false;
    if (r.require) {
      for (const [key, allowed] of Object.entries(r.require)) {
        const v = effective[key];
        if (v == null || v === '') continue; // incomplete, not violated yet
        const allow = (Array.isArray(allowed) ? allowed : [allowed]).map(String); // SRV-3
        const vals = Array.isArray(v) ? v.map(String) : [String(v)];
        if (!vals.some(x => allow.includes(x))) violated = true;
      }
    }
    if (r.forbid) {
      for (const [key, banned] of Object.entries(r.forbid)) {
        const v = effective[key];
        if (v == null || v === '') continue;
        const ban = (Array.isArray(banned) ? banned : [banned]).map(String); // SRV-3
        const vals = Array.isArray(v) ? v.map(String) : [String(v)];
        if (vals.some(x => ban.includes(x))) violated = true;
      }
    }
    if (r.numeric) {
      for (const [key, bounds] of Object.entries(r.numeric)) {
        const v = effective[key];
        if (v == null || v === '') continue;
        const num = parseFloat(v);
        if (isNaN(num)) { violated = true; continue; }
        let { min, max } = bounds;
        // SRV-4: bounds may be derived from another segment's numeric value.
        const fromSeg = (segKey) => { const pn = parseFloat(effective[segKey]); return isNaN(pn) ? null : pn; };
        const maxFrom = bounds.maxFromSelection || bounds.maxFrom;
        const minFrom = bounds.minFromSelection || bounds.minFrom;
        if (maxFrom) { const b = fromSeg(maxFrom); if (b != null) max = b; }
        if (minFrom) { const b = fromSeg(minFrom); if (b != null) min = b; }
        if (min != null && num < min) violated = true;
        if (max != null && num > max) violated = true;
      }
    }
    if (violated) result.violations.push({ segment: r.segment || null, message: r.message });
  }

  // -- 6. COMPOSE rules (multi-select combinations)
  for (const r of rules.filter(r => r.type === 'COMPOSE')) {
    const v = effective[r.target];
    const vals = Array.isArray(v) ? v.map(String) : (v ? [String(v)] : []);
    const segView = result.segments.find(s => s.key === r.target);
    if (r.exclusive) {
      for (const pair of r.exclusive) {
        if (pair.every(c => vals.includes(c))) {
          result.violations.push({ segment: r.target, message: `Options ${pair.join(' and ')} cannot be combined.` });
        }
      }
    }
    if (r.prerequisite) {
      for (const [code, reqs] of Object.entries(r.prerequisite)) {
        const prereqsMet = reqs.every(c => vals.includes(c));
        if (vals.includes(code) && !prereqsMet) {
          result.violations.push({ segment: r.target, message: `Option ${code} requires ${reqs.join(' + ')}.` });
        }
        // disable the option until its prerequisites are selected, so it cannot be
        // clicked into an invalid state in the first place
        if (!prereqsMet && segView) {
          const opt = segView.options.find(o => o.code === code);
          if (opt && !vals.includes(code)) opt.enabled = false;
        }
      }
    }
  }

  // -- 7. Availability flag
  for (const seg of result.segments) {
    const v = seg.value;
    const vals = Array.isArray(v) ? v : (v ? [v] : []);
    for (const val of vals) {
      const opt = seg.options.find(o => o.code === String(val));
      if (opt && opt.on_request) result.availability = 'to_confirm';
    }
  }

  // -- 8. Ordering code generation
  result.code = renderCode(family, segments, effective);
  result.effective = effective;
  return result;
}

export function renderCode(family, segments, selections) {
  const tpl = family.code_template || { separator: '-' };
  const sep = tpl.separator ?? '-';
  // tpl.joins: [['adhesive','hardware'], ...] — listed keys after the first are
  // concatenated onto the previous part with no separator (datasheet "0P", "A5.0" style)
  const joinContinuation = new Set();
  for (const group of tpl.joins || []) for (const key of group.slice(1)) joinContinuation.add(key);
  const parts = [];
  const suffixes = [];
  for (const seg of segments.filter(s => s.in_code).sort((a, b) => a.position - b.position)) {
    let v = selections[seg.key];
    if (Array.isArray(v)) v = v.join('+');
    if (v == null || v === '') v = seg.selection_type === 'single' ? '' : '';
    const prefix = seg.code_prefix || '';
    if (tpl.suffixKeys && tpl.suffixKeys.includes(seg.key)) {
      if (v !== '' && v != null) suffixes.push(prefix + v);
      continue;
    }
    if (joinContinuation.has(seg.key)) {
      const rendered = (v === '' || v === '-') ? '' : prefix + v;
      if (parts.length) parts[parts.length - 1] += rendered;
      else parts.push(rendered);
      continue;
    }
    parts.push(v === '' ? (tpl.blankAs ?? '_') : prefix + v);
  }
  let code = parts.join(sep);
  if (suffixes.length) code += ' / ' + suffixes.join(' / ');
  if (tpl.prefix) code = tpl.prefix + code;
  return code;
}

// Catalogue-authoring consistency check: a DEFAULT rule and a FILTER rule can be
// authored independently (nothing links them) and end up contradicting each other —
// the DEFAULT names a value that a FILTER active under the same `when` excludes.
// evaluateOnce() already resolves this safely at runtime (an unreachable default is
// silently dropped, the segment just stays open — see the `!userKeys.has(seg.key)`
// branch above), but that gives the catalogue author no signal that their DEFAULT
// rule is dead. This re-derives the DEFAULT's condition as a forced selection and
// asks the engine itself whether the resulting option is actually enabled.
export function findUnreachableDefaults(meta) {
  const firstOf = (v) => Array.isArray(v) ? v[0] : v;
  const problems = [];
  for (const r of meta.rules.filter((rule) => rule.type === 'DEFAULT')) {
    const seg = meta.segments.find((s) => s.key === r.target);
    if (!seg || seg.selection_type !== 'single') continue; // DEFAULT only resolves for single-select segments
    const sel = {};
    for (const [k, v] of Object.entries(r.when || {})) sel[k] = firstOf(v);
    const state = evaluate(meta, sel);
    const targetSeg = state.segments.find((s) => s.key === r.target);
    const opt = targetSeg && targetSeg.options.find((o) => o.code === String(r.default));
    if (!opt) {
      problems.push({ rule: r, message: `DEFAULT rule (id ${r.id}) sets ${r.target}='${r.default}', but no such option exists on segment '${r.target}'.` });
    } else if (!opt.enabled) {
      problems.push({ rule: r, message: `DEFAULT rule (id ${r.id}) sets ${r.target}='${r.default}' under ${JSON.stringify(r.when || {})}, but a FILTER rule active under the same condition excludes that option — this default can never apply.` });
    }
  }
  return problems;
}

// D7: resolve companion links against a completed configuration
export function resolveCompanions(meta, effective) {
  const out = [];
  for (const link of meta.links) {
    if (!selMatches(link.when, effective)) continue;
    let code = link.partNumber || null;
    if (link.codeTemplate) {
      code = link.codeTemplate.replace(/\{seg:([a-zA-Z0-9_]+)\}/g, (_, key) => {
        const v = effective[key];
        return (Array.isArray(v) ? v.join('+') : v) ?? '?';
      });
    }
    out.push({ relation: link.relation || 'accessory', label: link.label, code, targetFamilyCode: link.targetFamilyCode || null, note: link.note || null });
  }
  return out;
}

// ============ PRICING ============
// Pure core: same algorithm, rows passed in (shared by the Express and Worker servers).
export function priceRows(bases, adders, effective, segments) {
  let best = null, bestSpecificity = -1;
  for (const b of bases) {
    const match = JSON.parse(b.match || '{}');
    let ok = true;
    for (const [k, v] of Object.entries(match)) {
      if (String(effective[k]) !== String(v)) { ok = false; break; }
    }
    const spec = Object.keys(match).length;
    if (ok && spec > bestSpecificity) { best = b; bestSpecificity = spec; }
  }
  const breakdown = [];
  let poa = false;
  let total = 0;
  if (best) {
    breakdown.push({ label: 'Base price', amount: best.amount });
    total = best.amount;
  } else {
    poa = true;
    breakdown.push({ label: 'Base price', amount: null, note: 'No base price mapped — Price on Application' });
  }
  for (const seg of segments) {
    const v = effective[seg.key];
    const vals = Array.isArray(v) ? v : (v != null && v !== '' ? [v] : []);
    for (const val of vals) {
      const opt = seg.options.find(o => o.code === String(val));
      if (opt && opt.price_on_application) {
        poa = true;
        breakdown.push({ label: `${seg.name}: ${opt.label}`, amount: null, note: 'Price on Application' });
        continue;
      }
      const row = adders.find(a => a.segment_key === seg.key && a.option_code === String(val));
      if (row && row.amount !== 0) {
        const amt = row.kind === 'pct' ? Math.round((best ? best.amount : 0) * row.amount / 100) : row.amount;
        breakdown.push({ label: `${seg.name}: ${opt ? opt.label : val}`, amount: amt, kind: row.kind });
        total += amt;
      }
    }
  }
  return { poa, total: poa ? null : Math.round(total), breakdown };
}

export function priceConfiguration(db, priceListId, familyId, effective, segments) {
  const bases = db.prepare('SELECT * FROM base_prices WHERE price_list_id=? AND family_id=?').all(priceListId, familyId);
  const adders = db.prepare('SELECT * FROM option_prices WHERE price_list_id=? AND family_id=?').all(priceListId, familyId);
  return priceRows(bases, adders, effective, segments);
}

// Reverse parse an ordering code into selections (best-effort, position based)
export function parseCode(meta, codeStr) {
  const { family, segments } = meta;
  const tpl = family.code_template || { separator: '-' };
  const main = codeStr.split('/')[0].trim();
  const parts = main.split(tpl.separator ?? '-');
  const inCode = segments.filter(s => s.in_code && !(tpl.suffixKeys || []).includes(s.key))
    .sort((a, b) => a.position - b.position);
  // group segments into emission units per tpl.joins
  const joinContinuation = new Set();
  for (const group of tpl.joins || []) for (const key of group.slice(1)) joinContinuation.add(key);
  const units = [];
  for (const seg of inCode) {
    if (joinContinuation.has(seg.key) && units.length) units[units.length - 1].push(seg);
    else units.push([seg]);
  }
  const selections = {};
  const issues = [];
  const assign = (seg, raw, pos) => {
    if (seg.selection_type === 'numeric' || seg.selection_type === 'text') { selections[seg.key] = raw; return; }
    const codes = seg.selection_type === 'multi' ? raw.split('+') : [raw];
    const valid = [];
    for (const c of codes) {
      if (c === '' || (c === '-' && !seg.options.find(o => o.code === '-'))) continue;
      const opt = seg.options.find(o => o.code === c);
      if (opt) valid.push(c);
      else issues.push(`Position ${pos} (${seg.name}): unknown code '${c}'`);
    }
    selections[seg.key] = seg.selection_type === 'multi' ? valid : (valid[0] ?? '');
  };
  for (let i = 0; i < units.length && i < parts.length; i++) {
    const unit = units[i];
    const raw = parts[i];
    if (unit.length === 1) { assign(unit[0], raw, i + 1); continue; }
    // joined unit: longest-prefix match of first segment's option codes, remainder to the rest
    const [first, ...rest] = unit;
    const candidates = first.options.map(o => o.code).filter(c => raw.startsWith(c)).sort((a, b) => b.length - a.length);
    const head = candidates[0] ?? '';
    if (head) selections[first.key] = head;
    else issues.push(`Position ${i + 1} (${first.name}): could not match a code at the start of '${raw}'`);
    let remainder = raw.slice(head.length);
    for (const seg of rest) {
      if (remainder === '') { selections[seg.key] = seg.selection_type === 'multi' ? [] : '-'; continue; }
      assign(seg, remainder, i + 1);
      remainder = '';
    }
  }
  if (parts.length !== units.length) issues.push(`Code has ${parts.length} positions; ${family.name} expects ${units.length}.`);
  return { selections, issues };
}
