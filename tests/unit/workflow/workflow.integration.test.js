/**
 * Integration test for the Step Function workflow
 * Tests the complete workflow execution locally
 */

const { executeWorkflowLocally } = require('../helpers/workflow-helper');

describe('Step Function Workflow Integration', () => {
  test('should execute the complete workflow successfully', async () => {
    // Arrange
    const input = { inputValue: 21 };
    
    // Act
    const result = await executeWorkflowLocally(input);
    
    // Assert
    expect(result).toMatchObject({
      inputValue: 21,
      validated: true,
      processedValue: 42,
      dbStatus: 'Saved',
      message: 'Data written to DynamoDB'
    });
  });

  test('should fail when validation fails', async () => {
    // Arrange
    const input = { inputValue: 'not a number' };
    
    // Act & Assert
    await expect(executeWorkflowLocally(input)).rejects.toThrow(
      'Invalid input: inputValue must be a number'
    );
  });

  test('should process different input values correctly', async () => {
    // Arrange
    const input = { inputValue: 50 };
    
    // Act
    const result = await executeWorkflowLocally(input);
    
    // Assert
    expect(result).toMatchObject({
      inputValue: 50,
      validated: true,
      processedValue: 100, // double the input value
      dbStatus: 'Saved'
    });
  });
});
