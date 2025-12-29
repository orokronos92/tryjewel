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

/**
 * Load OpenCV.js lazily
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

  // Start loading
  cvLoadPromise = new Promise<OpenCVModule>((resolve, reject) => {
    console.log('[OpenCV] Loading OpenCV.js...');
    const startTime = performance.now();

    // Dynamic import
    import('@techstark/opencv-js')
      .then((cvModule) => {
        // The module exports cv directly or as default
        const cv = (cvModule as any).default || cvModule;

        // Wait for OpenCV to be ready (it has an onRuntimeInitialized callback)
        if (cv.onRuntimeInitialized) {
          // Already initialized
          const loadTime = (performance.now() - startTime).toFixed(0);
          console.log(`[OpenCV] ✅ Loaded in ${loadTime}ms`);
          cvInstance = cv as OpenCVModule;
          resolve(cvInstance);
        } else if (typeof cv.then === 'function') {
          // It's a promise
          cv.then((readyCv: OpenCVModule) => {
            const loadTime = (performance.now() - startTime).toFixed(0);
            console.log(`[OpenCV] ✅ Loaded in ${loadTime}ms`);
            cvInstance = readyCv;
            resolve(cvInstance);
          });
        } else {
          // Assume it's ready
          const loadTime = (performance.now() - startTime).toFixed(0);
          console.log(`[OpenCV] ✅ Loaded in ${loadTime}ms`);
          cvInstance = cv as OpenCVModule;
          resolve(cvInstance);
        }
      })
      .catch((error) => {
        console.error('[OpenCV] ❌ Failed to load:', error);
        cvLoadPromise = null; // Allow retry
        reject(error);
      });
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
