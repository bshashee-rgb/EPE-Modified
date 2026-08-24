// Seed DSL helpers. Options are declared as arrays:
//   [code, label]  or  [code, label, {std:true, onReq:true, poa:true}]
export function seedFamily(db, def) {
  const cat = db.prepare('SELECT id FROM categories WHERE code=?').get(def.category);
  if (!cat) throw new Error(`Unknown category ${def.category}`);
  const fam = db.prepare(`INSERT INTO families(category_id, code, name, description, datasheet_ref, kind, code_template, updated_at, sort)
     VALUES (?,?,?,?,?,?,?, datetime('now'), ?)`)
    .run(cat.id, def.code, def.name, def.description || null, def.datasheet || null,
      def.kind || 'configurable', JSON.stringify(def.template || { separator: '-' }), def.sort || 0);
  const familyId = fam.lastInsertRowid;

  const insSeg = db.prepare(`INSERT INTO segments(family_id,key,name,position,selection_type,required,in_code,code_prefix,numeric_unit,help)
     VALUES (?,?,?,?,?,?,?,?,?,?)`);
  const insOpt = db.prepare(`INSERT INTO options(segment_id,code,label,is_standard,on_request,price_on_application,sort)
     VALUES (?,?,?,?,?,?,?)`);
  let pos = 0;
  for (const seg of def.segments || []) {
    pos += 1;
    const s = insSeg.run(familyId, seg.key, seg.name, seg.position ?? pos,
      seg.type || 'single', seg.required === false ? 0 : 1, seg.inCode === false ? 0 : 1,
      seg.prefix || '', seg.unit || null, seg.help || null);
    let sort = 0;
    for (const o of seg.options || []) {
      const [code, label, flags = {}] = o;
      insOpt.run(s.lastInsertRowid, String(code), label, flags.std ? 1 : 0, flags.onReq ? 1 : 0, flags.poa ? 1 : 0, sort++);
    }
  }
  const insRule = db.prepare('INSERT INTO rules(family_id,type,rule,note) VALUES (?,?,?,?)');
  for (const r of def.rules || []) {
    const { type, note, ...rest } = r;
    insRule.run(familyId, type, JSON.stringify(rest), note || null);
  }
  const insLink = db.prepare('INSERT INTO companion_links(family_id,link,note) VALUES (?,?,?)');
  for (const l of def.links || []) {
    const { note, ...rest } = l;
    insLink.run(familyId, JSON.stringify(rest), note || null);
  }
  return familyId;
}

export function seedParts(db, familyCodeOrNull, parts) {
  const fam = familyCodeOrNull ? db.prepare('SELECT id FROM families WHERE code=?').get(familyCodeOrNull) : null;
  const ins = db.prepare('INSERT OR IGNORE INTO parts(family_id, part_number, name, description) VALUES (?,?,?,?)');
  for (const [pn, name, desc] of parts) ins.run(fam ? fam.id : null, pn, name, desc || null);
}

// std helper to mark one option standard by code within a declared list
export const opt = (code, label, flags) => [code, label, flags];
export const std = (code, label, flags = {}) => [code, label, { ...flags, std: true }];
export const onReq = (code, label, flags = {}) => [code, label, { ...flags, onReq: true }];
