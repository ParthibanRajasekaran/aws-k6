const { putObjectToS3 } = require('../utils/s3Client');
const { v4: uuidv4 } = require('uuid');

const BUCKET_NAME = process.env.GROCERY_BUCKET || 'grocery-list-bucket';

/**
 * Store grocery list in S3
 * @param {Array} items
 * @returns {Promise<string>} S3 key
 */
async function storeGroceryList(items) {
  const key = `grocery-list-${uuidv4()}.json`;
  await putObjectToS3(BUCKET_NAME, key, JSON.stringify({ items }));
  return key;
}

module.exports = { storeGroceryList };
