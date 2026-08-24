# Appendix B — Accumulators: Specification Hierarchies Extracted from Datasheets

Source: datasheets in `EPE/Accumulators/`. Manufacturer: EPE Process Filters & Accumulators Pvt. Ltd., Hyderabad.

## File-level findings (duplicates & document roles)

| File | Role |
|---|---|
| `Bladder-Accumulator-AS-11-001-R10.pdf` (24 pp) | **Authoritative AS datasheet** — full ordering code, dimensions, spares, gas bottles, stations |
| `BladderAccumulator.pdf` = `BladderAccumulatorpdf.pdf` (identical) | AS Operator's Manual + older ordering-code annexure |
| `Diaphragm-Accumulator-AMW-13-001-R8.pdf` | **Authoritative AMW datasheet** |
| `DiaphragmAccumulator.pdf` = `DiaphragmAccumulatorpdf.pdf` (identical) | AMW Operator's Manual + older annexure |
| `Piston-Accumulator-AP-14-001-R5.pdf` | **Authoritative AP datasheet** (Rev.7/01-2025 footer) |
| `PistonAccumulatorpdf.pdf` | AP Operator's Manual — same 18-position code, slightly older option sets |
| `Piston-Accumulator-APC-14-002-Rev-0.pdf` | **APC datasheet** |
| `PistonAccumulator.pdf` = `Piston-Accumulator-Limit-Switching-Device.pdf` (identical) | **ES Limit Switching Device** datasheet — misleading filename |
| Safety-Block, Charging-Block, Charging-Kits (3), Adaptors, Mounting-Accessories, BandClamp | Accessory datasheets, all distinct |
| PST*/PSB*/PSTY/PSVM/TST* files | Switch datasheets duplicated from `Switches/` (covered in Appendix C) |

---

# 1. Bladder Accumulator — Type AS (family: AS / ASHF / ASWP / ASWD / ASLV / ASLVHF / ASL / AST)

**Description:** Hydro-pneumatic bladder accumulator; seamless or fabricated shell per EN-14359 / ASME. Nominal capacity 0.2–575 L; max pressure (PS) 16–360 bar; PT = 1.43×PS; temp −20 to +80 °C std (−40 °C on request); allowable pressure ratio P₂/P₀ = 4:1. Fluid viscosity 10–400 cSt (rec. 32 cSt), contamination class 21/19/16 per ISO 4406. Shell: carbon steel (RAL-5010) or SS/Al/Ti/nickel-plated/Rilsan-coated. Gas side 5/8" UNF std. Bladders/seals replaceable (poppet designs); ASWD/ASLV/ASLVHF use anti-extrusion (disc) valve instead of poppet.

## 1.1 Ordering code — Accumulator (14 positions)

Example: `AS 35 P 360 C G 09 F 0 C C V / PO:10 / – - __ - __`

**Pos 1 — Series:** AS = standard seamless; ASHF = high-flow seamless; ASWP = welded, poppet design; ASWD = welded, disc design (**constraint: P₀ ≤ 15 bar**); ASLV = large volume; ASLVHF = high-flow large volume; ASL = liquid separator; AST = transfert accumulator.

**Pos 2 — Nominal capacity (L)** — *dependent on Series (Pos 1) and tied to MWP:*

| Series | Capacity codes | MWP |
|---|---|---|
| AS | 0.2 | 330 bar |
| AS | 0.7 | 350 bar |
| AS | 1–57 | 360 bar |
| AS | 60–130 | 330 bar |
| ASHF | 10–55 | 360 bar |
| ASWP | 3–57 | 30–165 bar (30/50/70/120/165) |
| ASWD | 1.5–6 | 70 bar |
| ASWD | 10–57 | 30 bar |
| ASLV / ASLVHF | 150–575 | 16 / 35 bar |

**Pos 3 — Bladder & seal material** (P standard) — drives fluid compatibility & temperature range:

| Code | Polymer | Temp °C | Typical fluids |
|---|---|---|---|
| P | Nitrile (NBR) | −20…+85 | Mineral/vegetable/silicone/lube oils, water glycols, HFA-HFB-HFC, diesel, kerosene |
| F | Low-temp nitrile | −40…+70 | As P + some Freons; low temps |
| H | Nitrile for hydrocarbons | −10…+90 | As P + slightly aromatic gasoline |
| K | HNBR | −50…+130 | As P, excellent at temp extremes |
| A | NBR food grade | −20…+85 | Foods (specify when ordering) |
| B | Butyl (IIR) | −20…+90 | HFD-R phosphate esters, hot water, ammonia, caustic soda, ketones, Skydrol 7000 |
| E | EPDM | −20…+90 | Brake fluids, hot water, detergents, HFC, acids/bases, Skydrol 500 |
| N | Neoprene (CR) | −20…+85 | Freons, water, ammonia, CO₂, mineral/paraffin/silicone oils |
| Y | Epichlorohydrin (ECO) | −30…+100 | Lead-free gasoline, mineral oils |
| V | Viton (FKM) | −20…+121 | As nitrile, excellent at temp extremes |

**Pos 4 — Max working pressure (bar)** — *child of Pos 1+2 (see table under Pos 2).*

**Pos 5 — Shell material:** C = carbon steel (std), N = nickel-coated CS, X = stainless steel, V = Rilsan-coated CS.

**Pos 6 — Fluid port connection type:** G = BSPP (std), T = BSPT, N = NPT, 3 = SAE 3000 psi flange, 6 = SAE 6000 psi flange, Q = square flange, S = SAE internal thread, M = metric, D = UNI-DIN flange, A = ANSI flange, R# = adaptor for use with type G connection (# = G/T/N/S/M).

**Pos 7 — Fluid port connection size** — *child of Pos 6:*
- For G/T/N/3/6/Q/R: 01=1/8" … 13=4" (01,02,03,04,05,06,07,08,09,10,11,12,13), zz = multi ports (R)
- For S: 21=1-1/16"-12, 22=1-5/8"-12, 23=1-7/8"-12
- For M: 31–45 (M14x1.5 … M35x1.5 per table)
- For D (DN/PN): 51–69 (DN20/40 … DN20/300 per table)
- For A (ANSI, current scheme): two characters `xy` — size x: A=1/4"…K=4"; class y: A=150, B=300, C=400, D=600, E=900, F=1500, G=2500. *(Older annexure used numeric codes 81–98 — legacy scheme.)*

**Pos 8 — Fluid port connection design:** F = female thread, M = male thread, S = for SAE flange, L = flange, SW = socket weld nipple. For ANSI: WN = WN-RF, WJ = WN-RTJ, SO = SO-RF, SW = SW-RF, SJ = SW-RTJ.

**Pos 9 — Test certification:** 0 = factory testing, 8 = CE/PED per EN-14359, 30 = CE/PED per ASME VIII Div.1, 7W = ASME w/o U-stamp, 7U = ASME with U-stamp, 1 = EAC/CU-TR, 3 = SELO/ML (China), NB = National Board, CRN = Canada, NR = NR13 Brazil, D = DOSH Malaysia, DNV, ABS.
*Composition rules:* multiple certifications joined with "+" (e.g. 7U+D; 7W+8); **NB requires ASME U-stamp; CRN requires U-stamp AND NB.**

**Pos 10 — Fluid valve material:** C = CS (std), N = Ni-coated, X = SS, Z = Zn-Ni coated.
**Pos 11 — Gas valve material:** same codes.

**Pos 12 — Gas fill valve connection:** V = 5/8" UNF (std), X = 5/8" UNF SS, 0 = without, 1 = 5/16" UNEF/Vg8, 2 = 1/4" BSP, 3 = M16x2.0, 4 = 5/16" UNEF (7/8" UNF body), 8 = double-lock military, 9 = 7/8" UNF integral, M = M28x1.5.

**Pos 13 — Precharge pressure:** "–" = uncharged; `PO:XX` = precharge in bar @20 °C.

**Pos 14 — Other variants** (– = standard):
- *Liquid side:* L01 SS liquid adapter, L02 SS poppet & spring, L03 no bleed port, L11–L17 3-way adaptors (various BSPF/NPTF combinations)
- *Gas side:* G01 SS protection cap, G02 cap w/ plastic insert, G03 brass name plate, G04 SS name plate, G05 7/8" UNF gas valve body, G06 M50x1.5 w/ 7/8" body, G07 lifting hook, G11 ¼" gauge adapter, G12(xxx) adapter + gauge, G13(xxx)–G18(xxx) rupture-disc variants, G19/G20(xxx) gas safety valves VS214/VS224X, G21/G22 needle valve CS/SS, G23/G24(xxx) PGSV (+gauge)
- *External:* E01 paint RAL-5003. *Internal:* F05–F10 flushing to NAS-5…NAS-10. Sxxx/Txxx EPE design no.; SPL special.

## 1.2 Ordering code — Bladder Assembly (spare) `S-35-P-M50-C-V`

1. Design: S = standard, ST = transfert, SL = liquid separator
2. Nominal capacity: 0.2–130 (AS/ASHF/ASWD/ASWP) | 150–575 (ASLV/ASLVHF)
3. Bladder & seal material: same codes as accumulator Pos 3
4. Gas valve type: 0, U5/8, M22, M22-B, M22L, M30, M50, M50L, U7/8, U7/8V, U7/8V-B, U7/8U, MU7/8, MU7/8U, MU7/8V, LV (integral ASLV/ASLVHF)
5. Gas valve material: 0 / C (std) / N / X / Z
6. Gas fill valve connection: V (std) / X / 0 / 1 / 2 / 3 / 4 / 8 / 9 / M

**Gas valve availability matrix (valve type × capacity):**

| Valve code | 0.2 | 0.7 | 1–3 | 4–6 | 10–57 | 60–130 |
|---|---|---|---|---|---|---|
| 0 (no valve) | ✓ | ✓ | ✓ | ✓ | ✓ | ✗ |
| U5/8 | ✓ | ✓ | ✓ | ✓ | ✗ | ✗ |
| M22 | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| M22-B | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| M22L | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| M30 | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| M50 / M50L | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| U7/8, U7/8V, U7/8U | ✗ | ✓ | ✓ | ✓ | ✓ | ✓ |
| U7/8V-B | ✗ | ✗ | ✓ | ✓ | ✓ | ✗ |
| MU7/8, MU7/8U, MU7/8V | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| U5/8 (SL design) | ✓ | ✗ | ✗ | ✗ | ✗ | ✗ |
| M22 (SL) | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| M50 (SL) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |
| M22 (ST) | ✗ | ✓ | ✓ | ✓ | ✗ | ✗ |
| M50 (ST) | ✗ | ✗ | ✗ | ✗ | ✓ | ✓ |

## 1.3 Ordering code — Gas Bottles (back-up) `BB-25-360-C-0-0`

1. Design: BA = accumulator design, BB = neck design, BD = threaded design
2. Nominal volume (L): BA = 3–55; BB = 25/50; BD = 50/60/75
3. Max pressure: 360 (only)
4. Material: C = carbon steel (only; RAL-7035)
5. Connections: 0 = standard, S = special
6. Certification: 0 = factory tested, 8 = CE/PED (**BB & BD only**), 1 = EAC/CU-TR (**BD only**)

## 1.4 Key selection tables (AS family)

**Max flow rates (L/min) by size band:** AS/ASWP: 0.2 → 160; 0.7–1.5 → 300; 3–6 → 600; 10–57 → 1000; 60–130 → 1800. ASHF 10–55 → 1800. ASWD: 0.7–1.5 → 100; 3–6 → 150; 10–57 → 300. ASLV → 900; ASLVHF → 1200.

**Certification rules (printed):** vessels V ≤ 1 L not CE-marked (PED Art. 3); >1 L with CE + declaration. Test pressure ≥1.43 PS; >2,000,000 load cycles @70 bar; bladder/seal spare shelf life 2 years @20±5 °C; replace elastomers after 6 years.

**Related products:** Safety block Type B, charging kit PC (PC-280/70 std), gas bottles BA/BB/BD, accumulator stations (single-row 2–5, double-row 4–10 units), clamps/brackets/support rings, spare gas-valve assemblies (A12xxx), fluid-port assemblies (H12xxx/I12xxx), gasket sets (R12xxx) — for non-CS/nitrile MOC append material code (e.g. `A12062-V-X`).

---

# 2. Diaphragm Accumulator — Type AMW

**Description:** Welded-shell diaphragm accumulator, **non-repairable**. Capacity 0.075–5 L; PS 40–350 bar; PT = 1.43×PS; temp −20…+80 °C std; P₀max = 130 bar; pressure ratio 8:1 (≤1.4 L) / 6:1 (2 L) / 4:1 (2.8–5 L). Body: CS painted (RAL9005), low-temp CS, or SS. PED 2014/68/EU module H; CE 0045; V ≤ 1 L not CE-marked. Shelf life 3 years.

## Ordering code (11 positions): `AMW-0.75-P-210-C-C2-0-M / P0:10 / O:10ml / -`

**Pos 1 — Type:** AMW

**Pos 2 — Nominal capacity (L):** 0.07 (=0.075), 0.16, 0.32, 0.50, 0.75, 1, 1.4, 2, 2.8, 3.5, 5 *(older annexure also listed 4 L)*

**Pos 3 — Diaphragm material:** P = NBR (−20…+80), Y = ECO (−30…+110), V = FKM (−10…+150), 0 = without.
Compatibility: P — mineral oils, water glycols, HFA-HFB-HFC, diesel; Y — mineral oils, aliphatic hydrocarbons, silicone oils, ozone resistant; V — mineral oils, HFD, aromatic/chlorinated hydrocarbons, fuels incl. methanol.

**Pos 4 — Max working pressure (bar)** — *parent-child with capacity:*

| Code | Available capacities |
|---|---|
| 40 | all |
| 100 | (not size-restricted) |
| 130 | 1.40, 2.00 |
| 140 | 0.75, 1.00 |
| 160 | 0.50, 1.40 |
| 210 | 0.32, 0.50, 0.75, 1.40, 2.00, 2.80 |
| 250 | 0.07, 0.16, 0.75, 1.00, 1.40, 2.00, 2.80, 3.50, 5.00 |
| 300 | 0.16 |
| 350 | 0.75, 3.50 |

**Pos 5 — Body material:** C = CS (−20…+80), L = low-temp CS (−40…+80), X = SS.

**Pos 6 — Fluid side connection** — forms: C.. female thread, E.. combination (M+F), S.. SAE, Z = others, suffix N = with locking nut (external threading only):
- **C:** C1 = G1/2"(F) ø29 spot face, C2 = G1/2"(F) ø34, C3 = G3/4"(F), C6 = M18x1.5(F), C7 = G3/4"(F) w/o spot face, C8 = 1/2" NPT(F), C9 = M22x1.5(F), C11 = G1/2"(F) w/o spot face, C12 = M16x1.5(F), C13 = M14x1.5(F); **C4 = G1/2"(F), C5 = G3/4"(F) reserved for Design-3 accumulators**
- **E:** E1–E29 combination threads per table (e.g. E2 = G1"(M)×G1/2"(F), E4 = M42x1.5×G3/4"); **E7/E8 for Design-3**
- **S (SAE J1926):** S6 = 9/16-18 UNF, S8 = 3/4-16 UNF, S10 = 7/8-14 UNF, S12 = 1-1/16-12 UN
- Full thread-dimension table on datasheet p.5

**Pos 7 — Certification:** 0 = factory (design per PED), 1 = EAC/CU-TR, 8 = CE/PED per EN-14359.

**Pos 8 — Gas side connection:** M = M28x1.5(M) rechargeable (std), P = ø8 non-rechargeable/sealed (**only ≤1.4 L and ≤250 bar**), V-family plunger rechargeable: VV = 5/8"UNF(M), VX = SS, V1 = 5/16"UNEF/Vg8, VM = military, V2 = 1/4"BSP(M), V4 = 7/8"UNF(M), V5 = M16x2(M), V6 = M16x1.5(M), V0 = without.
*Dependency:* charging kit **PCM** for version M; **PC (+adaptor)** for version V; version **P non-rechargeable**.

**Pos 9 — Precharge:** – / PO-xx bar @20 °C. **Pos 10 — Oil filling gas side:** – / O-yy ml. **Pos 11 — Others:** – std; C = CS diaphragm plug; X = SS plug; Z = other (standard plug is polymer).

**Selection table:** 24 catalogued variants (capacity × MWP × dims × std connection × design × ratio × clamp part#): AMW-0.07 (250, ø64, C1, 8:1); AMW-0.16 (250/300); AMW-0.32 (210); AMW-0.5 (160/210); AMW-0.75 (140/210/250/350; clamps CL0201/CL0202); AMW-1 (140/250; CT0702); AMW-1.4 (130/160/210/250; CT0700); AMW-2 (130/210/250; 6:1); AMW-2.8 (210/250; 4:1; CL0300/CL0301); AMW-3.5 (250/350; Design 2/3); AMW-5 (250; CL0301). Design 3 restricts connections to C4/C5/E7/E8.

**Related:** Charging kit PCM (M valve) & PC (V valve), Safety Block B, clamps CL0201/CL0202/CT0702/CT0700/CL0300/CL0301, brackets BA0300/BA0400.

---

# 3. Piston Accumulator — Type AP

**Description:** Floating-piston accumulator, repairable. Capacity 0.25–1500 L; PS 120–1000 bar; PT = 1.43×PS (PED) or 1.3×PS (ASME); temp −20…+80 °C; ratio 8:1. Tube: seamless CS (E355/P355/P460/Q345B/SA372) or SS; piston: Al alloy / SG iron / SS; piston seals PU/PTFE/Viton/EPDM; end-cover seals NBR std. Sizing formulae + isothermal/adiabatic correction graphs on datasheet p.3.

## Ordering code (18 positions): `AP-35-375-180-C-2-PPU-P-0-0-0-FV-0-G07F-0 / P0:10 / – - __ - __`

**Pos 1 — Series:** AP

**Pos 2 — Nominal capacity (L)** — *bound to piston diameter:*

| Piston ø (mm) | Capacity range |
|---|---|
| 50 | 0.25–1.5 |
| 80 | 0.5–10 |
| 100 | 0.5–15 |
| 125 | 2–25 |
| 180 | 6–100 |
| 250 | 15–200 |
| 350 | 100–400 |
| 490 | 150–1000 |

**Pos 3 — Max working pressure (bar)** — *child of piston diameter:* ø50 = 250; ø80 = 300; ø100 = 375/690/1000; ø125 = 330; ø180 = 375/450/690/1000; ø250 = 220/350; ø350 = 220/350; ø490 = 120/220. Note: EPE reserves right to supply high-pressure accumulators in place of mid-pressure.

**Pos 4 — Piston diameter:** 050, 080, 100, 125, 180, 250, 350, 490.

**Pos 5 — Tube & end cover material:** C = CS (std), N = Ni-coated CS, X = SS, A = aluminium.

**Pos 6 — Piston material:** 1 = SG iron, 2 = aluminium alloy (std), X = SS.

**Pos 7 — Piston speed & seal material** — *availability depends on piston diameter:*

| Code | Speed | Seals | Restriction |
|---|---|---|---|
| PPU / APU | 3 m/s | Polyurethane | up to ø180 — std |
| PPD / APD | 2 m/s | PU + PTFE + nitrile | ø180 — std at 180 |
| PTN | 3 m/s | PTFE + nitrile | > ø180 — std |
| PTV | 3 m/s | PTFE + Viton | > ø180 |
| PTE | 3 m/s | PTFE + EPDM | > ø180 |
| PVV | 3 m/s | Viton | > ø180 |
| PEE | 3 m/s | EPDM | > ø180 |
| FPT | 0.5 m/s | PU + PTFE | up to ø180 |
| TTN | 2 m/s | PTFE + nitrile | up to ø350 |
| TTV | 2 m/s | PTFE + Viton | up to ø350 |
| HTN / ATN | 2 / 0.5 m/s | PTFE+nitrile / PU+PTFE | special |

**Pos 8 — End cap seals:** P = NBR (std), V = FKM, E = EPDM.
**Pos 9 — Piston design:** 0 = without recovery valve (std), V = with recovery valve, S = special.
**Pos 10 — Inner surface:** 0 / S. **Pos 11 — Gas side design:** 0 / S.

**Pos 12 — Gas side connections:** FV = gas fill valve 5/8" UNF (std), FX = SS, F1 = 5/16" UNEF/Vg8, F2 = 1/4" BSP, F3 = M16x2.0, F8 = double-lock military, FM = M28x1.5, G05F = no fill valve, 3/4" BSP(F) port, G06F = no fill valve, 1" BSP(F) port, SGxx = others.

**Pos 13 — Liquid side design:** 0 / S.

**Pos 14 — Liquid side connections:** G04F = 1/2" … G09F = 2" BSP(F), SLyy = others. *Standard port by diameter:* ø50 = 1/2"; ø80 = 3/4"; ø100/125 = 1"; ø180/250/350 = 1-1/2"; ø490 = 2".

**Pos 15 — Test certification:** 0, 8 (CE/PED), 7W, 7U, 1 (EAC).

**Pos 16 — Precharge:** – / XX bar.

**Pos 17 — Piston position monitoring** (– = none; **EF, WS & WP are vertical-mounting designs**):
- ES = electrical limit switch, screw-in; EF = flanged; sub-options: `-xxxx` max stroke (mm); switch config -1NO, -1NC, -2OC, -2CO, -nBS (bistable)
- WS = walking-stick; -MF magnetic flapper; -PT position transducer
- XG = exit rod gas side; XL = exit rod liquid side
- UE = ultrasonic external, -nUS; LS = laser sensor [4-20 mA]
- WP = wire position monitoring with transducer & display [24/115/220 VAC; 24 VDC]

**Pos 18 — Other variants:** gas side G07/2, G11, G12(xxx), G13–G18 rupture-disc variants, G19/G20 gas safety valves, G21/G22 needle valves, G23/G24 PGSV; E01 RAL-5003; F05–F10 NAS flushing.

**Spares:** piston seal kits PSK-{ø}-{seal code} (availability mirrors Pos 7 restrictions; append end-cap seal code); U-clamp assemblies by external ø (130 → 11545; 210/220 → 11546; 292/312 → 11547; 405/419 → 11548).

**Related:** Safety block B (long adaptors L05M–L08M by piston ø), charging kit PC, U-bolt clamps, sleeve assembly equipment, ES/EF/WS/WP/XG/XL/UE/LS monitoring.

---

# 4. Piston Accumulator — Type APC (compact, non-repairable)

**Description:** Compact floating-piston accumulator, **non-repairable** (only gas fill valve replaceable). Capacity 0.1–8 L; PS 250 bar; temp −20…+80 °C; ratio 8:1. Tube CS (SS option), piston Al alloy, seals PU/PTFE. RAL-5010.

## Ordering code (18 positions): `APC-1-250-50-C-2-PPU-P-0-0-0-FV-0-G04F-0 / P0:10 / – - __ - __`

1. Series: APC
2. Nominal capacity — *by piston ø:* ø40 = 0.1–0.3; ø50 = 0.1–1; ø80 = 0.25–3; ø100 = 0.75–8
3. Max working pressure: 250 (only)
4. Piston diameter: 040, 050, 080, 100
5. Tube & end cover: C (std) / X
6. Piston material: 1 / 2 (std) / X
7. Piston speed & seals: PPU = 3 m/s PU (std), APT = 0.5 m/s PU+PTFE
8. End cap seals: P (std) / V / E
9. Piston design: 0 / S
10. Inner surface: 0 / S
11. Gas side design: 0 / S
12. Gas side connections: FV (std) / FX / F1 / F2 / F3 / F8 / FM / SGxx
13. Liquid side design: 0 / S
14. Liquid side connections: G03F = 3/8", G04F = 1/2", G05F = 3/4", G06F = 1" BSP(F); SAE: S6, S10, S12, S16; SLyy. *Standard by ø:* ø40 = 3/8"/S6; ø50 = 1/2"/S10; ø80 = 3/4"/S12; ø100 = 1"/S16
15. Certification: 0 / 8 / 7W
16. Precharge: – / XX bar
17. Position monitoring: – (without only)
18. Other variants: – / E01 / F05–F10

**Related:** Safety Block B, charging kit PC (PC-280/70), U-clamp 11545.

---

# 5. Limit Switching Device — Type ES (for AP piston accumulators)

**Description:** Magnet-operated limit switch screwed into gas-side top cover of AP accumulators; signals piston positions. Stroke max 100 mm; max two switches; piston speed max 0.5 m/s in charging stroke; switch IP67, cable 2×0.75 mm² 5000 mm, −20…+75 °C; max 250 V AC/DC, 3 A, 120 VA/W. Casing pressurized once installed.

**Ordering code — device `ES-2-BS-P / 100 / 5000`:** 1 Type ES; 2 No. of switches 1 (std)/2; 3 Switch type NO (std)/NC/NO+NC/BS (bistable); 4 Sealing P (std)/V; 5 Stroke length (mm); 6 Cable length (mm).
**Replacement switch:** `ESS-BS/5000`. Note: bottom switch (nearer top cover) is always NO.

---

# 6. Accumulator Safety Block — Type B

**Description:** Isolation/discharge/relief block between accumulator and system; ball-type shut-off; manual discharge lever, optional solenoid discharge. Nominal flow @6 m/s: B10 = 30 L/min, B20 = 115, B25 = 180, B32 = 290. Set pressure 5–420 bar; PS 420 bar; temp −40…+150 °C (+65 °C with solenoid). Ports: P (pump), A (accumulator), T (tank), M (gauge); DBDS relief cartridge; fully open or fully shut only.

## Ordering code (10 positions): `B-10-M-B-210-G09M-G05F-P-C-0`

1. **Series:** B
2. **Size:** 10, 20, 25, 32 (mm)
3. **Discharge:** M = manual only, E = manual + electric (solenoid)
4. **Safety valve:** A = without, plastic plug; T = without, metal plug; B = DBDS CS relief, factory calibrated; P = DBDS CS, CE certified; 1 = DBDS CS, EAC; V = CS gas safety valve; G = SS gas safety valve
5. **Relief pressure:** XXX bar; 0 = without
6. **Accumulator side connection** — *explicitly mapped to accumulator families:* G04M = 1/2" BSPP(M) for AMW; G05M = 3/4" for AS0.7-1.5|AMW; G07M = 1-1/4" for AS3-6; G09M = 2" for AS10-55|ASWP10-55|ASWD1.5-3; G10M = 2-1/2" for AS60-130|ASHF10-55|ASWD4-5; G13M = 4" for ASWD10-55; M32M = M16x1.5(M) for AMW; M33M = M18x1.5(M) for AM|AMW; M34M = M22x1.5(M) for AMW; M38M = M40x1.5(M) for AS3-AS6; M41M = M50x1.5(M) for AS10-AS55; W00H = without nipple; 309H = holes for 2" SAE 3000 flange (B25|B32); L05M = long adaptor 3/4" for AP-100ø; L06M = 1" for AP-100ø|125ø; L07M = 1-1/4" for AP-100ø; L08M = 1-1/2" for AP-180ø to 520ø
7. **Installation side connection** — *standards by size:* G04F = 1/2" std for B10; G05F = 3/4" std for B20; G06F = 1" std for B25; G08F = 1-1/2" std for B32; G09F = 2"; C07H = 1-1/4" CETOP-400 (B25|B32); C08H = 1-1/2" CETOP-400 (B32); 308H = 1-1/2" SAE-3000 (B32); 309H = 2" SAE-3000 (B32); 607H = 1-1/4" SAE-6000 (B25|B32); 608H = 1-1/2" SAE-6000 (B32)
8. **Seal material:** P = NBR (−20…+80), F = low-temp NBR (−40…+70), K = HNBR (−30…+130), E = EPDM (−30…+100), B = butyl (−20…+90), V = FKM (−10…+130)
9. **Block material:** C = CS, L = low-temp CS, N = Ni-coated CS, X = SS
10. **Other variants:** 0 = none; X = SS relief valve; Gxxx = pressure gauge xxx bar; GGxxx = glycerine-filled gauge; 24D-C etc. = solenoid supply (voltage|AC/DC|NO/NC); MC = minimess coupling; MCX = minimess SS

---

# 7. Gas Charging Block — Type BC

**Description:** Manifold block connecting transfert-type accumulators with N₂ back-up bottles; charge/adjust/release, online measurement, over-pressure protection (safety valve or burst disc on port SV). Sizes 25/32 mm; PS 400 bar; temp −20…+80 °C. Ports: A = accumulator, B = bottles, M = gauge 1/4" BSP(F), PC = gas valve 5/8" UNF(M), shut-off valve R, internal check valve VR.

## Ordering code: `BC25-A-0-G06F-G06F-C-P-0`

1. Type: BC25 / BC32
2a. Safety valve/burst disc: A = without (std), B = relief valve factory certified, D = relief valve CE/PED, R = burst disc CE/PED
2b. Set pressure: 0 = without (std), … = preset bar
3. Connection accumulator side — *size-dependent:* G05F = 3/4" (std both), G06F = 1" (both), G07F = 1-1/4" (**BC32 only**), G08F = 1-1/2" (**BC32 only**)
4. Connection bottle side: same codes/constraints
5. Body: C (std) / X
6. Sealing: P = POM+NBR (std), V = POM+Viton
7. Certification: 0 = factory (std)

**Spares:** valve Y65018/Y62031, check valve W65017, gas fill valve ASSY17, gasket sets Y65019/Y62030.

---

# 8. Charging Kits

## 8.1 Type PC (standard, 400 bar) — `PC-280/70-…`
Valve body w/ ring nut, gauge, bleed, non-return; HP hose; two ø63 gauges; case; bottle adaptor. Max 400 bar.
Code: 1 Type PC; 2 Gauges 280/70 std (HP 400/350/210/140; LP 35/20/10/7 on request); 3 Accumulator connection – = 5/8" UNF (std), A = 5/16" UNEF/Vg8, B = 7/8" UNF, C = 1/4" BSP, D = universal; 4 Bottle – = 5/8" BSP (std); 5 Hose – = 2 m (1.5–2.5, 4–6 m on request).
Spares: gasket set 2160, non-return 2162, bleed 2164, hose 2166/(m), gauge 2163/(bar), adaptors 50019/10143, ring nut 40054.

## 8.2 Type PC [690 bar] High Pressure — `PC-700/400-…`
Max 690 bar; gauges HP 700 / LP 400. Code: gauges 700/400 std; accumulator – = 5/8" UNF or C = 1/4" BSP; bottle 5/8" BSP; hose 2 m std. Spares: W40094, BBBBXX, X40057, 010017/(m), 122401/(bar).

## 8.3 Type PCM (for AMW, M28x1.5 gas valve) — `PCM-280/70-…`
Accumulator connection **M28x1.5**; bottle 5/8" BSP(M); max 400 bar. Same gauge/hose option structure.

## 8.4 Nitrogen Cylinder Adaptors (for PC/PCM kits)
13 types T1–T13 (all M16x2 kit side), each a fixed part number mapped to a bottle thread (e.g. T1 = I40053 = W21.7x14 (M); T4 = I40055 = 5/8" BSP (M); T10 = I40059 = M22x1.5 (F); T13 = I40042 = 1/2" BSP (F)).

---

# 9. Mounting Accessories — Clamps | Brackets | Support Rings (MA-15-006-R2)

Materials (std): clamp assy galvanised CS + EPDM; bracket assy galvanised CS + nitrile; support ring nitrile; fasteners CS Gr 8.8.

**Clamp assemblies (part # → ØD range → applicable accumulators):**

| Part # | ØD (mm) | AS/ASHF | ASWP | AMW | AP |
|---|---|---|---|---|---|
| CL0100 | 89–93 | 0.7 L | – | – | ø80 |
| CL0201 | 110–114 | 1–3 | – | 0.75 | – |
| CL0202 | 120–125 | 1–3 | – | 0.75 | ø100 |
| CL0204 | 114–120 | 1–3 | – | 0.75 | – |
| CT0702 | 130–136 | – | – | 1 | – |
| CT0700 | 148–150 | – | – | 1.4–2 | ø125 |
| CL0300 | 160–168 | 4–6 | 4–6 | 2.8 | – |
| CL0301 | 163–174 | 4–6 | 4–6 | 2.8–5 | – |
| CL0302 | 185–190 | – | 4–6 | – | – |
| CT0400 | 219–226 | 10–57 | 10–57 | – | ø180 |
| CT0404 | 220–226 | 10–57 | 10–57 | – | – |
| CT0499 | 235–241 | – | 10-57-HP | – | – |
| CT0408 | 254–260 | – | 10-57-HP | – | – |
| CT0413 | 273 | – | 10-57-HP | – | – |
| CT0414 | 355 | 60–130 | – | – | – |

**Brackets:** BA0300 (AS 4-6 | AMW 0.75-2), BA0400 (AS 10-57 | AMW 2.8-5), BA0402 (AS 60-130). **Support rings:** BC0300, BC0400.

---

# 10. Band Clamp — Type CB2 (see Appendix A §12; same product, filed in both folders)

---

## Cross-product relationship map (Accumulators)

- **AS family** → Safety Block B (nipple codes map by AS size), charging kit PC / PC-HP, gas bottles BA/BB/BD + Charging Block BC (transfert configurations), bladder assemblies S/ST/SL, clamps/brackets/rings/band clamps, accumulator stations.
- **AMW** → Charging kit **PCM** (M gas valve) or PC + adaptor (V valve); P valve = non-rechargeable; Safety Block B (G04M/M32M/M33M/M34M nipples); clamps CL0201–CL0301, brackets BA0300/0400.
- **AP** → Safety Block B (long adaptors L05M–L08M by piston ø), charging kit PC, U-clamps 11545–11548, piston seal kits PSK-*, ES/EF/WS/WP/XG/XL/UE/LS position monitoring.
- **APC** → Safety Block B, charging kit PC, U-clamp 11545; only gas fill valve replaceable.
- **PC/PCM kits** → nitrogen cylinder adaptors T1–T13. Pressure-reducing valve mandatory when cylinder pressure > accumulator max permissible; nitrogen only (never air/oxygen).
