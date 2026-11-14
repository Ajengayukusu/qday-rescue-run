/**
 * QoreChain integration layer for Q-Day Rescue Run — LIVE mode.
 *
 * This module is loaded with a DYNAMIC import (see App.tsx) so the demo
 * mode and app shell never pay for the viem + QoreChain SDK bundle until a
 * player actually connects a wallet.
 *
 * Live flow:
 *  - connectInjectedWallet(): eth_requestAccounts + ensure Diana (9800).
 *  - fetchOnChainProgress(): progress is READ from the deployed contract —
 *    the chain, not local state, is the source of truth in live mode.
 *  - completeMissionOnChain() / reportPhishingOnChain() / claimBadgeOnChain():
 *    every click writes a real transaction through the player's injected
 *    EIP-1193 wallet; callers wait for the receipt, then re-read progress.
 *
 * Stack: @qorechain/sdk 0.14.0 (network presets + native PQC status over REST)
 *        @qorechain/evm 0.14.0 (viem chain definition + PQC precompile helper)
 *        viem (public/wallet clients)
 *
 * Bootstrap order on QoreChain (enforced by the chain, taught by the game):
 *   faucet -> register ML-DSA-87 key (FIRST tx) -> open EVM window -> transact.
 * RescueRun v2 enforces part of this itself: completeMission(0) calls the
 * pqcKeyStatus precompile (0x0A02) and reverts if the player has no key.
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
import { DIANA, RESCUE_RUN_ADDRESS, isLiveConfigured } from "./config";

export { DIANA, RESCUE_RUN_ADDRESS };
export type { PqcStatus };

/** Backwards-compatible name used by earlier builds. */
export function isLiveMode(): boolean {
  return isLiveConfigured();
}

/** Minimal ABI of RescueRun.sol (v2) used by the frontend. */
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
    name: "hasPqcKey",
    stateMutability: "view",
    inputs: [{ name: "player", type: "address" }],
    outputs: [{ name: "", type: "bool" }],
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
    name: "MissionSelfReported",
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
  hasPqcKey: boolean;
  badge: { claimed: boolean; claimedAt: bigint; score: bigint };
}

/** Read a player's real progress + badge from the deployed contract. */
export async function fetchOnChainProgress(
  player: Address
): Promise<OnChainProgress> {
  if (!isLiveMode()) {
    throw new Error("Live mode is off: this build has no contract address.");
  }
  const client = getPublicClient();
  const address = RESCUE_RUN_ADDRESS as Address;
  const [bitmap, completed, score, badge, pqc] = await Promise.all([
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "progressOf", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "missionsCompleted", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "scoreOf", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "badgeOf", args: [player] }),
    client.readContract({ address, abi: RESCUE_RUN_ABI, functionName: "hasPqcKey", args: [player] }),
  ]);
  return {
    bitmap: Number(bitmap),
    missionsCompleted: Number(completed),
    score: Number(score),
    hasPqcKey: Boolean(pqc),
    badge: { claimed: badge[0], claimedAt: badge[1], score: badge[2] },
  };
}

/** Wait until a submitted transaction is confirmed on Diana. */
export async function waitForTxReceipt(hash: `0x${string}`) {
  const client = getPublicClient();
  return client.waitForTransactionReceipt({ hash, confirmations: 1 });
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
 * wallet (inside the player's open EVM window). Returns the tx hash; the
 * caller waits for the receipt and re-reads progress from the chain.
 * The phishing mission must use reportPhishingOnChain().
 */
export async function completeMissionOnChain(
  provider: EIP1193Provider,
  account: Address,
  missionId: number
): Promise<`0x${string}`> {
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
): Promise<`0x${string}`> {
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
): Promise<`0x${string}`> {
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

// ---------------------------------------------------------------------------
// Wallet connection
// ---------------------------------------------------------------------------

/** The injected EIP-1193 provider (QoreX / MetaMask), if the page has one. */
export function getInjectedProvider(): EIP1193Provider | undefined {
  const w = window as unknown as { ethereum?: EIP1193Provider };
  return w.ethereum;
}

async function ensureDianaChain(provider: EIP1193Provider): Promise<void> {
  const current = (await provider.request({ method: "eth_chainId" })) as string;
  if (parseInt(current, 16) === DIANA.evmChainId) return;
  try {
    await provider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: DIANA.evmChainIdHex }],
    });
  } catch (err) {
    const code = (err as { code?: number })?.code;
    if (code !== 4902) throw err;
    await provider.request({
      method: "wallet_addEthereumChain",
      params: [
        {
          chainId: DIANA.evmChainIdHex,
          chainName: "QoreChain Diana Testnet",
          rpcUrls: [DIANA.evmRpc],
          blockExplorerUrls: [DIANA.explorer],
          nativeCurrency: { name: "QOR", symbol: "QOR", decimals: 18 },
        },
      ],
    });
  }
}

export interface ConnectedWallet {
  provider: EIP1193Provider;
  account: Address;
}

/**
 * Connect the player's wallet: request accounts, switch to Diana (9800).
 * Throws when no injected wallet exists or the user rejects the request.
 */
export async function connectInjectedWallet(): Promise<ConnectedWallet> {
  const provider = getInjectedProvider();
  if (!provider) {
    throw new Error(
      "No EIP-1193 wallet found in this browser. Open this page inside QoreX or a wallet browser, or keep playing the demo mode."
    );
  }
  const accounts = (await provider.request({
    method: "eth_requestAccounts",
  })) as string[];
  if (!accounts || accounts.length === 0) {
    throw new Error("The wallet did not share an account.");
  }
  await ensureDianaChain(provider);
  return { provider, account: accounts[0] as Address };
}

/**
 * Native-lane PQC status for a qor1... address via @qorechain/sdk over REST.
 */
export async function fetchNativePqcStatus(qorAddress: string): Promise<PqcStatus> {
  return fetchPqcStatus({ rest: NETWORKS.testnet.endpoints.rest, address: qorAddress });
}

/** EVM-lane PQC status via the 0x0A02 precompile helper from @qorechain/evm. */
export async function fetchEvmPqcStatus(account: Address) {
  const client = getPublicClient();
  return pqcKeyStatus(client, account);
}
