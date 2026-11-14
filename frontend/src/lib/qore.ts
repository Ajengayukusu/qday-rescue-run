/**
 * QoreChain integration layer for Q-Day Rescue Run.
 *
 * Two modes:
 *  - DEMO (default): no contract address configured. The UI runs entirely on
 *    local state that mirrors RescueRun.sol's bitmap/score/badge rules.
 *  - LIVE: set VITE_RESCUE_RUN_ADDRESS to the deployed RescueRun address on
 *    Diana and this layer reads real progress from the chain and (with an
 *    injected EIP-1193 wallet) writes mission completions to the contract.
 *
 * Stack: @qorechain/sdk 0.14.0 (network presets + native PQC status over REST)
 *        @qorechain/evm 0.14.0 (viem chain definition + PQC precompile helper)
 *        viem (public/wallet clients)
 *
 * Bootstrap order on QoreChain (enforced by the chain, taught by the game):
 *   faucet -> register ML-DSA-87 key (FIRST tx) -> open EVM window -> transact.
 */
import {
  createPublicClient,
  createWalletClient,
  custom,
  http,
  type Address,
  type EIP1193Provider,
  type PublicClient,
  type WalletClient,
} from "viem";
import { pqcKeyStatus, qorechainTestnet } from "@qorechain/evm";
import { NETWORKS, fetchPqcStatus, type PqcStatus } from "@qorechain/sdk";

export const DIANA = {
  cosmosChainId: NETWORKS.testnet.chainId, // "qorechain-diana"
  evmChainId: NETWORKS.testnet.evmChainId ?? 9800,
  rest: NETWORKS.testnet.endpoints.rest, // https://api-testnet.qore.host
  evmRpc: NETWORKS.testnet.endpoints.evmRpc, // https://evm-testnet.qore.host
  explorer: "https://explore.qore.network",
} as const;

/** Minimal ABI of RescueRun.sol used by the frontend. */
export const RESCUE_RUN_ABI = [
  {
    type: "function",
    name: "completeMission",
    stateMutability: "nonpayable",
    inputs: [{ name: "missionId", type: "uint8" }],
    outputs: [],
  },
  {
    type: "function",
    name: "reportPhishingDecision",
    stateMutability: "nonpayable",
    inputs: [{ name: "rejected", type: "bool" }],
    outputs: [],
  },
  {
    type: "function",
    name: "claimBadge",
    stateMutability: "nonpayable",
    inputs: [],
    outputs: [],
  },
  {
    type: "function",
    name: "progressOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "missionsCompleted",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint8" }],
  },
  {
    type: "function",
    name: "scoreOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "badgeOf",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [
      { name: "claimed", type: "bool" },
      { name: "claimedAt", type: "uint64" },
      { name: "score", type: "uint256" },
    ],
  },
  {
    type: "event",
    name: "MissionCompleted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "missionId", type: "uint8", indexed: true },
      { name: "progressBitmap", type: "uint8", indexed: false },
      { name: "score", type: "uint256", indexed: false },
    ],
  },
  {
    type: "event",
    name: "BadgeClaimed",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "score", type: "uint256", indexed: false },
      { name: "claimedAt", type: "uint64", indexed: false },
    ],
  },
] as const;

export const RESCUE_RUN_ADDRESS = (
  import.meta.env.VITE_RESCUE_RUN_ADDRESS ?? ""
) as Address | "";

export function isLiveMode(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(RESCUE_RUN_ADDRESS);
}

export function getPublicClient(): PublicClient {
  return createPublicClient({
    chain: qorechainTestnet, // EVM chainId 9800, RPC https://evm-testnet.qore.host
    transport: http(DIANA.evmRpc),
  });
}

export interface OnChainProgress {
  bitmap: number;
  missionsCompleted: number;
  score: number;
  badge: { claimed: boolean; claimedAt: bigint; score: bigint };
}

/** Read a player's real progress + badge from the deployed contract. */
export async function fetchOnChainProgress(
  player: Address
): Promise<OnChainProgress> {
  if (!isLiveMode()) {
    throw new Error("Live mode is off: set VITE_RESCUE_RUN_ADDRESS first.");
  }
  const client = getPublicClient();
  const address = RESCUE_RUN_ADDRESS as Address;
  const [bitmap, completed, score, badge] = await Promise.all([
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "progressOf", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "missionsCompleted", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "scoreOf", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "badgeOf", args: [player] }),
  ]);
  return {
    bitmap: Number(bitmap),
    missionsCompleted: Number(completed),
    score: Number(score),
    badge: { claimed: badge[0], claimedAt: badge[1], score: badge[2] },
  };
}

function getWalletClient(provider: EIP1193Provider, account: Address): WalletClient {
  return createWalletClient({
    account,
    chain: qorechainTestnet,
    transport: custom(provider),
  });
}

/**
 * Write one mission completion to the contract through the player's injected
 * wallet (e.g. MetaMask inside an open EVM window; QoreX signs the native /
 * hybrid side). The phishing mission must use reportPhishingOnChain().
 */
export async function completeMissionOnChain(
  provider: EIP1193Provider,
  account: Address,
  missionId: number
): Promise<string> {
  const wallet = getWalletClient(provider, account);
  return wallet.writeContract({
    address: RESCUE_RUN_ADDRESS as Address,
    abi: RESCUE_RUN_ABI,
    functionName: "completeMission",
    args: [missionId],
    account,
    chain: qorechainTestnet,
  });
}

/** Record the phishing decision on-chain. Only `rejected=true` completes mission 4. */
export async function reportPhishingOnChain(
  provider: EIP1193Provider,
  account: Address,
  rejected: boolean
): Promise<string> {
  const wallet = getWalletClient(provider, account);
  return wallet.writeContract({
    address: RESCUE_RUN_ADDRESS as Address,
    abi: RESCUE_RUN_ABI,
    functionName: "reportPhishingDecision",
    args: [rejected],
    account,
    chain: qorechainTestnet,
  });
}

/** Claim the Q-Day Survivor badge on-chain once the bitmap is 0b11111. */
export async function claimBadgeOnChain(
  provider: EIP1193Provider,
  account: Address
): Promise<string> {
  const wallet = getWalletClient(provider, account);
  return wallet.writeContract({
    address: RESCUE_RUN_ADDRESS as Address,
    abi: RESCUE_RUN_ABI,
    functionName: "claimBadge",
    args: [],
    account,
    chain: qorechainTestnet,
  });
}

/**
 * Native-lane PQC status for a qor1... address via @qorechain/sdk over REST.
 * This is how the game verifies mission 1 ("key registered + possession
 * proven") against the real chain instead of trusting the UI.
 */
export async function fetchNativePqcStatus(qorAddress: string): Promise<PqcStatus> {
  return fetchPqcStatus({ rest: DIANA.rest, address: qorAddress });
}

/** EVM-lane PQC status via the 0x0A02 precompile helper from @qorechain/evm. */
export async function fetchEvmPqcStatus(account: Address) {
  const client = getPublicClient();
  return pqcKeyStatus(client, account);
}
