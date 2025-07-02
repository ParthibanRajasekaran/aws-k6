/**
 * Emergency Lambda packaging script
 * Fallback script for when the main packaging fails
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚨 Emergency Lambda packaging - Creating minimal deployment package');

const outputZip = path.join(__dirname, '..', 'function.zip');

try {
  // Remove existing zip if it exists
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }

  // Create a very simple package with just the Lambda function
  console.log('Creating emergency package with basic dependencies...');
  
  // Use zip command directly to create package
  const lambdaDir = path.join(__dirname, '..', 'lambda');
  const nodeModulesDir = path.join(__dirname, '..', 'node_modules');
  
  // Check if directories exist
  if (!fs.existsSync(lambdaDir)) {
    throw new Error('Lambda directory not found');
  }
  
  // Create zip with lambda files and critical dependencies
  const zipCommands = [
    `cd "${path.dirname(outputZip)}"`,
    `zip -r function.zip lambda/index.js`,
  ];
  
  // Add critical node_modules if they exist
  const criticalDeps = [
    '@aws-sdk/client-s3',
    'lru-cache'
  ];
  
  for (const dep of criticalDeps) {
    const depPath = path.join(nodeModulesDir, dep);
    if (fs.existsSync(depPath)) {
      zipCommands.push(`zip -r function.zip node_modules/${dep}`);
    } else {
      console.log(`Warning: ${dep} not found in node_modules`);
    }
  }
  
  // Execute zip commands
  const fullCommand = zipCommands.join(' && ');
  console.log(`Executing: ${fullCommand}`);
  
  execSync(fullCommand, { 
    stdio: 'inherit',
    cwd: path.dirname(outputZip)
  });
  
  // Verify the package was created
  if (fs.existsSync(outputZip)) {
    const stats = fs.statSync(outputZip);
    console.log(`✅ Emergency package created successfully: ${outputZip} (${stats.size} bytes)`);
    
    // List contents
    try {
      execSync(`unzip -l "${outputZip}"`, { stdio: 'inherit' });
    } catch (error) {
      console.log('Could not list zip contents, but package was created');
    }
  } else {
    throw new Error('Emergency package creation failed - zip file not found');
  }
  
} catch (error) {
  console.error('❌ Emergency packaging failed:', error.message);
  
  // Last resort: create a minimal zip with just the Lambda function
  try {
    console.log('🆘 Creating absolute minimal package...');
    const lambdaFile = path.join(__dirname, '..', 'lambda', 'index.js');
    
    if (fs.existsSync(lambdaFile)) {
      execSync(`cd "${path.dirname(lambdaFile)}" && zip "${outputZip}" index.js`, { stdio: 'inherit' });
      console.log('✅ Minimal package created with just Lambda function');
    } else {
      console.error('❌ Lambda function file not found');
      process.exit(1);
    }
  } catch (finalError) {
    console.error('❌ Final packaging attempt failed:', finalError.message);
    process.exit(1);
  }
}
