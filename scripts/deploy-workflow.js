const { execSync } = require("child_process");

const deploy = () => {
  console.log("Deploying Step Functions workflow...");
  try {
    execSync("npm run zip:lambdas", { stdio: "inherit" });
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam create-role --role-name lambda-ex --assume-role-policy-document file://./iam/lambda-role-policy.json",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam create-policy --policy-name DynamoDBWritePolicy --policy-document file://./iam/dynamodb-write-policy.json",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam attach-role-policy --role-name lambda-ex --policy-arn arn:aws:iam::000000000000:policy/DynamoDBWritePolicy",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda create-function --function-name lambda1 --zip-file fileb://lambda1.zip --handler index.handler --runtime nodejs18.x --role arn:aws:iam::000000000000:role/lambda-ex",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda create-function --function-name lambda2 --zip-file fileb://lambda2.zip --handler index.handler --runtime nodejs18.x --role arn:aws:iam::000000000000:role/lambda-ex",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 lambda create-function --function-name lambda3 --zip-file fileb://lambda3.zip --handler index.handler --runtime nodejs18.x --role arn:aws:iam::000000000000:role/lambda-ex",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 dynamodb create-table --table-name workflow-results --attribute-definitions AttributeName=id,AttributeType=S --key-schema AttributeName=id,KeyType=HASH --provisioned-throughput ReadCapacityUnits=5,WriteCapacityUnits=5",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam create-role --role-name StepFunctionsRole --assume-role-policy-document file://./iam/stepfunctions-role-policy.json",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam create-policy --policy-name LambdaInvokePolicy --policy-document file://./iam/lambda-invoke-policy.json",
      { stdio: "inherit" }
    );
    execSync(
      "aws --endpoint-url=http://localhost:4566 --region us-east-1 iam attach-role-policy --role-name StepFunctionsRole --policy-arn arn:aws:iam::000000000000:policy/LambdaInvokePolicy",
      { stdio: "inherit" }
    );
    execSync("npm run deploy:stepfn", { stdio: "inherit" });
    console.log("Deployment successful.");
  } catch (error) {
    console.error("Deployment failed:", error);
    process.exit(1);
  }
};

deploy();
