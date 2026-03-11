import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Negative and Edge flows", () => {
  it("double-fulfill and double-trigger do not cause second payout", async () => {
    const [owner, user, oracleNode] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await owner.getAddress(), await treasury.getAddress());
    await policy.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();
    await (await owner.sendTransaction({ to: await treasury.getAddress(), value: toWei("3") })).wait();

    const payout = toWei("1");
    await (await policy.connect(user).buyPolicy(payout, 50, { value: toWei("1") })).wait();

    // Set oracle and register request
    await (await policy.connect(owner).setChainlinkParams(await owner.getAddress(), await oracleNode.getAddress(), ethers.encodeBytes32String("JOB"), 0)).wait();
    const requestId = ethers.encodeBytes32String("REQ-NEG");
    await (await policy.connect(owner).mockRegisterRequest(requestId, 0)).wait();

    // First fulfill triggers payout
    await expect(policy.connect(oracleNode).fulfill(requestId, 100))
      .to.emit(policy, "PayoutExecuted");

    // Second fulfill should revert due to no pending request
    await expect(policy.connect(oracleNode).fulfill(requestId, 100)).to.be.revertedWith(
      "Source must be the oracle of the request"
    );

    // Owner double-trigger via direct method should revert (already inactive)
    await expect(policy.connect(owner).triggerPolicy(0)).to.be.revertedWith("Not active");
  });

  it("buyPolicy reverts when treasury available liquidity insufficient", async () => {
    const [owner, user] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();
    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await owner.getAddress(), await treasury.getAddress());
    await policy.waitForDeployment();
    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // No prefund; premium 1 ETH -> available 1, trying to reserve 2 ETH should fail
    await expect(policy.connect(user).buyPolicy(toWei("2"), 1, { value: toWei("1") }))
      .to.be.revertedWith("Insufficient liquidity");
  });

  it("admin emergencyWithdraw fails when amount greater than (balance - totalReserved)", async () => {
    const [owner, policyAddr] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();
    // Fund treasury 1 ETH and reserve 0.9
    await (await owner.sendTransaction({ to: await treasury.getAddress(), value: toWei("1") })).wait();
    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policyAddr.getAddress())).wait();
    await (await treasury.connect(policyAddr).increaseReserve(toWei("0.9"))).wait();
    // Available is 0.1; withdrawing 0.2 should revert
    await expect(treasury.connect(owner).emergencyWithdraw(await owner.getAddress(), toWei("0.2")))
      .to.be.revertedWith("Insufficient available liquidity");
  });
});

