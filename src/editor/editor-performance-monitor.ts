/**
 * Editor Performance Monitor
 * Tracks editor loading, content processing, and user interaction performance
 */

export interface PerformanceMetrics {
  editorInitTime: number;
  contentLoadTime: number;
  contentSwitchTime: number;
  averageRenderTime: number;
  memoryUsage: number;
  userInteractions: number;
  errorCount: number;
  timestamp: string;
}

export interface PerformanceMeasurement {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
  metadata?: Record<string, any>;
}

/**
 * Performance monitoring for editor components
 */
export class EditorPerformanceMonitor {
  private measurements: Map<string, PerformanceMeasurement> = new Map();
  private metrics: Partial<PerformanceMetrics> = {};
  private isEnabled = true;
  private reportingCallback?: (metrics: PerformanceMetrics) => void;

  constructor(enabled = true) {
    this.isEnabled = enabled;
    this.initializeMemoryTracking();
  }

  /**
   * Start measuring a performance metric
   */
  startMeasurement(
    id: string,
    name: string,
    metadata?: Record<string, any>,
  ): void {
    if (!this.isEnabled) return;

    const measurement: PerformanceMeasurement = {
      id,
      name,
      startTime: performance.now(),
      metadata,
    };

    this.measurements.set(id, measurement);
  }

  /**
   * End a performance measurement
   */
  endMeasurement(id: string): number | null {
    if (!this.isEnabled) return null;

    const measurement = this.measurements.get(id);
    if (!measurement) {
      console.warn(`⚠️ Performance measurement not found: ${id}`);
      return null;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    // Update relevant metrics
    this.updateMetrics(measurement);

    console.log(`📊 ${measurement.name}: ${measurement.duration.toFixed(2)}ms`);
    return measurement.duration;
  }

  /**
   * Measure editor initialization time
   */
  measureEditorInit(callback: () => Promise<void>): Promise<void> {
    return this.measureAsync("editor-init", "Editor Initialization", callback);
  }

  /**
   * Measure content loading time
   */
  measureContentLoad(callback: () => Promise<void>): Promise<void> {
    return this.measureAsync("content-load", "Content Loading", callback);
  }

  /**
   * Measure content type switching time
   */
  measureContentSwitch(
    fromType: string,
    toType: string,
    callback: () => Promise<void>,
  ): Promise<void> {
    return this.measureAsync(
      "content-switch",
      "Content Type Switch",
      callback,
      { fromType, toType },
    );
  }

  /**
   * Measure async operation
   */
  async measureAsync(
    id: string,
    name: string,
    callback: () => Promise<void>,
    metadata?: Record<string, any>,
  ): Promise<void> {
    this.startMeasurement(id, name, metadata);
    try {
      await callback();
    } finally {
      this.endMeasurement(id);
    }
  }

  /**
   * Measure sync operation
   */
  measureSync<T>(
    id: string,
    name: string,
    callback: () => T,
    metadata?: Record<string, any>,
  ): T {
    this.startMeasurement(id, name, metadata);
    try {
      return callback();
    } finally {
      this.endMeasurement(id);
    }
  }

  /**
   * Track user interaction
   */
  trackInteraction(type: string, details?: Record<string, any>): void {
    if (!this.isEnabled) return;

    this.metrics.userInteractions = (this.metrics.userInteractions || 0) + 1;

    console.log(`👆 User interaction: ${type}`, details);
  }

  /**
   * Track error occurrence
   */
  trackError(error: Error, context?: string): void {
    if (!this.isEnabled) return;

    this.metrics.errorCount = (this.metrics.errorCount || 0) + 1;

    console.error(`❌ Editor error in ${context}:`, error);
  }

  /**
   * Get current performance metrics
   */
  getMetrics(): Partial<PerformanceMetrics> {
    return {
      ...this.metrics,
      memoryUsage: this.getCurrentMemoryUsage(),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get all measurements
   */
  getMeasurements(): PerformanceMeasurement[] {
    return Array.from(this.measurements.values());
  }

  /**
   * Clear all measurements and reset metrics
   */
  reset(): void {
    this.measurements.clear();
    this.metrics = {};
  }

  /**
   * Set reporting callback for metrics
   */
  setReportingCallback(callback: (metrics: PerformanceMetrics) => void): void {
    this.reportingCallback = callback;
  }

  /**
   * Generate performance report
   */
  generateReport(): string {
    const metrics = this.getMetrics();
    const measurements = this.getMeasurements();

    let report = "📊 Editor Performance Report\n";
    report += "================================\n\n";

    // Metrics summary
    report += "📈 Metrics Summary:\n";
    if (metrics.editorInitTime) {
      report += `• Editor Init: ${metrics.editorInitTime.toFixed(2)}ms\n`;
    }
    if (metrics.contentLoadTime) {
      report += `• Content Load: ${metrics.contentLoadTime.toFixed(2)}ms\n`;
    }
    if (metrics.contentSwitchTime) {
      report += `• Content Switch: ${metrics.contentSwitchTime.toFixed(2)}ms\n`;
    }
    if (metrics.averageRenderTime) {
      report += `• Average Render: ${metrics.averageRenderTime.toFixed(2)}ms\n`;
    }
    if (metrics.memoryUsage) {
      report += `• Memory Usage: ${(metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB\n`;
    }
    if (metrics.userInteractions) {
      report += `• User Interactions: ${metrics.userInteractions}\n`;
    }
    if (metrics.errorCount) {
      report += `• Errors: ${metrics.errorCount}\n`;
    }

    report += "\n";

    // Recent measurements
    if (measurements.length > 0) {
      report += "📋 Recent Measurements:\n";
      measurements
        .filter((m) => m.duration !== undefined)
        .sort((a, b) => (b.startTime || 0) - (a.startTime || 0))
        .slice(0, 10)
        .forEach((m) => {
          report += `• ${m.name}: ${m.duration!.toFixed(2)}ms\n`;
          if (m.metadata) {
            Object.entries(m.metadata).forEach(([key, value]) => {
              report += `  - ${key}: ${value}\n`;
            });
          }
        });
    }

    return report;
  }

  /**
   * Enable or disable monitoring
   */
  setEnabled(enabled: boolean): void {
    this.isEnabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Check if monitoring is enabled
   */
  isMonitoringEnabled(): boolean {
    return this.isEnabled;
  }

  /**
   * Update metrics based on measurement
   */
  private updateMetrics(measurement: PerformanceMeasurement): void {
    if (!measurement.duration) return;

    switch (measurement.name) {
      case "Editor Initialization":
        this.metrics.editorInitTime = measurement.duration;
        break;
      case "Content Loading":
        this.metrics.contentLoadTime = measurement.duration;
        break;
      case "Content Type Switch":
        this.metrics.contentSwitchTime = measurement.duration;
        break;
      default:
        // Update average render time for other operations
        if (this.metrics.averageRenderTime) {
          this.metrics.averageRenderTime =
            (this.metrics.averageRenderTime + measurement.duration) / 2;
        } else {
          this.metrics.averageRenderTime = measurement.duration;
        }
    }

    // Report metrics if callback is set
    if (this.reportingCallback && this.isComplete()) {
      this.reportingCallback(this.getMetrics() as PerformanceMetrics);
    }
  }

  /**
   * Initialize memory usage tracking
   */
  private initializeMemoryTracking(): void {
    if (!this.isEnabled) return;

    // Track memory usage periodically
    setInterval(() => {
      this.metrics.memoryUsage = this.getCurrentMemoryUsage();
    }, 30000); // Every 30 seconds
  }

  /**
   * Get current memory usage (if available)
   */
  private getCurrentMemoryUsage(): number {
    try {
      // Use performance.memory if available (Chrome)
      if ("memory" in performance) {
        return (performance as any).memory.usedJSHeapSize;
      }

      // Fallback estimation
      return 0;
    } catch {
      return 0;
    }
  }

  /**
   * Check if we have complete metrics
   */
  private isComplete(): boolean {
    return !!(
      this.metrics.editorInitTime &&
      this.metrics.contentLoadTime &&
      this.metrics.memoryUsage
    );
  }
}

/**
 * Global performance monitor instance
 */
export const editorPerformanceMonitor = new EditorPerformanceMonitor();

/**
 * Performance measurement decorator
 */
export function measurePerformance(name: string) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const id = `${target.constructor.name}-${propertyKey}-${Date.now()}`;

      if (originalMethod.constructor.name === "AsyncFunction") {
        return editorPerformanceMonitor.measureAsync(id, name, () =>
          originalMethod.apply(this, args),
        );
      } else {
        return editorPerformanceMonitor.measureSync(id, name, () =>
          originalMethod.apply(this, args),
        );
      }
    };

    return descriptor;
  };
}

/**
 * Quick helper functions
 */
export const perf = {
  start: (id: string, name: string, metadata?: Record<string, any>) =>
    editorPerformanceMonitor.startMeasurement(id, name, metadata),

  end: (id: string) => editorPerformanceMonitor.endMeasurement(id),

  track: (type: string, details?: Record<string, any>) =>
    editorPerformanceMonitor.trackInteraction(type, details),

  error: (error: Error, context?: string) =>
    editorPerformanceMonitor.trackError(error, context),

  report: () => editorPerformanceMonitor.generateReport(),
};
