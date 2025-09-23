'use client';

import React, { useRef, useState } from 'react';
import { processImageFile, createStampPreview, generateStampId, StampData } from '@/lib/imageProcessing';

interface ImageUploadProps {
  onStampCreated: (stamp: StampData) => void;
  onError: (error: string) => void;
  className?: string;
}

export default function ImageUpload({ onStampCreated, onError, className = '' }: ImageUploadProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      onError('Please select a valid image file');
      return;
    }

    // Validate file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      onError('Image file too large. Please select an image under 10MB');
      return;
    }

    setIsProcessing(true);

    try {
      // Process the image
      const processedImage = await processImageFile(file, 200, 200);
      
      // Create preview
      const previewUrl = createStampPreview(processedImage);
      
      // Calculate total pixels
      const totalPixels = processedImage.width * processedImage.height;
      
      // Create stamp data
      const stampData: StampData = {
        id: generateStampId(),
        name: file.name.split('.')[0], // Remove extension
        processedImage,
        previewUrl,
        totalPixels
      };
      
      onStampCreated(stampData);
      
      // Clear the input so the same file can be uploaded again
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      
    } catch (error) {
      console.error('Failed to process image:', error);
      onError(error instanceof Error ? error.message : 'Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileSelect}
        className="hidden"
      />
      
      <button
        onClick={handleClick}
        disabled={isProcessing}
        className={`
          relative inline-flex items-center px-3 py-2 text-sm font-medium rounded-md
          transition-colors duration-200
          ${isProcessing 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-blue-500 hover:bg-blue-600 text-white hover:shadow-md'
          }
          ${className}
        `}
        title="Upload image to use as stamp"
      >
        {isProcessing ? (
          <>
            <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            Processing...
          </>
        ) : (
          <>
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            Upload Image
          </>
        )}
      </button>
    </>
  );
}
