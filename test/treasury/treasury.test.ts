import { expect } from "chai";
import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Treasury (AccessControl + Reserves)", () => {
  it("accepts deposits and emits Deposit", async () => {
    const [admin, user] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();
    const addr = await treasury.getAddress();

    const amount = toWei("1");
    await expect(user.sendTransaction({ to: addr, value: amount }))
      .to.emit(treasury, "Deposit")
      .withArgs(await user.getAddress(), amount);

    expect(await treasury.getBalance()).to.equal(amount);
  });

  it("increaseReserve by POLICY_ROLE succeeds; fails if insufficient available liquidity", async () => {
    const [admin, policy, funder] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(admin).grantRole(POLICY_ROLE, await policy.getAddress())).wait();

    // Fund with 1 ETH
    await (await funder.sendTransaction({ to: await treasury.getAddress(), value: toWei("1") })).wait();

    // Increase reserve 0.6 ETH
    await expect(treasury.connect(policy).increaseReserve(toWei("0.6")))
      .to.emit(treasury, "ReserveIncreased");
    expect(await treasury.totalReserved()).to.equal(toWei("0.6"));

    // Attempt to over-reserve beyond available liquidity (available = 1 - 0.6 = 0.4)
    await expect(treasury.connect(policy).increaseReserve(toWei("0.5"))).to.be.revertedWith("Insufficient liquidity");
  });

  it("decreaseReserve reduces totalReserved correctly", async () => {
    const [admin, policy, funder] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(admin).grantRole(POLICY_ROLE, await policy.getAddress())).wait();
    await (await funder.sendTransaction({ to: await treasury.getAddress(), value: toWei("1") })).wait();

    await (await treasury.connect(policy).increaseReserve(toWei("0.8"))).wait();
    expect(await treasury.totalReserved()).to.equal(toWei("0.8"));

    await expect(treasury.connect(policy).decreaseReserve(toWei("0.3")))
      .to.emit(treasury, "ReserveDecreased");
    expect(await treasury.totalReserved()).to.equal(toWei("0.5"));
  });

  it("transferOut callable by POLICY_ROLE and sends funds", async () => {
    const [admin, policy, recipient, funder] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(admin).grantRole(POLICY_ROLE, await policy.getAddress())).wait();
    await (await funder.sendTransaction({ to: await treasury.getAddress(), value: toWei("1") })).wait();

    const before = await ethers.provider.getBalance(await recipient.getAddress());
    await expect(treasury.connect(policy).transferOut(await recipient.getAddress(), toWei("0.2")))
      .to.emit(treasury, "Withdraw");
    const after = await ethers.provider.getBalance(await recipient.getAddress());
    expect(after).to.be.gte(before + toWei("0.2") - toWei("0.001"));
  });

  it("admin emergencyWithdraw cannot remove reserved funds", async () => {
    const [admin, policy, recipient, funder] = await ethers.getSigners();
    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await admin.getAddress());
    await treasury.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(admin).grantRole(POLICY_ROLE, await policy.getAddress())).wait();
    await (await funder.sendTransaction({ to: await treasury.getAddress(), value: toWei("1") })).wait();

    await (await treasury.connect(policy).increaseReserve(toWei("0.9"))).wait();
    // Available = 0.1 ETH, trying to withdraw 0.2 should fail
    await expect(
      treasury.connect(admin).emergencyWithdraw(await recipient.getAddress(), toWei("0.2"))
    ).to.be.revertedWith("Insufficient available liquidity");
  });
});

