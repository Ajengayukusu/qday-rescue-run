# QCAI Audit — Stage 1 Triage

**Project:** Q-Day Rescue Run (Quantum Pass)
**Contract:** `RescueRun` — deployed on QoreChain Diana testnet at
`0x2dA829D9F363d4463C529D4C2170a80D13955301`
**Audit:** QoreChain AI (QCAI), dashboard.qorechain.io/audit — stage 1 run,
25 Nov 2026. Report PDF: `docs/QCAI-audit-stage1.pdf` (generated 11/25/2026,
9:10:43 AM local). Audited source: `flattened/RescueRun.flattened.sol`
(byte-identical to the deployed source from the pragma line down).

## Verified result (read from the PDF itself)

| Field | Value |
|---|---|
| Overall Security Score | **82/100** |
| Risk Level | **MEDIUM** |
| Quantum Readiness | **HYBRID** |
| Blockchain (as printed in the PDF) | **qorechain** ✅ |
| Total vulnerabilities | 5 (1 HIGH, 2 MEDIUM, 1 LOW, 1 INFO) |

## Triage

| # | Finding (severity) | Verdict | Evidence |
|---|---|---|---|
| 1 | Insecure Precompile Usage (HIGH) — `completeMission()` / `_requirePqcKeyRegistered()` | **Accepted risk** (auditor's technical observation is factually correct; real-world impact is nil) | `_requirePqcKeyRegistered` (RescueRun.sol:272–277) destructures the precompile result as `(bool registered, , , )` — it checks only `registered` and does **not** validate that `algorithmId == 1` (ML-DSA-87), nor `possessionProven`. That part of the finding is true. The impact, however, is self-only: on QoreChain a PQC key can be registered for an account **only by that account's owner**, via `MsgRegisterPQCKeyV2` with proof of possession, inside the owner's own hybrid authorisation window. No third party can register a weaker-algorithm key for someone else's account, and the contract holds no funds and grants no privilege beyond the player's own game progress. The worst case is a player weakening *their own* key registration to pass *their own* mission 0 in an educational game — no other player, asset, or protocol is affected. Tightening the check to `algorithmId == 1 && possessionProven` is a reasonable hardening for a future redeploy, but it does not change any security outcome for the deployed game. |
| 2 | Missing Access Control for Critical Functions (MEDIUM) — `completeMission()` / `reportPhishingDecision()` | **False positive** | Both entry points are permissionless **by design** and strictly self-scoped: `completeMission` (line 149) passes only `msg.sender` into `_completeMission(msg.sender, missionId)` (line 157), and `reportPhishingDecision` (line 164) likewise only ever touches `msg.sender`'s own bitmap. All state (`_progress`, `_badges`) is keyed per address, and there is no admin/owner function and no code path by which a caller can alter another player's state. "Unauthorised users completing missions" can only ever mean a user completing *their own* missions — which is exactly the intended authorisation model of a public game. Adding access control would break the game, not secure it. |
| 3 | Lack of Key Validation (MEDIUM) — `_requirePqcKeyRegistered()` | **Not applicable** | The contract does not accept a key from the caller; it reads the registration state that the **chain itself** recorded. Key validation happens at the native layer at registration time: `MsgRegisterPQCKeyV2` requires proof of possession of the private key before the chain stores the public key, and the `pqcKeyStatus` precompile (0x0A02) reports that chain-verified state. Re-validating the returned ML-DSA-87 public key inside the EVM (a 2,592-byte FIPS 204 key) would duplicate the chain's own registration checks and add no assurance. |
| 4 | Sequential Mission Validation Could Be Improved (LOW) — `_completeMission()` | **Accepted by design** | This is a readability suggestion, not a vulnerability. The sequential rule is enforced explicitly and correctly in `_completeMission` (lines 279–292): `requiredMask = (1 << missionId) - 1` (bits 0..n−1) and the call reverts with `PreviousMissionsIncomplete` unless `bitmap & requiredMask == requiredMask`. The curriculum order is a documented design decision (see the contract NatSpec, "ORDER: missions are a curriculum and are SEQUENTIAL by design") and is covered by the test suite. |
| 5 | Missing Event Emission for Self-Reported Missions (INFO) — `completeMission()` | **False positive** | Every mission emits an event. In `_completeMission` (lines 294–310), missions 0, 1 and 4 emit `MissionCompleted`; missions 2 and 3 emit the dedicated `MissionSelfReported` event instead — a deliberate, documented distinction (contract NatSpec, lines 53–59 and 106–117) so indexers and auditors can tell chain-backed completions apart from native-lane actions the EVM cannot observe. Mission 1 in particular **does** emit `MissionCompleted`; no mission is silent. |

## Summary

- Real issues requiring a code change: **none**.
- The one technically accurate observation is finding #1: mission 0's
  precompile gate checks registration only, not `algorithmId` /
  `possessionProven`. Because PQC key registration on QoreChain is
  owner-only (proof of possession, owner's own hybrid window), the gap is
  exploitable only by a player against their own account in a fundless
  educational game, and is recorded here as an accepted risk. If the
  contract is ever redeployed, adding `algorithmId == 1 &&
  possessionProven` to `_requirePqcKeyRegistered` is the natural
  hardening.
- Findings #2 and #5 do not match the code (self-scoped `msg.sender`
  state; an event is emitted for every mission). Finding #3 targets a
  check the chain performs at registration. Finding #4 is a style
  suggestion about an intentional, tested design.
