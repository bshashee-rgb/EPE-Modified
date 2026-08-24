// Shared option dictionaries (Reference A & B of Appendix A, common switch vocab of Appendix C).
// These are plain arrays reused across family definitions so an edit propagates at seed time.

export const MEDIA = [
  ['G10', 'SS wire mesh 10 µm, cleanable, nominal'], ['G25', 'SS wire mesh 25 µm, cleanable, nominal'],
  ['G40', 'SS wire mesh 40 µm, cleanable, nominal'], ['G60', 'SS wire mesh 60 µm, cleanable, nominal'],
  ['G80', 'SS wire mesh 80 µm, cleanable, nominal'], ['G100', 'SS wire mesh 100 µm, cleanable, nominal'],
  ['P5', 'Paper 5 µm, non-cleanable, nominal'], ['P10', 'Paper 10 µm, non-cleanable, nominal'], ['P25', 'Paper 25 µm, non-cleanable, nominal'],
  ['VS10', 'Non-woven 10 µm, non-cleanable'], ['VS25', 'Non-woven 25 µm, non-cleanable'],
  ['VS40', 'Non-woven 40 µm, non-cleanable'], ['VS60', 'Non-woven 60 µm, non-cleanable'],
  ['H1XL', 'Glass fibre 1 µm absolute (ISO 16889)'], ['H3XL', 'Glass fibre 3 µm absolute'],
  ['H6XL', 'Glass fibre 6 µm absolute'], [ 'H10XL', 'Glass fibre 10 µm absolute'],
  ['H16XL', 'Glass fibre 16 µm absolute'], ['H20XL', 'Glass fibre 20 µm absolute'],
  ['H3XP', 'Long-life glass fibre 3 µm, plastic mesh + sleeve'], ['H5XP', 'Long-life glass fibre 5 µm'],
  ['H10XP', 'Long-life glass fibre 10 µm'], ['H15XP', 'Long-life glass fibre 15 µm'], ['H20XP', 'Long-life glass fibre 20 µm'],
  ['H3XE', 'Long-life glass fibre 3 µm, epoxy mesh'], ['H5XE', 'Long-life glass fibre 5 µm, epoxy mesh'],
  ['H10XE', 'Long-life glass fibre 10 µm, epoxy mesh'], ['H15XE', 'Long-life glass fibre 15 µm, epoxy mesh'], ['H20XE', 'Long-life glass fibre 20 µm, epoxy mesh'],
  ['H3XC', 'Conductive glass fibre 3 µm'], ['H5XC', 'Conductive glass fibre 5 µm'], ['H10XC', 'Conductive glass fibre 10 µm'],
  ['H15XC', 'Conductive glass fibre 15 µm'], ['H20XC', 'Conductive glass fibre 20 µm'],
  ['AS1', 'Aquasorb water-absorbing 1 µm absolute'], ['AS3', 'Aquasorb 3 µm'], ['AS6', 'Aquasorb 6 µm'],
  ['AS10', 'Aquasorb 10 µm'], ['AS20', 'Aquasorb 20 µm'],
  ['M5', 'SS fibre 5 µm absolute, cleanable'], ['M10', 'SS fibre 10 µm absolute, cleanable'], ['M15', 'SS fibre 15 µm absolute, cleanable'],
];

export const ADHESIVE = [
  ['0', 'Standard adhesive T=100 °C', { std: true }],
  ['1', 'Epoxy adhesive (for fuels)'],
  ['E', 'High-temperature adhesive T=160 °C'],
];

// hardware: pass subset codes per family; full dictionary here
export const HARDWARE = {
  C: ['C', 'End caps CS + inner tube CS'],
  P: ['P', 'End caps polyamide + inner tube CS', { std: true }],
  X: ['X', 'End caps SS + inner tube SS'],
  D: ['D', 'End caps Ni-coated CS + inner tube Ni-coated CS'],
  M: ['M', 'End caps CS + inner tube SS'],
  U: ['U', 'End caps PU + CS (breather elements)'],
};

export const SEALS_PVENB = [
  ['P', 'Nitrile (NBR)', { std: true }], ['V', 'Viton (FKM)'], ['E', 'EPDM'], ['N', 'Neoprene'], ['B', 'Butyl'],
];
export const SEALS_PVE = [
  ['P', 'Nitrile (NBR)', { std: true }], ['V', 'Viton (FKM)'], ['E', 'EPDM'],
];

export const HOUSING_STD = [
  ['0', 'Standard as per catalogue', { std: true }], ['SP', 'Special (specify)', { onReq: true, poa: true }],
];

// DP-type maintenance indicator family (LD, FE, LE, DK, OFM20X)
export const DP_INDICATOR = [
  ['0', 'Without indicator', { std: true }],
  ['A', 'Optical pop-up (F-xx-A0-00-00-P)'],
  ['B', 'Optical pop-up + electrical, DIN plug (F-xx-GW-02-00-P)'],
  ['D', 'Optical pop-up + electrical with lamp (F-xx-GW-26-00-P)'],
  ['T', 'Optical + electrical, 2 switching points 75/100 % (R-xx-GW-09-Z0-P)'],
  ['AD', 'Optical dual dial (FD-xx-A0-00-00-P)'],
  ['BD', 'Optical dual dial + electrical DIN plug (FD-xx-GW-02-00-P)'],
  ['DD', 'Optical dual dial + electrical lamp (FD-xx-GW-26-00-P)'],
  ['SP', 'Special indicator', { onReq: true, poa: true }],
];

export const DP_CRACKING = [
  ['-', 'Without / not applicable', { std: true }],
  ['0.8', '0.8 bar'], ['1.5', '1.5 bar'], ['2.5', '2.5 bar'], ['4.2', '4.2 bar'],
  ['5.0', '5.0 bar'], ['6.0', '6.0 bar'], ['7.0', '7.0 bar'],
];

// Return-line indicator family (FR/L, FRD, FRE)
export const RL_INDICATOR = [
  ['0', 'Without indicator', { std: true }],
  ['A', 'Optical manometer 0–6 kg/cm² (M010)'],
  ['B', 'Optical manometer 0–25 kg/cm² (M040)'],
  ['C', 'Optical pop-up (Pxx)'],
  ['D', 'Electrical pressure switch NO / closer (Hxx-HA-32-00-P)'],
  ['F', 'Electrical pressure switch NC / opener (Hxx-HS-32-00-P)'],
  ['G', 'Electrical switch-over (Hxx-GW-33-00-P)'],
  ['K', 'Optical + electrical switch-over + lamp (Hxx-GS-34-00-P)'],
  ['SP', 'Special indicator', { onReq: true, poa: true }],
];

export const BYPASS_FULL = [
  ['0', 'Without bypass valve', { std: true }],
  ['1', 'Bypass 0.3 bar'], ['2', 'Bypass 0.8 bar'], ['3', 'Bypass 1.5 bar'], ['4', 'Bypass 2.0 bar'],
  ['5', 'Bypass 2.5 bar'], ['6', 'Bypass 3.0 bar'], ['7', 'Bypass 3.5 bar'], ['8', 'Bypass 5.0 bar'],
  ['9', 'Bypass 7.0 bar'], ['Bx', 'Special bypass setting', { onReq: true, poa: true }],
];

// Accumulator bladder/seal compounds (AS pos 3)
export const BLADDER_MATERIALS = [
  ['P', 'Nitrile NBR (−20…+85 °C) — mineral oils, water glycols, HFA/HFB/HFC, diesel', { std: true }],
  ['F', 'Low-temp nitrile (−40…+70 °C)'],
  ['H', 'Nitrile for hydrocarbons (−10…+90 °C)'],
  ['K', 'HNBR (−50…+130 °C)'],
  ['A', 'NBR food grade (−20…+85 °C)', { onReq: true }],
  ['B', 'Butyl IIR (−20…+90 °C) — HFD-R phosphate esters, Skydrol 7000'],
  ['E', 'EPDM (−20…+90 °C) — brake fluids, HFC, Skydrol 500'],
  ['N', 'Neoprene CR (−20…+85 °C) — Freons, ammonia, CO₂'],
  ['Y', 'Epichlorohydrin ECO (−30…+100 °C)'],
  ['V', 'Viton FKM (−20…+121 °C)'],
];

export const CERTS_AS = [
  ['0', 'Factory testing', { std: true }],
  ['8', 'CE/PED per EN-14359'],
  ['30', 'CE/PED per ASME Sec.VIII Div.1'],
  ['7W', 'ASME Sec.VIII Div.1 without U-stamp'],
  ['7U', 'ASME Sec.VIII Div.1 with U-stamp'],
  ['1', 'EAC / CU-TR 032/2013'],
  ['3', 'SELO/ML (China)', { onReq: true }],
  ['NB', 'National Board registered (requires 7U)'],
  ['CRN', 'Canada CRN (requires 7U + NB)'],
  ['NR', 'NR13 Brazil', { onReq: true }],
  ['D', 'DOSH Malaysia', { onReq: true }],
  ['DNV', 'DNV inspected & certified', { onReq: true }],
  ['ABS', 'ABS inspected & certified', { onReq: true }],
];

// Switch shared vocab
export const SW_CONN_THREADED = [
  ['G01M', '1/8" BSP (M)'], ['G02M', '1/4" BSP (M)', { std: true }],
  ['T01M', '1/8" BSPT (M)'], ['T02M', '1/4" BSPT (M)'],
  ['M42M', 'M10x1.0 (M)'], ['M43M', 'M12x1.5 (M)'],
  ['N01M', '1/8" NPT (M)'], ['N02M', '1/4" NPT (M)'],
];
export const SW_SEALS = [
  ['P', 'NBR / Nitrile', { std: true }], ['V', 'Viton'], ['E', 'EPDM'], ['K', 'HNBR'],
];
export const SW_ELEC = [
  ['NO', 'Normally Open with cap'], ['NC', 'Normally Closed with cap'],
  ['CO', 'Change-Over with cap'], ['COD-A', 'Change-Over with DIN 43650 Form A socket'],
];
