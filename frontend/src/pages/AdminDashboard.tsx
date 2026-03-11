import React, { useEffect, useState } from "react";

export const AdminDashboard: React.FC = () => {
  const [policies, setPolicies] = useState<any[]>([]);
  const [status, setStatus] = useState<string>("");
  const [adminHeader, setAdminHeader] = useState<string>(process.env.VITE_ADMIN_ADDR || "");

  async function load() {
    setStatus("Loading...");
    try {
      const res = await fetch(`${process.env.VITE_BACKEND_URL || 'http://localhost:3001'}/policies`, {
        headers: { 'Content-Type': 'application/json' }
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      setPolicies(data);
      setStatus('Loaded');
    } catch (e: any) {
      setStatus('Error: ' + (e.message || e));
    }
  }

  useEffect(() => { load(); }, []);

  async function terminate(policyId: number) {
    setStatus('Terminating ' + policyId);
    try {
      const res = await fetch(`${process.env.VITE_BACKEND_URL || 'http://localhost:3001'}/terminate/${policyId}`, {
        method: 'POST',
        headers: { 'x-admin': adminHeader }
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setStatus('Terminated: ' + j.txHash);
      load();
    } catch (e: any) { setStatus('Error: ' + (e.message || e)); }
  }

  async function trigger(policyId: number) {
    setStatus('Triggering ' + policyId);
    try {
      const res = await fetch(`${process.env.VITE_BACKEND_URL || 'http://localhost:3001'}/trigger/${policyId}`, {
        method: 'POST',
        headers: { 'x-admin': adminHeader }
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'failed');
      setStatus('Triggered: ' + j.txHash);
      load();
    } catch (e: any) { setStatus('Error: ' + (e.message || e)); }
  }

  return (
    <div>
      <h3>Admin Dashboard</h3>
      <div style={{ marginBottom: 12 }}>
        <label>Admin header (x-admin): </label>
        <input value={adminHeader} onChange={(e)=>setAdminHeader(e.target.value)} style={{width: 400}} />
        <button onClick={load}>Refresh</button>
      </div>
      <div>{status}</div>
      <table cellPadding={8} style={{ borderCollapse: 'collapse', width: '100%' }}>
        <thead>
          <tr>
            <th>ID</th><th>Holder</th><th>Payout</th><th>Premium</th><th>Triggered</th><th>Active</th><th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {policies.map((p:any) => (
            <tr key={p.policyId}>
              <td>{p.policyId}</td>
              <td>{p.policyholder || p.holder}</td>
              <td>{p.payout}</td>
              <td>{p.premium}</td>
              <td>{String(p.triggered)}</td>
              <td>{String(p.active)}</td>
              <td>
                <button onClick={()=>terminate(p.policyId)}>Terminate</button>
                <button onClick={()=>trigger(p.policyId)}>Trigger</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
