'use client';

import React from 'react';
import { StampData } from '@/lib/imageProcessing';

interface StampGalleryProps {
  stamps: StampData[];
  selectedStamp: StampData | null;
  onSelectStamp: (stamp: StampData | null) => void;
  onDeleteStamp: (stampId: string) => void;
  className?: string;
}

export default function StampGallery({ 
  stamps, 
  selectedStamp, 
  onSelectStamp, 
  onDeleteStamp, 
  className = '' 
}: StampGalleryProps) {
  
  if (stamps.length === 0) {
    return null;
  }

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Deselect stamp button (if one is selected) */}
      {selectedStamp && (
        <button
          onClick={() => onSelectStamp(null)}
          className="flex items-center px-2 py-1 text-xs bg-gray-200 hover:bg-gray-300 rounded transition-colors"
          title="Exit stamp mode"
        >
          <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Exit Stamp
        </button>
      )}
      
      {/* Stamp thumbnails */}
      {stamps.map((stamp) => (
        <div
          key={stamp.id}
          className={`
            relative group cursor-pointer border-2 rounded
            ${selectedStamp?.id === stamp.id 
              ? 'border-blue-500 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
            }
          `}
          onClick={() => onSelectStamp(selectedStamp?.id === stamp.id ? null : stamp)}
          title={`${stamp.name} (${stamp.processedImage.width}×${stamp.processedImage.height} = ${stamp.totalPixels} pixels)`}
        >
          <img
            src={stamp.previewUrl}
            alt={stamp.name}
            className="w-10 h-10 object-contain p-1"
            style={{ imageRendering: 'pixelated' }}
          />
          
          {/* Delete button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (confirm(`Delete stamp "${stamp.name}"?`)) {
                onDeleteStamp(stamp.id);
              }
            }}
            className="
              absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full
              opacity-0 group-hover:opacity-100 transition-opacity
              flex items-center justify-center text-xs hover:bg-red-600
            "
            title="Delete stamp"
          >
            ×
          </button>
          
          {/* Selected indicator */}
          {selectedStamp?.id === stamp.id && (
            <div className="absolute inset-0 border-2 border-blue-500 rounded pointer-events-none">
              <div className="absolute -top-1 -left-1 w-3 h-3 bg-blue-500 rounded-full"></div>
            </div>
          )}
          
          {/* Size indicator */}
          <div className="absolute -bottom-1 left-0 right-0 bg-black bg-opacity-70 text-white text-xs px-1 rounded-b text-center">
            {stamp.processedImage.width}×{stamp.processedImage.height}
          </div>
        </div>
      ))}
    </div>
  );
}
