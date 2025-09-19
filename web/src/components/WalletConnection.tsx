'use client';

import React, { useState, useEffect } from 'react';
import { useWeb3 } from './Web3Provider';
import { HARDHAT_ACCOUNTS, NETWORKS, getProvider, formatEther } from '@/lib/web3';
import Button from './ui/Button';
import { Card, CardBody } from './ui/Card';

export default function WalletConnection() {
  const { connection, isConnecting, error, connectWallet, disconnectWallet, addHardhatNetwork, switchToNetwork, clearError } = useWeb3();
  const [selectedHardhatAccount, setSelectedHardhatAccount] = useState(0);
  const [showAccountSelector, setShowAccountSelector] = useState(false);
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);

  // Fetch balance when connected
  useEffect(() => {
    const fetchBalance = async () => {
      if (!connection) {
        setBalance(null);
        return;
      }

      setIsLoadingBalance(true);
      try {
        const provider = getProvider(connection);
        const balanceBigInt = await provider.getBalance(connection.address);
        const balanceFormatted = formatEther(balanceBigInt);
        setBalance(balanceFormatted);
      } catch (error) {
        console.error('Failed to fetch balance:', error);
        setBalance('Error');
      } finally {
        setIsLoadingBalance(false);
      }
    };

    fetchBalance();
  }, [connection]);

  const handleConnectMetaMask = async () => {
    await connectWallet('metamask');
  };

  const handleConnectHardhat = async () => {
    await connectWallet('hardhat-local', selectedHardhatAccount);
  };

  const handleAddHardhatNetwork = async () => {
    await addHardhatNetwork();
  };

  const handleSwitchToHardhat = async () => {
    await switchToNetwork(NETWORKS.hardhat.chainId);
  };

  const getNetworkName = (chainId: number) => {
    switch (chainId) {
      case 31337: return 'Hardhat Local';
      case 11155111: return 'Sepolia Testnet';
      case 8453: return 'Base Mainnet';
      case 1: return 'Ethereum Mainnet';
      default: return `Unknown (${chainId})`;
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  if (connection) {
    return (
      <Card className="max-w-md">
        <CardBody>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Wallet Connected</h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full"></div>
              <span className="text-sm text-green-600 dark:text-green-400">Connected</span>
            </div>
          </div>
          
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Address</label>
              <p className="font-mono text-sm bg-gray-100 dark:bg-gray-800 p-2 rounded">
                {shortenAddress(connection.address)}
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Network</label>
              <p className="text-sm">
                {getNetworkName(connection.chainId)} ({connection.chainId})
              </p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Wallet Type</label>
              <p className="text-sm capitalize">{connection.type.replace('-', ' ')}</p>
            </div>
            
            <div>
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">Balance</label>
              <p className="text-sm font-mono">
                {isLoadingBalance ? (
                  <span className="text-gray-500">Loading...</span>
                ) : balance ? (
                  <span>{parseFloat(balance).toFixed(4)} ETH</span>
                ) : (
                  <span className="text-red-500">Error</span>
                )}
              </p>
            </div>
          </div>

          {connection.chainId !== 31337 && (
            <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                ⚠️ PixelETH is currently deployed on Hardhat Local Network only.
              </p>
              <Button 
                size="sm" 
                className="mt-2 w-full"
                onClick={handleSwitchToHardhat}
              >
                Switch to Hardhat Network
              </Button>
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <Button 
              variant="secondary" 
              size="sm" 
              onClick={disconnectWallet}
              className="flex-1"
            >
              Disconnect
            </Button>
            {connection.type === 'metamask' && connection.chainId !== 31337 && (
              <Button 
                size="sm" 
                onClick={handleAddHardhatNetwork}
                className="flex-1"
              >
                Add Hardhat Network
              </Button>
            )}
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card className="max-w-md">
      <CardBody>
        <h3 className="text-lg font-semibold mb-4">Connect Wallet</h3>
        
        {error && (
          <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded">
            <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
            <Button 
              size="sm" 
              variant="secondary" 
              onClick={clearError}
              className="mt-2"
            >
              Dismiss
            </Button>
          </div>
        )}

        <div className="space-y-3">
          {/* MetaMask Connection */}
          <div>
            <Button 
              onClick={handleConnectMetaMask}
              disabled={isConnecting}
              className="w-full"
              size="lg"
            >
              {isConnecting ? 'Connecting...' : '🦊 Connect MetaMask'}
            </Button>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Connect using your MetaMask browser extension
            </p>
          </div>

          <div className="text-center text-sm text-gray-500">or</div>

          {/* Hardhat Local Connection */}
          <div>
            <div className="flex gap-2">
              <Button 
                onClick={() => setShowAccountSelector(!showAccountSelector)}
                variant="secondary"
                size="lg"
                className="flex-1"
              >
                🔧 Hardhat Local {showAccountSelector ? '↑' : '↓'}
              </Button>
              {!showAccountSelector && (
                <Button 
                  onClick={handleConnectHardhat}
                  disabled={isConnecting}
                  size="lg"
                >
                  Connect
                </Button>
              )}
            </div>
            
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Use pre-funded Hardhat development accounts
            </p>

            {showAccountSelector && (
              <div className="mt-3 space-y-2">
                <label className="text-sm font-medium">Select Account:</label>
                <div className="space-y-1 max-h-40 overflow-y-auto">
                  {HARDHAT_ACCOUNTS.map((account, index) => (
                    <div 
                      key={account.address}
                      className={`p-2 border rounded cursor-pointer text-sm ${
                        selectedHardhatAccount === index
                          ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => setSelectedHardhatAccount(index)}
                    >
                      <div className="font-mono text-xs">{shortenAddress(account.address)}</div>
                      <div className="text-xs text-gray-600 dark:text-gray-400">{account.name}</div>
                    </div>
                  ))}
                </div>
                <Button 
                  onClick={handleConnectHardhat}
                  disabled={isConnecting}
                  size="sm"
                  className="w-full"
                >
                  {isConnecting ? 'Connecting...' : `Connect Account #${selectedHardhatAccount}`}
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded">
          <p className="text-xs text-blue-800 dark:text-blue-200">
            💡 <strong>For development:</strong> Use Hardhat Local for testing. 
            Add the network to MetaMask to use it with your regular wallet.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}
