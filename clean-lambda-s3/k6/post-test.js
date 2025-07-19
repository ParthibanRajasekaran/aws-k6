import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { SharedArray } from 'k6/data';
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

// Simple random string generator to replace external dependency
function randomString(length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Use the config, but override some options for post-specific needs
export const options = {
  ...config,
  stages: [
    { duration: '10s', target: 5 },     // Gentle warm-up
    { duration: '30s', target: 30 },    // Ramp-up 
    { duration: '1m', target: 50 },     // Increase to peak
    { duration: '2m', target: 50 },     // Stay at peak
    { duration: '30s', target: 0 },     // Gradual ramp-down
  ],
  thresholds: {
    ...config.thresholds,
    'upload_duration': ['p(95)<3000'],   // 95% of uploads within 3s
    'upload_failures': ['rate<0.01'],    // Less than 1% upload failures
    'retries': ['count<50'],            // Alert if we have too many retries
  },
  // Additional performance optimizations
  userAgent: 'K6PerformanceTest/1.0',
  tags: { test_type: 'upload' }
};

const metrics = {
  upload: {
    duration: new Trend('upload_duration'),
    failures: new Rate('upload_failures')
  },
  download: {
    duration: new Trend('download_duration'),
    failures: new Rate('download_failures')
  }
};

const BASE_URL = getBaseUrl();

export function setup() {
  // Run warmup to stabilize the environment
  warmup({ duration: 5 });
  
  // Create a larger setup file to validate functionality
  const setupFile = generateTestFile('setup', 2); // 2KB file
  
  // Use retryable request for better setup reliability
  const res = retryableRequest(() => 
    http.post(`${BASE_URL}/upload`, {
      file: http.file(setupFile.content, setupFile.filename, 'text/plain')
    }),
    { maxRetries: 3, retryDelay: 2 }
  );

  // Validate setup was successful
  const setupSuccess = check(res, {
    'setup successful': (r) => r.status === 200
  });
  
  if (!setupSuccess) {
    console.error(`Setup failed: ${res.status} - ${res.body}`);
  } else {
    console.log(`Setup complete: Created ${setupFile.filename} (${setupFile.size} bytes)`);
  }

  return setupFile;
}

// File sizes for realistic testing (in KB)
const FILE_SIZES = [1, 2, 5, 10];

export default function (data) {
  // Select a random file size for this test iteration
  const fileSize = FILE_SIZES[Math.floor(Math.random() * FILE_SIZES.length)];
  const testFile = generateTestFile('upload-test', fileSize);
  
  // Upload phase - wrapped in measureDuration for accurate timing
  const uploadRes = measureDuration(() => 
    retryableRequest(() => 
      http.post(`${BASE_URL}/upload`, {
        file: http.file(testFile.content, testFile.filename, 'text/plain')
      }),
      { maxRetries: 2 }
    ), 
    metrics.upload, 
    'upload'
  );
  
  const uploadSuccess = check(uploadRes, {
    'upload successful': (r) => r.status === 200,
    'upload response valid': (r) => r.json().message === 'File uploaded'
  });

  // Add detailed metrics
  metrics.upload.failures.add(!uploadSuccess);
  enhancedMetrics.uploadSuccess.add(uploadSuccess ? 1 : 0, { file_size: fileSize });
  
  if (!uploadSuccess) {
    console.error(`Upload failed for ${fileSize}KB file: ${uploadRes.status} - ${uploadRes.body}`);
    enhancedMetrics.errors.add(1, { operation: 'upload', file_size: fileSize });
  }

  // Add jitter to sleep for more realistic load pattern
  defaultSleep(0.5, 0.3);

  // Download phase - wrapped in measureDuration for accurate timing
  const downloadRes = measureDuration(() => 
    retryableRequest(() => 
      http.get(`${BASE_URL}/download?filename=${data.filename}`),
      { maxRetries: 2 }
    ), 
    metrics.download, 
    'download'
  );
  
  const downloadSuccess = check(downloadRes, {
    'download successful': (r) => r.status === 200,
    'download content-type correct': (r) => r.headers['Content-Type'] === 'application/octet-stream',
    'download content present': (r) => r.body.length > 0
  });

  metrics.download.failures.add(!downloadSuccess);
  enhancedMetrics.downloadSuccess.add(downloadSuccess ? 1 : 0);
  
  if (!downloadSuccess) {
    console.error(`Download failed: ${downloadRes.status} - ${downloadRes.body}`);
    enhancedMetrics.errors.add(1, { operation: 'download' });
  }

  // Add jitter to sleep for more realistic load pattern
  defaultSleep(0.5, 0.3);
}
