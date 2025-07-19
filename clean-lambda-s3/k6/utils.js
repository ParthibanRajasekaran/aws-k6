import { sleep } from 'k6';
import { check, fail } from 'k6';
import http from 'k6/http';
import { Rate, Trend, Counter } from 'k6/metrics';

// Simple random string generator to replace external dependency
export function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Load config from JSON file
export const config = JSON.parse(open('../config/k6-config.json'));

// Get base URL for API calls
export const getBaseUrl = () => __ENV.API_URL || 'http://localhost:3000';

// Enhanced metrics for better reporting
export const enhancedMetrics = {
  retries: new Counter('retries'),
  errors: new Rate('errors'),
  requestDuration: new Trend('request_duration'),
  uploadSuccess: new Rate('upload_success'),
  downloadSuccess: new Rate('download_success')
};

// Generate a test file with customizable size
export const generateTestFile = (prefix = 'test', sizeInKb = 1) => {
  const timestamp = Date.now();
  const filename = `${prefix}-${timestamp}.txt`;
  
  // Generate content of specified size
  let content = `Test file created at ${new Date(timestamp).toISOString()}\n${prefix}-${randomString(20)}\n`;
  const charsNeeded = Math.max(0, (sizeInKb * 1024) - content.length);
  
  if (charsNeeded > 0) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < charsNeeded; i++) {
      content += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  }
  
  return {
    content,
    filename,
    size: content.length
  };
};

// Enhanced response checking with detailed logging
export const checkResponse = (res, metrics, operation) => {
  const success = res.status === 200;
  metrics[operation].failures.add(!success);
  
  if (!success) {
    console.error(`${operation} failed: Status ${res.status}`);
    console.error(`Response: ${res.body}`);
    enhancedMetrics.errors.add(1, { operation });
  } else {
    if (operation === 'upload') enhancedMetrics.uploadSuccess.add(1);
    if (operation === 'download') enhancedMetrics.downloadSuccess.add(1);
  }
  
  return success;
};

// Measure duration of operation with detailed metrics
export const measureDuration = (fn, metricObj, operation) => {
  const start = Date.now();
  const result = fn();
  const duration = Date.now() - start;
  
  // Check if metricObj has a duration property, otherwise assume it IS the duration metric
  if (metricObj && metricObj.duration) {
    metricObj.duration.add(duration);
  } else if (metricObj && typeof metricObj.add === 'function') {
    metricObj.add(duration);
  }
  
  // Add to enhanced metrics if available
  if (enhancedMetrics && enhancedMetrics.requestDuration) {
    enhancedMetrics.requestDuration.add(duration, { operation });
  }
  
  return result;
};

// Configurable sleep with jitter for realistic load
export const defaultSleep = (baseSeconds = 0.5, jitterPct = 0.2) => {
  const jitter = baseSeconds * jitterPct * (Math.random() - 0.5) * 2; // +/- jitterPct%
  sleep(baseSeconds + jitter);
};

// Add retry capability for HTTP requests
export const retryableRequest = (requestFn, options = {}) => {
  const maxRetries = options.maxRetries || 3;
  const retryDelay = options.retryDelay || 1; // in seconds
  const retryableStatusCodes = options.retryStatusCodes || [408, 429, 500, 502, 503, 504];
  
  let response;
  let retries = 0;
  
  while (retries <= maxRetries) {
    response = requestFn();
    
    if (response.status < 400 || !retryableStatusCodes.includes(response.status)) {
      return response; // Success or non-retryable error
    }
    
    console.warn(`Retry ${retries+1}/${maxRetries} - Status: ${response.status}`);
    enhancedMetrics.retries.add(1);
    
    if (retries < maxRetries) {
      sleep(retryDelay);
    }
    
    retries++;
  }
  
  return response; // Return the last response if all retries fail
};

// Warmup function to stabilize performance before main test
export const warmup = (options = {}) => {
  const duration = options.duration || 5; // seconds
  const endpoint = options.endpoint || `${getBaseUrl()}/health`;
  
  console.log(`Running ${duration}s warmup against ${endpoint}`);
  
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + duration * 1000);
  
  while (new Date() < endTime) {
    http.get(endpoint);
    sleep(0.2);
  }
};
