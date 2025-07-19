#!/bin/bash

echo "🚀 Setting up AWS Lambda S3 Performance Testing Suite..."

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Install Lambda dependencies
echo "📦 Installing Lambda dependencies..."
cd lambda && npm install && cd ..

# Make scripts executable
echo "🔧 Making scripts executable..."
chmod +x scripts/*.sh

# Create reports directories
echo "📊 Creating reports directories..."
mkdir -p reports/{get,post,coverage}

# Start LocalStack
echo "🐳 Starting LocalStack..."
docker compose -f docker-compose.lambda-s3.yml up -d

# Wait for LocalStack to be ready
echo "⏳ Waiting for LocalStack to be ready..."
sleep 10

# Deploy Lambda function
echo "🚀 Deploying Lambda function..."
npm run deploy

# Verify setup
echo "✅ Verifying setup..."
npm run health

echo "🎉 Setup complete! Run 'npm test' to start testing."
