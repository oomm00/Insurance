import { expect } from "chai";
import { ethers } from "hardhat";

// Helpers for BigInt math with ethers v6
const toWei = (v: string) => ethers.parseEther(v);

describe("Policy", () => {
  it("deploys, buys a policy, stores data, triggers payout, and transfers funds", async () => {
    const [owner, user] = await ethers.getSigners();

    // Deploy Treasury owned by owner
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    const treasury = await TreasuryFactory.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    // Deploy Policy with treasury reference and same owner
    const PolicyFactory = await ethers.getContractFactory("Policy");
    const policy = await PolicyFactory.deploy(
      await owner.getAddress(),
      await treasury.getAddress()
    );
    await policy.waitForDeployment();

  // Grant POLICY_ROLE to Policy in Treasury
  const POLICY_ROLE = await treasury.POLICY_ROLE();
  await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    const payout = toWei("0.5");
    const threshold = 123n;
    const premium = toWei("1");

    await expect(policy.connect(user).buyPolicy(payout, threshold, { value: premium }))
      .to.emit(policy, "PolicyPurchased")
      .withArgs(0, await user.getAddress(), premium, payout);

    // Reserve should be increased by payout
    expect(await treasury.totalReserved()).to.equal(payout);

    // Check stored policy data via mapping and getter
    const stored = await policy.policies(0);
    expect(stored.id).to.equal(0n);
    expect(stored.policyholder).to.equal(await user.getAddress());
    expect(stored.premium).to.equal(premium);
    expect(stored.payout).to.equal(payout);
    expect(stored.threshold).to.equal(threshold);
    expect(stored.active).to.equal(true);
    expect(stored.triggered).to.equal(false);

    const list = await policy.getPoliciesByUser(await user.getAddress());
    expect(list.length).to.equal(1);
    expect(list[0].id).to.equal(0n);

    // Before trigger balances (now on Treasury)
    const treasuryAddress = await treasury.getAddress();
    const treasuryBalBefore = await ethers.provider.getBalance(treasuryAddress);
    const userBalBefore = await ethers.provider.getBalance(await user.getAddress());

    // Trigger payout by owner (also owner of Treasury)
    await expect(policy.connect(owner).triggerPolicy(0))
      .to.emit(policy, "PolicyTriggered")
      .withArgs(0)
      .and.to.emit(policy, "PayoutExecuted")
      .withArgs(0, await user.getAddress(), payout);

    // Reserve should decrease back after payout execution
    expect(await treasury.totalReserved()).to.equal(0n);

    const storedAfter = await policy.policies(0);
    expect(storedAfter.active).to.equal(false);
    expect(storedAfter.triggered).to.equal(true);

    const treasuryBalAfter = await ethers.provider.getBalance(treasuryAddress);
    const userBalAfter = await ethers.provider.getBalance(await user.getAddress());

    // Treasury balance decreased by payout
    expect(treasuryBalBefore - treasuryBalAfter).to.equal(payout);

    // User received payout (allow for some gas spent by the owner tx)
    expect(userBalAfter).to.be.gte(userBalBefore + payout - toWei("0.001"));

    // Duplicate trigger should revert (already inactive)
    await expect(policy.connect(owner).triggerPolicy(0)).to.be.revertedWith("Not active");
  });

  it("can trigger via MockOracle callback", async () => {
    const [owner, user] = await ethers.getSigners();

    // Deploy Treasury and Policy
    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    const treasury = await TreasuryFactory.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const PolicyFactory = await ethers.getContractFactory("Policy");
    const policy = await PolicyFactory.deploy(
      await owner.getAddress(),
      await treasury.getAddress()
    );
    await policy.waitForDeployment();
    const POLICY_ROLE2 = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE2, await policy.getAddress())).wait();

    // Deploy MockOracle pointing to Policy
    const OracleFactory = await ethers.getContractFactory("MockOracle");
    const oracle = await OracleFactory.deploy(await policy.getAddress());
    await oracle.waitForDeployment();

    // Authorize oracle on Policy
    await (await policy.connect(owner).setOracle(await oracle.getAddress())).wait();

    // Buy policy
    await (await policy.connect(user).buyPolicy(toWei("0.3"), 77, { value: toWei("0.6") })).wait();

    // Trigger via oracle (should emit PolicyTriggered)
    await expect(oracle.fulfillTrigger(0))
      .to.emit(policy, "PolicyTriggered")
      .withArgs(0);
  });

  it("reverts on buy when payout exceeds available liquidity (reserve increase fails)", async () => {
    const [owner, user] = await ethers.getSigners();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    const treasury = await TreasuryFactory.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const PolicyFactory = await ethers.getContractFactory("Policy");
    const policy = await PolicyFactory.deploy(
      await owner.getAddress(),
      await treasury.getAddress()
    );
    await policy.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // No pre-funding. Available liquidity equals the deposit (premium) which is 1 ETH.
    const premium = toWei("1");
    const payoutTooHigh = toWei("2");

    await expect(
      policy.connect(user).buyPolicy(payoutTooHigh, 1, { value: premium })
    ).to.be.revertedWith("Insufficient liquidity");
  });

  it("reverts on buy when payout exceeds maxPayout", async () => {
    const [owner, user] = await ethers.getSigners();

    const TreasuryFactory = await ethers.getContractFactory("Treasury");
    const treasury = await TreasuryFactory.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const PolicyFactory = await ethers.getContractFactory("Policy");
    const policy = await PolicyFactory.deploy(
      await owner.getAddress(),
      await treasury.getAddress()
    );
    await policy.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // Set maxPayout to 0.4 ETH
    await (await policy.connect(owner).setMaxPayout(toWei("0.4"))).wait();

    const premium = toWei("1");
    const payoutTooHigh = toWei("0.5");

    await expect(
      policy.connect(user).buyPolicy(payoutTooHigh, 1, { value: premium })
    ).to.be.revertedWith("Payout exceeds max");
  });
});
