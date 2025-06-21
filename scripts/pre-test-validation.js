#!/usr/bin/env node

/**
 * Pre-test validation script
 * Ensures all required services and dependencies are ready before running tests
 */

const http = require('http');
const https = require('https');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class PreTestValidator {
    constructor() {
        this.checks = [];
        this.errors = [];
        this.warnings = [];
    }

    // Add colored logging
    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            warning: '\x1b[33m', // Yellow
            error: '\x1b[31m',   // Red
            reset: '\x1b[0m'     // Reset
        };
        
        const icon = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        console.log(`${colors[type]}${icon[type]} ${message}${colors.reset}`);
    }

    // Check if a command exists
    async checkCommand(command, description) {
        return new Promise((resolve) => {
            const proc = spawn('which', [command], { stdio: 'ignore' });
            proc.on('close', (code) => {
                if (code === 0) {
                    this.log(`${description} is installed`, 'success');
                    resolve(true);
                } else {
                    this.errors.push(`${description} is not installed or not in PATH`);
                    this.log(`${description} is not installed or not in PATH`, 'error');
                    resolve(false);
                }
            });
        });
    }

    // Check if a service is responding
    async checkService(url, description, timeout = 5000) {
        return new Promise((resolve) => {
            const urlObj = new URL(url);
            const client = urlObj.protocol === 'https:' ? https : http;
            
            const req = client.get(url, { timeout }, (res) => {
                if (res.statusCode >= 200 && res.statusCode < 400) {
                    this.log(`${description} is responding (${res.statusCode})`, 'success');
                    resolve(true);
                } else {
                    this.warnings.push(`${description} responded with status ${res.statusCode}`);
                    this.log(`${description} responded with status ${res.statusCode}`, 'warning');
                    resolve(false);
                }
                req.destroy();
            });

            req.on('error', (err) => {
                this.errors.push(`${description} is not responding: ${err.message}`);
                this.log(`${description} is not responding: ${err.message}`, 'error');
                resolve(false);
            });

            req.on('timeout', () => {
                this.errors.push(`${description} timed out after ${timeout}ms`);
                this.log(`${description} timed out after ${timeout}ms`, 'error');
                req.destroy();
                resolve(false);
            });
        });
    }

    // Check if file exists
    checkFile(filePath, description, required = true) {
        if (fs.existsSync(filePath)) {
            this.log(`${description} exists`, 'success');
            return true;
        } else {
            const message = `${description} not found at ${filePath}`;
            if (required) {
                this.errors.push(message);
                this.log(message, 'error');
            } else {
                this.warnings.push(message);
                this.log(message, 'warning');
            }
            return false;
        }
    }

    // Check Docker containers
    async checkDockerContainers() {
        return new Promise((resolve) => {
            const proc = spawn('docker', ['ps', '--filter', 'name=localstack', '--format', '{{.Names}}\t{{.Status}}'], 
                { stdio: ['ignore', 'pipe', 'pipe'] });
            
            let output = '';
            proc.stdout.on('data', (data) => {
                output += data.toString();
            });

            proc.on('close', (code) => {
                if (code === 0 && output.trim()) {
                    const containers = output.trim().split('\n');
                    let allHealthy = true;
                    
                    containers.forEach(line => {
                        const [name, status] = line.split('\t');
                        if (status.includes('Up')) {
                            this.log(`Docker container ${name} is running`, 'success');
                        } else {
                            this.errors.push(`Docker container ${name} is not healthy: ${status}`);
                            this.log(`Docker container ${name} is not healthy: ${status}`, 'error');
                            allHealthy = false;
                        }
                    });
                    
                    resolve(allHealthy);
                } else {
                    this.errors.push('No LocalStack containers found or Docker command failed');
                    this.log('No LocalStack containers found or Docker command failed', 'error');
                    resolve(false);
                }
            });

            proc.on('error', (err) => {
                this.errors.push(`Failed to check Docker containers: ${err.message}`);
                this.log(`Failed to check Docker containers: ${err.message}`, 'error');
                resolve(false);
            });
        });
    }

    // Check environment variables
    checkEnvironmentVariables() {
        const requiredVars = ['REGION', 'ENDPOINT', 'BUCKET'];
        const optionalVars = ['SFN_ARN', 'STEP_FUNCTION_NAME'];
        
        let allRequired = true;
        
        // Load .env file if it exists
        const envPath = path.resolve(process.cwd(), '.env');
        if (fs.existsSync(envPath)) {
            const envContent = fs.readFileSync(envPath, 'utf8');
            const envVars = {};
            
            envContent.split('\n').forEach(line => {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        envVars[key] = valueParts.join('=');
                    }
                }
            });
            
            // Check required variables
            requiredVars.forEach(varName => {
                if (process.env[varName] || envVars[varName]) {
                    this.log(`Environment variable ${varName} is set`, 'success');
                } else {
                    this.errors.push(`Required environment variable ${varName} is not set`);
                    this.log(`Required environment variable ${varName} is not set`, 'error');
                    allRequired = false;
                }
            });
            
            // Check optional variables
            optionalVars.forEach(varName => {
                if (process.env[varName] || envVars[varName]) {
                    this.log(`Optional environment variable ${varName} is set`, 'success');
                } else {
                    this.warnings.push(`Optional environment variable ${varName} is not set`);
                    this.log(`Optional environment variable ${varName} is not set`, 'warning');
                }
            });
        } else {
            this.warnings.push('.env file not found, relying on system environment variables');
            this.log('.env file not found, relying on system environment variables', 'warning');
        }
        
        return allRequired;
    }

    // Main validation method
    async validate() {
        this.log('🔍 Starting pre-test validation...', 'info');
        
        // Check required commands
        const commands = [
            { cmd: 'docker', desc: 'Docker' },
            { cmd: 'docker-compose', desc: 'Docker Compose' },
            { cmd: 'k6', desc: 'k6 Load Testing Tool' },
            { cmd: 'node', desc: 'Node.js' },
            { cmd: 'npm', desc: 'npm' }
        ];
        
        this.log('\n📋 Checking required tools...', 'info');
        for (const { cmd, desc } of commands) {
            await this.checkCommand(cmd, desc);
        }
        
        // Check optional commands
        this.log('\n📋 Checking optional tools...', 'info');
        await this.checkCommand('jq', 'jq (JSON processor)');
        await this.checkCommand('curl', 'curl');
        
        // Check required files
        this.log('\n📁 Checking required files...', 'info');
        const requiredFiles = [
            { path: './package.json', desc: 'package.json' },
            { path: './docker-compose.yml', desc: 'docker-compose.yml' },
            { path: './lambda/index.js', desc: 'Lambda function' },
            { path: './k6/post-test.js', desc: 'POST test script' },
            { path: './k6/get-test.js', desc: 'GET test script' },
            { path: './k6/stepfn-test.js', desc: 'Step Functions test script' }
        ];
        
        requiredFiles.forEach(({ path, desc }) => {
            this.checkFile(path, desc, true);
        });
        
        // Check optional files
        this.log('\n📁 Checking optional files...', 'info');
        const optionalFiles = [
            { path: './.env', desc: 'Environment configuration' },
            { path: './config/performance-thresholds.json', desc: 'Performance thresholds config' },
            { path: './config/k6-config.json', desc: 'k6 configuration' }
        ];
        
        optionalFiles.forEach(({ path, desc }) => {
            this.checkFile(path, desc, false);
        });
        
        // Check environment variables
        this.log('\n🌍 Checking environment variables...', 'info');
        this.checkEnvironmentVariables();
        
        // Check Docker containers
        this.log('\n🐳 Checking Docker containers...', 'info');
        await this.checkDockerContainers();
        
        // Check services
        this.log('\n🔗 Checking service endpoints...', 'info');
        await this.checkService('http://localhost:4566/_localstack/health', 'LocalStack');
        await this.checkService('http://localhost:3000/health', 'API Gateway Simulation');
        
        // Generate summary
        this.log('\n📊 Validation Summary:', 'info');
        
        if (this.errors.length === 0) {
            this.log(`✅ All critical checks passed!`, 'success');
            if (this.warnings.length > 0) {
                this.log(`⚠️  ${this.warnings.length} warning(s) found (non-critical)`, 'warning');
                this.warnings.forEach(warning => {
                    this.log(`   • ${warning}`, 'warning');
                });
            }
            this.log('\n🚀 System is ready for testing!', 'success');
            return true;
        } else {
            this.log(`❌ ${this.errors.length} critical error(s) found:`, 'error');
            this.errors.forEach(error => {
                this.log(`   • ${error}`, 'error');
            });
            
            if (this.warnings.length > 0) {
                this.log(`⚠️  ${this.warnings.length} warning(s) found:`, 'warning');
                this.warnings.forEach(warning => {
                    this.log(`   • ${warning}`, 'warning');
                });
            }
            
            this.log('\n🛠️  Please resolve the errors before running tests.', 'error');
            return false;
        }
    }
}

// Run validation if called directly
if (require.main === module) {
    const validator = new PreTestValidator();
    validator.validate().then(success => {
        process.exit(success ? 0 : 1);
    }).catch(err => {
        console.error('Validation failed:', err);
        process.exit(1);
    });
}

module.exports = PreTestValidator;
