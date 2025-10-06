#!/usr/bin/env node

/**
 * Redis Configuration Checker
 * 
 * This script helps diagnose Redis connection issues and validates configuration.
 */

require('dotenv').config();

const Redis = require('ioredis');

// Helper function to parse Redis DB value
const parseRedisDB = (dbValue) => {
  if (dbValue === undefined || dbValue === null || dbValue === '') {
    return 0;
  }
  
  if (typeof dbValue === 'number') {
    return dbValue;
  }
  
  if (typeof dbValue === 'string') {
    if (dbValue.toLowerCase() === 'default') {
      return 0;
    }
    
    const parsed = parseInt(dbValue, 10);
    if (isNaN(parsed)) {
      return 0;
    }
    
    if (parsed < 0 || parsed > 15) {
      return 0;
    }
    
    return parsed;
  }
  
  return 0;
};

console.log('🔍 Redis Configuration Checker');
console.log('================================\n');

// Check environment variables
console.log('📋 Environment Variables:');
console.log(`   REDIS_HOST: ${process.env.REDIS_HOST || 'NOT SET'}`);
console.log(`   REDIS_PORT: ${process.env.REDIS_PORT || 'NOT SET'}`);
console.log(`   REDIS_PASSWORD: ${process.env.REDIS_PASSWORD ? '***SET***' : 'NOT SET'}`);
console.log(`   REDIS_DB: ${process.env.REDIS_DB || 'NOT SET'}`);

// Parse and validate configuration
const config = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT, 10) || 6379,
  password: process.env.REDIS_PASSWORD || undefined,
  db: parseRedisDB(process.env.REDIS_DB),
};

console.log('\n🔧 Parsed Configuration:');
console.log(`   Host: ${config.host}`);
console.log(`   Port: ${config.port}`);
console.log(`   Database: ${config.db}`);
console.log(`   Password: ${config.password ? '***SET***' : 'NOT SET'}`);

// Check for common issues
console.log('\n⚠️ Configuration Issues:');
let hasIssues = false;

if (process.env.REDIS_DB && process.env.REDIS_DB.toLowerCase() === 'default') {
  console.log('   ❌ REDIS_DB is set to "default" - should be a number (0-15)');
  hasIssues = true;
}

if (process.env.REDIS_DB && isNaN(parseInt(process.env.REDIS_DB, 10))) {
  console.log(`   ❌ REDIS_DB "${process.env.REDIS_DB}" is not a valid number`);
  hasIssues = true;
}

if (process.env.REDIS_PORT && isNaN(parseInt(process.env.REDIS_PORT, 10))) {
  console.log(`   ❌ REDIS_PORT "${process.env.REDIS_PORT}" is not a valid number`);
  hasIssues = true;
}

if (!hasIssues) {
  console.log('   ✅ No configuration issues detected');
}

// Test connection
console.log('\n🔌 Testing Redis Connection...');

const testRedis = async () => {
  const redis = new Redis({
    ...config,
    lazyConnect: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  });

  try {
    await redis.connect();
    console.log('✅ Successfully connected to Redis');
    
    // Test basic operations
    await redis.set('test:connection', 'success');
    const result = await redis.get('test:connection');
    
    if (result === 'success') {
      console.log('✅ Basic Redis operations working');
      await redis.del('test:connection');
    } else {
      console.log('❌ Basic Redis operations failed');
    }
    
    // Get Redis info
    const info = await redis.info('server');
    const version = info.match(/redis_version:([^\r\n]+)/);
    if (version) {
      console.log(`📊 Redis Version: ${version[1]}`);
    }
    
    await redis.quit();
    console.log('✅ Connection test completed successfully');
    
  } catch (error) {
    console.error('❌ Redis connection failed:', error.message);
    
    // Provide specific error guidance
    if (error.message.includes('ENOTFOUND')) {
      console.log('\n💡 Suggestions:');
      console.log('   • Check if REDIS_HOST is correct');
      console.log('   • Verify network connectivity');
    } else if (error.message.includes('ECONNREFUSED')) {
      console.log('\n💡 Suggestions:');
      console.log('   • Check if Redis server is running');
      console.log('   • Verify REDIS_PORT is correct');
    } else if (error.message.includes('AUTH')) {
      console.log('\n💡 Suggestions:');
      console.log('   • Check if REDIS_PASSWORD is correct');
      console.log('   • Verify Redis server requires authentication');
    } else if (error.message.includes('out of range')) {
      console.log('\n💡 Suggestions:');
      console.log('   • Set REDIS_DB to a number between 0-15');
      console.log('   • Remove REDIS_DB to use default database 0');
    }
  }
};

// Recommended .env configuration
console.log('\n📝 Recommended .env Configuration:');
console.log('# Redis Configuration');
console.log(`REDIS_HOST=${config.host}`);
console.log(`REDIS_PORT=${config.port}`);
if (config.password) {
  console.log('REDIS_PASSWORD=your_password_here');
}
console.log('REDIS_DB=0  # Use database 0 (default)');

testRedis().catch(console.error); 