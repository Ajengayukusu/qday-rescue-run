import { expect } from "chai";
import { ethers, artifacts } from "hardhat";
import type { RescueRun, MockPqcKeyStatus } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const FULL = 0x1f; // 0b11111
const PRECOMPILE = "0x0000000000000000000000000000000000000A02";
const DUMMY_PUBKEY = "0x" + "ab".repeat(32); // mock does not validate length

/**
 * v2 rules under test:
 *  - Mission 0 is CONTRACT-VERIFIED: the contract calls the pqcKeyStatus
 *    precompile (0x0A02) and reverts with PqcKeyNotRegistered when the
 *    player has no ML-DSA key. Locally, MockPqcKeyStatus bytecode is copied
 *    to the real precompile address via hardhat_setCode.
 *  - Missions are SEQUENTIAL: mission n requires missions 0..n-1.
 *  - Missions 2 and 3 are SELF-REPORTED (native-lane actions the EVM cannot
 *    observe) and emit MissionSelfReported instead of MissionCompleted.
 */
async function installMockPrecompile(): Promise<MockPqcKeyStatus> {
  const artifact = await artifacts.readArtifact("MockPqcKeyStatus");
  await ethers.provider.send("hardhat_setCode", [
    PRECOMPILE,
    artifact.deployedBytecode,
  ]);
  return (await ethers.getContractAt(
    "MockPqcKeyStatus",
    PRECOMPILE
  )) as unknown as MockPqcKeyStatus;
}

async function completeFirstFour(run: RescueRun, player: HardhatEthersSigner) {
  for (const id of [0, 1, 2, 3]) {
    await run.connect(player).completeMission(id);
  }
}

async function completeAll(run: RescueRun, player: HardhatEthersSigner) {
  await completeFirstFour(run, player);
  await run.connect(player).reportPhishingDecision(true);
}

describe("RescueRun v2 (Q-Day Rescue Run)", function () {
  let run: RescueRun;
  let pqc: MockPqcKeyStatus;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;
  let carol: HardhatEthersSigner; // never gets a PQC key in the mock registry

  beforeEach(async function () {
    [, alice, bob, carol] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RescueRun");
    run = await factory.deploy();
    await run.waitForDeployment();

    pqc = await installMockPrecompile();
    // Alice and Bob hold registered ML-DSA keys (as on Diana); Carol does not.
    await pqc.registerKey(alice.address, DUMMY_PUBKEY);
    await pqc.registerKey(bob.address, DUMMY_PUBKEY);
    await pqc.removeKey(carol.address);
  });

  it("starts with zero progress, zero score and no badge", async function () {
    expect(await run.progressOf(alice.address)).to.equal(0);
    expect(await run.missionsCompleted(alice.address)).to.equal(0);
    expect(await run.scoreOf(alice.address)).to.equal(0);
    expect(await run.hasBadge(alice.address)).to.equal(false);
    const badge = await run.badgeOf(alice.address);
    expect(badge.claimed).to.equal(false);
    expect(badge.claimedAt).to.equal(0n);
    expect(badge.score).to.equal(0n);
  });

  it("hasPqcKey reads the precompile registry for the player", async function () {
    expect(await run.hasPqcKey(alice.address)).to.equal(true);
    expect(await run.hasPqcKey(carol.address)).to.equal(false);
  });

  it("completeMission(0) with a registered PQC key sets the bit and emits MissionCompleted", async function () {
    await expect(run.connect(alice).completeMission(0))
      .to.emit(run, "MissionCompleted")
      .withArgs(alice.address, 0, 0b00001, 100);
    expect(await run.progressOf(alice.address)).to.equal(0b00001);
    expect(await run.isMissionDone(alice.address, 0)).to.equal(true);
    expect(await run.isMissionDone(alice.address, 1)).to.equal(false);
  });

  it("NEGATIVE: mission 0 without a registered PQC key reverts PqcKeyNotRegistered", async function () {
    await expect(run.connect(carol).completeMission(0))
      .to.be.revertedWithCustomError(run, "PqcKeyNotRegistered")
      .withArgs(carol.address);
    expect(await run.progressOf(carol.address)).to.equal(0);
    expect(await run.scoreOf(carol.address)).to.equal(0);
  });

  it("NEGATIVE: mission 0 reverts once the key record is removed, and passes after re-registering", async function () {
    await pqc.removeKey(alice.address);
    await expect(run.connect(alice).completeMission(0))
      .to.be.revertedWithCustomError(run, "PqcKeyNotRegistered")
      .withArgs(alice.address);
    await pqc.registerKey(alice.address, DUMMY_PUBKEY);
    await run.connect(alice).completeMission(0);
    expect(await run.isMissionDone(alice.address, 0)).to.equal(true);
  });

  it("missions complete in sequence and accumulate bitmap and score", async function () {
    await run.connect(alice).completeMission(0);
    await run.connect(alice).completeMission(1);
    await run.connect(alice).completeMission(2);
    expect(await run.progressOf(alice.address)).to.equal(0b00111);
    await run.connect(alice).completeMission(3);
    expect(await run.progressOf(alice.address)).to.equal(0b01111);
    expect(await run.missionsCompleted(alice.address)).to.equal(4);
    expect(await run.scoreOf(alice.address)).to.equal(400);
  });

  it("NEGATIVE: mission 1 as the very first action reverts PreviousMissionsIncomplete", async function () {
    await expect(run.connect(alice).completeMission(1))
      .to.be.revertedWithCustomError(run, "PreviousMissionsIncomplete")
      .withArgs(alice.address, 1, 0);
    expect(await run.progressOf(alice.address)).to.equal(0);
  });

  it("NEGATIVE: mission 3 after only missions 0-1 reverts PreviousMissionsIncomplete", async function () {
    await run.connect(alice).completeMission(0);
    await run.connect(alice).completeMission(1);
    await expect(run.connect(alice).completeMission(3))
      .to.be.revertedWithCustomError(run, "PreviousMissionsIncomplete")
      .withArgs(alice.address, 3, 0b00011);
  });

  it("NEGATIVE: completing the same mission twice reverts", async function () {
    await run.connect(alice).completeMission(0);
    await run.connect(alice).completeMission(1);
    await expect(run.connect(alice).completeMission(1))
      .to.be.revertedWithCustomError(run, "MissionAlreadyCompleted")
      .withArgs(alice.address, 1);
  });

  it("NEGATIVE: mission id 5 (out of range) reverts", async function () {
    await expect(run.connect(alice).completeMission(5))
      .to.be.revertedWithCustomError(run, "InvalidMission")
      .withArgs(5);
  });

  it("NEGATIVE: mission id 255 (max uint8) reverts", async function () {
    await expect(run.connect(alice).completeMission(255))
      .to.be.revertedWithCustomError(run, "InvalidMission")
      .withArgs(255);
  });

  it("NEGATIVE: isMissionDone with invalid id reverts", async function () {
    await expect(run.isMissionDone(alice.address, 9))
      .to.be.revertedWithCustomError(run, "InvalidMission")
      .withArgs(9);
  });

  it("NEGATIVE: phishing mission 4 cannot be completed via completeMission", async function () {
    await expect(
      run.connect(alice).completeMission(4)
    ).to.be.revertedWithCustomError(run, "PhishingMissionRequiresReport");
    expect(await run.progressOf(alice.address)).to.equal(0);
  });

  it("missions 2 and 3 emit MissionSelfReported, not MissionCompleted", async function () {
    await run.connect(alice).completeMission(0);
    await run.connect(alice).completeMission(1);
    const tx2 = await run.connect(alice).completeMission(2);
    await expect(tx2)
      .to.emit(run, "MissionSelfReported")
      .withArgs(alice.address, 2, 0b00111, 300);
    await expect(tx2).to.not.emit(run, "MissionCompleted");
    const tx3 = await run.connect(alice).completeMission(3);
    await expect(tx3)
      .to.emit(run, "MissionSelfReported")
      .withArgs(alice.address, 3, 0b01111, 400);
    await expect(tx3).to.not.emit(run, "MissionCompleted");
  });

  it("reportPhishingDecision(true) after missions 0-3 completes mission 4 and emits both events", async function () {
    await completeFirstFour(run, alice);
    await expect(run.connect(alice).reportPhishingDecision(true))
      .to.emit(run, "MissionCompleted")
      .withArgs(alice.address, 4, 0b11111, 500);
    await completeFirstFour(run, bob);
    await expect(run.connect(bob).reportPhishingDecision(true))
      .to.emit(run, "PhishingReported")
      .withArgs(bob.address, true, true);
    expect(await run.isMissionDone(alice.address, 4)).to.equal(true);
  });

  it("NEGATIVE (by design): APPROVING the phishing tx completes nothing", async function () {
    await expect(run.connect(alice).reportPhishingDecision(false))
      .to.emit(run, "PhishingReported")
      .withArgs(alice.address, false, false);
    expect(await run.progressOf(alice.address)).to.equal(0);
    expect(await run.isMissionDone(alice.address, 4)).to.equal(false);
    expect(await run.scoreOf(alice.address)).to.equal(0);
  });

  it("a player who approved phishing can retry and reject it later", async function () {
    await run.connect(alice).reportPhishingDecision(false);
    await completeFirstFour(run, alice);
    await run.connect(alice).reportPhishingDecision(true);
    expect(await run.isMissionDone(alice.address, 4)).to.equal(true);
    expect(await run.scoreOf(alice.address)).to.equal(500);
  });

  it("NEGATIVE: rejecting phishing twice reverts the second time", async function () {
    await completeAll(run, alice);
    await expect(run.connect(alice).reportPhishingDecision(true))
      .to.be.revertedWithCustomError(run, "MissionAlreadyCompleted")
      .withArgs(alice.address, 4);
  });

  it("NEGATIVE: rejecting phishing before missions 0-3 reverts PreviousMissionsIncomplete", async function () {
    await run.connect(alice).completeMission(0);
    await expect(run.connect(alice).reportPhishingDecision(true))
      .to.be.revertedWithCustomError(run, "PreviousMissionsIncomplete")
      .withArgs(alice.address, 4, 0b00001);
    expect(await run.progressOf(alice.address)).to.equal(0b00001);
  });

  it("NEGATIVE: claimBadge with zero missions reverts", async function () {
    await expect(run.connect(alice).claimBadge())
      .to.be.revertedWithCustomError(run, "MissionsIncomplete")
      .withArgs(alice.address, 0);
  });

  it("NEGATIVE: claimBadge with only 4 of 5 missions reverts", async function () {
    await completeFirstFour(run, alice);
    await expect(run.connect(alice).claimBadge())
      .to.be.revertedWithCustomError(run, "MissionsIncomplete")
      .withArgs(alice.address, 0b01111);
    expect(await run.hasBadge(alice.address)).to.equal(false);
  });

  it("claimBadge after all 5 missions stores the badge record and emits BadgeClaimed", async function () {
    await completeAll(run, alice);
    expect(await run.progressOf(alice.address)).to.equal(FULL);
    expect(await run.scoreOf(alice.address)).to.equal(500);

    await expect(run.connect(alice).claimBadge()).to.emit(
      run,
      "BadgeClaimed"
    );

    const badge = await run.badgeOf(alice.address);
    expect(badge.claimed).to.equal(true);
    expect(badge.score).to.equal(500n);
    expect(badge.claimedAt).to.be.greaterThan(0n);
    expect(await run.hasBadge(alice.address)).to.equal(true);
    expect(await run.totalBadges()).to.equal(1);
  });

  it("NEGATIVE: claiming the badge twice reverts", async function () {
    await completeAll(run, alice);
    await run.connect(alice).claimBadge();
    await expect(
      run.connect(alice).claimBadge()
    ).to.be.revertedWithCustomError(run, "BadgeAlreadyClaimed");
  });

  it("two players have fully independent progress and badges", async function () {
    await completeAll(run, alice);
    await run.connect(alice).claimBadge();

    await run.connect(bob).completeMission(0);
    expect(await run.progressOf(bob.address)).to.equal(0b00001);
    expect(await run.progressOf(alice.address)).to.equal(FULL);
    expect(await run.hasBadge(bob.address)).to.equal(false);
    await expect(
      run.connect(bob).claimBadge()
    ).to.be.revertedWithCustomError(run, "MissionsIncomplete");
  });

  it("totalPlayers counts each player once, on their first mission", async function () {
    expect(await run.totalPlayers()).to.equal(0);
    await run.connect(alice).completeMission(0);
    await run.connect(alice).completeMission(1);
    expect(await run.totalPlayers()).to.equal(1);
    await run.connect(bob).completeMission(0);
    expect(await run.totalPlayers()).to.equal(2);
  });
});
