/**
 * OpenCV.js Lazy Loader
 *
 * Loads OpenCV.js only when needed (calibration).
 * The library is ~8MB but cached by the browser.
 */

// OpenCV module type (simplified for our use case)
export interface OpenCVModule {
  Mat: new (rows?: number, cols?: number, type?: number) => Mat;
  MatVector: new () => MatVector;
  Size: new (width: number, height: number) => Size;
  Point: new (x: number, y: number) => Point;
  Scalar: new (r: number, g: number, b: number, a?: number) => Scalar;

  // Constants
  CV_8UC1: number;
  CV_8UC4: number;
  RETR_EXTERNAL: number;
  RETR_LIST: number;
  CHAIN_APPROX_SIMPLE: number;
  CHAIN_APPROX_NONE: number;
  COLOR_RGBA2GRAY: number;
  THRESH_BINARY: number;
  THRESH_OTSU: number;
  ADAPTIVE_THRESH_GAUSSIAN_C: number;

  // Functions
  matFromImageData: (imageData: ImageData) => Mat;
  cvtColor: (src: Mat, dst: Mat, code: number) => void;
  GaussianBlur: (src: Mat, dst: Mat, ksize: Size, sigmaX: number) => void;
  Canny: (src: Mat, dst: Mat, threshold1: number, threshold2: number) => void;
  threshold: (src: Mat, dst: Mat, thresh: number, maxval: number, type: number) => number;
  adaptiveThreshold: (src: Mat, dst: Mat, maxValue: number, adaptiveMethod: number, thresholdType: number, blockSize: number, C: number) => void;
  findContours: (image: Mat, contours: MatVector, hierarchy: Mat, mode: number, method: number) => void;
  approxPolyDP: (curve: Mat, approxCurve: Mat, epsilon: number, closed: boolean) => void;
  arcLength: (curve: Mat, closed: boolean) => number;
  contourArea: (contour: Mat) => number;
  boundingRect: (contour: Mat) => Rect;
  minAreaRect: (points: Mat) => RotatedRect;
  drawContours: (image: Mat, contours: MatVector, contourIdx: number, color: Scalar, thickness: number) => void;
  dilate: (src: Mat, dst: Mat, kernel: Mat) => void;
  erode: (src: Mat, dst: Mat, kernel: Mat) => void;
  getStructuringElement: (shape: number, ksize: Size) => Mat;
  MORPH_RECT: number;
  MORPH_ELLIPSE: number;
}

export interface Mat {
  rows: number;
  cols: number;
  data: Uint8Array;
  data32S: Int32Array;
  type: () => number;
  channels: () => number;
  clone: () => Mat;
  delete: () => void;
  setTo: (value: Scalar) => void;
  roi: (rect: Rect) => Mat;
  size: () => Size;
}

export interface MatVector {
  size: () => number;
  get: (index: number) => Mat;
  push_back: (mat: Mat) => void;
  delete: () => void;
}

export interface Size {
  width: number;
  height: number;
}

export interface Point {
  x: number;
  y: number;
}

export interface Scalar {
  [index: number]: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RotatedRect {
  center: Point;
  size: Size;
  angle: number;
}

// Singleton promise for loading
let cvLoadPromise: Promise<OpenCVModule> | null = null;
let cvInstance: OpenCVModule | null = null;

// OpenCV.js CDN URL (smaller build, ~8MB)
const OPENCV_CDN_URL = 'https://docs.opencv.org/4.9.0/opencv.js';

/**
 * Load OpenCV.js lazily from CDN
 * Returns the same promise if already loading/loaded
 */
export async function loadOpenCV(): Promise<OpenCVModule> {
  // Return cached instance
  if (cvInstance) {
    return cvInstance;
  }

  // Return existing promise if already loading
  if (cvLoadPromise) {
    return cvLoadPromise;
  }

  // Check if already loaded globally
  if (typeof window !== 'undefined' && (window as any).cv) {
    cvInstance = (window as any).cv as OpenCVModule;
    return cvInstance;
  }

  // Start loading from CDN
  cvLoadPromise = new Promise<OpenCVModule>((resolve, reject) => {
    console.log('[OpenCV] Loading OpenCV.js from CDN...');
    const startTime = performance.now();

    // Create script element
    const script = document.createElement('script');
    script.src = OPENCV_CDN_URL;
    script.async = true;

    script.onload = () => {
      // OpenCV.js sets up cv on window and calls onRuntimeInitialized when ready
      const checkReady = () => {
        const cv = (window as any).cv;
        if (cv && cv.Mat) {
          const loadTime = (performance.now() - startTime).toFixed(0);
          console.log(`[OpenCV] ✅ Loaded in ${loadTime}ms`);
          cvInstance = cv as OpenCVModule;
          resolve(cvInstance);
        } else if (cv && typeof cv.then === 'function') {
          // cv is a promise (newer builds)
          cv.then((readyCv: OpenCVModule) => {
            const loadTime = (performance.now() - startTime).toFixed(0);
            console.log(`[OpenCV] ✅ Loaded in ${loadTime}ms`);
            cvInstance = readyCv;
            (window as any).cv = readyCv; // Update global reference
            resolve(cvInstance);
          }).catch(reject);
        } else {
          // Not ready yet, wait a bit
          setTimeout(checkReady, 100);
        }
      };

      // Set up the onRuntimeInitialized callback before checking
      if (!(window as any).cv) {
        (window as any).cv = {};
      }
      const originalCallback = (window as any).cv.onRuntimeInitialized;
      (window as any).cv.onRuntimeInitialized = () => {
        if (originalCallback) originalCallback();
        checkReady();
      };

      // Also check immediately in case it's already ready
      setTimeout(checkReady, 50);
    };

    script.onerror = (error) => {
      console.error('[OpenCV] ❌ Failed to load from CDN:', error);
      cvLoadPromise = null; // Allow retry
      reject(new Error('Failed to load OpenCV.js from CDN'));
    };

    document.head.appendChild(script);
  });

  return cvLoadPromise;
}

/**
 * Check if OpenCV is loaded
 */
export function isOpenCVLoaded(): boolean {
  return cvInstance !== null;
}

/**
 * Get OpenCV instance (throws if not loaded)
 */
export function getOpenCV(): OpenCVModule {
  if (!cvInstance) {
    throw new Error('OpenCV not loaded. Call loadOpenCV() first.');
  }
  return cvInstance;
}
