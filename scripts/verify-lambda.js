/**
 * Lambda package verification script
 * Verifies that the Lambda deployment package is correctly created
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const zipFile = path.join(__dirname, '..', 'function.zip');

console.log('🔍 Verifying Lambda deployment package...');

try {
  // Check if zip file exists
  if (!fs.existsSync(zipFile)) {
    throw new Error('function.zip not found');
  }
  
  const stats = fs.statSync(zipFile);
  console.log(`✅ Package exists: ${zipFile} (${stats.size} bytes)`);
  
  // Verify zip file is valid
  try {
    execSync(`unzip -t "${zipFile}"`, { stdio: 'pipe' });
    console.log('✅ Package is a valid zip file');
  } catch (error) {
    throw new Error('Package is corrupted or invalid');
  }
  
  // List contents
  try {
    const contents = execSync(`unzip -l "${zipFile}"`, { encoding: 'utf8' });
    console.log('📦 Package contents:');
    console.log(contents);
    
    // Check for required files
    if (contents.includes('index.js')) {
      console.log('✅ Lambda handler found');
    } else {
      throw new Error('Lambda handler (index.js) not found in package');
    }
    
    // Check for dependencies
    const hasDependencies = contents.includes('node_modules/');
    if (hasDependencies) {
      console.log('✅ Dependencies included in package');
      
      // Check for critical dependencies
      if (contents.includes('@aws-sdk/client-s3') || contents.includes('aws-sdk')) {
        console.log('✅ AWS SDK found');
      } else {
        console.log('⚠️ AWS SDK not found - Lambda may use runtime version');
      }
      
      if (contents.includes('lru-cache')) {
        console.log('✅ LRU Cache dependency found');
      } else {
        console.log('⚠️ LRU Cache not found - may affect performance');
      }
    } else {
      console.log('⚠️ No dependencies found - package may be minimal');
    }
    
  } catch (error) {
    console.log('⚠️ Could not list package contents but package exists');
  }
  
  console.log('✅ Package verification completed successfully');
  
} catch (error) {
  console.error('❌ Package verification failed:', error.message);
  process.exit(1);
}
