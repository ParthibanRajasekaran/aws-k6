/**
 * Unit tests for lambda1 - ValidateInput
 * Tests the input validation functionality in isolation
 */

const { handler } = require('../../../lambda1/index');

describe('Lambda1 - ValidateInput', () => {
  test('should validate successful numeric input', async () => {
    // Arrange
    const event = { inputValue: 10 };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 10,
      validated: true,
      message: 'Input validated'
    });
  });

  test('should validate different numeric input', async () => {
    // Arrange
    const event = { inputValue: 42 };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 42,
      validated: true,
      message: 'Input validated'
    });
  });

  test('should reject missing input', async () => {
    // Arrange
    const event = {}; // No inputValue
    
    // Act & Assert
    await expect(handler(event)).rejects.toThrow(
      'Invalid input: inputValue must be a number'
    );
  });

  test('should reject non-numeric input', async () => {
    // Arrange
    const event = { inputValue: "not a number" };
    
    // Act & Assert
    await expect(handler(event)).rejects.toThrow(
      'Invalid input: inputValue must be a number'
    );
  });

  test('should reject null input value', async () => {
    // Arrange
    const event = { inputValue: null };
    
    // Act & Assert
    await expect(handler(event)).rejects.toThrow(
      'Invalid input: inputValue must be a number'
    );
  });

  test('should pass through additional properties', async () => {
    // Arrange
    const event = { 
      inputValue: 10, 
      additionalProp: 'test',
      metadata: { source: 'unit-test' }
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 10,
      additionalProp: 'test',
      metadata: { source: 'unit-test' },
      validated: true,
      message: 'Input validated'
    });
  });
});
