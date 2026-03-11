import { ethers, network, run } from "hardhat";
import fs from "fs";
import path from "path";

async function main() {
  const [deployer] = await ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deployer:", deployerAddress);

  // Deploy Treasury (owner = deployer)
  const Treasury = await ethers.getContractFactory("Treasury");
  const treasury = await Treasury.deploy(deployerAddress);
  await treasury.waitForDeployment();
  const treasuryAddress = await treasury.getAddress();
  console.log("Treasury:", treasuryAddress);

  // Deploy Policy (owner = deployer, with treasury)
  const Policy = await ethers.getContractFactory("Policy");
  const policy = await Policy.deploy(deployerAddress, treasuryAddress);
  await policy.waitForDeployment();
  const policyAddress = await policy.getAddress();
  console.log("Policy:", policyAddress);

  // Grant POLICY_ROLE in Treasury to Policy for payouts
  const POLICY_ROLE = await treasury.POLICY_ROLE();
  await (await treasury.grantRole(POLICY_ROLE, policyAddress)).wait();

  // Deploy MockOracle pointing to Policy
  const Oracle = await ethers.getContractFactory("MockOracle");
  const oracle = await Oracle.deploy(policyAddress);
  await oracle.waitForDeployment();
  const oracleAddress = await oracle.getAddress();
  console.log("MockOracle:", oracleAddress);

  // Set oracle on Policy
  await (await policy.setOracle(oracleAddress)).wait();

  // Fund Treasury with initial ETH (1 ETH by default)
  const initialFund = ethers.parseEther("1");
  const fundTx = await deployer.sendTransaction({ to: treasuryAddress, value: initialFund });
  await fundTx.wait();
  console.log("Treasury funded:", initialFund.toString(), "wei");

  // Also register deposit event via explicit deposit if desired (optional)
  // await (await treasury.deposit({ value: initialFund })).wait();

  // Optional Chainlink configuration and LINK funding
  const LINK_TOKEN = process.env.LINK_TOKEN || "";
  const CHAINLINK_ORACLE = process.env.CHAINLINK_ORACLE || "";
  const JOB_ID = process.env.JOB_ID || "";
  const FEE = process.env.FEE || ""; // in LINK wei

  if (LINK_TOKEN && CHAINLINK_ORACLE && JOB_ID && FEE) {
    console.log("Configuring Chainlink params...");
    // Transfer LINK to Policy to cover request fees
    const linkAbi = [
      "function transfer(address to, uint256 amount) external returns (bool)",
      "function balanceOf(address account) external view returns (uint256)"
    ];
    const link = new ethers.Contract(LINK_TOKEN, linkAbi, deployer);
    const feeBN = BigInt(FEE);
    const bal: bigint = await link.balanceOf(deployerAddress);
    if (bal < feeBN) {
      console.warn("WARN: LINK balance is less than fee. Skipping LINK transfer.");
    } else {
      const tx1 = await link.transfer(policyAddress, feeBN);
      await tx1.wait();
      console.log(`Transferred LINK to Policy: ${feeBN.toString()}`);
    }
    await (await policy.setChainlinkParams(LINK_TOKEN, CHAINLINK_ORACLE, JOB_ID as any, feeBN)).wait();
    console.log("Chainlink params set on Policy.");
  } else {
    console.log("Chainlink env not fully provided; skipping Chainlink configuration.");
  }

  // Persist deployments info
  const netName = network.name;
  const outDir = path.join(process.cwd(), "deployments");
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  const abiDir = path.join(process.cwd(), "artifacts", "abi");
  const outJson = {
    network: netName,
    contracts: {
      Treasury: {
        address: treasuryAddress,
        abiPath: path.join("artifacts", "abi", "Treasury.abi.json")
      },
      Policy: {
        address: policyAddress,
        abiPath: path.join("artifacts", "abi", "Policy.abi.json")
      },
      MockOracle: {
        address: oracleAddress,
        abiPath: path.join("artifacts", "abi", "MockOracle.abi.json")
      }
    }
  };
  const outPath = path.join(outDir, `${netName}.json`);
  fs.writeFileSync(outPath, JSON.stringify(outJson, null, 2), "utf8");
  console.log("Deployment manifest written:", outPath);

  console.log("ABIs expected at:", path.join(abiDir, "Treasury.abi.json"), path.join(abiDir, "Policy.abi.json"), path.join(abiDir, "MockOracle.abi.json"));

  // Optional contract verification if ETHERSCAN_API_KEY present and not the in-memory hardhat network
  if (process.env.ETHERSCAN_API_KEY && netName !== "hardhat") {
    try {
      console.log("Verifying Treasury...");
      await run("verify:verify", {
        address: treasuryAddress,
        constructorArguments: [deployerAddress]
      });
      console.log("Verifying Policy...");
      await run("verify:verify", {
        address: policyAddress,
        constructorArguments: [deployerAddress, treasuryAddress]
      });
      console.log("Verifying MockOracle...");
      await run("verify:verify", {
        address: oracleAddress,
        constructorArguments: [policyAddress]
      });
    } catch (e) {
      console.warn("Verification step failed or skipped:", e);
    }
  } else {
    console.log("Etherscan verification skipped (no ETHERSCAN_API_KEY or hardhat network).");
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
