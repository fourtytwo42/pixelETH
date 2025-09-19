

# 0) Scope & Non-Goals

**In scope**

* Pixel game smart contracts (Base L2): storage, pricing, buy-only mutation, payouts, events, access control, upgradability.
* Unit/property/invariant/scenario test plans, gas/performance guidance.
* Operational hardening (pause, upgrades, parameter governance), deployment and rollback runbooks.
* Audit & assurance process.

**Out of scope**

* Frontend, indexers, snapshot/CDN pipeline, tokenomics beyond treasury split, and any server infrastructure.

---

# 1) Architectural Doctrine

1. **Single write-path**: The only state mutation is `buyPacked` (batch purchase). Color/team changes occur **only** via purchase (self-buy allowed).
2. **Deterministic pricing**: Price = step (base or lastPaid × 1.5) × team imbalance multiplier `M`, clamped. Multipliers **snapshotted per transaction** to prevent drift.
3. **Sparse storage**: Store only pixels that have ever been owned. Global team counts are small integers.
4. **Pull payments**: Sellers/treasury withdraw ETH later. No external calls in buy loops.
5. **Minimal surface**: No recolor function, no admin mint, no exotic hooks. Add features via upgrades only.
6. **Operational brakes**: Pausable, UUPS upgrades behind timelock, conservative parameter defaults.
7. **KISS gas discipline**: One storage write per pixel; strict input format (sorted IDs) for O(n) validation; minimal log topics.
8. **Test-first**: Property & invariant tests for economics, accounting, and safety.

---

# 2) Canonical Rules (Authoritative Mechanics)

## 2.1 Canvas & Pixel Identity

* Canvas: rectangular grid; dimensions immutable after deployment (e.g., 1920×1080).
* Pixel ID: `id = y * width + x`.
* Unowned pixel: `owner == address(0)`.

## 2.2 Price & Payouts

* **Step price**

  * Unowned: `BASE_PRICE`.
  * Owned: `floor(lastPaid × 3 / 2)` (integer floor).
* **Imbalance multiplier** `M(team, D)`

  * `D = (teamOwned − otherOwned) / totalOwned` in \[−1, +1]. If `totalOwned == 0`, M = 1.0.
  * **Linear mode (default)**: `M = 1 + α·D`, clamped to `[M_min, M_max]`.
  * Recommended defaults: `α = 1.0`, `M_min = 0.75`, `M_max = 3.0`.
  * **Rational mode (upgrade-toggle)**: `M = (1 + κD) / (1 − κD)` with clamp; denominator must remain positive.
* **Amount paid**: `pricePaid = stepPrice × M` (bps math; integer division allowed at the final multiply).
* **Payout split**:

  * First mint: 100% → treasury.
  * Resale: 90% → seller, 10% → treasury.
  * All payouts are credited to `pendingETH[...]` and withdrawn by the recipient.

## 2.3 Batch Purchase Semantics

* Inputs represent **N** pixels with: little-endian `uint32` IDs, 24-bit colors, and 1-bit teams per pixel.
* IDs **must be strictly increasing** (no duplicates, no sorting on-chain).
* **Snapshot multipliers once per transaction** (for both teams) at call entry; apply uniformly across pixels in the batch.
* **Slippage guard**: buyer provides `maxTotal` in wei; tx reverts if computed total exceeds it.
* **Self-buy permitted**: owner can buy from self to recolor/switch team. They pay full price and receive the seller cut; net cost equals the treasury fee and the pixel’s price steps up.

---

# 3) Contract Surfaces (ABI Without Code)

**Mutating**

* `buyPacked(idsLE, colors24, teamBits, maxTotal) payable`
  Validates pause, lengths, batch cap, bounds, strict ordering; snapshots multipliers; computes total; enforces `msg.value == total` and `total ≤ maxTotal`; updates state and credits payouts.

* `withdraw()`
  Transfers and zeroes the caller’s `pendingETH` balance; non-reentrant.

* `pause()` / `unpause()` (Pauser role)
  Only halts `buyPacked`.

* **Parameter setters** (Owner/ParamAdmin):
  `setTreasury`, `setBasePrice`, `setBiasMode`, `setBiasLinearAlphaBps`, `setBiasRationalKappaBps`, `setMultiplierClamps`, `setMaxBatch`.

**Views**

* `getPixel(id) → (owner, lastPaid, color, team)`
* `getStepPrice(id) → price`
* `getMultiplierBps(team) → bps` (based on current counts)
* `quotePrice(id, team) → price` (step × multiplier)
* `getTeamCounts() → (redCount, blueCount)`
* Getters for width, height, basePrice, maxBatch, bias params, clamps, pause state.

**Events**

* `PixelBought(id indexed, from, to, pricePaid, color, team)` (per-pixel in v1; only `id` indexed).
* `Withdraw(to, amount)`
* `ParamsUpdated(...)` (or per-setter change event)
* `Paused(account)` / `Unpaused(account)`

**Custom errors** (examples)

* `Paused()`, `BatchTooLarge()`, `BadId()`, `LenMismatch()`, `IdsNotStrictlyIncreasing()`, `MsgValueMismatch()`, `SlippageExceeded()`, `PriceOverflow()`, `Unauthorized()`.

---

# 4) Storage Layout (Choose & Freeze)

Pick **one** profile and document it in the repository. Never reorder fields; append new vars only. Reserve gap slots for upgrades.

**Profile A — 1-slot pixel (gas-lean; default for v1)**

* Per pixel (32 bytes total): `owner (20B) | lastPaid (8B, uint64) | color (3B) | meta (1B)`; `meta.bit0 = team`.
* Overflow policy: **revert** with `PriceOverflow()` if the next `pricePaid` would exceed `uint64`. Document this as an economic ceiling.
* Globals: `redCount (uint32)`, `blueCount (uint32)`, `treasury`, `basePrice (uint128)`, bias mode & params, clamps, `maxBatch`, `paused`, `pendingETH[...]`, reserved `__gap`.

**Profile B — 2-slot pixel (headroom)**

* Per pixel spans 2 slots; `lastPaid` uses a larger type (e.g., `uint128`).
* Higher gas per pixel (extra SSTORE) but no practical overflow risk.

**Hard rule:** Once a profile is chosen, all engineering, tests, and audits reference that exact layout.

---

# 5) Access Control, Upgradability, & Ops Controls

* **Upgradability**: UUPS proxy. Upgrades restricted to Owner (multisig), executed **through a timelock** (24–48h delay).
* **Roles**:

  * **Owner/UpgradeAdmin/ParamAdmin** (multisig or DAO later).
  * **Pauser** (can be the Owner or a separate role).
* **Pause** halts `buyPacked`; read functions and `withdraw()` stay live.
* **Parameter governance**: All setters emit change events; front-end surfaces a public changelog.

---

# 6) Safety & Security Best Practices

* **Checks-effects-interactions**: calculate & write state first; external ETH transfers only in `withdraw()`.
* **Pull payments** only; no `call` in buy loops; no reentrancy exposure. `withdraw()` is non-reentrant and zeroes state before transfer.
* **Strict input validation**:

  * IDs strictly increasing.
  * Length checks (ids, colors, teamBits).
  * Bounds on IDs.
  * Batch size ≤ `maxBatch`.
  * `msg.value` equals computed total; `total ≤ maxTotal`.
* **Snapshot multipliers** once per tx (or previous block counts).
* **Clamped multipliers** ensure seller profit floor (e.g., `M_min ≥ 0.75`).
* **Overflow checks** for `lastPaid` per chosen storage profile.
* **No privileged mint/burn** of pixels.
* **Auditability**: narrow ABI; explicit events; parameter changes always logged.

---

# 7) Gas, Capacity, and Policy

* **Write pattern**: 1 pixel ⇒ 1 pixel-slot write; per-seller balances are aggregated in memory per tx and written once (O(unique sellers) writes).
* **Logs**: Per-pixel events are kept simple (one indexed topic).
* **Batch size**: Start conservatively (e.g., 250 on Base) and adjust via governance post-profiling.
* **UI policy**: Client auto-chunks large selections and may group by current seller to improve warm-slot locality.

---

# 8) Test Strategy (Authoritative)

> Use a modern EVM testing stack with: unit tests, property tests (fuzz), invariant tests, scenario tests, and gas snapshots. Measure coverage and set quality gates.

## 8.1 Unit Tests (Deterministic)

**Pricing**

* Step price sequences with known multipliers (e.g., always M=1.0): assert floor(1.5^k) progression.
* Linear multiplier correctness: `owned=0` ⇒ M=1; `red=blue` ⇒ M=1; 60/40 with α=1 ⇒ 1.2/0.8 (clamped as necessary).
* Clamp boundaries: just below/above min/max to verify clamping logic.
* (If Rational enabled) denominator safety and correct clamping at extremes.

**Batch mechanics**

* Length mismatches revert.
* IDs out of bounds revert.
* Not strictly increasing ⇒ revert.
* Snapshot multipliers used uniformly across a batch that flips many teams; totals are invariant to per-pixel loop order.
* `msg.value` mismatch ⇒ revert.
* `total > maxTotal` ⇒ revert.

**Payouts & balances**

* First mint ⇒ 100% treasury; counts increment by team.
* Resale ⇒ 90/10 split; self-buy credits seller (buyer).
* Balances accumulate across multiple buys; `withdraw()` transfers and zeroes; repeat withdraw with zero balance reverts.

**Counts**

* Invariants after operations:

  * `redCount + blueCount == #pixels with owner != 0`.
  * Team flip on resale updates counts correctly.

**Admin & pause**

* Only authorized addresses can set params or pause.
* Pause blocks `buyPacked` but not views/withdraw.
* Param setters emit events; values updated correctly; invalid ranges revert.

**Overflow/limits**

* Profile A: detect when next `pricePaid` would overflow `uint64` and revert.
* Profile B: demonstrate high values without overflow.

**Events**

* For a batch of N, exactly N per-pixel events with correct fields.

## 8.2 Property & Invariant Testing (Fuzz)

* **Accounting conservation**:
  Σ(treasury pending) + Σ(all seller pending) + Σ(all withdrawals) == Σ(all `pricePaid`).
* **Counts correctness**:
  `redCount + blueCount == #pixels with owner != 0`.
* **Monotonic lastPaid** (with `M_min ≥ 0.75`):
  After any successful buy, `lastPaid(new) > lastPaid(old)`.
* **Deterministic totals**:
  Given the same state and inputs, total cost and state diffs are deterministic.
* **Snapshot invariance**:
  Within one `buyPacked`, all per-pixel multipliers equal the entry snapshot values.
* **No reentrancy state mutation**:
  Fuzz around withdraw/reentrancy mocks; assert no state changes via unexpected callbacks.

## 8.3 Scenario Tests (System-Level)

* **Guild war**: Alternating team dominance with large batches; confirm bias behavior, clamping, and totals.
* **Whale repaint**: Repeated self-buys of the same set; confirm staircase pricing, net cost equals fee, no overflow before cap.
* **Fragmented sellers**: Many unique sellers in a batch; verify per-seller aggregation and correct pending balances.
* **Pause & resume**: Live traffic → pause → buys revert → withdraw continues → resume.
* **Upgrade rehearsal**: Proxy deploy → activity → upgrade no-op impl → verify storage/behavior unchanged.

## 8.4 Gas Tests (Regression)

* Record gas usage for:

  * Single unowned buy vs single resale (warm/cold).
  * Batches (10, 50, 100, 250) mixed ownership.
* Set regression thresholds (e.g., ±15% max drift) and alert on CI.

## 8.5 Coverage & Quality Gates

* Coverage target ≥95% lines/branches on the core canvas contract.
* All invariants pass with sufficient fuzz iterations (configure timeouts generously).
* No critical/static-analysis findings (see §11) unresolved.
* Gas regressions within budget.

---

# 9) Deployment & Upgrade Runbooks

## 9.1 Pre-Deploy Checklist

* Parameters chosen and documented: `BASE_PRICE`, `alpha`, `M_min`, `M_max`, `maxBatch`, canvas dimensions, `treasury`.
* Proxy wiring validated in a dry-run (testnet).
* Ownership set to a multisig; timelock configured for upgrades.
* Pause tested in staging (pause/unpause cycle).

## 9.2 Deploy Steps (Testnet & Mainnet)

1. Deploy implementation.
2. Initialize via UUPS proxy with parameters and role assignments.
3. Smoke test: one first mint, one resale, one self-buy, one withdraw.
4. Record addresses/ABIs and publish a deployment report.

## 9.3 Upgrade Steps

1. Open an ADR (architecture decision record) describing the change, risks, and storage impact (append-only).
2. Queue upgrade via timelock; publish community notice.
3. After timelock, execute upgrade; run post-upgrade checks (views, small buys, invariants spot-check).
4. Update docs and changelog; announce.

## 9.4 Rollback Strategy

* Maintain previous implementation references.
* If post-upgrade health checks fail: **pause**, revert proxy to prior implementation, unpause after validation.

---

# 10) Parameter Governance & Ops

* **Transparency**: Parameter changes are events; front-end displays a public changelog with timestamps and reasons.
* **Defaults**:

  * `BASE_PRICE`: low, published up front.
  * `alpha = 1.0`, `M_min = 0.75`, `M_max = 3.0`.
  * `maxBatch`: conservative at launch; adjust post-profiling.
* **Change Process**:

  * Propose → review (engineering & risk) → schedule via timelock → execute → announce.

---

# 11) Audit & Assurance Program

* **Static analysis**: Run multiple tools (e.g., Slither, MythX/Mythril-like, any preferred internal scanners) with zero-warning baseline.
* **Formal checks (where practical)**: Encode key invariants (conservation, monotonicity, snapshot constancy) in a property checker (e.g., Echidna/Halmos-style) and retain artifacts.
* **Manual audit**: Scope includes ABI, storage layout, overflow guards, pricing math, event correctness, access controls, upgrade hooks, and pause logic.
* **Differential testing**: If you later ship v2 (batch summary events), run cross-impl property tests to ensure equivalence for unchanged features.
* **Remediation**: Track findings, patch, and re-verify with the same test corpus.

---

# 12) Documentation Standards (What to Keep in Repo)

* **SPEC.md** (this document) frozen at tag for each release.
* **ABI.md** listing functions/events/errors in plain language.
* **PARAMS.md** recording current on-chain parameters and change history.
* **RUNBOOKS/** for deploy, upgrade, pause/incident, and rollback.
* **TESTPLAN.md** listing all unit/property/invariant/scenario tests with Given/When/Then behavior and expected outcomes.
* **ADRs/** one file per architectural change or upgrade.
* **AUDIT/** reports and remediation notes.

---

# 13) Acceptance Criteria (Go/No-Go for Mainnet)

* All unit/property/invariant/scenario tests pass in CI with configured seeds and iteration counts.
* Coverage and gas regressions within thresholds.
* Static & manual audit: **no critical/high** outstanding; documented mitigations for medium/low.
* Upgrade rehearsal (testnet) green; pause/unpause tested; withdraw always safe.
* Deployment runbooks dry-run completed; addresses and ABIs prepared.
* Owner is a multisig; timelock is live and tested.

---

# 14) Future-Proofing Notes (Not in v1 scope)

* **Batch summary event**: One event per tx with calldata hash; indexers reconstruct per-pixel diffs from tx input.
* **Rational bias mode**: Flip via parameter when/if desired.
* **Calldata reductions**: Palette/mono-color modes with identical semantics (still buy-only).
* **Rectangle claims for unowned**: Optional v3 for storage/gas—requires new invariants and migration plan.

---

## One-page TL;DR (Contracts Team)

* Implement a **single mutator** `buyPacked` with strict validation, **per-tx snapshot multipliers**, slippage guard, pull-payments, and per-pixel events.
* Choose **one** storage profile (1-slot or 2-slot) and **freeze** the layout.
* Wire **UUPS + timelock**, **pause**, and minimal param setters.
* Deliver a **full test suite**: pricing math, batch semantics, payouts, counts, events, overflow guards, admin/pause, invariants, scenarios, gas.
* Ship with **runbooks, changelogs, ADRs**, and an audit trail.
