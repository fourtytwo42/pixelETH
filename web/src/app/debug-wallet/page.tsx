'use client';

import { useEffect, useState } from 'react';
import { useWeb3 } from '@/components/Web3Provider';

export default function DebugWallet() {
  const { connection, isConnecting, error, connectWallet, disconnectWallet, refreshConnection } = useWeb3();
  const [metamaskState, setMetamaskState] = useState<any>(null);
  const [localStorageData, setLocalStorageData] = useState<string | null>(null);

  useEffect(() => {
    // Check actual MetaMask state
    const checkMetaMask = async () => {
      if (typeof window !== 'undefined' && window.ethereum) {
        try {
          const accounts = await window.ethereum.request({ method: 'eth_accounts' });
          const chainId = await window.ethereum.request({ method: 'eth_chainId' });
          setMetamaskState({
            accounts,
            chainId,
            isConnected: accounts.length > 0,
            provider: !!window.ethereum
          });
        } catch (error) {
          setMetamaskState({ error: error.message });
        }
      } else {
        setMetamaskState({ error: 'MetaMask not found' });
      }
    };

    // Check localStorage
    const checkLocalStorage = () => {
      const data = localStorage.getItem('pixeleth.wallet.connection');
      setLocalStorageData(data);
    };

    checkMetaMask();
    checkLocalStorage();

    // Update every 2 seconds
    const interval = setInterval(() => {
      checkMetaMask();
      checkLocalStorage();
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const clearCache = () => {
    localStorage.removeItem('pixeleth.wallet.connection');
    setLocalStorageData(null);
    window.location.reload();
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 Wallet Debug Page</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Frontend State */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Frontend Connection State</h2>
          <div className="space-y-2">
            <p><strong>Connected:</strong> {connection ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Connecting:</strong> {isConnecting ? '⏳ Yes' : '❌ No'}</p>
            <p><strong>Error:</strong> {error || 'None'}</p>
            {connection && (
              <>
                <p><strong>Address:</strong> {connection.address}</p>
                <p><strong>Chain ID:</strong> {connection.chainId}</p>
                <p><strong>Type:</strong> {connection.type}</p>
              </>
            )}
          </div>
        </div>

        {/* MetaMask State */}
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actual MetaMask State</h2>
          <div className="space-y-2">
            {metamaskState ? (
              metamaskState.error ? (
                <p className="text-red-600"><strong>Error:</strong> {metamaskState.error}</p>
              ) : (
                <>
                  <p><strong>Provider:</strong> {metamaskState.provider ? '✅ Available' : '❌ Not found'}</p>
                  <p><strong>Connected:</strong> {metamaskState.isConnected ? '✅ Yes' : '❌ No'}</p>
                  <p><strong>Accounts:</strong> {metamaskState.accounts?.length > 0 ? metamaskState.accounts[0] : 'None'}</p>
                  <p><strong>Chain ID:</strong> {metamaskState.chainId || 'Unknown'}</p>
                </>
              )
            ) : (
              <p>Loading...</p>
            )}
          </div>
        </div>

        {/* LocalStorage State */}
        <div className="bg-green-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Cached Data (localStorage)</h2>
          <div className="space-y-2">
            <p><strong>Cached Connection:</strong></p>
            <pre className="bg-gray-100 p-2 rounded text-sm overflow-auto">
              {localStorageData || 'None'}
            </pre>
          </div>
        </div>

        {/* Actions */}
        <div className="bg-yellow-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Actions</h2>
          <div className="space-y-3">
            <button 
              onClick={() => connectWallet('metamask')}
              disabled={isConnecting}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isConnecting ? 'Connecting...' : 'Connect MetaMask'}
            </button>
            
            <button 
              onClick={disconnectWallet}
              className="w-full bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600"
            >
              Disconnect Wallet
            </button>
            
            <button 
              onClick={refreshConnection}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Refresh Connection
            </button>
            
            <button 
              onClick={clearCache}
              className="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      </div>

      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">🔧 Troubleshooting Guide</h2>
        <div className="space-y-2 text-sm">
          <p><strong>If states don't match:</strong></p>
          <ol className="list-decimal list-inside space-y-1 ml-4">
            <li>Click "Clear Cache & Reload" to reset everything</li>
            <li>In MetaMask: Settings → Advanced → Reset Account</li>
            <li>Make sure MetaMask is on "Localhost 8545" network (Chain ID 31337)</li>
            <li>Click "Connect MetaMask" again</li>
          </ol>
          
          <p className="mt-4"><strong>Expected state after fixing:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Frontend Connected: ✅ Yes</li>
            <li>MetaMask Connected: ✅ Yes</li>
            <li>Same address in both</li>
            <li>Chain ID: 31337</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
