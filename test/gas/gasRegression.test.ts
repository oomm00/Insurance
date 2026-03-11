import { ethers } from "hardhat";

const toWei = (v: string) => ethers.parseEther(v);

describe("Gas Regression - Buy + Payout", () => {
  it("logs gas for buyPolicy and payout path", async () => {
    const [owner, user, oracle] = await ethers.getSigners();

    const Treasury = await ethers.getContractFactory("Treasury");
    const treasury = await Treasury.deploy(await owner.getAddress());
    await treasury.waitForDeployment();

    const Policy = await ethers.getContractFactory("Policy");
    const policy = await Policy.deploy(await owner.getAddress(), await treasury.getAddress());
    await policy.waitForDeployment();

    const POLICY_ROLE = await treasury.POLICY_ROLE();
    await (await treasury.connect(owner).grantRole(POLICY_ROLE, await policy.getAddress())).wait();
    await (await owner.sendTransaction({ to: await treasury.getAddress(), value: toWei("5") })).wait();

    const payout = toWei("1");
    const buyTx = await policy.connect(user).buyPolicy(payout, 100, { value: toWei("1") });
    const buyRcpt = await buyTx.wait();

    const Oracle = await ethers.getContractFactory("MockOracle");
    const mock = await Oracle.deploy(await policy.getAddress());
    await mock.waitForDeployment();
    await (await policy.connect(owner).setOracle(await mock.getAddress())).wait();

    const trigTx = await mock.fulfillTrigger(0);
    const trigRcpt = await trigTx.wait();

    console.log("Gas Used - buyPolicy:", buyRcpt?.gasUsed?.toString());
    console.log("Gas Used - trigger+payout:", trigRcpt?.gasUsed?.toString());
  });
});

