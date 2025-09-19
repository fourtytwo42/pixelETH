

# 0) Goals for the contracts

* **One write-path:** buying pixels (batch) is the only state mutation.
* **Deterministic pricing:** step × team multiplier with hard clamps and slippage guard.
* **Self-buy = recolor/team switch:** no separate recolor entrypoints.
* **Sparse storage:** store only pixels that have ever been bought.
* **Gas-aware, yet simple:** single event flavor in v1; upgrade path to batched events later.
* **Ops-ready:** UUPS proxy, timelock, pause, pull-payments, explicit roles.
* **Test-first:** property/invariant fuzz + unit specs for every branch.

---

# 1) Module layout (files & responsibilities)

File paths and locations (no code in this doc):

* `contracts/PixelCanvasV1.sol`
  Core logic: batch buys, pricing, payouts, storage, events, views.

* `contracts/proxy/PixelCanvasProxy.sol` (or use OZ UUPS via imports)
  UUPS proxy host (EIP-1967 slots), upgrade hooks.

* `contracts/access/AdminRoles.sol`
  Minimal role gate: Owner (UpgradeAdmin + ParamAdmin), Pauser.

* `contracts/interfaces/IPixelCanvas.sol`
  Canonical ABI surface (functions, events, custom errors).

* `contracts/libraries/BuyCalldataPacking.sol`
  (Optional) pure functions for decoding packed ids/colors/team bits.

* `contracts/mocks/`
  Mocks for tests (malicious receivers, reentrancy, etc.).

* `test/foundry/unit/`
  Unit tests per function/topic (pricing, batch, payouts, pause, admin).

* `test/foundry/invariants/`
  Property/invariant fuzz suites (state algebra, accounting).

* `test/foundry/scenario/`
  System scenarios (guild wars, whales, fragmented sellers).

* `script/`
  Deploy & upgrade scripts (proxy + impl) for testnet and Base.

* `audits/`
  Threat model, checklist, and pre-audit notes (kept in repo).

---

# 2) Public ABI (v1, no code—function & event specs)

### Mutating

* `buyPacked(idsLE, colors24, teamBits, maxTotal) payable`

  * Purpose: atomic batch purchase of N pixels.
  * Inputs:

    * `idsLE` = byte array, little-endian `uint32` per pixel id; **strictly increasing**; length = 4·N bytes.
    * `colors24` = byte array, `0xRRGGBB` per pixel; length = 3·N bytes.
    * `teamBits` = bitfield LSB-first; bit *i* is team (0=Red, 1=Blue); length ≥ ceil(N/8) bytes.
    * `maxTotal` = buyer’s slippage cap in wei.
  * Effects & rules:

    * **Pause check**: reverts if paused.
    * **Batch limit**: N ≤ `maxBatch`.
    * **Bounds check**: each id ∈ \[0, width·height).
    * **No duplicates**: strictly increasing sequence enforced.
    * **Snapshot multipliers**: compute `multRedBps` and `multBlueBps` **once**, using team counts at entry.
    * For each id: compute stepPrice (base or lastPaid×1.5), apply multiplier by chosen team, **sum total**.
    * Require `msg.value == total` and `total ≤ maxTotal` (slippage guard).
    * Payouts: first-mint → 100% treasury; resale → 90% seller, 10% treasury (pull-payments).
    * Self-buy permitted (seller==buyer): they still pay full price; receive seller cut back.
    * Team counts: first-mint increments chosen team; resale flips counts only if team changes.
  * Emits: one **per-pixel event** (see Events) for each pixel in the batch (v1).

* `withdraw()`

  * Pull-payment: transfer `pendingETH[msg.sender]`, set to zero, no reentrancy.

* `pause()` / `unpause()`

  * Pauser-gated, halts `buyPacked` only.

* Admin setters (Owner/ParamAdmin):

  * `setTreasury(address)`
  * `setBasePrice(uint128)`
  * `setBiasLinearAlphaBps(uint16)` and/or `setBiasRationalKappaBps(uint16)`
  * `setBiasMode(enum {Linear, Rational})`
  * `setMultiplierClamps(minMultBps uint16, maxMultBps uint32)`
  * `setMaxBatch(uint256)`

### Views

* `getPixel(id) → (owner, lastPaid, color, team)`
* `getStepPrice(id) → price`
* `getMultiplierBps(team) → bps` (based on **current** global counts)
* `quotePrice(id, team) → price` (step × multiplier)
* `getTeamCounts() → (redCount, blueCount)`
* `width()`, `height()`, `maxBatch()`, `basePrice()`, params getters
* (Optional convenience) `getCurrentPrices(ids[]) → prices[]` for UI quoting

### Events (v1, simple; v2 has batch summary)

* `PixelBought(id indexed uint32, from address, to address, pricePaid uint128, color uint24, team uint8)`

  * Only `id` indexed to keep log gas low. Emitted once per pixel.
* `Withdraw(to address, amount uint256)`
* `ParamsUpdated(...)` (one or many; each setter also emits a change event)
* `Paused(account)` / `Unpaused(account)`

### Custom Errors

* `Paused()`
* `BatchTooLarge()`
* `BadId()`
* `LenMismatch()`
* `IdsNotStrictlyIncreasing()`
* `MsgValueMismatch()`
* `SlippageExceeded()`
* `PriceOverflow()` (if using 1-slot storage variant)
* `Unauthorized()` (for admin/pauser)

---

# 3) Storage layout (explicit, to protect upgrades)

> Choose **one** of these profiles for v1. Both are “KISS”, but Profile B removes price-overflow concerns at the cost of one extra SSTORE per pixel.

### Profile A (gas-lean 1-slot pixel; **default** if you’re optimizing gas first)

* Pixel struct fits in **1× 32-byte slot**:

  * `owner` (20 bytes)
  * `lastPaid` **uint64** (8 bytes) → max ≈ **18.44 ETH** in wei
  * `color` uint24 (3 bytes)
  * `meta` uint8 (1 byte: bit0 team; bits 7:1 reserved)
* **Trade-off:** You **must** guard against overflow. If the next purchase’s `pricePaid` would exceed `2^64-1`, revert with `PriceOverflow()`. Document this clearly.
* Global state:

  * `uint32 redCount`, `uint32 blueCount`
  * `address treasury`
  * `uint128 basePrice`
  * Bias params: `enum BiasMode`, `uint16 alphaBps`, `uint16 kappaBps`, clamps `uint16 minMultBps`, `uint32 maxMultBps`
  * `uint256 maxBatch`
  * `bool paused`
  * `mapping(uint32 => Pixel)` pixels
  * `mapping(address => uint256)` pendingETH
* **Upgrade slots:** Reserve a `uint256[40] __gap;` (or equivalent reserved slots) at the end for future vars.

### Profile B (headroom 2-slot pixel; **default** if you’re optimizing longevity first)

* Pixel struct spans **2 slots**:

  * Slot 1: `owner` (address), `team` (1 bit / byte), `color` (3 bytes)
  * Slot 2: `lastPaid` **uint128** (or `uint160/uint192` if you want extreme headroom)
* **Trade-off:** +1 SSTORE per pixel; gas higher on each buy, but no overflow until astronomical prices.
* All globals same as Profile A.

> Pick one now, lock it, and **never** reorder. All future vars append after the `__gap`.

---

# 4) Pricing & math (authoritative)

* **Step price**:

  * Unowned: `basePrice`.
  * Owned: `floor(lastPaid × 3 / 2)`. Integer division (round down) is acceptable; it is deterministic.
* **Imbalance**:

  * `owned = redCount + blueCount`. If `owned == 0`, multiplier = 1.0 (10000 bps).
  * `D_bps = ((teamCount − otherCount) * 10000) / owned` → integer in \[−10000, +10000].
* **Multiplier (mode = Linear, v1 default)**:

  * `M_bps = clamp(10000 + (alphaBps * D_bps) / 10000, minMultBps, maxMultBps)`.
  * Recommended defaults: `alphaBps = 10000` (α=1.0); `minMultBps = 7500` (0.75×); `maxMultBps = 30000` (3×).
* **Multiplier (mode = Rational, v2 toggle)**:

  * `kD = (kappaBps * D_bps)/10000`.
  * `M_bps = clamp( (10000 + kD) * 10000 / (10000 − kD), min, max )`. Require denominator > 0.
* **Price paid**:

  * `pricePaid = stepPrice * M_bps / 10000`.
  * **Snapshot** `M_bps` once per `buyPacked` (compute red & blue multipliers at entry); use those for both total computation and per-pixel writes.
* **Payout split**:

  * First mint: 100% to treasury.
  * Resale: `seller = pricePaid * 9000 / 10000`; `treasury = pricePaid − seller`.
  * **Pull-payments only**: credit balances; never `call` sellers inside the buy loop.

---

# 5) Behavioral rules & invariants (must hold at all times)

* **Monotonicity:** For any owned pixel, every successful buy strictly increases `lastPaid` (given `minMultBps ≥ 7500`).
* **Counts correctness:** `redCount + blueCount = number of pixels with owner != 0`.
* **Team flip correctness:** On resale where newTeam ≠ oldTeam, decrement old team, increment new team; on first mint, increment new team only.
* **Exact accounting:** Over the life of the contract, Σ(all credited seller amounts) + Σ(all credited treasury amounts) = Σ(all `pricePaid`) across all buys.
* **Deterministic totals:** Given inputs (ids, colors, teamBits, snapshot multipliers, storage at call entry), the computed `msg.value` and state diffs are deterministic and identical across nodes.
* **No reentrancy into state-changing functions** (withdraw is nonReentrant; buyPacked has no external calls).
* **Pause semantics:** When paused, `buyPacked` reverts; views & `withdraw()` keep working.

---

# 6) Access control, upgrades, and pause

* **Ownership & roles**:

  * Owner (UpgradeAdmin + ParamAdmin).
  * Pauser role (can be Owner or a separate role).
* **UUPS proxy**:

  * Protect `upgradeTo` with Owner; route admin through a **Timelock** (24–48h).
  * EIP-1967 slots honored; no storage collision.
  * Unit test upgrades with populated storage (see tests).
* **Pause**:

  * Immediate stop on `buyPacked` during incidents.
  * Emit `Paused/Unpaused` events.

---

# 7) Unit test plan (deterministic)

> Framework suggestion: **Foundry** (fast fuzz, invariant tests, gas snapshots). Hardhat is fine too; this spec is framework-agnostic.

### 7.1 Pricing math (deterministic)

* **Step price sequence:**

  * Start at base → after k buys with M=1.0, assert `lastPaid = base × 1.5^k (floor per step)`.
* **Linear multiplier boundaries:**

  * Case owned == 0 → M=1.0.
  * Case red = blue → M=1.0 for both.
  * Case 60/40 (D=0.2) with α=1.0 → M\_red=1.2, M\_blue=0.8, then clamp to \[min,max].
  * Clamp tests: when raw M < minMultBps or > maxMultBps.
* **Rational (if enabled) correctness:**

  * Denominator positive; clamping at extremes; sample 70/30 with kappa=0.75.

### 7.2 Batch semantics

* **Sorted IDs required:** attempt out-of-order or duplicates → revert `IdsNotStrictlyIncreasing()`.
* **Length mismatch:** ids vs colors vs team bits → `LenMismatch()`.
* **Bounds:** id >= width·height → `BadId()`.
* **Slippage guard:** purposely send `msg.value` < / > computed total → `MsgValueMismatch()` or `SlippageExceeded()`.
* **Snapshot multipliers fixed:**

  * In a batch that flips many pixels from red→blue, per-pixel price uses the **entry** snapshot multipliers, not mid-loop counts; verify totals are stable and independent of loop order.

### 7.3 Payouts & balances

* **First mint:** 100% treasury credit, counts incremented for chosen team.
* **Resale:**

  * seller=90%, treasury=10% exactly; no rounding drift beyond expected flooring in step calculation.
  * Self-buy: seller==buyer → `pendingETH[buyer]` increases by seller cut; net cost = dev 10% (plus step increase).
* **Withdraw:**

  * Non-reentrant; zero balance after withdraw; re-call reverts `NothingToWithdraw` (or equivalent).
  * Withdraw path works while paused.

### 7.4 Team counts

* **Mint → counts:** unowned→owned increments target team only.
* **Resale same team:** no count change.
* **Resale flip:** decrement old team, increment new team.
* **Invariant across long sequences:** property test `red+blue == ownedPixels`.

### 7.5 Admin & pause

* Only Owner/ParamAdmin can change params; events emitted with new values.
* Change clamps to impossible values → revert (param guards).
* Pause blocks `buyPacked` but not views/withdraw.

### 7.6 Overflow/limits (per chosen profile)

* **Profile A:** find minimal k such that `lastPaid × 1.5 × minMult` would overflow `uint64`; attempt buy → `PriceOverflow()`.
* **Profile B:** demonstrate high lastPaid values retain correctness; no overflow.

### 7.7 Event emission

* For a batch of N:

  * Exactly N `PixelBought` events (v1).
  * Fields match written state.
  * `id` indexed topic is correct and unique per pixel.

### 7.8 Gas characterization (non-binding, regression)

* Measure gas for:

  * 1 unowned pixel vs 1 resale (warm seller, warm treasury vs cold).
  * Batch of 10, 50, 100 mixed.
  * Use foundry’s gas snapshot to watch regressions.

---

# 8) Invariant/property fuzz suites (high value)

* **I-1: Accounting conservation**
  Across arbitrary valid buys:
  Σ(treasury pending) + Σ(per-address pending) + Σ(all prior withdrawals) == Σ(all `pricePaid`).

* **I-2: Counts correctness**
  At any time: `redCount + blueCount == number of pixels with owner != 0`.

* **I-3: Monotone lastPaid**
  For any owned pixel: after any successful buy, `lastPaid(new) > lastPaid(old)` (given `minMultBps ≥ 7500`).

* **I-4: Deterministic totals**
  For any seed state, calling `buyPacked` with same inputs twice (from identical state) yields identical totals and events (idempotence per state).

* **I-5: No external reentrancy**
  While fuzzing buys/withdraws, no state change occurs from fallback/external calls (you have none inside buy loop; verify with a reentrant mock via withdraw).

* **I-6: Snapshot multipliers constant**
  Within one buyPacked call, all per-pixel multipliers used are the entry snapshot values.

* **I-7: Payable invariants**
  `pendingETH[treasury]` increases exactly by expected deltas; seller pending increases only on resale.

---

# 9) Scenario tests (simulate real use)

* **S-1: Guild war**
  Two teams alternating massive batches; assert team bias behaves; minority price floor protects sellers; totals match quotes.

* **S-2: Whale repaint**
  One owner self-buys the same set multiple times to recolor; ensure price staircase rises, net cost equals dev share each time; no overflow before planned cap.

* **S-3: Fragmented sellers**
  Many unique sellers in one batch; ensure pending balances credit exactly once per seller (per tx); totals still correct.

* **S-4: Pause & resume**
  Pause during high activity; buys revert; withdraw continues; resume and ensure no stale counters.

* **S-5: Upgrade dry-run**
  Deploy proxy → buy pixels → upgrade impl with a harmless no-op change → state, events, and functions behave identically.

---

# 10) Deployment & upgrade runbook (contracts only)

* **Compile target:** Solidity ≥ 0.8.20 (checked arithmetic, recent optimizer).
* **Libraries:** OpenZeppelin (Ownable, Pausable, ReentrancyGuard, UUPS).
* **Proxy initialization:**

  * Set `treasury`, `basePrice`, bias mode/params/clamps, `maxBatch`, width/height.
  * Set Owner and Pauser (Owner can be multisig).
  * Verify proxiable UUID (UUPS).
* **Timelock wiring:** Route upgrade functions through a timelock (Owner is timelock controller).
* **Post-deploy checks:**

  * Read all params; dry-run quotes; perform one small buy; verify events, counts, pending balances.
  * Test `pause()` on mainnet with a dummy window (announce beforehand), then unpause.

---

# 11) Threat model (contract scope)

* **Reentrancy:** Protected by pull-payments and nonReentrant withdraw, no external calls inside buy loop.
* **Grief via self-buy:** Intended mechanic; costs dev fee; pushes price staircase upward (anti-spam cost baked in).
* **Denial via huge batches:** `maxBatch` and gas limits cap work per tx.
* **Round-trip math drift:** Only integer flooring in step multiplication; totals deterministic by design; slippage guard protects end users.
* **Overflow (Profile A):** Explicitly guarded; tests enforce; documented UX message if ever triggered.
* **Admin abuse:** Timelock + multisig best practice; on-chain events for all param changes; front-end changelog.

---

# 12) Acceptance criteria (contracts ready)

* All **unit tests** and **invariants** pass locally and in CI.
* Gas snapshots within expected ranges (no >15% regression from baseline).
* Manual scenario tests (S-1..S-5) pass.
* Upgrade rehearsal green: state preserved, functions stable.
* Pause works as designed; withdraw always safe.
* Coverage: ≥95% line/branch on core contract; explicit justification for any exclusions.

---

# 13) Future (v2) upgrade notes—keep in mind, not for v1 scope

* **Batch summary event** (cuts log gas): add event with per-tx totals + calldata hash; indexers reconstruct from tx input.
* **Palette or mono-color modes** (calldata reduction): optional alternative entrypoints; unchanged economics.
* **Rectangle/run claims (unowned only)** to compress mass mints (lazy split on first resale).
* **Switch to rational bias** if gameplay demands stronger push/pull at high imbalance.

These do not change v1 invariants; they extend surface in a backward-compatible manner.

---

## Final TL;DR for the solidity & test team

* Implement **one** mutating function `buyPacked(...)` with sorted ids, packed bytes, snapshot multipliers, strict slippage check, pull-payments, and per-pixel events.
* Storage = **sparse** pixels + **global counts** + **pending balances**; choose **Profile A** (1-slot) *or* **Profile B** (2-slot) now and lock it.
* Add **pause**, **UUPS+timelock**, and minimal setters (treasury, base price, bias params, clamps, maxBatch).
* Ship an exhaustive **unit + invariant fuzz** suite covering pricing math, counts, payouts, slippage, events, overflow, pause, and upgrades.
