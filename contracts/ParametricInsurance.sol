// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title ParametricInsurance
/// @notice Minimal demo vault combining purchase and owner-triggered payouts.
/// @dev Owner acts as a trusted operator; kept for comparison with modular Policy/Treasury.
contract ParametricInsurance is Ownable, ReentrancyGuard {
    // Mapping of insured address to nominal coverage units (simple example: equals paid premium)
    mapping(address => uint256) public coverageAmountOf;

    // Total premiums collected (accounting variable)
    uint256 public totalPremiums;

    event PolicyPurchased(address indexed purchaser, uint256 premium, uint256 coverageUnits);
    event PayoutTriggered(bytes32 indexed eventId, address indexed recipient, uint256 amount);
    event SurplusWithdrawn(address indexed to, uint256 amount);

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Buy coverage by paying a premium in ETH; simple 1:1 coverage for demo purposes
    function purchasePolicy() external payable {
        require(msg.value > 0, "Premium required");
        coverageAmountOf[msg.sender] += msg.value;
        totalPremiums += msg.value;
        emit PolicyPurchased(msg.sender, msg.value, msg.value);
    }

    /// @notice Owner-triggered payout to a recipient when the parametric condition is met
    /// @param recipient Address to receive the payout
    /// @param amount Amount of ETH to pay
    /// @param eventId Identifier of the triggering event/condition (off-chain correlation)
    function triggerPayout(address recipient, uint256 amount, bytes32 eventId)
        external
        onlyOwner
        nonReentrant
    {
        require(recipient != address(0), "Invalid recipient");
        require(amount > 0, "Amount=0");
        require(address(this).balance >= amount, "Insufficient funds");

        // Note: For simplicity, we do not reduce recipient's coverage in this demo contract.
        // A production version would track policy states, coverage limits, epochs, etc.
        (bool sent, ) = payable(recipient).call{value: amount}("");
        require(sent, "Transfer failed");

        emit PayoutTriggered(eventId, recipient, amount);
    }

    /// @notice Withdraw surplus funds from the contract (e.g., to insurer treasury)
    function withdrawSurplus(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid to");
        require(amount > 0, "Amount=0");
        require(address(this).balance >= amount, "Insufficient funds");
        (bool sent, ) = payable(to).call{value: amount}("");
        require(sent, "Transfer failed");
        emit SurplusWithdrawn(to, amount);
    }

    /// @notice Accept direct ETH top-ups (e.g., to pre-fund the pool)
    receive() external payable {}
}
