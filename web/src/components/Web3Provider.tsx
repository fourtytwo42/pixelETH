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
  refreshConnection: () => Promise<void>;
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
  const [hasInitialized, setHasInitialized] = useState(false);

  // Check actual MetaMask connection state
  const checkMetaMaskConnection = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !window.ethereum) {
      return false;
    }

    try {
      const accounts = await window.ethereum.request({ method: 'eth_accounts' });
      return accounts && accounts.length > 0;
    } catch (error) {
      console.error('Failed to check MetaMask connection:', error);
      return false;
    }
  };

  // Sync with actual MetaMask state
  const syncWithMetaMask = async () => {
    try {
      const isActuallyConnected = await checkMetaMaskConnection();
      const hasStoredConnection = localStorage.getItem('pixeleth.wallet.connection');
      
      // Only log occasionally to reduce spam
      if (Math.random() < 0.1) { // 10% of the time
        console.log('Sync check:', { isActuallyConnected, hasStoredConnection: !!hasStoredConnection, currentConnection: !!connection });
      }
      
      if (!isActuallyConnected && connection) {
        // MetaMask is disconnected but we think it's connected - clear state
        console.log('MetaMask disconnected - clearing cached connection');
        setConnection(null);
        localStorage.removeItem('pixeleth.wallet.connection');
      } else if (isActuallyConnected && !connection && hasStoredConnection) {
        // MetaMask is connected but we don't have state - restore connection
        // Only try to restore if we haven't tried recently
        if (!isConnecting) {
          console.log('MetaMask connected - restoring connection state');
          try {
            const { type, accountIndex } = JSON.parse(hasStoredConnection);
            await connectWallet(type, accountIndex);
          } catch (error) {
            console.error('Failed to restore connection:', error);
            localStorage.removeItem('pixeleth.wallet.connection');
          }
        }
      }
    } catch (error) {
      console.error('Sync error:', error);
    }
  };

  // Initialize only once
  useEffect(() => {
    if (!hasInitialized) {
      console.log('Web3Provider initializing...');
      syncWithMetaMask().finally(() => setHasInitialized(true));
    }
  }, [hasInitialized]);

  // Periodic sync (less frequent)
  useEffect(() => {
    if (!hasInitialized) return;
    
    const syncInterval = setInterval(syncWithMetaMask, 10000); // Every 10 seconds
    return () => clearInterval(syncInterval);
  }, [hasInitialized]);

  // Listen for MetaMask events with better handling
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = async (accounts: string[]) => {
        console.log('MetaMask accounts changed:', accounts);
        
        if (accounts.length === 0) {
          console.log('No accounts - disconnecting');
          disconnectWallet();
        } else if (connection?.type === 'metamask') {
          console.log('Account changed - reconnecting');
          // Account changed, reconnect to get new account info
          try {
            await connectWallet('metamask');
          } catch (error) {
            console.error('Failed to reconnect after account change:', error);
            disconnectWallet();
          }
        }
      };

      const handleChainChanged = async (chainId: string) => {
        console.log('MetaMask chain changed:', chainId);
        
        if (connection?.type === 'metamask') {
          try {
            // Reconnect to update chain info
            await connectWallet('metamask');
          } catch (error) {
            console.error('Failed to reconnect after chain change:', error);
            setError('Network change failed. Please reconnect your wallet.');
          }
        }
      };

      const handleConnect = (connectInfo: any) => {
        console.log('MetaMask connected:', connectInfo);
        syncWithMetaMask();
      };

      const handleDisconnect = (error: any) => {
        console.log('MetaMask disconnected:', error);
        disconnectWallet();
      };

      // Add all event listeners
      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', handleChainChanged);
      window.ethereum.on('connect', handleConnect);
      window.ethereum.on('disconnect', handleDisconnect);

      return () => {
        if (window.ethereum?.removeListener) {
          window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
          window.ethereum.removeListener('chainChanged', handleChainChanged);
          window.ethereum.removeListener('connect', handleConnect);
          window.ethereum.removeListener('disconnect', handleDisconnect);
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
        // Always check if MetaMask is actually available and connected
        if (typeof window === 'undefined' || !window.ethereum) {
          throw new Error('MetaMask not found. Please install MetaMask.');
        }
        
        newConnection = await connectMetaMask();
        
        // Verify the connection is real
        const isConnected = await checkMetaMaskConnection();
        if (!isConnected) {
          throw new Error('MetaMask connection failed. Please check MetaMask and try again.');
        }
        
      } else if (type === 'hardhat-local') {
        newConnection = await connectHardhatLocal(accountIndex);
      } else {
        throw new Error(`Unsupported wallet type: ${type}`);
      }

      setConnection(newConnection);
      
      // Only save to localStorage if connection is successful
      localStorage.setItem('pixeleth.wallet.connection', JSON.stringify({ type, accountIndex }));
      
      console.log('Wallet connected:', {
        address: newConnection.address,
        chainId: newConnection.chainId,
        type: newConnection.type,
      });

    } catch (err: any) {
      console.error('Failed to connect wallet:', err);
      setError(err.message || 'Failed to connect wallet');
      // Clear any stale cached data on connection failure
      localStorage.removeItem('pixeleth.wallet.connection');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnectWallet = () => {
    console.log('Disconnecting wallet...');
    setConnection(null);
    setError(null);
    localStorage.removeItem('pixeleth.wallet.connection');
    console.log('Wallet disconnected');
  };

  const refreshConnection = async () => {
    console.log('Manually refreshing connection...');
    await syncWithMetaMask();
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
    refreshConnection,
  };

  return (
    <Web3Context.Provider value={value}>
      {children}
    </Web3Context.Provider>
  );
}

export default Web3Provider;