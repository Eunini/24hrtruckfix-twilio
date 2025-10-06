// redisClient.js
const redis = require("redis");

const client = redis.createClient({
  host: process.env.REDIS_HOST || 'localhost',
  port: process.env.REDIS_PORT || 6379,
  password: process.env.REDIS_PASSWORD, 
  db: process.env.REDIS_DB || 0,
});

client.on('error', (err) => {
    console.error('Redis Client Error', err);
  });
  
  client.on('connect', () => {
    console.log('Connected to Redis successfully');
  });

  console.log(`Using Redis database: ${process.env.REDIS_DB || 0}`);
  
  (async () => {
    try {
      await client.connect();
    } catch (err) {
      console.error('Error connecting to Redis', err);
    }
  })();
  
  module.exports = client;