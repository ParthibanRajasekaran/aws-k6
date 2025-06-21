#!/usr/bin/env node

/**
 * Enhanced Test Result Analyzer
 * Analyzes K6 test results and provides performance insights
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  brightRed: '\x1b[91m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightBlue: '\x1b[94m',
  brightMagenta: '\x1b[95m',
  brightCyan: '\x1b[96m',
  brightWhite: '\x1b[97m',
};

// Colored logging
function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

// Load performance thresholds
function loadThresholds() {
  try {
    const thresholdsPath = path.resolve(__dirname, '../config/performance-thresholds.json');
    const config = JSON.parse(fs.readFileSync(thresholdsPath, 'utf8'));
    return config.thresholds || {};
  } catch (error) {
    console.error('Error loading thresholds:', error);
    return {};
  }
}

// Analysis of test results
function analyzeResults(filePath) {
  try {
    // Read the JSON file
    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const thresholds = loadThresholds();
    
    // Extract key metrics
    const metrics = data.metrics || {};
    
    // Basic test information
    const testInfo = {
      duration: data.state?.testRunDurationMs || 0,
      iterations: metrics.iterations?.values?.count || 0,
      vus: metrics.vus_max?.values?.value || 0,
      httpReqs: metrics.http_reqs?.values?.count || 0,
      httpReqRate: metrics.http_reqs?.values?.rate || 0,
      failRate: metrics.http_req_failed?.values?.rate || 0,
      p95: metrics.http_req_duration?.values?.p95 || 0,
    };
    
    // Calculate performance grade
    const grade = calculateGrade(testInfo, thresholds);
    
    return {
      testInfo,
      grade,
      metrics,
      hasPassed: testInfo.failRate < 0.01 && grade !== 'F',
    };
  } catch (error) {
    console.error('Error analyzing results:', error);
    return {
      testInfo: {},
      grade: 'F',
      metrics: {},
      hasPassed: false,
      error: error.message
    };
  }
}

// Calculate performance grade based on thresholds
function calculateGrade(testInfo, thresholds) {
  // Use p95 response time, error rate, and throughput for grading
  const { p95, failRate, httpReqRate } = testInfo;
  
  // Check each grade threshold from A to D
  for (const grade of ['A', 'B', 'C', 'D']) {
    const threshold = thresholds[grade];
    
    if (!threshold) continue;
    
    if (p95 <= threshold.p95ResponseTime && 
        failRate * 100 <= threshold.errorRate && 
        httpReqRate >= threshold.minThroughput) {
      return grade;
    }
  }
  
  // Default to F if none of the thresholds match
  return 'F';
}

// Generate performance summary
function generateSummary(analysis, testType, scenario) {
  const { testInfo, grade, hasPassed } = analysis;
  
  log(`\n📊 Test Analysis Summary for ${testType} (${scenario})`, 'brightCyan');
  log(`${'-'.repeat(60)}`, 'brightWhite');
  
  // Format duration as seconds with 2 decimal places
  const durationSec = (testInfo.duration / 1000).toFixed(2);
  
  log(`⏱️  Duration: ${durationSec}s with ${testInfo.vus} max VUs`, 'brightWhite');
  log(`🔄 Iterations: ${testInfo.iterations} (${testInfo.httpReqs} HTTP requests)`, 'brightWhite');
  log(`⚡ Throughput: ${testInfo.httpReqRate.toFixed(1)} req/s`, 'brightWhite');
  log(`⏳ P95 Response Time: ${testInfo.p95.toFixed(2)}ms`, grade === 'A' ? 'brightGreen' : grade === 'F' ? 'brightRed' : 'brightYellow');
  log(`❌ Error Rate: ${(testInfo.failRate * 100).toFixed(2)}%`, testInfo.failRate < 0.01 ? 'brightGreen' : 'brightRed');
  
  // Show performance grade
  const gradeColor = {
    'A': 'brightGreen',
    'B': 'green',
    'C': 'yellow',
    'D': 'brightYellow',
    'F': 'brightRed',
  }[grade] || 'brightWhite';
  
  log(`\n📝 Performance Grade: ${grade}`, gradeColor);
  
  // Overall result
  log(`\n${hasPassed ? '✅ PASSED' : '❌ FAILED'}`, hasPassed ? 'green' : 'red');
  
  // Show action recommendations based on results
  if (!hasPassed) {
    log('\n🔍 Recommendations:', 'brightMagenta');
    if (testInfo.p95 > 1000) {
      log(' - Optimize Lambda function execution time', 'yellow');
      log(' - Consider caching frequently accessed files', 'yellow');
      log(' - Reduce file sizes or implement chunking', 'yellow');
    }
    
    if (testInfo.failRate >= 0.01) {
      log(' - Investigate and fix failed requests', 'yellow');
      log(' - Check S3 connectivity and permissions', 'yellow');
      log(' - Ensure LocalStack has sufficient resources', 'yellow');
    }
    
    if (testInfo.httpReqRate < 20) {
      log(' - Optimize Lambda cold starts', 'yellow');
      log(' - Review resource allocation for API Gateway', 'yellow');
      log(' - Investigate network bottlenecks', 'yellow');
    }
  }
}

// Watch a directory for new result files
async function watchDirectory(dirPath) {
  // Map to keep track of analyzed files
  const analyzedFiles = new Map();
  
  log(`👀 Watching directory: ${dirPath} for new results...`, 'cyan');
  
  // Initial scan of directory
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error('Error reading directory:', err);
      return;
    }
    
    files
      .filter(file => file.endsWith('-results.json'))
      .forEach(file => analyzedFiles.set(file, true));
  });
  
  // Watch for file changes
  fs.watch(dirPath, { recursive: true }, (eventType, filename) => {
    if (!filename || !filename.endsWith('-results.json')) return;
    
    // Skip already analyzed files
    if (analyzedFiles.has(filename)) return;
    analyzedFiles.set(filename, true);
    
    const filePath = path.join(dirPath, filename);
    
    // Wait a moment for the file to be fully written
    setTimeout(() => {
      log(`\n📄 New result file detected: ${filename}`, 'brightCyan');
      
      try {
        const analysis = analyzeResults(filePath);
        const testType = filename.replace('-results.json', '');
        generateSummary(analysis, testType, 'localstack');
      } catch (error) {
        console.error('Error analyzing file:', error);
      }
    }, 1000);
  });
}

// Command-line argument parsing
function parseArgs() {
  const args = process.argv.slice(2);
  const command = args[0];
  
  switch (command) {
    case 'watch':
      if (args.length < 2) {
        console.error('Missing directory path. Usage: node test-analyzer.js watch <directory>');
        process.exit(1);
      }
      watchDirectory(args[1]);
      break;
      
    case 'analyze':
      if (args.length < 2) {
        console.error('Missing file path. Usage: node test-analyzer.js analyze <file> [test-type] [scenario]');
        process.exit(1);
      }
      const filePath = args[1];
      const testType = args[2] || path.basename(filePath, '-results.json');
      const scenario = args[3] || 'local';
      
      const analysis = analyzeResults(filePath);
      generateSummary(analysis, testType, scenario);
      break;
      
    default:
      console.error(`Unknown command: ${command}`);
      console.error('Available commands: watch, analyze');
      process.exit(1);
  }
}

// Start analysis
parseArgs();
