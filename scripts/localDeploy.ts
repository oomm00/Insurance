import { ethers } from "hardhat";

async function main() {
  const [deployer] = await ethers.getSigners();
  const ownerAddress = await deployer.getAddress();
  console.log("Deployer:", ownerAddress);

  // Deploy Treasury owned by deployer
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(ownerAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury:", treasuryAddress);

  // Deploy Policy with treasury reference and same owner
  const Policy = await ethers.getContractFactory("Policy");
  const policy = await Policy.deploy(ownerAddress, treasuryAddress);
  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  console.log("Policy:", policyAddress);

  // Grant POLICY_ROLE in Treasury to Policy for payouts
  const POLICY_ROLE = await treasury.POLICY_ROLE();
  const tx = await treasury.grantRole(POLICY_ROLE, policyAddress);
  await tx.wait();
  console.log("Treasury POLICY_ROLE granted ->", policyAddress);

  // Deploy MockOracle for local testing
  const MockOracle = await ethers.getContractFactory("MockOracle");
  const mockOracle = await MockOracle.deploy(policyAddress);
  await mockOracle.waitForDeployment();
  const mockOracleAddress = await mockOracle.getAddress();
  console.log("MockOracle:", mockOracleAddress);

  // Set MockOracle in Policy
  const setOracleTx = await policy.setOracle(mockOracleAddress);
  await setOracleTx.wait();
  console.log("Policy oracle set to MockOracle");

  console.log("\nDeployment complete! Run frontend with:");
  console.log("cd frontend && npm install && npm run dev");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
