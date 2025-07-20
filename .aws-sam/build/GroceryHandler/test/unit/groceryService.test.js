import { describe, it, expect, vi, afterEach } from 'vitest';
import * as s3Client from '../../src/utils/s3Client';
import { storeGroceryList } from '../../src/services/groceryService';

describe('groceryService', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should call putObjectToS3 with correct params', async () => {
    const putObjectSpy = vi.spyOn(require('../../src/utils/s3Client'), 'putObjectToS3').mockResolvedValue();
    const { storeGroceryList } = require('../../src/services/groceryService');
    const key = await storeGroceryList(['milk', 'eggs']);
    expect(key).toMatch(/grocery-list-.*\.json/);
    expect(putObjectSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.stringMatching(/grocery-list-.*\.json/),
      JSON.stringify({ items: ['milk', 'eggs'] })
    );
  });
});
