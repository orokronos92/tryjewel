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

// OpenCV.js CDN URL - using jsdelivr which has better browser compatibility
const OPENCV_CDN_URL = 'https://cdn.jsdelivr.net/npm/opencv.js@1.2.1/opencv.js';

// Timeout for loading (30 seconds)
const LOAD_TIMEOUT = 30000;

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

  // Check if already loaded globally (and ready)
  if (typeof window !== 'undefined' && (window as any).cv && (window as any).cv.Mat) {
    cvInstance = (window as any).cv as OpenCVModule;
    return cvInstance;
  }

  // Start loading from CDN
  cvLoadPromise = new Promise<OpenCVModule>((resolve, reject) => {
    // Timeout handler
    const timeoutId = setTimeout(() => {
      cvLoadPromise = null;
      reject(new Error('OpenCV.js loading timeout'));
    }, LOAD_TIMEOUT);

    // Set up Module BEFORE loading script (OpenCV.js pattern)
    (window as any).Module = {
      onRuntimeInitialized: () => {
        const cv = (window as any).cv;

        // Try waiting a bit for cv.Mat to become available
        let matCheckAttempts = 0;
        const checkMat = () => {
          matCheckAttempts++;
          const cvNow = (window as any).cv;
          if (cvNow && cvNow.Mat) {
            clearTimeout(timeoutId);
            cvInstance = cvNow as OpenCVModule;
            resolve(cvInstance);
          } else if (matCheckAttempts < 50) {
            setTimeout(checkMat, 100);
          }
          // Don't reject - let polling continue
        };
        checkMat();
      }
    };

    // Create and load script
    const script = document.createElement('script');
    script.src = OPENCV_CDN_URL;
    script.async = true;

    script.onload = () => {
      // Fallback: poll for cv.Mat if onRuntimeInitialized doesn't fire
      let attempts = 0;
      const maxAttempts = 100; // 10 seconds max

      const checkReady = () => {
        attempts++;
        const cv = (window as any).cv;

        // Check if cv is a Promise (newer OpenCV.js pattern)
        if (cv && typeof cv.then === 'function' && !cvInstance) {
          // Set a timeout for the Promise
          const promiseTimeout = setTimeout(() => {
            if (cv.Mat) {
              clearTimeout(timeoutId);
              cvInstance = cv as OpenCVModule;
              resolve(cvInstance);
            }
          }, 5000);

          cv.then((readyCv: OpenCVModule) => {
            clearTimeout(promiseTimeout);
            clearTimeout(timeoutId);
            cvInstance = readyCv || cv; // Use cv if readyCv is undefined
            (window as any).cv = cvInstance;
            resolve(cvInstance);
          }).catch(() => {
            clearTimeout(promiseTimeout);
            // Try using cv directly if it has Mat
            if (cv.Mat) {
              cvInstance = cv as OpenCVModule;
              resolve(cvInstance);
            }
          });
          return; // Stop polling
        }

        if (cv && cv.Mat) {
          clearTimeout(timeoutId);
          if (!cvInstance) { // Avoid duplicate resolve
            cvInstance = cv as OpenCVModule;
            resolve(cvInstance);
          }
        } else if (attempts < maxAttempts) {
          setTimeout(checkReady, 100);
        }
        // Don't reject here - let timeout handle failure
      };

      // Start polling after a short delay
      setTimeout(checkReady, 200);
    };

    script.onerror = () => {
      clearTimeout(timeoutId);
      cvLoadPromise = null;
      reject(new Error('Failed to load OpenCV.js script'));
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
