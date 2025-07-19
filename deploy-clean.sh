#!/usr/bin/env bash
# deploy-clean.sh - Clean deployment script for Lambda S3 testing

set -e

# Configuration
readonly LOCALSTACK_ENDPOINT="http://localhost:4566"
readonly BUCKET_NAME="lambda-s3-test-bucket"
readonly LAMBDA_NAME="file-processor"
readonly LAMBDA_ROLE="lambda-s3-role"
readonly REGION="us-east-1"

# Colors
readonly GREEN="\033[0;32m"
readonly YELLOW="\033[0;33m"
readonly RED="\033[0;31m"
readonly NC="\033[0m"

log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# AWS CLI with LocalStack endpoint
aws_local() {
    aws --endpoint-url="$LOCALSTACK_ENDPOINT" --region="$REGION" "$@"
}

wait_for_localstack() {
    log_info "Waiting for LocalStack to be ready..."
    local max_attempts=30
    local attempt=1
    
    while [ $attempt -le $max_attempts ]; do
        if curl -sf "$LOCALSTACK_ENDPOINT/_localstack/health" > /dev/null 2>&1; then
            log_info "LocalStack is ready"
            return 0
        fi
        
        log_warn "Attempt $attempt/$max_attempts: LocalStack not ready yet"
        sleep 2
        ((attempt++))
    done
    
    log_error "LocalStack failed to start after $max_attempts attempts"
    return 1
}

create_s3_bucket() {
    log_info "Creating S3 bucket: $BUCKET_NAME"
    
    if aws_local s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1; then
        log_info "S3 bucket already exists"
        return 0
    fi
    
    aws_local s3 mb "s3://$BUCKET_NAME"
    log_info "S3 bucket created successfully"
}

create_iam_role() {
    log_info "Creating IAM role: $LAMBDA_ROLE"
    
    local trust_policy='{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Principal": {
                    "Service": "lambda.amazonaws.com"
                },
                "Action": "sts:AssumeRole"
            }
        ]
    }'
    
    local role_policy='{
        "Version": "2012-10-17",
        "Statement": [
            {
                "Effect": "Allow",
                "Action": [
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                "Resource": "arn:aws:logs:*:*:*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:DeleteObject"
                ],
                "Resource": "arn:aws:s3:::'"$BUCKET_NAME"'/*"
            },
            {
                "Effect": "Allow",
                "Action": [
                    "s3:ListBucket"
                ],
                "Resource": "arn:aws:s3:::'"$BUCKET_NAME"'"
            }
        ]
    }'
    
    # Create role
    if ! aws_local iam get-role --role-name "$LAMBDA_ROLE" > /dev/null 2>&1; then
        aws_local iam create-role \
            --role-name "$LAMBDA_ROLE" \
            --assume-role-policy-document "$trust_policy"
        log_info "IAM role created"
    else
        log_info "IAM role already exists"
    fi
    
    # Attach policy
    aws_local iam put-role-policy \
        --role-name "$LAMBDA_ROLE" \
        --policy-name "LambdaS3Policy" \
        --policy-document "$role_policy"
    log_info "IAM policy attached"
}

deploy_lambda() {
    log_info "Deploying Lambda function: $LAMBDA_NAME"
    
    # Create deployment package
    local temp_dir=$(mktemp -d)
    cp -r lambda/* "$temp_dir/"
    
    # Install dependencies
    (cd "$temp_dir" && npm install --production)
    
    # Create zip file
    local zip_file="$temp_dir/lambda-deployment.zip"
    (cd "$temp_dir" && zip -r "$zip_file" .)
    
    # Get role ARN
    local role_arn=$(aws_local iam get-role --role-name "$LAMBDA_ROLE" --query 'Role.Arn' --output text)
    
    # Deploy or update Lambda function
    if aws_local lambda get-function --function-name "$LAMBDA_NAME" > /dev/null 2>&1; then
        log_info "Updating existing Lambda function"
        aws_local lambda update-function-code \
            --function-name "$LAMBDA_NAME" \
            --zip-file "fileb://$zip_file"
    else
        log_info "Creating new Lambda function"
        aws_local lambda create-function \
            --function-name "$LAMBDA_NAME" \
            --runtime "nodejs20.x" \
            --role "$role_arn" \
            --handler "index.handler" \
            --zip-file "fileb://$zip_file" \
            --timeout 30 \
            --memory-size 512 \
            --environment "Variables={BUCKET=$BUCKET_NAME,AWS_REGION=$REGION}"
    fi
    
    # Cleanup
    rm -rf "$temp_dir"
    log_info "Lambda function deployed successfully"
}

verify_deployment() {
    log_info "Verifying deployment..."
    
    # Check S3 bucket
    if aws_local s3 ls "s3://$BUCKET_NAME" > /dev/null 2>&1; then
        log_info "✓ S3 bucket is accessible"
    else
        log_error "✗ S3 bucket is not accessible"
        return 1
    fi
    
    # Check Lambda function
    if aws_local lambda get-function --function-name "$LAMBDA_NAME" > /dev/null 2>&1; then
        log_info "✓ Lambda function is deployed"
    else
        log_error "✗ Lambda function is not deployed"
        return 1
    fi
    
    # Check IAM role
    if aws_local iam get-role --role-name "$LAMBDA_ROLE" > /dev/null 2>&1; then
        log_info "✓ IAM role is configured"
    else
        log_error "✗ IAM role is not configured"
        return 1
    fi
    
    log_info "Deployment verification completed successfully"
}

main() {
    log_info "Starting Lambda S3 deployment..."
    
    wait_for_localstack
    create_s3_bucket
    create_iam_role
    deploy_lambda
    verify_deployment
    
    log_info "Lambda S3 deployment completed successfully"
    log_info "Bucket: $BUCKET_NAME"
    log_info "Lambda: $LAMBDA_NAME"
    log_info "Endpoint: $LOCALSTACK_ENDPOINT"
}

# Run main function
main "$@"
