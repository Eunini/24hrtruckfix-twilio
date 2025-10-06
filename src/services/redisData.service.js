const redisClient = require("./queue/redisClient");

/**
 * Redis Data Management Service
 *
 * This service provides functions to store, retrieve, and manage data in Redis.
 * It supports various data types and includes TTL (Time To Live) functionality.
 */

class RedisDataService {
  /**
   * Store data in Redis with optional TTL
   * @param {string} key - The Redis key
   * @param {any} data - The data to store (will be JSON stringified)
   * @param {number} ttl - Time to live in seconds (optional)
   * @returns {Promise<boolean>} - Success status
   */
  async setData(key, data, ttl = null) {
    try {
      // Convert data to JSON string for storage
      const jsonData = JSON.stringify(data);

      if (ttl && ttl > 0) {
        // Set data with TTL (expiration)
        await redisClient.setex(key, ttl, jsonData);
        console.log(`✅ Data stored in Redis with key: ${key} (TTL: ${ttl}s)`);
      } else {
        // Set data without TTL (permanent until manually deleted)
        await redisClient.set(key, jsonData);
        console.log(`✅ Data stored in Redis with key: ${key} (no TTL)`);
      }

      return true;
    } catch (error) {
      console.error(`❌ Error storing data in Redis with key ${key}:`, error);
      throw new Error(`Failed to store data in Redis: ${error.message}`);
    }
  }

  /**
   * Retrieve data from Redis
   * @param {string} key - The Redis key
   * @returns {Promise<any|null>} - The retrieved data or null if not found
   */
  async getData(key) {
    try {
      const jsonData = await redisClient.get(key);

      if (jsonData === null) {
        console.log(`⚠️ No data found in Redis for key: ${key}`);
        return null;
      }

      // Parse JSON data back to original format
      const data = JSON.parse(jsonData);
      console.log(`✅ Data retrieved from Redis with key: ${key}`);
      return data;
    } catch (error) {
      console.error(
        `❌ Error retrieving data from Redis with key ${key}:`,
        error
      );
      throw new Error(`Failed to retrieve data from Redis: ${error.message}`);
    }
  }

  /**
   * Remove data from Redis
   * @param {string} key - The Redis key to delete
   * @returns {Promise<boolean>} - True if key was deleted, false if key didn't exist
   */
  async removeData(key) {
    try {
      const result = await redisClient.del(key);

      if (result === 1) {
        console.log(`✅ Data removed from Redis with key: ${key}`);
        return true;
      } else {
        console.log(`⚠️ No data found to remove in Redis for key: ${key}`);
        return false;
      }
    } catch (error) {
      console.error(
        `❌ Error removing data from Redis with key ${key}:`,
        error
      );
      throw new Error(`Failed to remove data from Redis: ${error.message}`);
    }
  }

  /**
   * Check if a key exists in Redis
   * @param {string} key - The Redis key to check
   * @returns {Promise<boolean>} - True if key exists, false otherwise
   */
  async keyExists(key) {
    try {
      const exists = await redisClient.exists(key);
      return exists === 1;
    } catch (error) {
      console.error(
        `❌ Error checking key existence in Redis for key ${key}:`,
        error
      );
      throw new Error(
        `Failed to check key existence in Redis: ${error.message}`
      );
    }
  }

  /**
   * Get TTL (time to live) for a key
   * @param {string} key - The Redis key
   * @returns {Promise<number>} - TTL in seconds (-1 if no TTL, -2 if key doesn't exist)
   */
  async getTTL(key) {
    try {
      const ttl = await redisClient.ttl(key);
      return ttl;
    } catch (error) {
      console.error(`❌ Error getting TTL for Redis key ${key}:`, error);
      throw new Error(`Failed to get TTL from Redis: ${error.message}`);
    }
  }

  /**
   * Set TTL for an existing key
   * @param {string} key - The Redis key
   * @param {number} ttl - Time to live in seconds
   * @returns {Promise<boolean>} - True if TTL was set, false if key doesn't exist
   */
  async setTTL(key, ttl) {
    try {
      const result = await redisClient.expire(key, ttl);

      if (result === 1) {
        console.log(`✅ TTL set for Redis key: ${key} (${ttl}s)`);
        return true;
      } else {
        console.log(`⚠️ Key not found when setting TTL for: ${key}`);
        return false;
      }
    } catch (error) {
      console.error(`❌ Error setting TTL for Redis key ${key}:`, error);
      throw new Error(`Failed to set TTL in Redis: ${error.message}`);
    }
  }

  /**
   * Get all keys matching a pattern
   * @param {string} pattern - Redis key pattern (e.g., "user:*", "*session*")
   * @returns {Promise<string[]>} - Array of matching keys
   */
  async getKeys(pattern = "*") {
    try {
      const keys = await redisClient.keys(pattern);
      console.log(`✅ Found ${keys.length} keys matching pattern: ${pattern}`);
      return keys;
    } catch (error) {
      console.error(`❌ Error getting keys with pattern ${pattern}:`, error);
      throw new Error(`Failed to get keys from Redis: ${error.message}`);
    }
  }

  /**
   * Get multiple keys at once
   * @param {string[]} keys - Array of Redis keys
   * @returns {Promise<Object>} - Object with key-value pairs
   */
  async getMultipleData(keys) {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return {};
      }

      const values = await redisClient.mget(keys);
      const result = {};

      keys.forEach((key, index) => {
        if (values[index] !== null) {
          try {
            result[key] = JSON.parse(values[index]);
          } catch (parseError) {
            console.warn(
              `⚠️ Failed to parse JSON for key ${key}, storing as string`
            );
            result[key] = values[index];
          }
        } else {
          result[key] = null;
        }
      });

      console.log(`✅ Retrieved ${Object.keys(result).length} keys from Redis`);
      return result;
    } catch (error) {
      console.error(`❌ Error getting multiple keys from Redis:`, error);
      throw new Error(
        `Failed to get multiple keys from Redis: ${error.message}`
      );
    }
  }

  /**
   * Remove multiple keys at once
   * @param {string[]} keys - Array of Redis keys to delete
   * @returns {Promise<number>} - Number of keys that were deleted
   */
  async removeMultipleData(keys) {
    try {
      if (!Array.isArray(keys) || keys.length === 0) {
        return 0;
      }

      const result = await redisClient.del(...keys);
      console.log(`✅ Removed ${result} keys from Redis`);
      return result;
    } catch (error) {
      console.error(`❌ Error removing multiple keys from Redis:`, error);
      throw new Error(
        `Failed to remove multiple keys from Redis: ${error.message}`
      );
    }
  }

  /**
   * Increment a numeric value in Redis
   * @param {string} key - The Redis key
   * @param {number} increment - Amount to increment by (default: 1)
   * @returns {Promise<number>} - The new value after increment
   */
  async incrementValue(key, increment = 1) {
    try {
      const result = await redisClient.incrby(key, increment);
      console.log(
        `✅ Incremented Redis key ${key} by ${increment}, new value: ${result}`
      );
      return result;
    } catch (error) {
      console.error(`❌ Error incrementing Redis key ${key}:`, error);
      throw new Error(`Failed to increment value in Redis: ${error.message}`);
    }
  }

  /**
   * Get Redis connection status and info
   * @returns {Promise<Object>} - Redis connection info
   */
  async getRedisInfo() {
    try {
      const info = await redisClient.info();
      const status = redisClient.status;

      return {
        status,
        connected: status === "ready",
        info: info.split("\r\n").reduce((acc, line) => {
          if (line.includes(":")) {
            const [key, value] = line.split(":");
            acc[key] = value;
          }
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error(`❌ Error getting Redis info:`, error);
      return {
        status: "error",
        connected: false,
        error: error.message,
      };
    }
  }
}

// Export singleton instance
const redisDataService = new RedisDataService();

module.exports = redisDataService;

/**
 * USAGE EXAMPLES:
 *
 * // Store data with TTL (expires in 1 hour)
 * await redisDataService.setData('user:123', { name: 'John', email: 'john@example.com' }, 3600);
 *
 * // Store data without TTL (permanent)
 * await redisDataService.setData('config:app', { theme: 'dark', language: 'en' });
 *
 * // Get data
 * const userData = await redisDataService.getData('user:123');
 *
 * // Remove data
 * await redisDataService.removeData('user:123');
 *
 * // Check if key exists
 * const exists = await redisDataService.keyExists('user:123');
 *
 * // Get TTL
 * const ttl = await redisDataService.getTTL('user:123');
 *
 * // Set TTL for existing key
 * await redisDataService.setTTL('user:123', 7200); // 2 hours
 *
 * // Get all keys matching pattern
 * const userKeys = await redisDataService.getKeys('user:*');
 *
 * // Get multiple keys at once
 * const multipleData = await redisDataService.getMultipleData(['user:123', 'user:456']);
 *
 * // Remove multiple keys
 * await redisDataService.removeMultipleData(['user:123', 'user:456']);
 *
 * // Increment counter
 * await redisDataService.incrementValue('page_views', 1);
 */
