import { useState, useEffect } from 'react';

export interface PerformanceMetrics {
  fps: number;
  latency: number;
  memoryUsage: number;
  frameCount: number;
}

export interface UsePerformanceReturn {
  metrics: PerformanceMetrics;
  resetMetrics: () => void;
}

export function usePerformance(): UsePerformanceReturn {
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    fps: 0,
    latency: 0,
    memoryUsage: 0,
    frameCount: 0,
  });

  useEffect(() => {
    let lastTime = performance.now();
    let frames = 0;

    const measureFPS = () => {
      frames++;
      const currentTime = performance.now();

      if (currentTime >= lastTime + 1000) {
        const fps = Math.round((frames * 1000) / (currentTime - lastTime));
        const memory = (performance as any).memory;
        const memoryUsage = memory ? Math.round(memory.usedJSHeapSize / 1048576) : 0;

        setMetrics(prev => ({
          ...prev,
          fps,
          memoryUsage,
          frameCount: prev.frameCount + frames,
        }));

        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(measureFPS);
    };

    requestAnimationFrame(measureFPS);
  }, []);

  useEffect(() => {
    const measureLatency = (time: number) => {
      const latency = performance.now() - time;
      setMetrics(prev => ({
        ...prev,
        latency: prev.latency * 0.9 + latency * 0.1,
      }));
    };

    const interval = setInterval(() => measureLatency(Date.now()), 100);
    return () => clearInterval(interval);
  }, []);

  const resetMetrics = () => {
    setMetrics({
      fps: 0,
      latency: 0,
      memoryUsage: 0,
      frameCount: 0,
    });
  };

  return {
    metrics,
    resetMetrics,
  };
}
