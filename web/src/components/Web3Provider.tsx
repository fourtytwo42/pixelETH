'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { WalletConnection, WalletType, connectMetaMask, connectHardhatLocal, addHardhatNetworkToMetaMask, switchNetwork, NETWORKS } from '@/lib/web3';

interface Web3ContextType {
  connection: WalletConnection | null;
  isConnecting: boolean;
  error: string | null;
  connectWallet: (type: WalletType, accountIndex?: number) => Promise<void>;
  disconnectWallet: () => void;
  addHardhatNetwork: () => Promise<void>;
  switchToNetwork: (chainId: string) => Promise<void>;
  clearError: () => void;
}

const Web3Context = createContext<Web3ContextType | undefined>(undefined);

export function useWeb3() {
  const context = useContext(Web3Context);
  if (context === undefined) {
    throw new Error('useWeb3 must be used within a Web3Provider');
  }
  return context;
}

interface Web3ProviderProps {
  children: ReactNode;
}

export function Web3Provider({ children }: Web3ProviderProps) {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auto-reconnect logic
  useEffect(() => {
    const savedConnection = localStorage.getItem('pixeleth.wallet.connection');
    if (savedConnection) {
      try {
        const { type, accountIndex } = JSON.parse(savedConnection);
        connectWallet(type, accountIndex);
      } catch (error) {
        console.error('Failed to restore wallet connection:', error);
        localStorage.removeItem('pixeleth.wallet.connection');
      }
    }
  }, []);

  // Listen for MetaMask account changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          disconnectWallet();
        } else if (connection?.type === 'metamask') {
          // Reconnect with new account
          connectWallet('metamask');
        }
      };

      const handleChainChanged = () => {
        if (connection?.type === 'metamask') {
          // Reconnect to update chain info
          connectWallet('metamask');
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, [connection]);

  const connectWallet = async (type: WalletType, accountIndex: number = 0) => {
    setIsConnecting(true);
    setError(null);

    try {
      let newConnection: WalletConnection;

      if (type === 'metamask') {
        newConnection = await connectMetaMask();
      } else if (type === 'hardhat-local') {
        newConnection = await connectHardhatLocal(accountIndex);
      } else {
        throw new Error(`Unsupported wallet type: ${type}`);
      }

      setConnection(newConnection);
      
      // Save connection preference
      localStorage.setItem('pixeleth.wallet.connection', JSON.stringify({ type, accountIndex }));
      
      console.log('Wallet connected:', {
        address: newConnection.address,
        chainId: newConnection.chainId,
        type: newConnection.type,
      });

    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    setConnection(null);
    setError(null);
    localStorage.removeItem('pixeleth.wallet.connection');
    console.log('Wallet disconnected');
  };

  const addHardhatNetwork = async () => {
    setError(null);
    try {
      await addHardhatNetworkToMetaMask();
    } catch (err: any) {
      console.error('Failed to add Hardhat network:', err);
      setError(err.message || 'Failed to add Hardhat network');
    }
  };

  const switchToNetwork = async (chainId: string) => {
    setError(null);
    try {
      await switchNetwork(chainId);
    } catch (err: any) {
      console.error('Failed to switch network:', err);
      setError(err.message || 'Failed to switch network');
    }
  };

  const clearError = () => {
    setError(null);
  };

  const value: Web3ContextType = {
    connection,
    isConnecting,
    error,
    connectWallet,
    disconnectWallet,
    addHardhatNetwork,
    switchToNetwork,
    clearError,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export default Web3Provider;
