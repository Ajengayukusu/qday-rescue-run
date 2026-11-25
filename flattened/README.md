# QCAI Audit — Flattened Source (Q-Day Rescue Run)

## What this is

`RescueRun.flattened.sol` is the Hardhat-flattened source of the **deployed**
Q-Day Rescue Run game contract, prepared for the QCAI quantum-security audit
on the QoreChain dashboard.

| Item | Value |
|---|---|
| Contract | `RescueRun` (+ the `IQorePqcKeyStatus` interface defined in the same file) |
| Source file | `contracts/RescueRun.sol` (the contract is self-contained — no imports) |
| Deployed address (Diana testnet, chain ID 9800) | `0x2dA829D9F363d4463C529D4C2170a80D13955301` |
| Deploy tx | `0xd179aff7c3b7ba96ab77f5c2caab9a1079d7aad009358a549f14a8ba2627a929` (block 10091884) |
| Compiler | Solidity 0.8.24 (exact pragma, no floating range) |

## How the flattened file was produced and verified

```bash
npx hardhat flatten contracts/RescueRun.sol > flattened/RescueRun.flattened.sol
```

Verification (re-run before every audit): the flattened file is
**byte-identical to the deployed source from the `pragma solidity 0.8.24;`
line to end-of-file** (311 lines, empty `diff`). The only differences are the
standard Hardhat flatten artefacts above the pragma: the flatten banner
comment, the single consolidated SPDX line, the `// File contracts/RescueRun.sol`
marker and the `// Original license:` note. No contract code was changed by
flattening — not one character.

The flattened file contains **only** the deployed code: the
`IQorePqcKeyStatus` interface and the `RescueRun` contract. The test-only
`contracts/MockPqcKeyStatus.sol` is **not** included (the deployed contract
never imports it; it calls the real precompile address directly), and no test
code of any kind is in the file.

## How to run the QCAI audit

1. Open https://dashboard.qorechain.io/audit and sign in with the project
   account.
2. The audit form has **no file-upload button** — paste the **entire**
   contents of `RescueRun.flattened.sol` into the **"Contract Source Code"**
   field.
3. Set **Blockchain = QoreChain**.
4. Run the audit and confirm the cost dialog when asked (testnet QOR only —
   the dashboard shows "Audit Cost: 150 QOR"; on Testnet mode no mainnet
   funds are involved).
5. The dashboard does **not** keep audit history and issues no public report
   URL — the report renders inline and the only export is the PDF. Download
   the PDF immediately and store it in the repo (see the DeedLock Escrow
   project's `audit/` folder for the pattern used on 2026-11-16, score 82).
6. Two-stage plan: run the audit **twice on the exact same source** (stage 1
   and stage 2 are two independent runs of the dashboard auditor on this
   identical file) and triage **every** finding in writing against the code —
   false positive / not applicable / accepted risk / accepted by design, each
   with code evidence. No silent dismissals.

## Auditor context — what this contract honestly does

`RescueRun` is the on-chain core of **Q-Day Rescue Run**, an educational game
for the QoreChain Developer Fest (Quantum Pass category) that teaches the
five post-quantum survival actions on QoreChain. A player completes 5
missions; finishing all 5 lets them claim an on-chain "Q-Day Survivor" badge
record. The contract holds **no funds** (no `payable` functions, no token
custody), has **no owner/admin roles** and no upgrade mechanism — it only
records per-player mission progress (a bitmask), scores and badge claims.

Mission map (missionId → real QoreChain action taught):

| Mission | Action | How completion is verified |
|---|---|---|
| 0 | Register an ML-DSA-87 (FIPS 204) post-quantum key | **Contract-verified** (see below) |
| 1 | Open a scoped EVM authorisation window | Chain-gated (see below) |
| 2 | Send a hybrid transfer (secp256k1 + ML-DSA-87) | **Self-reported — by design** |
| 3 | Register an ML-KEM-1024 (FIPS 203) encryption key | **Self-reported — by design** |
| 4 | Reject a phishing transaction | Decision recorded on-chain via `reportPhishingDecision` |

The verification model, stated exactly as the contract implements it:

- **Mission 0 is contract-verified.** Before accepting it, `completeMission(0)`
  calls the **pqcKeyStatus precompile at 0x0A02** for the player's account
  and reverts with `PqcKeyNotRegistered` if no ML-DSA key is registered.
  Claiming mission 0 without the real action is impossible.
- **Mission 1 is chain-gated.** On Diana, an EVM transaction is only admitted
  inside the player's open EVM authorisation window, so the completion
  transaction itself could only land on the live chain if a window was really
  open. The contract cannot read native window state and does not pretend to
  check more than that.
- **Missions 2 and 3 are self-reported BY DESIGN.** The underlying actions (a
  hybrid-signed native transfer; an ML-KEM key registration in the native KEM
  registry) happen in QoreChain's **native lane**, which an EVM contract
  cannot observe — no on-chain check is possible from the EVM side. These
  missions therefore emit `MissionSelfReported` (not `MissionCompleted`) so
  indexers, the UI and auditors can always tell self-reported progress apart
  from verified progress. This is a deliberate, documented design limit, not
  a hidden weakness.
- **Missions are strictly sequential**: mission *n* requires missions
  0..n−1 to be complete first (`PreviousMissionsIncomplete`).
- **The badge can only be claimed after all 5 missions are complete**, and
  each player can claim it at most once.

Supporting evidence in this repo: the full Hardhat test suite
(`test/RescueRun.test.ts`, 25 tests, all passing) exercises the contract
against a local mock of the pqcKeyStatus precompile, and
`deployments.testnet.json` records the live deployment plus six independent
players who each completed all five missions and claimed the badge on the
real testnet (totals re-verified on-chain: 6 players, 6 badges).
