import { seedFamily, seedParts } from './helpers.js';
import { BLADDER_MATERIALS, CERTS_AS } from './dictionaries.js';

const AS_CAPS = {
  AS: ['0.2', '0.7', '1', '1.5', '3', '4', '5', '6', '10', '20', '25', '35', '54', '57', '60', '100', '130'],
  ASHF: ['10', '20', '25', '35', '54', '55'],
  ASWP: ['3', '4', '5', '6', '10', '20', '25', '35', '54', '57'],
  ASWD: ['1.5', '3', '4', '5', '6', '10', '20', '25', '35', '54', '57'],
  ASLV: ['150', '250', '350', '450', '575'],
  ASLVHF: ['150', '250', '350', '450', '575'],
  ASL: ['0.2', '0.7', '1', '3', '5', '10', '20', '35', '54', '57'],
  AST: ['0.7', '1', '3', '5', '10', '20', '35', '54', '57'],
};

export function seedAccumulators(db) {
  // ============ 1. AS Bladder Accumulator ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'AS', sort: 10,
    name: 'AS Bladder Accumulator (AS/ASHF/ASWP/ASWD/ASLV/ASLVHF/ASL/AST)',
    description: 'Hydro-pneumatic bladder accumulator per EN-14359/ASME. 0.2–575 L, PS 16–360 bar, PT = 1.43×PS, pressure ratio 4:1. Bladders/seals replaceable (poppet designs).',
    datasheet: 'EPE/11.001/AS Rev.10/20-2024',
    template: { separator: ' ', suffixKeys: ['precharge', 'variants'] },
    segments: [
      { key: 'series', name: 'Series', options: [
        ['AS', 'Standard accumulator — seamless shell', { std: true }],
        ['ASHF', 'High-flow accumulator — seamless shell'],
        ['ASWP', 'Welded accumulator — poppet design'],
        ['ASWD', 'Welded accumulator — disc design (precharge ≤ 15 bar)'],
        ['ASLV', 'Large volume accumulator'],
        ['ASLVHF', 'High-flow large volume accumulator'],
        ['ASL', 'Liquid separator accumulator', { onReq: true }],
        ['AST', 'Transfert accumulator', { onReq: true }]] },
      { key: 'capacity', name: 'Nominal capacity (L)', options: [
        ['0.2', '0.2 L'], ['0.7', '0.7 L'], ['1', '1 L'], ['1.5', '1.5 L'], ['3', '3 L'], ['4', '4 L'], ['5', '5 L'],
        ['6', '6 L'], ['10', '10 L'], ['20', '20 L'], ['25', '25 L'], ['35', '35 L', { std: true }], ['54', '54 L'],
        ['55', '55 L'], ['57', '57 L'], ['60', '60 L'], ['100', '100 L'], ['130', '130 L'],
        ['150', '150 L'], ['250', '250 L'], ['350', '350 L'], ['450', '450 L'], ['575', '575 L']] },
      { key: 'bladder', name: 'Bladder & seal material', options: BLADDER_MATERIALS },
      { key: 'mwp', name: 'Max working pressure (bar)', options: [
        ['16', '16 bar (ASLV/ASLVHF)'], ['30', '30 bar'], ['35', '35 bar (ASLV/ASLVHF)'], ['50', '50 bar'],
        ['70', '70 bar'], ['120', '120 bar'], ['165', '165 bar'], ['330', '330 bar'], ['350', '350 bar'], ['360', '360 bar', { std: true }]] },
      { key: 'shell', name: 'Shell material', options: [
        ['C', 'Carbon steel (RAL-5010)', { std: true }], ['N', 'Nickel-coated carbon steel'],
        ['X', 'Stainless steel'], ['V', 'Rilsan-coated carbon steel']] },
      { key: 'porttype', name: 'Fluid port connection type', options: [
        ['G', 'BSPP thread', { std: true }], ['T', 'BSPT thread'], ['N', 'NPT thread'],
        ['3', 'SAE 3000 psi flange'], ['6', 'SAE 6000 psi flange'], ['Q', 'Square flange'],
        ['S', 'SAE internal thread'], ['M', 'Metric thread'], ['D', 'UNI-DIN flange'], ['A', 'ANSI flange'],
        ['RG', 'Adaptor to BSPP'], ['RT', 'Adaptor to BSPT'], ['RN', 'Adaptor to NPT'], ['RS', 'Adaptor to SAE'], ['RM', 'Adaptor to metric']] },
      { key: 'portsize', name: 'Fluid port connection size', options: [
        ['01', '1/8"'], ['02', '1/4"'], ['03', '3/8"'], ['04', '1/2"'], ['05', '3/4"'], ['06', '1"'],
        ['07', '1-1/4"'], ['08', '1-1/2"'], ['09', '2"', { std: true }], ['10', '2-1/2"'], ['11', '3"'], ['12', '3-1/2"'], ['13', '4"'],
        ['21', 'SAE 1-1/16"-12'], ['22', 'SAE 1-5/8"-12'], ['23', 'SAE 1-7/8"-12'],
        ['31', 'M14x1.5'], ['32', 'M16x1.5'], ['33', 'M18x1.5'], ['34', 'M22x1.5'], ['35', 'M27x2.0'], ['36', 'M32x1.5'],
        ['37', 'M33x1.5'], ['38', 'M40x1.5'], ['39', 'M42x1.5'], ['40', 'M45x1.5'], ['41', 'M50x1.5'],
        ['51', 'DN20/PN40'], ['54', 'DN25/PN40'], ['58', 'DN40/PN40'], ['61', 'DN50/PN40'], ['67', 'DN100/PN16'],
        ['GB', 'ANSI 1/2" class 300'], ['IB', 'ANSI 3" class 300'], ['GA', 'ANSI 2" class 150']] },
      { key: 'portdesign', name: 'Fluid port connection design', options: [
        ['F', 'Female thread', { std: true }], ['M', 'Male thread'], ['S', 'For SAE flange'], ['L', 'Flange'],
        ['SW', 'Socket weld nipple'], ['WN', 'ANSI WN-RF'], ['WJ', 'ANSI WN-RTJ'], ['SO', 'ANSI SO-RF'], ['SJ', 'ANSI SW-RTJ']] },
      { key: 'cert', name: 'Test certification', type: 'multi', options: CERTS_AS },
      { key: 'fluidvalvemat', name: 'Fluid valve material', options: [
        ['C', 'Carbon steel', { std: true }], ['N', 'Nickel-coated CS'], ['X', 'Stainless steel'], ['Z', 'Zn-Ni coated CS']] },
      { key: 'gasvalvemat', name: 'Gas valve material', options: [
        ['C', 'Carbon steel', { std: true }], ['N', 'Nickel-coated CS'], ['X', 'Stainless steel'], ['Z', 'Zn-Ni coated CS']] },
      { key: 'gasfill', name: 'Gas fill valve connection', options: [
        ['V', '5/8" UNF (standard)', { std: true }], ['X', '5/8" UNF in SS'], ['0', 'Without gas fill valve'],
        ['1', '5/16" UNEF / Vg8'], ['2', '1/4" BSP'], ['3', 'M16x2.0'], ['4', '5/16" UNEF (7/8" UNF body)'],
        ['8', 'Double-lock military valve'], ['9', '7/8" UNF integral'], ['M', 'M28x1.5']] },
      { key: 'precharge', name: 'Precharge pressure (bar @20 °C)', type: 'numeric', required: false, prefix: 'PO:', unit: 'bar', help: 'Leave empty for uncharged supply' },
      { key: 'variants', name: 'Other variants', type: 'multi', required: false, options: [
        ['L01', 'Liquid adapter in SS'], ['L02', 'Poppet & spring in SS'], ['L03', 'Fluid port without bleed port'],
        ['G01', 'SS protection cap'], ['G03', 'Brass name plate'], ['G04', 'SS name plate'], ['G07', 'Lifting hook'],
        ['G11', '1/4" gauge adapter (no gauge)'], ['G12', 'Gauge adapter + 63 mm gauge'], ['G13', 'Rupture disc'],
        ['G19', 'VS214 gas safety valve'], ['G21', '1/4" BSP needle valve'], ['G23', 'Pressure-gauge shut-off valve'],
        ['E01', 'Finish paint RAL-5003'], ['F05', 'Flushing to NAS-5'], ['F07', 'Flushing to NAS-7'],
        ['SPL', 'Other special requirements', { onReq: true, poa: true }]] },
    ],
    rules: [
      // D2: capacity by series
      ...Object.entries(AS_CAPS).map(([series, caps]) => ({ type: 'FILTER', target: 'capacity', when: { series: [series] }, allow: caps })),
      // D2: MWP by series+capacity
      { type: 'FILTER', target: 'mwp', when: { series: ['AS'], capacity: ['0.2'] }, allow: ['330'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['AS'], capacity: ['0.7'] }, allow: ['350'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['AS'], capacity: ['1', '1.5', '3', '4', '5', '6', '10', '20', '25', '35', '54', '57'] }, allow: ['360'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['AS'], capacity: ['60', '100', '130'] }, allow: ['330'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['ASHF'] }, allow: ['360'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['ASWP'] }, allow: ['30', '50', '70', '120', '165'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['ASWD'], capacity: ['1.5', '3', '4', '5', '6'] }, allow: ['70'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['ASWD'], capacity: ['10', '20', '25', '35', '54', '57'] }, allow: ['30'] },
      { type: 'FILTER', target: 'mwp', when: { series: ['ASLV', 'ASLVHF'] }, allow: ['16', '35'] },
      // D1: port size groups by port type
      { type: 'FILTER', target: 'portsize', when: { porttype: ['G', 'T', 'N', '3', '6', 'Q', 'RG', 'RT', 'RN', 'RS', 'RM'] }, allow: ['01', '02', '03', '04', '05', '06', '07', '08', '09', '10', '11', '12', '13'] },
      { type: 'FILTER', target: 'portsize', when: { porttype: ['S'] }, allow: ['21', '22', '23'] },
      { type: 'FILTER', target: 'portsize', when: { porttype: ['M'] }, allow: ['31', '32', '33', '34', '35', '36', '37', '38', '39', '40', '41'] },
      { type: 'FILTER', target: 'portsize', when: { porttype: ['D'] }, allow: ['51', '54', '58', '61', '67'] },
      { type: 'FILTER', target: 'portsize', when: { porttype: ['A'] }, allow: ['GB', 'IB', 'GA'] },
      { type: 'FILTER', target: 'portdesign', when: { porttype: ['A'] }, allow: ['WN', 'WJ', 'SO', 'SW', 'SJ'] },
      { type: 'FILTER', target: 'portdesign', when: { porttype: ['G', 'T', 'N', 'M', 'S'] }, allow: ['F', 'M'] },
      { type: 'FILTER', target: 'portdesign', when: { porttype: ['3', '6', 'Q'] }, allow: ['S', 'L'] },
      { type: 'FILTER', target: 'portdesign', when: { porttype: ['D'] }, allow: ['L', 'SW'] },
      // D6: certification composition
      { type: 'COMPOSE', target: 'cert', prerequisite: { NB: ['7U'], CRN: ['7U', 'NB'] } },
      // D5: ASWD precharge limit
      { type: 'CONSTRAINT', when: { series: ['ASWD'] }, numeric: { precharge: { max: 15 } }, message: 'ASWD (disc design): precharge pressure must be ≤ 15 bar.' },
      { type: 'CONSTRAINT', when: {}, numeric: { precharge: { min: 0, max: 360 } }, message: 'Precharge must be between 0 and 360 bar.' },
      // D3: derived facts
      { type: 'DERIVE', when: { capacity: ['0.2'] }, facts: { 'Max flow': '160 L/min' } },
      { type: 'DERIVE', when: { capacity: ['0.7', '1', '1.5'] }, facts: { 'Max flow': '300 L/min (AS/ASWP) · 100 L/min (ASWD)' } },
      { type: 'DERIVE', when: { capacity: ['3', '4', '5', '6'] }, facts: { 'Max flow': '600 L/min (AS/ASWP) · 150 L/min (ASWD)' } },
      { type: 'DERIVE', when: { capacity: ['10', '20', '25', '35', '54', '55', '57'] }, facts: { 'Max flow': '1000 L/min (AS/ASWP) · 1800 (ASHF) · 300 (ASWD)' } },
      { type: 'DERIVE', when: { capacity: ['60', '100', '130'] }, facts: { 'Max flow': '1800 L/min' } },
      { type: 'DERIVE', when: { capacity: ['150', '250', '350', '450', '575'] }, facts: { 'Max flow': '900 L/min (ASLV) · 1200 L/min (ASLVHF)' } },
      { type: 'DERIVE', when: { capacity: ['0.2', '0.7', '1'] }, facts: { 'CE marking': 'V ≤ 1 L: not CE-marked (PED Art. 3 exemption)' } },
      { type: 'DERIVE', when: { series: ['AS', 'ASHF', 'ASWP', 'ASWD', 'ASLV', 'ASLVHF', 'ASL', 'AST'] }, facts: { 'Test pressure': '≥1.43 × PS', 'Pressure ratio': 'P₂/P₀ ≤ 4:1', 'Temperature': '−20…+80 °C std (−40 °C on request)' } },
      { type: 'DERIVE', when: { bladder: ['P'] }, facts: { 'Bladder temp range': '−20…+85 °C' } },
      { type: 'DERIVE', when: { bladder: ['K'] }, facts: { 'Bladder temp range': '−50…+130 °C' } },
      { type: 'DERIVE', when: { bladder: ['V'] }, facts: { 'Bladder temp range': '−20…+121 °C' } },
    ],
    links: [
      { relation: 'recommended', label: 'Safety Block Type B (isolation/discharge/relief)', targetFamilyCode: 'SBB', note: 'Recommended for every accumulator installation' },
      { relation: 'recommended', label: 'Charging kit PC-280/70', targetFamilyCode: 'PC' },
      { relation: 'spare', label: 'Spare bladder assembly', codeTemplate: 'S-{seg:capacity}-{seg:bladder}-M50-{seg:gasvalvemat}-{seg:gasfill}', note: 'Gas valve type per availability matrix (M50 shown for 10–130 L; check matrix for smaller sizes)' },
      { relation: 'accessory', when: { capacity: ['1', '1.5', '3'] }, label: 'Clamp assembly', partNumber: 'CL0201 (ØD 110–114)' },
      { relation: 'accessory', when: { capacity: ['4', '5', '6'] }, label: 'Clamp assembly', partNumber: 'CL0300 / CL0301' },
      { relation: 'accessory', when: { capacity: ['10', '20', '25', '35', '54', '55', '57'] }, label: 'Clamp assembly', partNumber: 'CT0400 (ØD 219–226)' },
      { relation: 'accessory', when: { capacity: ['60', '100', '130'] }, label: 'Clamp assembly', partNumber: 'CT0414 (ØD 355)' },
      { relation: 'accessory', when: { series: ['AST'] }, label: 'Gas Charging Block BC + back-up gas bottles', targetFamilyCode: 'BC' },
    ],
  });

  // ============ 2. AMW Diaphragm ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'AMW', sort: 20,
    name: 'AMW Diaphragm Accumulator (welded, non-repairable)',
    description: 'Welded-shell diaphragm accumulator, non-repairable. 0.075–5 L, PS 40–350 bar, P₀max 130 bar, ratio 8:1 (≤1.4 L) / 6:1 (2 L) / 4:1 (2.8–5 L). PED module H, CE 0045.',
    datasheet: 'EPE/13.001/AMW Rev.8/10-2024',
    template: { separator: '-', suffixKeys: ['precharge', 'oilfill'] },
    segments: [
      { key: 'type', name: 'Type', options: [['AMW', 'Welded diaphragm accumulator', { std: true }]] },
      { key: 'capacity', name: 'Nominal capacity (L)', options: [
        ['0.07', '0.075 L'], ['0.16', '0.16 L'], ['0.32', '0.32 L'], ['0.50', '0.50 L'],
        ['0.75', '0.75 L', { std: true }], ['1', '1 L'], ['1.4', '1.4 L'], ['2', '2 L'], ['2.8', '2.8 L'], ['3.5', '3.5 L'], ['5', '5 L']] },
      { key: 'diaphragm', name: 'Diaphragm material', options: [
        ['P', 'NBR (−20…+80 °C) — mineral oils, water glycols, HFA/HFB/HFC, diesel', { std: true }],
        ['Y', 'ECO (−30…+110 °C) — mineral oils, aliphatic hydrocarbons, ozone resistant'],
        ['V', 'FKM (−10…+150 °C) — mineral oils, HFD, aromatic hydrocarbons, fuels'],
        ['0', 'Without diaphragm']] },
      { key: 'mwp', name: 'Max working pressure (bar)', options: [
        ['40', '40 bar'], ['100', '100 bar'], ['130', '130 bar'], ['140', '140 bar'], ['160', '160 bar'],
        ['210', '210 bar', { std: true }], ['250', '250 bar'], ['300', '300 bar'], ['350', '350 bar']] },
      { key: 'body', name: 'Body material', options: [
        ['C', 'Carbon steel, painted RAL9005 (−20…+80 °C)', { std: true }],
        ['L', 'Low-temperature carbon steel (−40…+80 °C)'], ['X', 'Stainless steel, unpainted']] },
      { key: 'connection', name: 'Fluid side connection', options: [
        ['C1', 'G1/2" (F), ø29 spot face'], ['C2', 'G1/2" (F), ø34 spot face', { std: true }], ['C3', 'G3/4" (F)'],
        ['C6', 'M18x1.5 (F)'], ['C7', 'G3/4" (F) w/o spot face'], ['C8', '1/2" NPT (F)'], ['C9', 'M22x1.5 (F)'],
        ['C11', 'G1/2" (F) w/o spot face'], ['C12', 'M16x1.5 (F)'], ['C13', 'M14x1.5 (F)'],
        ['C4', 'G1/2" (F) — Design-3 only'], ['C5', 'G3/4" (F) — Design-3 only'],
        ['E1', 'M14x1.5 (M), ø5 hole'], ['E2', 'G1" (M) × G1/2" (F)'], ['E3', 'M33x1.5 × G1/2"'], ['E4', 'M42x1.5 × G3/4"'],
        ['E5', 'M32x1.5 × M22x1.5'], ['E10', 'G1" (M), ø20 hole'], ['E12', 'M18x1.5 (M), ø8 hole'], ['E20', 'G1/2" (M), ø10.5'],
        ['E22', 'G1/4" (M), ø5'], ['E26', 'SAE 13/16-16 UN-2A (M)'], ['E27', '3/4-16 UNF-2A (M)'],
        ['E7', 'M33x1.5 × G1/2" — Design-3 only'], ['E8', 'M45x1.5 × G3/4" — Design-3 only'],
        ['S6', 'SAE J1926 9/16-18 UNF'], ['S8', 'SAE 3/4-16 UNF'], ['S10', 'SAE 7/8-14 UNF'], ['S12', 'SAE 1-1/16-12 UN'],
        ['Z', 'Others (specify)', { onReq: true, poa: true }]] },
      { key: 'cert', name: 'Certification', options: [
        ['0', 'Factory testing (design per PED)', { std: true }], ['1', 'EAC / CU-TR 032/2013'], ['8', 'CE/PED per EN-14359']] },
      { key: 'gasside', name: 'Gas side connection', options: [
        ['M', 'M28x1.5 (M) rechargeable (standard)', { std: true }],
        ['P', 'ø8 non-rechargeable, sealed (≤1.4 L and ≤250 bar only)'],
        ['VV', '5/8" UNF (M) plunger, rechargeable'], ['VX', '5/8" UNF SS'], ['V1', '5/16" UNEF / Vg8'],
        ['VM', '5/16" UNEF military'], ['V2', '1/4" BSP (M)'], ['V4', '7/8" UNF (M)'], ['V5', 'M16x2 (M)'],
        ['V6', 'M16x1.5 (M)'], ['V0', 'Without gas valve']] },
      { key: 'precharge', name: 'Precharge pressure (bar @20 °C)', type: 'numeric', required: false, prefix: 'PO-', unit: 'bar' },
      { key: 'oilfill', name: 'Oil filling on gas side (ml)', type: 'numeric', required: false, prefix: 'O-', unit: 'ml' },
      { key: 'others', name: 'Others', required: false, options: [
        ['-', 'Standard (polymer diaphragm plug)', { std: true }], ['C', 'Diaphragm plug in carbon steel'],
        ['X', 'Diaphragm plug in SS'], ['Z', 'Other requirements', { onReq: true, poa: true }]] },
    ],
    rules: [
      { type: 'FILTER', target: 'capacity', when: { mwp: ['130'] }, allow: ['1.4', '2'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['140'] }, allow: ['0.75', '1'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['160'] }, allow: ['0.50', '1.4'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['210'] }, allow: ['0.32', '0.50', '0.75', '1.4', '2', '2.8'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['250'] }, allow: ['0.07', '0.16', '0.75', '1', '1.4', '2', '2.8', '3.5', '5'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['300'] }, allow: ['0.16'] },
      { type: 'FILTER', target: 'capacity', when: { mwp: ['350'] }, allow: ['0.75', '3.5'] },
      { type: 'CONSTRAINT', when: { gasside: ['P'] }, require: { capacity: ['0.07', '0.16', '0.32', '0.50', '0.75', '1', '1.4'], mwp: ['40', '100', '130', '140', '160', '210', '250'] }, message: 'Sealed gas side (P) only for capacity ≤ 1.4 L and pressure ≤ 250 bar.' },
      { type: 'CONSTRAINT', when: {}, numeric: { precharge: { min: 0, max: 130 } }, message: 'AMW precharge P₀max is 130 bar.' },
      { type: 'DERIVE', when: { capacity: ['0.07', '0.16', '0.32', '0.50', '0.75', '1', '1.4'] }, facts: { 'Pressure ratio': '8:1' } },
      { type: 'DERIVE', when: { capacity: ['2'] }, facts: { 'Pressure ratio': '6:1' } },
      { type: 'DERIVE', when: { capacity: ['2.8', '3.5', '5'] }, facts: { 'Pressure ratio': '4:1' } },
      { type: 'DERIVE', when: { capacity: ['0.07', '0.16', '0.32', '0.50', '0.75', '1'] }, facts: { 'CE marking': 'V ≤ 1 L: not CE-marked (PED Art. 3)' } },
      { type: 'DERIVE', when: { gasside: ['M'] }, facts: { 'Charging kit': 'PCM (M28x1.5 connection)' } },
      { type: 'DERIVE', when: { gasside: ['VV', 'VX', 'V1', 'VM', 'V2', 'V4', 'V5', 'V6'] }, facts: { 'Charging kit': 'PC + adaptor' } },
      { type: 'DERIVE', when: { gasside: ['P'] }, facts: { 'Recharging': 'Not possible — sealed for life' } },
      { type: 'DERIVE', when: { type: ['AMW'] }, facts: { 'Shelf life': '3 years', 'Repairability': 'Non-repairable' } },
    ],
    links: [
      { relation: 'recommended', when: { gasside: ['M'] }, label: 'Charging kit PCM-280/70', targetFamilyCode: 'PCM' },
      { relation: 'recommended', when: { gasside: ['VV', 'VX', 'V1', 'VM', 'V2', 'V4', 'V5', 'V6'] }, label: 'Charging kit PC-280/70 + adaptor', targetFamilyCode: 'PC' },
      { relation: 'recommended', label: 'Safety Block Type B', targetFamilyCode: 'SBB' },
      { relation: 'accessory', when: { capacity: ['0.75'] }, label: 'Clamp assembly', partNumber: 'CL0201 / CL0202' },
      { relation: 'accessory', when: { capacity: ['1'] }, label: 'Clamp assembly', partNumber: 'CT0702' },
      { relation: 'accessory', when: { capacity: ['1.4', '2'] }, label: 'Clamp assembly', partNumber: 'CT0700' },
      { relation: 'accessory', when: { capacity: ['2.8', '3.5', '5'] }, label: 'Clamp assembly', partNumber: 'CL0300 / CL0301' },
      { relation: 'accessory', when: { capacity: ['0.75', '1', '1.4', '2'] }, label: 'Bracket assembly', partNumber: 'BA0300' },
      { relation: 'accessory', when: { capacity: ['2.8', '3.5', '5'] }, label: 'Bracket assembly', partNumber: 'BA0400' },
    ],
  });

  // ============ 3. AP Piston ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'AP', sort: 30,
    name: 'AP Piston Accumulator (repairable)',
    description: 'Floating-piston accumulator, repairable. 0.25–1500 L, PS 120–1000 bar, ratio 8:1. Design BS-EN-14359/ASME.',
    datasheet: 'EPE/14.001/AP Rev.7/01-2025',
    template: { separator: '-', suffixKeys: ['precharge'] },
    segments: [
      { key: 'series', name: 'Series', options: [['AP', 'Piston accumulator', { std: true }]] },
      { key: 'capacity', name: 'Nominal capacity (L)', options: [
        ['0.25', '0.25 L'], ['0.5', '0.5 L'], ['0.75', '0.75 L'], ['1', '1 L'], ['1.5', '1.5 L'], ['2', '2 L'],
        ['3', '3 L'], ['5', '5 L'], ['6', '6 L'], ['10', '10 L'], ['12', '12 L'], ['15', '15 L'], ['20', '20 L'],
        ['25', '25 L'], ['30', '30 L'], ['35', '35 L', { std: true }], ['50', '50 L'], ['75', '75 L'], ['100', '100 L'],
        ['150', '150 L'], ['200', '200 L'], ['300', '300 L'], ['400', '400 L'], ['600', '600 L'], ['1000', '1000 L']] },
      { key: 'mwp', name: 'Max working pressure (bar)', options: [
        ['120', '120 bar'], ['220', '220 bar'], ['250', '250 bar'], ['300', '300 bar'], ['330', '330 bar'],
        ['350', '350 bar'], ['375', '375 bar', { std: true }], ['450', '450 bar'], ['690', '690 bar'], ['1000', '1000 bar']] },
      { key: 'piston', name: 'Piston diameter (mm)', options: [
        ['050', 'ø50 — 0.25–1.5 L'], ['080', 'ø80 — 0.5–10 L'], ['100', 'ø100 — 0.5–15 L'], ['125', 'ø125 — 2–25 L'],
        ['180', 'ø180 — 6–100 L', { std: true }], ['250', 'ø250 — 15–200 L'], ['350', 'ø350 — 100–400 L'], ['490', 'ø490 — 150–1000 L']] },
      { key: 'tube', name: 'Tube & end cover material', options: [
        ['C', 'Carbon steel', { std: true }], ['N', 'CS externally nickel-coated'], ['X', 'Stainless steel'], ['A', 'Aluminium']] },
      { key: 'pistonmat', name: 'Piston material', options: [
        ['1', 'SG iron'], ['2', 'Aluminium alloy (standard)', { std: true }], ['X', 'Stainless steel']] },
      { key: 'sealspeed', name: 'Piston speed & seal material', options: [
        ['PPU', '3 m/s — polyurethane (up to ø180, standard)', { std: true }],
        ['APU', '3 m/s — polyurethane (up to ø180)'],
        ['PPD', '2 m/s — PU + PTFE + nitrile (ø180 standard)'], ['APD', '2 m/s — PU + PTFE + nitrile'],
        ['PTN', '3 m/s — PTFE + nitrile (above ø180, standard)'], ['PTV', '3 m/s — PTFE + Viton (above ø180)'],
        ['PTE', '3 m/s — PTFE + EPDM (above ø180)'], ['PVV', '3 m/s — Viton (above ø180)'], ['PEE', '3 m/s — EPDM (above ø180)'],
        ['FPT', '0.5 m/s — PU + PTFE (up to ø180)'], ['TTN', '2 m/s — PTFE + nitrile (up to ø350)'], ['TTV', '2 m/s — PTFE + Viton (up to ø350)']] },
      { key: 'endseal', name: 'End cap seals', options: [['P', 'NBR (standard)', { std: true }], ['V', 'FKM'], ['E', 'EPDM']] },
      { key: 'pistondesign', name: 'Piston design', options: [
        ['0', 'Without recovery valve (standard)', { std: true }], ['V', 'With recovery valve'], ['S', 'Special', { onReq: true, poa: true }]] },
      { key: 'inner', name: 'Inner surface', options: [['0', 'Standard', { std: true }], ['S', 'Others', { onReq: true, poa: true }]] },
      { key: 'gasdesign', name: 'Gas side design', options: [['0', 'Standard', { std: true }], ['S', 'Others', { onReq: true, poa: true }]] },
      { key: 'gasconn', name: 'Gas side connections', options: [
        ['FV', 'Gas fill valve 5/8" UNF (standard)', { std: true }], ['FX', '5/8" UNF in SS'], ['F1', '5/16" UNEF / Vg8'],
        ['F2', '1/4" BSP'], ['F3', 'M16x2.0'], ['F8', 'Double-lock military'], ['FM', 'M28x1.5'],
        ['G05F', 'No fill valve, 3/4" BSP (F) port'], ['G06F', 'No fill valve, 1" BSP (F) port']] },
      { key: 'liqdesign', name: 'Liquid side design', options: [['0', 'Standard', { std: true }], ['S', 'Special', { onReq: true, poa: true }]] },
      { key: 'liqconn', name: 'Liquid side connections', options: [
        ['G04F', '1/2" BSP (F) — std for ø50'], ['G05F', '3/4" BSP (F) — std for ø80'], ['G06F', '1" BSP (F) — std ø100/125'],
        ['G07F', '1-1/4" BSP (F)'], ['G08F', '1-1/2" BSP (F) — std ø180/250/350'], ['G09F', '2" BSP (F) — std ø490']] },
      { key: 'cert', name: 'Test certification', type: 'multi', options: [
        ['0', 'Factory testing', { std: true }], ['8', 'CE/PED per EN-14359'], ['7W', 'ASME w/o U-stamp'],
        ['7U', 'ASME with U-stamp'], ['1', 'EAC / CU-TR']] },
      { key: 'precharge', name: 'Precharge pressure (bar)', type: 'numeric', required: false, prefix: 'PO:', unit: 'bar' },
      { key: 'monitoring', name: 'Piston position monitoring', required: false, options: [
        ['-', 'None', { std: true }], ['ES', 'Electrical limit switch, screw-in'], ['EF', 'Electrical limit switch, flanged (vertical mounting)'],
        ['WS', 'Walking-stick design (vertical mounting)'], ['XG', 'Exit rod gas side'], ['XL', 'Exit rod liquid side'],
        ['UE', 'Ultrasonic position switch, external'], ['LS', 'Laser sensor 4–20 mA'],
        ['WP', 'Wire position monitoring + transducer + display (vertical mounting)']] },
      { key: 'variants', name: 'Other variants', type: 'multi', required: false, options: [
        ['G07/2', 'Lifting hooks ×2'], ['G11', '1/4" gauge adapter'], ['G12', 'Adapter + gauge'], ['G13', 'Rupture disc'],
        ['G19', 'VS214 gas safety valve'], ['G21', 'Needle valve CS'], ['G22', 'Needle valve SS'],
        ['E01', 'Paint RAL-5003'], ['F05', 'NAS-5 flushing'], ['F07', 'NAS-7 flushing'], ['F10', 'NAS-10 flushing']] },
    ],
    rules: [
      { type: 'FILTER', target: 'capacity', when: { piston: ['050'] }, allow: ['0.25', '0.5', '0.75', '1', '1.5'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['080'] }, allow: ['0.5', '0.75', '1', '1.5', '2', '3', '5', '6', '10'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['100'] }, allow: ['0.5', '0.75', '1', '1.5', '2', '3', '5', '6', '10', '12', '15'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['125'] }, allow: ['2', '3', '5', '6', '10', '12', '15', '20', '25'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['180'] }, allow: ['6', '10', '12', '15', '20', '25', '30', '35', '50', '75', '100'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['250'] }, allow: ['15', '20', '25', '30', '35', '50', '75', '100', '150', '200'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['350'] }, allow: ['100', '150', '200', '300', '400'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['490'] }, allow: ['150', '200', '300', '400', '600', '1000'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['050'] }, allow: ['250'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['080'] }, allow: ['300'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['100'] }, allow: ['375', '690', '1000'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['125'] }, allow: ['330'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['180'] }, allow: ['375', '450', '690', '1000'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['250'] }, allow: ['220', '350'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['350'] }, allow: ['220', '350'] },
      { type: 'FILTER', target: 'mwp', when: { piston: ['490'] }, allow: ['120', '220'] },
      { type: 'FILTER', target: 'sealspeed', when: { piston: ['050', '080', '100', '125'] }, allow: ['PPU', 'APU', 'FPT', 'TTN', 'TTV'] },
      { type: 'FILTER', target: 'sealspeed', when: { piston: ['180'] }, allow: ['PPU', 'APU', 'PPD', 'APD', 'FPT', 'TTN', 'TTV'] },
      { type: 'FILTER', target: 'sealspeed', when: { piston: ['250', '350'] }, allow: ['PTN', 'PTV', 'PTE', 'PVV', 'PEE', 'TTN', 'TTV'] },
      { type: 'FILTER', target: 'sealspeed', when: { piston: ['490'] }, allow: ['PTN', 'PTV', 'PTE', 'PVV', 'PEE'] },
      { type: 'DEFAULT', target: 'sealspeed', when: { piston: ['250', '350', '490'] }, default: 'PTN' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['050'] }, default: 'G04F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['080'] }, default: 'G05F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['100', '125'] }, default: 'G06F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['180', '250', '350'] }, default: 'G08F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['490'] }, default: 'G09F' },
      { type: 'CONSTRAINT', when: { monitoring: ['ES', 'EF', 'WS', 'WP', 'XG', 'XL', 'UE', 'LS'] }, forbid: { pistondesign: ['V'] }, message: 'Position monitoring and recovery valve cannot be combined (check with factory).' },
      { type: 'CONSTRAINT', when: {}, numeric: { precharge: { min: 0, max: 1000 } }, message: 'Precharge must be within the pressure rating.' },
      { type: 'DERIVE', when: { series: ['AP'] }, facts: { 'Pressure ratio': '8:1', 'Test pressure': '1.43×PS (PED) / 1.3×PS (ASME)', 'Temperature': '−20…+80 °C' } },
      { type: 'DERIVE', when: { monitoring: ['ES'] }, facts: { 'ES device': 'Max stroke 100 mm, max 2 switches, piston speed ≤ 0.5 m/s in charging stroke' } },
    ],
    links: [
      { relation: 'recommended', label: 'Safety Block Type B (long adaptor by piston ø)', targetFamilyCode: 'SBB' },
      { relation: 'recommended', label: 'Charging kit PC-280/70', targetFamilyCode: 'PC' },
      { relation: 'spare', label: 'Piston seal kit', codeTemplate: 'PSK-{seg:piston}-{seg:sealspeed}-{seg:endseal}' },
      { relation: 'accessory', when: { monitoring: ['ES'] }, label: 'ES Limit Switching Device', targetFamilyCode: 'ES' },
      { relation: 'accessory', when: { piston: ['100'] }, label: 'U-clamp assembly', partNumber: '11545 (ext ø130)' },
      { relation: 'accessory', when: { piston: ['180'] }, label: 'U-clamp assembly', partNumber: '11546 (ext ø210/220)' },
      { relation: 'accessory', when: { piston: ['250'] }, label: 'U-clamp assembly', partNumber: '11547 (ext ø292/312)' },
      { relation: 'accessory', when: { piston: ['350'] }, label: 'U-clamp assembly', partNumber: '11548 (ext ø405/419)' },
    ],
  });

  // ============ 4. APC compact piston ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'APC', sort: 40,
    name: 'APC Compact Piston Accumulator (non-repairable)',
    description: 'Compact floating-piston accumulator, non-repairable (only gas fill valve replaceable). 0.1–8 L, PS 250 bar, ratio 8:1.',
    datasheet: 'EPE/14.002/APC Rev.0/09-2020',
    template: { separator: '-', suffixKeys: ['precharge'] },
    segments: [
      { key: 'series', name: 'Series', options: [['APC', 'Compact piston accumulator', { std: true }]] },
      { key: 'capacity', name: 'Nominal capacity (L)', options: [
        ['0.1', '0.1 L'], ['0.2', '0.2 L'], ['0.25', '0.25 L'], ['0.3', '0.3 L'], ['0.5', '0.5 L'],
        ['0.75', '0.75 L'], ['1', '1 L', { std: true }], ['1.5', '1.5 L'], ['2', '2 L'], ['3', '3 L'], ['5', '5 L'], ['8', '8 L']] },
      { key: 'mwp', name: 'Max working pressure', options: [['250', '250 bar [3625 psi]', { std: true }]] },
      { key: 'piston', name: 'Piston diameter (mm)', options: [
        ['040', 'ø40 — 0.1–0.3 L'], ['050', 'ø50 — 0.1–1 L', { std: true }], ['080', 'ø80 — 0.25–3 L'], ['100', 'ø100 — 0.75–8 L']] },
      { key: 'tube', name: 'Tube & end cover material', options: [['C', 'Carbon steel', { std: true }], ['X', 'Stainless steel']] },
      { key: 'pistonmat', name: 'Piston material', options: [['1', 'SG iron'], ['2', 'Aluminium alloy (standard)', { std: true }], ['X', 'SS']] },
      { key: 'sealspeed', name: 'Piston speed & seals', options: [
        ['PPU', '3 m/s — PU seals (standard)', { std: true }], ['APT', '0.5 m/s — PU + PTFE']] },
      { key: 'endseal', name: 'End cap seals', options: [['P', 'NBR (standard)', { std: true }], ['V', 'FKM'], ['E', 'EPDM']] },
      { key: 'pistondesign', name: 'Piston design', options: [['0', 'EPE standard', { std: true }], ['S', 'Special', { onReq: true, poa: true }]] },
      { key: 'inner', name: 'Inner surface', options: [['0', 'Standard', { std: true }], ['S', 'Others', { onReq: true, poa: true }]] },
      { key: 'gasdesign', name: 'Gas side design', options: [['0', 'Standard', { std: true }], ['S', 'Others', { onReq: true, poa: true }]] },
      { key: 'gasconn', name: 'Gas side connections', options: [
        ['FV', '5/8" UNF (standard)', { std: true }], ['FX', '5/8" UNF SS'], ['F1', '5/16" UNEF / Vg8'],
        ['F2', '1/4" BSP'], ['F3', 'M16x2.0'], ['F8', 'Double-lock military'], ['FM', 'M28x1.5']] },
      { key: 'liqdesign', name: 'Liquid side design', options: [['0', 'Standard', { std: true }], ['S', 'Special', { onReq: true, poa: true }]] },
      { key: 'liqconn', name: 'Liquid side connections', options: [
        ['G03F', '3/8" BSP (F) — std ø40'], ['G04F', '1/2" BSP (F) — std ø50'], ['G05F', '3/4" BSP (F) — std ø80'],
        ['G06F', '1" BSP (F) — std ø100'], ['S6', 'SAE 9/16-18 UNF-2B'], ['S10', 'SAE 7/8-14 UNF-2B'],
        ['S12', 'SAE 1-1/16-12 UN-2B'], ['S16', 'SAE 1-5/16-12 UN-2B']] },
      { key: 'cert', name: 'Certification', options: [
        ['0', 'Factory testing', { std: true }], ['8', 'CE/PED'], ['7W', 'ASME w/o U-stamp']] },
      { key: 'precharge', name: 'Precharge pressure (bar)', type: 'numeric', required: false, prefix: 'PO:', unit: 'bar' },
    ],
    rules: [
      { type: 'FILTER', target: 'capacity', when: { piston: ['040'] }, allow: ['0.1', '0.2', '0.3'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['050'] }, allow: ['0.1', '0.2', '0.25', '0.3', '0.5', '0.75', '1'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['080'] }, allow: ['0.25', '0.5', '0.75', '1', '1.5', '2', '3'] },
      { type: 'FILTER', target: 'capacity', when: { piston: ['100'] }, allow: ['0.75', '1', '1.5', '2', '3', '5', '8'] },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['040'] }, default: 'G03F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['050'] }, default: 'G04F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['080'] }, default: 'G05F' },
      { type: 'DEFAULT', target: 'liqconn', when: { piston: ['100'] }, default: 'G06F' },
      { type: 'CONSTRAINT', when: {}, numeric: { precharge: { min: 0, max: 250 } }, message: 'Precharge must be ≤ 250 bar.' },
      { type: 'DERIVE', when: { series: ['APC'] }, facts: { 'Repairability': 'Non-repairable — only gas fill valve replaceable', 'Pressure ratio': '8:1' } },
    ],
    links: [
      { relation: 'recommended', label: 'Safety Block Type B', targetFamilyCode: 'SBB' },
      { relation: 'recommended', label: 'Charging kit PC-280/70', targetFamilyCode: 'PC' },
      { relation: 'accessory', when: { piston: ['100'] }, label: 'U-clamp', partNumber: '11545 (ext ø120)' },
    ],
  });

  // ============ 5. ES Limit Switching Device ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'ES', sort: 50,
    name: 'ES Limit Switching Device (for AP piston accumulators)',
    description: 'Magnet-operated limit switch screwed into gas-side top cover of AP accumulators; signals piston positions. Stroke ≤ 100 mm, ≤ 2 switches, IP67.',
    datasheet: 'EPE/15.005/ES Rev.1/12-2020',
    template: { separator: '-', suffixKeys: ['stroke', 'cable'] },
    segments: [
      { key: 'type', name: 'Type', options: [['ES', 'Limit switching device assembly', { std: true }]] },
      { key: 'switches', name: 'Number of switches', options: [['1', 'One switch (standard)', { std: true }], ['2', 'Two switches']] },
      { key: 'switchtype', name: 'Switch type', options: [
        ['NO', 'Normally open (standard)', { std: true }], ['NC', 'Normally closed'],
        ['NO+NC', 'NO + NC (two switches)'], ['BS', 'Bistable NO with snap-in contact']] },
      { key: 'sealing', name: 'Sealing', options: [['P', 'NBR (standard)', { std: true }], ['V', 'Viton']] },
      { key: 'stroke', name: 'Stroke length (mm)', type: 'numeric', unit: 'mm', prefix: '' },
      { key: 'cable', name: 'Cable length (mm)', type: 'numeric', unit: 'mm', prefix: '' },
    ],
    rules: [
      { type: 'CONSTRAINT', when: { switchtype: ['NO+NC'] }, require: { switches: ['2'] }, message: 'NO+NC needs two switches.' },
      { type: 'CONSTRAINT', when: {}, numeric: { stroke: { min: 1, max: 100 } }, message: 'Stroke length incl. spring reset is limited to 100 mm.' },
      { type: 'CONSTRAINT', when: {}, numeric: { cable: { min: 100, max: 20000 } }, message: 'Specify cable length in mm (standard 5000).' },
      { type: 'DERIVE', when: { type: ['ES'] }, facts: { 'Electrical': 'Max 250 V AC/DC, 3 A, 120 VA/W; IP67', 'Note': 'Bottom switch (nearer top cover) is always NO. Casing pressurized once installed.' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement switch', codeTemplate: 'ESS-{seg:switchtype}/{seg:cable}' },
    ],
  });

  // ============ 6. Safety Block B ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'SBB', sort: 60,
    name: 'B Accumulator Safety Block',
    description: 'Isolation/discharge/relief block between accumulator and system; ball-type shut-off, manual discharge lever, optional solenoid. PS 420 bar.',
    datasheet: 'EPE/15.001/B Rev.4',
    segments: [
      { key: 'series', name: 'Series', options: [['B', 'Safety block', { std: true }]] },
      { key: 'size', name: 'Size (mm)', options: [
        ['10', 'B10 — 30 L/min @6 m/s', { std: true }], ['20', 'B20 — 115 L/min'], ['25', 'B25 — 180 L/min'], ['32', 'B32 — 290 L/min']] },
      { key: 'discharge', name: 'Discharge', options: [
        ['M', 'Manual only (standard)', { std: true }], ['E', 'Manual + electric (solenoid, DIN 43650-A, max +65 °C)']] },
      { key: 'safetyvalve', name: 'Safety valve', options: [
        ['A', 'Without relief valve, plastic plug'], ['T', 'Without relief valve, metal plug'],
        ['B', 'DBDS CS relief valve, factory calibrated', { std: true }], ['P', 'DBDS CS relief valve, CE certified'],
        ['1', 'DBDS CS relief valve, EAC certified'], ['V', 'CS gas safety valve'], ['G', 'SS gas safety valve']] },
      { key: 'reliefpressure', name: 'Relief pressure (bar)', type: 'numeric', unit: 'bar', required: false, help: '0 = without relief valve; 5–420 bar' },
      { key: 'accconn', name: 'Accumulator side connection', options: [
        ['G04M', '1/2" BSPP (M) — for AMW'], ['G05M', '3/4" BSPP (M) — AS 0.7–1.5 | AMW'],
        ['G07M', '1-1/4" BSPP (M) — AS 3–6'], ['G09M', '2" BSPP (M) — AS 10–55 | ASWP 10–55 | ASWD 1.5–3', { std: true }],
        ['G10M', '2-1/2" BSPP (M) — AS 60–130 | ASHF 10–55 | ASWD 4–5'], ['G13M', '4" BSPP (M) — ASWD 10–55'],
        ['M32M', 'M16x1.5 (M) — AMW'], ['M33M', 'M18x1.5 (M) — AM | AMW'], ['M34M', 'M22x1.5 (M) — AMW'],
        ['M38M', 'M40x1.5 (M) — AS 3–6'], ['M41M', 'M50x1.5 (M) — AS 10–55'],
        ['W00H', 'Without nipple'], ['309H', 'Holes for 2" SAE 3000 flange (B25 | B32)'],
        ['L05M', 'Long adaptor 3/4" BSPP (M) — AP ø100'], ['L06M', 'Long adaptor 1" — AP ø100 | ø125'],
        ['L07M', 'Long adaptor 1-1/4" — AP ø100'], ['L08M', 'Long adaptor 1-1/2" — AP ø180–520']] },
      { key: 'instconn', name: 'Installation side connection', options: [
        ['G04F', '1/2" BSPP (F) — std for B10', { std: true }], ['G05F', '3/4" BSPP (F) — std for B20'],
        ['G06F', '1" BSPP (F) — std for B25'], ['G08F', '1-1/2" BSPP (F) — std for B32'], ['G09F', '2" BSPP (F)'],
        ['C07H', 'Holes 1-1/4" CETOP-400 (B25 | B32)'], ['C08H', 'Holes 1-1/2" CETOP-400 (B32)'],
        ['308H', '1-1/2" SAE-3000 (B32)'], ['309H', '2" SAE-3000 (B32)'],
        ['607H', '1-1/4" SAE-6000 (B25 | B32)'], ['608H', '1-1/2" SAE-6000 (B32)']] },
      { key: 'seal', name: 'Seal material', options: [
        ['P', 'NBR (−20…+80 °C)', { std: true }], ['F', 'Low-temp NBR (−40…+70 °C)'], ['K', 'HNBR (−30…+130 °C)'],
        ['E', 'EPDM (−30…+100 °C)'], ['B', 'Butyl (−20…+90 °C)'], ['V', 'FKM (−10…+130 °C)']] },
      { key: 'block', name: 'Block material', options: [
        ['C', 'Carbon steel (−20…+150 °C)', { std: true }], ['L', 'Low-temp CS (−40…+150 °C)'],
        ['N', 'Nickel-coated CS'], ['X', 'Stainless steel']] },
      { key: 'variants', name: 'Other variants', type: 'multi', required: false, options: [
        ['0', 'None', { std: true }], ['X', 'SS relief valve'], ['G', 'Pressure gauge'], ['GG', 'Glycerine-filled gauge'],
        ['24D-C', 'Solenoid 24 VDC'], ['110A-C', 'Solenoid 110 VAC'], ['220A-C', 'Solenoid 220 VAC'],
        ['MC', 'Minimess coupling'], ['MCX', 'Minimess coupling SS']] },
    ],
    rules: [
      { type: 'FILTER', target: 'instconn', when: { size: ['10'] }, allow: ['G04F', 'G05F'] },
      { type: 'FILTER', target: 'instconn', when: { size: ['20'] }, allow: ['G05F', 'G06F'] },
      { type: 'FILTER', target: 'instconn', when: { size: ['25'] }, allow: ['G06F', 'G09F', 'C07H', '607H'] },
      { type: 'FILTER', target: 'instconn', when: { size: ['32'] }, allow: ['G08F', 'G09F', 'C07H', 'C08H', '308H', '309H', '607H', '608H'] },
      { type: 'DEFAULT', target: 'instconn', when: { size: ['20'] }, default: 'G05F' },
      { type: 'DEFAULT', target: 'instconn', when: { size: ['25'] }, default: 'G06F' },
      { type: 'DEFAULT', target: 'instconn', when: { size: ['32'] }, default: 'G08F' },
      { type: 'CONSTRAINT', when: { safetyvalve: ['B', 'P', '1', 'V', 'G'] }, numeric: { reliefpressure: { min: 5, max: 420 } }, message: 'Relief valve chosen — set pressure must be 5–420 bar.' },
      { type: 'CONSTRAINT', when: { variants: ['24D-C', '110A-C', '220A-C'] }, require: { discharge: ['E'] }, message: 'Solenoid supply option requires discharge type E (manual + electric).' },
      { type: 'DERIVE', when: { discharge: ['E'] }, facts: { 'Temperature limit with solenoid': '+65 °C', 'Solenoid': '26 W, IP65, DIN 43650-A' } },
      { type: 'DERIVE', when: { series: ['B'] }, facts: { 'Operation': 'Fully open or fully shut only — not a flow control device' } },
    ],
  });

  // ============ 7. BC Charging Block ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'BC', sort: 70,
    name: 'BC Gas Charging Block',
    description: 'Manifold block connecting transfert-type accumulators with N₂ back-up bottles. PS 400 bar, sizes 25/32 mm.',
    datasheet: 'EPE/15.002/BC Rev.3',
    segments: [
      { key: 'type', name: 'Type / size', options: [['BC25', 'Size 25 mm [1"]', { std: true }], ['BC32', 'Size 32 mm [1.25"]']] },
      { key: 'safety', name: 'Safety valve / burst disc', options: [
        ['A', 'Without (standard)', { std: true }], ['B', 'Relief valve, factory certified'],
        ['D', 'Relief valve, CE/PED certified'], ['R', 'Burst disc, CE/PED certified']] },
      { key: 'setpressure', name: 'Set pressure (bar)', type: 'numeric', required: false, unit: 'bar', help: '0 = without valve' },
      { key: 'accconn', name: 'Connection accumulator side', options: [
        ['G05F', '3/4" BSP (F) (standard)', { std: true }], ['G06F', '1" BSP (F)'],
        ['G07F', '1-1/4" BSP (F) — BC32 only'], ['G08F', '1-1/2" BSP (F) — BC32 only']] },
      { key: 'bottleconn', name: 'Connection bottle side', options: [
        ['G05F', '3/4" BSP (F) (standard)', { std: true }], ['G06F', '1" BSP (F)'],
        ['G07F', '1-1/4" BSP (F) — BC32 only'], ['G08F', '1-1/2" BSP (F) — BC32 only']] },
      { key: 'body', name: 'Body material', options: [['C', 'CS phosphated (standard)', { std: true }], ['X', 'Stainless steel']] },
      { key: 'seal', name: 'Sealing', options: [['P', 'POM + NBR (standard)', { std: true }], ['V', 'POM + Viton']] },
      { key: 'cert', name: 'Certification', options: [['0', 'Factory certified (standard)', { std: true }]] },
    ],
    rules: [
      { type: 'FILTER', target: 'accconn', when: { type: ['BC25'] }, allow: ['G05F', 'G06F'] },
      { type: 'FILTER', target: 'bottleconn', when: { type: ['BC25'] }, allow: ['G05F', 'G06F'] },
      { type: 'CONSTRAINT', when: { safety: ['B', 'D', 'R'] }, numeric: { setpressure: { min: 5, max: 400 } }, message: 'Safety valve/burst disc chosen — set pressure 5–400 bar required.' },
      { type: 'DERIVE', when: { type: ['BC25'] }, facts: { 'Shut-off valve': 'DN25', 'Spare valve': 'Y65018', 'Gasket set': 'Y65019' } },
      { type: 'DERIVE', when: { type: ['BC32'] }, facts: { 'Shut-off valve': 'DN32', 'Spare valve': 'Y62031', 'Gasket set': 'Y62030' } },
    ],
  });

  // ============ 8-10. Charging kits PC / PC-HP / PCM ============
  for (const [code, name, sort, maxbar, gauges, ds] of [
    ['PC', 'PC Charging Kit (standard, 400 bar)', 80, 400, [['280/70', 'HP 0–280 bar + LP 0–70 bar (standard)', { std: true }], ['400/70', 'HP 0–400 bar'], ['210/35', 'HP 0–210 + LP 0–35'], ['140/20', 'HP 0–140 + LP 0–20']], 'EPE/15.003/PC'],
    ['PCHP', 'PC High-Pressure Charging Kit (690 bar)', 90, 690, [['700/400', 'HP 0–700 bar + LP 0–400 bar (standard)', { std: true }], ['400/280', 'HP 0–400 + LP 0–280'], ['280/210', 'HP 0–280 + LP 0–210']], 'EPE/15.003/PC Rev.0/11-2020'],
    ['PCM', 'PCM Charging Kit (for AMW, M28x1.5)', 100, 400, [['280/70', 'HP 0–280 bar + LP 0–70 bar (standard)', { std: true }], ['400/70', 'HP 0–400 bar'], ['210/35', 'HP 0–210 + LP 0–35']], 'EPE/15.004/PCM'],
  ]) {
    seedFamily(db, {
      category: 'ACCUMULATORS', code, sort, name,
      description: `${name}. Valve body with gauges, bleed, non-return, HP hose, carrying case. Max working pressure ${maxbar} bar.`,
      datasheet: ds,
      segments: [
        { key: 'type', name: 'Type', options: [[code === 'PCHP' ? 'PC' : code, name, { std: true }]] },
        { key: 'gauges', name: 'Pressure gauges (full scale)', options: gauges },
        { key: 'accconn', name: 'Connection to accumulator', options: code === 'PCM'
          ? [['-', 'M28x1.5 (standard)', { std: true }]]
          : [['-', '5/8" UNF (standard)', { std: true }], ['A', '5/16" UNEF / Vg8'], ['B', '7/8" UNF'], ['C', '1/4" BSP'], ['D', 'Universal']] },
        { key: 'bottleconn', name: 'Connection to bottle', options: [['-', '5/8" BSP (standard)', { std: true }]] },
        { key: 'hose', name: 'Hose length', options: [
          ['-', '2 m (standard)', { std: true }], ['1.5', '1.5 m', { onReq: true }], ['2.5', '2.5 m', { onReq: true }],
          ['4', '4 m', { onReq: true }], ['6', '6 m', { onReq: true }]] },
      ],
      rules: [
        { type: 'DERIVE', when: { type: [code === 'PCHP' ? 'PC' : code] }, facts: { 'Max working pressure': `${maxbar} bar`, 'Safety note': 'Use nitrogen only — never air or oxygen. Pressure-reducing valve mandatory when cylinder pressure exceeds accumulator max.' } },
      ],
      links: [
        { relation: 'accessory', label: 'Nitrogen cylinder adaptors T1–T13 (by bottle thread)', note: 'See parts list — e.g. T4 = I40055 = 5/8" BSP (M); T10 = I40059 = M22x1.5 (F)' },
      ],
    });
  }

  // ============ 11. CB2 band clamp ============
  seedFamily(db, {
    category: 'ACCUMULATORS', code: 'CB2', sort: 110,
    name: 'CB2 Band Clamp with Swivel Bolts',
    description: 'Static-use SS band clamp with swivel bolts both ends; EPDM lining. Tightening torque max 20 Nm.',
    datasheet: 'EPE/15.006-CB2 Rev.0/04-2026',
    segments: [
      { key: 'type', name: 'Type', options: [['CB2', 'Band clamp, swivel bolts both ends', { std: true }]] },
      { key: 'diameter', name: 'Diameter range (mm)', options: [
        ['89/106', '89–106 mm'], ['117/127', '117–127 mm'], ['128/138', '128–138 mm'], ['139/150', '139–150 mm'],
        ['150/168', '150–168 mm'], ['161/183', '161–183 mm'], ['172/194', '172–194 mm'], ['183/205', '183–205 mm'],
        ['198/221', '198–221 mm', { std: true }], ['213/236', '213–236 mm'], ['229/252', '229–252 mm'],
        ['245/268', '245–268 mm'], ['261/284', '261–284 mm']] },
      { key: 'clampmoc', name: 'MOC of clamp', options: [['X', 'Stainless steel (standard)', { std: true }]] },
      { key: 'lining', name: 'MOC of lining', options: [['E', 'EPDM (standard)', { std: true }]] },
      { key: 'bolt', name: 'Bolt thread / length', options: [
        ['M10/90', 'M10x1.5 × 90 mm (standard)', { std: true }], ['M10/45', 'M10x1.5 × 45 mm']] },
      { key: 'plating', name: 'Bolt plating', options: [['Zn', 'Zinc (standard)', { std: true }]] },
    ],
  });

  // Fixed parts: adaptors, clamps, brackets, spares
  seedParts(db, 'PC', [
    ['I40053', 'N₂ adaptor T1 — W21.7x14 (M)'], ['I40054', 'N₂ adaptor T2 — W24.32x14 (F)'],
    ['I40044', 'N₂ adaptor T3 — W21.7x14 (F)'], ['I40055', 'N₂ adaptor T4 — 5/8" BSP (M)'],
    ['I40051', 'N₂ adaptor T5 — W24.51x14 (M)'], ['I40056', 'N₂ adaptor T6 — 3/4" BSP (M)'],
    ['I40057', 'N₂ adaptor T7 — W24.51x14 (M) SW27'], ['I40052', 'N₂ adaptor T8 — 3/4" BSP (F)'],
    ['I40058', 'N₂ adaptor T9 — W22x14 (F)'], ['I40059', 'N₂ adaptor T10 — M22x1.5 (F)'],
    ['I40060', 'N₂ adaptor T11 — 5/8" BSP (F)'], ['I40061', 'N₂ adaptor T12 — W23x14 (M)'],
    ['I40042', 'N₂ adaptor T13 — 1/2" BSP (F)'],
    ['2160', 'PC gasket set'], ['2162', 'PC non-return valve'], ['2164', 'PC bleed assembly'],
    ['2166', 'PC hose (per m)'], ['2163', 'PC gauge (per bar range)'],
  ]);
  seedParts(db, 'AS', [
    ['CL0100', 'Clamp assy ØD 89–93 — AS 0.7 | AP ø80'], ['CL0201', 'Clamp assy ØD 110–114 — AS 1–3 | AMW 0.75'],
    ['CL0202', 'Clamp assy ØD 120–125 — AS 1–3 | AMW 0.75 | AP ø100'], ['CL0204', 'Clamp assy ØD 114–120'],
    ['CT0702', 'Clamp assy ØD 130–136 — AMW 1'], ['CT0700', 'Clamp assy ØD 148–150 — AMW 1.4–2 | AP ø125'],
    ['CL0300', 'Clamp assy ØD 160–168 — AS/ASWP 4–6 | AMW 2.8'], ['CL0301', 'Clamp assy ØD 163–174 — AS/ASWP 4–6 | AMW 2.8–5'],
    ['CL0302', 'Clamp assy ØD 185–190 — ASWP 4–6'], ['CT0400', 'Clamp assy ØD 219–226 — AS/ASWP 10–57 | AP ø180'],
    ['CT0404', 'Clamp assy ØD 220–226'], ['CT0499', 'Clamp assy ØD 235–241 — ASWP 10–57 HP'],
    ['CT0408', 'Clamp assy ØD 254–260 — ASWP HP'], ['CT0413', 'Clamp assy ØD 273 — ASWP HP'],
    ['CT0414', 'Clamp assy ØD 355 — AS 60–130'],
    ['BA0300', 'Bracket assy — AS 4–6 | AMW 0.75–2'], ['BA0400', 'Bracket assy — AS 10–57 | AMW 2.8–5'],
    ['BA0402', 'Bracket assy — AS 60–130'], ['BC0300', 'Support ring — AS 4–6 | AMW 0.75–2'],
    ['BC0400', 'Support ring — AS 10–130 | AMW 2.8–5'],
    ['11545', 'U-clamp assembly ext ø130 (AP ø100)'], ['11546', 'U-clamp assembly ext ø210/220 (AP ø180)'],
    ['11547', 'U-clamp assembly ext ø292/312 (AP ø250)'], ['11548', 'U-clamp assembly ext ø405/419 (AP ø350)'],
  ]);
}
