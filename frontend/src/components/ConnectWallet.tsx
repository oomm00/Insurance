import React from 'react';
import { useWallet } from '../hooks/useWallet';
import { ethers } from 'ethers';

export const ConnectWallet: React.FC = () => {
  const { address, chainId, isConnecting, error, connect, switchToHardhat } = useWallet();

  const shortenAddress = (addr: string) => {
    return addr.slice(0, 6) + '...' + addr.slice(-4);
  };

  const handleConnect = async () => {
    try {
      await connect();
      // After connection, ensure we're on Hardhat network
      if (chainId !== 31337) {
        await switchToHardhat();
      }
    } catch (err: any) {
      console.error('Connection error:', err);
    }
  };

  const buttonStyle = {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid #ccc',
    backgroundColor: error ? '#ffebee' : '#f5f5f5',
    cursor: 'pointer',
    fontSize: '14px'
  };

  if (error) {
    return <button style={buttonStyle} onClick={handleConnect}>Error: {error}</button>;
  }

  if (isConnecting) {
    return <button style={buttonStyle} disabled>Connecting...</button>;
  }

  if (address) {
    if (chainId !== 31337) {
      return (
        <button style={buttonStyle} onClick={switchToHardhat}>
          Switch to Hardhat Network
        </button>
      );
    }
    return <button style={buttonStyle}>{shortenAddress(address)}</button>;
  }

  return <button style={buttonStyle} onClick={handleConnect}>Connect Wallet</button>;
};