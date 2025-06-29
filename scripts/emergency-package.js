#!/usr/bin/env node
/**
 * Emergency Lambda packaging script
 * This is a simpler fallback script for CI environments when the main packaging script fails
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const tempDir = path.join(__dirname, '..', 'lambda-emergency');
const outputZip = path.join(__dirname, '..', 'function.zip');
const sourceDir = path.join(__dirname, '..', 'lambda');

console.log('🚨 EMERGENCY LAMBDA PACKAGING SCRIPT 🚨');
console.log('Running simplified packaging as fallback...');

try {
  // Clean up any existing temporary directory and zip
  if (fs.existsSync(tempDir)) {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }

  // Create temp directory
  fs.mkdirSync(tempDir, { recursive: true });
  fs.mkdirSync(path.join(tempDir, 'node_modules'), { recursive: true });
  
  // Copy Lambda source
  fs.copyFileSync(path.join(sourceDir, 'index.js'), path.join(tempDir, 'index.js'));
  
  // Install only the critical dependencies directly
  console.log('Installing critical dependencies directly...');
  execSync('npm install --no-save @aws-sdk/client-s3 lru-cache', {
    cwd: tempDir,
    stdio: 'inherit'
  });
  
  // Create zip
  console.log('Creating emergency zip package...');
  execSync(`cd "${tempDir}" && zip -r "${outputZip}" .`, { stdio: 'inherit' });
  
  // Basic verification
  const zipStat = fs.statSync(outputZip);
  console.log(`Emergency package created: ${zipStat.size} bytes`);
  
  if (zipStat.size < 100000) {
    console.warn('Warning: Package seems small, dependencies may be missing');
  } else {
    console.log('Package size looks reasonable');
  }
  
  console.log('Emergency packaging completed');
} catch (error) {
  console.error('Error in emergency packaging:', error);
  process.exit(1);
}
