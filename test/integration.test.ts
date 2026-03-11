import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Integration: Treasury + Policy + MockOracle", () => {
  it("buys policy, oracle triggers, payout executes, balances update", async () => {
    const [owner, user] = await ethers.getSigners();

    // Deploy Treasury (owner = owner)
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();
    const treasuryAddress = await treasury.getAddress();

    // Deploy Policy (owner = owner, treasury wired)
    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await owner.getAddress(), treasuryAddress);
    await policy.waitForDeployment();

  // Grant POLICY_ROLE to Policy in Treasury
  const POLICY_ROLE = await treasury.POLICY_ROLE();
  await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // Deploy MockOracle and set as oracle on Policy
    const Oracle = await ethers.getContractFactory("MockOracle");
    const oracle = await Oracle.deploy(await policy.getAddress());
    await oracle.waitForDeployment();
    await (await policy.connect(owner).setOracle(await oracle.getAddress())).wait();

    // Fund Treasury (initial liquidity) and track balances
    const initialFund = toWei("1");
    await (await owner.sendTransaction({ to: treasuryAddress, value: initialFund })).wait();
    const treasuryBalStart = await ethers.provider.getBalance(treasuryAddress);

    // User buys a policy
    const payout = toWei("0.4");
    const premium = toWei("0.7");
    const userAddr = await user.getAddress();

    await expect(policy.connect(user).buyPolicy(payout, 42, { value: premium }))
      .to.emit(policy, "PolicyPurchased")
      .withArgs(0, userAddr, premium, payout);

    // After buy, Treasury balance increases by premium
    const treasuryBalAfterBuy = await ethers.provider.getBalance(treasuryAddress);
    expect(treasuryBalAfterBuy - treasuryBalStart).to.equal(premium);

    // Record balance before payout
    const userBalBefore = await ethers.provider.getBalance(userAddr);

    // Trigger via oracle -> should payout
    await expect(oracle.fulfillTrigger(0))
      .to.emit(policy, "PolicyTriggered")
      .withArgs(0)
      .and.to.emit(policy, "PayoutExecuted")
      .withArgs(0, userAddr, payout);

    // Validate state and balances
    const p = await policy.policies(0);
    expect(p.active).to.equal(false);
    expect(p.triggered).to.equal(true);
    expect(await policy.payoutExecuted(0)).to.equal(true);

    const treasuryBalAfterPayout = await ethers.provider.getBalance(treasuryAddress);
    expect(treasuryBalAfterBuy - treasuryBalAfterPayout).to.equal(payout);

    const userBalAfter = await ethers.provider.getBalance(userAddr);
    // User balance should have increased by roughly payout (allowing for gas tolerance)
    expect(userBalAfter).to.be.gte(userBalBefore + payout - toWei("0.001"));
  });
});
