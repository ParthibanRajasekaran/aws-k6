/**
 * Unit tests for lambda2 - ProcessData
 * Tests the data processing functionality in isolation
 */

const { handler } = require('../../../lambda2/index');

describe('Lambda2 - ProcessData', () => {
  // Spy on console.log to verify logging behavior
  let consoleLogSpy;
  
  beforeEach(() => {
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });
  
  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  test('should process numeric input by doubling it', async () => {
    // Arrange
    const event = { 
      inputValue: 21,
      validated: true 
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 21,
      validated: true,
      processedValue: 42,
      message: 'Data processed'
    });
  });

  test('should handle zero as input', async () => {
    // Arrange
    const event = { 
      inputValue: 0,
      validated: true 
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 0,
      validated: true,
      processedValue: 0,
      message: 'Data processed'
    });
  });

  test('should handle negative numbers', async () => {
    // Arrange
    const event = { 
      inputValue: -5,
      validated: true 
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: -5,
      validated: true,
      processedValue: -10,
      message: 'Data processed'
    });
  });

  test('should log received event', async () => {
    // Arrange
    const event = { 
      inputValue: 10,
      validated: true 
    };
    
    // Act
    await handler(event);
    
    // Assert
    expect(consoleLogSpy).toHaveBeenCalledWith('Lambda2 - ProcessData:', expect.anything());
    expect(consoleLogSpy).toHaveBeenCalledWith('Received event:', expect.any(String));
  });

  test('should pass through additional properties', async () => {
    // Arrange
    const event = { 
      inputValue: 10,
      validated: true,
      additionalProp: 'test',
      metadata: { source: 'unit-test' }
    };
    
    // Act
    const result = await handler(event);
    
    // Assert
    expect(result).toEqual({
      inputValue: 10,
      validated: true,
      additionalProp: 'test',
      metadata: { source: 'unit-test' },
      processedValue: 20,
      message: 'Data processed'
    });
  });
});
