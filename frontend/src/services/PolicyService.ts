import { ethers } from "ethers";
import PolicyAbi from "../abi/Policy.abi.json";
import TreasuryAbi from "../abi/Treasury.abi.json";
import MockOracleAbi from "../abi/MockOracle.abi.json";

type PolicyStruct = {
  id: bigint;
  policyholder: string;
  premium: bigint;
  payout: bigint;
  threshold: bigint;
  active: boolean;
  triggered: boolean;
};

export class PolicyService {
  provider: ethers.BrowserProvider;
  signer: ethers.Signer | null = null;
  policy: ethers.Contract | null = null;
  treasury: ethers.Contract | null = null;
  mockOracle: ethers.Contract | null = null;

  constructor() {
    if (!window.ethereum) {
      throw new Error("No injected wallet found");
    }
    this.provider = new ethers.BrowserProvider(window.ethereum as any);
  }

  async connect() {
    await this.provider.send("eth_requestAccounts", []);
    this.signer = await this.provider.getSigner();

    const policyAddress = import.meta.env.VITE_POLICY_ADDRESS as string;
    const treasuryAddress = import.meta.env.VITE_TREASURY_ADDRESS as string;
    const mockOracleAddress = import.meta.env.VITE_MOCK_ORACLE_ADDRESS as string;

    if (!policyAddress || !treasuryAddress) {
      throw new Error("Missing VITE_POLICY_ADDRESS or VITE_TREASURY_ADDRESS");
    }

    this.policy = new ethers.Contract(policyAddress, PolicyAbi as any, this.signer);
    this.treasury = new ethers.Contract(treasuryAddress, TreasuryAbi as any, this.signer);
    if (mockOracleAddress) {
      this.mockOracle = new ethers.Contract(mockOracleAddress, MockOracleAbi as any, this.signer);
    }
  }

  async getUserAddress(): Promise<string> {
    const s = this.signer!;
    return await s.getAddress();
  }

  async getPoliciesByUser(user: string): Promise<PolicyStruct[]> {
    const list = await this.policy!.getPoliciesByUser(user);
    return list as PolicyStruct[];
  }

  async buyPolicy(payoutWei: bigint, threshold: number, premiumWei: bigint, onTx?: (hash: string) => void) {
    const tx = await this.policy!.buyPolicy(payoutWei, threshold, { value: premiumWei });
    onTx?.(tx.hash);
    const rcpt = await tx.wait();
    return rcpt?.hash;
  }

  onEvents(update: (evt: { type: string; data: any }) => void) {
    this.policy!.on("PolicyPurchased", (policyId, policyholder, premium, payout) => {
      update({ type: "PolicyPurchased", data: { policyId, policyholder, premium, payout } });
    });
    this.policy!.on("PolicyTriggered", (policyId) => {
      update({ type: "PolicyTriggered", data: { policyId } });
    });
    this.policy!.on("PayoutExecuted", (policyId, to, amount) => {
      update({ type: "PayoutExecuted", data: { policyId, to, amount } });
    });
    return () => {
      this.policy!.removeAllListeners();
    };
  }

  async devTrigger(policyId: number) {
    if (!this.mockOracle) throw new Error("MockOracle address not configured");
    const tx = await this.mockOracle.fulfillTrigger(policyId);
    await tx.wait();
    return tx.hash;
  }
}

declare global {
  interface Window {
    ethereum?: any;
  }
}

