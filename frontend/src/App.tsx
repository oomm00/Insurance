import React from "react";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { PoliciesPage } from "./pages/PoliciesPage";
import { AdminDashboard } from "./pages/AdminDashboard";
import { WalletProvider } from "./hooks/useWallet";
import { ConnectWallet } from "./components/ConnectWallet";

export const App: React.FC = () => {
  return (
    <WalletProvider>
      <BrowserRouter>
        <div style={{ padding: 16, fontFamily: "Inter, system-ui, Arial" }}>
          <header style={{ display: "flex", gap: 12, marginBottom: 12, alignItems: "center" }}>
            <h2 style={{ margin: 0 }}>Parametric Insurance</h2>
            <nav style={{ flex: 1 }}>
              <Link to="/">Buy & My Policies</Link> | <Link to="/admin">Admin</Link>
            </nav>
            <ConnectWallet />
          </header>
          <main>
            <Routes>
              <Route path="/" element={<PoliciesPage />} />
              <Route path="/admin" element={<AdminDashboard />} />
            </Routes>
          </main>
        </div>
      </BrowserRouter>
    </WalletProvider>
  );
};

