import { ethers, network } from "hardhat";

/**
 * Deploy RescueRun to QoreChain Diana testnet (EVM chainId 9800).
 *
 * Preconditions (do NOT skip — see SPIKE_REPORT.md / README):
 *   1. The deployer is a throwaway testnet account funded from the faucet
 *      (100 QOR to its qor1... coin-60 address).
 *   2. Its ML-DSA-87 key is REGISTERED (that must be the account's FIRST tx).
 *   3. A scoped EVM authorisation window is OPEN for the deployer
 *      (deployment consumes window budget).
 *   4. PRIVATE_KEY is set in .env (never commit it).
 *
 * Run:  npm run deploy:testnet
 */
async function main() {
  const [deployer] = await ethers.getSigners();
  if (!deployer) {
    throw new Error(
      "No deployer account. Set PRIVATE_KEY in .env (throwaway testnet account only)."
    );
  }

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Network:        ${network.name} (chainId ${network.config.chainId})`);
  console.log(`Deployer:       ${deployer.address}`);
  console.log(`Balance:        ${ethers.formatEther(balance)} QOR (EVM lane)`);

  const factory = await ethers.getContractFactory("RescueRun");
  const contract = await factory.deploy();
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  const deployTx = contract.deploymentTransaction();
  console.log(`RescueRun:      ${address}`);
  console.log(`Deploy tx hash: ${deployTx?.hash ?? "(unknown)"}`);
  console.log(
    `\nNext steps:\n` +
      `  1. Save the address + tx hash above into deployments.testnet.json and the README proof table.\n` +
      `  2. Set VITE_RESCUE_RUN_ADDRESS=${address} in frontend/.env to switch the UI to live mode.\n` +
      `  3. Verify on the explorer: https://explore.qore.network (toggle: Testnet).`
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
