'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWeb3 } from './Web3Provider';
import { getPixelCanvasContract, formatEther, encodeIdsLE, encodeColors24, encodeTeamBits } from '@/lib/web3';
import InlineColorPicker from './ui/InlineColorPicker';
import Modal from './ui/Modal';

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
  const [isLoadingPixels, setIsLoadingPixels] = useState(false);
  const [initialPixelsLoaded, setInitialPixelsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hoveredPixel, setHoveredPixel] = useState<number | null>(null);
  const [hoveredOwner, setHoveredOwner] = useState<string | null>(null);
  const [hoveredOwnerStats, setHoveredOwnerStats] = useState<{redCount: number, blueCount: number, totalCount: number} | null>(null);
  const [scale, setScale] = useState(0.31);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [lastLoadedArea, setLastLoadedArea] = useState({ startX: -1, startY: -1, endX: -1, endY: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'line' | 'rectangle'>('line');
  const [dragPath, setDragPath] = useState<Array<{ x: number, y: number }>>([]); 
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{
    pixelCount: number;
    totalCost: bigint;
    pixelIds: number[];
    colors: number[];
  } | null>(null);

  // Initialize view to fit entire grid at 100% zoom
  const initializeView = useCallback(() => {
    if (!canvasInfo) return;
    
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 200; // Account for top bars
    
    // Calculate scale to fit entire grid in canvas at 100%
    const scaleX = canvasWidth / canvasInfo.width;
    const scaleY = canvasHeight / canvasInfo.height;
    const fitScale = Math.min(scaleX, scaleY);
    
    // Center the grid in the canvas
    const scaledGridWidth = canvasInfo.width * fitScale;
    const scaledGridHeight = canvasInfo.height * fitScale;
    const centerX = (canvasWidth - scaledGridWidth) / 2;
    const centerY = (canvasHeight - scaledGridHeight) / 2;
    
    setScale(fitScale);
    setPan({ x: centerX, y: centerY });
  }, [canvasInfo]);

  // Constrain pan to keep grid within canvas bounds
  const constrainPan = useCallback((newPan: { x: number, y: number }, currentScale: number) => {
    if (!canvasInfo) return newPan;
    
    const canvasWidth = window.innerWidth;
    const canvasHeight = window.innerHeight - 200;
    const scaledGridWidth = canvasInfo.width * currentScale;
    const scaledGridHeight = canvasInfo.height * currentScale;
    
    // Calculate bounds
    const minX = Math.min(0, canvasWidth - scaledGridWidth);
    const maxX = Math.max(0, canvasWidth - scaledGridWidth);
    const minY = Math.min(0, canvasHeight - scaledGridHeight);
    const maxY = Math.max(0, canvasHeight - scaledGridHeight);
    
    return {
      x: Math.max(minX, Math.min(maxX, newPan.x)),
      y: Math.max(minY, Math.min(maxY, newPan.y))
    };
  }, [canvasInfo]);

  // Find all owned pixels efficiently using contract events
  const findAllOwnedPixels = useCallback(async () => {
    if (!connection || !canvasInfo || isLoadingPixels) return;
    
    setIsLoadingPixels(true);
    
    try {
      const contract = getPixelCanvasContract(connection);
      const filter = contract.filters.PixelBought();
      const events = await contract.queryFilter(filter, 0);
      
      // Extract unique pixel IDs from all events
      const pixelIds = new Set<number>();
      events.forEach(event => {
        if ('args' in event && event.args?.id !== undefined) {
          pixelIds.add(Number(event.args.id));
        }
      });
      
      // Now fetch current state for these specific pixels
      const pixelIdsArray = Array.from(pixelIds);
      const chunkSize = 100;
      const newPixels = new Map<number, Pixel>();
      
      for (let i = 0; i < pixelIdsArray.length; i += chunkSize) {
        const chunk = pixelIdsArray.slice(i, i + chunkSize);
        
        await Promise.all(chunk.map(async (id) => {
          try {
            const [owner, lastPaid, color, team] = await contract.getPixel(id);
            
            // Only add if still owned (not zero address)
            if (owner !== '0x0000000000000000000000000000000000000000') {
              newPixels.set(id, {
                id,
                owner,
                lastPaid: BigInt(lastPaid),
                color: Number(color),
                team: Number(team),
                x: id % canvasInfo.width,
                y: Math.floor(id / canvasInfo.width),
              });
            }
          } catch (error) {
            console.error(`Failed to fetch pixel ${id}:`, error);
          }
        }));
      }
      
      setPixels(newPixels);
      setInitialPixelsLoaded(true);
      
    } catch (error) {
      console.error('Failed to find owned pixels via events:', error);
      setError('Failed to search for owned pixels');
    } finally {
      setIsLoadingPixels(false);
    }
  }, [connection, canvasInfo]);

  // Load canvas info and initial pixels
  useEffect(() => {
    if (connection && connection.chainId === 31337) {
      loadCanvasInfo();
    }
  }, [connection]);

  // Auto-load pixels when canvas info changes
  useEffect(() => {
    if (canvasInfo && (canvasInfo.redCount > 0 || canvasInfo.blueCount > 0) && !isLoadingPixels && !initialPixelsLoaded) {
      findAllOwnedPixels();
    } else if (canvasInfo && canvasInfo.redCount === 0 && canvasInfo.blueCount === 0) {
      setInitialPixelsLoaded(true);
    }
  }, [canvasInfo, isLoadingPixels, findAllOwnedPixels, initialPixelsLoaded]);

  const loadCanvasInfo = async (resetView: boolean = true) => {
    if (!connection) return;

    try {
      const contract = getPixelCanvasContract(connection);
      const [width, height, basePrice, teamCounts] = await Promise.all([
        contract.width(),
        contract.height(),
        contract.basePrice(),
        contract.getTeamCounts()
      ]);

      const info = {
        width: Number(width),
        height: Number(height),
        basePrice: BigInt(basePrice),
        redCount: Number(teamCounts[0]),
        blueCount: Number(teamCounts[1])
      };

      setCanvasInfo(info);

      // Update stats in the top bar
      const redCountEl = document.getElementById('red-count');
      const blueCountEl = document.getElementById('blue-count');
      if (redCountEl) redCountEl.textContent = info.redCount.toString();
      if (blueCountEl) blueCountEl.textContent = info.blueCount.toString();

      // Initialize view to fit the grid (only on first load)
      if (resetView) {
        setTimeout(() => initializeView(), 100);
      }

    } catch (error) {
      console.error('Failed to load canvas info:', error);
      setError('Failed to load canvas information');
    }
  };

  // Prepare purchase and show confirmation modal
  const preparePurchase = async () => {
    if (!connection || selectedPixels.size === 0) return;

    setIsLoading(true);
    setError(null);

    try {
      const contract = getPixelCanvasContract(connection);
      const pixelIds = Array.from(selectedPixels).sort((a, b) => a - b);

      // Get colors for each selected pixel
      const colors = pixelIds.map(id => selectedPixelColors.get(id) || selectedColor);

      // Calculate total cost
      let totalCost = BigInt(0);
      for (const id of pixelIds) {
        const price = await contract.quotePrice(id, selectedTeam);
        totalCost += price;
      }

      // Set purchase details and show modal
      setPurchaseDetails({
        pixelCount: pixelIds.length,
        totalCost,
        pixelIds,
        colors
      });
      setShowPurchaseModal(true);

    } catch (error: any) {
      console.error('Failed to prepare purchase:', error);
      setError(error.reason || error.message || 'Failed to calculate purchase cost');
    } finally {
      setIsLoading(false);
    }
  };

  // Execute the actual purchase
  const executePurchase = async () => {
    if (!connection || !purchaseDetails) return;

    setIsLoading(true);
    setError(null);

    try {
      const contract = getPixelCanvasContract(connection);
      const { pixelIds, colors, totalCost } = purchaseDetails;
      const teams = Array(pixelIds.length).fill(selectedTeam);

      // Encode data
      const idsLE = encodeIdsLE(pixelIds);
      const colors24 = encodeColors24(colors);
      const teamBits = encodeTeamBits(teams);

      // Send transaction
      const tx = await contract.buyPacked(idsLE, colors24, teamBits, totalCost, {
        value: totalCost,
      });

      await tx.wait();

      // Close modal and refresh canvas data
      setShowPurchaseModal(false);
      setPurchaseDetails(null);
      setSelectedPixels(new Set());
      setSelectedPixelColors(new Map());
      
      // Force reload pixels by clearing cache and loaded area
      setPixels(new Map());
      setInitialPixelsLoaded(false);
      setIsLoadingPixels(false);
      setLastLoadedArea({ startX: -1, startY: -1, endX: -1, endY: -1 });
      
      await loadCanvasInfo(false); // Don't reset view after purchase

    } catch (error: any) {
      console.error('Failed to buy pixels:', error);
      setError(error.reason || error.message || 'Failed to buy pixels');
    } finally {
      setIsLoading(false);
    }
  };

  // Cancel purchase
  const cancelPurchase = () => {
    setShowPurchaseModal(false);
    setPurchaseDetails(null);
    setIsLoading(false);
  };

  // Canvas drawing and interaction logic would continue here...
  // For brevity, I'll include key interaction functions

  const getPixelFromMouse = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasInfo) return null;

    const rect = canvas.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const gridX = Math.floor((mouseX - pan.x) / scale);
    const gridY = Math.floor((mouseY - pan.y) / scale);

    if (gridX >= 0 && gridX < canvasInfo.width && gridY >= 0 && gridY < canvasInfo.height) {
      return gridY * canvasInfo.width + gridX;
    }
    return null;
  }, [pan, scale, canvasInfo]);

  // Mouse event handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (e.button === 1 || e.ctrlKey) { // Middle mouse or Ctrl+click for panning
      setIsPanning(true);
      setLastPanPoint({ x: e.clientX, y: e.clientY });
      document.body.style.cursor = 'grabbing';
    } else if (e.button === 0) { // Left click for pixel selection
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== null) {
        const newSelected = new Set(selectedPixels);
        const newColors = new Map(selectedPixelColors);
        
        if (e.shiftKey) {
          // Rectangle selection mode
          setDragMode('rectangle');
          setIsDragging(true);
          setDragStart({ x: pixelId % canvasInfo!.width, y: Math.floor(pixelId / canvasInfo!.width) });
        } else {
          // Single pixel or line drawing
          if (newSelected.has(pixelId)) {
            // Clicking on already selected pixel - clear selection and select just this one
            newSelected.clear();
            newColors.clear();
            newSelected.add(pixelId);
            newColors.set(pixelId, selectedColor);
          } else {
            // Add to selection
            newSelected.add(pixelId);
            newColors.set(pixelId, selectedColor);
          }
          
          setSelectedPixels(newSelected);
          setSelectedPixelColors(newColors);
          
          // Start line drawing mode
          setDragMode('line');
          setIsDragging(true);
          setDragStart({ x: pixelId % canvasInfo!.width, y: Math.floor(pixelId / canvasInfo!.width) });
          setDragPath([{ x: pixelId % canvasInfo!.width, y: Math.floor(pixelId / canvasInfo!.width) }]);
        }
      }
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      const newPan = { x: pan.x + deltaX, y: pan.y + deltaY };
      setPan(constrainPan(newPan, scale));
      setLastPanPoint({ x: e.clientX, y: e.clientY });
    } else if (isDragging && canvasInfo) {
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== null) {
        const x = pixelId % canvasInfo.width;
        const y = Math.floor(pixelId / canvasInfo.width);
        
        if (dragMode === 'line' && dragStart) {
          // Update line path
          const linePixels = getLinePixels(dragStart.x, dragStart.y, x, y);
          setDragPath(linePixels);
          
          // Add line pixels to selection
          const newSelected = new Set(selectedPixels);
          const newColors = new Map(selectedPixelColors);
          
          linePixels.forEach(point => {
            const id = point.y * canvasInfo.width + point.x;
            newSelected.add(id);
            newColors.set(id, selectedColor);
          });
          
          setSelectedPixels(newSelected);
          setSelectedPixelColors(newColors);
          
        } else if (dragMode === 'rectangle' && dragStart) {
          // Update rectangle end point
          setDragEnd({ x, y });
        }
        
        // Update hovered pixel for tooltip
        const pixel = pixels.get(pixelId);
        if (pixel && pixel.owner !== hoveredOwner) {
          setHoveredOwner(pixel.owner);
          
          // Calculate owner's pixel counts
          let redCount = 0;
          let blueCount = 0;
          pixels.forEach(p => {
            if (p.owner === pixel.owner) {
              if (p.team === 0) redCount++;
              else if (p.team === 1) blueCount++;
            }
          });
          
          setHoveredOwnerStats({
            redCount,
            blueCount,
            totalCount: redCount + blueCount
          });
        } else if (!pixel) {
          setHoveredOwner(null);
          setHoveredOwnerStats(null);
        }
        
        setHoveredPixel(pixelId);
      }
    } else {
      // Handle hover for tooltip
      const pixelId = getPixelFromMouse(e);
      if (pixelId !== null) {
        const pixel = pixels.get(pixelId);
        if (pixel && pixel.owner !== hoveredOwner) {
          setHoveredOwner(pixel.owner);
          
          // Calculate owner's pixel counts
          let redCount = 0;
          let blueCount = 0;
          pixels.forEach(p => {
            if (p.owner === pixel.owner) {
              if (p.team === 0) redCount++;
              else if (p.team === 1) blueCount++;
            }
          });
          
          setHoveredOwnerStats({
            redCount,
            blueCount,
            totalCount: redCount + blueCount
          });
        } else if (!pixel) {
          setHoveredOwner(null);
          setHoveredOwnerStats(null);
        }
        
        setHoveredPixel(pixelId);
      } else {
        setHoveredPixel(null);
        setHoveredOwner(null);
        setHoveredOwnerStats(null);
      }
    }
  };

  const handleMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    
    if (isPanning) {
      setIsPanning(false);
      document.body.style.cursor = '';
    } else if (isDragging && dragMode === 'rectangle' && dragStart && dragEnd && canvasInfo) {
      // Finalize rectangle selection
      const startX = Math.min(dragStart.x, dragEnd.x);
      const endX = Math.max(dragStart.x, dragEnd.x);
      const startY = Math.min(dragStart.y, dragEnd.y);
      const endY = Math.max(dragStart.y, dragEnd.y);
      
      const newSelected = new Set(selectedPixels);
      const newColors = new Map(selectedPixelColors);
      
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (x >= 0 && x < canvasInfo.width && y >= 0 && y < canvasInfo.height) {
            const id = y * canvasInfo.width + x;
            newSelected.add(id);
            newColors.set(id, selectedColor);
          }
        }
      }
      
      setSelectedPixels(newSelected);
      setSelectedPixelColors(newColors);
    }
    
    // Reset drag state
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPath([]);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLCanvasElement>) => {
    // Reset drag state when mouse leaves canvas
    setIsDragging(false);
    setDragStart(null);
    setDragEnd(null);
    setDragPath([]);
    setHoveredPixel(null);
    setHoveredOwner(null);
    setHoveredOwnerStats(null);
    
    if (isPanning) {
      setIsPanning(false);
      document.body.style.cursor = '';
    }
  };

  // Bresenham's line algorithm for pixel-perfect lines
  const getLinePixels = (x0: number, y0: number, x1: number, y1: number): Array<{ x: number, y: number }> => {
    const points: Array<{ x: number, y: number }> = [];
    
    const dx = Math.abs(x1 - x0);
    const dy = Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx - dy;
    
    let x = x0;
    let y = y0;
    
    while (true) {
      points.push({ x, y });
      
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
    
    return points;
  };

  // Simplified canvas drawing function
  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !canvasInfo) return;
    
    if (!initialPixelsLoaded) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#f8f9fa';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear canvas
    ctx.fillStyle = '#f0f0f0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Calculate visible area
    const visibleStartX = Math.max(0, Math.floor(-pan.x / scale));
    const visibleEndX = Math.min(canvasInfo.width - 1, Math.ceil((canvas.width - pan.x) / scale));
    const visibleStartY = Math.max(0, Math.floor(-pan.y / scale));
    const visibleEndY = Math.min(canvasInfo.height - 1, Math.ceil((canvas.height - pan.y) / scale));

    // Draw grid lines (only in visible area and when zoomed in enough)
    if (scale >= 2) {
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      
      for (let x = visibleStartX; x <= visibleEndX + 1; x++) {
        const lineX = x * scale + pan.x;
        if (lineX >= 0 && lineX <= canvas.width) {
          ctx.moveTo(lineX, Math.max(0, visibleStartY * scale + pan.y));
          ctx.lineTo(lineX, Math.min(canvas.height, (visibleEndY + 1) * scale + pan.y));
        }
      }
      
      for (let y = visibleStartY; y <= visibleEndY + 1; y++) {
        const lineY = y * scale + pan.y;
        if (lineY >= 0 && lineY <= canvas.height) {
          ctx.moveTo(Math.max(0, visibleStartX * scale + pan.x), lineY);
          ctx.lineTo(Math.min(canvas.width, (visibleEndX + 1) * scale + pan.x), lineY);
        }
      }
      ctx.stroke();
    }

    // Draw pixels (only in visible area)
    pixels.forEach((pixel) => {
      if (pixel.x >= visibleStartX && pixel.x <= visibleEndX && 
          pixel.y >= visibleStartY && pixel.y <= visibleEndY) {
        const pixelX = pixel.x * scale + pan.x;
        const pixelY = pixel.y * scale + pan.y;
        
        ctx.fillStyle = `#${pixel.color.toString(16).padStart(6, '0')}`;
        ctx.fillRect(pixelX, pixelY, scale, scale);
        
        // Add white border if this pixel is owned by the same user as the hovered pixel
        if (hoveredOwner && pixel.owner === hoveredOwner && scale >= 2) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX, pixelY, scale, scale);
        }
      }
    });

    // Draw selected pixels with their colors
    selectedPixels.forEach((pixelId) => {
      const x = pixelId % canvasInfo.width;
      const y = Math.floor(pixelId / canvasInfo.width);
      
      if (x >= visibleStartX && x <= visibleEndX && y >= visibleStartY && y <= visibleEndY) {
        const pixelX = x * scale + pan.x;
        const pixelY = y * scale + pan.y;
        
        const pixelColor = selectedPixelColors.get(pixelId) || selectedColor;
        ctx.fillStyle = `#${pixelColor.toString(16).padStart(6, '0')}`;
        ctx.fillRect(pixelX, pixelY, scale, scale);
      }
    });

    // Draw rectangle selection preview
    if (isDragging && dragMode === 'rectangle' && dragStart && dragEnd) {
      const startX = Math.min(dragStart.x, dragEnd.x);
      const endX = Math.max(dragStart.x, dragEnd.x);
      const startY = Math.min(dragStart.y, dragEnd.y);
      const endY = Math.max(dragStart.y, dragEnd.y);
      
      // Fill rectangle preview
      for (let y = startY; y <= endY; y++) {
        for (let x = startX; x <= endX; x++) {
          if (x >= visibleStartX && x <= visibleEndX && y >= visibleStartY && y <= visibleEndY) {
            const pixelX = x * scale + pan.x;
            const pixelY = y * scale + pan.y;
            
            ctx.fillStyle = `#${selectedColor.toString(16).padStart(6, '0')}`;
            ctx.fillRect(pixelX, pixelY, scale, scale);
          }
        }
      }
      
      // Draw rectangle outline
      if (scale >= 1) {
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.strokeRect(
          startX * scale + pan.x,
          startY * scale + pan.y,
          (endX - startX + 1) * scale,
          (endY - startY + 1) * scale
        );
      }
    }

  }, [canvasInfo, pixels, selectedPixels, selectedPixelColors, hoveredOwner, scale, pan, initialPixelsLoaded, isDragging, dragMode, dragStart, dragEnd, selectedColor]);

  // Draw canvas when dependencies change
  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Add wheel event listener for zoom
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheelEvent = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newScale = Math.max(0.1, Math.min(20, scale * delta));
      setScale(newScale);
      
      // Constrain pan after zoom
      setPan(prev => constrainPan(prev, newScale));
    };

    canvas.addEventListener('wheel', handleWheelEvent, { passive: false });
    
    return () => {
      canvas.removeEventListener('wheel', handleWheelEvent);
    };
  }, [scale, constrainPan]);

  if (!connection) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connect Your Wallet</h2>
          <p className="text-gray-600 dark:text-gray-400">Connect MetaMask to start playing PixelETH</p>
        </div>
      </div>
    );
  }

  if (!canvasInfo) {
    return (
      <div className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-lg font-semibold">Loading Canvas...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Color Picker Bar */}
      <InlineColorPicker
        color={selectedColor}
        onChange={setSelectedColor}
        selectedTeam={selectedTeam}
        onTeamChange={setSelectedTeam}
      />

      {/* Action Bar */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-3">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600 dark:text-gray-400">
              Selected: <span className="font-semibold">{selectedPixels.size}</span> pixels
            </span>
            {selectedPixels.size > 0 && (
              <button
                onClick={() => {
                  setSelectedPixels(new Set());
                  setSelectedPixelColors(new Map());
                }}
                className="px-3 py-1 text-sm bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded transition-colors"
              >
                Clear Selection
              </button>
            )}
          </div>

          {selectedPixels.size > 0 && (
            <button
              onClick={preparePurchase}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors font-medium"
            >
              {isLoading ? 'Calculating...' : `Buy ${selectedPixels.size} Pixel${selectedPixels.size !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded text-sm text-red-800 dark:text-red-200 max-w-7xl mx-auto">
            {error}
          </div>
        )}
      </div>

      {/* Main Canvas */}
      <div className="flex-1 relative bg-gray-100 dark:bg-gray-900">
        <canvas
          ref={canvasRef}
          width={typeof window !== 'undefined' ? window.innerWidth : 1920}
          height={typeof window !== 'undefined' ? window.innerHeight - 200 : 800}
          className="cursor-pointer select-none"
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onContextMenu={(e) => e.preventDefault()}
          style={{ display: 'block', width: '100%', height: '100%' }}
        />
        
        {/* Loading Overlay */}
        {isLoadingPixels && (
          <div className="absolute inset-0 bg-gray-50/80 dark:bg-gray-900/80 flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <div className="text-lg font-semibold">Loading pixels...</div>
            </div>
          </div>
        )}

        {/* Canvas Controls */}
        <div className="absolute top-4 right-4 flex gap-2">
          <button 
            onClick={() => {
              const newScale = Math.min(20, scale * 1.2);
              setScale(newScale);
              setPan(prev => constrainPan(prev, newScale));
            }}
            className="w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm flex items-center justify-center font-bold transition-colors"
          >
            +
          </button>
          <button 
            onClick={() => {
              const newScale = Math.max(0.1, scale * 0.8);
              setScale(newScale);
              setPan(prev => constrainPan(prev, newScale));
            }}
            className="w-10 h-10 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm flex items-center justify-center font-bold transition-colors"
          >
            −
          </button>
          <button 
            onClick={() => initializeView()}
            className="px-3 py-2 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm text-sm font-medium transition-colors"
          >
            Fit
          </button>
        </div>

        {/* Pixel Tooltip */}
        {hoveredPixel !== null && hoveredOwnerStats && (
          <div className="absolute pointer-events-none bg-black/80 text-white text-xs rounded-lg px-3 py-2 z-10"
               style={{
                 left: '50%',
                 top: '20px',
                 transform: 'translateX(-50%)'
               }}>
            <div className="space-y-1">
              <div>Owner: {hoveredOwner ? `${hoveredOwner.slice(0, 6)}...${hoveredOwner.slice(-4)}` : 'Unknown'}</div>
              <div className="flex gap-4">
                <span>🔴 {hoveredOwnerStats.redCount}</span>
                <span>🔵 {hoveredOwnerStats.blueCount}</span>
                <span>Total: {hoveredOwnerStats.totalCount}</span>
              </div>
            </div>
          </div>
        )}

        {/* Hover Instructions */}
        <div className="absolute bottom-4 left-4 group">
          <div className="w-8 h-8 bg-black/60 hover:bg-black/80 text-white rounded-full flex items-center justify-center cursor-help transition-colors">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="absolute bottom-full left-0 mb-2 w-80 bg-black/90 text-white text-sm rounded-lg px-4 py-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200">
            <div className="space-y-2">
              <div className="font-semibold text-blue-300">Canvas Controls:</div>
              <div>🖱️ <strong>Click:</strong> Select single pixel</div>
              <div>🖱️ <strong>Click + Drag:</strong> Draw lines</div>
              <div>⇧ <strong>Shift + Drag:</strong> Rectangle selection</div>
              <div>🖲️ <strong>Middle Click + Drag:</strong> Pan canvas</div>
              <div>🔄 <strong>Scroll:</strong> Zoom in/out</div>
              <div>👆 <strong>Hover:</strong> See pixel owner info</div>
            </div>
          </div>
        </div>
      </div>

      {/* Purchase Confirmation Modal */}
      <Modal
        isOpen={showPurchaseModal}
        onClose={cancelPurchase}
        title="Confirm Purchase"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <button
              onClick={cancelPurchase}
              disabled={isLoading}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={executePurchase}
              disabled={isLoading}
              className="px-6 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 text-white rounded-lg transition-colors"
            >
              {isLoading ? 'Processing...' : 'Confirm Purchase'}
            </button>
          </div>
        }
      >
        {purchaseDetails && (
          <div className="space-y-4">
            <div className="text-center">
              <h4 className="text-lg font-semibold mb-2">
                Purchase {purchaseDetails.pixelCount} Pixel{purchaseDetails.pixelCount !== 1 ? 's' : ''}
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Team: <span className={selectedTeam === 0 ? 'text-red-500 font-semibold' : 'text-blue-500 font-semibold'}>
                  {selectedTeam === 0 ? '🔴 Red' : '🔵 Blue'}
                </span>
              </p>
            </div>

            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span>Pixels:</span>
                  <span className="font-semibold">{purchaseDetails.pixelCount}</span>
                </div>
                <div className="flex justify-between">
                  <span>Network:</span>
                  <span className="text-sm">{connection?.type === 'hardhat-local' ? 'Hardhat Local' : 'MetaMask'}</span>
                </div>
                <div className="border-t border-gray-200 dark:border-gray-600 pt-2">
                  <div className="flex justify-between text-lg font-bold">
                    <span>Total Cost:</span>
                    <span>{parseFloat(formatEther(purchaseDetails.totalCost)).toFixed(6)} ETH</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="text-xs text-gray-500 dark:text-gray-400 text-center">
              {connection?.type === 'hardhat-local' 
                ? 'Transaction will be submitted directly to Hardhat network'
                : 'Transaction will be sent to MetaMask for confirmation'
              }
            </div>
          </div>
        )}
      </Modal>
    </>
  );
}