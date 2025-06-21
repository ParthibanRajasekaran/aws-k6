const {
  DynamoDBClient,
  PutItemCommand,
} = require("@aws-sdk/client-dynamodb");

const client = new DynamoDBClient({
  region: "us-east-1",
  endpoint: "http://localhost:4566", // LocalStack endpoint
});

exports.handler = async (event) => {
  console.log("Lambda3 - SaveToDB:", event);

  const item = {
    id: { S: `${Date.now()}` },
    input: { S: JSON.stringify(event) },
  };

  await client.send(
    new PutItemCommand({
      TableName: "workflow-results",
      Item: item,
    })
  );

  return {
    ...event,
    dbStatus: "Saved",
    message: "Data written to DynamoDB",
  };
};
