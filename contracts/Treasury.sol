// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title Treasury
/// @notice Holds ETH premiums and processes payouts. Integrates reserve accounting
///         to prevent withdrawing funds required for pending obligations.
contract Treasury is AccessControl, ReentrancyGuard {
    event Deposit(address indexed from, uint256 amount);
    event Withdraw(address indexed to, uint256 amount);
    event ReserveIncreased(uint256 amount, uint256 totalReserved);
    event ReserveDecreased(uint256 amount, uint256 totalReserved);

    bytes32 public constant POLICY_ROLE = keccak256("POLICY_ROLE");
    bytes32 public constant WITHDRAW_ROLE = keccak256("WITHDRAW_ROLE");

    // Reserved funds that should not be withdrawn via emergency or non-policy flows
    uint256 public totalReserved;

    constructor(address initialOwner) {
        require(initialOwner != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, initialOwner);
    }

    function deposit() external payable {
        require(msg.value > 0, "Amount=0");
        emit Deposit(msg.sender, msg.value);
    }

    function getBalance() external view returns (uint256) {
        return address(this).balance;
    }

    receive() external payable {
        emit Deposit(msg.sender, msg.value);
    }

    // Reserve management by Policy
    function increaseReserve(uint256 amount) external {
        require(hasRole(POLICY_ROLE, msg.sender), "Missing POLICY_ROLE");
        require(amount > 0, "Amount=0");
        uint256 balance = address(this).balance;
        uint256 available = balance > totalReserved ? balance - totalReserved : 0;
        require(available >= amount, "Insufficient liquidity");
        totalReserved += amount;
        emit ReserveIncreased(amount, totalReserved);
    }

    function decreaseReserve(uint256 amount) external {
        require(hasRole(POLICY_ROLE, msg.sender), "Missing POLICY_ROLE");
        require(amount > 0, "Amount=0");
        require(totalReserved >= amount, "Reserve underflow");
        totalReserved -= amount;
        emit ReserveDecreased(amount, totalReserved);
    }

    // Payouts can be initiated by callers with POLICY_ROLE or WITHDRAW_ROLE
    function transferOut(address payable to, uint256 amount) external nonReentrant {
        require(hasRole(POLICY_ROLE, msg.sender) || hasRole(WITHDRAW_ROLE, msg.sender), "Not authorized");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Amount=0");
        require(address(this).balance >= amount, "Insufficient funds");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        emit Withdraw(to, amount);
    }

    // Admin-only emergency withdraw that cannot touch reserved funds
    function emergencyWithdraw(address payable to, uint256 amount) external nonReentrant {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Missing admin role");
        require(to != address(0), "Invalid to");
        require(amount > 0, "Amount=0");
        uint256 balance = address(this).balance;
        uint256 available = balance > totalReserved ? balance - totalReserved : 0;
        require(available >= amount, "Insufficient available liquidity");
        (bool sent, ) = to.call{value: amount}("");
        require(sent, "Transfer failed");
        emit Withdraw(to, amount);
    }

    // Backward-compat: optional helper to grant role when integrating legacy flows
    function setPolicy(address policyAddress) external {
        require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "Missing admin role");
        require(policyAddress != address(0), "Invalid policy");
        _grantRole(POLICY_ROLE, policyAddress);
    }
}
