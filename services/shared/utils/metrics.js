/**
 * Metrics Collector - Enterprise-grade metrics collection
 * @module shared/utils/metrics
 */

class MetricsCollector {
  constructor() {
    this.metrics = [];
    this.startTime = Date.now();
    this.namespace = process.env.METRICS_NAMESPACE || 'aws-k6-enterprise';
  }

  /**
   * Record a counter metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} tags - Additional tags
   */
  recordCount(name, value = 1, tags = {}) {
    this.recordMetric('count', name, value, tags);
  }

  /**
   * Record a gauge metric
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} tags - Additional tags
   */
  recordGauge(name, value, tags = {}) {
    this.recordMetric('gauge', name, value, tags);
  }

  /**
   * Record a latency metric
   * @param {string} name - Metric name
   * @param {number} value - Latency in milliseconds
   * @param {Object} tags - Additional tags
   */
  recordLatency(name, value, tags = {}) {
    this.recordMetric('histogram', name, value, { ...tags, unit: 'milliseconds' });
  }

  /**
   * Record a generic metric
   * @param {string} type - Metric type (count, gauge, histogram)
   * @param {string} name - Metric name
   * @param {number} value - Metric value
   * @param {Object} tags - Additional tags
   */
  recordMetric(type, name, value, tags = {}) {
    const metric = {
      type,
      name: `${this.namespace}.${name}`,
      value,
      timestamp: Date.now(),
      tags: {
        service: 'lambda-s3',
        environment: process.env.NODE_ENV || 'development',
        region: process.env.AWS_REGION || 'us-east-1',
        ...tags
      }
    };

    this.metrics.push(metric);

    // Log metric for CloudWatch (in AWS Lambda environment)
    if (process.env.AWS_LAMBDA_FUNCTION_NAME) {
      console.log(JSON.stringify({
        metricType: 'METRIC',
        ...metric
      }));
    }

    // Keep only last 1000 metrics in memory
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  /**
   * Start timing an operation
   * @param {string} name - Operation name
   * @returns {Function} Function to call when operation completes
   */
  startTimer(name) {
    const startTime = Date.now();
    
    return (tags = {}) => {
      const duration = Date.now() - startTime;
      this.recordLatency(name, duration, tags);
      return duration;
    };
  }

  /**
   * Record business metrics
   * @param {string} operation - Business operation name
   * @param {string} status - Operation status (success, failure)
   * @param {number} duration - Operation duration
   * @param {Object} additionalTags - Additional tags
   */
  recordBusinessMetric(operation, status, duration, additionalTags = {}) {
    this.recordCount(`business.${operation}.${status}`, 1, additionalTags);
    this.recordLatency(`business.${operation}.duration`, duration, { status, ...additionalTags });
  }

  /**
   * Get current metrics summary
   * @returns {Object} Metrics summary
   */
  getSummary() {
    const summary = {
      totalMetrics: this.metrics.length,
      uptime: Date.now() - this.startTime,
      byType: {},
      byName: {}
    };

    this.metrics.forEach(metric => {
      // Count by type
      summary.byType[metric.type] = (summary.byType[metric.type] || 0) + 1;
      
      // Count by name
      summary.byName[metric.name] = (summary.byName[metric.name] || 0) + 1;
    });

    return summary;
  }

  /**
   * Export metrics in CloudWatch format
   * @returns {Array} CloudWatch metric data
   */
  exportCloudWatchMetrics() {
    return this.metrics.map(metric => ({
      MetricName: metric.name,
      Value: metric.value,
      Unit: this.getCloudWatchUnit(metric.type, metric.tags.unit),
      Timestamp: new Date(metric.timestamp),
      Dimensions: Object.entries(metric.tags).map(([Name, Value]) => ({
        Name,
        Value: String(Value)
      }))
    }));
  }

  /**
   * Get CloudWatch unit for metric type
   * @param {string} type - Metric type
   * @param {string} unit - Custom unit
   * @returns {string} CloudWatch unit
   */
  getCloudWatchUnit(type, unit) {
    if (unit) return unit === 'milliseconds' ? 'Milliseconds' : unit;
    
    switch (type) {
      case 'count':
        return 'Count';
      case 'gauge':
        return 'None';
      case 'histogram':
        return 'Milliseconds';
      default:
        return 'None';
    }
  }

  /**
   * Clear all metrics
   */
  clear() {
    this.metrics = [];
  }

  /**
   * Record health check metric
   * @param {string} component - Component name
   * @param {boolean} healthy - Health status
   * @param {number} responseTime - Response time in ms
   */
  recordHealthCheck(component, healthy, responseTime) {
    this.recordGauge(`health.${component}`, healthy ? 1 : 0, {
      component,
      status: healthy ? 'healthy' : 'unhealthy'
    });
    
    if (responseTime !== undefined) {
      this.recordLatency(`health.${component}.response_time`, responseTime, {
        component
      });
    }
  }

  /**
   * Record error metrics with categorization
   * @param {string} errorType - Type of error
   * @param {string} operation - Operation that failed
   * @param {Object} tags - Additional tags
   */
  recordError(errorType, operation, tags = {}) {
    this.recordCount('errors.total', 1, { errorType, operation, ...tags });
    this.recordCount(`errors.by_type.${errorType}`, 1, { operation, ...tags });
    this.recordCount(`errors.by_operation.${operation}`, 1, { errorType, ...tags });
  }
}

module.exports = { MetricsCollector };
