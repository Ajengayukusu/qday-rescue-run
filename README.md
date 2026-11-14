# Q-Day Rescue Run

[![Built on QoreChain](https://build.qorechain.io/badge/q-day-rescue-run.svg)](https://build.qorechain.io/p/q-day-rescue-run)

**An interactive game that teaches the 5 post-quantum moves protecting your funds on QoreChain — by making you perform them.**

Built for **Build Before Q-Day: The QoreChain Developer Fest** — **Quantum Pass** track.
Track: Quantum Pass · Network: QoreChain Diana testnet (`qorechain-diana`, EVM chain ID 9800) · Licence: MIT

---

## ⏱️ Judge path — 3 minutes

**Minute 1 — Play it (no wallet, no chain needed):**

```bash
cd frontend && npm install && npm run dev   # http://localhost:5173
```

Play all 5 missions in demo mode. Demo state mirrors `RescueRun.sol` 1:1.
Try the traps: approve the phishing tx in Mission 5 (mission fails, retry allowed),
and try claiming the badge early (the UI blocks it — and the contract reverts it).

**Minute 2 — Read the contract + tests:**

```bash
npm install && npm test
# Compiled 1 Solidity file successfully (solc 0.8.24)
# RescueRun (Q-Day Rescue Run): 18 passing
```

Open `contracts/RescueRun.sol` — one file, no external dependencies:
bitmap progress, anti-replay per mission, phishing mission gated behind
`reportPhishingDecision(bool)`, badge as an on-chain record (struct + event).

**Minute 3 — Check the requirement table + on-chain proof below**, then
`frontend/src/lib/qore.ts` for the live QoreChain integration layer
(`@qorechain/sdk` 0.14.0 + `@qorechain/evm` 0.14.0). The contract is
**LIVE on Diana** at `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A` and the
deployer has already played the full game on-chain: bitmap `0b11111`,
score 500, badge claimed — every tx hash is in the proof table below and
in `deployments.testnet.json`.

---

## The game

Q-Day is the day a quantum computer can forge classical ECDSA signatures.
The player guides a rescue runner who must secure a vault before Q-Day.
Each mission **is** a real post-quantum action on QoreChain, in the order a
real user performs them:

| # | Mission (game) | Real QoreChain action taught | On-chain record |
|---|---|---|---|
| 1 | Register your post-quantum key | Register ML-DSA-87 key (`MsgRegisterPQCKeyV2` + proof of possession) — must be the account's **first** tx | `completeMission(0)` |
| 2 | Open a scoped EVM window | Scoped EVM authorisation window (blocks / maxTxs / maxValue / allowed targets) | `completeMission(1)` |
| 3 | Send a hybrid transfer | Transfer signed with secp256k1 **and** ML-DSA-87; chain emits `pqc_hybrid_verify` | `completeMission(2)` |
| 4 | Register an encryption key | Register ML-KEM-1024 key in the KEM registry (1568 bytes, algorithmId 2) | `completeMission(3)` |
| 5 | Reject the phishing transaction | Read what you sign; **reject** a drain disguised as a "migration" | `reportPhishingDecision(true)` only |

Score: **100 points per mission, 500 max.** Completing all 5 (bitmap `0b11111`)
unlocks `claimBadge()` — the **Q-Day Survivor** badge, stored as an on-chain
record (`Badge { claimed, claimedAt, score }` + `BadgeClaimed` event).
Deliberately not an external NFT: fewer dependencies, nothing to break.

**Why this is not "another certificate/checker":** existing Quantum Pass entries
are single-action tools. Rescue Run is a curriculum — it teaches the *whole*
migration sequence, including the one step no tool can do for you: refusing to
sign the attack (Mission 5 fails if you approve it).

## Quantum Pass requirements → evidence

| Festival requirement | Where it is satisfied |
|---|---|
| Built with `create-qorechain-dapp` stack / QoreChain SDK | `@qorechain/sdk` 0.14.0 + `@qorechain/evm` 0.14.0 in `frontend/src/lib/qore.ts`; Hardhat + Solidity 0.8.24 contract project at repo root (same toolchain as the official Workshop 1 Hardhat template) |
| Connect QoreX | Live mode in `qore.ts` reads native PQC status via the SDK (`fetchPqcStatus`) and EVM PQC status via the `0x0A02` precompile helper; writes go through the player's injected EIP-1193 wallet inside an open EVM window (QoreX opens the standard window; scoped windows via SDK/CLI) |
| Deploy on testnet | **LIVE**: `RescueRun` at `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A` on Diana (deploy tx `0x09eba3445f1ab073c7845ca8af2a5fe1c28a72265c8840568354633218ea9671`, block 10086809, status success). Full proof table below + `deployments.testnet.json` |
| One hybrid-signed transaction | Proven several times over — see proof table: ML-DSA-87 key registration (`84EBDFC9…7CCC`), a hybrid bank send with event `pqc_hybrid_verify = verified` (`9B1AA39F…5BAD`), and the hybrid-signed EVM window opening that admitted the deployment (`1705A8A4…5FD6`, also `pqc_hybrid_verify = verified`) |
| Original work, built during the fest | Original game concept, contract and UI in this repo; AI workflow disclosed in `AI_USAGE.md` |
| Tests | `test/RescueRun.test.ts` — **18 tests, all passing**, incl. 9 negative/attack cases (early badge claim, replayed mission, invalid mission id, phishing approved, double badge claim, …) |
| Licence | MIT (`LICENSE`) |

## On-chain proof — Diana testnet (LIVE)

Deployer / player (throwaway unified coin-60 account):
`qor1dcse33ce3n3mwxxleuupqvfqeq6xl552zm2ltk` /
`0x6E2198c7198Ce3B718DFCf38103120C8346fD28A`.
Explorer: https://explore.qore.network (toggle: Testnet).
Machine-readable copy: `deployments.testnet.json`.

**Foundation (the real PQ actions the game teaches):**

| Step | Tx hash | Proof |
|---|---|---|
| Register ML-DSA-87 key (account's FIRST tx) | `84EBDFC9544E82FA961A45265F3976C274152A7F012BD8897BFD9721FF687CCC` | code 0; `GET /qorechain/pqc/v1/account/<addr>` → `found: true, possession_proven: true` (height 10086674) |
| Hybrid bank send 1000 uqor | `9B1AA39F2D087A1BCB31496A9DD57AF6039A784236DCF861F790AB3C2F785BAD` | code 0; `PQCHybridSignature` extension; event `pqc_hybrid_verify` → `status=verified` |
| Open EVM window (17280 blocks, 20 txs, 15,000,000 uqor, no target restriction) | `1705A8A44C64C4A71E40E6DF5F44219B2142F6059713175BA704BDF1AA3F5FD6` | code 0, height 10086785; hybrid-signed — event `pqc_hybrid_verify` → `status=verified`; window `live: true` |

**This project (EVM lane, chainId 9800):**

| Action | Tx hash | Block |
|---|---|---|
| Deploy `RescueRun` → `0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A` | `0x09eba3445f1ab073c7845ca8af2a5fe1c28a72265c8840568354633218ea9671` | 10086809 |
| `completeMission(0)` — register PQ key | `0x81ec9fcae6862c9854c097c377ed600a6a476087de3aaf4ce03c8c456403331a` | 10086829 |
| `completeMission(1)` — scoped window | `0xda4a89a3c08176cb4a902dbd2d6e514825f044b58742fb10efff398b119ed8ed` | 10086831 |
| `completeMission(2)` — hybrid transfer | `0x5c7156209f3156182c9556fc3c7b0710a45457e2801b5cdfa0baa6d314f6ebb3` | 10086833 |
| `completeMission(3)` — ML-KEM key | `0x29ccbb2ddedad17e1c801b7add673bc1e078164211b05c4e441fe71c570ed67a` | 10086834 |
| `reportPhishingDecision(true)` — reject phishing | `0xdc2aa1334869c07d26aa4de4b744a1b71028648d43255cb00d0e18bf54b580ed` | 10086836 |
| `claimBadge()` — Q-Day Survivor badge | `0x05a540d1e7eff53e162fea50dcd1ec832bdb221213ec097cd7c814c42e65502f` | 10086838 |

**Verified state** (independent `eth_call` after the run, block 10086846):
`progressOf(player) = 31 (0b11111)`, `missionsCompleted = 5`,
`scoreOf = 500`, `hasBadge = true`,
`badgeOf = (claimed: true, claimedAt: 1794678682, score: 500)`,
`totalPlayers = 1`, `totalBadges = 1`. Reproduce with
`npm run interact:testnet` (idempotent only for a fresh player — a second
run by the same player correctly reverts on anti-replay).

## Architecture

```
contracts/RescueRun.sol     Single source of truth: bitmap progress (uint8),
                            score = 100 x popcount(bitmap), badge record,
                            custom errors (no string reverts), events per action.
test/RescueRun.test.ts      18 Hardhat tests (TypeScript, ethers v6, chai).
scripts/deploy.ts           Diana deploy (chainId 9800) with precondition checks.
scripts/interact-proof.ts   On-chain proof run: plays all 5 missions + badge
                            claim and prints every tx hash + final state.
frontend/                   Vite + React + TypeScript game UI.
  src/lib/missions.ts       Mission content + the phishing tx specimen.
  src/lib/qore.ts           QoreChain layer: NETWORKS.testnet presets (SDK),
                            qorechainTestnet chain + pqcKeyStatus (evm pkg),
                            RescueRun ABI, read/write/badge helpers.
  src/App.tsx               Demo mode: local state mirroring the contract rules
                            exactly; live mode flips on with one env var.
```

Design rules kept deliberately strict:

- The **contract** enforces everything (anti-replay, phishing gate, badge gate);
  the UI can lie, the bitmap cannot.
- Mission 4 has **no** path through `completeMission` — it reverts with
  `PhishingMissionRequiresReport`, so no client bug can skip the lesson.
- Approving the phishing tx is *recorded* (`PhishingReported(false)`) but
  completes nothing: the failure itself is the teaching moment, and retry is free.

## Run it locally

```bash
# Contract + tests
npm install
npm test            # 18 passing
npm run typecheck   # tsc --noEmit

# Frontend (demo mode, fully playable offline)
cd frontend
npm install
npm run dev         # http://localhost:5173
npm run build       # tsc --noEmit + vite build — must pass before submission
```

## Deploy to Diana testnet

> Bootstrap order is enforced by the chain — do not reorder:
> **faucet → register ML-DSA-87 key (the account's FIRST tx) → open scoped EVM
> window → deploy.** An unfunded account does not exist on chain yet; an EVM tx
> without a registered key + open window is rejected (codes 26/27/28).

1. Create a **throwaway** testnet account (coin-type 60 / unified). Never use a
   wallet that holds mainnet funds.
2. Fund it: https://dashboard.qorechain.io/faucet (sign-in required) — paste the
   `qor1...` address, receive 100 QOR. Cooldown: 24 h per dashboard account **and**
   per address.
3. Register the ML-DSA-87 key (classical signature + proof of possession),
   then verify: `GET https://api-testnet.qore.host/qorechain/pqc/v1/account/<qor1...>`
   → `found: true, possession_proven: true`.
4. Open a scoped EVM window (hybrid-signed), wait ~10 s for the nonce to advance.
5. `cp .env.example .env`, set `PRIVATE_KEY`, then:
   ```bash
   npm run deploy:testnet
   ```
6. Record the contract address + deploy tx hash in the proof table (README +
   `deployments.testnet.json`), verify the hybrid signature:
   `GET https://api-testnet.qore.host/cosmos/tx/v1beta1/txs/<HASH>` →
   `code: 0`, `PQCHybridSignature` extension, event `pqc_hybrid_verify` = `verified`.
7. Go live in the UI: set `VITE_RESCUE_RUN_ADDRESS=<address>` in `frontend/.env`
   and rebuild.

## Threat model (short)

| Threat | Mitigation in this project |
|---|---|
| Quantum forgery of ECDSA (Q-Day) | The game teaches, and live mode uses, QoreChain's hybrid model: native actions need ML-DSA-87 co-signatures; EVM actions need a registered PQ key + scoped window, so a leaked classical key alone is bounded by the window |
| Phishing / malicious signature requests | Mission 5 trains rejection; on-chain, approving is recorded but never rewarded |
| Replay of a completed mission | Per-player bitmap + `MissionAlreadyCompleted` custom error; badge claim is one-shot (`BadgeAlreadyClaimed`) |
| Contract admin abuse | There is no owner, no admin, no upgrade path, no external calls, and the contract holds no funds — nothing to drain, nothing to rug |
| Fake progress from a lying frontend | All state transitions emit events; anyone can recompute a player's bitmap/score from `MissionCompleted` logs and compare with `progressOf` |

## Honest limits

- **Deployed, with a window caveat.** The contract is LIVE on Diana (proof
  table above). The EVM authorisation window that admitted the deploy + the
  proof run is time-boxed (opened at height 10086785, expires at 10104065,
  13 of 20 txs left when the run finished): after it expires, further live
  plays need a fresh window — that is the chain's design, not a defect, and
  the hosted frontend must open/refresh windows for players the same way.
  A hosted deployment of the frontend with `VITE_RESCUE_RUN_ADDRESS` set is
  still to be published (demo mode works offline today).
- The game **teaches** the 5 PQ actions and records completion on-chain; in live
  mode it does not itself register your ML-DSA/ML-KEM keys or open your window —
  those are wallet/SDK actions (QoreX / `scripts` in the official workshop) that
  must happen before the EVM window lets the game contract be called.
- Demo mode trusts the local player by design (it is an offline teaching mode);
  only live mode is authoritative.
- The badge is a contract record, not an ERC-721 NFT — it is not transferable or
  tradable. That is a deliberate scope choice for Quantum Pass.
- Frontend bundle is large (~2.9 MB before gzip, ~591 kB gzipped) because the
  QoreChain SDK pulls the CosmJS stack; code-splitting the live layer is a known,
  listed improvement — it does not affect demo gameplay.
- Testnet can be reset without notice; deployment proofs (tx hashes above +
  `deployments.testnet.json`) are archived in this repo for exactly that case.

## Status & remaining work

- [x] Contract `RescueRun.sol` (Solidity 0.8.24)
- [x] 18 Hardhat tests passing (incl. negative/attack cases)
- [x] Frontend demo mode fully playable; live integration layer typechecks (`npm run build` passes)
- [x] Deploy script for Diana (chainId 9800)
- [x] Faucet-fund the throwaway deployer (100 QOR, Dashboard)
- [x] Register deployer ML-DSA-87 key (tx `84EBDFC9…7CCC`) → hybrid send verified (`9B1AA39F…5BAD`)
- [x] Open EVM window hybrid-signed (tx `1705A8A4…5FD6`) → deploy (tx `0x09eba344…9671`, block 10086809)
- [x] Full on-chain proof run: 5 missions + badge claim by the deployer; state verified via `eth_call` (bitmap `0b11111`, badge claimed, score 500)
- [ ] Publish hosted frontend with `VITE_RESCUE_RUN_ADDRESS=0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A`
- [ ] Demo video (≤ 3 min) + project page on build.qorechain.io

## Credits

Built on the QoreChain stack: `@qorechain/sdk`, `@qorechain/evm`,
`create-qorechain-dapp` conventions and the official Build Before Q-Day
Workshop 1 flow (hybrid signing, window, verification). AI assistance is
disclosed in full in `AI_USAGE.md`.
