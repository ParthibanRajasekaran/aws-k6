const fs = require('fs');
const path = require('path');

/**
 * Consolidated Report Generator
 * Aggregates results from both Lambda+S3 and Step Functions test scenarios
 */

class ConsolidatedReportGenerator {
    constructor() {
        this.reportsDir = path.resolve(__dirname, '../reports');
        this.consolidatedDir = path.join(this.reportsDir, 'consolidated');
        this.lambdaS3Dir = path.join(this.reportsDir, 'lambda-s3');
        this.stepFunctionsDir = path.join(this.reportsDir, 'step-functions');
    }

    // Ensure directories exist
    ensureDirectories() {
        [this.consolidatedDir, this.lambdaS3Dir, this.stepFunctionsDir].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // Load JSON results file
    loadResultsFile(filePath) {
        try {
            if (fs.existsSync(filePath)) {
                const content = fs.readFileSync(filePath, 'utf8');
                return JSON.parse(content);
            }
        } catch (error) {
            console.warn(`Warning: Could not load results from ${filePath}:`, error.message);
        }
        return null;
    }

    // Extract metrics from k6 JSON output
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
            httpReqReceiving: metrics.http_req_receiving?.values?.avg || 0,
            httpReqSending: metrics.http_req_sending?.values?.avg || 0,
            httpReqWaiting: metrics.http_req_waiting?.values?.avg || 0,
            dataSent: metrics.data_sent?.values?.count || 0,
            dataReceived: metrics.data_received?.values?.count || 0
        };
    }

    // Calculate performance grade
    calculateGrade(metrics) {
        if (!metrics) return 'F';

        const p95ResponseTime = metrics.httpReqDuration.p95;
        const errorRate = metrics.httpReqFailed * 100; // Convert to percentage
        const throughput = metrics.httpReqs / (metrics.duration / 1000); // Requests per second

        // Grading thresholds
        if (p95ResponseTime <= 200 && errorRate <= 0.1 && throughput >= 100) return 'A';
        if (p95ResponseTime <= 500 && errorRate <= 0.5 && throughput >= 50) return 'B';
        if (p95ResponseTime <= 1000 && errorRate <= 1.0 && throughput >= 20) return 'C';
        if (p95ResponseTime <= 2000 && errorRate <= 5.0 && throughput >= 10) return 'D';
        return 'F';
    }

    // Process test scenario results
    processScenarioResults(scenarioDir, scenarioName) {
        const results = [];
        
        if (!fs.existsSync(scenarioDir)) {
            console.warn(`Warning: Scenario directory not found: ${scenarioDir}`);
            return results;
        }

        const files = fs.readdirSync(scenarioDir);
        const resultFiles = files.filter(file => file.endsWith('-results.json'));

        resultFiles.forEach(file => {
            const testName = file.replace('-results.json', '');
            const filePath = path.join(scenarioDir, file);
            const data = this.loadResultsFile(filePath);
            
            if (data) {
                const metrics = this.extractMetrics(data);
                const grade = this.calculateGrade(metrics);
                
                results.push({
                    scenario: scenarioName,
                    testName,
                    metrics,
                    grade,
                    timestamp: new Date().toISOString()
                });
            }
        });

        return results;
    }

    // Generate HTML report
    generateHTMLReport(allResults) {
        const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AWS K6 Performance Test Suite - Consolidated Report</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0;
            opacity: 0.9;
        }
        .summary {
            padding: 30px;
            background: #f8f9fa;
            border-bottom: 1px solid #dee2e6;
        }
        .summary-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
        }
        .summary-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .summary-card h3 {
            margin: 0 0 10px;
            color: #495057;
        }
        .summary-card .value {
            font-size: 2em;
            font-weight: bold;
            color: #007bff;
        }
        .scenarios {
            padding: 30px;
        }
        .scenario {
            margin-bottom: 40px;
        }
        .scenario h2 {
            color: #495057;
            border-bottom: 2px solid #007bff;
            padding-bottom: 10px;
            margin-bottom: 20px;
        }
        .test-grid {
            display: grid;
            gap: 20px;
        }
        .test-card {
            border: 1px solid #dee2e6;
            border-radius: 8px;
            overflow: hidden;
        }
        .test-header {
            background: #f8f9fa;
            padding: 15px 20px;
            border-bottom: 1px solid #dee2e6;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }
        .test-name {
            font-weight: bold;
            font-size: 1.1em;
        }
        .grade {
            padding: 5px 15px;
            border-radius: 20px;
            font-weight: bold;
            color: white;
        }
        .grade-A { background-color: #28a745; }
        .grade-B { background-color: #17a2b8; }
        .grade-C { background-color: #ffc107; color: #212529; }
        .grade-D { background-color: #fd7e14; }
        .grade-F { background-color: #dc3545; }
        .test-metrics {
            padding: 20px;
        }
        .metrics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
            gap: 15px;
        }
        .metric {
            text-align: center;
        }
        .metric-label {
            font-size: 0.9em;
            color: #6c757d;
            margin-bottom: 5px;
        }
        .metric-value {
            font-size: 1.2em;
            font-weight: bold;
            color: #495057;
        }
        .footer {
            background: #343a40;
            color: white;
            padding: 20px;
            text-align: center;
        }
        @media (max-width: 768px) {
            .summary-grid {
                grid-template-columns: 1fr;
            }
            .metrics-grid {
                grid-template-columns: repeat(2, 1fr);
            }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>AWS K6 Performance Test Suite</h1>
            <p>Consolidated Report - Generated on ${new Date().toLocaleString()}</p>
        </div>
        
        <div class="summary">
            <h2>Executive Summary</h2>
            <div class="summary-grid">
                <div class="summary-card">
                    <h3>Total Tests</h3>
                    <div class="value">${allResults.length}</div>
                </div>
                <div class="summary-card">
                    <h3>Test Scenarios</h3>
                    <div class="value">${new Set(allResults.map(r => r.scenario)).size}</div>
                </div>
                <div class="summary-card">
                    <h3>Avg Grade</h3>
                    <div class="value">${this.calculateAverageGrade(allResults)}</div>
                </div>
                <div class="summary-card">
                    <h3>Total Requests</h3>
                    <div class="value">${allResults.reduce((sum, r) => sum + (r.metrics?.httpReqs || 0), 0).toLocaleString()}</div>
                </div>
            </div>
        </div>
        
        <div class="scenarios">
            ${this.generateScenariosHTML(allResults)}
        </div>
        
        <div class="footer">
            <p>Generated by AWS K6 Performance Test Suite | LocalStack Integration</p>
        </div>
    </div>
</body>
</html>`;

        return html;
    }

    // Calculate average grade
    calculateAverageGrade(results) {
        if (results.length === 0) return 'N/A';
        
        const gradeValues = { A: 5, B: 4, C: 3, D: 2, F: 1 };
        const valueGrades = { 5: 'A', 4: 'B', 3: 'C', 2: 'D', 1: 'F' };
        
        const avgValue = results.reduce((sum, r) => sum + gradeValues[r.grade], 0) / results.length;
        return valueGrades[Math.round(avgValue)] || 'F';
    }

    // Generate scenarios HTML
    generateScenariosHTML(allResults) {
        const scenarios = {};
        
        allResults.forEach(result => {
            if (!scenarios[result.scenario]) {
                scenarios[result.scenario] = [];
            }
            scenarios[result.scenario].push(result);
        });

        return Object.entries(scenarios).map(([scenarioName, results]) => `
            <div class="scenario">
                <h2>${scenarioName} Tests</h2>
                <div class="test-grid">
                    ${results.map(result => this.generateTestHTML(result)).join('')}
                </div>
            </div>
        `).join('');
    }

    // Generate individual test HTML
    generateTestHTML(result) {
        const metrics = result.metrics;
        if (!metrics) return '';

        return `
            <div class="test-card">
                <div class="test-header">
                    <div class="test-name">${result.testName.replace('-test', '').toUpperCase()} Test</div>
                    <div class="grade grade-${result.grade}">${result.grade}</div>
                </div>
                <div class="test-metrics">
                    <div class="metrics-grid">
                        <div class="metric">
                            <div class="metric-label">Avg Response Time</div>
                            <div class="metric-value">${Math.round(metrics.httpReqDuration.avg)}ms</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">P95 Response Time</div>
                            <div class="metric-value">${Math.round(metrics.httpReqDuration.p95)}ms</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Error Rate</div>
                            <div class="metric-value">${(metrics.httpReqFailed * 100).toFixed(2)}%</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Total Requests</div>
                            <div class="metric-value">${metrics.httpReqs.toLocaleString()}</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">Throughput</div>
                            <div class="metric-value">${Math.round(metrics.httpReqs / (metrics.duration / 1000))} req/s</div>
                        </div>
                        <div class="metric">
                            <div class="metric-label">VUs</div>
                            <div class="metric-value">${metrics.vusMax}</div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    // Main generation method
    async generate() {
        console.log('🏗️  Generating consolidated performance report...');
        
        this.ensureDirectories();
        
        // Process both scenarios
        const lambdaS3Results = this.processScenarioResults(this.lambdaS3Dir, 'Lambda + S3');
        const stepFunctionsResults = this.processScenarioResults(this.stepFunctionsDir, 'Step Functions');
        
        const allResults = [...lambdaS3Results, ...stepFunctionsResults];
        
        if (allResults.length === 0) {
            console.warn('⚠️  No test results found. Make sure tests have been run.');
            return;
        }
        
        // Generate HTML report
        const html = this.generateHTMLReport(allResults);
        const reportPath = path.join(this.consolidatedDir, 'index.html');
        
        fs.writeFileSync(reportPath, html);
        
        // Generate JSON summary
        const summary = {
            generatedAt: new Date().toISOString(),
            totalTests: allResults.length,
            scenarios: new Set(allResults.map(r => r.scenario)).size,
            averageGrade: this.calculateAverageGrade(allResults),
            results: allResults
        };
        
        const summaryPath = path.join(this.consolidatedDir, 'summary.json');
        fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
        
        console.log('✅ Consolidated report generated successfully!');
        console.log(`📊 HTML Report: ${reportPath}`);
        console.log(`📋 JSON Summary: ${summaryPath}`);
        
        // Display quick summary
        console.log('\n📈 Quick Summary:');
        console.log(`   Total Tests: ${allResults.length}`);
        console.log(`   Average Grade: ${this.calculateAverageGrade(allResults)}`);
        console.log(`   Total Requests: ${allResults.reduce((sum, r) => sum + (r.metrics?.httpReqs || 0), 0).toLocaleString()}`);
    }
}

// Run if called directly
if (require.main === module) {
    const generator = new ConsolidatedReportGenerator();
    generator.generate().catch(console.error);
}

module.exports = ConsolidatedReportGenerator;
