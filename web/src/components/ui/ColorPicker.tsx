'use client';

import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { HexColorPicker } from 'react-colorful';

interface ColorPickerProps {
  color: number;
  onChange: (color: number) => void;
  disabled?: boolean;
}

export default function ColorPicker({ color, onChange, disabled = false }: ColorPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hexColor, setHexColor] = useState(`#${color.toString(16).padStart(6, '0')}`);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  // Update hex color when prop changes
  useEffect(() => {
    setHexColor(`#${color.toString(16).padStart(6, '0')}`);
  }, [color]);

  // Calculate position when opening
  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPosition({
        top: rect.bottom + window.scrollY + 4,
        left: rect.left + window.scrollX
      });
    }
  };

  // Close picker when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      
      // Check if the click is inside the picker container
      const isInsidePicker = pickerRef.current?.contains(target);
      const isInsideButton = buttonRef.current?.contains(target);
      
      // More comprehensive check for react-colorful and related elements
      const isColorfulElement = target?.closest?.('[class*="react-colorful"]') ||
                                target?.closest?.('[class*="picker"]') ||
                                target?.classList?.contains('react-colorful__hue') ||
                                target?.classList?.contains('react-colorful__saturation') ||
                                target?.classList?.contains('react-colorful__pointer') ||
                                target?.parentElement?.classList?.contains('react-colorful__hue') ||
                                target?.parentElement?.classList?.contains('react-colorful__saturation');
      
      // Also check if target is within our portal div by checking z-index or specific classes
      const isWithinPortal = target?.closest?.('[style*="z-index: 10000"]') ||
                             target?.closest?.('.fixed.z-\\[10000\\]');
      
      // Only close if the click is truly outside all related elements
      if (!isInsidePicker && !isInsideButton && !isColorfulElement && !isWithinPortal) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      // Use a slight delay to ensure the DOM is fully rendered
      const timeoutId = setTimeout(() => {
        document.addEventListener('mousedown', handleClickOutside, false);
      }, 100);
      
      return () => {
        clearTimeout(timeoutId);
        document.removeEventListener('mousedown', handleClickOutside, false);
      };
    }
  }, [isOpen]);

  const handleColorChange = (newHexColor: string) => {
    setHexColor(newHexColor);
    const colorInt = parseInt(newHexColor.slice(1), 16);
    onChange(colorInt);
  };

  const handleToggle = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled) {
      if (!isOpen) {
        updatePosition();
      }
      setIsOpen(!isOpen);
    }
  };

  const ColorPickerPortal = () => {
    if (!isOpen || typeof window === 'undefined') return null;
    
    return createPortal(
      <div 
        ref={pickerRef}
        className="fixed z-[10000] p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl"
        style={{
          top: position.top,
          left: position.left,
        }}
        onMouseDown={(e) => {
          // Only prevent event from reaching document-level listeners
          // Don't prevent default or stop propagation within the picker
        }}
        onClick={(e) => {
          // Allow normal click behavior within the picker
        }}
      >
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
      </div>,
      document.body
    );
  };

  return (
    <>
      {/* Color Preview Button */}
      <button
        ref={buttonRef}
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

      {/* Color Picker Portal */}
      <ColorPickerPortal />
    </>
  );
}
