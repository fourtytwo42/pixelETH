'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWeb3 } from './Web3Provider';
import { getPixelCanvasContract, formatEther, encodeIdsLE, encodeColors24, encodeTeamBits } from '@/lib/web3';
import { Card, CardBody } from './ui/Card';
import Button from './ui/Button';

interface Pixel {
  id: number;
  owner: string;
  lastPaid: bigint;
  color: number;
  team: number;
  x: number;
  y: number;
}

interface CanvasInfo {
  width: number;
  height: number;
  basePrice: bigint;
  redCount: number;
  blueCount: number;
}

const COLORS = {
  RED_TEAM: [
    0xFF0000, 0xFF4444, 0xFF8888, 0xFFAAAA,
    0xCC0000, 0x990000, 0x660000, 0x330000,
    0xFF6600, 0xFF9900, 0xFFCC00, 0xFFFF00,
  ],
  BLUE_TEAM: [
    0x0000FF, 0x4444FF, 0x8888FF, 0xAAAAFF,
    0x0000CC, 0x000099, 0x000066, 0x000033,
    0x0066FF, 0x0099FF, 0x00CCFF, 0x00FFFF,
  ],
  NEUTRAL: [
    0x000000, 0x333333, 0x666666, 0x999999,
    0xCCCCCC, 0xFFFFFF, 0x8B4513, 0x90EE90,
  ],
};

export default function PixelCanvas() {
  const { connection } = useWeb3();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [canvasInfo, setCanvasInfo] = useState<CanvasInfo | null>(null);
  const [pixels, setPixels] = useState<Map<number, Pixel>>(new Map());
  const [selectedColor, setSelectedColor] = useState(0xFF0000);
  const [selectedTeam, setSelectedTeam] = useState(0);
  const [selectedPixels, setSelectedPixels] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [scale, setScale] = useState(4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [lastLoadedArea, setLastLoadedArea] = useState({ startX: -1, startY: -1, endX: -1, endY: -1 });

  // Load canvas info and initial pixels
  useEffect(() => {
    if (connection && connection.chainId === 31337) {
      loadCanvasInfo();
    }
  }, [connection]);

  const loadCanvasInfo = async () => {
    if (!connection) return;

    try {
      const contract = getPixelCanvasContract(connection);
      
      const [width, height, basePrice, [redCount, blueCount]] = await Promise.all([
        contract.width(),
        contract.height(),
        contract.basePrice(),
        contract.getTeamCounts(),
      ]);

      const info: CanvasInfo = {
        width: Number(width),
        height: Number(height),
        basePrice,
        redCount: Number(redCount),
        blueCount: Number(blueCount),
      };

      setCanvasInfo(info);
      
      // Update DOM elements for stats
      document.getElementById('red-count')!.textContent = redCount.toString();
      document.getElementById('blue-count')!.textContent = blueCount.toString();
      document.getElementById('base-price')!.textContent = `${formatEther(basePrice)} ETH`;
      document.getElementById('canvas-size')!.textContent = `${width} × ${height}`;

      console.log('Canvas info loaded:', info);
    } catch (error) {
      console.error('Failed to load canvas info:', error);
      setError('Failed to load canvas information');
    }
  };

  // Load pixel data for visible area (optimized with area checking)
  const loadPixels = useCallback(async (startX: number, startY: number, endX: number, endY: number) => {
    if (!connection || !canvasInfo) return;

    // Skip if we've already loaded this area
    if (startX >= lastLoadedArea.startX && endX <= lastLoadedArea.endX &&
        startY >= lastLoadedArea.startY && endY <= lastLoadedArea.endY) {
      return;
    }

    // Limit the area to prevent loading too many pixels at once
    const maxPixelsPerLoad = 100;
    const areaSize = (endX - startX + 1) * (endY - startY + 1);
    if (areaSize > maxPixelsPerLoad) {
      // Reduce the area to center around current view
      const centerX = Math.floor((startX + endX) / 2);
      const centerY = Math.floor((startY + endY) / 2);
      const halfSize = Math.floor(Math.sqrt(maxPixelsPerLoad) / 2);
      startX = Math.max(0, centerX - halfSize);
      endX = Math.min(canvasInfo.width - 1, centerX + halfSize);
      startY = Math.max(0, centerY - halfSize);
      endY = Math.min(canvasInfo.height - 1, centerY + halfSize);
    }

    try {
      const contract = getPixelCanvasContract(connection);
      const pixelPromises: Promise<any>[] = [];
      const pixelIds: number[] = [];

      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          const id = y * canvasInfo.width + x;
          if (!pixels.has(id)) {
            pixelIds.push(id);
            pixelPromises.push(contract.getPixel(id));
          }
        }
      }

      if (pixelPromises.length === 0) return;

      const results = await Promise.all(pixelPromises);
      const newPixels = new Map(pixels);

      results.forEach((result, index) => {
        const id = pixelIds[index];
        const [owner, lastPaid, color, team] = result;
        
        if (owner !== '0x0000000000000000000000000000000000000000') {
          newPixels.set(id, {
            id,
            owner,
            lastPaid,
            color: Number(color),
            team: Number(team),
            x: id % canvasInfo.width,
            y: Math.floor(id / canvasInfo.width),
          });
        }
      });

      setPixels(newPixels);
      setLastLoadedArea({ startX, startY, endX, endY });
    } catch (error) {
      console.error('Failed to load pixels:', error);
    }
  }, [connection, canvasInfo, pixels, lastLoadedArea]);

  // Canvas drawing (optimized for performance)
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasInfo) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    
    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, width, height);

    // Calculate visible area
    const visibleStartX = Math.max(0, Math.floor(-pan.x / scale));
    const visibleStartY = Math.max(0, Math.floor(-pan.y / scale));
    const visibleEndX = Math.min(canvasInfo.width - 1, Math.floor((width - pan.x) / scale));
    const visibleEndY = Math.min(canvasInfo.height - 1, Math.floor((height - pan.y) / scale));

    // Only draw grid if zoomed in enough
    if (scale >= 3) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      
      // Limit grid lines to prevent performance issues
      const maxGridLines = 100;
      const gridStepX = Math.max(1, Math.ceil((visibleEndX - visibleStartX) / maxGridLines));
      const gridStepY = Math.max(1, Math.ceil((visibleEndY - visibleStartY) / maxGridLines));
      
      for (let x = visibleStartX; x <= visibleEndX + 1; x += gridStepX) {
        const pixelX = x * scale + pan.x;
        ctx.beginPath();
        ctx.moveTo(pixelX, 0);
        ctx.lineTo(pixelX, height);
        ctx.stroke();
      }
      
      for (let y = visibleStartY; y <= visibleEndY + 1; y += gridStepY) {
        const pixelY = y * scale + pan.y;
        ctx.beginPath();
        ctx.moveTo(0, pixelY);
        ctx.lineTo(width, pixelY);
        ctx.stroke();
      }
    }

    // Draw pixels only in visible area
    pixels.forEach((pixel) => {
      if (pixel.x >= visibleStartX && pixel.x <= visibleEndX && 
          pixel.y >= visibleStartY && pixel.y <= visibleEndY) {
        const pixelX = pixel.x * scale + pan.x;
        const pixelY = pixel.y * scale + pan.y;
        
        ctx.fillStyle = `#${pixel.color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(pixelX, pixelY, scale, scale);
      }
    });

    // Highlight selected pixels
    if (selectedPixels.size > 0) {
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      selectedPixels.forEach((id) => {
        const x = id % canvasInfo.width;
        const y = Math.floor(id / canvasInfo.width);
        if (x >= visibleStartX && x <= visibleEndX && y >= visibleStartY && y <= visibleEndY) {
          const pixelX = x * scale + pan.x;
          const pixelY = y * scale + pan.y;
          ctx.strokeRect(pixelX, pixelY, scale, scale);
        }
      });
    }

    // Highlight hovered pixel
    if (hoveredPixel !== null) {
      const x = hoveredPixel % canvasInfo.width;
      const y = Math.floor(hoveredPixel / canvasInfo.width);
      if (x >= visibleStartX && x <= visibleEndX && y >= visibleStartY && y <= visibleEndY) {
        const pixelX = x * scale + pan.x;
        const pixelY = y * scale + pan.y;
        
        ctx.strokeStyle = '#ff0000';
        ctx.lineWidth = 1;
        ctx.strokeRect(pixelX, pixelY, scale, scale);
      }
    }

    // Load pixels for visible area (debounced)
    const loadTimeout = setTimeout(() => {
      loadPixels(visibleStartX, visibleStartY, visibleEndX, visibleEndY);
    }, 100);

    return () => clearTimeout(loadTimeout);
  }, [canvasInfo, pixels, selectedPixels, hoveredPixel, scale, pan, loadPixels]);

  // Throttled redraw to improve performance
  useEffect(() => {
    let rafId: number;
    const throttledDraw = () => {
      drawCanvas();
    };
    rafId = requestAnimationFrame(throttledDraw);
    return () => cancelAnimationFrame(rafId);
  }, [drawCanvas]);

  // Cleanup cursor on component unmount or panning state change
  useEffect(() => {
    return () => {
      document.body.style.cursor = 'default';
    };
  }, []);

  useEffect(() => {
    if (!isPanning) {
      document.body.style.cursor = 'default';
    }
  }, [isPanning]);

  // Mouse event handlers
  const getPixelFromMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasInfo) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    
    const pixelX = Math.floor((mouseX - pan.x) / scale);
    const pixelY = Math.floor((mouseY - pan.y) / scale);
    
    if (pixelX >= 0 && pixelX < canvasInfo.width && pixelY >= 0 && pixelY < canvasInfo.height) {
      return pixelY * canvasInfo.width + pixelX;
    }
    
    return null;
  }, [canvasInfo, pan, scale]);

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault(); // Prevent default browser behavior
    
    if (e.button === 1 || e.ctrlKey) { // Middle mouse or Ctrl+click for panning
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
    } else if (e.button === 0) { // Left click for pixel selection
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== null) {
        console.log('Clicked pixel ID:', pixelId, 'at position:', pixelId % canvasInfo.width, Math.floor(pixelId / canvasInfo.width));
        
        const newSelected = new Set(selectedPixels);
        if (e.shiftKey) {
          // Add to selection or remove if already selected
          if (newSelected.has(pixelId)) {
            newSelected.delete(pixelId);
            console.log('Removed pixel from selection:', pixelId);
          } else {
            newSelected.add(pixelId);
            console.log('Added pixel to selection:', pixelId);
          }
        } else {
          // Replace selection
          newSelected.clear();
          newSelected.add(pixelId);
          console.log('Selected single pixel:', pixelId);
        }
        setSelectedPixels(newSelected);
        console.log('Total selected pixels:', newSelected.size, Array.from(newSelected));
      }
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else {
      // Throttle hover detection to improve performance
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== hoveredPixel) {
        setHoveredPixel(pixelId);
      }
    }
  }, [isPanning, lastPanPoint, hoveredPixel, getPixelFromMouse]);

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsPanning(false);
    document.body.style.cursor = 'default'; // Reset cursor
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsPanning(false);
    setHoveredPixel(null);
    document.body.style.cursor = 'default'; // Reset cursor when leaving canvas
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    setScale(prev => Math.max(1, Math.min(20, prev * delta)));
  };

  // Buy pixels function
  const buyPixels = async () => {
    if (!connection || selectedPixels.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const contract = getPixelCanvasContract(connection);
      const pixelIds = Array.from(selectedPixels).sort((a, b) => a - b);
      const colors = Array(pixelIds.length).fill(selectedColor);
      const teams = Array(pixelIds.length).fill(selectedTeam);

      // Calculate total cost
      let totalCost = 0n;
      for (const id of pixelIds) {
        const price = await contract.quotePrice(id, selectedTeam);
        totalCost += price;
      }

      // Encode data
      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      console.log('Buying pixels:', {
        count: pixelIds.length,
        totalCost: formatEther(totalCost),
        team: selectedTeam === 0 ? 'Red' : 'Blue',
        color: `#${selectedColor.toString(16).padStart(6, '0')}`,
      });

      // Send transaction
      const tx = await contract.buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost,
      });

      console.log('Transaction sent:', tx.hash);
      await tx.wait();
      console.log('Transaction confirmed!');

      // Refresh canvas data
      setSelectedPixels(new Set());
      await loadCanvasInfo();
      
      // Force reload pixels
      setPixels(new Map());
      drawCanvas();

    } catch (error: any) {
      console.error('Failed to buy pixels:', error);
      setError(error.reason || error.message || 'Failed to buy pixels');
    } finally {
      setIsLoading(false);
    }
  };

  if (!connection) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Connect Wallet to Play</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Connect your wallet to start buying pixels and painting the canvas!
          </p>
        </div>
      </Card>
    );
  }

  if (connection.chainId !== 31337) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Wrong Network</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Please switch to Hardhat Local Network (Chain ID: 31337) to play PixelETH.
          </p>
        </div>
      </Card>
    );
  }

  if (!canvasInfo) {
    return (
      <Card className="h-96 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg font-semibold mb-2">Loading Canvas...</p>
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <Card>
        <CardBody>
          <div className="flex flex-wrap gap-4 items-center">
            {/* Team Selection */}
            <div className="flex gap-2">
              <Button
                size="sm"
                variant={selectedTeam === 0 ? 'primary' : 'secondary'}
                onClick={() => setSelectedTeam(0)}
                className="bg-red-500 hover:bg-red-600"
              >
                🔴 Red Team
              </Button>
              <Button
                size="sm"
                variant={selectedTeam === 1 ? 'primary' : 'secondary'}
                onClick={() => setSelectedTeam(1)}
                className="bg-blue-500 hover:bg-blue-600"
              >
                🔵 Blue Team
              </Button>
            </div>

            {/* Color Palette */}
            <div className="flex flex-wrap gap-1">
              {(selectedTeam === 0 ? COLORS.RED_TEAM : COLORS.BLUE_TEAM).map((color) => (
                <button
                  key={color}
                  className={`w-6 h-6 rounded border-2 ${
                    selectedColor === color ? 'border-black' : 'border-gray-300'
                  }`}
                  style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}
                  onClick={() => setSelectedColor(color)}
                />
              ))}
            </div>

            {/* Reset Selection Button */}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelectedPixels(new Set());
                setHoveredPixel(null);
                setIsPanning(false);
                document.body.style.cursor = 'default';
              }}
              disabled={selectedPixels.size === 0}
            >
              Clear ({selectedPixels.size})
            </Button>

            {/* Buy Button */}
            <Button
              onClick={buyPixels}
              disabled={selectedPixels.size === 0 || isLoading}
              className="ml-auto"
            >
              {isLoading ? 'Buying...' : `Buy ${selectedPixels.size} Pixel${selectedPixels.size !== 1 ? 's' : ''}`}
            </Button>
          </div>

          {error && (
            <div className="mt-2 p-2 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200">
              {error}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Canvas */}
      <Card>
        <CardBody className="p-2">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={600}
              height={400}
              className="border border-gray-300 dark:border-gray-600 cursor-pointer select-none"
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseLeave}
              onWheel={handleWheel}
              onContextMenu={(e) => e.preventDefault()}
            />
            
            {/* Canvas Controls */}
            <div className="absolute top-2 right-2 flex gap-2">
              <Button size="sm" onClick={() => setScale(prev => Math.min(20, prev * 1.2))}>
                +
              </Button>
              <Button size="sm" onClick={() => setScale(prev => Math.max(1, prev * 0.8))}>
                -
              </Button>
              <Button size="sm" onClick={() => { setScale(4); setPan({ x: 0, y: 0 }); }}>
                Reset
              </Button>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/80 p-2 rounded max-w-xs">
              <p><strong>Controls:</strong></p>
              <p>• Left Click: Select pixel</p>
              <p>• Shift+Click: Multi-select</p>
              <p>• Mouse Wheel: Zoom in/out</p>
              <p>• Ctrl+Drag: Pan canvas</p>
              <p>• Use "Clear" button if cursor gets stuck</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
