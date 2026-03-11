import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Policy - Chainlink integration skeleton", () => {
  it("fulfill from oracle triggers payout when condition met; unauthorized revert", async () => {
    const [admin, policyholder, oracleNode, nonOracle] = await ethers.getSigners();

    // Deploy Treasury and Policy
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();

    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await admin.getAddress(), await treasury.getAddress());
    await policy.waitForDeployment();

    // Grant POLICY_ROLE in Treasury to Policy
    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(admin).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // Prefund treasury so reserve/liquidity are sufficient
    await (await admin.sendTransaction({ to: await treasury.getAddress(), value: toWei("5") })).wait();

    // Buy a policy: payout 1 ETH, threshold 100
    const payout = toWei("1");
    await (await policy.connect(policyholder).buyPolicy(payout, 100, { value: toWei("1") })).wait();

    // Configure Chainlink oracle address to oracleNode; token/job/fee placeholders
    const dummyLink = await admin.getAddress(); // placeholder, not used in this test path
    const dummyJob = ethers.encodeBytes32String("JOB");
    await (await policy.connect(admin).setChainlinkParams(dummyLink, await oracleNode.getAddress(), dummyJob, 0)).wait();

    // Register a mock request id mapping without sending LINK
    const requestId = ethers.encodeBytes32String("REQ1");
    await (await policy.connect(admin).mockRegisterRequest(requestId, 0)).wait();

    // Unauthorized fulfill from non-oracle should revert
    await expect(policy.connect(nonOracle).fulfill(requestId, 150)).to.be.revertedWith(
      "Source must be the oracle of the request"
    );

    // Authorized fulfill from oracleNode with value >= threshold triggers payout
    await expect(policy.connect(oracleNode).fulfill(requestId, 150))
      .to.emit(policy, "PolicyTriggered")
      .withArgs(0)
      .and.to.emit(policy, "PayoutExecuted")
      .withArgs(0, await policyholder.getAddress(), payout);

    // Reserve should be decreased after payout
    expect(await treasury.totalReserved()).to.equal(0n);
  });
});

