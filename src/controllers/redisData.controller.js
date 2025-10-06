const redisDataService = require("../services/redisData.service");
const { HTTP_STATUS_CODES } = require("../helper");

/**
 * Redis Data Management Controller
 *
 * This controller provides HTTP endpoints for managing data in Redis.
 * All endpoints are public and don't require authentication.
 */

class RedisDataController {
  /**
   * Store data in Redis
   * POST /api/v1/redis/data
   *
   * Body:
   * {
   *   "key": "string",
   *   "data": "any",
   *   "ttl": "number (optional, seconds)"
   * }
   */
  async storeData(req, res) {
    try {
      const { key, data, ttl } = req.body;

      // Validate required fields
      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required field: key",
        });
      }

      if (data === undefined || data === null) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Data is required",
          error: "Missing required field: data",
        });
      }

      // Validate TTL if provided
      if (ttl !== undefined && (typeof ttl !== "number" || ttl <= 0)) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "TTL must be a positive number (seconds)",
          error: "Invalid TTL value",
        });
      }

      // Store data in Redis
      await redisDataService.setData(key, data, ttl);

      res.status(HTTP_STATUS_CODES.CREATED).json({
        success: true,
        message: "Data stored successfully in Redis",
        data: {
          key,
          stored: true,
          ttl: ttl || null,
          expiresAt: ttl
            ? new Date(Date.now() + ttl * 1000).toISOString()
            : null,
        },
      });
    } catch (error) {
      console.error("❌ Error in storeData controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to store data in Redis",
        error: error.message,
      });
    }
  }

  /**
   * Retrieve data from Redis
   * GET /api/v1/redis/data/:key
   */
  async getData(req, res) {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required parameter: key",
        });
      }

      // Get data from Redis
      const data = await redisDataService.getData(key);

      if (data === null) {
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: "Data not found",
          error: `No data found for key: ${key}`,
        });
      }

      // Get TTL info
      const ttl = await redisDataService.getTTL(key);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Data retrieved successfully",
        data: {
          key,
          value: data,
          ttl: ttl > 0 ? ttl : null,
          expiresAt:
            ttl > 0 ? new Date(Date.now() + ttl * 1000).toISOString() : null,
          permanent: ttl === -1,
        },
      });
    } catch (error) {
      console.error("❌ Error in getData controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to retrieve data from Redis",
        error: error.message,
      });
    }
  }

  /**
   * Remove data from Redis
   * DELETE /api/v1/redis/data/:key
   */
  async removeData(req, res) {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required parameter: key",
        });
      }

      // Remove data from Redis
      const removed = await redisDataService.removeData(key);

      if (!removed) {
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: "Data not found",
          error: `No data found to remove for key: ${key}`,
        });
      }

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Data removed successfully",
        data: {
          key,
          removed: true,
        },
      });
    } catch (error) {
      console.error("❌ Error in removeData controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to remove data from Redis",
        error: error.message,
      });
    }
  }

  /**
   * Check if key exists in Redis
   * GET /api/v1/redis/exists/:key
   */
  async checkKeyExists(req, res) {
    try {
      const { key } = req.params;

      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required parameter: key",
        });
      }

      // Check if key exists
      const exists = await redisDataService.keyExists(key);
      const ttl = exists ? await redisDataService.getTTL(key) : null;

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Key existence checked",
        data: {
          key,
          exists,
          ttl: exists && ttl > 0 ? ttl : null,
          expiresAt:
            exists && ttl > 0
              ? new Date(Date.now() + ttl * 1000).toISOString()
              : null,
          permanent: exists && ttl === -1,
        },
      });
    } catch (error) {
      console.error("❌ Error in checkKeyExists controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to check key existence",
        error: error.message,
      });
    }
  }

  /**
   * Get multiple keys at once
   * POST /api/v1/redis/data/multiple
   *
   * Body:
   * {
   *   "keys": ["key1", "key2", "key3"]
   * }
   */
  async getMultipleData(req, res) {
    try {
      const { keys } = req.body;

      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Keys array is required",
          error: "Missing or invalid keys array",
        });
      }

      // Get multiple data from Redis
      const data = await redisDataService.getMultipleData(keys);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Multiple data retrieved successfully",
        data: {
          requested: keys.length,
          found: Object.keys(data).filter((key) => data[key] !== null).length,
          results: data,
        },
      });
    } catch (error) {
      console.error("❌ Error in getMultipleData controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to retrieve multiple data from Redis",
        error: error.message,
      });
    }
  }

  /**
   * Remove multiple keys at once
   * DELETE /api/v1/redis/data/multiple
   *
   * Body:
   * {
   *   "keys": ["key1", "key2", "key3"]
   * }
   */
  async removeMultipleData(req, res) {
    try {
      const { keys } = req.body;

      if (!Array.isArray(keys) || keys.length === 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Keys array is required",
          error: "Missing or invalid keys array",
        });
      }

      // Remove multiple data from Redis
      const removedCount = await redisDataService.removeMultipleData(keys);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Multiple data removed successfully",
        data: {
          requested: keys.length,
          removed: removedCount,
          keys: keys,
        },
      });
    } catch (error) {
      console.error("❌ Error in removeMultipleData controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to remove multiple data from Redis",
        error: error.message,
      });
    }
  }

  /**
   * Get keys matching a pattern
   * GET /api/v1/redis/keys?pattern=user:*
   */
  async getKeys(req, res) {
    try {
      const { pattern = "*" } = req.query;

      // Get keys matching pattern
      const keys = await redisDataService.getKeys(pattern);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Keys retrieved successfully",
        data: {
          pattern,
          count: keys.length,
          keys,
        },
      });
    } catch (error) {
      console.error("❌ Error in getKeys controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to retrieve keys from Redis",
        error: error.message,
      });
    }
  }

  /**
   * Set TTL for an existing key
   * PUT /api/v1/redis/ttl/:key
   *
   * Body:
   * {
   *   "ttl": 3600
   * }
   */
  async setTTL(req, res) {
    try {
      const { key } = req.params;
      const { ttl } = req.body;

      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required parameter: key",
        });
      }

      if (typeof ttl !== "number" || ttl <= 0) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "TTL must be a positive number (seconds)",
          error: "Invalid TTL value",
        });
      }

      // Set TTL for key
      const success = await redisDataService.setTTL(key, ttl);

      if (!success) {
        return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
          success: false,
          message: "Key not found",
          error: `No key found to set TTL: ${key}`,
        });
      }

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "TTL set successfully",
        data: {
          key,
          ttl,
          expiresAt: new Date(Date.now() + ttl * 1000).toISOString(),
        },
      });
    } catch (error) {
      console.error("❌ Error in setTTL controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to set TTL",
        error: error.message,
      });
    }
  }

  /**
   * Increment a numeric value
   * POST /api/v1/redis/increment/:key
   *
   * Body:
   * {
   *   "increment": 1
   * }
   */
  async incrementValue(req, res) {
    try {
      const { key } = req.params;
      const { increment = 1 } = req.body;

      if (!key) {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Key is required",
          error: "Missing required parameter: key",
        });
      }

      if (typeof increment !== "number") {
        return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
          success: false,
          message: "Increment must be a number",
          error: "Invalid increment value",
        });
      }

      // Increment value
      const newValue = await redisDataService.incrementValue(key, increment);

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Value incremented successfully",
        data: {
          key,
          increment,
          newValue,
        },
      });
    } catch (error) {
      console.error("❌ Error in incrementValue controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to increment value",
        error: error.message,
      });
    }
  }

  /**
   * Get Redis connection info
   * GET /api/v1/redis/info
   */
  async getRedisInfo(req, res) {
    try {
      const info = await redisDataService.getRedisInfo();

      res.status(HTTP_STATUS_CODES.OK).json({
        success: true,
        message: "Redis info retrieved successfully",
        data: info,
      });
    } catch (error) {
      console.error("❌ Error in getRedisInfo controller:", error);
      res.status(HTTP_STATUS_CODES.INTERNAL_SERVER_ERROR).json({
        success: false,
        message: "Failed to get Redis info",
        error: error.message,
      });
    }
  }
}

// Export singleton instance
const redisDataController = new RedisDataController();

module.exports = redisDataController;
