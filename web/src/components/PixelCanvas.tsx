'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useWeb3 } from './Web3Provider';
import { getPixelCanvasContract, formatEther, encodeIdsLE, encodeColors24, encodeTeamBits } from '@/lib/web3';
import { Card, CardBody } from './ui/Card';
import Button from './ui/Button';
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

// Quick color presets for easy access
const QUICK_COLORS = [
  0xFF0000, // Red
  0x00FF00, // Green  
  0x0000FF, // Blue
  0xFFFF00, // Yellow
  0xFF00FF, // Magenta
  0x00FFFF, // Cyan
  0x000000, // Black
  0xFFFFFF, // White
];

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
  const [scale, setScale] = useState(0.31); // Start with a scale that roughly fits 1920x1080 in 600x400
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPanPoint, setLastPanPoint] = useState({ x: 0, y: 0 });
  const [lastLoadedArea, setLastLoadedArea] = useState({ startX: -1, startY: -1, endX: -1, endY: -1 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number, y: number } | null>(null);
  const [dragEnd, setDragEnd] = useState<{ x: number, y: number } | null>(null);
  const [dragMode, setDragMode] = useState<'line' | 'rectangle'>('line');
  const [dragPath, setDragPath] = useState<Array<{ x: number, y: number }>>([]); // For line drawing
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showPurchaseModal, setShowPurchaseModal] = useState(false);
  const [purchaseDetails, setPurchaseDetails] = useState<{
    pixelCount: number;
    totalCost: bigint;
    pixelIds: number[];
    colors: number[];
  } | null>(null);

  // Find all owned pixels efficiently using contract events
  const findAllOwnedPixels = useCallback(async () => {
    if (!connection || !canvasInfo || isLoadingPixels) return;
    
    setIsLoadingPixels(true);
    
    try {
      const contract = getPixelCanvasContract(connection);
      const newPixels = new Map<number, Pixel>();
      
      // Get all PixelBought events from the contract
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
      const chunkSize = 100; // Smaller chunks for better performance
      
      for (let i = 0; i < pixelIdsArray.length; i += chunkSize) {
        const chunk = pixelIdsArray.slice(i, i + chunkSize);
        
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
      
      setPixels(newPixels);
      setInitialPixelsLoaded(true);
      
    } catch (error) {
      console.error('Failed to find owned pixels via events:', error);
      setError('Failed to search for owned pixels');
      setInitialPixelsLoaded(true); // Set to true even on error so canvas can render
    } finally {
      setIsLoadingPixels(false);
    }
  }, [connection, canvasInfo]);

  // Initialize view to fit entire grid
  const initializeView = useCallback(() => {
    if (!canvasInfo) return;
    
    // Get canvas dimensions based on fullscreen mode
    const canvasWidth = isFullscreen ? window.innerWidth : 600;
    const canvasHeight = isFullscreen ? window.innerHeight - 120 : 400; // Leave space for controls in fullscreen
    
    // Calculate scale to fit entire grid in canvas
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
  }, [canvasInfo, isFullscreen]);

  // Constrain pan to keep grid within canvas bounds
  const constrainPan = useCallback((newPan: { x: number, y: number }, currentScale: number) => {
    if (!canvasInfo) return newPan;
    
    const canvasWidth = isFullscreen ? window.innerWidth : 600;
    const canvasHeight = isFullscreen ? window.innerHeight - 120 : 400;
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
  }, [canvasInfo, isFullscreen]);

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
      // No pixels to load, mark as loaded
      setInitialPixelsLoaded(true);
    }
  }, [canvasInfo, isLoadingPixels, findAllOwnedPixels, initialPixelsLoaded]);

  // ESC key handler for exiting fullscreen
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // Re-initialize view when fullscreen mode changes
  useEffect(() => {
    if (canvasInfo) {
      setTimeout(() => initializeView(), 100);
    }
  }, [isFullscreen, canvasInfo, initializeView]);

  const loadCanvasInfo = async (resetView: boolean = true) => {
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
      
      // Initialize view to fit the grid (only on first load)
      if (resetView) {
        setTimeout(() => initializeView(), 100);
      }

    } catch (error) {
      console.error('Failed to load canvas info:', error);
      setError('Failed to load canvas information');
    }
  };

  // Load pixel data for visible area (optimized with area checking)
  const loadPixels = useCallback(async (startX: number, startY: number, endX: number, endY: number, forceReload: boolean = false) => {
    if (!connection || !canvasInfo) return;
    
    // If we already loaded all pixels via findAllOwnedPixels, don't do incremental loading
    if (initialPixelsLoaded && !forceReload) {
      return;
    }

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

      // Only update pixels if we actually loaded new data and it's not conflicting with existing data
      if (newPixels.size > pixels.size || forceReload) {
        setPixels(newPixels);
      }
      setLastLoadedArea({ startX, startY, endX, endY });
    } catch (error) {
      console.error('Failed to load pixels:', error);
    }
  }, [connection, canvasInfo, lastLoadedArea, initialPixelsLoaded, pixels]);

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
    
    // Don't render until initial pixels are loaded to prevent flashing
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
      
      // Calculate grid boundaries in canvas coordinates
      const gridLeft = pan.x;
      const gridTop = pan.y;
      const gridRight = pan.x + canvasInfo.width * scale;
      const gridBottom = pan.y + canvasInfo.height * scale;
      
      for (let x = visibleStartX; x <= visibleEndX + 1; x += gridStepX) {
        const pixelX = x * scale + pan.x;
        if (pixelX >= gridLeft && pixelX <= gridRight) {
          ctx.beginPath();
          ctx.moveTo(pixelX, Math.max(0, gridTop));
          ctx.lineTo(pixelX, Math.min(height, gridBottom));
          ctx.stroke();
        }
      }
      
      for (let y = visibleStartY; y <= visibleEndY + 1; y += gridStepY) {
        const pixelY = y * scale + pan.y;
        if (pixelY >= gridTop && pixelY <= gridBottom) {
          ctx.beginPath();
          ctx.moveTo(Math.max(0, gridLeft), pixelY);
          ctx.lineTo(Math.min(width, gridRight), pixelY);
          ctx.stroke();
        }
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
        
        // Add white border if this pixel is owned by the same user as the hovered pixel
        if (hoveredOwner && pixel.owner === hoveredOwner && scale >= 2) {
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 1;
          ctx.strokeRect(pixelX, pixelY, scale, scale);
        }
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
  }, [canvasInfo, pixels, selectedPixels, selectedPixelColors, hoveredPixel, scale, pan, loadPixels, isDragging, dragStart, dragEnd, dragMode, dragPath, initialPixelsLoaded, hoveredOwner]);

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

  // Add wheel event listener for zoom with proper preventDefault
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
          
        }
      }
    }
  };

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (isPanning) {
      const deltaX = e.clientX - lastPanPoint.x;
      const deltaY = e.clientY - lastPanPoint.y;
      setPan(prev => constrainPan({ x: prev.x + deltaX, y: prev.y + deltaY }, scale));
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
        
        // Update hovered owner and calculate stats
        if (pixelId !== null) {
          const pixel = pixels.get(pixelId);
          if (pixel && pixel.owner !== '0x0000000000000000000000000000000000000000') {
            if (hoveredOwner !== pixel.owner) {
              setHoveredOwner(pixel.owner);
              
              // Calculate owner statistics
              let redCount = 0;
              let blueCount = 0;
              pixels.forEach(p => {
                if (p.owner === pixel.owner) {
                  if (p.team === 0) redCount++;
                  else blueCount++;
                }
              });
              
              setHoveredOwnerStats({
                redCount,
                blueCount,
                totalCount: redCount + blueCount
              });
            }
          } else {
            setHoveredOwner(null);
            setHoveredOwnerStats(null);
          }
        } else {
          setHoveredOwner(null);
          setHoveredOwnerStats(null);
        }
      }
    }
  }, [isPanning, lastPanPoint, isDragging, dragStart, canvasInfo, pan, scale, hoveredPixel, getPixelFromMouse, dragMode, dragPath, selectedPixels, selectedPixelColors, selectedColor, pixels, hoveredOwner, constrainPan]);

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
      } else {
        // Line drawing is already complete from mouse move events
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
    setHoveredOwner(null);
    setHoveredOwnerStats(null);
    document.body.style.cursor = 'default'; // Reset cursor when leaving canvas
  };


  // Buy pixels function
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

  // Define controls component for reuse
  const ControlsComponent = () => (
    <Card>
      <CardBody>
        <div className="flex flex-wrap gap-4 items-start">
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

          {/* Color Picker */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-600 dark:text-gray-300">
                Color:
              </label>
              <input
                type="color"
                value={`#${selectedColor.toString(16).padStart(6, '0')}`}
                onChange={(e) => {
                  const hexColor = e.target.value;
                  const colorInt = parseInt(hexColor.slice(1), 16);
                  setSelectedColor(colorInt);
                }}
                className="w-10 h-10 rounded-lg border-2 border-gray-300 dark:border-gray-600 cursor-pointer hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                title="Select any 24-bit color"
              />
              <div 
                className="w-8 h-8 rounded border-2 border-gray-300 dark:border-gray-600"
                style={{ backgroundColor: `#${selectedColor.toString(16).padStart(6, '0')}` }}
                title="Color preview"
              />
              <div className="text-xs font-mono text-gray-600 dark:text-gray-400">
                #{selectedColor.toString(16).padStart(6, '0').toUpperCase()}
              </div>
            </div>

            {/* Quick Color Presets */}
            <div className="flex items-center gap-1">
              <div className="text-xs text-gray-500 dark:text-gray-400">Quick:</div>
              {QUICK_COLORS.map((color) => (
                <button
                  key={color}
                  className="w-6 h-6 rounded border border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500 transition-colors"
                  style={{ backgroundColor: `#${color.toString(16).padStart(6, '0')}` }}
                  onClick={() => setSelectedColor(color)}
                  title={`#${color.toString(16).padStart(6, '0').toUpperCase()}`}
                />
              ))}
            </div>
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
            onClick={preparePurchase}
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
  );

  if (isFullscreen) {
    return (
      <div className="fixed inset-0 bg-white dark:bg-gray-900 z-50 flex flex-col">
        {/* Controls at top in fullscreen */}
        <div className="p-4">
          <ControlsComponent />
        </div>
        
        {/* Fullscreen Canvas */}
        <div className="flex-1 relative">
          <canvas
            ref={canvasRef}
            width={typeof window !== 'undefined' ? window.innerWidth : 1920}
            height={typeof window !== 'undefined' ? window.innerHeight - 120 : 800}
            className="border border-gray-300 dark:border-gray-600 cursor-pointer select-none"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseLeave}
            onContextMenu={(e) => e.preventDefault()}
          />
          
          {/* Loading Overlay */}
          {isLoadingPixels && (
            <div className="absolute inset-0 bg-gray-50/80 dark:bg-gray-900/80 flex items-center justify-center">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                <div className="text-sm text-gray-600 dark:text-gray-400">Loading pixels...</div>
              </div>
            </div>
          )}
          
          {/* Hover Tooltip */}
          {hoveredOwner && hoveredOwnerStats && (
            <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
              <div className="font-semibold mb-1">Owner: {hoveredOwner.slice(0, 6)}...{hoveredOwner.slice(-4)}</div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded"></div>
                  <span>Red: {hoveredOwnerStats.redCount}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-blue-500 rounded"></div>
                  <span>Blue: {hoveredOwnerStats.blueCount}</span>
                </div>
                <div className="border-t border-gray-600 pt-1 mt-1">
                  <span className="font-semibold">Total: {hoveredOwnerStats.totalCount}</span>
                </div>
              </div>
            </div>
          )}
          
          {/* Canvas Controls */}
          <div className="absolute top-2 right-2 flex gap-2">
            <Button size="sm" onClick={() => {
              const newScale = Math.min(20, scale * 1.2);
              setScale(newScale);
              setPan(prev => constrainPan(prev, newScale));
            }}>
              +
            </Button>
            <Button size="sm" onClick={() => {
              const newScale = Math.max(0.1, scale * 0.8);
              setScale(newScale);
              setPan(prev => constrainPan(prev, newScale));
            }}>
              -
            </Button>
            <Button size="sm" onClick={() => initializeView()}>
              Reset
            </Button>
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => {
                setPixels(new Map());
                setInitialPixelsLoaded(false);
                setIsLoadingPixels(false);
                setLastLoadedArea({ startX: -1, startY: -1, endX: -1, endY: -1 });
                loadCanvasInfo(false); // Don't reset view on refresh
              }}
            >
              Refresh
            </Button>
            {/* Exit Fullscreen Button */}
            <Button 
              size="sm" 
              variant="secondary"
              onClick={() => setIsFullscreen(false)}
              title="Exit Fullscreen (ESC)"
            >
              ⛶
            </Button>
          </div>

          {/* Hover Instructions */}
          <div className="absolute bottom-2 left-2 group">
            <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold cursor-help">
              i
            </div>
            <div className="absolute bottom-8 left-0 invisible group-hover:visible bg-black/90 text-white text-xs p-3 rounded-lg shadow-lg min-w-64 z-10">
              <p className="font-semibold mb-2 text-blue-400">Drawing Controls:</p>
              <div className="space-y-1">
                <p>• <span className="text-green-400">Click:</span> Set single pixel color</p>
                <p>• <span className="text-green-400">Click+Drag:</span> Draw lines and shapes</p>
                <p>• <span className="text-green-400">Shift+Drag:</span> Select rectangle area</p>
                <p>• <span className="text-purple-400">Mouse Wheel:</span> Zoom in/out</p>
                <p>• <span className="text-purple-400">Middle-click drag:</span> Pan canvas</p>
                <p>• <span className="text-blue-400">+/- buttons:</span> Zoom controls</p>
                <p>• <span className="text-yellow-400">Perfect for pixel art creation!</span></p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Controls */}
      <ControlsComponent />

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
              onContextMenu={(e) => e.preventDefault()}
            />
            
            {/* Loading Overlay */}
            {isLoadingPixels && (
              <div className="absolute inset-0 bg-gray-50/80 dark:bg-gray-900/80 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">Loading pixels...</div>
                </div>
              </div>
            )}
            
            {/* Hover Tooltip */}
            {hoveredOwner && hoveredOwnerStats && (
              <div className="absolute top-2 left-2 bg-black/80 text-white text-xs p-2 rounded shadow-lg pointer-events-none">
                <div className="font-semibold mb-1">Owner: {hoveredOwner.slice(0, 6)}...{hoveredOwner.slice(-4)}</div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-red-500 rounded"></div>
                    <span>Red: {hoveredOwnerStats.redCount}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 bg-blue-500 rounded"></div>
                    <span>Blue: {hoveredOwnerStats.blueCount}</span>
                  </div>
                  <div className="border-t border-gray-600 pt-1 mt-1">
                    <span className="font-semibold">Total: {hoveredOwnerStats.totalCount}</span>
                  </div>
                </div>
              </div>
            )}
            
            {/* Canvas Controls */}
            <div className="absolute top-2 right-2 flex gap-2">
              <Button size="sm" onClick={() => {
                const newScale = Math.min(20, scale * 1.2);
                setScale(newScale);
                setPan(prev => constrainPan(prev, newScale));
              }}>
                +
              </Button>
              <Button size="sm" onClick={() => {
                const newScale = Math.max(0.1, scale * 0.8);
                setScale(newScale);
                setPan(prev => constrainPan(prev, newScale));
              }}>
                -
              </Button>
              <Button size="sm" onClick={() => initializeView()}>
                Reset
              </Button>
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => {
                  setPixels(new Map());
                  setInitialPixelsLoaded(false);
                  setIsLoadingPixels(false);
                  setLastLoadedArea({ startX: -1, startY: -1, endX: -1, endY: -1 });
                  loadCanvasInfo(false); // Don't reset view on refresh
                }}
              >
                Refresh
              </Button>
              {/* Enter Fullscreen Button */}
              <Button 
                size="sm" 
                variant="secondary"
                onClick={() => setIsFullscreen(true)}
                title="Enter Fullscreen"
              >
                ⛶
              </Button>
            </div>

            {/* Hover Instructions */}
            <div className="absolute bottom-2 left-2 group">
              <div className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-sm font-bold cursor-help">
                i
              </div>
              <div className="absolute bottom-8 left-0 invisible group-hover:visible bg-black/90 text-white text-xs p-3 rounded-lg shadow-lg min-w-64 z-10">
                <p className="font-semibold mb-2 text-blue-400">Drawing Controls:</p>
                <div className="space-y-1">
                  <p>• <span className="text-green-400">Click:</span> Set single pixel color</p>
                  <p>• <span className="text-green-400">Click+Drag:</span> Draw lines and shapes</p>
                  <p>• <span className="text-green-400">Shift+Drag:</span> Select rectangle area</p>
                  <p>• <span className="text-purple-400">Mouse Wheel:</span> Zoom in/out</p>
                  <p>• <span className="text-purple-400">Middle-click drag:</span> Pan canvas</p>
                  <p>• <span className="text-blue-400">+/- buttons:</span> Zoom controls</p>
                  <p>• <span className="text-yellow-400">Perfect for pixel art creation!</span></p>
                </div>
              </div>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Purchase Confirmation Modal */}
      <Modal
        isOpen={showPurchaseModal}
        onClose={cancelPurchase}
        title="Confirm Purchase"
        size="md"
        footer={
          <div className="flex gap-3 justify-end">
            <Button
              variant="secondary"
              onClick={cancelPurchase}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={executePurchase}
              disabled={isLoading}
            >
              {isLoading ? 'Processing...' : 'Confirm Purchase'}
            </Button>
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
    </div>
  );
}
