import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying CipherCircle to the Sepolia testnet...\n");

  // Retrieve deployer account
  const signers = await ethers.getSigners();
  if (signers.length === 0) {
    throw new Error("❌ No deployer account found. Please configure PRIVATE_KEY in the .env file.");
  }
  const deployer = signers[0];
  console.log("📝 Deployer address:", deployer.address);

  // Check balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  if (balance === 0n) {
    throw new Error("❌ Account balance is 0. Please fund the deployer with Sepolia ETH.");
  }

  // Deploy contract
  console.log("📦 Deploying CipherCircle contract...");
  const CipherCircle = await ethers.getContractFactory("CipherCircle");
  const cipherCircle = await CipherCircle.deploy();

  await cipherCircle.waitForDeployment();
  const contractAddress = await cipherCircle.getAddress();

  console.log("\n✅ Deployment successful!");
  console.log("📍 Contract address:", contractAddress);
  console.log("\n📋 Add the following entry to the root .env file:");
  console.log(`VITE_CONTRACT_ADDRESS=${contractAddress}\n`);

  // Optional: wait for a few confirmations
  console.log("⏳ Waiting for block confirmations...");
  const deploymentTx = cipherCircle.deploymentTransaction();
  if (deploymentTx) {
    await deploymentTx.wait(3);
  }
  console.log("✅ Confirmations completed\n");

  // Optional contract verification (requires ETHERSCAN_API_KEY)
  if (process.env.ETHERSCAN_API_KEY) {
    console.log("🔍 Verifying contract...");
    try {
      await ethers.provider.waitForTransaction(deploymentTx?.hash || "", 1);
      // Requires hardhat-verify; command left here for reference
      // await hre.run("verify:verify", {
      //   address: contractAddress,
      //   constructorArguments: [],
      // });
      console.log("✅ Verification requires the hardhat-verify plugin\n");
    } catch (error) {
      console.log("⚠️  Contract verification failed (it may have already been verified)\n");
    }
  } else {
    console.log("💡 Tip: set ETHERSCAN_API_KEY to enable automatic verification\n");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("\n❌ Deployment failed:", error);
    process.exit(1);
  });

