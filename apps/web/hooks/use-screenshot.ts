import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useGalleryStore } from '@/stores/gallery-store';

export interface UseScreenshotReturn {
  isCapturing: boolean;
  captureScreenshot: () => Promise<string | null>;
  lastScreenshot: string | null;
}

export function useScreenshot(): UseScreenshotReturn {
  const [isCapturing, setIsCapturing] = useState(false);
  const [lastScreenshot, setLastScreenshot] = useState<string | null>(null);
  const { saveItem } = useGalleryStore();

  const captureScreenshot = async () => {
    setIsCapturing(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');

      if (!ctx) {
        throw new Error('Canvas context not available');
      }

      const videoElement = document.querySelector('video');
      const canvas3D = document.querySelector('canvas');

      if (!videoElement || !canvas3D) {
        throw new Error('Required DOM elements not found');
      }

      canvas.width = videoElement.videoWidth;
      canvas.height = videoElement.videoHeight;

      ctx.drawImage(videoElement, 0, 0);
      ctx.drawImage(canvas3D, 0, 0);

      const dataUrl = canvas.toDataURL('image/png');
      setLastScreenshot(dataUrl);

      await saveItem({
        id: uuidv4(),
        screenshot_data: dataUrl.split(',')[1] || dataUrl, // Remove base64 prefix if present
        jewelry_type: 'screenshot',
        timestamp: Date.now(),
        metadata: {}, // Store additional metadata if needed
      });

      return dataUrl;
    } catch (error) {
      console.error('Screenshot capture failed:', error);
      return null;
    } finally {
      setIsCapturing(false);
    }
  };

  return {
    isCapturing,
    captureScreenshot,
    lastScreenshot,
  };
}
