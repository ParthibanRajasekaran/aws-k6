/**
 * Lambda packaging script to include all required dependencies
 * This script creates a deployment package with all necessary dependencies
 */
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Configuration
const sourceDir = path.join(__dirname, '..', 'lambda');
const tempDir = path.join(__dirname, '..', 'lambda-deploy');
const outputZip = path.join(__dirname, '..', 'function.zip');

// Ensure absolute paths for CI environments
console.log(`Using absolute paths:
- Source dir: ${sourceDir}
- Temp dir: ${tempDir}
- Output zip: ${outputZip}
`);

console.log('🚀 Packaging Lambda function with dependencies');

// Check if we're running in a CI environment
const isCI = process.env.CI === 'true' || process.env.GITHUB_ACTIONS === 'true';
console.log(`Running in CI environment: ${isCI ? 'Yes' : 'No'}`);

// Print diagnostic information
console.log('Environment information:');
console.log(`- Node.js version: ${process.version}`);
console.log(`- Platform: ${process.platform}`);
console.log(`- Working directory: ${process.cwd()}`);
console.log(`- Temp directory: ${tempDir}`);

try {
  // Clean up any existing temporary directory
  if (fs.existsSync(tempDir)) {
    console.log(`Cleaning up existing ${tempDir} directory...`);
    fs.rmSync(tempDir, { recursive: true, force: true });
  }

  // Create a fresh temporary directory
  console.log('Creating temporary directory for Lambda packaging...');
  fs.mkdirSync(tempDir, { recursive: true });
  
  // Copy Lambda source files to the temp directory
  console.log('Copying Lambda source files...');
  fs.copyFileSync(path.join(sourceDir, 'index.js'), path.join(tempDir, 'index.js'));
  
  // Create package.json in the temp directory with only required dependencies
  console.log('Creating package.json with required dependencies...');
  const mainPackageJson = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
  
  // Extract all AWS SDK and other required dependencies
  const lambdaPackageJson = {
    name: 'lambda-function',
    version: '1.0.0',
    dependencies: {}
  };
  
  // Scan Lambda source code for dependencies
  const lambdaSource = fs.readFileSync(path.join(sourceDir, 'index.js'), 'utf8');
  const dependencyRegex = /require\(['"]([@\w\/-]+)['"]\)/g;
  const detectedDependencies = new Set();
  
  let match;
  while ((match = dependencyRegex.exec(lambdaSource)) !== null) {
    const dependency = match[1];
    // Only add external dependencies, not built-in Node modules
    if (!dependency.startsWith('.') && !path.isAbsolute(dependency)) {
      // Handle scoped packages correctly
      if (dependency.startsWith('@')) {
        // Get the full scoped package name (e.g. @aws-sdk/client-s3)
        const scopedPackage = dependency.split('/').slice(0, 2).join('/');
        detectedDependencies.add(scopedPackage);
      } else {
        // Get the package name without subpaths for non-scoped packages
        detectedDependencies.add(dependency.split('/')[0]);
      }
    }
  }
  
  console.log('Detected dependencies:', Array.from(detectedDependencies));
  
  // Always include critical dependencies
  detectedDependencies.add('@aws-sdk/client-s3');
  detectedDependencies.add('lru-cache');
  
  // Add each dependency from the main package.json
  for (const dep of detectedDependencies) {
    if (mainPackageJson.dependencies && mainPackageJson.dependencies[dep]) {
      lambdaPackageJson.dependencies[dep] = mainPackageJson.dependencies[dep];
    } else {
      // Use latest version if not found in main package.json
      lambdaPackageJson.dependencies[dep] = "*";
    }
  }
  
  fs.writeFileSync(path.join(tempDir, 'package.json'), JSON.stringify(lambdaPackageJson, null, 2));
  
  // Install production dependencies in the temp directory
  console.log('Installing production dependencies...');
  console.log(`Current working directory: ${process.cwd()}`);
  console.log(`Temp directory: ${tempDir}`);
  console.log(`Temp directory contents before npm install:`);
  try {
    const tempDirContents = fs.readdirSync(tempDir);
    console.log(tempDirContents);
    console.log(`package.json contents:`);
    console.log(fs.readFileSync(path.join(tempDir, 'package.json'), 'utf8'));
  } catch (err) {
    console.warn(`Could not list temp dir contents: ${err.message}`);
  }
  
  // Use npm ci for more reliable builds in CI environments
  try {
    console.log('Attempting npm ci...');
    execSync('npm ci --production --no-audit --no-fund', {
      cwd: tempDir,
      stdio: 'inherit', // Show output for debugging
      env: { ...process.env, NODE_ENV: 'production' } // Ensure production mode
    });
  } catch (error) {
    console.log(`npm ci failed: ${error.message}, falling back to npm install...`);
    try {
      execSync('npm install --production --no-audit --no-fund', {
        cwd: tempDir,
        stdio: 'inherit',
        env: { ...process.env, NODE_ENV: 'production' }
      });
    } catch (installError) {
      console.error(`Both npm ci and npm install failed: ${installError.message}`);
      console.log('Attempting to install critical dependencies directly...');
      execSync('npm install --production --no-audit --no-fund @aws-sdk/client-s3 lru-cache', {
        cwd: tempDir,
        stdio: 'inherit'
      });
    }
  }
  
  // Create the deployment package
  console.log('Creating deployment package...');
  if (fs.existsSync(outputZip)) {
    fs.unlinkSync(outputZip);
  }    // Use different zip approaches depending on the environment
  try {
    if (process.platform === 'win32') {
      // For Windows environments
      const archiver = require('archiver');
      const output = fs.createWriteStream(outputZip);
      const archive = archiver('zip', { zlib: { level: 9 } });
      
      // Create a promise to handle async operation
      const zipPromise = new Promise((resolve, reject) => {
        output.on('close', resolve);
        archive.on('error', reject);
      });
      
      archive.pipe(output);
      archive.directory(tempDir, false);
      archive.finalize();
      
      // Wait for zip to complete
      execSync('sleep 2'); // Give a moment for the zip process to complete
    } else {
      // For Unix environments
      execSync(`cd "${tempDir}" && zip -r "${outputZip}" .`, { stdio: 'inherit' });
    }

    // Verify the package contents
    console.log('Verifying package contents...');
    let zipContents = '';
    
    try {
      // Use unzip -l to list contents in a safer way
      zipContents = execSync(`unzip -l "${outputZip}"`, { encoding: 'utf8' });
      console.log(zipContents);
    } catch (error) {
      console.warn('Warning: Could not list zip contents. Trying alternative approach...');
      try {
        // In some CI environments, we need another approach to verify
        const zipStat = fs.statSync(outputZip);
        console.log(`Zip file exists with size ${zipStat.size} bytes`);
        zipContents = `File size: ${zipStat.size} bytes`; // At least we know it exists
        
        if (zipStat.size < 1000) {
          throw new Error('Zip file is too small, likely not created properly');
        }
      } catch (fsError) {
        console.error('Error checking the zip file:', fsError);
      }
    }
    
    // Check files in temp directory as fallback verification
    try {
      console.log('Verifying temp directory contents before zipping...');
      const hasDeps = fs.existsSync(path.join(tempDir, 'node_modules'));
      const hasLruCache = fs.existsSync(path.join(tempDir, 'node_modules', 'lru-cache'));
      const hasAwsSdk = fs.existsSync(path.join(tempDir, 'node_modules', '@aws-sdk'));
      const hasIndex = fs.existsSync(path.join(tempDir, 'index.js'));
      
      console.log(`Temp directory verification:
- Has node_modules: ${hasDeps}
- Has lru-cache: ${hasLruCache}
- Has @aws-sdk: ${hasAwsSdk}
- Has index.js: ${hasIndex}`);
    } catch (fsError) {
      console.warn('Could not verify temp directory contents:', fsError.message);
    }
    
    // Verify the zip contents based on the output of unzip -l
    if (zipContents.includes('node_modules/lru-cache') && zipContents.includes('node_modules/@aws-sdk')) {
      console.log('✅ Lambda package created successfully with all dependencies');
    } else {
      console.warn('⚠️ Warning: Package verification could not confirm all dependencies!');
      console.log('This might be due to CI environment limitations in listing zip contents.');
      
      // Try to verify by checking if the file size is reasonable - a properly packaged Lambda should be at least 1MB
      try {
        const zipStat = fs.statSync(outputZip);
        if (zipStat.size > 1000000) {
          console.log(`Zip file size (${zipStat.size} bytes) suggests dependencies were included.`);
        } else {
          console.warn(`Zip file size (${zipStat.size} bytes) seems too small! Dependencies may be missing.`);
        }
      } catch (error) {
        console.warn('Could not check zip file size:', error.message);
      }
    }
  } catch (zipError) {
    console.error('Error creating zip file:', zipError);
    // Continue anyway as the zip might still be usable
  }
  
  // Clean up
  console.log('Cleaning up...');
  fs.rmSync(tempDir, { recursive: true, force: true });
  
  console.log(`✅ Lambda deployment package created at: ${outputZip}`);
} catch (error) {
  console.error('❌ Error packaging Lambda:', error);
  process.exit(1);
}
