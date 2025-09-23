// Image processing utilities for canvas stamps

export interface ProcessedImage {
  width: number;
  height: number;
  pixels: number[][]; // 2D array of color values (24-bit RGB)
  originalWidth: number;
  originalHeight: number;
}

export interface StampData {
  id: string;
  name: string;
  processedImage: ProcessedImage;
  previewUrl: string;
  totalPixels: number;
}

// Canvas color palette - these are the available colors for the pixel canvas
export const CANVAS_PALETTE = [
  0x000000, // Black
  0xFFFFFF, // White
  0xFF0000, // Red
  0x00FF00, // Green
  0x0000FF, // Blue
  0xFFFF00, // Yellow
  0xFF00FF, // Magenta
  0x00FFFF, // Cyan
  0x808080, // Gray
  0x800000, // Maroon
  0x008000, // Dark Green
  0x000080, // Navy
  0x808000, // Olive
  0x800080, // Purple
  0x008080, // Teal
  0xC0C0C0, // Silver
  0xFF8000, // Orange
  0x8000FF, // Violet
  0x80FF00, // Lime
  0x0080FF, // Sky Blue
  0xFF0080, // Hot Pink
  0x80FF80, // Light Green
  0xFF8080, // Light Red
  0x8080FF, // Light Blue
  0xFFFF80, // Light Yellow
  0xFF80FF, // Light Magenta
  0x80FFFF, // Light Cyan
  0x404040, // Dark Gray
  0xFFA500, // Orange Alt
  0x654321, // Brown
  0xFFB6C1, // Light Pink
  0x98FB98, // Pale Green
];

// Convert RGB to distance in color space
function colorDistance(c1: number, c2: number): number {
  const r1 = (c1 >> 16) & 0xFF;
  const g1 = (c1 >> 8) & 0xFF;
  const b1 = c1 & 0xFF;
  
  const r2 = (c2 >> 16) & 0xFF;
  const g2 = (c2 >> 8) & 0xFF;
  const b2 = c2 & 0xFF;
  
  // Weighted RGB distance (human eye sensitivity)
  const dr = r1 - r2;
  const dg = g1 - g2;
  const db = b1 - b2;
  
  return Math.sqrt(0.299 * dr * dr + 0.587 * dg * dg + 0.114 * db * db);
}

// Find closest color in canvas palette
export function quantizeColor(rgb: number): number {
  let closestColor = CANVAS_PALETTE[0];
  let minDistance = Infinity;
  
  for (const paletteColor of CANVAS_PALETTE) {
    const distance = colorDistance(rgb, paletteColor);
    if (distance < minDistance) {
      minDistance = distance;
      closestColor = paletteColor;
    }
  }
  
  return closestColor;
}

// Process uploaded image file
export async function processImageFile(file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<ProcessedImage> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      reject(new Error('Could not get canvas context'));
      return;
    }
    
    img.onload = () => {
      try {
        const originalWidth = img.width;
        const originalHeight = img.height;
        
        // Calculate scaled dimensions while maintaining aspect ratio
        let scaledWidth = originalWidth;
        let scaledHeight = originalHeight;
        
        const aspectRatio = originalWidth / originalHeight;
        
        if (scaledWidth > maxWidth) {
          scaledWidth = maxWidth;
          scaledHeight = scaledWidth / aspectRatio;
        }
        
        if (scaledHeight > maxHeight) {
          scaledHeight = maxHeight;
          scaledWidth = scaledHeight * aspectRatio;
        }
        
        // Round to integers
        scaledWidth = Math.round(scaledWidth);
        scaledHeight = Math.round(scaledHeight);
        
        // Set canvas size and draw image
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Use nearest neighbor scaling for pixel art style
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        
        // Get pixel data
        const imageData = ctx.getImageData(0, 0, scaledWidth, scaledHeight);
        const data = imageData.data;
        
        // Convert to 2D array with quantized colors
        const pixels: number[][] = [];
        
        for (let y = 0; y < scaledHeight; y++) {
          pixels[y] = [];
          for (let x = 0; x < scaledWidth; x++) {
            const index = (y * scaledWidth + x) * 4;
            const r = data[index];
            const g = data[index + 1];
            const b = data[index + 2];
            const a = data[index + 3];
            
            // Handle transparency - treat as white or skip
            if (a < 128) {
              pixels[y][x] = 0xFFFFFF; // Transparent becomes white
            } else {
              const rgb = (r << 16) | (g << 8) | b;
              pixels[y][x] = quantizeColor(rgb);
            }
          }
        }
        
        resolve({
          width: scaledWidth,
          height: scaledHeight,
          pixels,
          originalWidth,
          originalHeight
        });
        
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Failed to load image'));
    };
    
    img.src = URL.createObjectURL(file);
  });
}

// Create preview canvas for stamp
export function createStampPreview(processedImage: ProcessedImage): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  
  if (!ctx) {
    throw new Error('Could not get canvas context');
  }
  
  canvas.width = processedImage.width;
  canvas.height = processedImage.height;
  
  const imageData = ctx.createImageData(processedImage.width, processedImage.height);
  const data = imageData.data;
  
  for (let y = 0; y < processedImage.height; y++) {
    for (let x = 0; x < processedImage.width; x++) {
      const index = (y * processedImage.width + x) * 4;
      const color = processedImage.pixels[y][x];
      
      data[index] = (color >> 16) & 0xFF;     // R
      data[index + 1] = (color >> 8) & 0xFF; // G
      data[index + 2] = color & 0xFF;        // B
      data[index + 3] = 255;                 // A
    }
  }
  
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

// Calculate batch transactions for large stamps
export interface TransactionBatch {
  batchIndex: number;
  totalBatches: number;
  pixelIds: number[];
  colors: number[];
  teams: number[];
  description: string;
}

export function calculateStampBatches(
  stampData: ProcessedImage,
  startX: number,
  startY: number,
  canvasWidth: number,
  canvasHeight: number,
  selectedTeam: number,
  maxBatchSize: number = 900
): TransactionBatch[] {
  const batches: TransactionBatch[] = [];
  const allPixels: { id: number; color: number; team: number }[] = [];
  
  // Convert stamp to pixel array
  for (let y = 0; y < stampData.height; y++) {
    for (let x = 0; x < stampData.width; x++) {
      const canvasX = startX + x;
      const canvasY = startY + y;
      
      // Check bounds
      if (canvasX >= 0 && canvasX < canvasWidth && canvasY >= 0 && canvasY < canvasHeight) {
        const pixelId = canvasY * canvasWidth + canvasX;
        const color = stampData.pixels[y][x];
        
        allPixels.push({
          id: pixelId,
          color,
          team: selectedTeam
        });
      }
    }
  }
  
  // Split into batches
  const totalBatches = Math.ceil(allPixels.length / maxBatchSize);
  
  for (let i = 0; i < totalBatches; i++) {
    const start = i * maxBatchSize;
    const end = Math.min(start + maxBatchSize, allPixels.length);
    const batchPixels = allPixels.slice(start, end);
    
    // Sort pixel IDs (required by contract)
    batchPixels.sort((a, b) => a.id - b.id);
    
    batches.push({
      batchIndex: i + 1,
      totalBatches,
      pixelIds: batchPixels.map(p => p.id),
      colors: batchPixels.map(p => p.color),
      teams: batchPixels.map(p => p.team),
      description: `Stamp batch ${i + 1}/${totalBatches} (${batchPixels.length} pixels)`
    });
  }
  
  return batches;
}

// Generate unique ID for stamps
export function generateStampId(): string {
  return `stamp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
