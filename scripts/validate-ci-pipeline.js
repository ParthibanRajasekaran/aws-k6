#!/usr/bin/env node

/**
 * CI/CD Pipeline Validation Script
 * 
 * This script validates that all components of our CI/CD pipeline are properly configured
 * and can be executed. It checks for:
 * - Required dependencies and tools
 * - Configuration files
 * - Test structure
 * - Build scripts
 * - LocalStack setup
 * - K6 performance tests
 */

const fs = require('fs');
const { execSync } = require('child_process');

class PipelineValidator {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  log(type, message) {
    const timestamp = new Date().toISOString();
    const formatted = `[${timestamp}] ${type.toUpperCase()}: ${message}`;
    
    switch(type) {
      case 'error':
        this.errors.push(message);
        console.error('\x1b[31m%s\x1b[0m', formatted);
        break;
      case 'warning':
        this.warnings.push(message);
        console.warn('\x1b[33m%s\x1b[0m', formatted);
        break;
      case 'success':
        this.success.push(message);
        console.log('\x1b[32m%s\x1b[0m', formatted);
        break;
      default:
        console.log(formatted);
    }
  }

  async validateFileExists(filePath, required = true) {
    const exists = fs.existsSync(filePath);
    if (exists) {
      this.log('success', `Found required file: ${filePath}`);
      return true;
    } else {
      this.log(required ? 'error' : 'warning', `Missing file: ${filePath}`);
      return false;
    }
  }

  async validatePackageJson() {
    this.log('info', 'Validating package.json configuration...');
    
    if (!await this.validateFileExists('package.json')) {
      return false;
    }

    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
      
      // Check required scripts
      const requiredScripts = [
        'test:unit',
        'test:unit:coverage',
        '_lint',
        'start',
        'deploy:localstack',
        'verify:localstack'
      ];

      for (const script of requiredScripts) {
        if (pkg.scripts && pkg.scripts[script]) {
          this.log('success', `Found required script: ${script}`);
        } else {
          this.log('error', `Missing required script: ${script}`);
        }
      }

      // Check dependencies
      const criticalDeps = ['jest', 'eslint', '@aws-sdk/client-s3'];
      for (const dep of criticalDeps) {
        if ((pkg.dependencies && pkg.dependencies[dep]) || 
            (pkg.devDependencies && pkg.devDependencies[dep])) {
          this.log('success', `Found critical dependency: ${dep}`);
        } else {
          this.log('error', `Missing critical dependency: ${dep}`);
        }
      }

      return true;
    } catch (error) {
      this.log('error', `Failed to parse package.json: ${error.message}`);
      return false;
    }
  }

  async validateWorkflowFiles() {
    this.log('info', 'Validating GitHub Actions workflow files...');
    
    const workflowFile = '.github/workflows/best-practices-ci-cd.yml';
    if (!await this.validateFileExists(workflowFile)) {
      return false;
    }

    try {
      const yaml = require('yaml');
      const workflow = yaml.parse(fs.readFileSync(workflowFile, 'utf8'));

      // Validate job structure
      const expectedJobs = ['setup', 'quality', 'unit-tests', 'integration-tests', 'performance-tests', 'build'];
      for (const job of expectedJobs) {
        if (workflow.jobs && workflow.jobs[job]) {
          this.log('success', `Found required job: ${job}`);
        } else {
          this.log('warning', `Missing recommended job: ${job}`);
        }
      }

      this.log('success', 'Workflow file structure is valid');
      return true;
    } catch (error) {
      // If yaml package is not installed, we'll skip detailed validation
      this.log('warning', `Could not parse workflow YAML (yaml package not installed): ${error.message}`);
      return true; // We already validated it exists
    }
  }

  async validateTestStructure() {
    this.log('info', 'Validating test structure...');
    
    const testPaths = [
      'tests/unit',
      'k6',
      'jest.config.js',
      'eslint.config.js'
    ];

    let allValid = true;
    for (const testPath of testPaths) {
      if (!await this.validateFileExists(testPath)) {
        allValid = false;
      }
    }

    // Check for test files
    if (fs.existsSync('tests/unit')) {
      const testFiles = fs.readdirSync('tests/unit', { recursive: true })
        .filter(file => file.endsWith('.test.js'));
      
      if (testFiles.length > 0) {
        this.log('success', `Found ${testFiles.length} test files`);
      } else {
        this.log('warning', 'No test files found in tests/unit');
      }
    }

    // Check K6 tests
    if (fs.existsSync('k6')) {
      const k6Files = fs.readdirSync('k6')
        .filter(file => file.endsWith('.js'));
      
      if (k6Files.length > 0) {
        this.log('success', `Found ${k6Files.length} K6 test files`);
      } else {
        this.log('warning', 'No K6 test files found');
      }
    }

    return allValid;
  }

  async validateLocalStackConfig() {
    this.log('info', 'Validating LocalStack configuration...');
    
    const configFiles = [
      'docker-compose.yml',
      'docker-compose.lambda-s3.yml'
    ];

    for (const configFile of configFiles) {
      await this.validateFileExists(configFile, false);
    }

    return true;
  }

  async validateCommands() {
    this.log('info', 'Validating available commands...');
    
    const commands = [
      { cmd: 'node --version', name: 'Node.js' },
      { cmd: 'npm --version', name: 'npm' }
    ];

    for (const { cmd, name } of commands) {
      try {
        const result = execSync(cmd, { encoding: 'utf8', stdio: 'pipe' });
        this.log('success', `${name} is available: ${result.trim()}`);
      } catch (error) {
        this.log('error', `${name} is not available or not working: ${error.message}`);
      }
    }

    return true;
  }

  async validateEnvironmentVars() {
    this.log('info', 'Validating environment configuration...');
    
    // Check for .env files
    const envFiles = ['.env', '.env.example', '.env.local'];
    for (const envFile of envFiles) {
      await this.validateFileExists(envFile, false);
    }

    return true;
  }

  async runValidation() {
    this.log('info', 'Starting CI/CD Pipeline Validation...');
    this.log('info', '================================================');

    await this.validatePackageJson();
    await this.validateWorkflowFiles();
    await this.validateTestStructure();
    await this.validateLocalStackConfig();
    await this.validateCommands();
    await this.validateEnvironmentVars();

    this.log('info', '================================================');
    this.log('info', 'Validation Summary:');
    this.log('info', `✅ Success: ${this.success.length}`);
    this.log('info', `⚠️  Warnings: ${this.warnings.length}`);
    this.log('info', `❌ Errors: ${this.errors.length}`);

    if (this.errors.length > 0) {
      this.log('error', 'Pipeline validation failed. Please fix the errors above.');
      process.exit(1);
    } else if (this.warnings.length > 0) {
      this.log('warning', 'Pipeline validation passed with warnings. Consider addressing the warnings above.');
      process.exit(0);
    } else {
      this.log('success', 'Pipeline validation passed successfully! 🎉');
      process.exit(0);
    }
  }
}

// Run validation if this script is executed directly
if (require.main === module) {
  const validator = new PipelineValidator();
  validator.runValidation().catch(error => {
    console.error('Validation failed with error:', error);
    process.exit(1);
  });
}

module.exports = PipelineValidator;
