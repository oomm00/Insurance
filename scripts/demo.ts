import { ethers } from "hardhat";
import * as readline from "readline";

/**
 * PARAMETRIC INSURANCE SYSTEM DEMO
 * 
 * This script demonstrates the complete insurance workflow:
 * 1. Purchase a policy
 * 2. Trigger a policy based on external conditions
 * 3. Execute payout to policyholder
 * 
 * Contract Architecture:
 * - Treasury: Secure vault that holds ETH premiums and sends payouts
 * - Policy: Manages insurance policies (creation, triggering, payouts)
 * - MockOracle: Simulates external oracle that triggers policies
 */

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function question(query: string): Promise<string> {
  return new Promise(resolve => rl.question(query, resolve));
}

async function pause(message: string = "Press Enter to continue...") {
  await question(message);
}

async function main() {
  console.log("\n============================================");
  console.log("  PARAMETRIC INSURANCE SYSTEM DEMO");
  console.log("============================================\n");
  
  // Get signers
  const [deployer, policyholder, thirdParty] = await ethers.getSigners();
  console.log("📋 Signers:");
  console.log("   Deployer/Owner:", deployer.address);
  console.log("   Policyholder:", policyholder.address);
  console.log("   Third Party:", thirdParty.address);
  
  await pause("\n👉 Press Enter to deploy contracts...\n");

  // Deploy Treasury
  console.log("\n🏦 STEP 1: Deploying Treasury contract...");
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployer.address);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("✅ Treasury deployed:", treasuryAddress);
  
  // Deploy Policy
  console.log("\n📄 STEP 2: Deploying Policy contract...");
  const Policy = await ethers.getContractFactory("Policy");
  const policy = await Policy.deploy(deployer.address, treasuryAddress);
  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  console.log("✅ Policy deployed:", policyAddress);

  // Authorize Policy in Treasury
  console.log("\n🔐 STEP 3: Authorizing Policy in Treasury...");
  await (await treasury.setPolicy(policyAddress)).wait();
  console.log("✅ Policy authorized to initiate payouts");

  // Deploy MockOracle
  console.log("\n🔮 STEP 4: Deploying MockOracle (simulates external oracle)...");
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(policyAddress);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("✅ MockOracle deployed:", oracleAddress);

  // Set oracle on Policy
  console.log("\n🔗 STEP 5: Linking Oracle to Policy...");
  await (await policy.setOracle(oracleAddress)).wait();
  console.log("✅ Oracle authorized to trigger policies");

  // Fund Treasury
  console.log("\n💰 STEP 6: Funding Treasury with initial capital...");
  const initialFund = ethers.parseEther("5"); // 5 ETH
  const fundTx = await deployer.sendTransaction({ to: treasuryAddress, value: initialFund });
  await fundTx.wait();
  console.log("✅ Treasury funded with", ethers.formatEther(initialFund), "ETH");

  await pause("\n👉 Press Enter to demonstrate Policy Purchase...\n");

  // Purchase Policy
  console.log("\n📝 STEP 7: Policyholder purchases insurance...");
  console.log("   Policyholder:", policyholder.address);
  
  const premium = ethers.parseEther("1"); // 1 ETH premium
  const payoutAmount = ethers.parseEther("3"); // 3 ETH payout if triggered
  const threshold = 100; // Example: 100mm rainfall threshold
  
  console.log("   Premium:", ethers.formatEther(premium), "ETH");
  console.log("   Coverage (Payout if triggered):", ethers.formatEther(payoutAmount), "ETH");
  console.log("   Threshold:", threshold, "mm (e.g., rainfall)");
  
  const buyTx = await policy.connect(policyholder).buyPolicy(
    payoutAmount,
    threshold,
    { value: premium }
  );
  await buyTx.wait();
  console.log("✅ Policy purchased successfully!");
  
  const treasuryBalance = await treasury.getBalance();
  console.log("   Treasury balance:", ethers.formatEther(treasuryBalance), "ETH");

  await pause("\n👉 Press Enter to query policy details...\n");

  // Query Policy
  console.log("\n🔍 STEP 8: Querying policy details...");
  const policies = await policy.getPoliciesByUser(policyholder.address);
  const userPolicy = policies[0];
  
  console.log("\n📊 Policy Information:");
  console.log("   Policy ID:", userPolicy.id.toString());
  console.log("   Policyholder:", userPolicy.policyholder);
  console.log("   Premium paid:", ethers.formatEther(userPolicy.premium), "ETH");
  console.log("   Payout amount:", ethers.formatEther(userPolicy.payout), "ETH");
  console.log("   Threshold:", userPolicy.threshold.toString());
  console.log("   Active:", userPolicy.active);
  console.log("   Triggered:", userPolicy.triggered);

  await pause("\n👉 Press Enter to simulate external event triggering payout...\n");

  // Trigger Policy
  console.log("\n🌐 STEP 9: Simulating external condition met...");
  console.log("   (In production, this would be triggered by a real oracle");
  console.log("    monitoring rainfall, flight delays, earthquake data, etc.)\n");
  
  console.log("   External condition detected: 150mm rainfall (threshold: 100mm)");
  console.log("   Triggering policy payout...");
  
  const triggerTx = await oracle.fulfillTrigger(userPolicy.id);
  await triggerTx.wait();
  console.log("✅ Policy triggered and payout executed!");
  
  const policiesAfter = await policy.getPoliciesByUser(policyholder.address);
  const policyAfterTrigger = policiesAfter[0];
  
  console.log("\n📊 Updated Policy State:");
  console.log("   Active:", policyAfterTrigger.active);
  console.log("   Triggered:", policyAfterTrigger.triggered);
  
  const finalTreasuryBalance = await treasury.getBalance();
  console.log("\n💰 Final Treasury balance:", ethers.formatEther(finalTreasuryBalance), "ETH");
  
  const policyholderBalance = await ethers.provider.getBalance(policyholder.address);
  console.log("💰 Policyholder balance:", ethers.formatEther(policyholderBalance), "ETH");

  await pause("\n👉 Press Enter to show contract addresses summary...\n");

  // Summary
  console.log("\n============================================");
  console.log("  DEPLOYMENT SUMMARY");
  console.log("============================================\n");
  console.log("🏦 Treasury:", treasuryAddress);
  console.log("📄 Policy:", policyAddress);
  console.log("🔮 MockOracle:", oracleAddress);
  console.log("\n💰 Initial Treasury funding:", ethers.formatEther(initialFund), "ETH");
  console.log("📝 Policy purchased by:", policyholder.address);
  console.log("💵 Premium paid:", ethers.formatEther(premium), "ETH");
  console.log("🎁 Payout amount:", ethers.formatEther(payoutAmount), "ETH");
  
  console.log("\n✅ Demo completed successfully!\n");
  
  rl.close();
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

