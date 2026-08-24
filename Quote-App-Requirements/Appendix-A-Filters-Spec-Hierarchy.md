# Appendix A — Filters: Specification Hierarchies Extracted from Datasheets

Source: 17 datasheets in `EPE/Filters/`. Manufacturer: EPE Process Filters & Accumulators Pvt. Ltd., Hyderabad.

---

## SHARED REFERENCE A — Common "Filtering Media & Filtration Grade" option set (Position 4)

Used identically by: 40/160-LD/LDN, 250/450-FE/FEN, 250/450-LE/LEN, 16-FR/L(N), 10-FRD, 10-FRE, 40/160-LE/LEN, 16/40/45/60-DK, 160-OFM20X, and the Filter Elements catalogue (position 3 there).

| Media family | Description | Codes |
|---|---|---|
| G… | SS wire mesh, cleanable, nominal filtration (with additional epoxy layer upstream for 10/25/40 µm) | **G10, G25, G40, G60, G80, G100** (others on request) |
| P… | Paper, non-cleanable, with epoxy mesh, nominal | **P5, P10, P25** |
| VS… | Non-woven, non-cleanable, with epoxy mesh, nominal | **VS10, VS25, VS40, VS60** |
| H…XL | Glass fibre, non-cleanable, epoxy mesh — absolute (ISO 16889) | **H1XL, H3XL, H6XL, H10XL, H16XL, H20XL** |
| H…XP | Long-life glass fibre, non-cleanable, plastic mesh + outer sleeve | **H3XP, H5XP, H10XP, H15XP, H20XP** |
| H…XE | Long-life glass fibre, non-cleanable, epoxy mesh | **H3XE, H5XE, H10XE, H15XE, H20XE** |
| H…XC | Glass fibre, electrically conductive, non-cleanable, epoxy mesh | **H3XC, H5XC, H10XC, H15XC, H20XC** |
| AS… | Glass fibre + water-absorbing (Aquasorb), non-cleanable, epoxy mesh | **AS1, AS3, AS6, AS10, AS20** |
| M… | SS fibre, cleanable, SS mesh | **M5, M10, M15** |

## SHARED REFERENCE B — Common option codes reused across housings

- **Element Adhesive (pos. 6a):** `0` = standard adhesive T=100 °C (standard) | `1` = epoxy adhesive (for fuels) | `E` = high-temp adhesive T=160 °C.
- **Element Hardware / end caps + inner tube (pos. 6b):** `C` = CS+CS (std on some sheets) | `P` = Polyamide+CS (standard) | `X` = SS+SS | `D` = Nickel-coated CS + Ni-coated CS | `M` = CS + SS. *(M is NOT offered on FR/L, FRD, FRE — return-line series list only C, P, X, D.)*
- **Seal Material (pos. 11):** `P` = Nitrile (standard) | `V` = Viton | `E` = EPDM | `N` = Neoprene | `B` = Butyl. *(DK offers only P, V, E.)*
- **Housing Material (pos. 12):** `0` = standard as per catalogue | `SP` = special. *(DK differs — see DK.)*
- **Maintenance indicator, DP-type family (pos. 9a) — used by LD, FE/FEN, LE (both pressure classes), DK, OFM20X:**
  - `0` without (standard) | `A..` Optical pop-up | `B..` Optical pop-up + Electrical with DIN plug | `D..` Optical pop-up + Electrical with lamp | `T..` Optical + Electrical, 2 switching points (set at 75 % & 100 %) | `AD..` Optical dual dial | `BD..` Optical dual dial + Electrical DIN plug | `DD..` Optical dual dial + Electrical lamp | `SP` special.
  - Companion indicator part numbers (xx = preset ΔP in bar): A = **F-xx-A0-00-00-P**, B = **F-xx-GW-02-00-P**, D = **F-xx-GW-26-00-P**, AD = **FD-xx-A0-00-00-P**, BD = **FD-xx-GW-02-00-P**, DD = **FD-xx-GW-26-00-P**, T = **R-xx-GW-09-Z0-P** (3 LEDs + 2 switching points).
- **Maintenance indicator cracking pressure (pos. 9b) — DP-type family:** `-` without (std) | `..0.8` | `..1.5` | `..2.5` | `..4.2` | `..5.0` | `..6.0` | `..7.0` bar | `……` other pressure as applicable. Standard value depends on series/pressure class (noted per product).
- **Return-line indicator family (pos. 9a) — used by FR/L, FRD, FRE (pressure-type, mounted upstream):**
  - `0` without | `A` Optical manometer 0–6 kg/cm² (**M010**) | `B` Optical manometer 0–25 kg/cm² (**M040**) | `C..` Optical pop-up (**Pxx**) | `D..` Electrical pressure switch NO/closer (**Hxx-HA-32-00-P**) | `F..` Electrical pressure switch NC/opener (**Hxx-HS-32-00-P**) | `G..` Electrical switch-over (**Hxx-GW-33-00-P**) | `K..` Optical+Electrical switch-over + lamp (**Hxx-GS-34-00-P**) | `SP` special.
  - 9b: `-` (std, for A/B) | `..2.5` bar (std for C, D, F, G, K) | other pressure in bar.
- **Electrical connection settings (3-wire):** Closer 1(black)+3(blue); Opener 1(black)+2(brown); Changer 1+2+3.

---

## 1. Low/Medium Pressure Duplex Filter — Type 40/160-LD/LDN
*(Low-Pressure-Duplex-LD-05-001-R9.pdf, ref EPE/05.001/LD Rev.9/09-2024)*

**Description:** Duplex inline-mounted filter for direct pipeline installation; two housings with change-over valve (metal-to-metal sealing) and integral pressure-equalisation valve; change-over handle points to housing in operation. Max pressure **40 bar or 160 bar**; test pressure 1.43×PS (CE/PED) / 1.3×PS (ASME); −20 to +100 °C; connection up to SAE 1-1/2"/SAE-32. Head GGG50, bowl carbon steel (RAL-5010). Element design: LD = EPE standard, LDN = DIN 24550.

**Flow capacity (size → rated flow):** 0005/0040 = 50 lpm; 0008/0063 = 80; 0013/0100 = 130; 0015 = 150; 0018 = 180; 0020/0160 = 200; 0030/0250 = 300; 0045/0400 = 450 lpm.

**Ordering code — Filter (13 positions), example `160-LD-0013-H10XP-A-0P-0-9-A5.0-G06-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Max working pressure | `40` = 40 bar; `160` = 160 bar |
| 2 | Filter type | `LD` = duplex inline, EPE std element; `LDN` = duplex inline, DIN 24550 element |
| 3 | Nominal size | **LD:** 0003 (*2.0004 element*), 0005, 0008, 0013, 0015, 0018, 0020, 0030, 0045. **LDN:** 0040, 0063, 0100, 0160, 0250, 0400. *(Allowed size list depends on filter type LD vs LDN.)* |
| 4 | Filtering media & grade | Shared Reference A (full set incl. M5–M15) |
| 5 | Differential pressure of element | `A` = 30 bar (standard); `D` = 60 bar; `C` = 160 bar |
| 6a | Element adhesive | 0 / 1 / E (Ref. B) |
| 6b | Element hardware | C / **P (std)** / X / D / M |
| 7 | Magnet | `0` without (std); `X` with ring magnet (kept loose under elements) |
| 8 | Bypass valve | `0` without (std); `1` 0.3 bar; `2` 0.8; `3` 1.5; `4` 2.0; `5` 2.5; `6` 3.0; `7` 3.5 (**std for 40-LD/LDN**); `8` 5.0; `9` 7.0 (**std for 160-LD/LDN**); `Bx` special setting. *(Default bypass depends on pressure class.)* |
| 9a | Maintenance indicator type | DP-type family (Ref. B): 0, A.., B.., D.., T.., AD.., BD.., DD.., SP |
| 9b | Indicator cracking pressure | `-`, ..0.8, ..1.5, **..2.5 (std for 40-LD/LDN)**, ..4.2, **..5.0 (std for 160-LD/LDN)**, ..6.0, ..7.0, other. *(Depends on pressure class.)* |
| 10 | Inlet/outlet connections | `G06` 1" BSP(F); `G07` 1-1/4" BSP(F); `G08` 1-1/2" BSP(F); `S083` SAE flanged 3000# SAE 1-1/2"; `S**` SAE straight thread O-ring boss (J1926); `X0` special; `RA0` with adaptor. **Port-size vs housing-size dependency:** sizes 0003–0013 / LDN 0040–0100 → G1" {G06} / SAE threads {S16}, {S20}; sizes 0015–0018 → G1-1/4" {G07} / {S20},{S24}; sizes 0020–0045 / LDN 0160–0250 → G1-1/2" {G08} / {S20},{S24},{S32}; LDN 0400 → SAE 1-1/2" {S083}. |
| 11 | Seal material | P (std) / V / E / N / B |
| 12 | Housing material | 0 (std) / SP |
| 13 | Other options (multiple possible) | `0` without (std); `EP` 1/4" air-vent port plugged; `E` 1/4" BSP air vent valve; `4` 1/4" drain port plugged; `DV` 1/4" CS drain valve in bowl; `DVX` 1/4" SS drain valve in bowl |

**Companion ordering codes:** Filter element `2.0013-H10XP-A-0P-0-P` (positions 3, 4, 5, 6ab, 11 — a **2. Series** element). Seal kit `D-160-LD-0013-A-G06-P-0` (positions 1, 2, 3, 9a, 10, 11).

**Selection/performance:** ΔP curves per size (G06/G07/G08 port) for G10, H10XL, H20XL, P10, H3XL media; recommended initial assembly ΔP 0.8 bar. Tightening torques table by size.

**Related products/spares:** Bypass valve **BYP01/xx** (0003–0013), **BYP02/xx** (0015–0018), **BYP03/xx** (0020–0045); air vent plug/valve **AVP01/AOO001**; drain plug **DBP01**; return valve assemblies LMBB79/LMBD79/LMBF79; change-over valve parts LMBJ12/44/45/18/43/35; maintenance indicators (Ref. B); seal kits; filter elements catalogue.

---

## 2. High Pressure Filter, Manifold Mounting — Type 250/450-FE/FEN
*(High-Pressure-Manifold-FE-04-002-R9.pdf, ref EPE/04.002/FE Rev.9/09-2024)*

**Description:** Simplex manifold-mounted high-pressure filter (direct manifold mounting, no piping); inlet/outlet on same plane, inlet on top. **250 or 450 bar**; −20 to +100 °C; connection up to DN50. Head GGG50, bowl carbon steel (RAL-5010). FE = EPE-standard elements, FEN = DIN 24550 elements.

**Flow capacity:** 0005/0040 = 50 lpm; 0008/0063 = 80; 0013/0100 = 130; 0015 = 150; 0018 = 180; 0020/0160 = 200; 0030/0250 = 300; 0045/0400 = 450; 0095/0630 = 950; 0145/1000 = 1450 lpm.

**Ordering code, example `450-FE-0013-H10XP-A-0P-0-0-A5.0-DN14-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `250` / `450` |
| 2 | Filter type | `FE` (EPE std) / `FEN` (DIN 24550) |
| 3 | Nominal size | **FE:** 0003 (*2.0004 element*), 0005, 0008, 0013, 0015, 0018, 0020, 0030, 0045, 0095, 0145. **FEN:** 0040, 0063, 0100, 0160, 0250, 0400, 0630, 1000. *(Depends on pos. 2.)* |
| 4 | Media & grade | Shared Reference A |
| 5 | Diff. pressure of element | `A` 30 bar (std); `D` 60; `C` 160; `B` 330 bar |
| 6a | Adhesive | 0 / 1 / E |
| 6b | Hardware | C (std) / P (std) / X / D / M |
| 7 | Magnet | `0` (std) / `X` with ring magnet |
| 8 | Bypass valve | `0` without (std); `*` with bypass valve **(on request only)** |
| 9a | Indicator type | DP-type family (Ref. B) |
| 9b | Cracking pressure | `-`, ..0.8, ..1.5, ..2.5, ..4.2, **..5.0 (standard)**, ..6.0, ..7.0, other |
| 10 | Inlet/outlet connections | `DN14`, `DN18`, `DN32`, `DN50`. **Dependency:** FE 0003–0013 / FEN 0040–0100 → DN14; FE 0015–0018 → DN18; FE 0020–0045 / FEN 0160–0400 → DN32; FE 0095–0145 / FEN 0630–1000 → DN50. |
| 11 | Seal | P/V/E/N/B |
| 12 | Housing material | 0 / SP |
| 13 | Other options (multiple) | `0` without; `4` 1/4" drain port plugged; `DV` 1/4" CS drain valve in bowl; `DVX` 1/4" SS drain valve in bowl |

**Companion codes:** Element `2.0013-H10XP-A-0P-0-P`; Seal kit `D-450-FE-0013-A-DN14-P-0`.

**Selection tables:** mounting-bolt/torque table per size (M12/M16/M20/M24); dimension/weight/capacity tables; ΔP curves per size, recommended initial ΔP 1.5 bar. FE 0145/FEN 1000 have separate bottom-bowl design. PED note: exempt per Art. 1 Sec. 2(f), no CE mark.

---

## 3. High Pressure Filter, Inline Mounting — Type 250/450-LE/LEN
*(High-Pressure-Inline-LE-04-001-R9.pdf, ref EPE/04.001/LE Rev.9/09-2024)*

**Description:** Simplex inline high-pressure filter, inlet/outlet on opposite sides. **250/450 bar**; connection up to SAE 2-1/2"/SAE-32; head GGG50, bowl CS; LE = EPE std, LEN = DIN 24550. Same flow-capacity table as FE/FEN (50→1450 lpm).

**Ordering code, example `450-LE-0013-H10XP-A-0P-0-9-A5.0-G05-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `250` / `450` |
| 2 | Type | `LE` / `LEN` |
| 3 | Nominal size | **LE:** 0005, 0008, 0013, 0015, 0018, 0020, 0030, 0045, 0095, 0145. **LEN:** 0040, 0063, 0100, 0160, 0250, 0400, 0630, 1000 |
| 4 | Media & grade | Reference A |
| 5 | Diff. pressure | A 30 (std) / D 60 / C 160 / B 330 bar |
| 6a/6b | Adhesive / hardware | 0-1-E / C(std)-P(std)-X-D-M |
| 7 | Magnet | 0 (std) / X ring magnet |
| 8 | Bypass valve | `0` without (std); `3` 1.5 bar; `5` 2.5 bar; `7` 5.0 bar; `9` 7.0 bar (**preferred**); other pressures on request |
| 9a | Indicator | DP-type family (Ref. B) |
| 9b | Cracking pressure | -, ..0.8, ..1.5, ..2.5, ..4.2, **..5.0 (preferred)**; others on request |
| 10 | Connections | `G05` 3/4" BSP(F); `G06` 1" BSP(F); `G07` 1-1/4" BSP(F); `S086` SAE flanged 6000# 1-1/2"; `S096` SAE 6000# 2"; `S106` SAE 6000# 2-1/2"; `S**` SAE J1926 O-ring boss; `X0` special; `RA0` adaptor. **Dependency:** 0005–0013/0040–0100 → G05 (std) or G06 + S12/S16/S20/S24; 0015–0018 → G06 + S16/S20/S24/S32; 0020–0045/0160–0400 → G07 or S086 + S16/S20/S24/S32; 0095/0630 → S096; 0145/1000 → S106. |
| 11–12 | Seal / housing | P/V/E/N/B; 0/SP |
| 13 | Other options | 0; `4` drain port plugged; `DV` CS drain valve; `DVX` SS drain valve |

**Companion codes:** Element `2.0013-H10XP-A-0P-0-P`; Seal kit `D-450-LE-0013-A-G05-P-0`.

**Related/spares:** Bypass valve **BYP01/xx** (0005–0013), **BYP02/xx** (0015–0018), **BYP03/xx** (0020 up); DBP01 drain plug; indicators; ΔP curves per size, initial ΔP 1.5 bar; torque tables.

---

## 4. Returnline Inline Filter, Tank-top/Line Mounting — Type 16-FR/L / FR/LN
*(Return-Line-FR-L-07-002-R4.pdf, ref EPE/07.002/FRL Rev.4/09-2024)*

**Description:** Simplex tank-top/line-mounted return-line filter; inlet on top outside tank, outlet discharges into tank; usable as low-pressure line filter. **16 bar**; up to SAE 4"/SAE-64; cover & housing aluminium alloy. Bypass valve assembled in the **top cover**.

**Flow capacity:** 0020/0160 = 200 lpm; 0030/0250 = 300; 0045 = 450; 0060/0400 = 600; 0095/0630 = 950; 0120 = 1200; 0145/1000 = 1450; 0200 = 2000; 0270 = 2700 lpm.

**Ordering code, example `16-FR/L-0045-H10XP-A-0P-0-7-D2.5-G08-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `16` only |
| 2 | Type | `FR/L` (EPE std) / `FR/LN` (DIN 24550) |
| 3 | Nominal size | **FR/L:** 0020, 0030, 0045, 0060, 0095, 0120, 0145, 0200, 0270. **FR/LN:** 0160, 0250, 0400, 0630, 1000 |
| 4 | Media & grade | Reference A |
| 5 | Diff. pressure of element | `A` = 30 bar (**sizes 0020–0120**); `0` = 15 bar (**sizes 0145–0270**). *(Depends on size.)* |
| 6a | Adhesive | 0/1/E |
| 6b | Hardware | C / **P (std)** / X / D (**no M option**) |
| 7 | Magnet | `0` without (only option) |
| 8 | Bypass valve | `0` without; `7` = 3.5 bar (**standard**); others on request. (Bypass assembled in top cover) |
| 9a | Indicator type | Return-line family (Ref. B): 0, A, B, C.., D.., F.., G.., K.., SP |
| 9b | Cracking pressure | `-` (std); `..2.5` (std for C, D, F, G, K); other in bar |
| 10 | **Inlet** connection | `G07` 1-1/4" BSP(F); `G08` 1-1/2" BSP(F); `S073` SAE #3000 flange 1-1/4"; `S083` SAE #3000 1-1/2"; `S093` SAE #3000 2"; `S103` SAE #3000 2-1/2"; `S113` SAE #3000 3"; `S133` SAE #3000 4"; `Syy` SAE J1926 O-ring boss; `RA0` adaptor. **Dependency:** 0020–0045/0160–0250 → G07/G08/S073/S083/S16/S20/S24; 0060–0120/0400–0630 → S093; 0145–0270/1000 → S103/S113/S133/S32/S40. |
| 11–12 | Seal / housing | P/V/E/N/B; 0/SP |
| 13 | Other options (multiple) | `0` without; `EP` 1/4" air-vent port plugged; `E` 1/4" BSP air vent valve; `H` element with handle |

**Companion codes:** Element `1.0045-H10XP-A-0P-0-P` (**1. Series** element); Seal kit `D-16-FR/L-0045-D-G08-P-0`.

**Spares:** housing gasket, top-cover O-ring, bypass valve assy, air vent plug **AVP01**, electrical indicator + pressure gauge; M12×1.5–45 mm mounting bolt set.

---

## 5. Inline Filters — 40 FLE 0020(C)–0270(C) / 40 FLEN 0160–1000
*(Inline-Filters-40-FLE-0020-0270.pdf, ref EPE/40-FLE/R.01 (01-12); older-generation sheet)*

**Description:** Inline filters designed for offline filtration; modular 3-part design (bowl with inlet/outlet, filter body, threaded filter head); ECO Pore elements with reusable core (coreless "C" sizes); **40 bar**, −10 to +100 °C, connection up to SAE 4".

**Ordering information (example `40 FLE 0270 H10XL-0 00-0 B2,5-S0 P 0 B`):**

| Segment | Options |
|---|---|
| Series prefix | `40` (pressure) |
| Filter type | `FLE` = element per EPE standard; `FLEN` = element per DIN 24550 |
| Nominal size | **40 FLE:** 0020(C), 0030(C), 0045(C), 0060(C), 0095(C), 0120(C), 0145(C), 0200(C), 0270(C) — "C" = coreless element variant; **40 FLEN:** 0160, 0250, 0400, 0630, 1000 |
| Filter media & grade | G10–G100; VS 25/40/60; P5/P10/P25; H1XL–H20XL (absolute ISO 16889); AS1–AS20 (water absorbing) |
| Magnet | `0` = without |
| Maintenance indicator | `0` without; `A..` visual; `B..` visual/electrical with plug; `D..` visual/electrical with signal lights, two switching points |
| Diff. pressure (element) | `A` = 30 bar; `0` = 15 bar — **only for sizes 0145, 0200, 0270** *(size dependency)* |
| Element model | `0..` = standard adhesive T=150 °C; `E..` = special adhesive T=160 °C; suffix `-O` = standard material, `-Z` = zinc free |
| Bypass valve | `0` without; `7` = 3.5 bar (bypass sits in housing; element always 0) |
| Connection | `S0` = SAE flange (SAE 3"/#3000 DN50 for 0020–0120 & FLEN 0160–0630; SAE 4"/#3000 DN80–DN100 for 0145–0270 & FLEN 1000) |
| Seal | P / V / E / N |
| Material | `0` = standard |
| Addl. info | `0` without; `1` = 'A' indicator for FLE 0145(C)–0270(C); `2` = 'B' indicator for same; `5` = silicon free; `B` = using clamp; `E` = vent valve; `Z` = documentation |

**Companion codes:** Element `1.0270 H10XL-0 00-0 P`; Seal kit `D 40 FLE 0270 – B – S0 P 0`. This housing family is the main filter used on NFF2 offline carts (item 17).

---

## 6. Duplex Return Line Filter, Tank-top — Type 10-FRD
*(Duplex-Return-Line-FRD-08-001-R3.pdf, ref EPE/08.001/FRD Rev.3/09-2024)*

**Description:** Duplex tank-top return-line filter = two simplex return filters joined by a **3-way ball valve** (common inlet; handle points to housing in operation); optional integral breather. **10 bar**; up to 1-1/2" BSP(F)/SAE-20; head aluminium alloy; cover & bowl carbon-reinforced plastic. EPE-standard element only.

**Flow capacity:** 0005 = 50 lpm; 0008 = 80; 0013 = 130; 0015 = 150; 0018 = 180 lpm.

**Ordering code, example `10-FRD-0013N-H10XP-A-0P-0-0-D2.5-G06-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `10` only |
| 2 | Type | `FRD` |
| 3 | Nominal size | Without bypass: **0005N–0018N**; with bypass: **0005B–0018B**. *(Bypass presence is baked into the size code — N vs B; bypass valve is assembled in the element.)* |
| 4 | Media & grade | Reference A |
| 5 | Diff. pressure | `A` = 30 bar (only option) |
| 6a | Adhesive | 0/1/E |
| 6b | Hardware | C / P(std) / X / D (no M) |
| 7 | Magnet | `0` only |
| 8 | Bypass valve | `0` (std for …N sizes); `7` = 3.5 bar (std for …B sizes); others on request. *(Must match N/B suffix of pos. 3.)* |
| 9a/9b | Indicator | Return-line family (Ref. B); 9b `-` std, ..2.5 std for C/D/F/G/K |
| 10 | Inlet connection | `G05` 3/4" BSP(F) (**0005–0013 only**); `G06` 1" BSP(F) (**0005–0013**); `G07` 1-1/4" BSP(F) (**0015–0018**); `G08` 1-1/2" BSP(F) (**0015–0018**); `S**` SAE J1926; `RA0` adaptor |
| 11–12 | Seal / housing | P/V/E/N/B; 0/SP |
| 13 | Other options (multiple) | `0`; `EP` air-vent port plugged (**versions w/o indicator**); `E` air vent valve (**w/o indicator**); `F` = with breather filter |

**Companion codes:** Element `1.0013N-H10XP-A-0P-0-P` (element carries the bypass). Breather element `7.0003-P10-0-00-0-0` (7. Series). Seal kit `D-10-FRD-0013N-D-G06-P-0`.

**Spares:** bypass valve **BYP-FRE-01/xx** (0005–0013) / **BYP-FRE-02/xx** (0015–0018); compression springs **CSP-FRE-01/-02**; breather element; indicators.

---

## 7. Mounting Accessories — Clamp | Bracket (MA-15-006-R2)

Fixed part numbers — no configurable code. See Appendix B §9 for the full clamp/bracket/support-ring compatibility table (accumulator-facing accessory, duplicated in both folders).

---

## 8. Filter Elements (Master Catalogue)
*(Filter-Elements-10.001-R7.pdf, ref EPE/10.001 Rev.7/09-2024)*

**Description:** Replacement/OEM filter elements for all EPE housings. Star-pleated media on perforated tube (coreless available), 2-component adhesive, metal/plastic end caps, O-ring or profile seal. Filtration 1–1500 µm; area 10 cm²–6.2 m²+; βx = 1000; achievable cleanliness up to ISO 12/8/3 (ISO 4406).

**Ordering code (8 positions), example `1.0013-H10XL-A-0P-0-P--/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Element series | `1` = both sides open; `2` = one side open; `3` = one side open with bypass; `7` = both sides open, PU end caps (breather elements) |
| 2 | Nominal size (**depends on series + design figure**) | **1. Series:** Fig.1 both-open O-ring: 0005–0297 (0005, 0008, 0013, 0015, 0018, 0020, 0030, 0045, 0060, 0095, 0120, 0145, 0200, 0270, 0297) · Fig.2 coreless: 0020C–0270C · DIN-24550: 0040, 0063, 0100, 0160, 0250, 0400, 0630, 1000 · Fig.5 one-open + bypass: 0005B–0018B · Fig.6 one-open w/o bypass: 0005N–0018N · Fig.4 both open unsealed: 10, 18, 32, 56, 90, 140, 225, 225/360, 225/450 · Fig.3 flat-washer sealing: 360, 560, 900, 1400, 1800 · Fig.1 O-ring: 361, 451, 561, 901, 1401, 1801. **2. Series (Fig.7/8, one side open):** 0004, 0005, 0008, 0013, 0015, 0018, 0020, 0030, 0045, 0095, 0145; DIN: 0040–1000; also 10–900; Fig.8 (FRE-0003): 0003. **3. Series (Fig.9):** 0003 one-open with bypass. **7. Series (Fig.10, breather elements):** 001, 002, 004, 006, 007 |
| 3 | Media & grade | Reference A (full set) |
| 4 | Diff. pressure | `0` = 15 bar (**for 1.0145/0200/0270/0297/1000**); `A` = 30 bar (std); `D` = 60; `C` = 160; `B` = 330; `S` = standard (**breather elements**) *(size/series dependency)* |
| 5a | Adhesive | 0 (std) / 1 / E |
| 5b | Hardware | C (std) / P (std) / `U` = PU + CS (**standard for 7. Series**) / X / D / M |
| 6 | Bypass valve | `0` without (std); `7` = 3.5 bar (**only Figs. 5 & 9, i.e. …B / 3.0003 designs**) |
| 7 | Seal material | `0` = without (**Figs. 4 & 10**); P (std) / V / E / N / B |
| 8 | Other options (multiple) | `-` without (std); `H` with handle; `Sp` special |

**Selection guidance tables:** target-cleanliness → media recommendation (H1XL servo, H3XL servo valves, H6XL proportional >160 bar, H10XL industrial directional valves, H20XL large-tolerance); β-value tables; Aquasorb water-absorption capacities and viscosity derating; cleanability rules (G10–G40 & M5/M10 ~10 washes); test standards ISO 2941/2942/2943/3724/3968/16889.

---

## 9. High Pressure Duplex Filters — 250/450 LD/LDN
*(High-Pressure-Duplex-Filters-250-450-LD.pdf, ref EPE/450-LD/R.01 (01-12); older-generation sheet)*

**Description:** Duplex inline high-pressure filters for continuous operation; head with switching valve; pressure-equalisation valve for change-over. **250/450 bar**, connections up to SAE 2". Recommended initial ΔP 2.0 bar (250) / 2.5 bar (450).

| Segment | Options |
|---|---|
| Pressure | `250` / `450` |
| Filter type | `LD` (EPE std element, 2. Series) / `LDN` (DIN 24550) |
| Nominal size | **LD:** 0003–0045; **450 LD only:** 0095, 0145; **LDN:** 0040–0400; **450 LDN only:** 0630, 1000. *(Size availability depends on pressure class.)* |
| Media & grade | G10–G100; VS 25/40/60; P5–P25; H1XL–H20XL; AS1–AS20 |
| Magnet | `0` = without |
| Diff. pressure (element) | `A` = 30 bar; `B` = 330 bar; `C` = 160 bar |
| Element model | `0..` std adhesive T=100 °C; `E..` special T=160 °C; `..O` std material; `..Z` zinc free |
| Bypass valve | `0` = without (only option) |
| Maintenance indicator | `0` / `A` visual / `B` visual-electrical connector / `D` visual-electrical 2 switching points. Std switch pressure 2.5 bar. Part numbers: A5,0 = **F5,0 A0 00 0P**; B5,0 = **F5,0 GW 02 00P**; D5,0 = **R5,0 GW 09 Z0P** |
| Connection | `R0` pipe thread (**0003–0013 / LDN 0040–0100**); `SO` SAE flange (**0015–0145 / LDN 0160–1000**). Physical: G½ (small) → SAE 1"/1½"/2" 6000 psi by size band |
| Seal | P / V / E / N |
| Material | `0` standard |
| Addl. info | `0`; `4` drain plug; `5` silicon free; `A` pressure-equalisation line; `E` vent valve; `Z` inspection certificate |

**Companion codes:** Element `2.0013 H10XL-B 00-0-P-`; Seal kit `D 250 LD 0013 – B – R0 P 0`. Spare-parts list with fixed part numbers (levers, change sleeve, vent valve, measuring connection). Warning: never operate switching device while a housing is out of service.

---

## 10. Return Line Filter, Tank-top — Type 10-FRE
*(Return-Line-FRE-07-001-R5.pdf, ref EPE/07.001/FRE Rev.5/09-2024)*

**Simplex** version of the FRD (item 6). Identical ordering-code structure and option sets except position 2 = `FRE`. Sizes 0005N/B–0018N/B; same media, indicator, connection dependencies; pos 13 includes `F` = with breather filter. Companion codes: Element `1.0013N-…`, Breather element `7.0003-P10-0-00-0-0`, Seal kit `D-10-FRE-…`.

---

## 11. Low/Medium Pressure Filter, Inline — Type 40/160-LE/LEN
*(Low-Pressure-Inline-LE-02-001-R9.pdf, ref EPE/02.001/LE Rev.9/09-2024)*

**Description:** Simplex inline filter, **40/160 bar**, up to G1-1/2"/SAE-24; head **aluminium alloy**, bowl carbon steel. LE = EPE std, LEN = DIN 24550. Flow: 0005/0040 = 50 … 0045/0400 = 450 lpm.

**Ordering code, example `160-LE-0013-H10XP-A-0P-0-9-A5.0-G06-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `40` / `160` |
| 2 | Type | `LE` / `LEN` |
| 3 | Nominal size | LE: 0005–0045; LEN: 0040–0400 |
| 4 | Media | Reference A |
| 5 | Diff. pressure | A 30 (std) / D 60 / C 160 bar |
| 6a/6b | Adhesive/hardware | 0-1-E; C/P(std)/X/D/M |
| 7 | Magnet | 0 (std) / X ring magnet |
| 8 | Bypass valve | 0 (std), 1 = 0.3, 2 = 0.8, 3 = 1.5, 4 = 2.0, 5 = 2.5, 6 = 3.0, **7 = 3.5 (std for 40)**, 8 = 5.0, **9 = 7.0 (std for 160)**, Bx special |
| 9a | Indicator | DP-type family (Ref. B) |
| 9b | Cracking pressure | **..2.5 std for 40**; **..5.0 std for 160**; plus 0.8/1.5/4.2/6.0/7.0/other |
| 10 | Connections | `G06`, `G07`, `G08`, `S**` SAE J1926, `X0`, `RA0`. **Dependency:** 0005–0013/0040–0100 → G06 {S16}; 0015–0018 → G07 {S16/S20/S24}; 0020–0045/0160–0400 → G08 {S24}. |
| 11–12 | Seal/housing | P/V/E/N/B; 0/SP |
| 13 | Other options (multiple) | 0; `EP`; `E`; `4`; `DV`; `DVX`; **`3I` = design with 3 mounting inserts** |

**Companion codes:** Element `2.0013-H10XP-A-0P-0-P`; Seal kit `D-160-LE-0013-A-G06-P-0`. Spares: BYP01/02/03, AVP01, AOO001, DBP01, indicators.

---

## 12. Band Clamp with Swivel Bolt — Type CB2
*(BandClampwithSwivel.pdf, ref EPE/15.006-CB2 Rev.0/04-2026)*

Accumulator band clamp, SS ferritic band, EPDM lining, swivel bolts both ends. Ordering code `CB2-198/221-X-E-M10/90-Zn`: type, diameter from/to (13 catalogue sizes 89/106 → 261/284), clamp MOC `X` SS (std), lining `E` EPDM (std), bolt thread M10 (std), bolt length 90 (std)/45, plating Zn (std).

---

## 13. Filler Breathers — Type TLF I / II / III
*(Breathers-TLF-Jan-12.pdf, ref EPE/TLF/01 R.02 (01-12))*

**Description:** Tank-mounted air breather / combined breather-filler; air flow up to 5000 m³/h; connection up to G3 / DN125. **TLF I** = female thread; **TLF II** = male thread; **TLF III** = male thread + DIN flange + **filler strainer**.

| Segment | Options |
|---|---|
| Filter type | TLF I / TLF II / TLF III |
| Nominal size | All types: **1-25, 2-32, 3-40, 4-50, 5-65, 6-80**; TLF I & III only: **7-125** *(7-125 not available for TLF II)* |
| Filtration grade | G10–G100; VS 25/40/60; P5–P25; H1XL–H20XL; AS1–AS20 |
| Magnet | `0` |
| Maintenance indicator | `0` (breathers have none — replace on schedule) |
| Diff. pressure | `S` = standard |
| Element design | `0..` std adhesive T=80 °C; `..0` std material; `..Z` zinc free |
| Bypass valve | `0` |
| Connection | `00` standard |
| Seal | `O` without; `P` Buna-N |
| Material | `0` standard |
| Addl. info | `0`; `5` silicon free; `E` vent valve; `Z` inspection certificate; element-level: S silicon free, `C` silicagel, Z certificate |

**Element size dependency (housing → element):** 1-25 & 2-32 → **002**; 3-40/4-50/5-65 → **004**; 6-80 → **006**; 7-125 → **007** (7. Series elements). Note: "Seal kit is not possible" for this family. Service intervals 3000–4000 h by environment.

---

## 14. Duplex Filters with Segment Change-over — 25-FLD / 25-FLDN
*(25-FLD.pdf, ref EPE/25-FLD Rev.0/08-2018)*

**Description:** Large duplex filters: two inline filters connected via a control housing with **segment change-over**; **25 bar; up to 2700 lpm; DN-100 square flange**. Sizes: 25 FLD 0145 (2×12 L), 0200 (2×22 L), 0270 (2×28 L); 25 FLDN 1000. This 2-page sheet has no positional ordering-code table — element selection defers to the Filter Elements datasheet (1. Series 0145/0200/0270/1000, ΔP option 0 = 15 bar); indicator options: Optical / Optical-Electrical / DP Gauge / DP Switch; optional bypass, vent, drain valves.

---

## 15. Low/Medium Pressure Duplex Filter, Ball Valve Changeover — Type 16/40/45/60-DK
*(Low-Pressure-Duplex-DK-06-001-R3.pdf, ref EPE/06.001/DK Rev.3/08-2023)*

**Description:** Large fabricated duplex filter: two vertical housings connected by change-over assembly = two 3-way ball valves on a common handle + integral pressure-equalisation valve. **16/40/45/60 bar**; up to 6" ANSI; housing CS or SS.

**Flow capacity:** 0020 = 200 … 0297 = 2950 lpm.

**Ordering code, example `60-DK-0045-H10XP-A-0P-2-9-AD5.0-S093-P-0-0/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Max working pressure | `16`, `40`, `45`, `60` bar |
| 2 | Filter type | `DK` |
| 3 | Nominal size | **Pressure–size dependency:** 60/45/16 → 0020, 0030, 0045; 45/16 → 0060, 0095, 0120, 0145, 0200, 0270; 40/16 → 0297 |
| 4 | Media | Reference A |
| 5 | Diff. pressure | `A` = 30 bar (**std 0020–0120**); `0` = 15 bar (**std 0145+**) |
| 6a | Adhesive | 0/1/E |
| 6b | Hardware | C / **P (std)** / X / D / M |
| 7 | Magnet | `0` (std); `2` = with magnet |
| 8 | Bypass valve | `0` (std); `7` = 3.5 bar; `9` = 7.0 bar; others on request |
| 9a | Indicator type (**multiple possible**) | DP family 0/A../B../D../T../AD../BD../DD.. **plus** `G..` DP Gauge; `S..` DP Switch; `X..` DP Gauge cum Switch |
| 9b | Cracking pressure | `-` (std); `..2.5` (**for 3.5 bar bypass**); `..5.0` (**for 7.0 bar bypass**); other. *(Depends on pos. 8.)* |
| 10 | Inlet/outlet connections | `S093` SAE #3000 2" (**0020–0045**); `S103` 2-1/2" (**0060–0120**); `S113` 3" (**0060–0120**); `S133` 4" (**0145–0297**); `A171` ANSI Cl.150 6" (**0297**); `A172` ANSI Cl.300 6" (**0297**); `X0` others |
| 11 | Seal | P (std) / V / E only |
| 12 | Housing material | `0` = carbon steel (std); `N` = nickel-coated CS; `X` = stainless steel |
| 13 | Other options (multiple) | `0` vent & drain plugged (std); `E` air vent valve; `DV` CS drain valve; `H` element with handle; `MF` mating flanges; `FB` foundation bolts; `SP-xxx` special |

**Companion codes:** Element `1.0045-H10XP-A-0P-0-P-[pos13]`; Seal kit `D-60-DK-0045-A-S093-P-0`.

**Spares:** pressure plate assy PRP04–07 by size band; bypass valve assy BYP04–07/xx; change-over valve assy; pre-equalisation valve; vent/drain plugs. Detailed service procedure printed on pp. 10–11.

---

## 16. Heavy Duty Filter, Inline — Type 160-OFM20X
*(Heavy-Duty-Inline-OFM_02-002-R5.pdf, ref EPE/02.002/OFM20X Rev.5/09-2024)*

**Description:** Simplex inline heavy-duty filter, radial-sealed bowl; **160 bar**; connection SAE 1-1/2"/G1-1/2"; head GGG40/GGG50, bowl CS. Flow: 0020 = 200; 0030 = 300; 0045 = 450 lpm.

**Ordering code, example `160-OFM20X-0030-H10XP-A-0P-0-0-A5.0-G08-P-0-IL/`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Pressure | `160` only |
| 2 | Type | `OFM20X` |
| 3 | Nominal size | `0020`, `0030`, `0045` |
| 4 | Media | Reference A |
| 5 | Diff. pressure | A 30 (std) / D 60 / C 160 |
| 6a/6b | Adhesive/hardware | 0-1-E; C/P(std)/X/D/M |
| 7 | Magnet | `0` only |
| 8 | Bypass valve | 0 (std), 1–9 (0.3–7.0 bar), Bx special |
| 9a | Indicator type | `0`; DP indicators `A..`, `B..`, `D..`, `T..`; **pressure switches (mounted upstream):** `PSD..` NO (**Hxx-HS-32-00-P**), `PSF..` NC (**Hxx-HA-32-00-P**), `PSG..` switch-over (**Hxx-GW-33-00-P**), `PSK..` optical+electrical switch-over + lamp (**Hxx-GS-34-00-P**) |
| 9b | Cracking pressure | `-`; 0.8/1.5/**2.5 (std for pressure-switch family)**/4.2/**5.0 (std for DP family)**/6.0/7.0/other. *(Depends on indicator family in 9a.)* |
| 10 | Connections | `G08` 1-1/2" BSP(F) (std); `SOU` SAE 1-1/2" #3000 UNC; `SOM` SAE 1-1/2" #3000 metric; `S24` 1-7/8-12UN SAE J1926/1; `RA0` adaptor |
| 11–12 | Seal / housing | P/V/E/N/B; 0/SP |
| 13 | Other options (multiple) | `0` std without indicator ports; `IL` **(standard)** Design-1: inlet left, indicator front; `IR` Design-2: inlet right; `EP`; `E`; `4` |

**Companion codes:** Element `2.0030-H10XP-A-0P-0-P`; Seal kit `D-160-OFM20X-0030-A-G08-P-0`.

---

## 17. Offline Filtration Systems — 15…170 NFF2 0020–0270
*(Offline-System-NFF2-Nov-11.pdf; older-generation sheet)*

**Description:** Mobile filtration carts (2- or 4-wheel) with motor-pump and EPE-series filters, for offline/kidney-loop filtration. Flow **10–170 l/min**; pump max 8 bar; 415 V/50 Hz motors. Each system model is a **fixed BOM** of main filter + main element + suction filter + suction element + motor + cart:

| System | Flow | Main filter | Main element | Suction filter | Motor | Mount |
|---|---|---|---|---|---|---|
| 15 NFF2 0020 | 15 l/min | 40 FLE 0020 | 1.0020 | 40 LE 0008 G800 | 1 HP | 2 wheels |
| 20 NFF2 0020 | 20 l/min | 40 FLE 0020 | 1.0020 | 40 LE 0008 G800 | 1 HP | 2 wheels |
| 40 NFF2 0045 | 40 l/min | 40 FLE 0045 | 1.0045 | 40 LE 0015 G800 | 1.5 HP | 2 wheels |
| 80 NFF2 0120 | 80 l/min | 40 FLE 0120 | 1.0120 | 40 LE 0020 G800 | 3 HP | 2 wheels |
| 120 NFF2 0200 | 120 l/min | 40 FLE 0200 | 1.0200 | 40 FLE 0020 G800 | 5 HP | 2 wheels |
| 145 NFF2 0270 | 145 l/min | 40 FLE 0270 | 1.0270 | 40 FLE 0020 G800 | 7.5 HP | 4 wheels |
| 170 NFF2 0270 | 170 l/min | 40 FLE 0270 | 1.0270 | 40 FLE 0020 G800 | 7.5 HP | 4 wheels |

All systems: 2 m hose + 1 m lance; visual + electric maintenance indicator {F2,5 GW 02 00P}; suction element reusable SS mesh 800 µ. Sizing guidance: circulation factor by reservoir volume; achievable ISO 4406 class by media (H1XL → 12/9/5, H3XL → 13/11/8, H10XL → 17/15/12 at factor 5). Optional integrated **particle counter** with ISO/SAE class output + PC software.

---

## Cross-cutting notes (Filters)

1. **Universal 13-position code layout** for the modern (Rev-series) housings: 1 Pressure — 2 Filter type — 3 Nominal size — 4 Media+grade — 5 Element ΔP — 6a Adhesive — 6b Hardware — 7 Magnet — 8 Bypass — 9a Indicator type — 9b Indicator cracking pressure — 10 Connection — 11 Seal — 12 Housing material — 13 Other options (multi-select), with trailing `/□` free field.
2. **Key dependency patterns:** size list depends on filter type (EPE vs DIN 24550); connection/port code depends on nominal size (every housing); default bypass and default indicator cracking pressure depend on pressure class (LD/LE 40 vs 160), on chosen bypass (DK), or on indicator family (OFM20X); element ΔP option depends on size (FR/L, DK, elements ≥0145); N/B size suffix must match bypass position (FRD/FRE); DK size availability depends on pressure class; TLF 7-125 not available as TLF II; element series/figure constrains size list.
3. **Every housing has three linked codes:** the filter assembly, the replacement **filter element** (1./2./3./7. Series), and the **seal kit** (`D-…`), each built from a defined subset of the filter's positions — plus indicator part numbers (F-xx/FD-xx/R-xx/Hxx/M010/M040/Pxx) and fixed spare part numbers (BYP01–07, BYP-FRE-01/02, CSP-FRE-01/02, AVP01, AOO001, DBP01, PRP04–07).
4. Footnote "Before ordering, check for availability" applies catalogue-wide; magnets supplied loose under elements where option X exists; PED: pressure-line/return-line filters exempt under Art. 1 Sec. 2(f), no CE mark.
