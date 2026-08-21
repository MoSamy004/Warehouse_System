const { MongoClient } = require('mongodb');

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
  if (cachedDb) return cachedDb;
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set in environment variables');
  const client = new MongoClient(uri);
  await client.connect();
  cachedClient = client;
  cachedDb = client.db('warehouse_system');
  return cachedDb;
}

module.exports = { connectToDatabase };
