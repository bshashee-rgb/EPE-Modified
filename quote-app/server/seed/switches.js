import { seedFamily } from './helpers.js';
import { SW_CONN_THREADED, SW_SEALS, SW_ELEC } from './dictionaries.js';

export function seedSwitches(db) {
  // ============ PST2 ============
  seedFamily(db, {
    category: 'SWITCHES', code: 'PST2', sort: 10,
    name: 'PST2 Pressure Switch with Cable, External Setting Knob',
    description: 'Diaphragm pressure switch, lockable external setting knob, SPDT change-over, 3-wire cable (2 m). Adjustable 0.5–12 bar; max system 40 bar. Brass body.',
    datasheet: 'EPE/PST2 Rev.0/05-2020',
    segments: [
      { key: 'series', name: 'Series', options: [['PST2', 'Pressure switch with cable — threaded, external setting knob', { std: true }]] },
      { key: 'range', name: 'Pressure range', options: [['012', '0.5–12 bar [7.25–174 psi] (standard)', { std: true }]] },
      { key: 'connection', name: 'Connection', options: [['G01M', '1/8" BSP (M) (standard)', { std: true }]] },
      { key: 'body', name: 'Body', options: [['B', 'Brass (standard)', { std: true }]] },
      { key: 'seal', name: 'Sealing', options: [['P', 'NBR / Nitrile (standard)', { std: true }]] },
      { key: 'elec', name: 'Electrical connection', options: [['COC', 'Change-over with cable (standard)', { std: true }]] },
    ],
    rules: [
      { type: 'DERIVE', when: { series: ['PST2'] }, facts: {
        'Max set pressure': '12 bar', 'Max system pressure': '40 bar [580 psi]',
        'Electrical': 'Max 3 A / 250 VAC; cable 2 m (Red COM / Black NC / Yellow NO)',
        'Reproducibility': '±1 %', 'Working temperature': '−20…+110 °C', 'Life': '5,000,000 cycles' } },
    ],
  });

  // ============ PST3 ============
  seedFamily(db, {
    category: 'SWITCHES', code: 'PST3', sort: 20,
    name: 'PST3 Pressure Switch, Threaded, Internal Setting Screw',
    description: 'Compact economical pressure switch, internal setting screw, settable in operation. Diaphragm (low ranges) or piston (high ranges). 0.2–400 bar.',
    datasheet: 'EPE/PST3 Rev.1/06-2020',
    segments: [
      { key: 'series', name: 'Series', options: [['PST3', 'Pressure switch — threaded, internal setting screw', { std: true }]] },
      { key: 'range', name: 'Pressure range', options: [
        ['002', '0.2–2 bar — diaphragm, Pmax 40 bar'], ['012', '1–12 bar — diaphragm, Pmax 40 bar'],
        ['100', '5–100 bar — piston, Pmax 600 bar', { std: true }], ['200', '20–200 bar — piston, Pmax 600 bar'],
        ['400', '50–400 bar — piston, Pmax 600 bar']] },
      { key: 'connection', name: 'Connection', options: SW_CONN_THREADED },
      { key: 'body', name: 'Body', options: [['C', 'Steel (standard)', { std: true }], ['B', 'Brass'], ['X', 'SS316L']] },
      { key: 'seal', name: 'Sealing', options: SW_SEALS },
      { key: 'elec', name: 'Electrical connection', options: SW_ELEC },
    ],
    rules: [
      { type: 'DERIVE', when: { range: ['002'] }, facts: { 'Sensing element': 'Diaphragm', 'Max system pressure': '40 bar', 'Hysteresis': '0.03–0.40 bar across 0.25–2 bar setpoints' } },
      { type: 'DERIVE', when: { range: ['012'] }, facts: { 'Sensing element': 'Diaphragm', 'Max system pressure': '40 bar', 'Hysteresis': '0.20–2.40 bar across 2–12 bar setpoints' } },
      { type: 'DERIVE', when: { range: ['100'] }, facts: { 'Sensing element': 'Piston', 'Max system pressure': '600 bar', 'Hysteresis': '1.5–25 bar across 10–100 bar setpoints' } },
      { type: 'DERIVE', when: { range: ['200'] }, facts: { 'Sensing element': 'Piston', 'Max system pressure': '600 bar', 'Hysteresis': '3.75–50 bar across 25–200 bar setpoints' } },
      { type: 'DERIVE', when: { range: ['400'] }, facts: { 'Sensing element': 'Piston', 'Max system pressure': '600 bar', 'Hysteresis': '7.5–100 bar across 50–400 bar setpoints' } },
      { type: 'DERIVE', when: { elec: ['NO', 'NC'] }, facts: { 'Terminals': 'Fast-on, 2 pieces + protective case' } },
      { type: 'DERIVE', when: { elec: ['CO'] }, facts: { 'Terminals': 'Fast-on, 3 pieces + protective case' } },
      { type: 'DERIVE', when: { elec: ['COD-A'] }, facts: { 'Terminals': 'DIN 43650 socket + M3 screw + gasket' } },
      { type: 'DERIVE', when: { series: ['PST3'] }, facts: { 'Electrical rating': '250 VAC 5 A', 'Reproducibility': '±3 %', 'Working temperature': '−40…+85 °C' } },
    ],
  });

  // ============ PSTM ============
  seedFamily(db, {
    category: 'SWITCHES', code: 'PSTM', sort: 30,
    name: 'PSTM Pressure Switch, Threaded, with Manometer',
    description: 'Diaphragm pressure switch with integrated Ø40 manometer. 0.2–12 bar over two range variants. Brass body.',
    datasheet: 'EPE/PSTM Rev.1/06-2020',
    segments: [
      { key: 'series', name: 'Series', options: [['PSTM', 'Pressure switch — threaded, with manometer', { std: true }]] },
      { key: 'range', name: 'Pressure range', options: [
        ['002', '0.2–2 bar — manometer Pmax 2.5 bar', { std: true }], ['012', '1–12 bar — manometer Pmax 16 bar']] },
      { key: 'connection', name: 'Connection', options: SW_CONN_THREADED },
      { key: 'body', name: 'Body', options: [['B', 'Brass (standard)', { std: true }], ['X', 'SS316L']] },
      { key: 'seal', name: 'Sealing', options: SW_SEALS },
      { key: 'elec', name: 'Electrical connection', options: SW_ELEC },
    ],
    rules: [
      { type: 'DERIVE', when: { range: ['002'] }, facts: { 'Max set pressure': '2 bar', 'Manometer scale / max system': '2.5 bar' } },
      { type: 'DERIVE', when: { range: ['012'] }, facts: { 'Max set pressure': '12 bar', 'Manometer scale / max system': '16 bar' } },
      { type: 'DERIVE', when: { series: ['PSTM'] }, facts: { 'Electrical rating': '250 VAC 5 A', 'Reproducibility': '±1 %', 'Manometer': 'Ø40 integrated' } },
    ],
  });

  // ============ PSTY ============
  seedFamily(db, {
    category: 'SWITCHES', code: 'PSTY', sort: 40,
    name: 'PSTY Washer Pressure Switch',
    description: 'Compact brass factory-set pressure switch for high-pressure washer duty. SPDT with 1 m cable. Max system 350 bar. IP55.',
    datasheet: 'EPE/PSTY Rev.0/05-2020',
    segments: [
      { key: 'series', name: 'Series', options: [['PSTY', 'Washer pressure switch — threaded', { std: true }]] },
      { key: 'setpressure', name: 'Set pressure', options: [
        ['015', '15 bar ±10 %', { std: true }], ['025', '25 bar ±8 %'], ['040', '40 bar ±6 %']] },
      { key: 'connection', name: 'Connection', options: [
        ['G01M', '1/8" BSP (M)', { std: true }], ['G02M', '1/4" BSP (M)'], ['G03M', '3/8" BSP (M)']] },
      { key: 'body', name: 'Body', options: [['B', 'Brass (standard)', { std: true }]] },
      { key: 'seal', name: 'Sealing', options: [['P', 'NBR / Nitrile (standard)', { std: true }]] },
      { key: 'elec', name: 'Electrical connection', options: [['SPDT', 'SPDT NO/NC with cable (standard)', { std: true }]] },
    ],
    rules: [
      { type: 'DERIVE', when: { setpressure: ['015'] }, facts: { 'Set tolerance': '±10 %' } },
      { type: 'DERIVE', when: { setpressure: ['025'] }, facts: { 'Set tolerance': '±8 %' } },
      { type: 'DERIVE', when: { setpressure: ['040'] }, facts: { 'Set tolerance': '±6 %' } },
      { type: 'DERIVE', when: { series: ['PSTY'] }, facts: { 'Max system pressure': '350 bar [5076 psi]', 'Electrical': 'Max 6 A / 250 V; cable 1 m (Red COM / Blue NC / Brown NO)', 'Protection': 'IP55' } },
    ],
  });

  // ============ PSB1/2/3 block switches ============
  const psbRanges = [
    ['070', '7–70 bar — Pmax 650 bar', { std: true }], ['160', '20–160 bar — Pmax 650 bar'],
    ['300', '20–300 bar — Pmax 650 bar'], ['400', '20–400 bar — Pmax 650 bar'], ['600', '50–600 bar — Pmax 750 bar'],
  ];
  const psbDerives = [
    { type: 'DERIVE', when: { range: ['070'] }, facts: { 'Setting range': '7–70 bar', 'Max system pressure': '650 bar' } },
    { type: 'DERIVE', when: { range: ['160'] }, facts: { 'Setting range': '20–160 bar', 'Max system pressure': '650 bar' } },
    { type: 'DERIVE', when: { range: ['300'] }, facts: { 'Setting range': '20–300 bar', 'Max system pressure': '650 bar' } },
    { type: 'DERIVE', when: { range: ['400'] }, facts: { 'Setting range': '20–400 bar', 'Max system pressure': '650 bar' } },
    { type: 'DERIVE', when: { range: ['600'] }, facts: { 'Setting range': '50–600 bar', 'Max system pressure': '750 bar' } },
  ];
  for (const [code, name, sort, connCode, connLabel, mountNote] of [
    ['PSB1', 'PSB1 Pressure Switch, Block Type, Base Mounting', 50, 'BB', 'Block type — base (bottom-flange) mounting', 'vertical stacking holes'],
    ['PSB2', 'PSB2 Pressure Switch, Block Type, Side Mounting', 60, 'BS', 'Block type — side-flange mounting', 'horizontal stacking holes'],
    ['PSB3', 'PSB3 Pressure Switch, Block Type, Threaded', 70, 'G02F', 'Threaded 1/4" BSP (F)', 'threaded process connection'],
  ]) {
    seedFamily(db, {
      category: 'SWITCHES', code, sort, name,
      description: `Aluminium block pressure switch (40 mm square), external setting knob with scale, DIN 43650 change-over, settable in operation; ${mountNote}. 7–600 bar.`,
      datasheet: `EPE/${code} Rev.0/05-2020`,
      segments: [
        { key: 'series', name: 'Series', options: [[code, name, { std: true }]] },
        { key: 'range', name: 'Pressure range', options: psbRanges },
        { key: 'connection', name: 'Connection', options: [[connCode, `${connLabel} (standard)`, { std: true }]] },
        { key: 'body', name: 'Body', options: [['A', 'Aluminium (standard)', { std: true }]] },
        { key: 'seal', name: 'Sealing', options: [['P', 'NBR / Nitrile (standard)', { std: true }]] },
        { key: 'elec', name: 'Electrical connection', options: [['COD-A', 'Change-over, DIN 43650 Form A (standard)', { std: true }]] },
      ],
      rules: [...psbDerives,
        { type: 'DERIVE', when: { series: [code] }, facts: { 'Reproducibility': '±1 %', 'Working temperature': '−20…+110 °C', 'Life': '5,000,000 cycles' } }],
    });
  }

  // ============ PSBM ============
  seedFamily(db, {
    category: 'SWITCHES', code: 'PSBM', sort: 80,
    name: 'PSBM Pressure Switch, Block Type, Threaded, with Gauge',
    description: 'Block-platform switch (as PSB3) plus integrated Ø63 glycerine-filled manometer. 7–600 bar. NOTE: datasheet file was mislabeled "PSVM".',
    datasheet: 'EPE/PSBM Rev.1/06-2020',
    segments: [
      { key: 'series', name: 'Series', options: [['PSBM', 'Block type, threaded, with gauge', { std: true }]] },
      { key: 'range', name: 'Pressure range', options: [
        ['070', '7–70 bar — manometer Pmax 100 bar', { std: true }], ['160', '20–160 bar — manometer 250 bar'],
        ['300', '20–300 bar — manometer 400 bar'], ['400', '20–400 bar — manometer 600 bar'], ['600', '50–600 bar — manometer 600 bar']] },
      { key: 'connection', name: 'Connection', options: [['G02F', 'Threaded 1/4" BSP (F) (standard)', { std: true }]] },
      { key: 'body', name: 'Body', options: [['A', 'Aluminium (standard)', { std: true }]] },
      { key: 'seal', name: 'Sealing', options: [['P', 'NBR / Nitrile (standard)', { std: true }]] },
      { key: 'elec', name: 'Electrical connection', options: [['COD-A', 'Change-over, DIN 43650 Form A (standard)', { std: true }]] },
    ],
    rules: [
      { type: 'DERIVE', when: { range: ['070'] }, facts: { 'Manometer scale / max system': '100 bar' } },
      { type: 'DERIVE', when: { range: ['160'] }, facts: { 'Manometer scale / max system': '250 bar' } },
      { type: 'DERIVE', when: { range: ['300'] }, facts: { 'Manometer scale / max system': '400 bar' } },
      { type: 'DERIVE', when: { range: ['400'] }, facts: { 'Manometer scale / max system': '600 bar' } },
      { type: 'DERIVE', when: { range: ['600'] }, facts: { 'Manometer scale / max system': '600 bar' } },
      { type: 'DERIVE', when: { series: ['PSBM'] }, facts: { 'Manometer': 'Ø63 glycerine-filled, integrated', 'Note': 'Max system pressure follows the manometer limit (lower than PSB1–3 body limits)' } },
    ],
  });

  // ============ TST1 / TST2 ============
  const tstTemps = [
    ['035', '35 °C [95 °F]'], ['040', '40 °C [104 °F]', { std: true }], ['050', '50 °C [122 °F]'],
    ['060', '60 °C [140 °F]'], ['070', '70 °C [158 °F]'], ['080', '80 °C [176 °F]'], ['090', '90 °C [194 °F]'],
    ['100', '100 °C [212 °F]'], ['110', '110 °C [230 °F]'], ['120', '120 °C [248 °F]'],
  ];
  const tstDerives = tstTemps.map(([code]) => {
    const t = parseInt(code, 10);
    return { type: 'DERIVE', when: { settemp: [code] }, facts: { 'High contact value': `${t}±3 °C`, 'Low contact value': `${t - 15}±5 °C` } };
  });
  for (const [code, name, sort, conns, elecs] of [
    ['TST1', 'TST1 Temperature Switch, Threaded, Bimetal (DIN socket)', 90,
      [['G04M', '1/2" BSP (M)', { std: true }], ['M34M', 'M22x1.5 (M)']],
      [['NOD-A', 'Normally Open, DIN 43650 Form A (standard)', { std: true }], ['NCD-A', 'Normally Closed, DIN socket']]],
    ['TST2', 'TST2 Temperature Switch, Threaded, Bimetal (fast-on terminals)', 100,
      [['G02M', '1/4" BSP (M)'], ['G04M', '1/2" BSP (M)', { std: true }], ['M34M', 'M22x1.5 (M)']],
      [['NO', 'Normally Open, fast-on (standard)', { std: true }], ['NC', 'Normally Closed, fast-on']]],
  ]) {
    seedFamily(db, {
      category: 'SWITCHES', code, sort, name,
      description: 'Bimetallic thermostat, brass body, fixed factory-set switching temperature 35–120 °C. 250 VAC 10 A, IP55, max media +205 °C.',
      datasheet: `EPE/${code} Rev.1/06-2020`,
      segments: [
        { key: 'series', name: 'Series', options: [[code, name, { std: true }]] },
        { key: 'settemp', name: 'Set temperature', options: tstTemps },
        { key: 'connection', name: 'Connection', options: conns },
        { key: 'body', name: 'Body', options: [['B', 'Brass (standard)', { std: true }]] },
        { key: 'seal', name: 'Sealing', options: [['T', 'Teflon', { std: true }], ['C', 'Copper']] },
        { key: 'elec', name: 'Electrical connection', options: elecs },
      ],
      rules: [...tstDerives,
        { type: 'DERIVE', when: { series: [code] }, facts: { 'Electrical rating': '250 VAC 50/60 Hz, 10 A', 'Protection': 'IP55', 'Max media temperature': '+205 °C', 'Life': '100,000 cycles' } }],
    });
  }

  // ============ PRV relief valve ============
  seedFamily(db, {
    category: 'VALVES', code: 'PRV', sort: 10,
    name: 'PRVS / PRVK Pressure Relief Valve (direct acting)',
    description: 'Direct-acting screw-in cartridge relief valve, NG10, cavity M35x1.5. Poppet design ≤400 bar; ball design 630 bar. ISO 4126-1. NOTE: datasheet file was mislabeled "PST1Rev".',
    datasheet: 'EPE/PRV Rev.0/10-2024',
    template: { separator: '-', suffixKeys: ['setpressure'] },
    segments: [
      { key: 'series', name: 'Series', options: [
        ['PRVS', 'Relief valve with set screw', { std: true }], ['PRVK', 'Relief valve with knob']] },
      { key: 'size', name: 'Size', options: [['10', 'NG10 (standard)', { std: true }]] },
      { key: 'rating', name: 'Pressure rating', options: [
        ['025', 'Up to 25 bar — poppet seat'], ['050', 'Up to 50 bar — poppet seat'], ['100', 'Up to 100 bar — poppet seat'],
        ['200', 'Up to 200 bar — poppet seat'], ['315', 'Up to 315 bar — poppet seat', { std: true }],
        ['400', 'Up to 400 bar — poppet seat'], ['630', 'Up to 630 bar — ball design']] },
      { key: 'setpressure', name: 'Set pressure (bar)', type: 'numeric', required: false, unit: 'bar', help: 'Leave empty for "not set" (standard)' },
      { key: 'bodymat', name: 'Body', options: [['-', 'Carbon steel (standard)', { std: true }], ['X', 'SS316L']] },
      { key: 'seal', name: 'Sealing', options: [['-', 'NBR / Nitrile (standard)', { std: true }], ['V', 'Viton']] },
      { key: 'cert', name: 'Certification', options: [
        ['-', 'Factory certified (standard)', { std: true }], ['8', 'CE/PED certified'], ['1', 'EAC certified']] },
      { key: 'adjustment', name: 'Pressure adjustment', options: [
        ['-', 'Adjustable (standard)', { std: true }], ['S', 'Factory preset & sealed (PRVS only)']] },
    ],
    rules: [
      { type: 'CONSTRAINT', when: { adjustment: ['S'] }, require: { series: ['PRVS'] }, message: 'Factory preset & sealed (S) is only available with series PRVS (set-screw type).' },
      { type: 'CONSTRAINT', when: { rating: ['025'] }, numeric: { setpressure: { min: 1, max: 25 } }, message: 'Set pressure must lie within the 25 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['050'] }, numeric: { setpressure: { min: 1, max: 50 } }, message: 'Set pressure must lie within the 50 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['100'] }, numeric: { setpressure: { min: 1, max: 100 } }, message: 'Set pressure must lie within the 100 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['200'] }, numeric: { setpressure: { min: 1, max: 200 } }, message: 'Set pressure must lie within the 200 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['315'] }, numeric: { setpressure: { min: 1, max: 315 } }, message: 'Set pressure must lie within the 315 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['400'] }, numeric: { setpressure: { min: 1, max: 400 } }, message: 'Set pressure must lie within the 400 bar rating.' },
      { type: 'CONSTRAINT', when: { rating: ['630'] }, numeric: { setpressure: { min: 1, max: 630 } }, message: 'Set pressure must lie within the 630 bar rating.' },
      { type: 'DERIVE', when: { rating: ['025', '050', '100', '200', '315', '400'] }, facts: { 'Internal design': 'Poppet seat with damping piston' } },
      { type: 'DERIVE', when: { rating: ['630'] }, facts: { 'Internal design': 'Ball type' } },
      { type: 'DERIVE', when: { series: ['PRVS', 'PRVK'] }, facts: {
        'Cavity': 'M35x1.5 (NG10)', 'Max inlet / outlet': '630 / 315 bar',
        'Standards': 'ISO 4126-1; ISO 12516-2; PT = 1.43 × PS', 'Temperature': '−20…+80 °C' } },
    ],
  });
}
