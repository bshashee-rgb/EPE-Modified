// Rule corrections applied on top of the base seed. Single source of truth for both
// fresh seeds (seed/run.js) and live-DB migration (migrate.js) so existing quotes survive.
//
// Principle (customer feedback): a combination that would be rejected must be DISABLED
// in the configurator, not error at add-to-quote time. So every cross-segment
// restriction that only existed as a CONSTRAINT also gets FILTER rules, and
// conditional defaults must not fire for segments whose parent feature is absent.

const CRACK_VALUES = ['0.8', '1.5', '2.5', '4.2', '5.0', '6.0', '7.0'];
const DP_INDS = ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD'];

export function rulePatches() {
  return [
    // ---- cracking pressure is a child of the indicator: no indicator -> only '-';
    // ---- indicator chosen -> '-' disabled (and pressure-class default applies)
    ...['LD', 'LELM'].flatMap((fam) => [
      { family: fam, remove: { type: 'DEFAULT', target: 'cracking' } },
      { family: fam, add: { type: 'DEFAULT', rule: { when: { pressure: ['40'], indicator: DP_INDS }, target: 'cracking', default: '2.5' }, note: '2.5 bar std for 40 bar class (with indicator)' } },
      { family: fam, add: { type: 'DEFAULT', rule: { when: { pressure: ['160'], indicator: DP_INDS }, target: 'cracking', default: '5.0' }, note: '5.0 bar std for 160 bar class (with indicator)' } },
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: ['0'] }, target: 'cracking', allow: ['-'] }, note: 'no indicator -> no cracking pressure' } },
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: DP_INDS }, target: 'cracking', allow: CRACK_VALUES }, note: 'indicator chosen -> cracking required' } },
    ]),
    ...['FE', 'LEHP'].flatMap((fam) => [
      { family: fam, remove: { type: 'DEFAULT', target: 'cracking' } },
      { family: fam, add: { type: 'DEFAULT', rule: { when: { indicator: DP_INDS }, target: 'cracking', default: '5.0' }, note: '5.0 bar std (with indicator)' } },
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: ['0'] }, target: 'cracking', allow: ['-'] } } },
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: DP_INDS }, target: 'cracking', allow: CRACK_VALUES } } },
    ]),
    { family: 'OFM20X', add: { type: 'FILTER', rule: { when: { indicator: ['0'] }, target: 'cracking', allow: ['-'] } } },
    { family: 'OFM20X', add: { type: 'FILTER', rule: { when: { indicator: ['A', 'B', 'D', 'T', 'PSD', 'PSF', 'PSG', 'PSK'] }, target: 'cracking', allow: CRACK_VALUES } } },
    // DK: cracking default keyed on bypass AND an actual indicator being chosen
    { family: 'DK', remove: { type: 'DEFAULT', target: 'cracking' } },
    { family: 'DK', add: { type: 'DEFAULT', rule: { when: { bypass: ['7'], indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD', 'G', 'S', 'X'] }, target: 'cracking', default: '2.5' }, note: '2.5 bar for 3.5 bar bypass (with indicator)' } },
    { family: 'DK', add: { type: 'DEFAULT', rule: { when: { bypass: ['9'], indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD', 'G', 'S', 'X'] }, target: 'cracking', default: '5.0' }, note: '5.0 bar for 7.0 bar bypass (with indicator)' } },
    { family: 'DK', add: { type: 'FILTER', rule: { when: { indicator: ['0'] }, target: 'cracking', allow: ['-'] } } },
    { family: 'DK', add: { type: 'FILTER', rule: { when: { indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD', 'G', 'S', 'X'] }, target: 'cracking', allow: ['1.5', '2.5', '4.2', '5.0'] } } },
    // Return-line families: A/B manometers & no-indicator have no cracking; C/D/F/G/K need one
    { family: 'FRL', add: { type: 'FILTER', rule: { when: { indicator: ['0', 'A', 'B'] }, target: 'cracking', allow: ['-'] } } },
    { family: 'FRL', add: { type: 'FILTER', rule: { when: { indicator: ['C', 'D', 'F', 'G', 'K'] }, target: 'cracking', allow: ['0.8', '1.5', '2.5', '5.0'] } } },
    ...['FRE', 'FRD'].flatMap((fam) => [
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: ['0', 'A', 'B'] }, target: 'cracking', allow: ['-'] } } },
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: ['C', 'D', 'F', 'G', 'K'] }, target: 'cracking', allow: ['0.8', '1.5', '2.5'] } } },
      // air-vent options EP/E are only for versions without indicator — disable, not just validate
      { family: fam, add: { type: 'FILTER', rule: { when: { indicator: ['A', 'B', 'C', 'D', 'F', 'G', 'K'] }, target: 'other', allow: ['0', 'F'] }, note: 'EP/E only for versions without indicator' } },
      // bypass position must match the N/B size suffix — disable, not just validate
      { family: fam, add: { type: 'FILTER', rule: { when: { size: ['0005N', '0008N', '0013N', '0015N', '0018N'] }, target: 'bypass', allow: ['0'] }, note: 'N sizes are without bypass' } },
      { family: fam, add: { type: 'FILTER', rule: { when: { size: ['0005B', '0008B', '0013B', '0015B', '0018B'] }, target: 'bypass', allow: ['7', 'Bx'] }, note: 'B sizes carry the bypass in the element' } },
    ]),
    // PRV: factory preset & sealed only with set-screw series
    { family: 'PRV', add: { type: 'FILTER', rule: { when: { series: ['PRVK'] }, target: 'adjustment', allow: ['-'] }, note: 'S (preset & sealed) is PRVS-only' } },
    // Safety block: solenoid supply variants need discharge type E
    { family: 'SBB', add: { type: 'FILTER', rule: { when: { discharge: ['M'] }, target: 'variants', allow: ['0', 'X', 'G', 'GG', 'MC', 'MCX'] }, note: 'solenoid variants need discharge E' } },
    // AMW: sealed gas side (P) only <=1.4 L and <=250 bar
    { family: 'AMW', add: { type: 'FILTER', rule: { when: { capacity: ['2', '2.8', '3.5', '5'] }, target: 'gasside', allow: ['M', 'VV', 'VX', 'V1', 'VM', 'V2', 'V4', 'V5', 'V6', 'V0'] }, note: 'sealed P not available above 1.4 L' } },
    { family: 'AMW', add: { type: 'FILTER', rule: { when: { mwp: ['300', '350'] }, target: 'gasside', allow: ['M', 'VV', 'VX', 'V1', 'VM', 'V2', 'V4', 'V5', 'V6', 'V0'] }, note: 'sealed P not available above 250 bar' } },
    // ES: NO+NC needs two switches
    { family: 'ES', add: { type: 'FILTER', rule: { when: { switches: ['1'] }, target: 'switchtype', allow: ['NO', 'NC', 'BS'] }, note: 'NO+NC needs two switches' } },
    // AP: position monitoring and recovery valve are mutually exclusive
    { family: 'AP', add: { type: 'FILTER', rule: { when: { pistondesign: ['V'] }, target: 'monitoring', allow: ['-'] } } },
    { family: 'AP', add: { type: 'FILTER', rule: { when: { monitoring: ['ES', 'EF', 'WS', 'WP', 'XG', 'XL', 'UE', 'LS'] }, target: 'pistondesign', allow: ['0', 'S'] } } },
  ];
}

// Template fixes: numeric positions that are "0 = without" on the datasheet must render
// '0' when empty, not a blank placeholder (BC set pressure, SBB relief pressure).
const TEMPLATE_PATCHES = {
  BC: { separator: '-', blankAs: '0' },
  SBB: { separator: '-', blankAs: '0' },
};

export function applyRulePatches(db) {
  const famId = (code) => db.prepare('SELECT id FROM families WHERE code=?').get(code)?.id;
  for (const [code, tpl] of Object.entries(TEMPLATE_PATCHES)) {
    const fid = famId(code);
    if (fid) db.prepare('UPDATE families SET code_template=? WHERE id=?').run(JSON.stringify(tpl), fid);
  }
  const patches = rulePatches();
  let removed = 0, added = 0;
  const insert = db.prepare('INSERT INTO rules(family_id, type, rule, note) VALUES (?,?,?,?)');
  for (const p of patches) {
    const fid = famId(p.family);
    if (!fid) continue;
    if (p.remove) {
      const rows = db.prepare('SELECT id, rule FROM rules WHERE family_id=? AND type=?').all(fid, p.remove.type);
      for (const row of rows) {
        const parsed = JSON.parse(row.rule);
        if (parsed.target === p.remove.target) { db.prepare('DELETE FROM rules WHERE id=?').run(row.id); removed++; }
      }
    }
    if (p.add) {
      const json = JSON.stringify(p.add.rule);
      const exists = db.prepare('SELECT 1 FROM rules WHERE family_id=? AND type=? AND rule=?').get(fid, p.add.type, json);
      if (!exists) { insert.run(fid, p.add.type, json, p.add.note || null); added++; }
    }
  }
  return { removed, added };
}
