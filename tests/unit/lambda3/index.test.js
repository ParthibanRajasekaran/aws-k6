/**
 * Unit tests for lambda3 - SaveToDB
 * Tests the database saving functionality in isolation
 * Uses jest.mock to mock AWS SDK v3 modules
 */

// Mock the AWS SDK v3 client and commands
jest.mock('@aws-sdk/client-dynamodb', () => {
  // Mock implementation of DynamoDBClient
  const mockSend = jest.fn().mockResolvedValue({});
  
  return {
    DynamoDBClient: jest.fn(() => ({
      send: mockSend
    })),
    PutItemCommand: jest.fn((params) => ({
      input: params
    }))
  };
});

const { handler } = require('../../../lambda3/index');
const { DynamoDBClient, PutItemCommand } = require('@aws-sdk/client-dynamodb');

describe('Lambda3 - SaveToDB', () => {
  // Spy on console.log to verify logging behavior
  let consoleLogSpy;
  let mockDynamoDBClient;
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Mock Date.now for consistent testing
    jest.spyOn(Date, 'now').mockImplementation(() => 1234567890);
    
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Get the mocked client instance
    mockDynamoDBClient = new DynamoDBClient();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should save data to DynamoDB', async () => {
    // Arrange
    const event = { 
      inputValue: 21,
      validated: true,
      processedValue: 42
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(mockDynamoDBClient.send).toHaveBeenCalledTimes(1);
    expect(PutItemCommand).toHaveBeenCalledWith({
      TableName: 'workflow-results',
      Item: expect.objectContaining({
        id: { S: '1234567890' },
        input: { S: expect.any(String) }
      })
    });
    
    expect(result).toEqual({
      inputValue: 21,
      validated: true,
      processedValue: 42,
      dbStatus: 'Saved',
      message: 'Data written to DynamoDB'
    });
  });

  test('should log received event', async () => {
    // Arrange
    const event = { 
      inputValue: 21,
      validated: true,
      processedValue: 42
    };
    
    // Act
    await handler(event);
    
    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith('Lambda3 - SaveToDB:', expect.anything());
  });

  test('should handle DynamoDB errors', async () => {
    // Arrange
    const event = { 
      inputValue: 21,
      validated: true,
      processedValue: 42
    };
    
    // Mock AWS DynamoDB error
    mockDynamoDBClient.send.mockRejectedValueOnce(new Error('DynamoDB error'));
    
    // Act & Assert
    await expect(handler(event)).rejects.toThrow('DynamoDB error');
  });

  test('should pass through additional properties', async () => {
    // Arrange
    const event = { 
      inputValue: 21,
      validated: true,
      processedValue: 42,
      additionalProp: 'test',
      metadata: { source: 'unit-test' }
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 21,
      validated: true,
      processedValue: 42,
      additionalProp: 'test',
      metadata: { source: 'unit-test' },
      dbStatus: 'Saved',
      message: 'Data written to DynamoDB'
    });
  });
});
