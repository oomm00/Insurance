require('dotenv').config();
const { ethers } = require('ethers');
const path = require('path');

// Prefer ABIs copied to frontend/src/abi; fallback to artifacts
let PolicyAbi; let MockOracleAbi; let TreasuryAbi;
try {
  PolicyAbi = require(path.join(__dirname, '..', 'frontend', 'src', 'abi', 'Policy.abi.json'));
  MockOracleAbi = require(path.join(__dirname, '..', 'frontend', 'src', 'abi', 'MockOracle.abi.json'));
  TreasuryAbi = require(path.join(__dirname, '..', 'frontend', 'src', 'abi', 'Treasury.abi.json'));
} catch (e) {
  // fallback to artifacts
  PolicyAbi = require(path.join(__dirname, '..', 'artifacts', 'contracts', 'Policy.sol', 'Policy.json')).abi;
  MockOracleAbi = require(path.join(__dirname, '..', 'artifacts', 'contracts', 'MockOracle.sol', 'MockOracle.json')).abi;
  TreasuryAbi = require(path.join(__dirname, '..', 'artifacts', 'contracts', 'Treasury.sol', 'Treasury.json')).abi;
}

const RPC = process.env.RPC_URL || 'http://localhost:8545';
const PK = process.env.PRIVATE_KEY || '';
const provider = new ethers.JsonRpcProvider(RPC);
let wallet = provider;
if (PK && PK.length > 0) {
  wallet = new ethers.Wallet(PK, provider);
}

const policyAddr = process.env.POLICY_ADDRESS;
const mockAddr = process.env.MOCK_ORACLE_ADDRESS;
const treasuryAddr = process.env.TREASURY_ADDRESS;

if (!policyAddr) console.warn('POLICY_ADDRESS not set in backend .env');

const policy = new ethers.Contract(policyAddr, PolicyAbi, wallet);
const mockOracle = mockAddr ? new ethers.Contract(mockAddr, MockOracleAbi, wallet) : null;
const treasury = treasuryAddr ? new ethers.Contract(treasuryAddr, TreasuryAbi, wallet) : null;

async function getAllPolicies() {
  // Try to call a helper on-chain; otherwise attempt naive enumeration
  try {
    if (policy.getPoliciesCount) {
      const count = Number(await policy.getPoliciesCount());
      const out = [];
      for (let i = 0; i < count; i++) {
        const p = await policy.policies(i);
        out.push(normalizePolicyStruct(i, p));
      }
      return out;
    }
  } catch (e) { /* ignore */ }

  // fallback: attempt to iterate until failure (may be expensive)
  const out = [];
  try {
    const nextId = Number(await policy.nextPolicyId());
    for (let i = 0; i < nextId; i++) {
      try {
        const p = await policy.policies(i);
        out.push(normalizePolicyStruct(i, p));
      } catch (err) { /* skip missing */ }
    }
  } catch (e) {
    console.warn('Failed to enumerate policies:', e.message);
  }
  return out;
}

function normalizePolicyStruct(id, p) {
  // p is PolicyData struct
  return {
    policyId: Number(id),
    policyholder: p.policyholder || p.policyHolder || p.holder || null,
    premium: p.premium?.toString ? p.premium.toString() : (p.premium || '0'),
    payout: p.payout?.toString ? p.payout.toString() : (p.payout || '0'),
    threshold: p.threshold?.toString ? p.threshold.toString() : (p.threshold || '0'),
    active: p.active === undefined ? true : p.active,
    triggered: p.triggered === undefined ? false : p.triggered
  };
}

async function getPoliciesByUser(address) {
  try {
    if (policy.getPoliciesByUser) {
      const rows = await policy.getPoliciesByUser(address);
      return rows.map((r, idx) => normalizePolicyStruct(idx, r));
    }
  } catch (e) { /* fallback */ }
  const all = await getAllPolicies();
  return all.filter(p => p.policyholder && p.policyholder.toLowerCase() === address.toLowerCase());
}

async function terminatePolicy(policyId) {
  if (!wallet.getAddress) throw new Error('No signer available for writes');
  if (!policy.terminatePolicy) throw new Error('terminatePolicy not available in contract');
  const tx = await policy.terminatePolicy(policyId);
  return tx;
}

async function triggerPolicy(policyId) {
  // If mockOracle exists, call it; otherwise attempt to call Policy.triggerPolicy as owner
  if (mockOracle && mockOracle.fulfillTrigger) {
    const tx = await mockOracle.fulfillTrigger(policyId);
    return tx;
  }
  if (policy.triggerPolicy) {
    const tx = await policy.triggerPolicy(policyId);
    return tx;
  }
  throw new Error('No trigger method available');
}

async function payoutPolicy(policyId) {
  // For demo, payout via triggerPolicy
  return triggerPolicy(policyId);
}

module.exports = { getAllPolicies, getPoliciesByUser, terminatePolicy, triggerPolicy, payoutPolicy };
