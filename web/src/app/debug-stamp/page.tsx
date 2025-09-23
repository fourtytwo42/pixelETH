'use client';

import { useState, useEffect } from 'react';
import { useWeb3 } from '@/components/Web3Provider';
import { getPixelCanvasContract } from '@/lib/web3';
import { StampData, calculateStampBatches } from '@/lib/imageProcessing';

export default function DebugStamp() {
  const { connection } = useWeb3();
  const [canvasInfo, setCanvasInfo] = useState<any>(null);
  const [testStamp, setTestStamp] = useState<any>(null);
  const [testResults, setTestResults] = useState<string[]>([]);

  const addLog = (message: string) => {
    setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${message}`]);
  };

  useEffect(() => {
    const loadCanvasInfo = async () => {
      if (!connection) return;
      
      try {
        const contract = getPixelCanvasContract(connection);
        const width = await contract.width();
        const height = await contract.height();
        const basePrice = await contract.basePrice();
        
        setCanvasInfo({ width: Number(width), height: Number(height), basePrice });
        addLog(`Canvas loaded: ${Number(width)}x${Number(height)}, base price: ${Number(basePrice) / 1e18} ETH`);
      } catch (error) {
        addLog(`Error loading canvas: ${error}`);
      }
    };

    loadCanvasInfo();
  }, [connection]);

  const createTestStamp = () => {
    const testStampData = {
      id: 'test',
      name: 'Test Stamp',
      processedImage: {
        width: 10,
        height: 10,
        pixels: Array(10).fill(null).map(() => 
          Array(10).fill(0xFF0000) // Red pixels
        ),
        originalWidth: 100,
        originalHeight: 100
      },
      previewUrl: '',
      totalPixels: 100
    };
    
    setTestStamp(testStampData);
    addLog('Created test stamp: 10x10 red pixels');
  };

  const testStampBatches = () => {
    if (!testStamp || !canvasInfo) {
      addLog('❌ Missing test stamp or canvas info');
      return;
    }

    try {
      const batches = calculateStampBatches(
        testStamp.processedImage,
        100, // startX
        100, // startY
        canvasInfo.width,
        canvasInfo.height,
        0, // team
        900 // maxBatchSize
      );

      addLog(`✅ Generated ${batches.length} batches`);
      
      batches.forEach((batch, i) => {
        addLog(`  Batch ${i + 1}: ${batch.pixelIds.length} pixels`);
      });

      if (batches.length === 0) {
        addLog('❌ No batches generated - check bounds');
      }

    } catch (error) {
      addLog(`❌ Error calculating batches: ${error}`);
    }
  };

  const testQuotePrice = async () => {
    if (!connection || !canvasInfo) {
      addLog('❌ Missing connection or canvas info');
      return;
    }

    try {
      const contract = getPixelCanvasContract(connection);
      const price = await contract.quotePrice(0, 0);
      addLog(`✅ Quote price for pixel 0: ${Number(price) / 1e18} ETH`);
    } catch (error) {
      addLog(`❌ Error getting quote price: ${error}`);
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="text-3xl font-bold mb-8">🔍 Stamp Debug Tool</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Status</h2>
          <div className="space-y-2">
            <p><strong>Connected:</strong> {connection ? '✅ Yes' : '❌ No'}</p>
            <p><strong>Canvas Info:</strong> {canvasInfo ? '✅ Loaded' : '❌ Missing'}</p>
            <p><strong>Test Stamp:</strong> {testStamp ? '✅ Created' : '❌ Not created'}</p>
          </div>
          
          {canvasInfo && (
            <div className="mt-4 p-3 bg-gray-50 rounded">
              <p><strong>Canvas:</strong> {canvasInfo.width}x{canvasInfo.height}</p>
              <p><strong>Base Price:</strong> {(canvasInfo.basePrice / 1e18).toFixed(6)} ETH</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="bg-blue-50 p-6 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-4">Test Actions</h2>
          <div className="space-y-3">
            <button 
              onClick={createTestStamp}
              className="w-full bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600"
            >
              Create Test Stamp
            </button>
            
            <button 
              onClick={testStampBatches}
              className="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600"
            >
              Test Batch Calculation
            </button>
            
            <button 
              onClick={testQuotePrice}
              className="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600"
            >
              Test Quote Price
            </button>
          </div>
        </div>
      </div>

      {/* Logs */}
      <div className="mt-8 bg-gray-50 p-6 rounded-lg">
        <h2 className="text-xl font-semibold mb-4">Debug Logs</h2>
        <div className="max-h-64 overflow-y-auto bg-black text-green-400 p-4 rounded font-mono text-sm">
          {testResults.length === 0 ? (
            <div className="text-gray-500">No logs yet...</div>
          ) : (
            testResults.map((log, i) => (
              <div key={i} className="mb-1">{log}</div>
            ))
          )}
        </div>
        <button 
          onClick={() => setTestResults([])}
          className="mt-2 px-3 py-1 bg-gray-500 text-white rounded text-sm hover:bg-gray-600"
        >
          Clear Logs
        </button>
      </div>
    </div>
  );
}
