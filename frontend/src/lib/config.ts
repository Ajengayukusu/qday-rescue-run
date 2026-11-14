/**
 * Lightweight static configuration for Q-Day Rescue Run.
 *
 * This module intentionally imports NOTHING heavy (no viem, no QoreChain
 * SDK) so the app shell and demo mode load instantly. The live chain layer
 * (src/lib/qore.ts) is pulled in with a dynamic import only when a player
 * connects a wallet.
 */

export const DIANA = {
  cosmosChainId: "qorechain-diana",
  evmChainId: 9800,
  evmChainIdHex: "0x2648", // 9800
  rest: "https://api-testnet.qore.host",
  evmRpc: "https://evm-testnet.qore.host",
  explorer: "https://explore.qore.network",
} as const;

/** Deployed RescueRun v2 address, baked in at build time. */
export const RESCUE_RUN_ADDRESS = (import.meta.env.VITE_RESCUE_RUN_ADDRESS ??
  "") as string;

/** True when this build carries a deployed contract address. */
export function isLiveConfigured(): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(RESCUE_RUN_ADDRESS);
}
