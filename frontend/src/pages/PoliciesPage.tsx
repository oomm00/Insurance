import React, { useEffect, useMemo, useState } from "react";
import { PolicyService } from "../services/PolicyService";
import { ethers } from "ethers";

type UiPolicy = {
  id: string;
  premium: string;
  payout: string;
  threshold: string;
  active: boolean;
  triggered: boolean;
};

export const PoliciesPage: React.FC = () => {
  const [svc, setSvc] = useState<PolicyService | null>(null);
  const [address, setAddress] = useState<string>("");
  const [policies, setPolicies] = useState<UiPolicy[]>([]);
  const [pendingTx, setPendingTx] = useState<string>("");
  const [lastEvent, setLastEvent] = useState<string>("");
  const [payoutEth, setPayoutEth] = useState<string>("0.5");
  const [threshold, setThreshold] = useState<string>("100");
  const [premiumEth, setPremiumEth] = useState<string>("1");
  const explorer = import.meta.env.VITE_EXPLORER_BASE as string | undefined;

  useEffect(() => {
    (async () => {
      const instance = new PolicyService();
      await instance.connect();
      setSvc(instance);
      const me = await instance.getUserAddress();
      setAddress(me);
      await refresh(instance, me);
      const off = instance.onEvents((evt) => {
        setLastEvent(`${evt.type} ${JSON.stringify(evt.data)}`);
        refresh(instance, me);
      });
      return () => off();
    })().catch(console.error);
  }, []);

  const refresh = async (instance: PolicyService, me: string) => {
    const list = await instance.getPoliciesByUser(me);
    setPolicies(
      list.map((p) => ({
        id: p.id.toString(),
        premium: ethers.formatEther(p.premium),
        payout: ethers.formatEther(p.payout),
        threshold: p.threshold.toString(),
        active: p.active,
        triggered: p.triggered
      }))
    );
  };

  const onBuy = async () => {
    if (!svc) return;
    setPendingTx("");
    try {
      const payoutWei = ethers.parseEther(payoutEth);
      const premiumWei = ethers.parseEther(premiumEth);
      const txHash = await svc.buyPolicy(payoutWei, parseInt(threshold, 10), premiumWei, (h) => setPendingTx(h));
      if (txHash) setPendingTx(txHash);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  };

  const onDevTrigger = async (policyId: string) => {
    if (!svc) return;
    try {
      const txh = await svc.devTrigger(parseInt(policyId, 10));
      setPendingTx(txh);
    } catch (e: any) {
      alert(e?.message ?? String(e));
    }
  };

  const txLink = useMemo(() => {
    if (!pendingTx || !explorer) return pendingTx;
    return `${explorer}/tx/${pendingTx}`;
  }, [pendingTx, explorer]);

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <strong>Connected:</strong> {address}
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <input value={payoutEth} onChange={(e) => setPayoutEth(e.target.value)} placeholder="Payout (ETH)" />
        <input value={threshold} onChange={(e) => setThreshold(e.target.value)} placeholder="Threshold" />
        <input value={premiumEth} onChange={(e) => setPremiumEth(e.target.value)} placeholder="Premium (ETH)" />
        <button onClick={onBuy}>Buy Policy</button>
      </div>

      {pendingTx && (
        <div style={{ marginBottom: 12 }}>
          <strong>Pending/Last Tx:</strong>{" "}
          {explorer ? (
            <a href={txLink} target="_blank" rel="noreferrer">
              {pendingTx}
            </a>
          ) : (
            pendingTx
          )}
        </div>
      )}

      {lastEvent && (
        <div style={{ marginBottom: 12 }}>
          <strong>Last Event:</strong> {lastEvent}
        </div>
      )}

      <h3>Your Policies</h3>
      <table cellPadding={6} style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th>ID</th>
            <th>Premium</th>
            <th>Payout</th>
            <th>Threshold</th>
            <th>Active</th>
            <th>Triggered</th>
            <th>Dev</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.premium} ETH</td>
              <td>{p.payout} ETH</td>
              <td>{p.threshold}</td>
              <td>{p.active ? "Yes" : "No"}</td>
              <td>{p.triggered ? "Yes" : "No"}</td>
              <td>
                <button onClick={() => onDevTrigger(p.id)}>Trigger (Dev)</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

