import { expect } from "chai";
import { ethers } from "hardhat";
import type { RescueRun } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const FULL = 0x1f; // 0b11111

async function completeFirstFour(run: RescueRun, player: HardhatEthersSigner) {
  for (const id of [0, 1, 2, 3]) {
    await run.connect(player).completeMission(id);
  }
}

async function completeAll(run: RescueRun, player: HardhatEthersSigner) {
  await completeFirstFour(run, player);
  await run.connect(player).reportPhishingDecision(true);
}

describe("RescueRun (Q-Day Rescue Run)", function () {
  let run: RescueRun;
  let alice: HardhatEthersSigner;
  let bob: HardhatEthersSigner;

  beforeEach(async function () {
    [, alice, bob] = await ethers.getSigners();
    const factory = await ethers.getContractFactory("RescueRun");
    run = await factory.deploy();
    await run.waitForDeployment();
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

  it("completeMission sets the mission bit and emits MissionCompleted", async function () {
    await expect(run.connect(alice).completeMission(0))
      .to.emit(run, "MissionCompleted")
      .withArgs(alice.address, 0, 0b00001, 100);
    expect(await run.progressOf(alice.address)).to.equal(0b00001);
    expect(await run.isMissionDone(alice.address, 0)).to.equal(true);
    expect(await run.isMissionDone(alice.address, 1)).to.equal(false);
  });

  it("missions can be completed out of order", async function () {
    await run.connect(alice).completeMission(2);
    await run.connect(alice).completeMission(0);
    expect(await run.progressOf(alice.address)).to.equal(0b00101);
    expect(await run.missionsCompleted(alice.address)).to.equal(2);
    expect(await run.scoreOf(alice.address)).to.equal(200);
  });

  it("NEGATIVE: completing the same mission twice reverts", async function () {
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

  it("reportPhishingDecision(true) completes mission 4 and emits both events", async function () {
    await expect(run.connect(alice).reportPhishingDecision(true))
      .to.emit(run, "MissionCompleted")
      .withArgs(alice.address, 4, 0b10000, 100);
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
    await run.connect(alice).reportPhishingDecision(true);
    expect(await run.isMissionDone(alice.address, 4)).to.equal(true);
    expect(await run.scoreOf(alice.address)).to.equal(100);
  });

  it("NEGATIVE: rejecting phishing twice reverts the second time", async function () {
    await run.connect(alice).reportPhishingDecision(true);
    await expect(run.connect(alice).reportPhishingDecision(true))
      .to.be.revertedWithCustomError(run, "MissionAlreadyCompleted")
      .withArgs(alice.address, 4);
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
    await run.connect(bob).reportPhishingDecision(true);
    expect(await run.totalPlayers()).to.equal(2);
  });

});
