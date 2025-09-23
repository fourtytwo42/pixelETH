'use client';

import PixelCanvas from '@/components/PixelCanvas';
import { useWeb3 } from '@/components/Web3Provider';
import { useState, useEffect } from 'react';
import { getProvider, formatEther, connectHardhatLocal } from '@/lib/web3';
import { ethers } from 'ethers';

export default function Home() {
  const { connection, isConnecting, connectWallet, disconnectWallet } = useWeb3();
  const [balance, setBalance] = useState<string | null>(null);
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [isRequestingFaucet, setIsRequestingFaucet] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

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

    // Listen for faucet transactions to refresh balance
    const handleFaucetTransaction = () => {
      fetchBalance();
    };

    window.addEventListener('faucet-transaction-complete', handleFaucetTransaction);
    
    return () => {
      window.removeEventListener('faucet-transaction-complete', handleFaucetTransaction);
    };
  }, [connection]);

  const handleConnectMetaMask = async () => {
    await connectWallet('metamask');
  };

  const requestFaucetETH = async () => {
    if (!connection || connection.chainId !== 31337) return;

    setIsRequestingFaucet(true);
    try {
      // Use Account #0 (the deployer account) as the faucet source
      const faucetConnection = await connectHardhatLocal(0);
      
      // Check if requesting from the same account
      if (faucetConnection.address.toLowerCase() === connection.address.toLowerCase()) {
        alert('Cannot send ETH to the same account that is being used as faucet source');
        return;
      }

      // Create transaction to send 5 ETH
      const tx = await faucetConnection.signer.sendTransaction({
        to: connection.address,
        value: ethers.parseEther('5'),
      });

      // Wait for transaction confirmation
      await tx.wait();

      // Trigger balance refresh
      window.dispatchEvent(new CustomEvent('faucet-transaction-complete'));
      
    } catch (error: any) {
      console.error('Faucet request failed:', error);
      alert(error.message || 'Failed to request ETH from faucet');
    } finally {
      setIsRequestingFaucet(false);
    }
  };

  const getNetworkName = (chainId: number) => {
    switch (chainId) {
      case 31337: return 'Hardhat Local';
      case 11155111: return 'Sepolia';
      case 8453: return 'Base';
      default: return `Chain ${chainId}`;
    }
  };

  const shortenAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col">
      {/* Top Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          {/* Left: Logo and Title */}
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
              PixelETH
            </h1>
            
            {/* Stats */}
            <div className="hidden sm:flex items-center gap-4 ml-8">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-red-500 rounded"></div>
                <span className="text-sm font-medium">Red: <span id="red-count">-</span></span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-blue-500 rounded"></div>
                <span className="text-sm font-medium">Blue: <span id="blue-count">-</span></span>
              </div>
            </div>
          </div>

          {/* Right: Wallet and User Info */}
          <div className="flex items-center gap-4">
            {connection ? (
              <>
                {/* Balance */}
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <span className="text-gray-600 dark:text-gray-400">Balance:</span>
                  <span className="font-mono font-medium">
                    {isLoadingBalance ? (
                      'Loading...'
                    ) : balance && balance !== 'Error' ? (
                      `${Number(balance).toFixed(4)} ETH`
                    ) : (
                      'Error'
                    )}
                  </span>
                </div>

                {/* Faucet Button (Hardhat only) */}
                {connection.chainId === 31337 && (
                  <button
                    onClick={requestFaucetETH}
                    disabled={isRequestingFaucet}
                    className="px-3 py-1.5 text-sm bg-green-500 hover:bg-green-600 disabled:opacity-50 text-white rounded-lg transition-colors"
                    title="Get 5 test ETH"
                  >
                    {isRequestingFaucet ? '...' : '🚰 +5 ETH'}
                  </button>
                )}

                {/* User Menu */}
                <div className="relative">
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-2 px-3 py-2 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                    <span className="font-mono text-sm">{shortenAddress(connection.address)}</span>
                    <span className="text-xs text-gray-500">{getNetworkName(connection.chainId)}</span>
                  </button>

                  {showUserMenu && (
                    <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50">
                      <div className="p-4">
                        <div className="space-y-3">
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Address</label>
                            <p className="font-mono text-sm break-all">{connection.address}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Network</label>
                            <p className="text-sm">{getNetworkName(connection.chainId)}</p>
                          </div>
                          <div>
                            <label className="text-xs text-gray-500 dark:text-gray-400">Balance</label>
                            <p className="font-mono text-sm">
                              {isLoadingBalance ? 'Loading...' : balance ? `${Number(balance).toFixed(6)} ETH` : 'Error'}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            disconnectWallet();
                            setShowUserMenu(false);
                          }}
                          className="w-full mt-4 px-3 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors text-sm"
                        >
                          Disconnect
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <button
                onClick={handleConnectMetaMask}
                disabled={isConnecting}
                className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors flex items-center gap-2"
              >
                {isConnecting ? 'Connecting...' : '🦊 Connect MetaMask'}
              </button>
            )}

            {/* How to Play */}
            <div className="relative group">
              <button className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </button>
              <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-50">
                <div className="p-4">
                  <h3 className="font-semibold mb-3">How to Play</h3>
                  <div className="space-y-2 text-sm">
                    <p>🎨 <strong>Click pixels</strong> to buy and paint them</p>
                    <p>⚡ <strong>Choose team:</strong> Red or Blue affects pricing</p>
                    <p>📈 <strong>Prices increase</strong> by 1.5x when resold</p>
                    <p>💰 <strong>Sellers get 90%</strong> back, treasury gets 10%</p>
                    <p>🔄 <strong>Self-buy</strong> to change color/team</p>
                    <p>🏆 <strong>Team balance</strong> affects multiplier pricing</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex flex-col">
        <PixelCanvas />
      </div>

      {/* Click outside to close user menu */}
      {showUserMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
}