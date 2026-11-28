# QCAI Audit — Stage 2 Triage

**Project:** Q-Day Rescue Run (Quantum Pass)
**Contract:** `RescueRun` — deployed on QoreChain Diana testnet at
`0x2dA829D9F363d4463C529D4C2170a80D13955301`
**Audit:** QoreChain AI (QCAI), dashboard.qorechain.io/audit — stage 2 run,
28 Nov 2026. Report PDF: `docs/QCAI-audit-stage2.pdf` (generated 11/28/2026,
7:12:19 AM local). Audited source: `flattened/RescueRun.flattened.sol`
(318 lines / 13,189 bytes, byte-identical to the repo file, fetched fresh
from raw GitHub on the day of the run).

## Verified result (read from the PDF itself)

| Field | Value |
|---|---|
| Overall Security Score | **82/100** |
| Risk Level | **MEDIUM** |
| Quantum Readiness | **HYBRID** |
| Blockchain (as printed in the PDF) | **qorechain** ✅ |
| Total vulnerabilities | 5 (1 HIGH, 2 MEDIUM, 1 LOW, 1 INFO) |

Note: the score (82/100) is identical to stage 1, but the finding set is
entirely different — the analyzer produced a new set of five findings for
the same unchanged source. Scores and finding sets vary per run and are
not directly comparable across runs.

## Triage

| # | Finding (severity) | Verdict | Evidence |
|---|---|---|---|
| 1 | Inconsistent PQC Algorithm Usage (HIGH) — contract RescueRun, line 47 | **False positive** | The finding claims the contract "does not specify which ML-KEM variant is used for mission 3". It does: the contract NatSpec mission map states `3 -> Register an ML-KEM-1024 (FIPS 203) encryption key` (RescueRun.sol:37; flattened:43, inside the block the PDF cites). ML-DSA-87 (FIPS 204) for mission 0 and ML-KEM-1024 (FIPS 203) for mission 3 are both named explicitly. On-chain validation of mission 3 is impossible by design — the ML-KEM registration happens in QoreChain's native KEM registry, which the EVM cannot observe — so mission 3 is self-reported and emits `MissionSelfReported`, not `MissionCompleted` (contract NatSpec, lines 49–59). The premise of the finding does not match the code. |
| 2 | Reentrancy Risk in Mission Completion (MEDIUM) — function `_completeMission` | **False positive** | `_completeMission` (RescueRun.sol:279–310) makes **no external call at all**: it reads/writes its own mappings, calls only internal/view helpers (`_isDone`, `scoreOf`), and emits events. A grep of the whole contract finds no `.call`, `transfer`, `send`, or `delegatecall`. Event emission cannot invoke external code, so no reentrancy is possible, and updating state before emitting events is the correct order (checks → effects → events, with no interactions). The finding's premise — "if external calls are made during event emission" — describes a call that does not exist. |
| 3 | Missing Input Validation for Mission IDs (LOW) — function `completeMission` | **False positive** | Validation is complete for every possible `uint8` value. `completeMission` (RescueRun.sol:149–160) reverts with `InvalidMission` for `missionId >= MISSION_COUNT` (5), and routes mission 4 away with `PhishingMissionRequiresReport` — so exactly missions 0–3 are accepted here and mission 4 only via `reportPhishingDecision`. There is no "allowed mission ID" beyond 0–4, and no value can slip through: the range check plus the mission-4 routing cover the full input domain. |
| 4 | Redundant Loop in Score Calculation (INFO) — functions `scoreOf`, `missionsCompleted` | **Not applicable** | The recommendation ("use built-in bit counting functions like `popcount`") does not exist in this language: Solidity 0.8.24 has no `popcount` builtin. The loops are bounded to exactly 5 iterations over a 5-bit bitmap, in `view` functions, so the gas cost is negligible and fixed. There is nothing to optimise here without adding a dependency for zero benefit. |
| 5 | Phishing Decision Reentrancy (MEDIUM) — function `reportPhishingDecision` | **False positive** | Two errors in the finding. First, "reentrancy": the function makes no external call (see finding #2 — the whole contract has none), so reentrancy is impossible. Second, "repeated reporting": the non-rejected path (RescueRun.sol:164–168) writes **no state at all** — it only emits `PhishingReported(msg.sender, false, false)` and returns, so repeating it costs the reporter their own gas and changes nothing; there is no state bloat and no DoS vector. The completing path (`rejected == true`) reverts with `MissionAlreadyCompleted` if mission 4 is already done, and `_completeMission` enforces exactly-once completion. Reporting is self-scoped (`msg.sender` only) by design — a player can only ever report their own decision. |

## Summary

- Real issues requiring a code change: **none**.
- Findings #1, #2, #3 and #5 do not match the code (the ML-KEM variant
  is documented; there is no external call anywhere in the contract, so
  neither "reentrancy" finding can occur; mission-ID validation covers
  the full input domain; the non-rejected phishing path writes no
  state). Finding #4 recommends a builtin that does not exist in
  Solidity 0.8.24, for a 5-iteration loop in view functions.
- Stage 2 confirms the stage 1 conclusion from a different angle: the
  contract holds no funds, grants no privilege beyond the player's own
  game progress, and every state change is strictly scoped to
  `msg.sender`. No code change follows from this audit.
