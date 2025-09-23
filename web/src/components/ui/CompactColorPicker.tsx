'use client';

import React, { useState, useRef, useEffect } from 'react';
import { HexColorPicker } from 'react-colorful';

interface CompactColorPickerProps {
  color: number;
  onChange: (color: number) => void;
}

export default function CompactColorPicker({ color, onChange }: CompactColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  
  const hexColor = `#${color.toString(16).padStart(6, '0')}`;

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 8,
        left: rect.left + window.scrollX
      });
    }
  };

  const handleColorChange = (newHexColor: string) => {
    const colorInt = parseInt(newHexColor.slice(1), 16);
    onChange(colorInt);
  };

  const togglePicker = () => {
    if (!isOpen) {
      updatePosition();
    }
    setIsOpen(!isOpen);
  };

  // Close picker when clicking outside
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (buttonRef.current && !buttonRef.current.contains(target)) {
        // Check if click is inside the color picker portal
        const pickerElement = document.getElementById('color-picker-portal');
        if (!pickerElement || !pickerElement.contains(target)) {
          setIsOpen(false);
        }
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  return (
    <>
      {/* Color Button */}
      <button
        ref={buttonRef}
        onClick={togglePicker}
        className="relative w-8 h-8 rounded-lg border-2 border-white shadow-lg hover:scale-110 transition-all duration-200 ring-2 ring-gray-300 hover:ring-gray-400"
        style={{ backgroundColor: hexColor }}
        title={`Color: ${hexColor.toUpperCase()}`}
      >
        <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-white rounded-full border border-gray-300 flex items-center justify-center">
          <div className="w-1.5 h-1.5 bg-gray-600 rounded-full"></div>
        </div>
      </button>

      {/* Color Picker Portal */}
      {isOpen && typeof window !== 'undefined' && (
        <div
          id="color-picker-portal"
          className="fixed z-[9999] bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-2xl p-4"
          style={{
            top: position.top,
            left: position.left,
          }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="space-y-3">
            <HexColorPicker 
              color={hexColor} 
              onChange={handleColorChange}
              style={{ width: '180px', height: '140px' }}
            />
            
            <div className="flex items-center justify-between">
              <input
                type="text"
                value={hexColor}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^#[0-9A-Fa-f]{0,6}$/.test(value) && value.length === 7) {
                    handleColorChange(value);
                  }
                }}
                className="px-2 py-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 w-20"
                maxLength={7}
              />
              <button
                onClick={() => setIsOpen(false)}
                className="px-3 py-1 text-xs bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
