# Appendix C — Pressure/Temperature Switches & Valves: Specification Hierarchies

Source: 11 PDFs in `EPE/Switches/`, 3 PDFs in `EPE/Valves/`. Manufacturer: EPE Process Filters & Accumulators Pvt. Ltd., Hyderabad.

## Important file-content findings

1. **Valves folder = duplicates only.** All three files in `Valves/` are byte-identical to `Switches/PST1Rev.pdf`. No distinct valve-folder product.
2. **`PST1Rev.pdf` is mislabeled — it is NOT a pressure switch.** Its content is the **PRV.. Pressure Relief Valve (PRVS/PRVK)** datasheet. There is no PST1 pressure-switch datasheet anywhere in these folders — if a PST1 switch exists in EPE's range, its datasheet is missing.
3. **`PSVMRev.pdf` is also mislabeled** — its content is the **PSBM** pressure switch (block type, threaded, with gauge). No "PSVM" product exists in these files.

**Distinct products found (11):** PRV (PRVS/PRVK) relief valve; PST2, PST3, PSTM, PSTY pressure switches; PSB1, PSB2, PSB3, PSBM block pressure switches; TST1, TST2 temperature switches.

---

## 1. PRV.. — Pressure Relief Valve, Direct Acting (Series PRVS / PRVK)

**Overview:** Direct-acting screw-in cartridge relief valve; poppet-seat design (with damping piston) up to 400 bar, ball design at 630 bar. NG10; cavity M35x1.5; max inlet 630 bar, outlet 315 bar. ISO 4126-1 / ISO 12516-2; PT = 1.43×PS (CE/PED). Temp −20…+80 °C. Body CS or SS; seals nitrile/Viton. Adjustment: set-screw (PRVS) or knob (PRVK), lockable.

**Ordering code — 8 positions `[1]-[2]-[3]/[4][5][6][7][8]`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Series | **PRVS** = with set screw; **PRVK** = with knob |
| 2 | Size | **10** = NG10 (only option) |
| 3 | Pressure rating | **025**, **050**, **100**, **200**, **315**, **400** (all poppet-seat design); **630** (ball design) |
| 4 | Set pressure | blank = not set (std); **xxx** = set relief pressure in bar |
| 5 | Body | blank = carbon steel (std); **X** = SS316L |
| 6 | Sealing | blank = NBR (std); **V** = Viton |
| 7 | Certification | blank = factory (std); **8** = CE/PED; **1** = EAC |
| 8 | Pressure adjustment | blank = adjustable (std); **S** = factory preset & sealed **(only with PRVS)** |

**Dependencies:** Pos 3 determines internal design (poppet vs ball); Pos 8 `S` valid only with PRVS; Pos 4 set pressure must lie within Pos 3 rating. Footnote: "Before ordering, check for availability."

---

## 2. PST2 — Pressure Switch with Cable, External Setting Knob

**Overview:** Diaphragm switch with lockable external setting knob, 3-wire cable, SPDT change-over. Adjustable 0.5–12 bar; max system 40 bar. 1/8" BSP(M); ±1% reproducibility; −20…+110 °C; 5M cycles; body brass, seal NBR. Max 3 A 250 VAC; cable 2 m (Red COM / Black NC / Yellow NO).

**Ordering code — 6 positions `PST2-012-G01M-B-P-COC` (single-variant product):**
1 Series PST2 · 2 Range **012** = 0.5–12 bar (only) · 3 Connection **G01M** (only) · 4 Body **B** brass (only) · 5 Sealing **P** NBR (only) · 6 Electrical **COC** change-over with cable (only). No inter-segment dependencies.

---

## 3. PST3 — Pressure Switch, Threaded, Internal Setting Screw

**Overview:** Compact economical switch, internal setting screw. Diaphragm design in low ranges, piston in high. Adjustable 0.2–400 bar across 5 variants; ±3%; −40…+85 °C; 250 VAC 5 A; body steel/SS/brass; seals NBR/EPDM/HNBR/Viton.

**Ordering code — 6 positions `PST3-002-G02M-C-P-NO`:**

| Pos | Segment | Options |
|---|---|---|
| 1 | Series | PST3 |
| 2 | Pressure range | **002** = 0.2–2 bar, **012** = 1–12 bar — diaphragm, **Pmax 40 bar**; **100** = 5–100, **200** = 20–200, **400** = 50–400 bar — piston, **Pmax 600 bar** |
| 3 | Connection | G01M 1/8" BSP(M); **G02M** 1/4" BSP(M) (std); T01M/T02M BSPT(M); M42M M10x1.0; M43M M12x1.5; N01M/N02M NPT(M) |
| 4 | Body | **C** steel (std); B brass; X SS316L |
| 5 | Sealing | **P** NBR (std); V Viton; E EPDM; K HNBR |
| 6 | Electrical | NO / NC / CO (with cap); COD-A = change-over with DIN 43650 Form A socket |

**Dependencies:** Pos 2 drives element type & max system pressure and the applicable hysteresis table (numeric tables printed per range: e.g. 002 → variation 0.03–0.40 bar; 400 → 7.5–100 bar across setpoints). Pos 6 drives terminal hardware.

---

## 4. PSTM — Pressure Switch, Threaded, with Manometer

**Overview:** Diaphragm switch with integrated Ø40 manometer. Ranges 0.2–12 bar; ±1%; −40…+90 °C; 250 VAC 5 A; body brass (SS option).

**Ordering code — 6 positions `PSTM-002-G02M-B-P-COD-A`:**
1 PSTM · 2 Range **002** = 0.2–2 bar (**manometer Pmax 2.5 bar**) or **012** = 1–12 bar (**manometer Pmax 16 bar**) · 3 Connection G01M/G02M(std)/T01M/T02M/M42M/M43M/N01M/N02M · 4 Body **B** brass (std) / X SS316L · 5 Sealing P(std)/V/E/K · 6 Electrical NO/NC/CO/COD-A.

**Dependency:** Pos 2 sets both max set pressure AND the paired manometer scale. Hysteresis tables identical to PST3-002/012.

---

## 5. PSTY — Washer Pressure Switch (High-Pressure Washers)

**Overview:** Compact brass factory-set switch for washer duty; SPDT with 1 m cable; max system **350 bar**; set pressures fixed by ordering code. IP55; ±1%; max 6 A / 250 V.

**Ordering code — 6 positions `PSTY-015-G01M-B-P-SPDT`:**
1 PSTY · 2 Set pressure **015** = 15 bar ±10%; **025** = 25 bar ±8%; **040** = 40 bar ±6% · 3 Connection G01M / G02M / G03M (3/8" BSP-M) · 4 Body **B** (only) · 5 Sealing **P** (only) · 6 Electrical **SPDT** with cable (only).

**Dependency:** tolerance is tied to the chosen setpoint.

---

## 6–8. PSB1 / PSB2 / PSB3 — Block-Type Pressure Switches

**Shared platform:** aluminium block 40 mm square, external setting knob with scale, DIN 43650 Form A change-over, settable in operation, 7–600 bar over 5 ranges, ±1%, −20…+110 °C, 5M cycles.

**Per-range limits (all three series):**

| Range code | Setting range | Max set | Max system |
|---|---|---|---|
| 070 | 7–70 bar | 70 | 650 bar |
| 160 | 20–160 | 160 | 650 |
| 300 | 20–300 | 300 | 650 |
| 400 | 20–400 | 400 | 650 |
| 600 | 50–600 | 600 | **750** |

**Ordering codes (6 positions; only Pos 2 varies for the buyer):**
- `PSB1-070-BB-A-P-COD-A` — **BB** = block, base (bottom-flange) mounting, vertical stacking holes
- `PSB2-070-BS-A-P-COD-A` — **BS** = block, side-flange mounting, horizontal stacking holes
- `PSB3-070-G02F-A-P-COD-A` — **G02F** = threaded 1/4" BSP(F)

Positions 4/5/6 fixed: A aluminium, P NBR, COD-A. Hysteresis exists only as graphs (no numeric tables) — approximate values in CPQ.

---

## 9. PSBM — Block-Type Pressure Switch with Gauge (file `PSVMRev.pdf`)

**Overview:** PSB3 platform plus integrated Ø63 glycerine-filled manometer. 7–600 bar; ±1%.

**Ordering code `PSBM-070-G02F-A-P-COD-A`:** as PSB3, but Pos 2 selects both switch range and **paired manometer scale**:

| Range | Setting range | Manometer Pmax (= max system) |
|---|---|---|
| 070 | 7–70 bar | 100 bar |
| 160 | 20–160 | 250 |
| 300 | 20–300 | 400 |
| 400 | 20–400 | 600 |
| 600 | 50–600 | 600 |

Note: max system pressures follow the **manometer** limits — lower than PSB1–3 body limits.

---

## 10–11. TST1 / TST2 — Temperature Switches, Threaded, Bimetal

**Overview:** Bimetallic thermostats, brass body, fixed factory-set switching temperatures 35–120 °C; NO standard, NC option. 250 VAC 10 A; IP55; max media +205 °C; 100,000 cycles. TST1 = DIN 43650 socket version; TST2 = fast-on clip terminals (adds 1/4" BSP connection size).

**Ordering codes — 6 positions:**
- `TST1-040-G04M-B-T-NOD-A`: 2 Set temperature **035/040/050/060/070/080/090/100/110/120** °C · 3 Connection **G04M** 1/2" BSP(M) or **M34M** M22x1.5(M) · 4 Body **B** (only) · 5 Sealing **T** Teflon or **C** Copper · 6 Electrical **NOD-A** (std) / **NCD-A**
- `TST2-040-G04M-B-T-NO`: 3 Connection adds **G02M** 1/4" BSP(M) · 6 Electrical **NO** (std) / **NC**

**Dependency:** set temperature defines high/low contact values (high = set ±3 °C; low = set −15 ±5 °C, per printed table common to both series).

---

## Cross-product CPQ modeling notes (Switches/Valves)

1. **Shared code vocabulary** (reusable option dictionaries): Connection codes (G01M/G02M/G03M/G04M, G02F, T01M/T02M, N01M/N02M, M42M/M43M/M34M, BB/BS); Body codes (B brass, C steel, A aluminium, X SS316L); Sealing codes (P NBR, V Viton, E EPDM, K HNBR, T Teflon, C copper); Electrical codes (NO, NC, CO, COD-A, NOD-A, NCD-A, COC, SPDT).
2. **Universal parent-child rule:** the range segment (Pos 2) is the master in every series — it fixes sensing element type, max set pressure, max system pressure, manometer scale (PSTM/PSBM), tolerance class (PSTY), and hysteresis table.
3. Every datasheet carries "Before ordering, check for availability" — treat all combinations as subject to availability confirmation.
4. Common SPDT convention: terminal 1-2 = NC (conducts on falling/no pressure), 1-3 = NO (conducts on rising pressure).
5. **Data gaps to flag to EPE:** (a) no genuine PST1 pressure-switch datasheet; (b) `PSVMRev.pdf` should be renamed PSBM; (c) PSB1/2/3 hysteresis values exist only as graphs.
