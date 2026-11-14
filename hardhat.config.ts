import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";

// Load .env (PRIVATE_KEY) when present. Never commit a real key:
// the deploy account must be a throwaway, faucet-funded testnet account
// whose ML-DSA-87 key is registered and whose EVM window is open
// (see README "Deploy to Diana testnet").
try {
  (process as unknown as { loadEnvFile?: () => void }).loadEnvFile?.();
} catch {
  // No .env file: rely on environment variables.
}

const PRIVATE_KEY = process.env.PRIVATE_KEY ?? "";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } },
  },
  networks: {
    hardhat: { chainId: 31337 },
    qorechainTestnet: {
      // QoreChain Diana testnet, EVM lane.
      url: process.env.QORE_EVM_RPC_URL ?? "https://evm-testnet.qore.host",
      chainId: 9800,
      accounts: PRIVATE_KEY ? [PRIVATE_KEY] : [],
    },
  },
};

export default config;
