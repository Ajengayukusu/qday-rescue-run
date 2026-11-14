import { useMemo, useState } from "react";
import {
  FULL_BITMAP,
  MISSIONS,
  PHISHING_MISSION_ID,
  PHISHING_TX,
  POINTS_PER_MISSION,
} from "./lib/missions";
import { DIANA, isLiveMode } from "./lib/qore";

/**
 * Q-Day Rescue Run — demo mode.
 *
 * Local state mirrors RescueRun.sol exactly:
 *  - progress is a 5-bit bitmap; each mission completes once;
 *  - mission 4 completes ONLY by rejecting the phishing tx;
 *  - score = 100 x completed missions;
 *  - the badge can be claimed only when bitmap == 0b11111, exactly once.
 * In live mode (VITE_RESCUE_RUN_ADDRESS set) the same actions are sent to
 * the deployed contract through src/lib/qore.ts.
 */
export default function App() {
  const [bitmap, setBitmap] = useState(0);
  const [badgeClaimed, setBadgeClaimed] = useState(false);
  const [phishingFeedback, setPhishingFeedback] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([
    "Q-Day countdown started. Guide the runner through all 5 rescue missions.",
  ]);

  const completed = useMemo(
    () => MISSIONS.filter((m) => (bitmap & (1 << m.id)) !== 0).length,
    [bitmap]
  );
  const score = completed * POINTS_PER_MISSION;
  const allDone = bitmap === FULL_BITMAP;
  const live = isLiveMode();

  function pushLog(entry: string) {
    setLog((prev) => [entry, ...prev].slice(0, 8));
  }

  function completeMission(id: number) {
    if ((bitmap & (1 << id)) !== 0) return;
    setBitmap(bitmap | (1 << id));
    pushLog(`Mission ${id + 1} complete: ${MISSIONS[id].pqAction}. +100 points.`);
  }

  function decidePhishing(rejected: boolean) {
    if (!rejected) {
      setPhishingFeedback(
        "You approved the drain. In the real world the vault would now be empty — that is exactly the attack. The mission is NOT complete; read the red flags and reject it."
      );
      pushLog("Phishing decision: APPROVED — mission failed (retry allowed), nothing was saved.");
      return;
    }
    setPhishingFeedback(
      "Correct. You refused to sign what you could not verify. The phishing transaction dies here."
    );
    if ((bitmap & (1 << PHISHING_MISSION_ID)) === 0) {
      setBitmap(bitmap | (1 << PHISHING_MISSION_ID));
      pushLog("Mission 5 complete: phishing transaction rejected. +100 points.");
    }
  }

  function claimBadge() {
    if (!allDone || badgeClaimed) return;
    setBadgeClaimed(true);
    pushLog("Badge claimed: Q-Day Survivor (on-chain record in live mode).");
  }

  function reset() {
    setBitmap(0);
    setBadgeClaimed(false);
    setPhishingFeedback(null);
    setLog(["Run reset. Q-Day countdown started again."]);
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
        <p className={live ? "mode live" : "mode demo"}>
          {live
            ? "LIVE MODE — progress is read from and written to the deployed RescueRun contract."
            : "DEMO MODE — fully playable locally; the rules mirror RescueRun.sol 1:1. Deploy and set VITE_RESCUE_RUN_ADDRESS to play on-chain."}
        </p>
      </header>

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
          <button className="ghost" onClick={reset}>
            Restart run
          </button>
        </div>
        <div className="progress" role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={5}>
          <div className="progress-fill" style={{ width: `${(completed / 5) * 100}%` }} />
        </div>
      </section>

      <main className="missions">
        {MISSIONS.map((mission) => {
          const done = (bitmap & (1 << mission.id)) !== 0;
          const isPhishing = mission.id === PHISHING_MISSION_ID;
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

              {!isPhishing && (
                <button disabled={done} onClick={() => completeMission(mission.id)}>
                  {done ? "Mission complete" : "Complete mission"}
                </button>
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
                    <button className="danger" onClick={() => decidePhishing(false)} disabled={done}>
                      Approve transaction
                    </button>
                    <button onClick={() => decidePhishing(true)} disabled={done}>
                      {done ? "Phishing rejected ✓" : "Reject transaction"}
                    </button>
                  </div>
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
            Badge claimed with a perfect score of <strong>{score} / 500</strong>. In
            live mode this is a permanent on-chain record in RescueRun
            (<code>BadgeClaimed</code> event) — proof the runner finished all five
            post-quantum moves before Q-Day.
          </p>
        ) : (
          <>
            <p>
              Finish all 5 missions (bitmap <code>11111</code>) to claim the badge.
              Claiming early reverts on-chain — the contract enforces it, not the UI.
            </p>
            <button disabled={!allDone} onClick={claimBadge}>
              {allDone ? "Claim Q-Day Survivor badge" : `Claim badge (${completed}/5 missions)`}
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
          Contract: <code>RescueRun.sol</code> (Solidity 0.8.24) · Network: {DIANA.cosmosChainId} ·
          Explorer: {DIANA.explorer} · Progress, score and badge are enforced by the contract,
          this UI only reflects them.
        </p>
      </section>
    </div>
  );
}
