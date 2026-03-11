import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Integration Full Flow - Reserves and Payout", () => {
  it("buyPolicy -> MockOracle trigger -> payout executed -> reserves decreased", async () => {
    const [owner, user] = await ethers.getSigners();

    // Deploy Treasury and Policy
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await owner.getAddress(), await treasury.getAddress());
    await policy.waitForDeployment();

    // Grant POLICY_ROLE
    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // Prefund treasury
    await (await owner.sendTransaction({ to: await treasury.getAddress(), value: toWei("5") })).wait();

    // Buy policy -> reserves should increase by payout
    const payout = toWei("1");
    await (await policy.connect(user).buyPolicy(payout, 100, { value: toWei("1") })).wait();
    expect(await treasury.totalReserved()).to.equal(payout);

    // Deploy MockOracle and authorize
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(await policy.getAddress());
    await oracle.waitForDeployment();
    await (await policy.connect(owner).setOracle(await oracle.getAddress())).wait();

    // Trigger via MockOracle
    await expect(oracle.fulfillTrigger(0))
      .to.emit(policy, "PolicyTriggered")
      .withArgs(0)
      .and.to.emit(policy, "PayoutExecuted");

    // Reserves decreased back to zero
    expect(await treasury.totalReserved()).to.equal(0n);
  });
});

