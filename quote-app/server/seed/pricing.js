// Placeholder DEMO pricing (INR). Deterministic heuristic amounts so the pricing engine
// (base + adders + PoA) is demonstrable end-to-end. EPE replaces these via admin/import.

const BASE_BY_FAMILY = {
  LD: 48000, FE: 38000, LEHP: 32000, LELM: 21000, OFM20X: 26000,
  FRL: 18000, FRE: 9500, FRD: 21500, FLE: 34000, DK: 165000, TLF: 4200,
  ELEMENTS: 3800, FLD25: 240000, NFF2: 285000,
  AS: 52000, AMW: 8500, AP: 145000, APC: 28500, ES: 18500, SBB: 24500,
  BC: 32000, PC: 16500, PCHP: 24500, PCM: 17500, CB2: 2400,
  PST2: 2900, PST3: 2400, PSTM: 3600, PSTY: 2100,
  PSB1: 6800, PSB2: 6800, PSB3: 6400, PSBM: 9200,
  TST1: 1900, TST2: 1700, PRV: 8800,
};

// size/capacity multipliers keyed by segment key; base row per size value
const SIZE_STEPS = {
  size: { '0003': 0.6, '0005': 0.7, '0008': 0.8, '0013': 1.0, '0015': 1.15, '0018': 1.25, '0020': 1.4, '0030': 1.7, '0045': 2.1, '0060': 2.5, '0095': 3.2, '0120': 3.8, '0145': 4.5, '0200': 5.5, '0270': 6.8, '0297': 7.2, '0040': 0.7, '0063': 0.8, '0100': 1.0, '0160': 1.4, '0250': 1.7, '0400': 2.1, '0630': 3.2, '1000': 4.5 },
  capacity: { '0.07': 0.5, '0.1': 0.5, '0.16': 0.55, '0.2': 0.6, '0.25': 0.6, '0.3': 0.62, '0.32': 0.62, '0.5': 0.65, '0.50': 0.65, '0.7': 0.7, '0.75': 0.72, '1': 0.8, '1.4': 0.85, '1.5': 0.85, '2': 0.9, '2.8': 0.95, '3': 1.0, '3.5': 1.05, '4': 1.1, '5': 1.15, '6': 1.2, '8': 1.3, '10': 1.4, '12': 1.5, '15': 1.6, '20': 1.8, '25': 1.9, '30': 2.0, '35': 2.1, '50': 2.6, '54': 2.7, '55': 2.7, '57': 2.8, '60': 3.0, '75': 3.4, '100': 3.8, '130': 4.4, '150': 5.0, '200': 5.8, '250': 6.6, '300': 7.4, '350': 8.0, '400': 8.8, '450': 9.4, '575': 11.0, '600': 11.5, '1000': 16.0 },
};

// option adders: [segmentKey, optionCode, kind, amount]
const COMMON_ADDERS = [
  ['seal', 'V', 'abs', 1200], ['seal', 'E', 'abs', 900], ['seal', 'N', 'abs', 700],
  ['seal', 'B', 'abs', 900], ['seal', 'K', 'abs', 1500], ['seal', 'F', 'abs', 800],
  ['hardware', 'X', 'abs', 2500], ['hardware', 'D', 'abs', 1400], ['hardware', 'M', 'abs', 900],
  ['magnet', 'X', 'abs', 850], ['magnet', '2', 'abs', 850],
  ['bypass', '1', 'abs', 1100], ['bypass', '2', 'abs', 1100], ['bypass', '3', 'abs', 1100],
  ['bypass', '4', 'abs', 1100], ['bypass', '5', 'abs', 1100], ['bypass', '6', 'abs', 1100],
  ['bypass', '7', 'abs', 1100], ['bypass', '8', 'abs', 1100], ['bypass', '9', 'abs', 1100],
  ['indicator', 'A', 'abs', 1800], ['indicator', 'B', 'abs', 3200], ['indicator', 'D', 'abs', 3600],
  ['indicator', 'T', 'abs', 5200], ['indicator', 'AD', 'abs', 2600], ['indicator', 'BD', 'abs', 4200],
  ['indicator', 'DD', 'abs', 4600], ['indicator', 'C', 'abs', 1900], ['indicator', 'F', 'abs', 2400],
  ['indicator', 'G', 'abs', 2800], ['indicator', 'K', 'abs', 3400],
  ['indicator', 'PSD', 'abs', 2400], ['indicator', 'PSF', 'abs', 2400], ['indicator', 'PSG', 'abs', 2800], ['indicator', 'PSK', 'abs', 3400],
  ['other', 'E', 'abs', 450], ['other', 'DV', 'abs', 650], ['other', 'DVX', 'abs', 1400],
  ['other', 'H', 'abs', 350], ['other', 'F', 'abs', 1600], ['other', 'MF', 'abs', 8500], ['other', 'FB', 'abs', 2400],
  ['housing', 'N', 'pct', 25], ['housing', 'X', 'pct', 60],
  // accumulators
  ['shell', 'N', 'pct', 20], ['shell', 'X', 'pct', 80], ['shell', 'V', 'pct', 15],
  ['bladder', 'V', 'abs', 6500], ['bladder', 'B', 'abs', 4200], ['bladder', 'E', 'abs', 3800],
  ['bladder', 'K', 'abs', 7800], ['bladder', 'N', 'abs', 3600], ['bladder', 'Y', 'abs', 4400],
  ['bladder', 'H', 'abs', 2400], ['bladder', 'F', 'abs', 2200],
  ['diaphragm', 'V', 'abs', 2400], ['diaphragm', 'Y', 'abs', 1400],
  ['body', 'L', 'pct', 12], ['body', 'X', 'pct', 70],
  ['tube', 'N', 'pct', 18], ['tube', 'X', 'pct', 85],
  ['cert', '8', 'abs', 6500], ['cert', '30', 'abs', 14000], ['cert', '7W', 'abs', 12000],
  ['cert', '7U', 'abs', 26000], ['cert', '1', 'abs', 9000], ['cert', 'NB', 'abs', 8000], ['cert', 'CRN', 'abs', 12000],
  ['gasfill', 'X', 'abs', 1800], ['gasfill', '8', 'abs', 3400], ['gasfill', 'M', 'abs', 600],
  ['discharge', 'E', 'abs', 8500],
  ['safetyvalve', 'P', 'abs', 3200], ['safetyvalve', '1', 'abs', 3600], ['safetyvalve', 'G', 'abs', 5200],
  ['block', 'X', 'pct', 75], ['block', 'N', 'pct', 22], ['block', 'L', 'pct', 10],
  // switches
  ['bodymat', 'X', 'pct', 60], ['body', 'B', 'abs', 300],
  ['elec', 'COD-A', 'abs', 250], ['elec', 'NCD-A', 'abs', 150], ['elec', 'NC', 'abs', 80],
  ['adjustment', 'S', 'abs', 450],
  ['monitoring', 'ES', 'abs', 18500], ['monitoring', 'EF', 'abs', 22000], ['monitoring', 'WS', 'abs', 26000],
  ['monitoring', 'UE', 'abs', 15000], ['monitoring', 'LS', 'abs', 21000], ['monitoring', 'WP', 'abs', 32000],
  ['counter', 'PC', 'abs', 185000],
  ['pistonmat', 'X', 'pct', 30], ['pistonmat', '1', 'abs', 2500],
  ['sealspeed', 'PTV', 'abs', 4500], ['sealspeed', 'PVV', 'abs', 5200], ['sealspeed', 'PTE', 'abs', 4200],
  ['endseal', 'V', 'abs', 1100], ['endseal', 'E', 'abs', 900],
  ['media', 'H1XL', 'abs', 1400], ['media', 'H3XL', 'abs', 900], ['media', 'M5', 'abs', 3200],
  ['media', 'M10', 'abs', 3000], ['media', 'M15', 'abs', 2800], ['media', 'AS1', 'abs', 2100],
  ['media', 'AS3', 'abs', 1900], ['media', 'AS6', 'abs', 1700], ['media', 'AS10', 'abs', 1600], ['media', 'AS20', 'abs', 1500],
];

const PART_PRICE_DEFAULT = 1500;

export function seedPricing(db) {
  const pl = db.prepare("INSERT INTO price_lists(code, name, currency, status) VALUES ('DEMO-INR', 'Demo Price List (placeholder)', 'INR', 'published')").run();
  const plId = pl.lastInsertRowid;

  const families = db.prepare('SELECT * FROM families').all();
  const insBase = db.prepare('INSERT INTO base_prices(price_list_id, family_id, match, amount) VALUES (?,?,?,?)');
  const insOpt = db.prepare('INSERT INTO option_prices(price_list_id, family_id, segment_key, option_code, kind, amount) VALUES (?,?,?,?,?,?)');

  for (const fam of families) {
    const base = BASE_BY_FAMILY[fam.code];
    if (!base) continue;
    // generic fallback base row
    insBase.run(plId, fam.id, '{}', base);
    // size/capacity-specific base rows
    const segs = db.prepare('SELECT * FROM segments WHERE family_id=?').all(fam.id);
    for (const stepKey of Object.keys(SIZE_STEPS)) {
      const seg = segs.find(s => s.key === stepKey);
      if (!seg) continue;
      const opts = db.prepare('SELECT code FROM options WHERE segment_id=?').all(seg.id);
      for (const { code } of opts) {
        const mult = SIZE_STEPS[stepKey][code] ?? SIZE_STEPS[stepKey][code.replace(/[A-Z]$/, '')];
        if (mult) insBase.run(plId, fam.id, JSON.stringify({ [stepKey]: code }), Math.round(base * mult));
      }
    }
    // option adders where segment+option exists in this family
    for (const [segKey, optCode, kind, amount] of COMMON_ADDERS) {
      const seg = segs.find(s => s.key === segKey);
      if (!seg) continue;
      const exists = db.prepare('SELECT 1 FROM options WHERE segment_id=? AND code=?').get(seg.id, optCode);
      if (exists) insOpt.run(plId, fam.id, segKey, optCode, kind, amount);
    }
  }

  // part prices
  const parts = db.prepare('SELECT id, part_number FROM parts').all();
  const insPart = db.prepare('INSERT INTO part_prices(price_list_id, part_id, amount) VALUES (?,?,?)');
  for (const p of parts) {
    let amount = PART_PRICE_DEFAULT;
    if (/^CL|^CT|^BA|^BC0|^115/.test(p.part_number)) amount = 2800;
    if (/^BYP/.test(p.part_number)) amount = 1900;
    if (/^I40/.test(p.part_number)) amount = 950;
    if (/^7\./.test(p.part_number)) amount = 1200;
    if (/^PRP/.test(p.part_number)) amount = 3400;
    insPart.run(plId, p.id, amount);
  }
}
