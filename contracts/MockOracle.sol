// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @notice Minimal interface of Policy used by the mock oracle.
interface IPolicy {
    function triggerPolicy(uint256 policyId) external;
}

/// @title MockOracle
/// @notice Development-only oracle that calls back into Policy to simulate fulfillment.
contract MockOracle {
    IPolicy public policy;

    /// @param policyAddress Address of the Policy to notify.
    constructor(IPolicy policyAddress) {
        policy = policyAddress;
    }

    /// @notice Update the policy address (dev convenience).
    function setPolicy(IPolicy policyAddress) external {
        policy = policyAddress;
    }

    /// @notice Simulates an external trigger by calling Policy.triggerPolicy.
    function fulfillTrigger(uint256 policyId) external {
        policy.triggerPolicy(policyId);
    }
}
