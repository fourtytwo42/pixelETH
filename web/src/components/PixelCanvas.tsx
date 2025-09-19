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
  const [selectedPixelColors, setSelectedPixelColors] = useState<Map<number, number>>(new Map());
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [scale, setScale] = useState(4);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [lastLoadedArea, setLastLoadedArea] = useState({ startX: -1, startY: -1, endX: -1, endY: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'line' | 'rectangle'>('line');
  const [dragPath, setDragPath] = useState<Array<{ x: number, y: number }>>([]); // For line drawing

  // Load canvas info and initial pixels
  useEffect(() => {
    if (connection && connection.chainId === 31337) {
      loadCanvasInfo();
      // Load some initial pixels around center and corners to see if any exist
      loadInitialPixels();
    }
  }, [connection]);

  // Load initial pixels to check for existing content
  const loadInitialPixels = async () => {
    if (!connection || !canvasInfo) return;
    
    console.log('Loading initial pixels to find existing content...');
    
    try {
      const contract = getPixelCanvasContract(connection);
      
      // Check a sampling of pixels across the canvas to find existing ones
      const samplePixels = [];
      const sampleSize = 100; // Check 100 random pixels
      
      for (let i = 0; i < sampleSize; i++) {
        const randomId = Math.floor(Math.random() * canvasInfo.width * canvasInfo.height);
        samplePixels.push(randomId);
      }
      
      const pixelPromises = samplePixels.map(id => contract.getPixel(id));
      const results = await Promise.all(pixelPromises);
      
      const newPixels = new Map(pixels);
      let foundPixels = 0;
      
      results.forEach((result, index) => {
        const id = samplePixels[index];
        const [owner, lastPaid, color, team] = result;
        
        if (owner !== '0x0000000000000000000000000000000000000000') {
          const x = id % canvasInfo.width;
          const y = Math.floor(id / canvasInfo.width);
          
          newPixels.set(id, {
            id,
            owner,
            lastPaid,
            color: Number(color),
            team: Number(team),
            x,
            y,
          });
          foundPixels++;
          console.log('Found existing pixel:', id, 'at position:', x, y, 'color:', color.toString(16), 'team:', team);
        }
      });
      
      console.log(`Found ${foundPixels} existing pixels out of ${sampleSize} sampled`);
      
      if (foundPixels > 0) {
        setPixels(newPixels);
        console.log('Updated pixels map with existing content');
      }
      
    } catch (error) {
      console.error('Failed to load initial pixels:', error);
    }
  };

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
      
      // After loading canvas info, try to load initial pixels if we haven't already
      if (info.redCount > 0 || info.blueCount > 0) {
        console.log('Canvas has existing pixels, attempting to load them...');
        setTimeout(() => loadInitialPixels(), 500);
      }
    } catch (error) {
      console.error('Failed to load canvas info:', error);
      setError('Failed to load canvas information');
    }
  };

  // Find all owned pixels efficiently using contract events
  const findAllOwnedPixels = async () => {
    if (!connection || !canvasInfo) return;
    
    console.log('Finding all owned pixels using contract events...');
    setIsLoading(true);
    
    try {
      const contract = getPixelCanvasContract(connection);
      const newPixels = new Map<number, Pixel>();
      
      // Get all PixelsPurchased events from the contract
      console.log('Querying PixelsPurchased events...');
      const filter = contract.filters.PixelsPurchased();
      const events = await contract.queryFilter(filter, 0);
      
      console.log(`Found ${events.length} purchase events`);
      
      // Extract unique pixel IDs from all events
      const pixelIds = new Set<number>();
      events.forEach(event => {
        const pixelIdsArray = event.args?.pixelIds || [];
        pixelIdsArray.forEach((id: any) => {
          pixelIds.add(Number(id));
        });
      });
      
      console.log(`Total unique pixels purchased: ${pixelIds.size}`);
      
      // Now fetch current state for these specific pixels
      const pixelIdsArray = Array.from(pixelIds);
      const chunkSize = 100; // Smaller chunks for better performance
      
      for (let i = 0; i < pixelIdsArray.length; i += chunkSize) {
        const chunk = pixelIdsArray.slice(i, i + chunkSize);
        console.log(`Loading pixel states ${i + 1}-${Math.min(i + chunkSize, pixelIdsArray.length)} of ${pixelIdsArray.length}...`);
        
        const pixelPromises = chunk.map(id => contract.getPixel(id));
        const results = await Promise.all(pixelPromises);
        
        results.forEach((result, index) => {
          const id = chunk[index];
          const [owner, lastPaid, color, team] = result;
          
          // Only add pixels that are still owned (not sold back)
          if (owner !== '0x0000000000000000000000000000000000000000') {
            const x = id % canvasInfo.width;
            const y = Math.floor(id / canvasInfo.width);
            
            newPixels.set(id, {
              id,
              owner,
              lastPaid,
              color: Number(color),
              team: Number(team),
              x,
              y,
            });
          }
        });
      }
      
      console.log(`Found ${newPixels.size} currently owned pixels`);
      setPixels(newPixels);
      
      // Force redraw
      setTimeout(() => drawCanvas(), 100);
      
    } catch (error) {
      console.error('Failed to find owned pixels via events:', error);
      setError('Failed to search for owned pixels');
    } finally {
      setIsLoading(false);
    }
  };

  // Load pixel data for visible area (optimized with area checking)
  const loadPixels = useCallback(async (startX: number, startY: number, endX: number, endY: number, forceReload: boolean = false) => {
    if (!connection || !canvasInfo) return;

    // Skip if we've already loaded this area (unless force reload)
    if (!forceReload && startX >= lastLoadedArea.startX && endX <= lastLoadedArea.endX &&
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
          if (!pixels.has(id) || forceReload) {
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
  }, [connection, canvasInfo, lastLoadedArea]);

  // Bresenham's line algorithm for smooth line drawing
  const getLinePixels = useCallback((x0: number, y0: number, x1: number, y1: number): Array<{ x: number, y: number }> => {
    const pixels: Array<{ x: number, y: number }> = [];
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
      pixels.push({ x, y });
      
      if (x === x1 && y === y1) break;
      
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        x += sx;
      }
      if (e2 < dx) {
        err += dx;
        y += sy;
      }
    }
    
    return pixels;
  }, []);

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

    // Show color preview for selected pixels
    if (selectedPixels.size > 0) {
      selectedPixels.forEach((id) => {
        const x = id % canvasInfo.width;
        const y = Math.floor(id / canvasInfo.width);
        if (x >= visibleStartX && x <= visibleEndX && y >= visibleStartY && y <= visibleEndY) {
          const pixelX = x * scale + pan.x;
          const pixelY = y * scale + pan.y;
          
          // Show solid color preview using the color assigned when this pixel was selected
          const pixelColor = selectedPixelColors.get(id) || selectedColor;
          ctx.fillStyle = `#${pixelColor.toString(16).padStart(6, '0')}`;
          ctx.fillRect(pixelX, pixelY, scale, scale);
        }
      });
    }

    // Show drag selection rectangle (only for rectangle mode)
    if (isDragging && dragStart && dragEnd && dragMode === 'rectangle') {
      const startPixelX = dragStart.x * scale + pan.x;
      const startPixelY = dragStart.y * scale + pan.y;
      const endPixelX = dragEnd.x * scale + pan.x;
      const endPixelY = dragEnd.y * scale + pan.y;
      
      const rectX = Math.min(startPixelX, endPixelX);
      const rectY = Math.min(startPixelY, endPixelY);
      const rectWidth = Math.abs(endPixelX - startPixelX) + scale;
      const rectHeight = Math.abs(endPixelY - startPixelY) + scale;
      
      ctx.strokeStyle = '#00FF00';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.strokeRect(rectX, rectY, rectWidth, rectHeight);
      ctx.setLineDash([]); // Reset line dash
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
      loadPixels(visibleStartX, visibleStartY, visibleEndX, visibleEndY, false);
    }, 100);

    return () => clearTimeout(loadTimeout);
  }, [canvasInfo, pixels, selectedPixels, selectedPixelColors, hoveredPixel, scale, pan, loadPixels, isDragging, dragStart, dragEnd, dragMode, dragPath]);

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
      const canvas = canvasRef.current;
      if (!canvas || !canvasInfo) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const pixelX = Math.floor((mouseX - pan.x) / scale);
      const pixelY = Math.floor((mouseY - pan.y) / scale);
      
      if (pixelX >= 0 && pixelX < canvasInfo.width && pixelY >= 0 && pixelY < canvasInfo.height) {
        const pixelId = pixelY * canvasInfo.width + pixelX;
        
        if (e.shiftKey) {
          // Start rectangle selection
          setIsDragging(true);
          setDragMode('rectangle');
          setDragStart({ x: pixelX, y: pixelY });
          setDragEnd({ x: pixelX, y: pixelY });
          setDragPath([]);
        } else {
          // Single click: set pixel color immediately or start line drawing
          const newSelected = new Set(selectedPixels);
          const newColors = new Map(selectedPixelColors);
          
          // Single click behavior: just select the pixel
          newSelected.add(pixelId);
          newColors.set(pixelId, selectedColor);
          setSelectedPixels(newSelected);
          setSelectedPixelColors(newColors);
          
          // Start line drawing mode
          setIsDragging(true);
          setDragMode('line');
          setDragStart({ x: pixelX, y: pixelY });
          setDragEnd({ x: pixelX, y: pixelY });
          setDragPath([{ x: pixelX, y: pixelY }]);
          
          console.log('Started drawing at pixel:', pixelId, 'with color:', selectedColor.toString(16));
        }
      }
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => ({ x: prev.x + deltaX, y: prev.y + deltaY }));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (isDragging && dragStart && canvasInfo) {
      // Update drag selection
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const pixelX = Math.floor((mouseX - pan.x) / scale);
      const pixelY = Math.floor((mouseY - pan.y) / scale);
      
      const clampedX = Math.max(0, Math.min(canvasInfo.width - 1, pixelX));
      const clampedY = Math.max(0, Math.min(canvasInfo.height - 1, pixelY));
      
      setDragEnd({ x: clampedX, y: clampedY });
      
      if (dragMode === 'line') {
        // For line drawing, add intermediate pixels along the path
        const newSelected = new Set(selectedPixels);
        const newColors = new Map(selectedPixelColors);
        
        // Generate line from last point to current point using Bresenham's line algorithm
        const lastPoint = dragPath[dragPath.length - 1];
        if (lastPoint && (lastPoint.x !== clampedX || lastPoint.y !== clampedY)) {
          const linePixels = getLinePixels(lastPoint.x, lastPoint.y, clampedX, clampedY);
          
          linePixels.forEach(point => {
            const pixelId = point.y * canvasInfo.width + point.x;
            newSelected.add(pixelId);
            newColors.set(pixelId, selectedColor);
          });
          
          setSelectedPixels(newSelected);
          setSelectedPixelColors(newColors);
          setDragPath([...dragPath, { x: clampedX, y: clampedY }]);
        }
      }
    } else {
      // Throttle hover detection to improve performance
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== hoveredPixel) {
        setHoveredPixel(pixelId);
      }
    }
  }, [isPanning, lastPanPoint, isDragging, dragStart, canvasInfo, pan, scale, hoveredPixel, getPixelFromMouse, dragMode, dragPath, selectedPixels, selectedPixelColors, selectedColor]);

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (isDragging && dragStart && dragEnd && canvasInfo) {
      if (dragMode === 'rectangle') {
        // Complete rectangle selection
        const minX = Math.min(dragStart.x, dragEnd.x);
        const maxX = Math.max(dragStart.x, dragEnd.x);
        const minY = Math.min(dragStart.y, dragEnd.y);
        const maxY = Math.max(dragStart.y, dragEnd.y);
        
        const newSelected = new Set(selectedPixels);
        const newColors = new Map(selectedPixelColors);
        
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const pixelId = y * canvasInfo.width + x;
            newSelected.add(pixelId);
            newColors.set(pixelId, selectedColor);
          }
        }
        
        setSelectedPixels(newSelected);
        setSelectedPixelColors(newColors);
        console.log('Rectangle selected area:', `(${minX}, ${minY}) to (${maxX}, ${maxY})`);
        console.log('Total selected pixels after rectangle:', newSelected.size);
      } else {
        // Line drawing is already complete from mouse move events
        console.log('Line drawing completed with', selectedPixels.size, 'pixels');
      }
      
      setIsDragging(false);
      setDragStart(null);
      setDragEnd(null);
      setDragPath([]);
    }
    
    setIsPanning(false);
    document.body.style.cursor = 'default'; // Reset cursor
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsPanning(false);
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPath([]);
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
      const teams = Array(pixelIds.length).fill(selectedTeam);

      // Get colors for each selected pixel
      const colors = pixelIds.map(id => selectedPixelColors.get(id) || selectedColor);

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
      setSelectedPixelColors(new Map());
      await loadCanvasInfo();
      
      // Force reload pixels by clearing cache and loaded area
      setPixels(new Map());
      setLastLoadedArea({ startX: -1, startY: -1, endX: -1, endY: -1 });
      
      // Force a complete canvas redraw
      setTimeout(() => {
        drawCanvas();
      }, 100);

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
                setSelectedPixelColors(new Map());
                setHoveredPixel(null);
                setIsPanning(false);
                setIsDragging(false);
                setDragStart(null);
                setDragEnd(null);
                setDragPath([]);
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
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  setPixels(new Map());
                  setLastLoadedArea({ startX: -1, startY: -1, endX: -1, endY: -1 });
                  loadCanvasInfo();
                  setTimeout(() => drawCanvas(), 100);
                }}
              >
                Refresh
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  findAllOwnedPixels();
                }}
              >
                Load All Pixels
              </Button>
            </div>

            {/* Instructions */}
            <div className="absolute bottom-2 left-2 text-xs text-gray-600 dark:text-gray-400 bg-white/80 dark:bg-black/80 p-2 rounded max-w-xs">
              <p><strong>Drawing Controls:</strong></p>
              <p>• Click: Set single pixel color</p>
              <p>• Click+Drag: Draw lines and shapes</p>
              <p>• Shift+Drag: Select rectangle area</p>
              <p>• Mouse Wheel: Zoom in/out</p>
              <p>• Ctrl+Drag: Pan canvas</p>
              <p>• Perfect for pixel art creation!</p>
            </div>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}
