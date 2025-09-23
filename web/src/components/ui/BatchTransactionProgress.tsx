'use client';

import React from 'react';
import { TransactionBatch } from '@/lib/imageProcessing';

interface BatchTransactionProgressProps {
  batches: TransactionBatch[];
  currentBatch: number;
  isProcessing: boolean;
  completedBatches: Set<number>;
  onExecuteBatch: (batchIndex: number) => Promise<void>;
  onCancel: () => void;
  totalCost: string;
}

export default function BatchTransactionProgress({
  batches,
  currentBatch,
  isProcessing,
  completedBatches,
  onExecuteBatch,
  onCancel,
  totalCost
}: BatchTransactionProgressProps) {
  
  if (batches.length === 0) return null;
  
  const isCompleted = completedBatches.size === batches.length;
  const progress = (completedBatches.size / batches.length) * 100;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {isCompleted ? '🎉 Stamp Applied!' : '🎨 Applying Stamp'}
          </h3>
          
          {!isProcessing && (
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600"
              title="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-600 mb-1">
            <span>Progress</span>
            <span>{completedBatches.size}/{batches.length} batches</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            ></div>
          </div>
        </div>
        
        {/* Total cost */}
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <div className="text-sm text-gray-600">Total Cost</div>
          <div className="text-lg font-semibold">{totalCost} ETH</div>
        </div>
        
        {/* Batch list */}
        <div className="max-h-48 overflow-y-auto mb-4">
          <div className="space-y-2">
            {batches.map((batch, index) => {
              const isCompleted = completedBatches.has(index);
              const isCurrent = currentBatch === index;
              const isNext = !isCompleted && completedBatches.size === index;
              
              return (
                <div
                  key={batch.batchIndex}
                  className={`
                    flex items-center justify-between p-2 rounded border
                    ${isCompleted ? 'bg-green-50 border-green-200' : 
                      isCurrent ? 'bg-blue-50 border-blue-200' :
                      isNext ? 'bg-yellow-50 border-yellow-200' :
                      'bg-gray-50 border-gray-200'}
                  `}
                >
                  <div className="flex items-center space-x-2">
                    <div className={`
                      w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium
                      ${isCompleted ? 'bg-green-500 text-white' :
                        isCurrent ? 'bg-blue-500 text-white' :
                        isNext ? 'bg-yellow-500 text-white' :
                        'bg-gray-300 text-gray-600'}
                    `}>
                      {isCompleted ? '✓' : 
                       isCurrent && isProcessing ? (
                         <svg className="animate-spin w-3 h-3" fill="none" viewBox="0 0 24 24">
                           <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                           <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                         </svg>
                       ) : batch.batchIndex}
                    </div>
                    
                    <div>
                      <div className="text-sm font-medium">{batch.description}</div>
                      <div className="text-xs text-gray-500">{batch.pixelIds.length} pixels</div>
                    </div>
                  </div>
                  
                  {isNext && !isProcessing && (
                    <button
                      onClick={() => onExecuteBatch(index)}
                      className="px-3 py-1 bg-blue-500 text-white text-xs rounded hover:bg-blue-600"
                    >
                      Execute
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        
        {/* Action buttons */}
        <div className="flex justify-end space-x-2">
          {isCompleted ? (
            <button
              onClick={onCancel}
              className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onCancel}
                disabled={isProcessing}
                className="px-4 py-2 border border-gray-300 text-gray-700 rounded hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              
              {/* Auto-execute next button */}
              {!isProcessing && completedBatches.size < batches.length && (
                <button
                  onClick={() => onExecuteBatch(completedBatches.size)}
                  className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                >
                  Execute Next
                </button>
              )}
            </>
          )}
        </div>
        
        {/* Instructions */}
        {!isCompleted && (
          <div className="mt-4 p-3 bg-blue-50 rounded text-sm text-blue-700">
            <div className="font-medium mb-1">📝 Instructions:</div>
            <ul className="list-disc list-inside space-y-1 text-xs">
              <li>Each batch will require a separate MetaMask transaction</li>
              <li>You can execute batches one by one or all at once</li>
              <li>If a transaction fails, you can retry that batch</li>
              <li>Your stamp will be applied progressively as batches complete</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
