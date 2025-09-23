'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: number;
  onChange: (color: number) => void;
  disabled?: boolean;
}

export default function ColorPicker({ color, onChange, disabled = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexColor, setHexColor] = useState(`#${color.toString(16).padStart(6, '0')}`);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Update hex color when prop changes
  useEffect(() => {
    setHexColor(`#${color.toString(16).padStart(6, '0')}`);
  }, [color]);

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  const handleColorChange = (newHexColor: string) => {
    setHexColor(newHexColor);
    const colorInt = parseInt(newHexColor.slice(1), 16);
    onChange(colorInt);
  };

  const handleToggle = () => {
    if (!disabled) {
      setIsOpen(!isOpen);
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Color Preview Button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled}
        className={`w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 transition-all duration-200 ${
          disabled 
            ? 'opacity-50 cursor-not-allowed' 
            : 'cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 hover:scale-105'
        } ${isOpen ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
        style={{ backgroundColor: hexColor }}
        title={`Click to ${isOpen ? 'close' : 'open'} color picker - Current: ${hexColor.toUpperCase()}`}
      />

      {/* Color Picker Dropdown */}
      {isOpen && (
        <div className="absolute top-12 left-0 z-50 p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl">
          <div className="space-y-3">
            <HexColorPicker 
              color={hexColor} 
              onChange={handleColorChange}
              style={{ width: '200px', height: '150px' }}
            />
            
            {/* Hex Input */}
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Hex:
              </label>
              <input
                type="text"
                value={hexColor}
                onChange={(e) => {
                  const value = e.target.value;
                  setHexColor(value);
                  // Validate hex color
                  if (/^#[0-9A-Fa-f]{6}$/.test(value)) {
                    const colorInt = parseInt(value.slice(1), 16);
                    onChange(colorInt);
                  }
                }}
                className="px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-20"
                placeholder="#000000"
                maxLength={7}
              />
            </div>

            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="w-full px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
