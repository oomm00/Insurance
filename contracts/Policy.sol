// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@chainlink/contracts/src/v0.8/shared/interfaces/AggregatorV3Interface.sol";

/// @title ITreasury Interface
/// @notice Interface for the Treasury contract that manages funds
interface ITreasury {
    function deposit() external payable;
    function transferOut(address to, uint256 amount) external;
    function getBalance() external view returns (uint256);
    function setPolicy(address policyAddress) external;
    function increaseReserve(uint256 amount) external;
    function decreaseReserve(uint256 amount) external;
}

/// @title Policy
/// @notice Main contract for parametric insurance policies. Handles policy creation,
///         management, and payout execution based on oracle-provided triggers.
/// @dev Integrates with custom oracle for external data and Treasury for fund management
contract Policy is Ownable, ReentrancyGuard, Pausable {
    // --------- Custom Errors ---------
    error PremiumRequired();      // Premium payment missing
    error PayoutRequired();       // Payout amount not specified
    error PayoutExceedsMax();     // Payout exceeds maximum allowed
    error NotAuthorized();        // Caller not authorized
    error PolicyNotFound();       // Policy ID does not exist
    error NotActive();            // Policy is not active
    error AlreadyTriggered();     // Policy already triggered
    error AlreadyPaid();         // Payout already executed
    error InsufficientFunds();    // Not enough funds in treasury
    error InvalidOracle();        // Invalid oracle address
    
    /// @notice Structure holding policy details
    /// @dev All monetary values are in wei
    struct PolicyData {
        uint256 id;              // Unique policy identifier
        address policyholder;    // Address of the policy owner
        uint256 premium;         // Amount paid to purchase policy
        uint256 payout;         // Amount to be paid if triggered
        uint256 threshold;      // Trigger threshold (e.g., rainfall in mm)
        bool active;            // Whether policy is active
        bool triggered;         // Whether policy has been triggered
    }

    // policyId → Policy
    mapping(uint256 => PolicyData) public policies;

    // address → array of user policy IDs
    mapping(address => uint256[]) public userPolicyIds;

    // Tracks whether a payout has been executed for a given policy id
    mapping(uint256 => bool) public payoutExecuted;

    // Next policy identifier
    uint256 public nextPolicyId;

    // Treasury contract that holds funds
    ITreasury public treasury;

    // --------- Storage ---------
    address public oracle;
    uint256 public maxPayout;
    mapping(bytes32 => uint256) public requestToPolicy;

    // --------- Events ---------
    event OracleRequested(uint256 indexed policyId, bytes32 indexed requestId);
    event OracleFulfilled(bytes32 indexed requestId, uint256 value);
    event PolicyPurchased(uint256 indexed policyId, address indexed policyholder, uint256 premium, uint256 payout);
    event PolicyTriggered(uint256 indexed policyId);
    event PayoutExecuted(uint256 indexed policyId, address indexed to, uint256 amount);
    event PolicyCancelled(uint256 indexed policyId);

    /// @notice Sets up the policy contract with treasury integration
    /// @param initialOwner Address of the contract owner
    /// @param treasuryAddress Address of the treasury contract
    constructor(address initialOwner, ITreasury treasuryAddress) Ownable(initialOwner) {
        require(address(treasuryAddress) != address(0), "Treasury required");
        treasury = treasuryAddress;
        maxPayout = type(uint256).max;
    }

    /// @notice Sets the oracle address for policy triggers
    /// @param oracleAddress Address of the oracle contract
    function setOracle(address oracleAddress) external onlyOwner {
        if (oracleAddress == address(0)) revert InvalidOracle();
        oracle = oracleAddress;
    }

    /// @notice Sets maximum allowed payout per policy
    /// @param newMax New maximum payout amount
    function setMaxPayout(uint256 newMax) external onlyOwner {
        require(newMax > 0, "maxPayout=0");
        maxPayout = newMax;
    }

    /// @notice Pauses the contract
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpauses the contract
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Purchases a new parametric insurance policy
    /// @param payout Amount to be paid if policy is triggered
    /// @param threshold Condition that triggers the policy (e.g., rainfall amount)
    function buyPolicy(uint256 payout, uint256 threshold) external payable whenNotPaused {
        if (msg.value == 0) revert PremiumRequired();
        if (payout == 0) revert PayoutRequired();
        if (payout > maxPayout) revert PayoutExceedsMax();

        uint256 policyId = nextPolicyId;
        policies[policyId] = PolicyData({
            id: policyId,
            policyholder: msg.sender,
            premium: msg.value,
            payout: payout,
            threshold: threshold,
            active: true,
            triggered: false
        });

        userPolicyIds[msg.sender].push(policyId);
        nextPolicyId += 1;

        // CEI: Effects done, now interactions
        treasury.deposit{value: msg.value}();
        treasury.increaseReserve(payout);

        emit PolicyPurchased(policyId, msg.sender, msg.value, payout);
    }

    /// @notice Requests an oracle check for policy trigger conditions
    /// @param policyId ID of the policy to check
    /// @return requestId Oracle request identifier
    function requestTriggerCheck(uint256 policyId) 
        external 
        onlyOwner 
        returns (bytes32 requestId) 
    {
        if (policies[policyId].policyholder == address(0)) revert PolicyNotFound();
        
        // Generate a request ID
        requestId = keccak256(abi.encodePacked(block.timestamp, policyId, msg.sender));
        requestToPolicy[requestId] = policyId;
        
        emit OracleRequested(policyId, requestId);
    }

    /// @notice Triggers a policy manually (owner/oracle only)
    /// @param policyId ID of the policy to trigger
    function triggerPolicy(uint256 policyId) external {
        if (msg.sender != owner() && msg.sender != oracle) revert NotAuthorized();
        PolicyData storage p = policies[policyId];
        if (p.policyholder == address(0)) revert PolicyNotFound();
        if (!p.active) revert NotActive();
        if (p.triggered) revert AlreadyTriggered();

        p.triggered = true;
        emit PolicyTriggered(policyId);

        executePayout(policyId);
    }

    /// @notice Oracle callback for fulfilling requests
    /// @param requestId Oracle request identifier
    /// @param value Data returned by the oracle
    function fulfill(bytes32 requestId, uint256 value) external {
        if (msg.sender != oracle) revert NotAuthorized();
        
        uint256 policyId = requestToPolicy[requestId];
        if (policies[policyId].policyholder == address(0)) revert PolicyNotFound();
        if (payoutExecuted[policyId]) revert AlreadyPaid();
        
        emit OracleFulfilled(requestId, value);

        if (value >= policies[policyId].threshold) {
            policies[policyId].triggered = true;
            emit PolicyTriggered(policyId);
            executePayout(policyId);
        }
        delete requestToPolicy[requestId];
    }

    /// @notice Internal function to execute policy payout
    /// @param policyId ID of the policy to pay out
    function executePayout(uint256 policyId) internal nonReentrant {
        PolicyData storage p = policies[policyId];
        if (p.policyholder == address(0)) revert PolicyNotFound();
        if (!(p.active && p.triggered)) revert NotActive();
        if (payoutExecuted[policyId]) revert AlreadyPaid();

        if (treasury.getBalance() < p.payout) revert InsufficientFunds();

        // CEI Pattern
        p.active = false;
        payoutExecuted[policyId] = true;

        // Interactions last
        treasury.decreaseReserve(p.payout);
        treasury.transferOut(p.policyholder, p.payout);

        emit PayoutExecuted(policyId, p.policyholder, p.payout);
    }

    /// @notice Allow owner to terminate a policy and release reserved funds
    /// @param policyId ID of the policy to terminate
    function terminatePolicy(uint256 policyId) external onlyOwner {
        PolicyData storage p = policies[policyId];
        if (p.policyholder == address(0)) revert PolicyNotFound();
        if (!p.active) revert NotActive();
        if (p.triggered) revert AlreadyTriggered();

        p.active = false;
        treasury.decreaseReserve(p.payout);

        emit PolicyCancelled(policyId);
    }

    /// @notice Gets all policies owned by a user
    /// @param user Address of the policyholder
    /// @return Array of policy data
    function getPoliciesByUser(address user) external view returns (PolicyData[] memory) {
        uint256[] storage ids = userPolicyIds[user];
        uint256 len = ids.length;
        PolicyData[] memory result = new PolicyData[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = policies[ids[i]];
        }
        return result;
    }
}