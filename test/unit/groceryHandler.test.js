import { describe, it, expect, vi, afterEach } from 'vitest';
import * as groceryService from '../../src/services/groceryService';
import { makeHandler } from '../../src/lambda/groceryHandler';

describe('groceryHandler', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should store grocery list via API Gateway event', async () => {
    vi.spyOn(groceryService, 'storeGroceryList').mockResolvedValue('grocery-list-uuid.json');
    const handler = makeHandler(groceryService);
    const event = { body: JSON.stringify({ items: ['apple', 'banana'] }) };
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Grocery list stored successfully');
    expect(body.s3Key).toMatch(/^grocery-list-.*\.json$/);
  });

  it('should store grocery list via direct Lambda event', async () => {
    vi.spyOn(groceryService, 'storeGroceryList').mockResolvedValue('grocery-list-uuid.json');
    const handler = makeHandler(groceryService);
    const event = { items: ['apple', 'banana'] };
    const res = await handler(event);
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.message).toBe('Grocery list stored successfully');
    expect(body.s3Key).toMatch(/^grocery-list-.*\.json$/);
  });

  it('should return 400 for invalid input', async () => {
    const handler = makeHandler(groceryService);
    const event = { body: JSON.stringify({ items: 'not-an-array' }) };
    const res = await handler(event);
    expect(res.statusCode).toBe(400);
  });

  it('should return 500 on service error', async () => {
    const mockService = { storeGroceryList: vi.fn().mockRejectedValue(new Error('fail')) };
    const handler = makeHandler(mockService);
    const event = { items: ['apple'] };
    const res = await handler(event);
    console.log('Test received response:', res);
    expect(res.statusCode).toBe(500);
  });
});
