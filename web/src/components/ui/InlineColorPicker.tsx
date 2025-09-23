'use client';

import React, { useState } from 'react';
import { HexColorPicker } from 'react-colorful';

interface InlineColorPickerProps {
  color: number;
  onChange: (color: number) => void;
  selectedTeam: number;
  onTeamChange: (team: number) => void;
}

const QUICK_COLORS = [
  0xFF0000, // Red
  0x00FF00, // Green  
  0x0000FF, // Blue
  0xFFFF00, // Yellow
  0xFF00FF, // Magenta
  0x00FFFF, // Cyan
  0x000000, // Black
  0xFFFFFF, // White
  0xFFA500, // Orange
  0x800080, // Purple
  0x008000, // Dark Green
  0x8B4513, // Brown
];

export default function InlineColorPicker({ color, onChange, selectedTeam, onTeamChange }: InlineColorPickerProps) {
  const [showPicker, setShowPicker] = useState(false);
  const hexColor = `#${color.toString(16).padStart(6, '0')}`;

  const handleColorChange = (newHexColor: string) => {
    const colorInt = parseInt(newHexColor.slice(1), 16);
    onChange(colorInt);
  };

  return (
    <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
      <div className="flex items-center justify-between max-w-7xl mx-auto">
        {/* Left: Team Selection */}
        <div className="flex items-center gap-4">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Team:</span>
          <div className="flex gap-2">
            <button
              onClick={() => onTeamChange(0)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedTeam === 0
                  ? 'bg-red-500 text-white shadow-lg transform scale-105'
                  : 'bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-800/30'
              }`}
            >
              🔴 Red Team
            </button>
            <button
              onClick={() => onTeamChange(1)}
              className={`px-4 py-2 rounded-lg font-medium transition-all ${
                selectedTeam === 1
                  ? 'bg-blue-500 text-white shadow-lg transform scale-105'
                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-800/30'
              }`}
            >
              🔵 Blue Team
            </button>
          </div>
        </div>

        {/* Center: Color Selection */}
        <div className="flex items-center gap-6">
          {/* Current Color */}
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Color:</span>
            <button
              onClick={() => setShowPicker(!showPicker)}
              className="relative w-12 h-12 rounded-xl border-3 border-white shadow-lg hover:scale-110 transition-transform"
              style={{ backgroundColor: hexColor }}
              title={`Click to ${showPicker ? 'hide' : 'show'} color picker`}
            >
              <div className="absolute inset-0 rounded-xl border border-gray-300 dark:border-gray-600"></div>
            </button>
            <div className="text-sm font-mono text-gray-600 dark:text-gray-400">
              {hexColor.toUpperCase()}
            </div>
          </div>

          {/* Quick Colors */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500 dark:text-gray-400">Quick:</span>
            <div className="flex gap-1">
              {QUICK_COLORS.map((quickColor) => (
                <button
                  key={quickColor}
                  onClick={() => onChange(quickColor)}
                  className={`w-8 h-8 rounded-lg border-2 hover:scale-110 transition-transform ${
                    color === quickColor 
                      ? 'border-gray-800 dark:border-gray-200 shadow-md' 
                      : 'border-gray-300 dark:border-gray-600'
                  }`}
                  style={{ backgroundColor: `#${quickColor.toString(16).padStart(6, '0')}` }}
                  title={`#${quickColor.toString(16).padStart(6, '0').toUpperCase()}`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Right: Hex Input */}
        <div className="flex items-center gap-3">
          <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
            Hex:
          </label>
          <input
            type="text"
            value={hexColor}
            onChange={(e) => {
              const value = e.target.value;
              if (/^#[0-9A-Fa-f]{0,6}$/.test(value)) {
                if (value.length === 7) {
                  const colorInt = parseInt(value.slice(1), 16);
                  onChange(colorInt);
                }
              }
            }}
            className="w-20 px-2 py-1 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="#000000"
            maxLength={7}
          />
        </div>
      </div>

      {/* Expanded Color Picker */}
      {showPicker && (
        <div className="mt-4 flex justify-center">
          <div className="bg-gray-50 dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
            <HexColorPicker 
              color={hexColor} 
              onChange={handleColorChange}
              style={{ width: '250px', height: '200px' }}
            />
            <div className="mt-3 flex justify-center">
              <button
                onClick={() => setShowPicker(false)}
                className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors text-sm"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
