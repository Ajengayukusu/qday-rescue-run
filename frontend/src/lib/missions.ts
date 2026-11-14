export interface Mission {
  id: number;
  title: string;
  pqAction: string;
  story: string;
  learn: string;
  points: number;
}

export const PHISHING_MISSION_ID = 4;
export const FULL_BITMAP = 0x1f;
export const POINTS_PER_MISSION = 100;

/**
 * The 5 missions of Q-Day Rescue Run. Each one is a real post-quantum
 * action on QoreChain, in the exact order a user performs them when
 * migrating an account before Q-Day.
 */
export const MISSIONS: Mission[] = [
  {
    id: 0,
    title: "Register your post-quantum key",
    pqAction: "Register ML-DSA-87 key (MsgRegisterPQCKeyV2 + proof of possession)",
    story:
      "Q-Day is coming: a quantum computer will be able to forge classical ECDSA signatures. Your guide, a rescue runner, reaches the key forge first — without a post-quantum key, nothing else can protect the vault.",
    learn:
      "On QoreChain the ML-DSA-87 key registration must be the account's FIRST transaction. It is derived from your mnemonic (never invent a random one) and registered with a proof of possession.",
    points: POINTS_PER_MISSION,
  },
  {
    id: 1,
    title: "Open a scoped EVM window",
    pqAction: "Open scoped EVM authorisation window (blocks / maxTxs / maxValue / targets)",
    story:
      "The EVM bridge only opens for accounts that hold a registered post-quantum key — and only as wide as you allow. Open the smallest window that lets the rescue convoy through.",
    learn:
      "EVM transactions on QoreChain are admitted only inside an authorisation window: limited blocks, limited tx count, limited total value. A leaked classical key can only ever move what the window allows.",
    points: POINTS_PER_MISSION,
  },
  {
    id: 2,
    title: "Send a hybrid transfer",
    pqAction: "Hybrid transfer (secp256k1 + ML-DSA-87, event pqc_hybrid_verify)",
    story:
      "Move the rescue funds across the bridge. The transfer is signed twice — once with the classical key, once with the post-quantum key — and the chain verifies both before it counts.",
    learn:
      "A hybrid transaction carries a PQCHybridSignature extension. Judges and users verify it on the REST API: code 0 plus the event `pqc_hybrid_verify` with status `verified`.",
    points: POINTS_PER_MISSION,
  },
  {
    id: 3,
    title: "Register an encryption key",
    pqAction: "Register ML-KEM-1024 key (KEM registry, algorithmId 2)",
    story:
      "The rescue plans must stay secret for decades — long enough for 'harvest now, decrypt later' attackers to get their quantum machines. Seal them with a key only post-quantum encryption can open.",
    learn:
      "ML-KEM-1024 keys are registered in the on-chain KEM registry (exactly 1568 bytes). Apps such as QoreSeal then encrypt payloads client-side so only the registered recipient can open them.",
    points: POINTS_PER_MISSION,
  },
  {
    id: 4,
    title: "Reject the phishing transaction",
    pqAction: "Reject a malicious transaction (your decision is the security control)",
    story:
      "A message arrives: 'URGENT — Q-Day migration! Approve this transfer to save your funds.' It asks you to approve a drain to an unknown address. The vault survives only if you refuse.",
    learn:
      "Post-quantum keys do not help if you sign the attack yourself. The final rescue skill is reading what you sign — and rejecting what would drain you. Approving this one fails the mission (you can retry).",
    points: POINTS_PER_MISSION,
  },
];

/** The malicious transaction shown in mission 5. Every field is a red flag. */
export const PHISHING_TX = {
  from: "0x6E2198c7198Ce3B718DFCf38103120C8346fD28A (you)",
  to: "0x00000000000000000000000000000000DEADc0DE (unverified 'migration helper')",
  value: "ALL of your QOR (unlimited approval + full balance transfer)",
  calldata: "approveAndDrain(address,uint256) — not a standard migration function",
  warnings: [
    "The sender reached you by DM, not through the official site",
    "It asks for an UNLIMITED approval, not a scoped window",
    "No ML-DSA-87 co-signature is shown anywhere",
    "Urgency ('act in 10 minutes') is a pressure trick, not a protocol rule",
  ],
};
