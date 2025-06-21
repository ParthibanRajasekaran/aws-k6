#!/usr/bin/env node

/**
 * Real-time Test Analyzer
 * Provides insights and analysis during test execution
 */

const fs = require('fs');
const path = require('path');
const { EventEmitter } = require('events');

class TestAnalyzer extends EventEmitter {
    constructor() {
        super();
        this.metrics = {
            lambda_s3: {
                post: { requests: 0, errors: 0, avgDuration: 0, p95Duration: 0 },
                get: { requests: 0, errors: 0, avgDuration: 0, p95Duration: 0 }
            },
            step_functions: {
                stepfn: { requests: 0, errors: 0, avgDuration: 0, p95Duration: 0 }
            }
        };
        this.thresholds = this.loadThresholds();
        this.alerts = [];
    }

    // Load performance thresholds
    loadThresholds() {
        const configPath = path.resolve(__dirname, '../config/performance-thresholds.json');
        try {
            const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            return config.thresholds || this.getDefaultThresholds();
        } catch (error) {
            console.warn('⚠️  Could not load thresholds, using defaults');
            return this.getDefaultThresholds();
        }
    }

    // Default performance thresholds
    getDefaultThresholds() {
        return {
            A: { p95ResponseTime: 200, errorRate: 0.1, minThroughput: 100 },
            B: { p95ResponseTime: 500, errorRate: 0.5, minThroughput: 50 },
            C: { p95ResponseTime: 1000, errorRate: 1.0, minThroughput: 20 },
            D: { p95ResponseTime: 2000, errorRate: 5.0, minThroughput: 10 }
        };
    }

    // Colored logging
    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',
            success: '\x1b[32m',
            warning: '\x1b[33m',
            error: '\x1b[31m',
            highlight: '\x1b[35m',
            reset: '\x1b[0m'
        };
        
        const timestamp = new Date().toLocaleTimeString();
        console.log(`${colors[type]}[${timestamp}] ${message}${colors.reset}`);
    }

    // Analyze k6 JSON output
    analyzeResults(filePath, testType, scenario) {
        try {
            if (!fs.existsSync(filePath)) {
                this.log(`Results file not found: ${filePath}`, 'warning');
                return null;
            }

            const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            const metrics = this.extractMetrics(data);
            
            if (!metrics) {
                this.log('Could not extract metrics from results', 'warning');
                return null;
            }

            // Update internal metrics
            this.updateMetrics(scenario, testType, metrics);
            
            // Generate insights
            const insights = this.generateInsights(metrics, testType);
            const grade = this.calculateGrade(metrics);
            
            const analysis = {
                testType,
                scenario,
                grade,
                metrics,
                insights,
                timestamp: new Date().toISOString()
            };

            this.emit('analysis', analysis);
            return analysis;
            
        } catch (error) {
            this.log(`Error analyzing results: ${error.message}`, 'error');
            return null;
        }
    }

    // Extract metrics from k6 data
    extractMetrics(data) {
        if (!data || !data.metrics) return null;

        const metrics = data.metrics;
        
        return {
            duration: data.state?.testRunDurationMs || 0,
            iterations: metrics.iterations?.values?.count || 0,
            vus: metrics.vus?.values?.value || 0,
            vusMax: metrics.vus_max?.values?.value || 0,
            httpReqs: metrics.http_reqs?.values?.count || 0,
            httpReqFailed: metrics.http_req_failed?.values?.rate || 0,
            httpReqDuration: {
                avg: metrics.http_req_duration?.values?.avg || 0,
                min: metrics.http_req_duration?.values?.min || 0,
                max: metrics.http_req_duration?.values?.max || 0,
                p50: metrics.http_req_duration?.values?.p50 || 0,
                p90: metrics.http_req_duration?.values?.p90 || 0,
                p95: metrics.http_req_duration?.values?.p95 || 0,
                p99: metrics.http_req_duration?.values?.p99 || 0
            },
            throughput: metrics.http_reqs?.values?.count / ((data.state?.testRunDurationMs || 1) / 1000),
            dataTransfer: {
                sent: metrics.data_sent?.values?.count || 0,
                received: metrics.data_received?.values?.count || 0
            }
        };
    }

    // Update internal metrics tracking
    updateMetrics(scenario, testType, metrics) {
        if (this.metrics[scenario] && this.metrics[scenario][testType]) {
            this.metrics[scenario][testType] = {
                requests: metrics.httpReqs,
                errors: Math.round(metrics.httpReqFailed * metrics.httpReqs),
                avgDuration: metrics.httpReqDuration.avg,
                p95Duration: metrics.httpReqDuration.p95,
                throughput: metrics.throughput
            };
        }
    }

    // Generate performance insights
    generateInsights(metrics, testType) {
        const insights = [];
        const errorRate = metrics.httpReqFailed * 100;
        const p95 = metrics.httpReqDuration.p95;
        const throughput = metrics.throughput;

        // Error rate analysis
        if (errorRate > 5) {
            insights.push({
                type: 'error',
                message: `High error rate: ${errorRate.toFixed(2)}% - Check service stability`
            });
        } else if (errorRate > 1) {
            insights.push({
                type: 'warning',
                message: `Elevated error rate: ${errorRate.toFixed(2)}% - Monitor closely`
            });
        }

        // Response time analysis
        if (p95 > 2000) {
            insights.push({
                type: 'error',
                message: `Very slow P95 response time: ${p95.toFixed(0)}ms - Performance issues detected`
            });
        } else if (p95 > 1000) {
            insights.push({
                type: 'warning',
                message: `Slow P95 response time: ${p95.toFixed(0)}ms - Consider optimization`
            });
        } else if (p95 < 200) {
            insights.push({
                type: 'success',
                message: `Excellent P95 response time: ${p95.toFixed(0)}ms`
            });
        }

        // Throughput analysis
        if (throughput > 100) {
            insights.push({
                type: 'success',
                message: `High throughput: ${throughput.toFixed(1)} req/s`
            });
        } else if (throughput < 10) {
            insights.push({
                type: 'warning',
                message: `Low throughput: ${throughput.toFixed(1)} req/s - Capacity concerns`
            });
        }

        // Test-specific insights
        if (testType === 'post') {
            const avgUploadSize = metrics.dataTransfer.sent / metrics.httpReqs;
            if (avgUploadSize > 1024 * 1024) { // > 1MB
                insights.push({
                    type: 'info',
                    message: `Large average upload size: ${(avgUploadSize / (1024*1024)).toFixed(1)}MB`
                });
            }
        }

        if (testType === 'get') {
            const avgDownloadSize = metrics.dataTransfer.received / metrics.httpReqs;
            if (avgDownloadSize > 1024 * 1024) { // > 1MB
                insights.push({
                    type: 'info',
                    message: `Large average download size: ${(avgDownloadSize / (1024*1024)).toFixed(1)}MB`
                });
            }
        }

        if (testType === 'stepfn') {
            // Step function specific insights
            if (p95 > 5000) {
                insights.push({
                    type: 'warning',
                    message: `Step function execution is slow - Check Lambda cold starts and DynamoDB performance`
                });
            }
        }

        return insights;
    }

    // Calculate performance grade
    calculateGrade(metrics) {
        const p95 = metrics.httpReqDuration.p95;
        const errorRate = metrics.httpReqFailed * 100;
        const throughput = metrics.throughput;

        for (const [grade, thresholds] of Object.entries(this.thresholds)) {
            if (p95 <= thresholds.p95ResponseTime && 
                errorRate <= thresholds.errorRate && 
                throughput >= thresholds.minThroughput) {
                return grade;
            }
        }
        return 'F';
    }

    // Display real-time analysis
    displayAnalysis(analysis) {
        const { testType, scenario, grade, metrics, insights } = analysis;
        
        this.log(`\n🔍 Analysis for ${scenario} - ${testType.toUpperCase()} Test`, 'highlight');
        this.log(`Grade: ${grade}`, grade === 'A' || grade === 'B' ? 'success' : grade === 'C' ? 'warning' : 'error');
        
        this.log('\n📊 Key Metrics:', 'info');
        this.log(`   Requests: ${metrics.httpReqs.toLocaleString()}`, 'info');
        this.log(`   Error Rate: ${(metrics.httpReqFailed * 100).toFixed(2)}%`, 'info');
        this.log(`   Avg Response: ${metrics.httpReqDuration.avg.toFixed(0)}ms`, 'info');
        this.log(`   P95 Response: ${metrics.httpReqDuration.p95.toFixed(0)}ms`, 'info');
        this.log(`   Throughput: ${metrics.throughput.toFixed(1)} req/s`, 'info');
        
        if (insights.length > 0) {
            this.log('\n💡 Insights:', 'info');
            insights.forEach(insight => {
                this.log(`   ${insight.message}`, insight.type);
            });
        }
        
        this.log('', 'info'); // Empty line for spacing
    }

    // Generate comparison analysis
    generateComparison() {
        this.log('\n🏆 Cross-Scenario Performance Comparison', 'highlight');
        
        // Compare Lambda+S3 tests
        const lambdaS3 = this.metrics.lambda_s3;
        if (lambdaS3.post.requests > 0 && lambdaS3.get.requests > 0) {
            this.log('\n📤 POST vs GET Performance:', 'info');
            this.log(`   POST P95: ${lambdaS3.post.p95Duration.toFixed(0)}ms | GET P95: ${lambdaS3.get.p95Duration.toFixed(0)}ms`, 'info');
            this.log(`   POST Throughput: ${lambdaS3.post.throughput.toFixed(1)} req/s | GET Throughput: ${lambdaS3.get.throughput.toFixed(1)} req/s`, 'info');
            
            if (lambdaS3.post.p95Duration > lambdaS3.get.p95Duration * 2) {
                this.log('   💡 POST operations are significantly slower - Consider upload optimization', 'warning');
            }
        }
        
        // Compare scenarios
        const stepFn = this.metrics.step_functions.stepfn;
        if (stepFn.requests > 0 && lambdaS3.post.requests > 0) {
            this.log('\n⚡ Lambda+S3 vs Step Functions:', 'info');
            this.log(`   Simple Lambda P95: ${lambdaS3.post.p95Duration.toFixed(0)}ms | Step Function P95: ${stepFn.p95Duration.toFixed(0)}ms`, 'info');
            
            const overhead = stepFn.p95Duration - lambdaS3.post.p95Duration;
            if (overhead > 1000) {
                this.log(`   💡 Step Functions add ${overhead.toFixed(0)}ms overhead - Consider direct Lambda for simple operations`, 'warning');
            }
        }
    }

    // Monitor file changes for real-time analysis
    watchResults(reportsDir) {
        this.log('👁️  Starting real-time results monitoring...', 'info');
        
        const watchDirectories = [
            path.join(reportsDir, 'lambda-s3'),
            path.join(reportsDir, 'step-functions')
        ];

        watchDirectories.forEach(dir => {
            if (fs.existsSync(dir)) {
                fs.watch(dir, { recursive: false }, (eventType, filename) => {
                    if (eventType === 'change' && filename.endsWith('-results.json')) {
                        setTimeout(() => {
                            const filePath = path.join(dir, filename);
                            const testType = filename.replace('-results.json', '').replace('-test', '');
                            const scenario = dir.includes('lambda-s3') ? 'lambda_s3' : 'step_functions';
                            
                            const analysis = this.analyzeResults(filePath, testType, scenario);
                            if (analysis) {
                                this.displayAnalysis(analysis);
                            }
                        }, 1000); // Small delay to ensure file write is complete
                    }
                });
            }
        });
    }

    // Generate final summary
    generateSummary() {
        this.log('\n📋 Final Test Execution Summary', 'highlight');
        
        let totalTests = 0;
        let totalRequests = 0;
        let totalErrors = 0;
        const grades = [];

        Object.values(this.metrics).forEach(scenario => {
            Object.values(scenario).forEach(test => {
                if (test.requests > 0) {
                    totalTests++;
                    totalRequests += test.requests;
                    totalErrors += test.errors;
                }
            });
        });

        this.log(`Tests Executed: ${totalTests}`, 'info');
        this.log(`Total Requests: ${totalRequests.toLocaleString()}`, 'info');
        this.log(`Total Errors: ${totalErrors}`, totalErrors > 0 ? 'warning' : 'success');
        this.log(`Overall Error Rate: ${totalRequests > 0 ? ((totalErrors / totalRequests) * 100).toFixed(2) : 0}%`, 'info');

        this.generateComparison();
    }
}

// CLI interface
if (require.main === module) {
    const analyzer = new TestAnalyzer();
    const command = process.argv[2];
    
    switch (command) {
        case 'watch':
            const reportsDir = process.argv[3] || path.resolve(__dirname, '../reports');
            analyzer.watchResults(reportsDir);
            break;
            
        case 'analyze':
            const filePath = process.argv[3];
            const testType = process.argv[4] || 'unknown';
            const scenario = process.argv[5] || 'unknown';
            
            if (!filePath) {
                console.error('Usage: node test-analyzer.js analyze <results-file> [test-type] [scenario]');
                process.exit(1);
            }
            
            const analysis = analyzer.analyzeResults(filePath, testType, scenario);
            if (analysis) {
                analyzer.displayAnalysis(analysis);
            }
            break;
            
        default:
            console.log('Usage:');
            console.log('  node test-analyzer.js watch [reports-dir]');
            console.log('  node test-analyzer.js analyze <results-file> [test-type] [scenario]');
    }
}

module.exports = TestAnalyzer;
