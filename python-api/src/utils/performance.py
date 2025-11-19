"""
Performance monitoring utilities

This module provides decorators and utilities for tracking function performance
"""
import time
import functools
from typing import Callable, Any, Dict, Optional
from loguru import logger


class PerformanceTracker:
    """Track performance metrics for functions"""

    def __init__(self):
        self.metrics = {}

    def track(self, func_name: Optional[str] = None) -> Callable:
        """
        Decorator to track function execution time and metrics

        Args:
            func_name: Optional custom function name (if None, uses actual function name)

        Usage:
            @track_performance
            def my_function():
                pass

            @track_performance("custom_name")
            def another_function():
                pass
        """
        def decorator(func: Callable) -> Callable:
            nonlocal func_name
            if func_name is None:
                func_name = func.__name__

            @functools.wraps(func)
            def wrapper(*args, **kwargs) -> Any:
                # Initialize metrics for this function
                if func_name not in self.metrics:
                    self.metrics[func_name] = {
                        'call_count': 0,
                        'total_time': 0.0,
                        'min_time': float('inf'),
                        'max_time': 0.0
                    }

                # Measure execution time
                start_time = time.perf_counter()
                try:
                    result = func(*args, **kwargs)
                    end_time = time.perf_counter()

                    # Update metrics
                    execution_time = (end_time - start_time) * 1000  # Convert to ms
                    metrics = self.metrics[func_name]
                    metrics['call_count'] += 1
                    metrics['total_time'] += execution_time
                    metrics['min_time'] = min(metrics['min_time'], execution_time)
                    metrics['max_time'] = max(metrics['max_time'], execution_time)

                    # Log slow functions (>100ms)
                    if execution_time > 100:
                        logger.warning(f"Slow function detected: {func_name} took {execution_time:.2f}ms")

                    return result

                except Exception as e:
                    end_time = time.perf_counter()
                    execution_time = (end_time - start_time) * 1000

                    metrics = self.metrics[func_name]
                    metrics['call_count'] += 1
                    metrics['total_time'] += execution_time
                    metrics['min_time'] = min(metrics['min_time'], execution_time)
                    metrics['max_time'] = max(metrics['max_time'], execution_time)

                    logger.error(f"Exception in {func_name} after {execution_time:.2f}ms: {e}")
                    raise

            return wrapper
        return decorator

    def get_metrics(self, func_name: str) -> Optional[Dict[str, Any]]:
        """Get metrics for a specific function"""
        if func_name not in self.metrics:
            return None

        metrics = self.metrics[func_name].copy()
        if metrics['call_count'] > 0:
            metrics['average_time'] = metrics['total_time'] / metrics['call_count']
        else:
            metrics['average_time'] = 0.0

        return metrics

    def get_all_metrics(self) -> Dict[str, Dict[str, Any]]:
        """Get metrics for all tracked functions"""
        result = {}
        for func_name in self.metrics:
            result[func_name] = self.get_metrics(func_name)
        return result

    def reset_metrics(self, func_name: Optional[str] = None) -> None:
        """
        Reset metrics for a specific function or all functions

        Args:
            func_name: Function name to reset (if None, resets all)
        """
        if func_name:
            if func_name in self.metrics:
                del self.metrics[func_name]
                logger.info(f"Reset metrics for {func_name}")
        else:
            self.metrics.clear()
            logger.info("Reset all performance metrics")


# Global performance tracker instance
perf_tracker = PerformanceTracker()


def track_performance(func_name: Optional[str] = None) -> Callable:
    """
    Convenience decorator using global performance tracker

    Usage:
        @track_performance
        def my_function():
            pass
    """
    return perf_tracker.track(func_name)


def get_performance_metrics(func_name: Optional[str] = None) -> Dict[str, Any]:
    """
    Get performance metrics

    Args:
        func_name: Specific function name (if None, returns all)

    Returns:
        Dictionary with performance metrics
    """
    if func_name:
        return perf_tracker.get_metrics(func_name) or {}
    return perf_tracker.get_all_metrics()


def reset_performance_metrics(func_name: Optional[str] = None) -> None:
    """
    Reset performance metrics

    Args:
        func_name: Specific function name (if None, resets all)
    """
    perf_tracker.reset_metrics(func_name)


def log_performance_summary() -> None:
    """Log a summary of all performance metrics"""
    metrics = get_performance_metrics()

    if not metrics:
        logger.info("No performance metrics to report")
        return

    logger.info("=== Performance Summary ===")
    for func_name, func_metrics in metrics.items():
        if func_metrics and func_metrics['call_count'] > 0:
            logger.info(
                f"{func_name}: "
                f"{func_metrics['call_count']} calls | "
                f"avg: {func_metrics['average_time']:.2f}ms | "
                f"min: {func_metrics['min_time']:.2f}ms | "
                f"max: {func_metrics['max_time']:.2f}ms"
            )
    logger.info("==========================")
