import { expect } from "chai";
import { ethers } from "hardhat";

describe("ParametricInsurance", function () {
  it("allows purchasing a policy and updates coverage and totals", async () => {
    const [owner, user] = await ethers.getSigners();

    const Contract = await ethers.getContractFactory("ParametricInsurance");
    const contract = await Contract.deploy(owner.address);
    await contract.waitForDeployment();

    const premium = ethers.parseEther("1");
    await expect(contract.connect(user).purchasePolicy({ value: premium }))
      .to.emit(contract, "PolicyPurchased")
      .withArgs(await user.getAddress(), premium, premium);

    expect(await contract.coverageAmountOf(await user.getAddress())).to.equal(premium);
    expect(await contract.totalPremiums()).to.equal(premium);
  });

  it("owner can trigger payout to a recipient", async () => {
    const [owner, user, recipient] = await ethers.getSigners();

    const Contract = await ethers.getContractFactory("ParametricInsurance");
    const contract = await Contract.deploy(owner.address);
    await contract.waitForDeployment();

    // Fund contract via purchase
    const premium = ethers.parseEther("2");
    await contract.connect(user).purchasePolicy({ value: premium });

    const amount = ethers.parseEther("0.5");
    const eventId = ethers.encodeBytes32String("STORM-2025-10-07");

    await expect(contract.connect(owner).triggerPayout(await recipient.getAddress(), amount, eventId))
      .to.emit(contract, "PayoutTriggered")
      .withArgs(eventId, await recipient.getAddress(), amount);
  });
});
