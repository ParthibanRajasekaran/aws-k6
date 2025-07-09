const fs = require('fs');
const path = require('path');

const metrics = require('./sample-results.json');

function generateDemoReport(metrics, outputPath) {
  const metricsJson = JSON.stringify(metrics);
  const timestamp = new Date().toLocaleString();
  const html = `<!DOCTYPE html>
<html>
<head>
    <title>Demo S3 Endpoint Performance Test Report</title>
    <meta charset="UTF-8">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.1.3/dist/css/bootstrap.min.css" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
    <script>
        // Inject metrics data for client-side JavaScript
        const metrics = ${metricsJson};
    </script>
    <style>
        .metric-card { border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); margin-bottom: 20px; transition: transform 0.2s; }
        .metric-card:hover { transform: translateY(-2px); }
        .metric-value { font-size: 24px; font-weight: bold; }
        .metric-label { font-size: 14px; color: #666; }
        .chart-container { position: relative; height: 300px; margin-bottom: 30px; }
        .dashboard-header { background: linear-gradient(135deg, #1e88e5 0%, #1565c0 100%); padding: 40px 0; margin-bottom: 30px; color: white; }
        .success-metric { color: #2e7d32; }
    </style>
</head>
<body>
    <div class="dashboard-header">
        <div class="container">
            <h1>Demo S3 Endpoint Performance Test Report</h1>
            <p class="text-light">Generated: ${timestamp}</p>
        </div>
    </div>
    <div class="container">
        <div class="row mb-4">
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${metrics.http_reqs.values.count}</div>
                    <div class="metric-label">Total Requests</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${metrics.http_req_duration.values["p(95)"]} ms</div>
                    <div class="metric-label">95th Percentile Response Time</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${metrics.http_req_duration.values.avg} ms</div>
                    <div class="metric-label">Average Response Time</div>
                </div>
            </div>
            <div class="col-md-3">
                <div class="metric-card p-3 bg-white">
                    <div class="metric-value success-metric">${metrics.http_reqs.values.rate}/s</div>
                    <div class="metric-label">Request Rate</div>
                </div>
            </div>
        </div>
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
                    data: metrics.http_reqs.timeSeriesValues.map(p => p.value),
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
    </script>
</body>
</html>`;
  fs.writeFileSync(outputPath, html, 'utf8');
  console.log('Demo report generated at', outputPath);
}

generateDemoReport(metrics, path.join(__dirname, 'index.html'));
