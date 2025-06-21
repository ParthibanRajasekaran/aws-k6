#!/bin/bash

SERVICE_NAME=localstack

start() {
    echo "🚀 Starting LocalStack..."
    docker-compose up -d
    echo "✅ LocalStack started."
    # deploy bucket & lambda
    aws --endpoint-url=http://localhost:4566 s3 mb s3://my-bucket
    zip -j function.zip lambda/index.js
    aws --endpoint-url=http://localhost:4566 lambda create-function \
      --function-name lambda-s3-demo \
      --runtime nodejs14.x \
      --handler index.handler \
      --zip-file fileb://function.zip \
      --role arn:aws:iam::000000000000:role/lambda-role \
      --environment Variables="{S3_BUCKET=my-bucket,S3_ENDPOINT=http://localstack:4566}"
    # create & deploy API Gateway
    API_ID=$(aws --endpoint-url=http://localhost:4566 apigateway create-rest-api \
      --name demo-api --query 'id' --output text)
    ROOT_ID=$(aws --endpoint-url=http://localhost:4566 apigateway get-resources \
      --rest-api-id $API_ID --query 'items[?path==`/`].id' --output text)
    RES_ID=$(aws --endpoint-url=http://localhost:4566 apigateway create-resource \
      --rest-api-id $API_ID --parent-id $ROOT_ID --path-part '{proxy+}' \
      --query 'id' --output text)
    aws --endpoint-url=http://localhost:4566 apigateway put-method \
      --rest-api-id $API_ID --resource-id $RES_ID --http-method ANY \
      --authorization-type NONE --request-parameters method.request.path.proxy=true
    aws --endpoint-url=http://localhost:4566 apigateway put-integration \
      --rest-api-id $API_ID --resource-id $RES_ID --http-method ANY \
      --type AWS_PROXY --integration-http-method POST \
      --uri arn:aws:apigateway:eu-west-1:lambda:path/2015-03-31/functions/arn:aws:lambda:eu-west-1:000000000000:function:lambda-s3-demo/invocations
    aws --endpoint-url=http://localhost:4566 lambda add-permission \
      --function-name lambda-s3-demo --statement-id apigw-invoke \
      --action lambda:InvokeFunction --principal apigateway.amazonaws.com \
      --source-arn "arn:aws:execute-api:eu-west-1:000000000000:$API_ID/*/*/{proxy+}"
    aws --endpoint-url=http://localhost:4566 apigateway create-deployment \
      --rest-api-id $API_ID --stage-name dev
    echo "📡 API endpoint: http://localhost:4566/restapis/$API_ID/dev/_user_request_/"
}

stop() {
    echo "🛑 Stopping LocalStack..."
    docker-compose down
    echo "🧹 Cleaned up containers."
}

case "$1" in
  start) start ;;
  stop)  stop  ;;
  *)     echo "Usage: $0 {start|stop}" ;;
esac