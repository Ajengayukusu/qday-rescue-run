import { useMemo, useRef, useState } from "react";
import type { Address, EIP1193Provider } from "viem";
import {
  FULL_BITMAP,
  MISSIONS,
  PHISHING_MISSION_ID,
  PHISHING_TX,
  POINTS_PER_MISSION,
} from "./lib/missions";
import { DIANA, RESCUE_RUN_ADDRESS, isLiveConfigured } from "./lib/config";

type QoreModule = typeof import("./lib/qore");

/**
 * Q-Day Rescue Run — two honest modes:
 *
 *  DEMO (default, off-chain): local state mirrors RescueRun.sol v2 rules
 *  exactly — sequential missions, anti-replay, phishing gate, badge gate.
 *  It is labelled demo everywhere; nothing here touches the chain.
 *
 *  LIVE: Connect Wallet (QoreX or any EIP-1193 wallet on Diana, chainId
 *  9800). Progress is READ from the deployed RescueRun v2 contract, and
 *  every mission click SENDS a real transaction, waits for its receipt,
 *  then re-reads progress from chain. The heavy chain layer
 *  (src/lib/qore.ts) is dynamically imported only at connect time.
 *
 * Both modes label each mission with how it is verified — contract-checked
 * (mission 1), chain-gated (mission 2), self-reported (missions 3-4) or a
 * recorded decision (mission 5) — mirroring the contract's own events.
 */

function unlocked(bitmap: number, missionId: number): boolean {
  const required = missionId === 0 ? 0 : (1 << missionId) - 1;
  return (bitmap & required) === required;
}

function friendlyError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("PqcKeyNotRegistered")) {
    return "The contract rejected Mission 1: no ML-DSA key is registered for this account — it checked the chain's PQC precompile (0x0A02) itself. Register your post-quantum key in QoreX first (it must be your account's first transaction), then retry.";
  }
  if (msg.includes("PreviousMissionsIncomplete")) {
    return "The contract rejected that: missions are sequential. Finish the earlier missions first.";
  }
  if (msg.includes("MissionAlreadyCompleted")) {
    return "That mission is already recorded on-chain for this account.";
  }
  if (/user rejected|denied/i.test(msg)) {
    return "The transaction was rejected in the wallet — nothing was sent.";
  }
  return msg.length > 260 ? msg.slice(0, 260) + "…" : msg;
}

export default function App() {
  // Demo-mode state (local mirror of the contract rules).
  const [demoBitmap, setDemoBitmap] = useState(0);
  const [demoBadge, setDemoBadge] = useState(false);
  // Live-mode state (always sourced from chain reads).
  const [account, setAccount] = useState<Address | null>(null);
  const [liveBitmap, setLiveBitmap] = useState(0);
  const [liveBadge, setLiveBadge] = useState(false);
  const [pqcKey, setPqcKey] = useState<boolean | null>(null);
  const [playMode, setPlayMode] = useState<"demo" | "live">("demo");
  const [connecting, setConnecting] = useState(false);
  const [pending, setPending] = useState<string | null>(null);
  const [walletMsg, setWalletMsg] = useState<string | null>(null);
  const [phishingFeedback, setPhishingFeedback] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([
    "Q-Day countdown started. Guide the runner through all 5 rescue missions.",
  ]);

  const providerRef = useRef<EIP1193Provider | null>(null);
  const qoreRef = useRef<QoreModule | null>(null);

  const liveConfigured = isLiveConfigured();
  const bitmap = playMode === "live" ? liveBitmap : demoBitmap;
  const badgeClaimed = playMode === "live" ? liveBadge : demoBadge;

  const completed = useMemo(
    () => MISSIONS.filter((m) => (bitmap & (1 << m.id)) !== 0).length,
    [bitmap]
  );
  const score = completed * POINTS_PER_MISSION;
  const allDone = bitmap === FULL_BITMAP;

  function pushLog(entry: string) {
    setLog((prev) => [entry, ...prev].slice(0, 10));
  }

  async function loadQore(): Promise<QoreModule> {
    if (!qoreRef.current) {
      qoreRef.current = await import("./lib/qore");
    }
    return qoreRef.current;
  }

  async function refreshLive(qore: QoreModule, who: Address) {
    const prog = await qore.fetchOnChainProgress(who);
    setLiveBitmap(prog.bitmap);
    setLiveBadge(prog.badge.claimed);
    setPqcKey(prog.hasPqcKey);
    return prog;
  }

  async function connectWallet() {
    setWalletMsg(null);
    setConnecting(true);
    try {
      const qore = await loadQore();
      const { provider, account: who } = await qore.connectInjectedWallet();
      providerRef.current = provider;
      setAccount(who);
      const prog = await refreshLive(qore, who);
      setPlayMode("live");
      pushLog(
        `Wallet connected (${who}). Progress read from chain: bitmap ${prog.bitmap
          .toString(2)
          .padStart(5, "0")}, score ${prog.score}.`
      );
    } catch (err) {
      setWalletMsg(friendlyError(err));
    } finally {
      setConnecting(false);
    }
  }

  function backToDemo() {
    setPlayMode("demo");
    pushLog("Switched back to demo mode (off-chain). Live progress stays on-chain.");
  }

  /** Run one live write: send tx -> wait for receipt -> re-read chain state. */
  async function liveAction(
    label: string,
    send: (qore: QoreModule) => Promise<`0x${string}`>,
    after?: () => void
  ) {
    if (!account || !providerRef.current) return;
    setPending(label);
    setWalletMsg(null);
    try {
      const qore = await loadQore();
      const hash = await send(qore);
      pushLog(`${label}: transaction sent (${hash}). Waiting for confirmation…`);
      const receipt = await qore.waitForTxReceipt(hash);
      if (receipt.status !== "success") {
        throw new Error(`Transaction ${hash} reverted on-chain.`);
      }
      await refreshLive(qore, account);
      pushLog(`${label}: confirmed in block ${receipt.blockNumber}. Progress re-read from the contract.`);
      after?.();
    } catch (err) {
      setWalletMsg(friendlyError(err));
    } finally {
      setPending(null);
    }
  }

  function completeMission(id: number) {
    if (playMode === "live") {
      void liveAction(`Mission ${id + 1}`, (qore) =>
        qore.completeMissionOnChain(providerRef.current!, account!, id)
      );
      return;
    }
    if ((demoBitmap & (1 << id)) !== 0 || !unlocked(demoBitmap, id)) return;
    setDemoBitmap(demoBitmap | (1 << id));
    pushLog(
      `Demo: Mission ${id + 1} complete: ${MISSIONS[id].pqAction}. +100 points (off-chain).`
    );
  }

  function decidePhishing(rejected: boolean) {
    if (playMode === "live") {
      void liveAction(
        rejected ? "Mission 5 — rejection recorded" : "Phishing decision recorded",
        (qore) => qore.reportPhishingOnChain(providerRef.current!, account!, rejected),
        () => {
          setPhishingFeedback(
            rejected
              ? "Correct — and it is now recorded on-chain. You refused to sign what you could not verify."
              : "You approved the drain, and the contract recorded that decision. The mission is NOT complete; read the red flags and reject it."
          );
        }
      );
      return;
    }
    if (!rejected) {
      setPhishingFeedback(
        "You approved the drain. In the real world the vault would now be empty — that is exactly the attack. The mission is NOT complete; read the red flags and reject it."
      );
      pushLog("Demo: phishing decision APPROVED — mission failed (retry allowed), nothing was saved.");
      return;
    }
    if (!unlocked(demoBitmap, PHISHING_MISSION_ID)) {
      setPhishingFeedback(
        "Locked: missions are sequential — complete Missions 1–4 first. The live contract enforces the same order on-chain."
      );
      return;
    }
    setPhishingFeedback(
      "Correct. You refused to sign what you could not verify. The phishing transaction dies here."
    );
    if ((demoBitmap & (1 << PHISHING_MISSION_ID)) === 0) {
      setDemoBitmap(demoBitmap | (1 << PHISHING_MISSION_ID));
      pushLog("Demo: Mission 5 complete: phishing transaction rejected. +100 points (off-chain).");
    }
  }

  function claimBadge() {
    if (playMode === "live") {
      void liveAction("Badge claim", (qore) =>
        qore.claimBadgeOnChain(providerRef.current!, account!)
      );
      return;
    }
    if (!allDone || demoBadge) return;
    setDemoBadge(true);
    pushLog("Demo: badge claimed locally. Connect a wallet to claim the real on-chain badge.");
  }

  function resetDemo() {
    setDemoBitmap(0);
    setDemoBadge(false);
    setPhishingFeedback(null);
    setLog(["Demo run reset. Q-Day countdown started again."]);
  }

  return (
    <div className="page">
      <header className="hero">
        <p className="eyebrow">QoreChain · Quantum Pass · Diana testnet (EVM {DIANA.evmChainId})</p>
        <h1>Q-Day Rescue Run</h1>
        <p className="tagline">
          A quantum computer is coming for classical signatures. Guide the rescue
          runner through the <strong>5 real post-quantum moves</strong> that keep
          funds safe on QoreChain — then claim the Q-Day Survivor badge.
        </p>
        {playMode === "live" ? (
          <p className="mode live">
            LIVE MODE — connected as <code>{account}</code>. Every action below
            sends a real transaction to RescueRun v2 at <code>{RESCUE_RUN_ADDRESS}</code>,
            waits for confirmation, and re-reads your progress from the chain.
          </p>
        ) : (
          <p className="mode demo">
            DEMO MODE — off-chain, no wallet needed. The rules mirror the live
            contract 1:1 (sequential missions, contract-checked Mission 1 in live
            play), but nothing here touches the chain.
            {liveConfigured
              ? " Connect a wallet below to play for real on Diana."
              : " This build has no contract address configured."}
          </p>
        )}
      </header>

      {liveConfigured && (
        <section className="wallet" aria-label="Wallet">
          {account && playMode === "live" ? (
            <div className="wallet-row">
              <span>
                Wallet: <code>{account}</code>
              </span>
              <span>
                PQC key (checked via contract):{" "}
                <strong>{pqcKey === null ? "…" : pqcKey ? "registered ✓" : "NOT registered ✗"}</strong>
              </span>
              <button className="ghost" onClick={backToDemo}>
                Back to demo mode
              </button>
            </div>
          ) : (
            <div className="wallet-row">
              <button onClick={connectWallet} disabled={connecting}>
                {connecting ? "Connecting…" : "Connect Wallet — play on-chain"}
              </button>
              <span className="wallet-note">
                QoreX or any EIP-1193 wallet on Diana (chainId {DIANA.evmChainId}).
              </span>
            </div>
          )}
          {walletMsg && <p className="wallet-error">{walletMsg}</p>}
          {pending && <p className="wallet-pending">⏳ {pending} — waiting for chain confirmation…</p>}
          <details className="window-guide">
            <summary>How to play live: register your key + open an EVM window in QoreX</summary>
            <ol>
              <li>
                <strong>Register your post-quantum key.</strong> In QoreX, register
                your ML-DSA-87 key — on QoreChain this must be your account's{" "}
                <em>first</em> transaction. Mission 1 asks the contract to verify
                it through the chain's PQC precompile; without a registered key
                the contract itself rejects the mission.
              </li>
              <li>
                <strong>Open an EVM window.</strong> EVM transactions on QoreChain
                are only admitted inside an authorisation window. In QoreX, open
                a window with room for at least ~6 transactions (5 missions +
                badge claim) and enough value to cover their gas.
              </li>
              <li>
                <strong>Connect your wallet here</strong> and play: every mission
                button sends a real transaction and your progress is read back
                from the contract after each confirmation.
              </li>
            </ol>
          </details>
        </section>
      )}

      <section className="hud" aria-label="Progress">
        <div className="hud-row">
          <span>
            Missions: <strong>{completed} / 5</strong>
          </span>
          <span>
            Score: <strong>{score} / 500</strong>
          </span>
          <span>
            Bitmap: <code>{bitmap.toString(2).padStart(5, "0")}</code>
          </span>
          <span className="source">
            Source: {playMode === "live" ? "on-chain read from the contract" : "local demo state (off-chain)"}
          </span>
          {playMode === "demo" && (
            <button className="ghost" onClick={resetDemo}>
              Restart demo
            </button>
          )}
        </div>
        <div className="progress" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={5}>
          <div className="progress-fill" style={{ width: `${(completed / 5) * 100}%` }} />
        </div>
      </section>

      <main className="missions">
        {MISSIONS.map((mission) => {
          const done = (bitmap & (1 << mission.id)) !== 0;
          const isPhishing = mission.id === PHISHING_MISSION_ID;
          const isUnlocked = unlocked(bitmap, mission.id);
          const busy = pending !== null;
          return (
            <article key={mission.id} className={done ? "card done" : "card"}>
              <div className="card-head">
                <h2>
                  Mission {mission.id + 1}: {mission.title}
                </h2>
                <span className="points">{done ? "✓ " : ""}+{mission.points} pts</span>
              </div>
              <p className="pq">{mission.pqAction}</p>
              <p>{mission.story}</p>
              <p className="learn">
                <strong>Real-world rule:</strong> {mission.learn}
              </p>
              <p className={`verify verify-${mission.verifyKind}`}>
                {mission.verifyKind === "contract" && "🔒 "}
                {mission.verifyKind === "chain" && "⛓ "}
                {mission.verifyKind === "self" && "✋ "}
                {mission.verifyKind === "decision" && "✍ "}
                <strong>How this is verified:</strong> {mission.verifyLabel}
              </p>

              {!isPhishing && (
                <>
                  <button
                    disabled={done || !isUnlocked || busy}
                    onClick={() => completeMission(mission.id)}
                  >
                    {done
                      ? "Mission complete"
                      : !isUnlocked
                        ? `Locked — finish Mission ${mission.id} first`
                        : playMode === "live"
                          ? "Complete mission (send transaction)"
                          : "Complete mission (demo)"}
                  </button>
                  {!done && !isUnlocked && (
                    <p className="lock-note">
                      Missions are sequential by design — the live contract enforces the same order.
                    </p>
                  )}
                </>
              )}

              {isPhishing && (
                <div className="phishing">
                  <h3>Incoming signature request</h3>
                  <dl>
                    <dt>From</dt>
                    <dd>{PHISHING_TX.from}</dd>
                    <dt>To</dt>
                    <dd>{PHISHING_TX.to}</dd>
                    <dt>Value</dt>
                    <dd>{PHISHING_TX.value}</dd>
                    <dt>Calldata</dt>
                    <dd>{PHISHING_TX.calldata}</dd>
                  </dl>
                  <ul className="warnings">
                    {PHISHING_TX.warnings.map((w) => (
                      <li key={w}>⚠ {w}</li>
                    ))}
                  </ul>
                  <div className="phishing-actions">
                    <button className="danger" onClick={() => decidePhishing(false)} disabled={done || busy}>
                      Approve transaction
                    </button>
                    <button
                      onClick={() => decidePhishing(true)}
                      disabled={done || busy || (playMode === "live" && !isUnlocked)}
                    >
                      {done ? "Phishing rejected ✓" : "Reject transaction"}
                    </button>
                  </div>
                  {!done && !isUnlocked && (
                    <p className="lock-note">
                      Rejecting unlocks after Missions 1–4 — the order is enforced by the contract in live mode.
                    </p>
                  )}
                  {phishingFeedback && <p className="feedback">{phishingFeedback}</p>}
                </div>
              )}
            </article>
          );
        })}
      </main>

      <section className={badgeClaimed ? "badge claimed" : "badge"}>
        <h2>🏅 Q-Day Survivor badge</h2>
        {badgeClaimed ? (
          <p>
            Badge claimed with a perfect score of <strong>{score} / 500</strong>.
            {playMode === "live"
              ? " It is a permanent on-chain record in RescueRun v2 (BadgeClaimed event) — proof the runner finished all five post-quantum moves before Q-Day."
              : " This is the demo badge (off-chain). Connect a wallet and finish the run live to claim the real on-chain badge."}
          </p>
        ) : (
          <>
            <p>
              Finish all 5 missions (bitmap <code>11111</code>) to claim the badge.
              Claiming early reverts on-chain — the contract enforces it, not the UI.
            </p>
            <button disabled={!allDone || pending !== null} onClick={claimBadge}>
              {allDone
                ? playMode === "live"
                  ? "Claim Q-Day Survivor badge (send transaction)"
                  : "Claim Q-Day Survivor badge (demo)"
                : `Claim badge (${completed}/5 missions)`}
            </button>
          </>
        )}
      </section>

      <section className="log" aria-label="Run log">
        <h2>Run log</h2>
        <ul>
          {log.map((entry, i) => (
            <li key={i}>{entry}</li>
          ))}
        </ul>
        <p className="foot">
          Contract: <code>RescueRun.sol</code> v2 (Solidity 0.8.24)
          {liveConfigured && (
            <>
              {" "}· deployed at <code>{RESCUE_RUN_ADDRESS}</code>
            </>
          )}{" "}
          · Network: {DIANA.cosmosChainId} · Explorer: {DIANA.explorer} · In live
          mode, progress, score and badge are enforced by the contract and read
          back from chain; demo mode mirrors the same rules off-chain.
        </p>
      </section>
    </div>
  );
}
