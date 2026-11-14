import { ethers, network } from "hardhat";

/**
 * Proof-of-play interaction run on QoreChain Diana testnet.
 *
 * The deployer plays the game end-to-end as a player:
 *   completeMission(0..3) -> reportPhishingDecision(true) -> claimBadge()
 * and prints every transaction hash plus the final on-chain state
 * (progressOf bitmap, hasBadge, badgeOf, scoreOf). These hashes are the
 * on-chain evidence recorded in deployments.testnet.json and the README
 * proof table.
 *
 * Preconditions: PRIVATE_KEY in .env (throwaway, PQC-registered account),
 * an open EVM authorisation window with enough tx/value budget, and
 * RESCUE_RUN_ADDRESS set (or pass the deployed address in deployments).
 *
 * Run:  npm run interact:testnet
 */
async function main() {
  const address =
    process.env.RESCUE_RUN_ADDRESS ?? "0xE589EC857101bf2ecD874EdCC80ddF2F63feE59A";
  const [player] = await ethers.getSigners();
  if (!player) {
    throw new Error("No signer. Set PRIVATE_KEY in .env (throwaway testnet account only).");
  }

  console.log(`Network:  ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Player:   ${player.address}`);
  console.log(`Contract: ${address}`);

  const run = await ethers.getContractAt("RescueRun", address, player);

  const hashes: Record<string, string> = {};

  for (const missionId of [0, 1, 2, 3]) {
    const tx = await run.completeMission(missionId);
    const receipt = await tx.wait();
    hashes[`completeMission(${missionId})`] = tx.hash;
    console.log(
      `completeMission(${missionId}): ${tx.hash} (block ${receipt?.blockNumber}, status ${receipt?.status})`
    );
  }

  const phishingTx = await run.reportPhishingDecision(true);
  const phishingReceipt = await phishingTx.wait();
  hashes["reportPhishingDecision(true)"] = phishingTx.hash;
  console.log(
    `reportPhishingDecision(true): ${phishingTx.hash} (block ${phishingReceipt?.blockNumber}, status ${phishingReceipt?.status})`
  );

  const badgeTx = await run.claimBadge();
  const badgeReceipt = await badgeTx.wait();
  hashes["claimBadge()"] = badgeTx.hash;
  console.log(
    `claimBadge(): ${badgeTx.hash} (block ${badgeReceipt?.blockNumber}, status ${badgeReceipt?.status})`
  );

  const bitmap: bigint = await run.progressOf(player.address);
  const completed: bigint = await run.missionsCompleted(player.address);
  const score: bigint = await run.scoreOf(player.address);
  const hasBadge: boolean = await run.hasBadge(player.address);
  const badge = await run.badgeOf(player.address);

  console.log("\n--- Final on-chain state ---");
  console.log(`progressOf:        ${bitmap} (0b${bitmap.toString(2).padStart(5, "0")})`);
  console.log(`missionsCompleted: ${completed}`);
  console.log(`scoreOf:           ${score}`);
  console.log(`hasBadge:          ${hasBadge}`);
  console.log(
    `badgeOf:           claimed=${badge.claimed} claimedAt=${badge.claimedAt} score=${badge.score}`
  );
  console.log(`\nTX_HASHES_JSON ${JSON.stringify(hashes)}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
