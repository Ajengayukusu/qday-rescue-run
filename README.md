# Q-Day Rescue Run

[![Built on QoreChain](https://build.qorechain.io/badge/q-day-rescue-run.svg)](https://build.qorechain.io/p/q-day-rescue-run)

**Live demo:** https://ajengayukusu.github.io/qday-rescue-run/

**Demo video (≤ 3 min):** https://www.youtube.com/watch?v=x2uSC6u-1CA

**An interactive game that teaches the 5 post-quantum moves protecting your funds on QoreChain — by making you perform them.**

Built for **Build Before Q-Day: The QoreChain Developer Fest** — **Quantum Pass** track.
Track: Quantum Pass · Network: QoreChain Diana testnet (`qorechain-diana`, EVM chain ID 9800) · Licence: MIT

---

## ⏱️ Judge path — 3 minutes

**Minute 1 — Play it:** open the hosted demo at
https://ajengayukusu.github.io/qday-rescue-run/ — or run it locally:

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Play all 5 missions in demo mode (clearly labelled off-chain; it mirrors
`RescueRun.sol` v2 rules 1:1, including the sequential order). Try the traps:
approve the phishing tx in Mission 5 (mission fails, retry allowed), skip a
mission (locked — order is enforced), claim the badge early (blocked).
Then click **Connect Wallet** (QoreX or any EIP-1193 wallet on Diana): the
same buttons now send **real transactions**, wait for confirmation, and
re-read your progress from chain. The wallet panel includes the key +
window guide a real player needs.

**Minute 2 — Read the contract + tests:**

```bash
npm install && npm test
# RescueRun v2: 25 passing
```

Open `contracts/RescueRun.sol` — one file, no external dependencies:
bitmap progress, anti-replay per mission, **mission 0 verified by the
contract itself via the `pqcKeyStatus` precompile (0x0A02)**, sequential
order, phishing gated behind `reportPhishingDecision(bool)`, badge as an
on-chain record (struct + event).

**Minute 3 — Check the requirement table + on-chain proof below**, then
`frontend/src/lib/qore.ts` for the live integration layer
(`@qorechain/sdk` 0.14.0 + `@qorechain/evm` 0.14.0, dynamically imported at
connect time). The contract is **LIVE on Diana** at
`0x2dA829D9F363d4463C529D4C2170a80D13955301` (v2) and **two different
accounts** have played the full game on-chain: bitmap `0b11111`,
score 500, badge claimed — every hash is in the proof table below and
in `deployments.testnet.json`.

---

## The game

Q-Day is the day a quantum computer can forge classical ECDSA signatures.
The player guides a rescue runner who must secure a vault before Q-Day.
Each mission **is** a real post-quantum action, in the order a real user
performs them:

| # | Mission (game) | Real QoreChain action taught | How completion is verified |
|---|---|---|---|
| 1 | Register your post-quantum key | Register ML-DSA-87 key (`MsgRegisterPQCKeyV2` + proof of possession) — must be the account's **first** tx | **Contract-verified**: `completeMission(0)` calls the `pqcKeyStatus` precompile (0x0A02); reverts `PqcKeyNotRegistered` if no key is registered |
| 2 | Open a scoped EVM window | Scoped EVM authorisation window (blocks / maxTxs / maxValue / allowed targets) | **Chain-gated**: the completion tx is only admitted on Diana inside an open window, so the record proves a window was open |
| 3 | Send a hybrid transfer | Transfer signed with secp256k1 **and** ML-DSA-87; chain emits `pqc_hybrid_verify` | **Self-reported**: the transfer lives in the native lane, invisible from the EVM — completion emits `MissionSelfReported`, distinct on-chain |
| 4 | Register an encryption key | Register ML-KEM-1024 key in the KEM registry (1568 bytes, algorithmId 2) | **Self-reported**: the KEM registry is native-lane too — `MissionSelfReported`, same honest distinction |
| 5 | Reject the phishing transaction | Read what you sign; **reject** a drain disguised as a "migration" | The decision is recorded on-chain; only `reportPhishingDecision(true)` completes it |

Score: **100 points per mission, 500 max.** Completing all 5 (bitmap `0b11111`)
unlocks `claimBadge()` — the **Q-Day Survivor** badge, an on-chain record
(`Badge { claimed, claimedAt, score }` + `BadgeClaimed` event). Deliberately
not an external NFT: fewer dependencies, nothing to break.

**Sequential by design:** missions unlock in order (mission *n* requires
0..*n*−1; the contract reverts `PreviousMissionsIncomplete`). The game is a
curriculum, and the order is the real migration order — you cannot open an
EVM window before registering a key, so the game does not let you either.
A deliberate v2 design decision, not an accident.

**The verification model is the point.** A game that teaches verification
must practise it: mission 1 can no longer be claimed by merely clicking —
the contract asks the chain. Where a contract check is impossible
(missions 3–4), the contract and the UI say so instead of pretending.

**Why this is not "another certificate/checker":** existing Quantum Pass entries
are single-action tools. Rescue Run is a curriculum — the *whole* migration
sequence, including the step no tool can do for you: refusing to sign the
attack (Mission 5 fails if you approve it).

## Quantum Pass requirements → evidence

| Festival requirement | Where it is satisfied |
|---|---|
| Built with `create-qorechain-dapp` stack / QoreChain SDK | `@qorechain/sdk` 0.14.0 + `@qorechain/evm` 0.14.0 in `frontend/src/lib/qore.ts`; Hardhat + Solidity 0.8.24 contract project at repo root (the official Workshop 1 toolchain) |
| Connect QoreX | The hosted frontend has a working **Connect Wallet** flow: with a wallet connected, every mission click sends a real transaction to the live contract, waits for its receipt, and re-reads progress from chain (initial progress is a chain read too). `frontend/src/lib/qore.ts` reads native PQC status via the SDK (`fetchPqcStatus`) and EVM PQC status via the `0x0A02` precompile helper; the UI shows the player's key status (via the contract's `hasPqcKey`) plus an in-UI key-registration + EVM-window guide. Demo mode remains for wallet-less visitors, labelled off-chain everywhere |
| Deploy on testnet | **LIVE (v2)**: `RescueRun` at `0x2dA829D9F363d4463C529D4C2170a80D13955301` on Diana (deploy tx `0xd179aff7c3b7ba96ab77f5c2caab9a1079d7aad009358a549f14a8ba2627a929`, block 10091884, success). Proof table below + `deployments.testnet.json` (v1 kept as superseded history) |
| One hybrid-signed transaction | Proven repeatedly — see proof table: ML-DSA-87 key registration (`84EBDFC9…7CCC`), a hybrid bank send with `pqc_hybrid_verify = verified` (`9B1AA39F…5BAD`), and the hybrid-signed window openings behind the v1/v2 deployments (`1705A8A4…5FD6`, `A215D713…985C`) |
| Original work, built during the fest | Original game concept, contract and UI in this repo; see `AI_USAGE.md` |
| Tests | `test/RescueRun.test.ts` — **25 tests, all passing**, incl. negative cases: mission 0 without a registered PQC key (mock precompile at 0x0A02), out-of-order attempts, early badge claim, replayed mission, invalid mission id, phishing approved, double badge claim |
| Licence | MIT (`LICENSE`) |

## On-chain proof — Diana testnet (LIVE, v2)

Players (throwaway unified coin-60 accounts): deployer / player 1
`qor1dcse33ce3n3mwxxleuupqvfqeq6xl552zm2ltk` /
`0x6E2198c7198Ce3B718DFCf38103120C8346fD28A`; player 2 (independent, **not**
the deployer) `qor1359rgl28y45dldscnjzxqvcz6pz0qyrmjq488c` /
`0x8d0A347d472568DfB6189c84603302d044F0107b`.
Explorer: https://explore.qore.network (toggle: Testnet).
Machine-readable copy: `deployments.testnet.json`.

**Foundation (the real PQ actions the game teaches):**

| Step | Tx hash | Proof |
|---|---|---|
| Register ML-DSA-87 key (account's FIRST tx) | `84EBDFC9544E82FA961A45265F3976C274152A7F012BD8897BFD9721FF687CCC` | code 0; PQC account query → `found: true, possession_proven: true` (height 10086674) |
| Hybrid bank send 1000 uqor | `9B1AA39F2D087A1BCB31496A9DD57AF6039A784236DCF861F790AB3C2F785BAD` | code 0; `PQCHybridSignature` extension; `pqc_hybrid_verify` → `verified` |
| Open EVM window (17280 blocks, 20 txs, 15,000,000 uqor, no target restriction) | `1705A8A44C64C4A71E40E6DF5F44219B2142F6059713175BA704BDF1AA3F5FD6` | code 0, height 10086785; hybrid-signed (`pqc_hybrid_verify` → `verified`); window `live: true` |

**This project (EVM lane, chainId 9800) — v2, the active deployment:**

| Action | Tx hash | Block |
|---|---|---|
| Deploy `RescueRun` v2 → `0x2dA829D9F363d4463C529D4C2170a80D13955301` | `0xd179aff7c3b7ba96ab77f5c2caab9a1079d7aad009358a549f14a8ba2627a929` | 10091884 |
| Player 1 `completeMission(0)` (contract 0x0A02 check passed) | `0xe725e48b62ebdbee967c377704a0f14212b379406e975ce772f67bd3c2e96d02` | 10091924 |
| Player 1 `completeMission(1)` (scoped window) | `0x73a4b4668c286d4de676de26b1b5549fed1bba9a1de1de309bdd5f0583788122` | 10091926 |
| Player 1 `completeMission(2)` (hybrid transfer, self-reported) | `0xa17a056f8e6f355fb53fb8516696d9f2cebf2b90dc6b3ad9eeb5ba0169810bc6` | 10091928 |
| Player 1 `completeMission(3)` (ML-KEM key, self-reported) | `0x9bf7c29b55a48af1c7043175c3ec6ff80cc5051b6c9f7580ee6cb58f8d078028` | 10091930 |
| Player 1 `reportPhishingDecision(true)` (reject phishing) | `0xebb290b5f537beb37a1154c6e2dd46e7c97358e993b2d0389899535b420ef033` | 10091932 |
| Player 1 `claimBadge()` (Q-Day Survivor badge) | `0x4042a4ba108b37495751d7bcd5c0aec7f48f447d819bbbd7394c24b68c40ff15` | 10091934 |
| Player 2 `completeMission(0..3)` — full run by a non-deployer account | `0xdef694a0…a48d`, `0xc898571a…346f`, `0xc34becdc…0c15`, `0xdc7962e2…6b` (full hashes in `deployments.testnet.json`) | 10091971–10091974 |
| Player 2 `reportPhishingDecision(true)` + `claimBadge()` | `0x4832306f…4264`, `0x939edfbf…01ec` | 10091976, 10091979 |

**Verified state** (independent `eth_call`, block 10091999): for **both**
players `progressOf = 31 (0b11111)`, `missionsCompleted = 5`, `scoreOf = 500`,
`hasBadge = true`, `hasPqcKey = true` (via the contract's own precompile
call); totals `totalPlayers = 2`, `totalBadges = 2`. Player 2's exhausted
window was re-opened first (hybrid tx `75AF5F81…B7B4`); player 1's fresh
window: `A215D713…985C`. Reproduce with `npm run interact:testnet` (a repeat
run by the same player reverts on anti-replay).

**v1 (superseded):** the original `RescueRun` at
`0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A` (deploy tx `0x09eba344…ea9671`,
block 10086809; deployer's full run + badge, blocks 10086829–10086838)
remains on-chain and in `deployments.testnet.json` as history. v2 supersedes
it after a quality review: v1 accepted mission 0 on trust, allowed any
mission order, and its UI never sent transactions. The Q-Day Drill
registration references v1 and is unchanged.

*Feed clarification:* AMM-related verifications (`amm_pools`,
`ship-amm-swap`) in this project's fest feed come from the shared deployer
account's activity across our five fest projects — Rescue Run contains no
AMM code.

## Architecture

```
contracts/RescueRun.sol     Single source of truth: bitmap progress (uint8),
                            score = 100 x popcount(bitmap), badge record,
                            custom errors (no string reverts), events per action.
                            v2 adds: mission 0 checked against the 0x0A02
                            pqcKeyStatus precompile, sequential mission order,
                            distinct MissionSelfReported event (missions 3–4).
contracts/MockPqcKeyStatus.sol  Test double for the 0x0A02 precompile (tests only).
test/RescueRun.test.ts      25 Hardhat tests (ethers v6, chai), incl.
                            mock-precompile and order negative cases.
scripts/deploy.ts           Diana deploy (chainId 9800) with precondition checks.
scripts/interact-proof.ts   On-chain proof run: all 5 missions + badge claim,
                            prints every tx hash + final state.
frontend/                   Vite + React + TypeScript game UI.
  src/lib/config.ts         Chain presets + contract address (no heavy imports).
  src/lib/missions.ts       Mission content, verification labels, phishing specimen.
  src/lib/qore.ts           QoreChain layer: SDK network presets, pqcKeyStatus
                            (evm pkg), RescueRun ABI, read/write/badge helpers,
                            wallet connect. Dynamic import() at connect only.
  src/App.tsx               Demo mirrors v2 rules exactly (incl. order); live:
                            Connect Wallet, real txs, chain-read progress.
```

Design rules kept deliberately strict:

- The **contract** enforces everything (anti-replay, phishing gate, badge gate,
  sequential order, mission 0's precompile key check); the UI can lie, the
  bitmap cannot.
- **No fake verification.** Mission 0 is checked by the contract against the
  chain's own key registry; missions 3–4 are labelled self-reported in the
  contract events, the UI chips, and this README — all three layers agree.
- **Sequential unlock is a curriculum decision**, enforced on-chain; the demo
  enforces the identical order so the two modes can never diverge.
- Mission 4 has **no** path through `completeMission` — it reverts with
  `PhishingMissionRequiresReport`, so no client bug can skip the lesson.
- Approving the phishing tx is *recorded* (`PhishingReported(false)`) but
  completes nothing: the failure is the teaching moment, and retry is free.

## Run it locally

```bash
# Contract + tests
npm install
npm test            # 25 passing
npm run typecheck   # tsc --noEmit

# Frontend (demo mode, fully playable offline)
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # tsc --noEmit + vite build
```

## Deploy to Diana testnet

> Bootstrap order is enforced by the chain — do not reorder:
> **faucet → register ML-DSA-87 key (the account's FIRST tx) → open scoped EVM
> window → deploy.** An unfunded account does not exist on chain yet; an EVM tx
> without a registered key + open window is rejected (codes 26/27/28).

1. Create a **throwaway** testnet account (coin-type 60 / unified). Never use a
   wallet that holds mainnet funds.
2. Fund it via the dashboard faucet (sign-in required) — 100 QOR; cooldown
   24 h per dashboard account **and** per address.
3. Register the ML-DSA-87 key (classical signature + proof of possession), then
   verify via the PQC account endpoint (`found: true, possession_proven: true`).
4. Open a scoped EVM window (hybrid-signed), wait ~10 s.
5. `cp .env.example .env`, set `PRIVATE_KEY`, then `npm run deploy:testnet`.
6. Record address + deploy tx in the proof table and `deployments.testnet.json`;
   verify via the Cosmos tx endpoint → `code: 0`, `PQCHybridSignature`
   extension, `pqc_hybrid_verify` = `verified`.
7. Go live in the UI: set `VITE_RESCUE_RUN_ADDRESS=<address>` and rebuild.

## Threat model (short)

| Threat | Mitigation in this project |
|---|---|
| Quantum forgery of ECDSA (Q-Day) | The game teaches, and live mode uses, QoreChain's hybrid model: native actions need ML-DSA-87 co-signatures; EVM actions need a registered PQ key + scoped window, so a leaked classical key is bounded by the window |
| Phishing / malicious signature requests | Mission 5 trains rejection; on-chain, approving is recorded but never rewarded |
| Replay of a completed mission | Per-player bitmap + `MissionAlreadyCompleted`; badge claim is one-shot (`BadgeAlreadyClaimed`) |
| Contract admin abuse | No owner, no admin, no upgrade path, no external calls, holds no funds — nothing to drain, nothing to rug |
| Fake progress from a lying frontend | Every transition emits an event; anyone can recompute a bitmap/score from `MissionCompleted` logs and compare with `progressOf` |

## Honest limits

- **Deployed, with a window caveat.** The v2 contract is LIVE on Diana (proof
  table above). The EVM windows that admitted the deploy + proof runs are
  time-boxed (17,280 blocks, hybrid-signed; expire at blocks 10109124 /
  10109109): later live plays need a fresh window — the chain's design, not a
  defect. New players open their own in QoreX; the hosted UI walks them
  through it. The contract, both players' final states, and all proof txs
  remain readable on-chain regardless. Hosted frontend:
  https://ajengayukusu.github.io/qday-rescue-run/ (demo needs no wallet;
  live mode needs one).
- The game **teaches** the 5 PQ actions and records completion on-chain; it
  does not itself register your ML-DSA/ML-KEM keys or open your window —
  those are wallet/SDK actions that must precede the EVM calls.
- **Missions 3–4 are self-reported by design** (see the verification model):
  the underlying actions happen in Diana's native lane, which no EVM contract
  can observe. We chose honest labelling over fake verification — a contract
  that pretended to check would teach the opposite of the game's lesson.
- Demo mode trusts the local player by design (offline teaching mode); only
  live mode is authoritative.
- The badge is a contract record, not an ERC-721 NFT — not transferable or
  tradable. A deliberate scope choice for Quantum Pass.
- **Bundle size is fixed in v2.** Initial load is ~159 KB of JS (app shell +
  React, ~52 KB gzipped); the chain stack (SDK + CosmJS + viem, ~3.0 MB) is
  code-split and loads only when a player connects a wallet. In v1 everything
  shipped as one 2.9 MB bundle (589 KB gzipped) on first load.
- Testnet can be reset without notice; the proofs (hashes above +
  `deployments.testnet.json`) are archived here for exactly that case.

## Status & remaining work

- [x] Contract `RescueRun.sol` v2 (Solidity 0.8.24)
- [x] 25 Hardhat tests passing (incl. mock-precompile + order negative cases)
- [x] Frontend: demo mode fully playable + live mode wired (Connect Wallet sends real transactions; progress read from chain)
- [x] Deploy script for Diana (chainId 9800)
- [x] Faucet-fund deployer (100 QOR) → register ML-DSA-87 key (`84EBDFC9…7CCC`) → hybrid send verified (`9B1AA39F…5BAD`)
- [x] v1: window (`1705A8A4…5FD6`) → deploy (block 10086809) → full proof run by deployer (bitmap `0b11111`, score 500, badge)
- [x] Hosted frontend — https://ajengayukusu.github.io/qday-rescue-run/
- [x] **v2**: fresh windows for both players (`A215D713…985C`, `75AF5F81…B7B4`) → deploy (tx `0xd179aff7…a929`, block 10091884) → **two-player proof**: deployer + independent account, both 5/5 + badge; totals verified via `eth_call` (`totalPlayers = 2`, `totalBadges = 2`)
- [x] Republish hosted frontend (v2 build: live Connect Wallet, verification labels, code-split bundles)
- [x] Demo video (≤ 3 min): https://www.youtube.com/watch?v=x2uSC6u-1CA + project page on build.qorechain.io

## Credits

Built on the QoreChain stack: `@qorechain/sdk`, `@qorechain/evm`,
`create-qorechain-dapp` conventions, and the official Workshop 1 flow.
AI assistance: `AI_USAGE.md`.
