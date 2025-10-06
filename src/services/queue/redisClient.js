const Redis = require('ioredis');

// Helper function to parse Redis DB value
const parseRedisDB = (dbValue) => {
  if (dbValue === undefined || dbValue === null || dbValue === '') {
    return 0; // Default to database 0
  }
  
  // If it's already a number, return it
  if (typeof dbValue === 'number') {
    return dbValue;
  }
  
  // If it's a string, try to parse it
  if (typeof dbValue === 'string') {
    // Handle common string values
    if (dbValue.toLowerCase() === 'default') {
      return 0;
    }
    
    const parsed = parseInt(dbValue, 10);
    if (isNaN(parsed)) {
      console.warn(`⚠️ Invalid REDIS_DB value: "${dbValue}". Using default database 0.`);
      return 0;
    }
    
    // Redis typically supports databases 0-15
    if (parsed < 0 || parsed > 15) {
      console.warn(`⚠️ REDIS_DB value ${parsed} is out of range (0-15). Using database 0.`);
      return 0;
    }
    
    return parsed;
  }
  
  console.warn(`⚠️ Unexpected REDIS_DB type: ${typeof dbValue}. Using default database 0.`);
  return 0;
};

// Redis client configuration
const redisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseRedisDB(process.env.REDIS_DB),
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
  lazyConnect: true,
  // Add connection timeout
  connectTimeout: 10000,
  // Add command timeout
  commandTimeout: 5000,
};

console.log('🔧 Redis Configuration:', {
  host: redisConfig.host,
  port: redisConfig.port,
  db: redisConfig.db,
  hasPassword: !!redisConfig.password
});

// Create Redis client
const redisClient = new Redis(redisConfig);

// Error handling
redisClient.on('error', (error) => {
  console.error('❌ Redis connection error:', error);
});

redisClient.on('connect', () => {
  console.log('✅ Connected to Redis');
});

redisClient.on('ready', () => {
  console.log('✅ Redis client ready');
  console.log(`📊 Using Redis database: ${redisConfig.db}`);
});

redisClient.on('close', () => {
  console.log('❌ Redis connection closed');
});

redisClient.on('reconnecting', () => {
  console.log('🔄 Redis reconnecting...');
});

module.exports = redisClient; 