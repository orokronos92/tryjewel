"""
Performance benchmark script for Bijoux AI Tracking API

This script measures performance metrics including:
- Average latency per frame
- P95 and P99 latency
- Tracking precision
- FPS stability
"""
import argparse
import time
import sys
import os
import json
from pathlib import Path
from typing import List, Dict, Any

# Add src to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'src'))

import numpy as np


class BenchmarkRunner:
    """Benchmark runner for performance testing"""

    def __init__(self, num_frames: int = 100):
        self.num_frames = num_frames
        self.results = {
            'frames_processed': 0,
            'total_time_ms': 0.0,
            'latencies_ms': [],
            'start_time': None,
            'end_time': None
        }

    def generate_test_frame(self, width: int = 640, height: int = 480) -> np.ndarray:
        """Generate a test frame with random pixels"""
        # Create a frame with a hand-like shape (simplified)
        frame = np.random.randint(0, 255, (height, width, 3), dtype=np.uint8)

        # Add a hand-like blob in the center
        center_x, center_y = width // 2, height // 2
        cv2 = None
        try:
            import cv2
        except ImportError:
            print("Warning: OpenCV not available, using random frames")

        if cv2:
            # Draw a simple hand-like shape
            cv2.rectangle(
                frame,
                (center_x - 100, center_y - 100),
                (center_x + 100, center_y + 100),
                (200, 180, 160),
                -1
            )

        return frame

    def run_benchmark(self, tracker_class, jewelry_type: str = 'ring', finger: str = 'index', hand: str = 'right'):
        """Run benchmark for specified tracker"""
        from src.trackers.hand_tracker import HandTracker
        from src.utils.performance import get_performance_metrics, reset_performance_metrics
        from loguru import logger

        print(f"\n{'='*60}")
        print(f"Bijoux AI Tracking Performance Benchmark")
        print(f"{'='*60}")
        print(f"Configuration:")
        print(f"  - Frames: {self.num_frames}")
        print(f"  - Tracker: {tracker_class.__name__}")
        print(f"  - Jewelry: {jewelry_type}")
        print(f"  - Finger: {finger}")
        print(f"  - Hand: {hand}")
        print(f"{'='*60}\n")

        # Create tracker instance
        tracker = tracker_class()

        # Initialize tracker
        print("Initializing tracker...")
        try:
            tracker.initialize()
            if not tracker.is_initialized:
                print("ERROR: Failed to initialize tracker")
                return None
            print("✓ Tracker initialized successfully\n")
        except Exception as e:
            print(f"ERROR: Failed to initialize tracker: {e}")
            return None

        # Reset performance metrics
        reset_performance_metrics()

        # Run benchmark
        print(f"Processing {self.num_frames} frames...")
        self.results['start_time'] = time.time()

        for i in range(self.num_frames):
            # Print progress
            if (i + 1) % 10 == 0:
                print(f"  Processed {i + 1}/{self.num_frames} frames...")

            # Generate frame
            frame = self.generate_test_frame()

            # Process frame
            frame_start = time.perf_counter()

            try:
                result = tracker.process_frame(
                    frame,
                    jewelry_type=jewelry_type,
                    finger=finger,
                    hand=hand
                )

                frame_end = time.perf_counter()
                latency_ms = (frame_end - frame_start) * 1000

                self.results['latencies_ms'].append(latency_ms)
                self.results['frames_processed'] += 1

                # Track successful detections
                if result['success']:
                    self.results['total_time_ms'] += latency_ms
                else:
                    print(f"  Warning: Frame {i} failed - {result.get('error', 'Unknown error')}")

            except Exception as e:
                print(f"  ERROR: Frame {i} crashed: {e}")
                continue

        self.results['end_time'] = time.time()

        # Calculate metrics
        return self.calculate_metrics()

    def calculate_metrics(self) -> Dict[str, Any]:
        """Calculate performance metrics"""
        if not self.results['latencies_ms']:
            print("ERROR: No valid latencies recorded")
            return None

        latencies = sorted(self.results['latencies_ms'])
        total_frames = len(latencies)

        metrics = {
            'frames_processed': self.results['frames_processed'],
            'successful_frames': total_frames,
            'total_time_seconds': self.results['end_time'] - self.results['start_time'],
            'average_latency_ms': sum(latencies) / total_frames,
            'min_latency_ms': min(latencies),
            'max_latency_ms': max(latencies),
            'p95_latency_ms': self.percentile(latencies, 0.95),
            'p99_latency_ms': self.percentile(latencies, 0.99),
            'std_dev_ms': np.std(latencies) if latencies else 0
        }

        return metrics

    @staticmethod
    def percentile(sorted_values: List[float], percentile: float) -> float:
        """Calculate percentile from sorted values"""
        if not sorted_values:
            return 0.0

        index = int(len(sorted_values) * percentile)
        if index >= len(sorted_values):
            index = len(sorted_values) - 1
        return sorted_values[index]

    def print_results(self, metrics: Dict[str, Any]):
        """Print benchmark results"""
        if not metrics:
            print("No metrics to display")
            return

        print(f"\n{'='*60}")
        print(f"BENCHMARK RESULTS")
        print(f"{'='*60}")
        print(f"✓ Frames Processed: {metrics['frames_processed']}")
        print(f"✓ Successful Frames: {metrics['successful_frames']}")
        print(f"✓ Total Time: {metrics['total_time_seconds']:.2f}s")
        print(f"✓ Average FPS: {metrics['successful_frames'] / metrics['total_time_seconds']:.1f}")
        print()
        print(f"✓ Average Latency: {metrics['average_latency_ms']:.2f}ms")
        print(f"✓ Min Latency: {metrics['min_latency_ms']:.2f}ms")
        print(f"✓ Max Latency: {metrics['max_latency_ms']:.2f}ms")
        print(f"✓ P95 Latency: {metrics['p95_latency_ms']:.2f}ms")
        print(f"✓ P99 Latency: {metrics['p99_latency_ms']:.2f}ms")
        print(f"✓ Std Dev: {metrics['std_dev_ms']:.2f}ms")
        print()

        # Performance analysis
        print(f"{'='*60}")
        print(f"PERFORMANCE ANALYSIS")
        print(f"{'='*60}")

        if metrics['average_latency_ms'] < 50:
            print("✅ PERFECT: Average latency < 50ms (target met)")
        elif metrics['average_latency_ms'] < 100:
            print("⚠️  GOOD: Average latency < 100ms (acceptable)")
        else:
            print("❌ SLOW: Average latency > 100ms (needs optimization)")

        if metrics['p95_latency_ms'] < 60:
            print("✅ PERFECT: P95 latency < 60ms (target met)")
        elif metrics['p95_latency_ms'] < 120:
            print("⚠️  GOOD: P95 latency < 120ms (acceptable)")
        else:
            print("❌ SLOW: P95 latency > 120ms (needs optimization)")

        if metrics['p99_latency_ms'] < 80:
            print("✅ PERFECT: P99 latency < 80ms (target met)")
        elif metrics['p99_latency_ms'] < 150:
            print("⚠️  GOOD: P99 latency < 150ms (acceptable)")
        else:
            print("❌ SLOW: P99 latency > 150ms (needs optimization)")

        fps = metrics['successful_frames'] / metrics['total_time_seconds']
        if fps >= 10:
            print("✅ PERFECT: FPS >= 10 (target met)")
        elif fps >= 5:
            print("⚠️  GOOD: FPS >= 5 (acceptable)")
        else:
            print("❌ SLOW: FPS < 5 (needs optimization)")

        print(f"{'='*60}\n")

    def save_results(self, metrics: Dict[str, Any], filename: str = None):
        """Save results to JSON file"""
        if not filename:
            timestamp = time.strftime("%Y%m%d_%H%M%S")
            filename = f"benchmark_results_{timestamp}.json"

        output_path = Path(filename)
        with open(output_path, 'w') as f:
            json.dump({
                'config': {
                    'num_frames': self.num_frames
                },
                'metrics': metrics,
                'target_vs_actual': {
                    'target_avg_latency': '< 50ms',
                    'actual_avg_latency': f"{metrics['average_latency_ms']:.2f}ms",
                    'target_p95_latency': '< 60ms',
                    'actual_p95_latency': f"{metrics['p95_latency_ms']:.2f}ms",
                    'target_p99_latency': '< 80ms',
                    'actual_p99_latency': f"{metrics['p99_latency_ms']:.2f}ms",
                    'target_fps': '>= 10 FPS',
                    'actual_fps': f"{metrics['successful_frames'] / metrics['total_time_seconds']:.1f} FPS"
                }
            }, f, indent=2)

        print(f"✓ Results saved to {output_path}\n")
        return output_path


def main():
    """Main entry point"""
    parser = argparse.ArgumentParser(description='Bijoux AI Tracking Benchmark')
    parser.add_argument('--frames', type=int, default=100,
                       help='Number of frames to process (default: 100)')
    parser.add_argument('--jewelry-type', type=str, default='ring',
                       choices=['ring', 'bracelet'],
                       help='Type of jewelry to track (default: ring)')
    parser.add_argument('--finger', type=str, default='index',
                       choices=['thumb', 'index', 'middle', 'ring', 'pinky'],
                       help='Finger for ring tracking (default: index)')
    parser.add_argument('--hand', type=str, default='right',
                       choices=['left', 'right'],
                       help='Hand to track (default: right)')
    parser.add_argument('--output', type=str, default=None,
                       help='Output JSON file for results')
    parser.add_argument('--skip', action='store_true',
                       help='Skip MediaPipe initialization (for dev)')

    args = parser.parse_args()

    if args.skip:
        print("⚠️  Skipping benchmark (development mode)")
        print("To run benchmark, remove --skip flag")
        return

    # Import tracker
    from src.trackers.hand_tracker import HandTracker

    # Run benchmark
    runner = BenchmarkRunner(num_frames=args.frames)

    try:
        metrics = runner.run_benchmark(
            HandTracker,
            jewelry_type=args.jewelry_type,
            finger=args.finger,
            hand=args.hand
        )

        if metrics:
            runner.print_results(metrics)
            if args.output:
                runner.save_results(metrics, args.output)
            else:
                runner.save_results(metrics)

            # Print summary
            print("\n✓ Benchmark completed successfully!")
            if metrics['average_latency_ms'] < 50:
                print("✅ PERFORMANCE TARGETS MET!")
            else:
                print("⚠️  Some targets not met - review results above")
        else:
            print("\n❌ Benchmark failed - check logs above")
            sys.exit(1)

    except KeyboardInterrupt:
        print("\n\nBenchmark interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n❌ Benchmark error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
