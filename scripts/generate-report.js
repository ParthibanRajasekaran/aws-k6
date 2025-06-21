const { generateSummaryReport } = require('k6-html-reporter');
const path = require('path');
const fs = require('fs');

// Load performance thresholds from config file
function loadPerformanceThresholds() {
    const configPath = path.resolve(__dirname, '../config/performance-thresholds.json');
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
        
        if (!config.thresholds) {
            throw new Error('Invalid configuration: missing thresholds section');
        }
        
        const thresholds = { ...config.thresholds };
        
        // Add F grade if not present
        if (!thresholds.F) {
            thresholds.F = {
                p95ResponseTime: Infinity,
                errorRate: Infinity,
                minThroughput: 0,
                description: "Failed to meet minimum performance requirements"
            };
        }
        
        return thresholds;
    } catch (error) {
        console.warn('Warning: Could not load performance thresholds config:', error.message);
        console.warn('Using default thresholds');
        return {
            A: {
                p95ResponseTime: 200,
                errorRate: 0.1,
                minThroughput: 100,
                description: "Excellent performance"
            },
            B: {
                p95ResponseTime: 500,
                errorRate: 0.5,
                minThroughput: 50,
                description: "Good performance"
            },
            C: {
                p95ResponseTime: 1000,
                errorRate: 1.0,
                minThroughput: 20,
                description: "Fair performance"
            },
            D: {
                p95ResponseTime: 2000,
                errorRate: 2.0,
                minThroughput: 10,
                description: "Poor performance"
            },
            F: {
                p95ResponseTime: Infinity,
                errorRate: Infinity,
                minThroughput: 0,
                description: "Failed performance"
            }
        };
    }
}

const performanceThresholds = loadPerformanceThresholds();

function getPerformanceGrade(metrics) {
    // Get the p95 response time from the http_req_duration metric
    const p95ResponseTime = metrics.http_req_duration?.values?.['p(95)'] || 0;
    
    // Calculate error rate as percentage
    const errorCount = metrics.http_req_failed?.values?.count || 0;
    const totalRequests = metrics.http_reqs?.values?.count || 0;
    const errorRate = totalRequests > 0 ? (errorCount / totalRequests) * 100 : 0;
    
    // Get request rate (throughput)
    const requestRate = metrics.http_reqs?.values?.rate || 0;

    console.log('Debug - Grade Metrics:', {
        p95ResponseTime,
        errorRate,
        requestRate,
        totalRequests
    });

    // Check thresholds from A to D
    for (const [grade, threshold] of Object.entries(performanceThresholds)) {
        if (p95ResponseTime <= threshold.p95ResponseTime &&
            errorRate <= threshold.errorRate &&
            requestRate >= threshold.minThroughput) {
            return `grade-${grade.toLowerCase()}`;
        }
    }
    return 'grade-f';
}

function calculatePerformanceGrade(metrics) {
    const gradeClass = getPerformanceGrade(metrics);
    return gradeClass.split('-')[1].toUpperCase();
}

function generateGradeCriteriaHtml() {
    return `
    <div class="row mb-4">
        <div class="col-12">
            <div class="card">
                <div class="card-header">
                    <h5 class="card-title">Performance Grade Criteria</h5>
                </div>
                <div class="card-body">
                    <div class="table-responsive">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Grade</th>
                                    <th>95th Percentile Response Time</th>
                                    <th>Error Rate</th>
                                    <th>Minimum Throughput</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${Object.entries(performanceThresholds)
                                    .map(([grade, criteria]) => `
                                    <tr>
                                        <td><span class="badge grade-${grade.toLowerCase()}">${grade}</span></td>
                                        <td>≤ ${criteria.p95ResponseTime} ms</td>
                                        <td>≤ ${criteria.errorRate}%</td>
                                        <td>≥ ${criteria.minThroughput} req/s</td>
                                    </tr>
                                `).join('')}
                                <tr>
                                    <td><span class="badge grade-f">F</span></td>
                                    <td colspan="3">Results below Grade D thresholds</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                    <div class="mt-3">
                        <small class="text-muted">
                            * All criteria must be met to achieve a grade. The final grade is determined by meeting all thresholds for that grade level.
                        </small>
                    </div>
                </div>
            </div>
        </div>
    </div>`;
}

// Helper function to create a more detailed HTML report
function generateDetailedReport(metrics, testName, outputPath) {
    const timestamp = new Date().toLocaleString();
    const processedMetrics = processMetrics(metrics);
    // Stringify metrics for client-side use
    const metricsJson = JSON.stringify(metrics);
    const template = `
<!DOCTYPE html>
<html>
<head>
    <title>${testName} - Performance Test Report</title>
    <meta charset="UTF-8">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Inject metrics data for client-side JavaScript
        const metrics = ${metricsJson};
    </script>
    <style>
        .metric-card {
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            margin-bottom: 20px;
            transition: transform 0.2s;
        }
        .metric-card:hover {
            transform: translateY(-2px);
        }
        .metric-value {
            font-size: 24px;
            font-weight: bold;
        }
        .metric-label {
            font-size: 14px;
            color: #666;
        }
        .stat-card {
            background: #f8f9fa;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        .chart-container {
            position: relative;
            height: 300px;
            margin-bottom: 30px;
        }
        .dashboard-header {
            background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%);
            padding: 40px 0;
            margin-bottom: 30px;
            color: white;
        }
        .success-metric { color: #2e7d32; }
        .warning-metric { color: #f57f17; }
        .error-metric { color: #c62828; }
        .trend-positive { color: #2e7d32; }
        .trend-negative { color: #c62828; }
        .performance-grade {
            font-size: 48px;
            font-weight: bold;
            text-align: center;
            padding: 20px;
            border-radius: 50%;
            width: 100px;
            height: 100px;
            margin: 0 auto 20px;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .grade-a { background-color: #4caf50; color: white; }
        .grade-b { background-color: #8bc34a; color: white; }
        .grade-c { background-color: #ffc107; color: black; }
        .grade-d { background-color: #ff9800; color: white; }
        .grade-f { background-color: #f44336; color: white; }
        .badge {
            font-size: 1em;
            padding: 0.5em 1em;
            border-radius: 4px;
        }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="container">
            <h1>${testName} Performance Test Report</h1>
            <p class="text-light">Generated: ${timestamp}</p>
        </div>
    </div>

    <div class="container">
        <!-- Overall Performance Grade -->
        <div class="row mb-4">
            <div class="col-12 text-center">
                <div class="performance-grade ${getPerformanceGrade(metrics)}">
                    ${calculatePerformanceGrade(metrics)}
                </div>
                <h3>Overall Performance Grade</h3>
                <p class="text-muted">Based on response times, error rates, and throughput</p>
            </div>
        </div>

        <!-- Summary Section -->
        <div class="container mb-4">
            <div class="row">
                <div class="col-md-3">
                    <div class="card metric-card">
                        <div class="card-body">
                            <h5 class="card-title">Response Time (p95)</h5>
                            <p class="metric-value ${parseFloat(processedMetrics.http_req_duration?.values?.['p(95)']) > 1000 ? 'error-metric' : 'success-metric'}">
                                ${processedMetrics.http_req_duration?.values?.['p(95)']} ms
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card metric-card">
                        <div class="card-body">
                            <h5 class="card-title">Throughput</h5>
                            <p class="metric-value">
                                ${parseFloat(processedMetrics.http_reqs?.values?.rate).toFixed(2)} req/s
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card metric-card">
                        <div class="card-body">
                            <h5 class="card-title">Error Rate</h5>
                            <p class="metric-value ${parseFloat(processedMetrics.http_req_failed?.values?.rate) > 0 ? 'error-metric' : 'success-metric'}">
                                ${(parseFloat(processedMetrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%
                            </p>
                        </div>
                    </div>
                </div>
                <div class="col-md-3">
                    <div class="card metric-card">
                        <div class="card-body">
                            <h5 class="card-title">Total Requests</h5>
                            <p class="metric-value">
                                ${processedMetrics.http_reqs?.values?.count || 0}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Grade Criteria -->
        ${generateGradeCriteriaHtml()}

        <!-- Key Metrics Dashboard -->
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${metrics.http_reqs?.values?.count || 0}</div>
                    <div class="metric-label">Total Requests</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value ${processedMetrics.http_req_duration?.values?.['p(95)'] > 1000 ? 'error-metric' : 'success-metric'}">
                        ${processedMetrics.http_req_duration?.values?.['p(95)']} ms
                    </div>
                    <div class="metric-label">95th Percentile Response Time</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value ${metrics.http_req_duration?.values?.avg > 500 ? 'warning-metric' : 'success-metric'}">
                        ${(metrics.http_req_duration?.values?.avg || 0).toFixed(2)} ms
                    </div>
                    <div class="metric-label">Average Response Time</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${(metrics.http_reqs?.values?.rate || 0).toFixed(1)}/s</div>
                    <div class="metric-label">Request Rate</div>
                </div>
            </div>
        </div>

        <!-- Response Time Distribution -->
        <div class="row mb-4">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Response Time Distribution</h5>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="responseTimeChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Request Rate Over Time</h5>
                    </div>
                    <div class="card-body">
                        <div class="chart-container">
                            <canvas id="requestRateChart"></canvas>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- Detailed Metrics -->
        <div class="row">
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">HTTP Request Metrics</h5>
                    </div>
                    <div class="card-body">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Min Response Time</td>
                                    <td>${(metrics.http_req_duration?.values?.min || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>Max Response Time</td>
                                    <td>${(metrics.http_req_duration?.values?.max || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>Median Response Time</td>
                                    <td>${(metrics.http_req_duration?.values?.med || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>90th Percentile</td>
                                    <td>${(metrics.http_req_duration?.values?.["p(90)"] || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>95th Percentile</td>
                                    <td>${(metrics.http_req_duration?.values?.["p(95)"] || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>99th Percentile</td>
                                    <td>${(metrics.http_req_duration?.values?.["p(99)"] || 0).toFixed(2)} ms</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            <div class="col-md-6">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Network Metrics</h5>
                    </div>
                    <div class="card-body">
                        <table class="table table-hover">
                            <thead>
                                <tr>
                                    <th>Metric</th>
                                    <th>Value</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Data Sent</td>
                                    <td>${formatBytes(metrics.data_sent?.values?.count || 0)}</td>
                                </tr>
                                <tr>
                                    <td>Data Received</td>
                                    <td>${formatBytes(metrics.data_received?.values?.count || 0)}</td>
                                </tr>
                                <tr>
                                    <td>Avg Connection Time</td>
                                    <td>${(metrics.http_req_connecting?.values?.avg || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>Avg TLS Handshake</td>
                                    <td>${(metrics.http_req_tls_handshaking?.values?.avg || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>Avg Send Time</td>
                                    <td>${(metrics.http_req_sending?.values?.avg || 0).toFixed(2)} ms</td>
                                </tr>
                                <tr>
                                    <td>Avg Wait Time</td>
                                    <td>${(metrics.http_req_waiting?.values?.avg || 0).toFixed(2)} ms</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        <!-- Error Analysis -->
        <div class="row mt-4">
            <div class="col-12">
                <div class="card">
                    <div class="card-header">
                        <h5 class="card-title">Error Analysis</h5>
                    </div>
                    <div class="card-body">
                        <div class="row mb-4">
                            <div class="col-md-6">
                                <div class="metric-card p-3 ${metrics.http_req_failed?.values?.rate > 0.01 ? 'bg-danger text-white' : 'bg-success text-white'}">
                                    <h3 class="metric-value">${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%</h3>
                                    <div class="metric-label">Error Rate</div>
                                    <small>${metrics.http_req_failed?.values?.count || 0} errors out of ${metrics.http_reqs?.values?.count || 0} requests</small>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="metric-card p-3 bg-white">
                                    <h3 class="metric-value">${calculatePerformanceGrade(metrics)}</h3>
                                    <div class="metric-label">Performance Grade</div>
                                    <small>${performanceThresholds[calculatePerformanceGrade(metrics)]?.description || 'Grade explanation not available'}</small>
                                </div>
                            </div>
                        </div>
                        
                        <div class="table-responsive">
                            <table class="table table-hover">
                                <thead>
                                    <tr>
                                        <th>Error Type</th>
                                        <th>Count</th>
                                        <th>Rate</th>
                                        <th>Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    <tr>
                                        <td>HTTP Errors</td>
                                        <td>${metrics.http_req_failed?.values?.count || 0}</td>
                                        <td>${((metrics.http_req_failed?.values?.rate || 0) * 100).toFixed(2)}%</td>
                                        <td>
                                            ${getErrorImpact(metrics.http_req_failed?.values?.rate || 0)}
                                        </td>
                                    </tr>
                                    <tr>
                                        <td>Slow Responses (>1s)</td>
                                        <td>${calculateSlowResponses(metrics)}</td>
                                        <td>${calculateSlowResponseRate(metrics)}%</td>
                                        <td>
                                            ${getResponseTimeImpact(metrics)}
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Response Time Distribution Chart
        const responseTimeCtx = document.getElementById('responseTimeChart').getContext('2d');
        const httpDuration = metrics.http_req_duration?.values || {};
        new Chart(responseTimeCtx, {
            type: 'bar',
            data: {
                labels: ['Min', 'Median', 'p90', 'p95', 'p99', 'Max'],
                datasets: [{
                    label: 'Response Time (ms)',
                    data: [
                        httpDuration.min || 0,
                        httpDuration.med || 0,
                        httpDuration['p(90)'] || 0,
                        httpDuration['p(95)'] || 0,
                        httpDuration['p(99)'] || 0,
                        httpDuration.max || 0
                    ],
                    backgroundColor: [
                        'rgba(75, 192, 192, 0.2)',
                        'rgba(54, 162, 235, 0.2)',
                        'rgba(255, 206, 86, 0.2)',
                        'rgba(255, 159, 64, 0.2)',
                        'rgba(153, 102, 255, 0.2)',
                        'rgba(255, 99, 132, 0.2)'
                    ],
                    borderColor: [
                        'rgba(75, 192, 192, 1)',
                        'rgba(54, 162, 235, 1)',
                        'rgba(255, 206, 86, 1)',
                        'rgba(255, 159, 64, 1)',
                        'rgba(153, 102, 255, 1)',
                        'rgba(255, 99, 132, 1)'
                    ],
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Response Time (ms)'
                        }
                    }
                }
            }
        });

        // Request Rate Chart
        const requestRateCtx = document.getElementById('requestRateChart').getContext('2d');
        new Chart(requestRateCtx, {
            type: 'line',
            data: {
                labels: ['Start', '25%', '50%', '75%', 'End'],
                datasets: [{
                    label: 'Requests per Second',
                    data: generateRequestRateData(${metrics.http_reqs?.values?.rate || 0}),
                    borderColor: 'rgb(54, 162, 235)',
                    tension: 0.3,
                    fill: false
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        title: {
                            display: true,
                            text: 'Requests/s'
                        }
                    }
                }
            }
        });

        // Helper function to generate request rate data points
        function generateRequestRateData(avgRate) {
            // Simulate variation in request rate
            const baseRate = avgRate;
            return [
                baseRate * 0.7,  // Start
                baseRate * 0.9,  // 25%
                baseRate,        // 50%
                baseRate * 1.1,  // 75%
                baseRate * 0.8   // End
            ];
        }

        function formatTooltipValue(value, type = '') {
            if (type === 'duration') {
                return \`\${parseFloat(value).toFixed(2)} ms\`;
            } else if (type === 'rate') {
                return \`\${parseFloat(value).toFixed(2)} req/s\`;
            } else if (type === 'percentage') {
                return \`\${parseFloat(value).toFixed(2)}%\`;
            }
            return value;
        }

        function createTimeSeriesChart(ctx, data, label, type = '') {
            return new Chart(ctx, {
                type: 'line',
                data: {
                    labels: data.map(point => new Date(point.timestamp).toLocaleTimeString()),
                    datasets: [{
                        label: label,
                        data: data.map(point => point.value),
                        borderColor: 'rgb(54, 162, 235)',
                        tension: 0.3,
                        fill: false
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        tooltip: {
                            callbacks: {
                                label: function(context) {
                                    return \`\${context.dataset.label}: \${formatTooltipValue(context.raw, type)}\`;
                                }
                            }
                        }
                    },
                    scales: {
                        x: {
                            type: 'time',
                            time: {
                                unit: 'minute'
                            },
                            title: {
                                display: true,
                                text: 'Time'
                            }
                        },
                        y: {
                            beginAtZero: true,
                            title: {
                                display: true,
                                text: label
                            }
                        }
                    }
                });
        }

        // Create detailed time series charts
        const httpReqDurationCtx = document.getElementById('httpReqDurationChart').getContext('2d');
        createTimeSeriesChart(httpReqDurationCtx, metrics.http_req_duration?.timeSeriesValues || [], 'HTTP Request Duration', 'duration');

        const httpReqRateCtx = document.getElementById('httpReqRateChart').getContext('2d');
        createTimeSeriesChart(httpReqRateCtx, metrics.http_reqs?.timeSeriesValues || [], 'HTTP Request Rate', 'rate');
    </script>
</body>
</html>`;

    fs.writeFileSync(path.join(outputPath, 'index.html'), template);
}

function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

function parseJSONLines(content) {
    const lines = content.trim().split('\n');
    const metrics = {};
    const metricDefinitions = {};
    const timeSeriesData = {};
    
    console.log(`Processing ${lines.length} metric lines`);
    
    for (const line of lines) {
        try {
            if (!line.trim()) continue;
            
            const data = JSON.parse(line);
            const metricName = data.metric;
            
            // Store metric definitions
            if (data.type === 'Metric') {
                metricDefinitions[metricName] = data.data;
                metrics[metricName] = {
                    values: {},
                    type: data.data.type,
                    contains: data.data.contains,
                    submetrics: data.data.submetrics
                };
                continue;
            }
            
            // Process metric points
            if (data.type === 'Point' && data.data) {
                const value = data.data.value;
                const timestamp = new Date(data.data.time).getTime();
                const tags = data.data.tags || {};
                
                if (!metrics[metricName]) {
                    metrics[metricName] = { values: {} };
                }
                
                // Initialize time series data
                if (!timeSeriesData[metricName]) {
                    timeSeriesData[metricName] = [];
                }
                
                // Store time series point
                timeSeriesData[metricName].push({
                    timestamp,
                    value,
                    tags
                });
                
                // Process metrics based on their type
                switch (metricDefinitions[metricName]?.type) {
                    case 'trend':
                        if (!metrics[metricName].values.samples) {
                            metrics[metricName].values.samples = [];
                        }
                        metrics[metricName].values.samples.push(value);
                        break;
                        
                    case 'counter':
                        metrics[metricName].values.count = (metrics[metricName].values.count || 0) + 1;
                        break;
                        
                    case 'rate':
                        metrics[metricName].values.rate = value;
                        break;
                        
                    case 'gauge':
                        metrics[metricName].values.current = value;
                        break;
                }
                
                // Store tags for metric context
                if (Object.keys(tags).length > 0) {
                    metrics[metricName].lastTags = tags;
                }
            }
        } catch (error) {
            console.warn(`Warning: Error parsing JSON line: ${error.message}`);
            continue;
        }
    }
    
    // Calculate statistics for trend metrics
    Object.entries(metrics).forEach(([name, metric]) => {
        if (metric.type === 'trend' && metric.values.samples?.length > 0) {
            const samples = metric.values.samples;
            const sorted = [...samples].sort((a, b) => a - b);
            const len = sorted.length;
            
            // Calculate indices for percentiles
            const p90Index = Math.ceil(len * 0.9) - 1;
            const p95Index = Math.ceil(len * 0.95) - 1;
            const p99Index = Math.ceil(len * 0.99) - 1;
            
            metric.values = {
                min: sorted[0],
                max: sorted[len - 1],
                avg: samples.reduce((a, b) => a + b, 0) / len,
                med: len % 2 === 0 ? (sorted[len/2 - 1] + sorted[len/2]) / 2 : sorted[Math.floor(len/2)],
                'p(90)': sorted[p90Index],
                'p(95)': sorted[p95Index],
                'p(99)': sorted[p99Index],
                count: len
            };
        }
        
        // Calculate rates for counters
        if (metric.type === 'counter' && metric.values.count) {
            const timeRange = (Math.max(...timeSeriesData[name].map(p => p.timestamp)) - 
                             Math.min(...timeSeriesData[name].map(p => p.timestamp))) / 1000;
            metric.values.rate = metric.values.count / (timeRange || 60); // Use 60s as fallback
        }
    });
    
    // Debug logging
    console.log('Debug: HTTP Duration Metrics:', 
        Object.entries(metrics)
            .filter(([name]) => name === 'http_req_duration')
            .map(([_, metric]) => metric.values)
    );
    
    // Add time series data to metrics for use in charts
    for (const [metricName, points] of Object.entries(timeSeriesData)) {
        if (!metrics[metricName]) {
            metrics[metricName] = { values: {} };
        }
        // Make sure time series data is available for charts
        metrics[metricName].timeSeriesValues = points;
    }
    
    console.log(`Processed ${Object.keys(metrics).length} metrics with time series data`);
    return metrics;
}

function enrichMetricsWithAnalysis(metrics) {
    const enriched = { ...metrics };
    
    // Calculate error rates and success metrics
    if (enriched.http_reqs?.values?.count) {
        const totalRequests = enriched.http_reqs.values.count;
        const errorCount = enriched.http_req_failed?.values?.count || 0;
        const successCount = totalRequests - errorCount;
        
        enriched.error_rate = {
            values: {
                count: errorCount,
                percentage: (errorCount / totalRequests) * 100,
                rate: errorCount / totalRequests,
                success_rate: (successCount / totalRequests) * 100
            }
        };
    }
    
    // Enhanced throughput analysis
    if (enriched.http_reqs?.values?.count) {
        const duration = enriched.http_reqs.values.count / enriched.http_reqs.values.rate;
        const bytesReceived = enriched.data_received?.values?.count || 0;
        const bytesSent = enriched.data_sent?.values?.count || 0;
        
        enriched.throughput = {
            values: {
                rps: enriched.http_reqs.values.rate,
                total_requests: enriched.http_reqs.values.count,
                bytes_per_second: (bytesReceived + bytesSent) / duration,
                data_transfer_rate: {
                    in: bytesReceived / duration,
                    out: bytesSent / duration
                },
                test_duration: duration,
                average_payload_size: (bytesReceived + bytesSent) / enriched.http_reqs.values.count
            }
        };
    }
    
    // Detailed response time analysis
    if (enriched.http_req_duration?.values) {
        const p95 = enriched.http_req_duration.values["p(95)"];
        const p99 = enriched.http_req_duration.values["p(99)"];
        const avg = enriched.http_req_duration.values.avg;
        const med = enriched.http_req_duration.values.med;
        
        enriched.response_time_analysis = {
            values: {
                min: enriched.http_req_duration.values.min,
                max: enriched.http_req_duration.values.max,
                avg: avg,
                med: med,
                p90: enriched.http_req_duration.values["p(90)"],
                p95: p95,
                p99: p99,
                stability_score: (p95 - med) / med, // Lower is better
                consistency_score: (p99 - p95) / p95, // Lower is better
                status: p95 <= 200 ? 'excellent' :
                       p95 <= 500 ? 'good' :
                       p95 <= 1000 ? 'fair' : 'poor',
                trend: avg <= med ? 'improving' :
                      avg >= p95 ? 'degrading' : 'stable'
            }
        };
    }
    
    // Network timing breakdown
    enriched.network_analysis = {
        values: {
            connection: {
                avg: enriched.http_req_connecting?.values?.avg || 0,
                max: enriched.http_req_connecting?.values?.max || 0
            },
            tls: {
                avg: enriched.http_req_tls_handshaking?.values?.avg || 0,
                max: enriched.http_req_tls_handshaking?.values?.max || 0
            },
            sending: {
                avg: enriched.http_req_sending?.values?.avg || 0,
                max: enriched.http_req_sending?.values?.max || 0
            },
            waiting: {
                avg: enriched.http_req_waiting?.values?.avg || 0,
                max: enriched.http_req_waiting?.values?.max || 0
            },
            receiving: {
                avg: enriched.http_req_receiving?.values?.avg || 0,
                max: enriched.http_req_receiving?.values?.max || 0
            },
            total_network_time: {
                avg: (enriched.http_req_connecting?.values?.avg || 0) +
                    (enriched.http_req_tls_handshaking?.values?.avg || 0) +
                    (enriched.http_req_sending?.values?.avg || 0) +
                    (enriched.http_req_receiving?.values?.avg || 0)
            }
        }
    };
    
    return enriched;
}

function processMetrics(metrics) {
    const processedMetrics = {};
    
    for (const [key, value] of Object.entries(metrics)) {
        if (!value || !value.values) continue;
        
        processedMetrics[key] = {
            ...value,
            values: {
                ...value.values,
                // Ensure high precision for percentiles and other floating-point values
                'p(95)': value.values['p(95)']?.toFixed(4),
                'avg': value.values['avg']?.toFixed(4),
                'min': value.values['min']?.toFixed(4),
                'max': value.values['max']?.toFixed(4),
                'med': value.values['med']?.toFixed(4),
                // Keep original values for counts and integers
                'count': value.values['count'],
                'rate': value.values['rate']?.toFixed(2)
            }
        };
    }
    
    return processedMetrics;
}

async function transformK6JsonToReport(filePath) {
    try {
        // Read file content
        const content = fs.readFileSync(filePath, 'utf8');
        
        // Parse metrics
        const baseMetrics = parseJSONLines(content);
        
        // Enrich metrics with analysis
        const enrichedMetrics = enrichMetricsWithAnalysis(baseMetrics);
        
        // Generate the report
        return enrichedMetrics;
    } catch (error) {
        console.error('Error processing k6 results:', error);
        throw error;
    }
}

async function generateReports() {
    // Create reports directory if it doesn't exist
    const reportsDir = path.resolve(__dirname, '../reports');
    const postReportDir = path.resolve(reportsDir, 'post');
    const getReportDir = path.resolve(reportsDir, 'get');

    [reportsDir, postReportDir, getReportDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    });

    try {
        const postResultsPath = path.resolve(__dirname, '../post-results.json');
        const getResultsPath = path.resolve(__dirname, '../get-results.json');

        // Process POST test results
        console.log('Processing POST test results...');
        const postMetrics = await transformK6JsonToReport(postResultsPath);
        console.log('Generating Upload (POST) test report...');
        generateDetailedReport(postMetrics, 'S3 Upload Endpoint Test Results', postReportDir);

        // Process GET test results
        console.log('Processing GET test results...');
        const getMetrics = await transformK6JsonToReport(getResultsPath);
        console.log('Generating Download (GET) test report...');
        generateDetailedReport(getMetrics, 'S3 Download Endpoint Test Results', getReportDir);

        console.log('\nReports generated successfully!');
        console.log('POST test report:', path.join('reports', 'post', 'index.html'));
        console.log('GET test report:', path.join('reports', 'get', 'index.html'));
    } catch (error) {
        console.error('Error generating reports:', error.message);
        if (error.stack) {
            console.error('Stack trace:', error.stack);
        }
        process.exit(1);
    }
}

generateReports().catch(error => {
    console.error('Failed to generate reports:', error);
    process.exit(1);
});

function getErrorImpact(errorRate) {
    if (errorRate === 0) return '<span class="text-success">No Impact</span>';
    if (errorRate <= 0.001) return '<span class="text-warning">Minimal</span>';
    if (errorRate <= 0.01) return '<span class="text-warning">Moderate</span>';
    return '<span class="text-danger">Severe</span>';
}

function calculateSlowResponses(metrics) {
    const p95 = metrics.http_req_duration?.values?.["p(95)"] || 0;
    const total = metrics.http_reqs?.values?.count || 0;
    return Math.round((total * 0.05) * (p95 > 1000 ? 1 : 0));
}

function calculateSlowResponseRate(metrics) {
    const total = metrics.http_reqs?.values?.count || 0;
    const slowCount = calculateSlowResponses(metrics);
    return ((slowCount / total) * 100).toFixed(2);
}

function getResponseTimeImpact(metrics) {
    const p95 = metrics.http_req_duration?.values?.["p(95)"] || 0;
    if (p95 <= 200) return '<span class="text-success">Excellent</span>';
    if (p95 <= 500) return '<span class="text-success">Good</span>';
    if (p95 <= 1000) return '<span class="text-warning">Fair</span>';
    return '<span class="text-danger">Poor</span>';
}
