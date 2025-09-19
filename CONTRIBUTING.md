# Contributing Guide (Contracts Only)

> Scope: Pixel canvas smart contracts for Base. This repo governs contract code, tests, specs, audits, runbooks, and CI policies. No frontend or server components live here.

---

## 1) Principles

- **KISS & Safety First** — One mutator (`buyPacked`), pull-payments, pausable, UUPS + timelock upgrades, strict validation, deterministic pricing.
- **Spec-Driven** — Every change traces back to SPEC.md, TESTPLAN.md, and an issue template with Acceptance Criteria (AC).
- **Test-First** — Unit, property/fuzz, invariants, scenarios, gas budgets. No feature merges without tests.
- **Append-Only Storage** — Storage layout never reorders; new variables append only.
- **Transparent Governance** — Parameter changes (PCP) and Upgrades (ADR) follow a documented, reviewable process.

---

## 2) Repository Structure (authoritative)

- `contracts/` — Core contracts, interfaces, access control, libraries.
- `test/` — Unit, property/fuzz, invariants, scenarios, gas baselines.
- `script/` — High-level deployment/upgrade runbooks (no private keys).
- `docs/` — SPEC.md, TESTPLAN.md, RUNBOOKS, ADRs, audit reports, param history.
- `.github/ISSUE_TEMPLATE/` — Issue templates (Epic, Feature, Bug, Security, PCP, Upgrade ADR, Tests, Gas, Docs).
- `.github/workflows/` — CI definitions (fast PR lane, nightly lane).
- `CHANGELOG.md` — Human-readable release notes.

Keep file names stable. Spec and runbooks are part of the API: changes require review.

---

## 3) Ways to Contribute

- **Features/Refactors** — Use “Contract Feature / Change Request” template.
- **Bugs** — Use “Bug Report” with reproduction and severity.
- **Security** — Use “Security Finding / Threat Report” (see §11).
- **Tests** — Use “Test Case / Scenario Request” for new coverage.
- **Docs/Runbooks** — Use “Runbook / Docs Update”.

Always link issues to PRs and reference Acceptance Criteria.

---

## 4) Branching & Commits

- **Branches**
  - `main` — Protected. Only via reviewed PRs with green CI.
  - `release/x.y` — Tagged releases (as needed).
  - `feature/<slug>` — One feature per branch.
  - `hotfix/<slug>` — Incident response branches.

- **Commit Convention** (Conventional Commits)
  - `feat:`, `fix:`, `perf:`, `refactor:`, `docs:`, `test:`, `chore:`
  - Include scope when helpful: `feat(canvas): ...`
  - If change affects ABI/storage/events, include footer: `BREAKING-ABI:` or `STORAGE-APPEND:`

- **PR Titles**
  - Imperative, concise, with category labels: `feat(canvas): snapshot multipliers per tx`

---

## 5) Definition of Ready (DoR)

An issue is **Ready** when it includes:
- Problem statement + Motivation/Value
- Authoritative behavior spec (no pseudocode required)
- AC (Given/When/Then)
- Test plan (unit/property/invariant/scenario/gas)
- Risk label (`risk:*`) and impact label (`impact:*`)
- Stakeholders/owners identified

---

## 6) Definition of Done (DoD)

A change is **Done** when:
- All AC pass and tests are included/updated
- CI required checks are green (see CI policy)
- Storage layout check passes (append-only)
- ABI/event diff acknowledged and labeled if changed
- Gas budgets within thresholds or documented waiver with follow-up issue
- Docs updated (SPEC/RUNBOOKS/TESTPLAN/CHANGELOG)
- Labels reflect final state; reviewers approved per approval matrix

---

## 7) Reviews & Approvals

- **Standard PR**: 2 approvals (one core contracts maintainer).
- **Contract-impacting (ABI|storage|events) or `risk:high|critical`**:
  - 2 approvals + Security reviewer + Maintainer lead
  - If upgrade: link an Upgrade ADR and timelock plan
- **Security fixes**: Security reviewer required; limited diff, targeted tests.

Use labels to signal reviewers: `impact:*`, `risk:*`, `needs:audit`, `ready`.

---

## 8) Testing Requirements (must-haves)

For any behavioral change:
- **Unit**: success paths, reverts, boundary conditions
- **Property/Fuzz**: accounting conservation, counts correctness, snapshot multiplier constancy, monotonic `lastPaid` given clamps, determinism of totals
- **Invariants**: short-form in PR lane; long-form nightly
- **Scenarios**: at least one end-to-end relevant to the change
- **Gas**: update baseline for key cases; no >15% regressions without waiver

For “params-only” changes: limited tests + PCP adherence.

---

## 9) Documentation Duties

- Update **SPEC.md** if behavior changes
- Update **TESTPLAN.md** with new/modified cases
- Update **RUNBOOKS/** if ops behavior changes (pause, upgrade cadence)
- Append to **CHANGELOG.md** under “Unreleased”
- Add/Update ADRs (architecture decisions) for upgrades/major changes

---

## 10) Parameter Changes (PCP)

Use the “Parameter Change Proposal” template:
- State current→proposed values and motivation
- Risk/impact analysis (game-theory, UX)
- Timelock schedule, monitoring, backout plan
- Approvals: ParamAdmin + Security + Maintainer lead

No param change merges until PCP is approved and scheduled.

---

## 11) Security Policy (Responsible Disclosure)

- Report via the “Security Finding / Threat Report” template.
- Do **not** open public PRs/issues for undisclosed vulnerabilities.
- Severity uses `critical|high|medium|low`.
- For critical/high: consider immediate **pause**, coordinate fix (hotfix or upgrade), and plan disclosure.
- Post-incident: tests added; mitigations documented; timeline captured.

---

## 12) Upgrades (UUPS + Timelock)

- All upgrades require an **Upgrade ADR** (scope, storage append, risk, test plan).
- Queue via timelock; publish schedule; execute after delay.
- Post-upgrade smoke tests (views, small buys, withdraw, pause).
- Rollback plan defined (prior impl ref).

---

## 13) CI Expectations (what you must pass)

See the CI Policy in `.github/` and the checklist embedded in PR templates. In short:
- Compile/lint, Unit, Property, Short-invariants, Coverage (≥95%), Gas diff, Static analysis, ABI & Storage diffs, License checks, PR hygiene.

---

## 14) Code of Conduct

We follow a professional, respectful collaboration standard. Be concise, constructive, and kind. Security and safety take precedence over speed.

---

## 15) Getting Help

- Tag maintainers with `@contracts-maintainers` label.
- For security, page `@security-review` (do not disclose details publicly).
- For governance/params, tag `@param-admin`.

Thank you for contributing to a safer, simpler protocol.
