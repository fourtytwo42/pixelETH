'use client';

import React, { useState } from 'react';
import { useWeb3 } from './Web3Provider';
import { HARDHAT_ACCOUNTS, connectHardhatLocal } from '@/lib/web3';
import Button from './ui/Button';
import { Card, CardBody } from './ui/Card';
import { ethers } from 'ethers';

export default function HardhatFaucet() {
  const { connection } = useWeb3();
  const [isRequesting, setIsRequesting] = useState(false);
  const [lastRequest, setLastRequest] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Only show faucet for Hardhat network
  if (!connection || connection.chainId !== 31337) {
    return null;
  }

  const requestFaucetETH = async (amount: string) => {
    if (!connection) return;

    setIsRequesting(true);
    setError(null);

    try {
      // Use Account #0 (the deployer account) as the faucet source
      const faucetConnection = await connectHardhatLocal(0);
      
      // Check if requesting from the same account
      if (faucetConnection.address.toLowerCase() === connection.address.toLowerCase()) {
        setError('Cannot send ETH to the same account that is being used as faucet source');
        return;
      }

      // Create transaction to send ETH
      const tx = await faucetConnection.signer.sendTransaction({
        to: connection.address,
        value: ethers.parseEther(amount),
      });

      // Wait for transaction confirmation
      await tx.wait();

      setLastRequest(`Successfully sent ${amount} ETH to ${connection.address}`);
      
      // Dispatch custom event to trigger balance refresh in WalletConnection
      window.dispatchEvent(new CustomEvent('faucet-transaction-complete'));
      
      // Clear success message after 10 seconds
      setTimeout(() => setLastRequest(null), 10000);

    } catch (error: any) {
      console.error('Faucet request failed:', error);
      setError(error.message || 'Failed to request ETH from faucet');
    } finally {
      setIsRequesting(false);
    }
  };

  const clearError = () => setError(null);

  return (
    <Card className="max-w-md">
      <CardBody>
        <div className="flex items-center gap-2 mb-4">
          <div className="text-2xl">🚰</div>
          <h3 className="text-lg font-semibold">Hardhat ETH Faucet</h3>
        </div>
        
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Request test ETH for development on Hardhat Local Network
        </p>

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

        {lastRequest && (
          <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded">
            <p className="text-sm text-green-800 dark:text-green-200">{lastRequest}</p>
          </div>
        )}

        <div className="space-y-3">
          <div className="text-sm">
            <p className="font-medium mb-2">Quick Amounts:</p>
            <div className="grid grid-cols-2 gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestFaucetETH('1')}
                disabled={isRequesting}
                className="w-full"
              >
                {isRequesting ? '...' : '1 ETH'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestFaucetETH('5')}
                disabled={isRequesting}
                className="w-full"
              >
                {isRequesting ? '...' : '5 ETH'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestFaucetETH('10')}
                disabled={isRequesting}
                className="w-full"
              >
                {isRequesting ? '...' : '10 ETH'}
              </Button>
              <Button
                size="sm"
                variant="secondary"
                onClick={() => requestFaucetETH('100')}
                disabled={isRequesting}
                className="w-full"
              >
                {isRequesting ? '...' : '100 ETH'}
              </Button>
            </div>
          </div>

          <div className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 p-3 rounded">
            <div className="space-y-1">
              <div className="font-medium">Faucet Info:</div>
              <div>• Source: Account #0 (Deployer)</div>
              <div>• Address: {HARDHAT_ACCOUNTS[0].address.slice(0, 10)}...{HARDHAT_ACCOUNTS[0].address.slice(-8)}</div>
              <div>• Network: Hardhat Local (31337)</div>
              <div>• Free test ETH for development</div>
            </div>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}
