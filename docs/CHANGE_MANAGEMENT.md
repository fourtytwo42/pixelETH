# Change Management Policy (Contracts Only)

> Purpose: Ensure safe, auditable, and predictable evolution of on-chain contracts. This policy applies to **all** contract changes, including behavior, ABI, storage, events, parameters, and upgrades.

---

## 1) Change Types

- **Contract-Impacting**
  - **ABI**: add/remove/modify functions, events, errors
  - **Storage**: any layout changes (must be append-only)
  - **Events**: schema/topic changes affecting indexers
- **Behavioral**
  - Logic affecting pricing, payouts, counts, pause semantics
- **Params-Only**
  - BASE_PRICE, α/κ, clamps, `maxBatch`, treasury address, pause state
- **Non-Impacting**
  - Tests, docs, runbooks, CI, comments

Every change must be labeled with `impact:*` and `risk:*`.

---

## 2) Risk Levels

- **Critical** — Possible loss of funds, consensus divergence, storage corruption
- **High** — Mispricing, stuck funds, withdrawal blockage, privilege misuse
- **Medium** — Incorrect events, temporary unavailability, gas blowups
- **Low** — Minor/logging/docs inaccuracies with no state/economic impact

Security reviews assign final severity.

---

## 3) Approval Matrix

| Change Type | Risk | Required Approvals |
|---|---|---|
| Contract-Impacting (ABI/Storage/Events) | High/Critical | 1 Maintainer Lead + 1 Core Maintainer + 1 Security Reviewer + (if upgrade) ParamAdmin/Owner via Timelock |
| Contract-Impacting | Medium/Low | 1 Core Maintainer + 1 Security Reviewer |
| Behavioral | High/Critical | 1 Maintainer Lead + 1 Security Reviewer + 1 Core Maintainer |
| Behavioral | Medium/Low | 1 Core Maintainer; Security reviewer on request |
| Params-Only (PCP) | Any | ParamAdmin + Security + Maintainer Lead |
| Non-Impacting | Any | 1 Core Maintainer |

No self-approval. Reviewers must be independent of the author.

---

## 4) Lifecycle of a Change

1. **Proposal**
   - Open an issue using the correct template (Feature, PCP, Upgrade ADR, etc.)
   - Fill Acceptance Criteria (AC), Test Plan, and Risk/Impact labels
2. **Design Review**
   - Discuss behavior, invariants, storage layout impact, observability
   - For upgrades: confirm append-only storage; ABI/event diffs reviewed
3. **Implementation**
   - Draft PR referencing the issue; include PR Checklist
   - Tests first or alongside; update SPEC/TESTPLAN/RUNBOOKS as needed
4. **Verification**
   - CI green (compile, unit, property, short invariants, coverage, gas, static analysis, ABI/storage diffs)
   - Manual reviewer checks per Approval Matrix
5. **Scheduling**
   - For upgrades/params: queue timelock with execution window; publish plan
6. **Execution**
   - Execute timelock; perform post-change smoke tests on mainnet
7. **Post-Change Review**
   - Confirm monitoring clean; update CHANGELOG; close issues; document learnings

---

## 5) Versioning & Releases

- **Semantic Versioning (contracts)**
  - **MAJOR** — ABI/storage/event breaking changes
  - **MINOR** — Backward-compatible features
  - **PATCH** — Bug fixes; no behavior change beyond fix
- **Tags**
  - Tag releases with `vX.Y.Z`; attach artifacts: ABI diff, storage layout diff, gas report, test summary
- **Changelog**
  - Human-readable notes per release; link the issues/PRs

---

## 6) Upgrades (UUPS + Timelock)

**Prerequisites**
- Upgrade ADR with scope, storage append-only proof, ABI/event diff, risk analysis, test plan, rollback plan

**Process**
1. Approvals per matrix
2. Queue via timelock (24–48h); announce window
3. Execute upgrade
4. Post-upgrade validation:
   - Read params & storage probes
   - One small first-mint, one resale, one self-buy, one withdraw
   - Pause/unpause cycle
5. Update docs and CHANGELOG

**Rollback**
- Keep prior implementation reference
- If validation fails, **pause**, revert to prior impl, validate, unpause
- Publish incident note

---

## 7) Parameter Changes (PCP)

**When to Use**
- Changing treasury, BASE_PRICE, α/κ, clamps, `maxBatch`, pause

**Required**
- PCP issue (template) with motivation, risk analysis, simulation (if applicable), monitoring, backout plan, effective date

**Execution**
- Approvals (ParamAdmin + Security + Maintainer Lead)
- Timelock queued and announced
- Execute and verify:
  - Read new params
  - Run minimal buys
  - Monitor for anomalies

**Backout**
- Reverse PCP via new PCP if needed; consider pause during instability

---

## 8) Emergency Changes

- **Triggers**
  - Active exploit, severe mispricing, consensus issues, storage corruption risk
- **Actions**
  - Immediately **pause** buys
  - Gather triage team (Maintainer Lead + Security + ParamAdmin)
  - Decide: hotfix (minimal diff) or upgrade (with shortest acceptable timelock)
- **Communication**
  - Internal paging; public status update once safe
- **Aftermath**
  - Post-mortem; tests to prevent recurrence; update runbooks

---

## 9) Freeze Periods

- **Before major launches/events**
  - Enforce a code freeze (no merges except critical fixes)
  - Maintain a release branch; PRs target next cycle
- **During upgrades**
  - No other merges that change behavior until post-upgrade validation completes

---

## 10) Observability & Evidence

- **Artifacts kept ≥30 days**
  - Coverage reports, gas diffs, ABI/storage diffs, static analysis outputs, fuzz seeds on failure, upgrade execution receipts
- **Dashboards**
  - Daily revenue, failure rates, pause state, pending balances, team counts
- **Audit Trail**
  - Link issues ↔ PRs ↔ releases ↔ on-chain tx hashes

---

## 11) Communications

- **Internal**
  - Slack/Discord channels for #contracts, #security, #releases
  - Pager rotation for emergencies
- **External**
  - Release notes; status updates for pauses/upgrades; security disclosures (coordinated with Security)

---

## 12) Roles

- **Maintainer Lead** — final technical authority; coordinates reviews and incidents
- **Core Maintainers** — review and merge within policy
- **Security Reviewer** — threat modeling, severity assignment, sign-off on high/critical
- **ParamAdmin/Owner** — signs parameter changes; executes timelocked upgrades (multisig)
- **Release Manager** — tags, changelog, artifact publication

Named individuals are tracked in `docs/MAINTAINERS.md`.

---

## 13) Compliance Checks (pre-merge gates)

- Labels present: `type:*`, `risk:*`, `impact:*`
- PR checklist completed
- CI required checks green
- ABI/storage diffs acknowledged
- Docs updated
- Changelog entry included
- For upgrades/PCPs: ADR/PCP linked with timelines

---

## 14) Exceptions & Waivers

- Allowed only with:
  - `waiver:*` label, written justification, approving reviewer, and a dated follow-up issue to remove the waiver
  - Not permitted for storage reorders or unreviewed ABI changes

---

## 15) Enforcement

Repeated violations, skipping reviews, or merging with failing gates will result in revert/rollback and temporary loss of merge rights. Security and correctness are non-negotiable.

---
