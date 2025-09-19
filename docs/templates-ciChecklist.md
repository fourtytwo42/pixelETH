

# Repo Conventions (applies to everything below)

**Labels (apply multiple):**
`type:feature` · `type:bug` · `type:security` · `type:docs` · `type:tests` · `type:infra` · `risk:low|med|high|critical` · `impact:abi` · `impact:storage` · `impact:events` · `impact:params` · `needs:design` · `needs:audit` · `blocked` · `ready` · `good first issue` · `help wanted`

**Change categories:**

* **Contract-impacting:** any change to storage layout, ABI, or event schema.
* **Behavioral:** logic that can alter price, payouts, counts, or pause behavior.
* **Params-only:** base price, α/κ, clamps, `maxBatch`, treasury.
* **Non-impacting:** docs/tests/infra.

**Definitions:**

* **Definition of Ready (DoR):** Problem statement, acceptance criteria, risk rating, owners, and test plan are filled.
* **Definition of Done (DoD):** All acceptance tests green; CI required checks pass; labels set; docs & runbooks updated; changelog entry included.

---

# ISSUE TEMPLATES

> Create each template as a markdown file under `.github/ISSUE_TEMPLATE/` (names suggested below). The content here is exactly what each issue should contain. Keep the headings verbatim so triage is consistent.

---

## 1) Epic — “umbrella” tracker

**Filename:** `epic.md`

**Title:** `EPIC: <concise outcome>`
**Summary (1–3 sentences):**
**Motivation / Value:** Why does this matter now?
**Success Metrics:** Quantitative goals (e.g., gas ↓ 15%, invariant coverage ↑ to 100%).
**Scope (In):**
**Scope (Out):**
**Deliverables:** Bullet list of PRs or milestones.
**Dependencies & Sequencing:** Other epics/issues that must land first.
**Risks & Mitigations:**
**Stakeholders:** Eng, QA, Sec, PM (names/handles).
**Schedule / Milestones:** Dates and gates.
**Acceptance Criteria (AC):** Enumerated, testable.

**DoR checklist:** filled motivation, AC, risks, stakeholders, schedule.
**DoD checklist:** all child issues closed; postmortem & learnings attached.

---

## 2) Contract Feature / Change Request

**Filename:** `feature-contract.md`

**Title:** `Feature: <module> — <concise change>`
**Summary:**
**Problem Statement:**
**Proposed Behavior (authoritative spec):**

* Public API/ABI changes (if any):
* Storage layout changes (if any):
* Events (new/changed/removed):
* Access control / roles:
* Pricing math / economic impact:
* Failure modes & reverts:

**Security Considerations:** Abuse/misuse, reentrancy, griefing, overflow.
**Backwards Compatibility:** How this affects existing indexers/frontends.
**Operational Impact:** Pause needed? Timelock upgrade? Param changes?
**Monitoring / Observability Needed:** New metrics/events.

**Acceptance Criteria (Given/When/Then):**

* Given … When … Then …
* …

**Test Plan:**

* Unit cases: …
* Property/invariants: …
* Scenarios: …
* Gas expectations: …

**Labels to apply:** `type:feature` + relevant `impact:*` + `risk:*`.
**DoR:** spec complete, AC & test plan present, risks labeled.
**DoD:** CI green, coverage OK, gas within budget, docs updated, changelog entry.

---

## 3) Bug Report

**Filename:** `bug.md`

**Title:** `Bug: <concise symptom>`
**Severity:** `blocker | high | medium | low`
**Environment:** branch/commit, Solidity version, testnet/mainnet if applicable.
**Observed Behavior:** What happened (logs, tx hash, stack traces).
**Expected Behavior:** What should have happened.
**Steps to Reproduce:** Minimal sequence.
**Impact Assessment:** Users affected, funds at risk, need to pause?
**Workaround:** If any.
**Suspected Root Cause:** Optional.
**Screenshots/Artifacts:** Links.

**Fix Strategy:** Hotfix vs. queued upgrade.
**Regression Tests Needed:** List.
**Rollout / Backout:** Pause? Timelock upgrade? Rollback path.
**Owner:**
**ETA:**

**Labels:** `type:bug` + `risk:*` + `impact:*`.
**DoD:** fix merged; tests added; post-incident notes (if high/critical).

---

## 4) Security Finding / Threat Report

**Filename:** `security.md`

**Title:** `Security: <finding name>`
**Reporter:** internal/external; disclosure status.
**Severity:** `critical | high | medium | low | informational`
**Description:**
**Attack Pre-conditions:**
**Exploit Path:** step-by-step.
**Impact:** loss type/scale.
**Proof / Evidence:** PoC, tx links.
**Affected Components:** contracts/functions.
**Mitigations:** immediate (pause?), short-term (param change), long-term (upgrade).
**Testing Needed:** unit/invariant/fuzz additions.
**Responsible Disclosure Plan:** if external.

**Labels:** `type:security`, `risk:critical|high`, `needs:audit` (if applicable).
**DoD:** mitigation deployed; tests added; disclosure handled; lessons learned.

---

## 5) Parameter Change Proposal (PCP)

**Filename:** `param-change.md`

**Title:** `PCP: <param> from <X> to <Y>`
**Parameter(s):** list all.
**Motivation:** why change now.
**Risk Assessment:** game-theory, UX, and economic effects; simulate if possible.
**Rollout Plan:** announce → timelock → execute → verify.
**Monitoring Plan:** what to watch after change.
**Backout Plan:** how to revert quickly.
**Effective Date / Timelock:** dates.
**Owner:**
**Approvals:** stakeholders sign-off.

**Acceptance Criteria:** values reflect on-chain; events emitted; dashboards updated.
**Labels:** `impact:params`, `risk:*`.

---

## 6) Upgrade Proposal (ADR)

**Filename:** `upgrade-adr.md`

**Title:** `ADR: Upgrade to <impl-version> — <purpose>`
**Summary:** what & why.
**Scope:** minimal change principle; storage layout append-only.
**Storage Impact:** exact new vars added; no reordering.
**ABI/Event Impact:** diffs enumerated.
**Migration Plan:** pre/post checks, smoke tests.
**Risk Analysis:** failure modes & rollbacks.
**Timelock Plan:** when queued/executed.
**Audit Notes:** internal/external review steps.
**Test Plan:** focused set for new logic; full regression afterwards.
**Owner & Approvers:**
**Changelog Entry:** prepared.

**DoD:** upgrade executed; post-upgrade checks green; docs updated.

---

## 7) Test Case / Scenario Request

**Filename:** `tests.md`

**Title:** `Tests: <area> — <specific behavior>`
**Rationale:** why this test matters.
**Test Type:** `unit | property | invariant | scenario | gas`
**Given/When/Then:** detailed steps.
**Expected Metrics:** e.g., coverage threshold, gas budget.
**Dependencies:** contracts/params.
**Owner:** QA/Eng.

**DoD:** test implemented; CI includes it; passes consistently.

---

## 8) Gas Regression Investigation

**Filename:** `gas-regression.md`

**Title:** `Gas: regression in <case name>`
**Baseline:** commit/tag, gas numbers.
**Current:** commit, gas numbers.
**Delta:** absolute & %.
**Suspected Causes:**
**Proposed Remediation:** code path, packing, event size, etc.
**Acceptance:** gas back within ±X% of baseline or justified waiver (documented).

---

## 9) Runbook / Docs Update

**Filename:** `docs-update.md`

**Title:** `Docs: <runbook or spec section>`
**What Changed:** brief.
**Why:** reason.
**Where:** files/sections.
**Reviewers:** Eng, Ops, PM.
**DoD:** PR merged; links verified.

---

# PULL REQUEST CHECKLIST (paste into every PR description)

**Category:** `contract-impacting | behavioral | params-only | non-impacting`
**Risk:** `low | medium | high | critical`
**Summary:** 1–3 sentences.
**Linked Issues:** #…
**Storage Impact:** none / append-only details / proof of layout diff check.
**ABI/Event Impact:** none / list of changes.
**Behavioral Change:** none / describe.
**Tests:** unit ✅ / property ✅ / invariant ✅ / scenario ✅ / gas ✅
**Coverage:** ≥ target? yes/no (attach report link)
**Gas:** within budget? yes/no (attach delta)
**Security:** reentrancy/overflow/abuse reviewed; notes: …
**Docs/Runbooks Updated:** yes/no
**Changelog Entry Included:** yes/no

---

# CI/CD CHECKLIST (what every PR and scheduled run must do)

> Structure your CI in two lanes: **Fast PR** (runs on every PR/push) and **Thorough Nightly** (runs on `main` nightly and before releases). Below are the required checks, their purpose, and when they must pass.

## A) Required checks on every PR (blockers if failing)

1. **Compile & Lint (Contracts)**

   * Compiles with locked compiler settings; rejects pragma drift.
   * Style/lint rules for imports, license headers, SPDX.

2. **Unit Tests (Deterministic)**

   * Run all unit tests; fail on any non-deterministic test.
   * Report: pass/fail summary.

3. **Property / Fuzz Tests (Bounded)**

   * Execute bounded iterations with fixed seeds.
   * Properties covered: accounting conservation, counts correctness, snapshot constancy, monotonic lastPaid (given clamps), determinism of totals.

4. **Invariant Tests (Short-form)**

   * Run a short deterministic invariant suite (fewer steps) to keep PRs fast.
   * Long-form runs happen nightly (see below).

5. **Coverage Gate**

   * Enforce ≥ **95%** line/branch coverage on the core canvas contract.
   * Fail PR if below threshold.

6. **Gas Snapshot Diff**

   * Compare against baseline for key cases (single mint, single resale, batches of 10/50/100/`maxBatch`).
   * Fail PR if any case regresses by **>15%** without an explicit, approved waiver (label `waiver:gas` + justification comment).

7. **Static Analysis (Baseline)**

   * Run static analyzers; no new **high/critical** severity findings allowed.
   * Medium/low must be triaged with labels and assignee.

8. **ABI Diff Check**

   * Detect any ABI change and require label `impact:abi` + linked issue describing migration.
   * Fails PR if ABI changed and the issue/label/approvals are missing.

9. **Storage Layout Diff Check**

   * Detect any non-append changes in storage layout.
   * Fails PR unless: (a) change is pure append, or (b) an upgrade ADR explicitly approves a breaking change with a migration plan.

10. **License & Metadata**

* SPDX headers present; NOTICE/COPYRIGHT untouched where required.

11. **PR Hygiene**

* Title follows convention; issue links present; labels set (`risk:*`, `impact:*`); PR checklist filled.

**Branch protection:** All items above are “required status checks” for `main` and release branches.

---

## B) Nightly / Pre-Release (comprehensive; not required for every PR)

1. **Long-form Fuzz & Invariants**

   * More iterations and longer runs; randomized seeds.
   * Save failing seeds as artifacts if any; open an issue automatically.

2. **Full Static Analysis & Symbolic Execution**

   * Extended rule sets; include analyzers that take longer.
   * Export SARIF reports; attach to the run.

3. **Extended Gas Sweep**

   * Broader matrix (cold/warm sellers, extreme `maxBatch`, edge param values).
   * Trend chart generation (store as artifact).

4. **ABI/Event Change Audit**

   * Compare last release tag against `main`; produce a human-readable report (artifact) summarizing changes.

5. **Storage Layout Audit**

   * Same as above but for layout; explicit OK required before release.

6. **Documentation Link Check**

   * Verify that spec, runbooks, and ADR links resolve.

7. **Release Candidate Dry-Run (optional before tagging)**

   * Simulated deploy to a throwaway network: init params, one mint, one resale, self-buy, withdraw, pause/unpause.
   * Collect a “green” checklist artifact.

---

## C) Pre-Merge / Merge Rules

* **No “admin override” merges** on contract-impacting PRs (`impact:abi|storage|events` or `risk:high|critical`).
* If a waiver is necessary (e.g., temporary gas regression), the PR **must** include:

  * Label `waiver:*`,
  * A signed-off justification comment,
  * A follow-up issue with an owner and date to remove the waiver.

---

## D) Post-Merge / Release Activities

* **Auto-Changelog Update:** Append the PR to `CHANGELOG.md` under “Unreleased”.
* **Release Tagging (when appropriate):**

  * Tag with semantic version reflecting ABI/storage changes.
  * Attach CI artifacts (ABI diff, storage diff, gas report).
* **Upgrade Queue (if UUPS change):**

  * Create/Update the Upgrade ADR issue; attach ABI/storage diffs.
  * Queue timelock transactions; schedule post-upgrade health checks.

---

## E) Secrets, Environments, and Reliability

* **Secrets:** RPC endpoints (read-only), private keys **never** in CI; use signer mocks for tests.
* **Environments:** PRs use local fork or simulator; Nightly can use a shared ephemeral endpoint.
* **Flakiness Policy:** Any flaky test is a **P0** to stabilize or quarantine with a tracking issue due date.

---

## F) CI Artifacts (retain for ≥30 days)

* Coverage reports (HTML & summary).
* Gas snapshots (JSON/CSV) + diffs.
* ABI & storage layout diffs (human-readable + machine format).
* Static analysis SARIF.
* Long-form fuzz seed lists on failures.
* Release candidate dry-run logs.

---

# HOW TO USE THESE TEMPLATES

1. Pick the right template when opening an issue. If you’re unsure, start with **Contract Feature** and tag appropriately.
2. Always fill **Acceptance Criteria** and a **Test Plan**. If those are missing, the item is **not Ready**.
3. For any PR, paste the **PR Checklist** into the description and tick items truthfully; missing items will be caught by CI anyway.
4. Treat **labels** as part of the spec: `impact:*` labels tell reviewers and CI what to expect; `risk:*` labels drive who must sign off.
5. Keep the **DoR/DoD discipline**: it’s how you avoid ambiguity and Friday-night surprises.

---
