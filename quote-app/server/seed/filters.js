import { seedFamily, seedParts } from './helpers.js';
import { MEDIA, ADHESIVE, HARDWARE, SEALS_PVENB, SEALS_PVE, HOUSING_STD, DP_INDICATOR, DP_CRACKING, RL_INDICATOR, BYPASS_FULL } from './dictionaries.js';

const mediaSeg = (stdCode = 'H10XP') => ({
  key: 'media', name: 'Filtering media & grade',
  options: MEDIA.map(([c, l]) => [c, l, c === stdCode ? { std: true } : undefined]),
});
const hw = (...codes) => codes.map(c => HARDWARE[c]);

export function seedFilters(db) {
  // ============ 1. 40/160-LD/LDN Duplex ============
  seedFamily(db, {
    category: 'FILTERS', code: 'LD', sort: 10,
    name: '40/160-LD/LDN Low/Medium Pressure Duplex Filter',
    description: 'Duplex inline filter with change-over valve and pressure-equalisation valve for continuous operation. 40 or 160 bar, up to SAE 1-1/2". Head GGG50, bowl carbon steel.',
    datasheet: 'EPE/05.001/LD Rev.9/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['40', '40 bar [580 psi]'], ['160', '160 bar [2321 psi]', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['LD', 'Duplex inline, EPE standard element', { std: true }], ['LDN', 'Duplex inline, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0003', 'Size 0003 (uses 2.0004 element)'], ['0005', 'Size 0005 — 50 lpm'], ['0008', 'Size 0008 — 80 lpm'],
        ['0013', 'Size 0013 — 130 lpm', { std: true }], ['0015', 'Size 0015 — 150 lpm'], ['0018', 'Size 0018 — 180 lpm'],
        ['0020', 'Size 0020 — 200 lpm'], ['0030', 'Size 0030 — 300 lpm'], ['0045', 'Size 0045 — 450 lpm'],
        ['0040', 'DIN size 0040 — 50 lpm'], ['0063', 'DIN size 0063 — 80 lpm'], ['0100', 'DIN size 0100 — 130 lpm'],
        ['0160', 'DIN size 0160 — 200 lpm'], ['0250', 'DIN size 0250 — 300 lpm'], ['0400', 'DIN size 0400 — 450 lpm']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar', { std: true }], ['D', '60 bar'], ['C', '160 bar']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware (end caps + inner tube)', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }], ['X', 'With ring magnet (loose under elements)']] },
      { key: 'bypass', name: 'Bypass valve', options: BYPASS_FULL },
      { key: 'indicator', name: 'Maintenance indicator type', options: DP_INDICATOR },
      { key: 'cracking', name: 'Indicator cracking pressure', options: DP_CRACKING },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['G06', '1" BSP (F)'], ['G07', '1-1/4" BSP (F)'], ['G08', '1-1/2" BSP (F)'],
        ['S083', 'SAE flanged 3000 psi 1-1/2"'], ['S16', 'SAE 1-5/16-12UN O-ring boss'], ['S20', 'SAE 1-5/8-12UN O-ring boss'],
        ['S24', 'SAE 1-7/8-12UN O-ring boss'], ['S32', 'SAE 2-1/2-12UN O-ring boss'],
        ['X0', 'Special connection (specify)', { onReq: true, poa: true }], ['RA0', 'With adaptor (specify)', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Without (standard)', { std: true }], ['EP', '1/4" air-vent port plugged'], ['E', '1/4" BSP air vent valve'],
        ['4', '1/4" drain port plugged'], ['DV', '1/4" CS drain valve in bowl'], ['DVX', '1/4" SS drain valve in bowl']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['LD'] }, allow: ['0003', '0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045'], note: 'LD = EPE standard sizes' },
      { type: 'FILTER', target: 'size', when: { type: ['LDN'] }, allow: ['0040', '0063', '0100', '0160', '0250', '0400'], note: 'LDN = DIN 24550 sizes' },
      { type: 'FILTER', target: 'connection', when: { size: ['0003', '0005', '0008', '0013', '0040', '0063', '0100'] }, allow: ['G06', 'S16', 'S20', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0015', '0018'] }, allow: ['G07', 'S20', 'S24', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045', '0160', '0250'] }, allow: ['G08', 'S20', 'S24', 'S32', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0400'] }, allow: ['S083', 'X0', 'RA0'] },
      { type: 'DEFAULT', target: 'bypass', when: { pressure: ['40'] }, default: '7', note: '3.5 bar standard for 40 bar class' },
      { type: 'DEFAULT', target: 'bypass', when: { pressure: ['160'] }, default: '9', note: '7.0 bar standard for 160 bar class' },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['40'] }, default: '2.5' },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['160'] }, default: '5.0' },
      { type: 'DERIVE', when: { pressure: ['40'] }, facts: { 'Test pressure': '1.43 × PS (CE/PED) / 1.3 × PS (ASME)', 'Temperature range': '−20 to +100 °C' } },
      { type: 'DERIVE', when: { pressure: ['160'] }, facts: { 'Test pressure': '1.43 × PS (CE/PED) / 1.3 × PS (ASME)', 'Temperature range': '−20 to +100 °C' } },
      { type: 'DERIVE', when: { size: ['0013', '0100'] }, facts: { 'Rated flow': '130 lpm' } },
      { type: 'DERIVE', when: { size: ['0045', '0400'] }, facts: { 'Rated flow': '450 lpm' } },
      { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD'] }, forbid: { cracking: ['-'] }, message: 'A maintenance indicator needs a cracking pressure (position 9b).' },
      { type: 'COMPOSE', target: 'other', exclusive: [['EP', 'E'], ['4', 'DV'], ['4', 'DVX'], ['DV', 'DVX']] },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (2. Series)', codeTemplate: '2.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}', note: 'Element code from filter positions 3,4,5,6,11' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-{seg:pressure}-{seg:type}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
      { relation: 'spare', when: { size: ['0003', '0005', '0008', '0013', '0040', '0063', '0100'], bypass: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, label: 'Spare bypass valve', partNumber: 'BYP01/xx' },
      { relation: 'spare', when: { size: ['0015', '0018'], bypass: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, label: 'Spare bypass valve', partNumber: 'BYP02/xx' },
      { relation: 'spare', when: { size: ['0020', '0030', '0045', '0160', '0250', '0400'], bypass: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, label: 'Spare bypass valve', partNumber: 'BYP03/xx' },
      { relation: 'accessory', when: { indicator: ['B'] }, label: 'Indicator part', codeTemplate: 'F-{seg:cracking}-GW-02-00-{seg:seal}' },
      { relation: 'accessory', when: { indicator: ['A'] }, label: 'Indicator part', codeTemplate: 'F-{seg:cracking}-A0-00-00-{seg:seal}' },
    ],
  });

  // ============ 2. 250/450-FE/FEN Manifold ============
  seedFamily(db, {
    category: 'FILTERS', code: 'FE', sort: 20,
    name: '250/450-FE/FEN High Pressure Manifold Filter',
    description: 'Simplex manifold-mounted high-pressure filter, no piping; inlet/outlet on one plane. 250 or 450 bar, up to DN50.',
    datasheet: 'EPE/04.002/FE Rev.9/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['250', '250 bar [3625 psi]'], ['450', '450 bar [6525 psi]', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['FE', 'Manifold mounting, EPE standard element', { std: true }], ['FEN', 'Manifold mounting, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0003', 'Size 0003 (2.0004 element)'], ['0005', 'Size 0005 — 50 lpm'], ['0008', 'Size 0008 — 80 lpm'],
        ['0013', 'Size 0013 — 130 lpm', { std: true }], ['0015', 'Size 0015 — 150 lpm'], ['0018', 'Size 0018 — 180 lpm'],
        ['0020', 'Size 0020 — 200 lpm'], ['0030', 'Size 0030 — 300 lpm'], ['0045', 'Size 0045 — 450 lpm'],
        ['0095', 'Size 0095 — 950 lpm'], ['0145', 'Size 0145 — 1450 lpm'],
        ['0040', 'DIN 0040 — 50 lpm'], ['0063', 'DIN 0063 — 80 lpm'], ['0100', 'DIN 0100 — 130 lpm'],
        ['0160', 'DIN 0160 — 200 lpm'], ['0250', 'DIN 0250 — 300 lpm'], ['0400', 'DIN 0400 — 450 lpm'],
        ['0630', 'DIN 0630 — 950 lpm'], ['1000', 'DIN 1000 — 1450 lpm']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar', { std: true }], ['D', '60 bar'], ['C', '160 bar'], ['B', '330 bar']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }], ['X', 'With ring magnet (loose under elements)']] },
      { key: 'bypass', name: 'Bypass valve', options: [['0', 'Without bypass (standard)', { std: true }], ['*', 'With bypass valve (on request)', { onReq: true, poa: true }]] },
      { key: 'indicator', name: 'Maintenance indicator type', options: DP_INDICATOR },
      { key: 'cracking', name: 'Indicator cracking pressure', options: DP_CRACKING },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['DN14', 'Ø14 manifold ports'], ['DN18', 'Ø18 manifold ports'], ['DN32', 'Ø32 manifold ports'], ['DN50', 'Ø50 manifold ports']] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Without (standard)', { std: true }], ['4', '1/4" drain port plugged'], ['DV', '1/4" CS drain valve'], ['DVX', '1/4" SS drain valve']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['FE'] }, allow: ['0003', '0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045', '0095', '0145'] },
      { type: 'FILTER', target: 'size', when: { type: ['FEN'] }, allow: ['0040', '0063', '0100', '0160', '0250', '0400', '0630', '1000'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0003', '0005', '0008', '0013', '0040', '0063', '0100'] }, allow: ['DN14'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0015', '0018'] }, allow: ['DN18'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045', '0160', '0250', '0400'] }, allow: ['DN32'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0095', '0145', '0630', '1000'] }, allow: ['DN50'] },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['250', '450'] }, default: '5.0' },
      { type: 'DERIVE', when: { pressure: ['450'] }, facts: { 'Recommended initial assembly ΔP': '1.5 bar', 'PED status': 'Exempt per Art. 1 Sec. 2(f) — no CE mark' } },
      { type: 'DERIVE', when: { pressure: ['250'] }, facts: { 'Recommended initial assembly ΔP': '1.5 bar', 'PED status': 'Exempt per Art. 1 Sec. 2(f) — no CE mark' } },
      { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD'] }, forbid: { cracking: ['-'] }, message: 'A maintenance indicator needs a cracking pressure.' },
      { type: 'COMPOSE', target: 'other', exclusive: [['4', 'DV'], ['4', 'DVX'], ['DV', 'DVX']] },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (2. Series)', codeTemplate: '2.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-{seg:pressure}-{seg:type}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
    ],
  });

  // ============ 3. 250/450-LE/LEN HP Inline ============
  seedFamily(db, {
    category: 'FILTERS', code: 'LEHP', sort: 30,
    name: '250/450-LE/LEN High Pressure Inline Filter',
    description: 'Simplex inline high-pressure filter, inlet/outlet on opposite sides. 250/450 bar, up to SAE 2-1/2". Head GGG50, bowl CS.',
    datasheet: 'EPE/04.001/LE Rev.9/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['250', '250 bar'], ['450', '450 bar', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['LE', 'Inline, EPE standard element', { std: true }], ['LEN', 'Inline, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0005', '0005 — 50 lpm'], ['0008', '0008 — 80 lpm'], ['0013', '0013 — 130 lpm', { std: true }],
        ['0015', '0015 — 150 lpm'], ['0018', '0018 — 180 lpm'], ['0020', '0020 — 200 lpm'],
        ['0030', '0030 — 300 lpm'], ['0045', '0045 — 450 lpm'], ['0095', '0095 — 950 lpm'], ['0145', '0145 — 1450 lpm'],
        ['0040', 'DIN 0040'], ['0063', 'DIN 0063'], ['0100', 'DIN 0100'], ['0160', 'DIN 0160'],
        ['0250', 'DIN 0250'], ['0400', 'DIN 0400'], ['0630', 'DIN 0630'], ['1000', 'DIN 1000']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar', { std: true }], ['D', '60 bar'], ['C', '160 bar'], ['B', '330 bar']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }], ['X', 'With ring magnet']] },
      { key: 'bypass', name: 'Bypass valve', options: [
        ['0', 'Without bypass (standard)', { std: true }], ['3', 'Bypass 1.5 bar'], ['5', 'Bypass 2.5 bar'],
        ['7', 'Bypass 5.0 bar'], ['9', 'Bypass 7.0 bar (preferred)'], ['Bx', 'Other pressure on request', { onReq: true, poa: true }]] },
      { key: 'indicator', name: 'Maintenance indicator type', options: DP_INDICATOR },
      { key: 'cracking', name: 'Indicator cracking pressure', options: DP_CRACKING },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['G05', '3/4" BSP (F)'], ['G06', '1" BSP (F)'], ['G07', '1-1/4" BSP (F)'],
        ['S086', 'SAE flanged 6000 psi 1-1/2"'], ['S096', 'SAE flanged 6000 psi 2"'], ['S106', 'SAE flanged 6000 psi 2-1/2"'],
        ['S12', 'SAE 1-1/16-12UN boss'], ['S16', 'SAE 1-5/16-12UN boss'], ['S20', 'SAE 1-5/8-12UN boss'],
        ['S24', 'SAE 1-7/8-12UN boss'], ['S32', 'SAE 2-1/2-12UN boss'],
        ['X0', 'Special (specify)', { onReq: true, poa: true }], ['RA0', 'With adaptor', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Without (standard)', { std: true }], ['4', '1/4" drain port plugged'], ['DV', 'CS drain valve'], ['DVX', 'SS drain valve']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['LE'] }, allow: ['0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045', '0095', '0145'] },
      { type: 'FILTER', target: 'size', when: { type: ['LEN'] }, allow: ['0040', '0063', '0100', '0160', '0250', '0400', '0630', '1000'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0005', '0008', '0013', '0040', '0063', '0100'] }, allow: ['G05', 'G06', 'S12', 'S16', 'S20', 'S24', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0015', '0018'] }, allow: ['G06', 'S16', 'S20', 'S24', 'S32', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045', '0160', '0250', '0400'] }, allow: ['G07', 'S086', 'S16', 'S20', 'S24', 'S32', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0095', '0630'] }, allow: ['S096'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0145', '1000'] }, allow: ['S106'] },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['250', '450'] }, default: '5.0' },
      { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD'] }, forbid: { cracking: ['-'] }, message: 'A maintenance indicator needs a cracking pressure.' },
      { type: 'COMPOSE', target: 'other', exclusive: [['4', 'DV'], ['4', 'DVX'], ['DV', 'DVX']] },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (2. Series)', codeTemplate: '2.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-{seg:pressure}-{seg:type}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
    ],
  });

  // ============ 4. 40/160-LE/LEN Low/Medium Pressure Inline ============
  seedFamily(db, {
    category: 'FILTERS', code: 'LELM', sort: 40,
    name: '40/160-LE/LEN Low/Medium Pressure Inline Filter',
    description: 'Simplex inline filter, 40/160 bar, up to G1-1/2". Head aluminium alloy, bowl carbon steel.',
    datasheet: 'EPE/02.001/LE Rev.9/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['40', '40 bar'], ['160', '160 bar', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['LE', 'Inline, EPE standard element', { std: true }], ['LEN', 'Inline, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0005', '0005 — 50 lpm'], ['0008', '0008 — 80 lpm'], ['0013', '0013 — 130 lpm', { std: true }],
        ['0015', '0015 — 150 lpm'], ['0018', '0018 — 180 lpm'], ['0020', '0020 — 200 lpm'],
        ['0030', '0030 — 300 lpm'], ['0045', '0045 — 450 lpm'],
        ['0040', 'DIN 0040'], ['0063', 'DIN 0063'], ['0100', 'DIN 0100'], ['0160', 'DIN 0160'], ['0250', 'DIN 0250'], ['0400', 'DIN 0400']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar', { std: true }], ['D', '60 bar'], ['C', '160 bar']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }], ['X', 'With ring magnet (loose under element)']] },
      { key: 'bypass', name: 'Bypass valve', options: BYPASS_FULL },
      { key: 'indicator', name: 'Maintenance indicator type', options: DP_INDICATOR },
      { key: 'cracking', name: 'Indicator cracking pressure', options: DP_CRACKING },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['G06', '1" BSP (F)'], ['G07', '1-1/4" BSP (F)'], ['G08', '1-1/2" BSP (F)'],
        ['S16', 'SAE 1-5/16-12UN boss'], ['S20', 'SAE 1-5/8-12UN boss'], ['S24', 'SAE 1-7/8-12UN boss'],
        ['X0', 'Special (specify)', { onReq: true, poa: true }], ['RA0', 'With adaptor', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Without (standard)', { std: true }], ['EP', 'Air-vent port plugged'], ['E', '1/4" BSP air vent valve'],
        ['4', 'Drain port plugged'], ['DV', 'CS drain valve'], ['DVX', 'SS drain valve'], ['3I', 'Design with 3 mounting inserts']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['LE'] }, allow: ['0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045'] },
      { type: 'FILTER', target: 'size', when: { type: ['LEN'] }, allow: ['0040', '0063', '0100', '0160', '0250', '0400'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0005', '0008', '0013', '0040', '0063', '0100'] }, allow: ['G06', 'S16', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0015', '0018'] }, allow: ['G07', 'S16', 'S20', 'S24', 'X0', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045', '0160', '0250', '0400'] }, allow: ['G08', 'S24', 'X0', 'RA0'] },
      { type: 'DEFAULT', target: 'bypass', when: { pressure: ['40'] }, default: '7' },
      { type: 'DEFAULT', target: 'bypass', when: { pressure: ['160'] }, default: '9' },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['40'] }, default: '2.5' },
      { type: 'DEFAULT', target: 'cracking', when: { pressure: ['160'] }, default: '5.0' },
      { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'D', 'T', 'AD', 'BD', 'DD'] }, forbid: { cracking: ['-'] }, message: 'A maintenance indicator needs a cracking pressure.' },
      { type: 'COMPOSE', target: 'other', exclusive: [['EP', 'E'], ['4', 'DV'], ['4', 'DVX'], ['DV', 'DVX']] },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (2. Series)', codeTemplate: '2.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-{seg:pressure}-{seg:type}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
    ],
  });

  // ============ 5. 160-OFM20X Heavy Duty Inline ============
  seedFamily(db, {
    category: 'FILTERS', code: 'OFM20X', sort: 50,
    name: '160-OFM20X Heavy Duty Inline Filter',
    description: 'Simplex inline heavy-duty filter, radial-sealed bowl for leak-free jointing. 160 bar, SAE 1-1/2"/G1-1/2".',
    datasheet: 'EPE/02.002/OFM20X Rev.5/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['160', '160 bar [2321 psi]', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['OFM20X', 'Heavy-duty inline, EPE standard element', { std: true }]] },
      { key: 'size', name: 'Nominal size', options: [['0020', '0020 — 200 lpm'], ['0030', '0030 — 300 lpm', { std: true }], ['0045', '0045 — 450 lpm']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar', { std: true }], ['D', '60 bar'], ['C', '160 bar']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }]] },
      { key: 'bypass', name: 'Bypass valve', options: BYPASS_FULL },
      { key: 'indicator', name: 'Maintenance indicator type', options: [
        ['0', 'Without indicator', { std: true }],
        ['A', 'DP optical pop-up'], ['B', 'DP optical + electrical DIN plug'], ['D', 'DP optical + electrical lamp'],
        ['T', 'DP optical + electrical, 2 switching points'],
        ['PSD', 'Pressure switch NO / closer (Hxx-HS-32-00-P)'], ['PSF', 'Pressure switch NC / opener (Hxx-HA-32-00-P)'],
        ['PSG', 'Pressure switch change-over (Hxx-GW-33-00-P)'], ['PSK', 'Optical + electrical switch-over + lamp (Hxx-GS-34-00-P)']] },
      { key: 'cracking', name: 'Indicator cracking pressure', options: DP_CRACKING },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['G08', '1-1/2" BSP (F) (standard)', { std: true }], ['SOU', 'SAE 1-1/2" 3000 psi, UNC threads'],
        ['SOM', 'SAE 1-1/2" 3000 psi, metric threads'], ['S24', 'SAE 1-7/8-12UN J1926/1'], ['RA0', 'With adaptor', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['IL', 'Design 1: inlet left, indicator front (standard)', { std: true }], ['IR', 'Design 2: inlet right, indicator front'],
        ['0', 'Without indicator ports'], ['EP', 'Air-vent port plugged'], ['E', 'Air vent valve'], ['4', 'Drain port plugged']] },
    ],
    rules: [
      { type: 'DEFAULT', target: 'cracking', when: { indicator: ['PSD', 'PSF', 'PSG', 'PSK'] }, default: '2.5', note: 'pressure-switch indicator family default' },
      { type: 'DEFAULT', target: 'cracking', when: { indicator: ['A', 'B', 'D', 'T'] }, default: '5.0', note: 'DP indicator family default' },
      { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'D', 'T', 'PSD', 'PSF', 'PSG', 'PSK'] }, forbid: { cracking: ['-'] }, message: 'An indicator needs a cracking pressure.' },
      { type: 'COMPOSE', target: 'other', exclusive: [['IL', 'IR'], ['EP', 'E']] },
      { type: 'DERIVE', when: { pressure: ['160'] }, facts: { 'Recommended initial ΔP': '0.8 bar', 'Bowl-to-head torque': '40 Nm' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (2. Series)', codeTemplate: '2.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-160-OFM20X-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
      { relation: 'spare', when: { bypass: ['1', '2', '3', '4', '5', '6', '7', '8', '9'] }, label: 'Spare bypass valve', partNumber: 'BYP03/xx' },
    ],
  });

  // ============ 6. 16-FR/L Return Line ============
  seedFamily(db, {
    category: 'FILTERS', code: 'FRL', sort: 60,
    name: '16-FR/L / FR/LN Returnline Inline Filter (tank-top/line)',
    description: 'Simplex tank-top or line-mounted return-line filter; bypass in top cover. 16 bar, up to SAE 4". Aluminium alloy.',
    datasheet: 'EPE/07.002/FRL Rev.4/09-2024',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['16', '16 bar [232 psi]', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['FR/L', 'Return line, EPE standard element', { std: true }], ['FR/LN', 'Return line, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0020', '0020 — 200 lpm'], ['0030', '0030 — 300 lpm'], ['0045', '0045 — 450 lpm', { std: true }],
        ['0060', '0060 — 600 lpm'], ['0095', '0095 — 950 lpm'], ['0120', '0120 — 1200 lpm'],
        ['0145', '0145 — 1450 lpm'], ['0200', '0200 — 2000 lpm'], ['0270', '0270 — 2700 lpm'],
        ['0160', 'DIN 0160 — 200 lpm'], ['0250', 'DIN 0250 — 300 lpm'], ['0400', 'DIN 0400 — 600 lpm'],
        ['0630', 'DIN 0630 — 950 lpm'], ['1000', 'DIN 1000 — 1450 lpm']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar (sizes 0020–0120)', { std: true }], ['0', '15 bar (sizes 0145–0270)']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }]] },
      { key: 'bypass', name: 'Bypass valve (in top cover)', options: [
        ['0', 'Without bypass'], ['7', 'Bypass 3.5 bar (standard)', { std: true }], ['Bx', 'Other on request', { onReq: true, poa: true }]] },
      { key: 'indicator', name: 'Maintenance indicator type', options: RL_INDICATOR },
      { key: 'cracking', name: 'Indicator cracking pressure', options: [
        ['-', 'Without / not applicable (std for A, B)', { std: true }], ['2.5', '2.5 bar (std for C/D/F/G/K)'],
        ['0.8', '0.8 bar'], ['1.5', '1.5 bar'], ['5.0', '5.0 bar']] },
      { key: 'connection', name: 'Inlet connection', options: [
        ['G07', '1-1/4" BSP (F)'], ['G08', '1-1/2" BSP (F)'],
        ['S073', 'SAE 3000 psi flange 1-1/4"'], ['S083', 'SAE 3000 psi flange 1-1/2"'], ['S093', 'SAE 3000 psi flange 2"'],
        ['S103', 'SAE 3000 psi flange 2-1/2"'], ['S113', 'SAE 3000 psi flange 3"'], ['S133', 'SAE 3000 psi flange 4"'],
        ['S16', 'SAE 1-5/16-12UN boss'], ['S20', 'SAE 1-5/8-12UN boss'], ['S24', 'SAE 1-7/8-12UN boss'],
        ['S32', 'SAE 2-1/2-12UN boss'], ['S40', 'SAE 3-12UN boss'], ['RA0', 'With adaptor', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
      { key: 'housing', name: 'Housing material', options: HOUSING_STD },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Without (standard)', { std: true }], ['EP', 'Air-vent port plugged'], ['E', '1/4" BSP air vent valve'], ['H', 'Element with handle']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['FR/L'] }, allow: ['0020', '0030', '0045', '0060', '0095', '0120', '0145', '0200', '0270'] },
      { type: 'FILTER', target: 'size', when: { type: ['FR/LN'] }, allow: ['0160', '0250', '0400', '0630', '1000'] },
      { type: 'FILTER', target: 'dp', when: { size: ['0020', '0030', '0045', '0060', '0095', '0120', '0160', '0250', '0400', '0630'] }, allow: ['A'] },
      { type: 'FILTER', target: 'dp', when: { size: ['0145', '0200', '0270', '1000'] }, allow: ['0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045', '0160', '0250'] }, allow: ['G07', 'G08', 'S073', 'S083', 'S16', 'S20', 'S24', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0060', '0095', '0120', '0400', '0630'] }, allow: ['S093', 'RA0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0145', '0200', '0270', '1000'] }, allow: ['S103', 'S113', 'S133', 'S32', 'S40', 'RA0'] },
      { type: 'DEFAULT', target: 'cracking', when: { indicator: ['C', 'D', 'F', 'G', 'K'] }, default: '2.5' },
      { type: 'DEFAULT', target: 'cracking', when: { indicator: ['A', 'B'] }, default: '-' },
      { type: 'DERIVE', when: { pressure: ['16'] }, facts: { 'Recommended initial ΔP': '0.8 bar', 'Inlet torque': '80 Nm' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (1. Series)', codeTemplate: '1.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-16-{seg:type}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0' },
    ],
  });

  // ============ 7/8. 10-FRE / 10-FRD Return line tank-top (simplex & duplex) ============
  for (const [code, name, sort, desc] of [
    ['FRE', '10-FRE Return Line Filter (tank-top, simplex)', 70, 'Simplex tank-top return-line filter, optional integral breather. 10 bar, up to 1-1/2" BSP(F). Aluminium head, carbon-reinforced plastic cover/bowl.'],
    ['FRD', '10-FRD Duplex Return Line Filter (tank-top)', 80, 'Duplex tank-top return-line filter: two simplex housings joined by a 3-way ball valve for continuous operation; optional integral breather. 10 bar.'],
  ]) {
    seedFamily(db, {
      category: 'FILTERS', code, sort, name, description: desc,
      datasheet: code === 'FRE' ? 'EPE/07.001/FRE Rev.5/09-2024' : 'EPE/08.001/FRD Rev.3/09-2024',
      template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
      segments: [
        { key: 'pressure', name: 'Max working pressure', options: [['10', '10 bar [145 psi]', { std: true }]] },
        { key: 'type', name: 'Filter type', options: [[code, name, { std: true }]] },
        { key: 'size', name: 'Nominal size (N = no bypass, B = with bypass in element)', options: [
          ['0005N', '0005 without bypass — 50 lpm'], ['0008N', '0008 without bypass — 80 lpm'],
          ['0013N', '0013 without bypass — 130 lpm', { std: true }], ['0015N', '0015 without bypass — 150 lpm'], ['0018N', '0018 without bypass — 180 lpm'],
          ['0005B', '0005 with bypass — 50 lpm'], ['0008B', '0008 with bypass — 80 lpm'],
          ['0013B', '0013 with bypass — 130 lpm'], ['0015B', '0015 with bypass — 150 lpm'], ['0018B', '0018 with bypass — 180 lpm']] },
        mediaSeg(),
        { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar (standard, only option)', { std: true }]] },
        { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
        { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D') },
        { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }]] },
        { key: 'bypass', name: 'Bypass valve (assembled in element)', options: [
          ['0', 'Without bypass (…N sizes)', { std: true }], ['7', 'Bypass 3.5 bar (…B sizes)'], ['Bx', 'Other on request', { onReq: true, poa: true }]] },
        { key: 'indicator', name: 'Maintenance indicator type', options: RL_INDICATOR },
        { key: 'cracking', name: 'Indicator cracking pressure', options: [
          ['-', 'Without / not applicable', { std: true }], ['2.5', '2.5 bar (std for C/D/F/G/K)'], ['1.5', '1.5 bar'], ['0.8', '0.8 bar']] },
        { key: 'connection', name: 'Inlet connection', options: [
          ['G05', '3/4" BSP (F) — sizes 0005–0013'], ['G06', '1" BSP (F) — sizes 0005–0013', { std: true }],
          ['G07', '1-1/4" BSP (F) — sizes 0015–0018'], ['G08', '1-1/2" BSP (F) — sizes 0015–0018'],
          ['S12', 'SAE 1-1/16-12UN boss'], ['S20', 'SAE 1-5/8-12UN boss'], ['RA0', 'With adaptor', { onReq: true, poa: true }]] },
        { key: 'seal', name: 'Seal material', options: SEALS_PVENB },
        { key: 'housing', name: 'Housing material', options: HOUSING_STD },
        { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
          ['0', 'Without (standard)', { std: true }], ['EP', 'Air-vent port plugged (versions w/o indicator)'],
          ['E', 'Air vent valve (versions w/o indicator)'], ['F', 'With breather filter']] },
      ],
      rules: [
        { type: 'CONSTRAINT', when: { size: ['0005N', '0008N', '0013N', '0015N', '0018N'] }, require: { bypass: ['0'] }, message: '…N sizes are without bypass — bypass position must be 0.' },
        { type: 'CONSTRAINT', when: { size: ['0005B', '0008B', '0013B', '0015B', '0018B'] }, require: { bypass: ['7', 'Bx'] }, message: '…B sizes include the bypass — select bypass 7 (3.5 bar) or special.' },
        { type: 'DEFAULT', target: 'bypass', when: { size: ['0005B', '0008B', '0013B', '0015B', '0018B'] }, default: '7' },
        { type: 'FILTER', target: 'connection', when: { size: ['0005N', '0008N', '0013N', '0005B', '0008B', '0013B'] }, allow: ['G05', 'G06', 'S12', 'RA0'] },
        { type: 'FILTER', target: 'connection', when: { size: ['0015N', '0018N', '0015B', '0018B'] }, allow: ['G07', 'G08', 'S20', 'RA0'] },
        { type: 'DEFAULT', target: 'cracking', when: { indicator: ['C', 'D', 'F', 'G', 'K'] }, default: '2.5' },
        { type: 'CONSTRAINT', when: { indicator: ['A', 'B', 'C', 'D', 'F', 'G', 'K'] }, forbid: { other: ['EP', 'E'] }, message: 'Air-vent options EP/E are only for versions without indicator.' },
        { type: 'COMPOSE', target: 'other', exclusive: [['EP', 'E']] },
      ],
      links: [
        { relation: 'spare', label: 'Replacement filter element (1. Series, carries bypass)', codeTemplate: '1.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-{seg:bypass}-{seg:seal}' },
        { relation: 'spare', label: 'Seal kit', codeTemplate: `D-10-${code}-{seg:size}-{seg:indicator}-{seg:connection}-{seg:seal}-0` },
        { relation: 'accessory', when: { other: ['F'] }, label: 'Breather element (7. Series)', partNumber: '7.0003-P10-0-00-0-0' },
        { relation: 'spare', when: { size: ['0005B', '0008B', '0013B'] }, label: 'Spare bypass valve', partNumber: 'BYP-FRE-01/xx' },
        { relation: 'spare', when: { size: ['0015B', '0018B'] }, label: 'Spare bypass valve', partNumber: 'BYP-FRE-02/xx' },
      ],
    });
  }

  // ============ 9. 40-FLE Inline (offline duty) ============
  seedFamily(db, {
    category: 'FILTERS', code: 'FLE', sort: 90,
    name: '40-FLE / FLEN Inline Filter (offline filtration duty)',
    description: 'Modular 3-part inline filter designed for offline filtration; ECO Pore elements, coreless "C" variants. 40 bar, up to SAE 4".',
    datasheet: 'EPE/40-FLE/R.01 (01-12)',
    template: { separator: ' ' },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['40', '40 bar', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['FLE', 'Inline, EPE standard element', { std: true }], ['FLEN', 'Inline, DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0020', '0020 — 200 lpm'], ['0020C', '0020 coreless'], ['0030', '0030'], ['0030C', '0030 coreless'],
        ['0045', '0045'], ['0045C', '0045 coreless'], ['0060', '0060'], ['0060C', '0060 coreless'],
        ['0095', '0095'], ['0095C', '0095 coreless'], ['0120', '0120'], ['0120C', '0120 coreless'],
        ['0145', '0145'], ['0145C', '0145 coreless'], ['0200', '0200'], ['0200C', '0200 coreless'],
        ['0270', '0270', { std: true }], ['0270C', '0270 coreless'],
        ['0160', 'DIN 0160'], ['0250', 'DIN 0250'], ['0400', 'DIN 0400'], ['0630', 'DIN 0630'], ['1000', 'DIN 1000']] },
      { key: 'media', name: 'Filter media & grade', options: MEDIA.filter(([c]) => !c.startsWith('H3XP') && !c.includes('XE') && !c.includes('XC') && !c.startsWith('M') && c !== 'VS10' && !c.startsWith('H5') && !c.startsWith('H10XP') && !c.startsWith('H15') && !c.startsWith('H20XP')).map(([c, l]) => [c, l, c === 'H10XL' ? { std: true } : undefined]) },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }]] },
      { key: 'indicator', name: 'Maintenance indicator', options: [
        ['0', 'Without', { std: true }], ['A', 'Visual indicator'], ['B', 'Visual/electrical with plug'],
        ['D', 'Visual/electrical, signal lights, 2 switching points']] },
      { key: 'dp', name: 'Differential pressure (element)', options: [['A', '30 bar', { std: true }], ['0', '15 bar (only 0145/0200/0270)']] },
      { key: 'elementmodel', name: 'Element model', options: [
        ['0-O', 'Standard adhesive T=150 °C, standard material', { std: true }], ['0-Z', 'Standard adhesive, zinc free'],
        ['E-O', 'Special adhesive T=160 °C, standard material'], ['E-Z', 'Special adhesive, zinc free']] },
      { key: 'bypass', name: 'Bypass valve (in housing)', options: [['0', 'Without', { std: true }], ['7', 'Bypass 3.5 bar']] },
      { key: 'connection', name: 'Connection', options: [['S0', 'SAE flange 3000 psi (3" or 4" per size)', { std: true }]] },
      { key: 'seal', name: 'Seal material', options: [['P', 'Buna-N / Nitrile', { std: true }], ['V', 'Viton'], ['E', 'Ethylene-propylene'], ['N', 'Neoprene']] },
      { key: 'material', name: 'Material', options: [['0', 'Standard', { std: true }]] },
      { key: 'other', name: 'Additional info', type: 'multi', required: false, options: [
        ['0', 'Without', { std: true }], ['1', "'A' indicator for FLE 0145–0270"], ['2', "'B' indicator for FLE 0145–0270"],
        ['5', 'Silicon free'], ['B', 'Using clamp'], ['E', 'Vent valve'], ['Z', 'Documentation']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['FLEN'] }, allow: ['0160', '0250', '0400', '0630', '1000'] },
      { type: 'FILTER', target: 'size', when: { type: ['FLE'] }, allow: ['0020', '0020C', '0030', '0030C', '0045', '0045C', '0060', '0060C', '0095', '0095C', '0120', '0120C', '0145', '0145C', '0200', '0200C', '0270', '0270C'] },
      { type: 'FILTER', target: 'dp', when: { size: ['0020', '0020C', '0030', '0030C', '0045', '0045C', '0060', '0060C', '0095', '0095C', '0120', '0120C', '0160', '0250', '0400', '0630'] }, allow: ['A'] },
      { type: 'DERIVE', when: { size: ['0145', '0145C', '0200', '0200C', '0270', '0270C', '1000'] }, facts: { 'Connection detail': 'SAE 4"/3000 psi flange (DN80–DN100)' } },
      { type: 'DERIVE', when: { size: ['0020', '0030', '0045', '0060', '0095', '0120', '0160', '0250', '0400', '0630'] }, facts: { 'Connection detail': 'SAE 3"/3000 psi flange (DN50)' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (1. Series)', codeTemplate: '1.{seg:size} {seg:media}-{seg:dp} 00-0 {seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D 40 {seg:type} {seg:size} - {seg:indicator} - {seg:connection} {seg:seal} 0' },
    ],
  });

  // ============ 10. DK large duplex ============
  seedFamily(db, {
    category: 'FILTERS', code: 'DK', sort: 100,
    name: '16/40/45/60-DK Duplex Filter (ball-valve changeover)',
    description: 'Large fabricated duplex filter: two vertical housings + coupled 3-way ball valves with pressure-equalisation valve. Up to 6" ANSI, housing CS or SS.',
    datasheet: 'EPE/06.001/DK Rev.3/08-2023',
    template: { separator: '-', joins: [['adhesive', 'hardware'], ['indicator', 'cracking']] },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['16', '16 bar'], ['40', '40 bar'], ['45', '45 bar'], ['60', '60 bar', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['DK', 'Duplex, EPE standard element', { std: true }]] },
      { key: 'size', name: 'Nominal size', options: [
        ['0020', '0020 — 200 lpm'], ['0030', '0030 — 300 lpm'], ['0045', '0045 — 450 lpm', { std: true }],
        ['0060', '0060 — 600 lpm'], ['0095', '0095 — 950 lpm'], ['0120', '0120 — 1200 lpm'],
        ['0145', '0145 — 1450 lpm'], ['0200', '0200 — 2000 lpm'], ['0270', '0270 — 2700 lpm'], ['0297', '0297 — 2950 lpm']] },
      mediaSeg(),
      { key: 'dp', name: 'Differential pressure of element', options: [['A', '30 bar (std 0020–0120)', { std: true }], ['0', '15 bar (std 0145 and above)']] },
      { key: 'adhesive', name: 'Element adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Element hardware', options: hw('C', 'P', 'X', 'D', 'M') },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without magnet', { std: true }], ['2', 'With magnet']] },
      { key: 'bypass', name: 'Bypass valve', options: [
        ['0', 'Without (standard)', { std: true }], ['7', 'Bypass 3.5 bar'], ['9', 'Bypass 7.0 bar'], ['Bx', 'Other on request', { onReq: true, poa: true }]] },
      { key: 'indicator', name: 'Maintenance indicator type (multiple allowed)', type: 'multi', required: false, options: [
        ['0', 'Without', { std: true }], ['A', 'Optical pop-up'], ['B', 'Optical + electrical DIN plug'],
        ['D', 'Optical + electrical lamp'], ['T', 'Optical + electrical, 2 switching points'],
        ['AD', 'Optical dual dial'], ['BD', 'Dual dial + electrical DIN plug'], ['DD', 'Dual dial + electrical lamp'],
        ['G', 'DP gauge'], ['S', 'DP switch'], ['X', 'DP gauge cum switch']] },
      { key: 'cracking', name: 'Indicator cracking pressure', options: [
        ['-', 'Without', { std: true }], ['2.5', '2.5 bar (for 3.5 bar bypass)'], ['5.0', '5.0 bar (for 7.0 bar bypass)'],
        ['1.5', '1.5 bar'], ['4.2', '4.2 bar']] },
      { key: 'connection', name: 'Inlet/outlet connections', options: [
        ['S093', 'SAE 3000 psi 2" (sizes 0020–0045)'], ['S103', 'SAE 3000 psi 2-1/2" (0060–0120)'],
        ['S113', 'SAE 3000 psi 3" (0060–0120)'], ['S133', 'SAE 3000 psi 4" (0145–0297)'],
        ['A171', 'ANSI Class 150 6" (0297)'], ['A172', 'ANSI Class 300 6" (0297)'],
        ['X0', 'Others (specify)', { onReq: true, poa: true }]] },
      { key: 'seal', name: 'Seal material', options: SEALS_PVE },
      { key: 'housing', name: 'Housing material', options: [
        ['0', 'Carbon steel (standard)', { std: true }], ['N', 'Nickel-coated carbon steel'], ['X', 'Stainless steel']] },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['0', 'Vent & drain ports plugged (standard)', { std: true }], ['E', 'Air vent valve'], ['DV', 'CS drain valve'],
        ['H', 'Element with handle'], ['MF', 'Inlet/outlet with mating flanges'], ['FB', 'Foundation bolts'],
        ['SP', 'Special requirements', { onReq: true, poa: true }]] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { pressure: ['60'] }, allow: ['0020', '0030', '0045'] },
      { type: 'FILTER', target: 'size', when: { pressure: ['45'] }, allow: ['0020', '0030', '0045', '0060', '0095', '0120', '0145', '0200', '0270'] },
      { type: 'FILTER', target: 'size', when: { pressure: ['40'] }, allow: ['0297'] },
      // 16 bar allows all sizes -> no rule needed (null = all)
      { type: 'FILTER', target: 'connection', when: { size: ['0020', '0030', '0045'] }, allow: ['S093', 'X0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0060', '0095', '0120'] }, allow: ['S103', 'S113', 'X0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0145', '0200', '0270'] }, allow: ['S133', 'X0'] },
      { type: 'FILTER', target: 'connection', when: { size: ['0297'] }, allow: ['S133', 'A171', 'A172', 'X0'] },
      { type: 'DEFAULT', target: 'dp', when: { size: ['0145', '0200', '0270', '0297'] }, default: '0' },
      { type: 'DEFAULT', target: 'cracking', when: { bypass: ['7'] }, default: '2.5' },
      { type: 'DEFAULT', target: 'cracking', when: { bypass: ['9'] }, default: '5.0' },
      { type: 'DERIVE', when: { size: ['0297'] }, facts: { 'Drain port': 'G1"', 'Vent port': 'G1/2"' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement filter element (1. Series)', codeTemplate: '1.{seg:size}-{seg:media}-{seg:dp}-{seg:adhesive}{seg:hardware}-0-{seg:seal}' },
      { relation: 'spare', label: 'Seal kit', codeTemplate: 'D-{seg:pressure}-DK-{seg:size}-{seg:dp}-{seg:connection}-{seg:seal}-0' },
    ],
  });

  // ============ 11. TLF Breathers ============
  seedFamily(db, {
    category: 'FILTERS', code: 'TLF', sort: 110,
    name: 'TLF I/II/III Filler Breathers',
    description: 'Tank-mounted air breather / combined breather-filler filters; air flow up to 5000 m³/h, connection up to G3/DN125. TLF III includes DIN flange + filler strainer.',
    datasheet: 'EPE/TLF/01 R.02 (01-12)',
    template: { separator: ' ' },
    segments: [
      { key: 'type', name: 'Filter type', options: [
        ['TLF I', 'Female thread connection'], ['TLF II', 'Male thread connection'],
        ['TLF III', 'Male thread + DIN flange + filler strainer', { std: true }]] },
      { key: 'size', name: 'Nominal size', options: [
        ['1-25', 'Size 1 — G1'], ['2-32', 'Size 2 — G1-1/4'], ['3-40', 'Size 3 — G1-1/2'],
        ['4-50', 'Size 4 — G2'], ['5-65', 'Size 5 — G2-1/2'], ['6-80', 'Size 6 — G3'],
        ['7-125', 'Size 7 — DN125 (TLF I & III only)', { std: true }]] },
      { key: 'media', name: 'Filtration grade', options: MEDIA.filter(([c]) => ['G10','G25','G40','G60','G80','G100','VS25','VS40','VS60','P5','P10','P25','H1XL','H3XL','H6XL','H10XL','H20XL','AS1','AS3','AS6','AS10','AS20'].includes(c)).map(([c, l]) => [c, l, c === 'P10' ? { std: true } : undefined]) },
      { key: 'magnet', name: 'Magnet', options: [['0', 'Without', { std: true }]] },
      { key: 'indicator', name: 'Maintenance indicator', options: [['0', 'Without (replace on service schedule)', { std: true }]] },
      { key: 'dp', name: 'Differential pressure', options: [['S', 'Standard', { std: true }]] },
      { key: 'elementmodel', name: 'Element design', options: [
        ['0-0', 'Standard adhesive T=80 °C, standard material', { std: true }], ['0-Z', 'Standard adhesive, zinc free']] },
      { key: 'bypass', name: 'Bypass valve', options: [['0', 'Without', { std: true }]] },
      { key: 'connection', name: 'Connection', options: [['00', 'Standard', { std: true }]] },
      { key: 'seal', name: 'Seal', options: [['O', 'Without seal', { std: true }], ['P', 'Buna-N']] },
      { key: 'material', name: 'Material', options: [['0', 'Standard', { std: true }]] },
      { key: 'other', name: 'Additional info', type: 'multi', required: false, options: [
        ['0', 'Without', { std: true }], ['5', 'Silicon free'], ['E', 'Vent valve'], ['Z', 'Inspection certificate'], ['C', 'Silicagel (element)']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['TLF II'] }, allow: ['1-25', '2-32', '3-40', '4-50', '5-65', '6-80'], note: '7-125 not available for TLF II' },
      { type: 'DERIVE', when: { size: ['1-25'] }, facts: { 'Breather element size': '002 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['2-32'] }, facts: { 'Breather element size': '002 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['3-40'] }, facts: { 'Breather element size': '004 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['4-50'] }, facts: { 'Breather element size': '004 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['5-65'] }, facts: { 'Breather element size': '004 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['6-80'] }, facts: { 'Breather element size': '006 (7. Series)' } },
      { type: 'DERIVE', when: { size: ['7-125'] }, facts: { 'Breather element size': '007 (7. Series)', 'Service interval': '3000–4000 h by environment' } },
    ],
    links: [
      { relation: 'spare', when: { size: ['1-25', '2-32'] }, label: 'Breather element', codeTemplate: '7.002-{seg:media}-S-00-0-{seg:seal}' },
      { relation: 'spare', when: { size: ['3-40', '4-50', '5-65'] }, label: 'Breather element', codeTemplate: '7.004-{seg:media}-S-00-0-{seg:seal}' },
      { relation: 'spare', when: { size: ['6-80'] }, label: 'Breather element', codeTemplate: '7.006-{seg:media}-S-00-0-{seg:seal}' },
      { relation: 'spare', when: { size: ['7-125'] }, label: 'Breather element', codeTemplate: '7.007-{seg:media}-S-00-0-{seg:seal}' },
    ],
  });

  // ============ 12. Filter Elements master ============
  seedFamily(db, {
    category: 'FILTERS', code: 'ELEMENTS', sort: 120,
    name: 'Filter Elements (1./2./3./7. Series)',
    description: 'Replacement/OEM filter elements for all EPE housings. Star-pleated media, 1–1500 µm, βx = 1000.',
    datasheet: 'EPE/10.001 Rev.7/09-2024',
    template: { separator: '-', prefix: '' },
    segments: [
      { key: 'series', name: 'Element series', options: [
        ['1', '1. Series — both sides open', { std: true }], ['2', '2. Series — one side open'],
        ['3', '3. Series — one side open with bypass'], ['7', '7. Series — both open, PU end caps (breathers)']] },
      { key: 'size', name: 'Nominal size', prefix: '', options: [
        ['0003', '0003 (2./3. Series, FRE-0003)'], ['0004', '0004 (2. Series)'], ['0005', '0005'], ['0008', '0008'],
        ['0013', '0013', { std: true }], ['0015', '0015'], ['0018', '0018'], ['0020', '0020'], ['0030', '0030'],
        ['0045', '0045'], ['0060', '0060'], ['0095', '0095'], ['0120', '0120'], ['0145', '0145'], ['0200', '0200'],
        ['0270', '0270'], ['0297', '0297'],
        ['0020C', '0020 coreless'], ['0030C', '0030 coreless'], ['0045C', '0045 coreless'], ['0060C', '0060 coreless'],
        ['0095C', '0095 coreless'], ['0120C', '0120 coreless'], ['0145C', '0145 coreless'], ['0200C', '0200 coreless'], ['0270C', '0270 coreless'],
        ['0040', 'DIN 0040'], ['0063', 'DIN 0063'], ['0100', 'DIN 0100'], ['0160', 'DIN 0160'], ['0250', 'DIN 0250'],
        ['0400', 'DIN 0400'], ['0630', 'DIN 0630'], ['1000', 'DIN 1000'],
        ['0005B', '0005 one-open with bypass'], ['0008B', '0008B'], ['0013B', '0013B'], ['0015B', '0015B'], ['0018B', '0018B'],
        ['0005N', '0005 one-open w/o bypass'], ['0008N', '0008N'], ['0013N', '0013N'], ['0015N', '0015N'], ['0018N', '0018N'],
        ['001', 'Breather 001'], ['002', 'Breather 002'], ['004', 'Breather 004'], ['006', 'Breather 006'], ['007', 'Breather 007']] },
      { key: 'media', name: 'Media & grade', options: MEDIA.map(([c, l]) => [c, l, c === 'H10XL' ? { std: true } : undefined]) },
      { key: 'dp', name: 'Differential pressure', options: [
        ['A', '30 bar (standard)', { std: true }], ['0', '15 bar (1.0145/0200/0270/0297/1000)'],
        ['D', '60 bar'], ['C', '160 bar'], ['B', '330 bar'], ['S', 'Standard (breather elements)']] },
      { key: 'adhesive', name: 'Adhesive', options: ADHESIVE },
      { key: 'hardware', name: 'Hardware', options: [HARDWARE.C, HARDWARE.P, HARDWARE.U, HARDWARE.X, HARDWARE.D, HARDWARE.M] },
      { key: 'bypass', name: 'Bypass valve', options: [['0', 'Without (standard)', { std: true }], ['7', '3.5 bar (only …B and 3.0003 designs)']] },
      { key: 'seal', name: 'Seal material', options: [
        ['P', 'Nitrile (standard)', { std: true }], ['V', 'Viton'], ['E', 'EPDM'], ['N', 'Neoprene'], ['B', 'Butyl'],
        ['0', 'Without seal (unsealed & breather designs)']] },
      { key: 'other', name: 'Other options', type: 'multi', required: false, options: [
        ['-', 'Without (standard)', { std: true }], ['H', 'With handle'], ['Sp', 'Special', { onReq: true, poa: true }]] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { series: ['3'] }, allow: ['0003'] },
      { type: 'FILTER', target: 'size', when: { series: ['7'] }, allow: ['001', '002', '004', '006', '007'] },
      { type: 'FILTER', target: 'size', when: { series: ['2'] }, allow: ['0003', '0004', '0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045', '0095', '0145', '0040', '0063', '0100', '0160', '0250', '0400', '0630', '1000'] },
      { type: 'FILTER', target: 'size', when: { series: ['1'] }, allow: ['0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045', '0060', '0095', '0120', '0145', '0200', '0270', '0297', '0020C', '0030C', '0045C', '0060C', '0095C', '0120C', '0145C', '0200C', '0270C', '0040', '0063', '0100', '0160', '0250', '0400', '0630', '1000', '0005B', '0008B', '0013B', '0015B', '0018B', '0005N', '0008N', '0013N', '0015N', '0018N'] },
      { type: 'FILTER', target: 'bypass', when: { size: ['0005B', '0008B', '0013B', '0015B', '0018B', '0003'] }, allow: ['0', '7'] },
      { type: 'FILTER', target: 'bypass', when: { size: ['0005', '0008', '0013', '0015', '0018', '0020', '0030', '0045', '0060', '0095', '0120', '0145', '0200', '0270', '0297', '0040', '0063', '0100', '0160', '0250', '0400', '0630', '1000'] }, allow: ['0'] },
      { type: 'DEFAULT', target: 'dp', when: { size: ['0145', '0200', '0270', '0297', '1000'] }, default: '0' },
      { type: 'DEFAULT', target: 'dp', when: { series: ['7'] }, default: 'S' },
      { type: 'DEFAULT', target: 'hardware', when: { series: ['7'] }, default: 'U' },
      { type: 'DEFAULT', target: 'seal', when: { series: ['7'] }, default: '0' },
      { type: 'DERIVE', when: { media: ['H1XL'] }, facts: { 'Achievable cleanliness': 'ISO ≤16/12/9 (NAS 3) — servo systems' } },
      { type: 'DERIVE', when: { media: ['H3XL'] }, facts: { 'Achievable cleanliness': 'ISO ≤18/13/10 — servo valves' } },
      { type: 'DERIVE', when: { media: ['H10XL'] }, facts: { 'Achievable cleanliness': 'ISO ≤20/16/13 — industrial directional valves' } },
      { type: 'DERIVE', when: { media: ['AS1', 'AS3', 'AS6', 'AS10', 'AS20'] }, facts: { 'Aquasorb usage': 'Bypass duty <5 bar; change at ΔP 1.5 bar' } },
    ],
  });

  // ============ 13. 25-FLD large duplex (simple) ============
  seedFamily(db, {
    category: 'FILTERS', code: 'FLD25', sort: 130,
    name: '25-FLD / FLDN Duplex Filter (segment change-over)',
    description: 'Large duplex filter: two inline filters via control housing with segment change-over. 25 bar, up to 2700 lpm, DN-100 square flange.',
    datasheet: 'EPE/25-FLD Rev.0/08-2018',
    template: { separator: ' ' },
    segments: [
      { key: 'pressure', name: 'Max working pressure', options: [['25', '25 bar', { std: true }]] },
      { key: 'type', name: 'Filter type', options: [['FLD', 'EPE standard element', { std: true }], ['FLDN', 'DIN 24550 element']] },
      { key: 'size', name: 'Nominal size', options: [
        ['0145', '0145 — 2×12 L, 122 kg'], ['0200', '0200 — 2×22 L, 168 kg'], ['0270', '0270 — 2×28 L, 200 kg', { std: true }], ['1000', 'DIN 1000 — 2×12 L']] },
      { key: 'media', name: 'Element media & grade', options: MEDIA.filter(([c]) => ['G10','G25','G40','G60','H3XL','H10XL','H20XL','P10','P25','AS10'].includes(c)).map(([c, l]) => [c, l, c === 'H10XL' ? { std: true } : undefined]) },
      { key: 'indicator', name: 'Maintenance indicator', options: [
        ['0', 'Without', { std: true }], ['OPT', 'Optical'], ['OE', 'Optical-electrical'], ['GA', 'DP gauge'], ['SW', 'DP switch']] },
      { key: 'other', name: 'Optional accessories', type: 'multi', required: false, options: [
        ['0', 'None', { std: true }], ['BY', 'Bypass valve'], ['AV', 'Air-release/vent valve'], ['DV', 'Drain valve']] },
    ],
    rules: [
      { type: 'FILTER', target: 'size', when: { type: ['FLD'] }, allow: ['0145', '0200', '0270'] },
      { type: 'FILTER', target: 'size', when: { type: ['FLDN'] }, allow: ['1000'] },
      { type: 'DERIVE', when: { type: ['FLD', 'FLDN'] }, facts: { 'Element ΔP class': '0 = 15 bar (1. Series large sizes)' } },
    ],
    links: [
      { relation: 'spare', label: 'Replacement element (1. Series)', codeTemplate: '1.{seg:size}-{seg:media}-0-0P-0-P' },
    ],
  });

  // ============ 14. NFF2 offline systems (fixed BOM) ============
  seedFamily(db, {
    category: 'SYSTEMS', code: 'NFF2', sort: 10,
    name: 'NFF2 Offline Filtration Systems (mobile carts)',
    description: 'Mobile filtration carts with motor-pump and EPE filters for offline/kidney-loop filtration. 10–170 l/min, max 8 bar, 415 V/50 Hz. Each model is a fixed BOM.',
    datasheet: 'Offline-System-NFF2 (Nov-11)',
    template: { separator: ' ' },
    segments: [
      { key: 'model', name: 'System model', options: [
        ['15 NFF2 0020', '15 l/min — 40 FLE 0020 main filter, 1 HP, 2 wheels'],
        ['20 NFF2 0020', '20 l/min — 40 FLE 0020 main filter, 1 HP, 2 wheels'],
        ['40 NFF2 0045', '40 l/min — 40 FLE 0045 main filter, 1.5 HP, 2 wheels', { std: true }],
        ['80 NFF2 0120', '80 l/min — 40 FLE 0120 main filter, 3 HP, 2 wheels'],
        ['120 NFF2 0200', '120 l/min — 40 FLE 0200 main filter, 5 HP, 2 wheels'],
        ['145 NFF2 0270', '145 l/min — 40 FLE 0270 main filter, 7.5 HP, 4 wheels'],
        ['170 NFF2 0270', '170 l/min — 40 FLE 0270 main filter, 7.5 HP, 4 wheels']] },
      { key: 'media', name: 'Main element media', options: [
        ['H1XL', 'Glass fibre 1 µm absolute — ISO 12/9/5 (factor 5)'], ['H3XL', 'Glass fibre 3 µm — ISO 13/11/8'],
        ['H10XL', 'Glass fibre 10 µm — ISO 17/15/12', { std: true }], ['G10', 'Reusable SS mesh 10 µm'],
        ['G25', 'SS mesh 25 µm'], ['P10', 'Paper 10 µm'], ['AS3', 'Water absorbing 3 µm'], ['AS10', 'Water absorbing 10 µm']] },
      { key: 'counter', name: 'Particle counter', required: false, options: [
        ['0', 'Without', { std: true }], ['PC', 'Integrated particle counter, ISO/SAE output + PC software', { poa: true }]] },
    ],
    rules: [
      { type: 'DERIVE', when: { model: ['15 NFF2 0020', '20 NFF2 0020'] }, facts: { 'Suction filter': '40 LE 0008 G800 (SS mesh 800 µ, reusable)', 'Motor': '1 HP, 415 V/50 Hz' } },
      { type: 'DERIVE', when: { model: ['40 NFF2 0045'] }, facts: { 'Suction filter': '40 LE 0015 G800', 'Motor': '1.5 HP' } },
      { type: 'DERIVE', when: { model: ['80 NFF2 0120'] }, facts: { 'Suction filter': '40 LE 0020 G800', 'Motor': '3 HP' } },
      { type: 'DERIVE', when: { model: ['120 NFF2 0200'] }, facts: { 'Suction filter': '40 FLE 0020 G800', 'Motor': '5 HP' } },
      { type: 'DERIVE', when: { model: ['145 NFF2 0270', '170 NFF2 0270'] }, facts: { 'Suction filter': '40 FLE 0020 G800', 'Motor': '7.5 HP', 'Mount': '4-wheel cart' } },
    ],
    links: [
      { relation: 'spare', label: 'Main filter element', codeTemplate: '1.MAIN-{seg:media}-A00-0-P', note: 'Size follows system model main filter' },
      { relation: 'accessory', label: 'Standard indicator', partNumber: 'F2,5-GW-02-00-P' },
    ],
  });

  // Fixed spare parts (Filters)
  seedParts(db, 'LD', [
    ['BYP01/xx', 'Bypass valve assembly, sizes 0003–0013', 'xx = cracking pressure in bar'],
    ['BYP02/xx', 'Bypass valve assembly, sizes 0015–0018'],
    ['BYP03/xx', 'Bypass valve assembly, sizes 0020–0045'],
    ['AVP01', 'Air vent plug 1/4" BSP'],
    ['AOO001', 'Air vent valve 1/4" BSP'],
    ['DBP01', 'Drain plug 1/4" BSP'],
  ]);
  seedParts(db, 'FRE', [
    ['BYP-FRE-01/xx', 'Bypass valve assembly FRE/FRD sizes 0005–0013'],
    ['BYP-FRE-02/xx', 'Bypass valve assembly FRE/FRD sizes 0015–0018'],
    ['CSP-FRE-01/xx', 'Compression spring FRE/FRD 0005–0013'],
    ['CSP-FRE-02/xx', 'Compression spring FRE/FRD 0015–0018'],
    ['7.0003-P10-0-00-0-0', 'Breather element for FRE/FRD integral breather'],
  ]);
  seedParts(db, 'DK', [
    ['PRP04', 'Pressure plate assembly, DK size band 1'], ['PRP05', 'Pressure plate assembly, band 2'],
    ['PRP06', 'Pressure plate assembly, band 3'], ['PRP07', 'Pressure plate assembly, band 4'],
    ['BYP04/xx', 'Bypass valve assembly DK band 1'], ['BYP05/xx', 'Bypass valve assembly DK band 2'],
    ['BYP06/xx', 'Bypass valve assembly DK band 3'], ['BYP07/xx', 'Bypass valve assembly DK band 4'],
  ]);
}
