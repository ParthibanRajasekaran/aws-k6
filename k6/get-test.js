import http from 'k6/http';
import { check } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { 
  config, 
  getBaseUrl, 
  enhancedMetrics, 
  generateTestFile, 
  checkResponse,
  measureDuration, 
  defaultSleep, 
  retryableRequest,
  warmup 
} from './utils.js';

export const options = {
  stages: [
    { duration: '10s', target: 5 },     // Gentle warm-up
    { duration: '30s', target: 20 },    // Ramp-up to 20 VUs
    { duration: '1m', target: 100 },    // Increase to 100 VUs (downloads can handle more concurrent requests)
    { duration: '2m', target: 100 },    // Stay at 100 VUs
    { duration: '30s', target: 0 },     // Gradual ramp-down
  ],
  thresholds: {
    'http_req_duration': ['p(95)<3000'], // 95% of requests within 3s (more realistic)
    'http_req_failed': ['rate<0.01'],    // Less than 1% failures
    'download_duration': ['p(95)<2000'], // 95% of downloads within 2s
    'download_failures': ['rate<0.01'],  // Less than 1% download failures
    'retries': ['count<100'],           // Alert if we have too many retries
  },
  // Performance optimizations
  discardResponseBodies: true,
  keepAliveTimeout: '60s',
  noConnectionReuse: false,
  userAgent: 'K6PerformanceTest/1.0',
  tags: { test_type: 'download' }
};

// Custom metrics for detailed monitoring
const downloadDuration = new Trend('download_duration');
const downloadFailRate = new Rate('download_failures');

export function setup() {
  // Run warmup to stabilize the environment
  warmup({ duration: 5 });
  
  // Create multiple test files with varying sizes for realistic testing
  const testFiles = [];
  const sizes = [1, 5, 10]; // KB sizes
  
  for (let i = 0; i < sizes.length; i++) {
    const testFile = generateTestFile('get-test', sizes[i]);
    
    const data = {
      file: http.file(testFile.content, testFile.filename, 'text/plain'),
    };
    
    // Use retryable request for better setup reliability
    const res = retryableRequest(() => 
      http.post(`${getBaseUrl()}/upload`, data),
      { maxRetries: 3, retryDelay: 2 }
    );
    
    const uploadSuccess = check(res, {
      'setup upload successful': (r) => r.status === 200,
    });
    
    if (uploadSuccess) {
      testFiles.push(testFile);
      console.log(`Created test file: ${testFile.filename} (${testFile.size} bytes)`);
    } else {
      console.error(`Failed to create test file during setup: ${res.status} - ${res.body}`);
    }
  }
  
  if (testFiles.length === 0) {
    console.error("WARNING: No test files were successfully uploaded during setup!");
    
    // Create a fallback test file
    const fallbackFile = {
      filename: `fallback-${Date.now()}.txt`,
      content: 'Fallback test content'
    };
    testFiles.push(fallbackFile);
  }
  
  return { files: testFiles };
}

export default function (data) {
  // Select a random file from the files created in setup
  const fileIndex = Math.floor(Math.random() * data.files.length);
  const testFile = data.files[fileIndex];
  
  // Use retryable request for better test reliability
  const startTime = new Date();
  const res = retryableRequest(() => 
    http.get(`${getBaseUrl()}/download?filename=${testFile.filename}`),
    { maxRetries: 2, retryDelay: 1 }
  );
  
  // Record metrics
  downloadDuration.add(new Date() - startTime);
  
  const success = check(res, {
    'download status is 200': (r) => r.status === 200,
    'download has expected headers': (r) => r.headers['Content-Type'] === 'application/octet-stream',
    'download has content': (r) => r.body.length > 0
  });
  
  if (!success) {
    console.error(`Download failed for ${testFile.filename}: ${res.status} - ${res.body}`);
    downloadFailRate.add(1);
    enhancedMetrics.errors.add(1, { operation: 'download', file_size: testFile.size });
  } else {
    downloadFailRate.add(0);
    enhancedMetrics.downloadSuccess.add(1, { file_size: testFile.size });
  }
  
  // Add jitter to sleep for more realistic load pattern
  defaultSleep(0.5, 0.3);
}
