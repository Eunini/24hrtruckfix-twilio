const express = require("express");
const router = express.Router();
const redisDataController = require("../controllers/redisData.controller");

/**
 * Redis Data Management Routes
 *
 * All routes are public and don't require authentication.
 * Base path: /api/v1/redis
 */

// Store data in Redis
// POST /api/v1/redis/data
// Body: { "key": "string", "data": "any", "ttl": "number (optional)" }
router.post("/data", redisDataController.storeData);

// Get data from Redis
// GET /api/v1/redis/data/:key
router.get("/data/:key", redisDataController.getData);

// Remove data from Redis
// DELETE /api/v1/redis/data/:key
router.delete("/data/:key", redisDataController.removeData);

// Check if key exists
// GET /api/v1/redis/exists/:key
router.get("/exists/:key", redisDataController.checkKeyExists);

// Get multiple keys at once
// POST /api/v1/redis/data/multiple
// Body: { "keys": ["key1", "key2", "key3"] }
router.post("/data/multiple", redisDataController.getMultipleData);

// Remove multiple keys at once
// DELETE /api/v1/redis/data/multiple
// Body: { "keys": ["key1", "key2", "key3"] }
router.delete("/data/multiple", redisDataController.removeMultipleData);

// Get keys matching a pattern
// GET /api/v1/redis/keys?pattern=user:*
router.get("/keys", redisDataController.getKeys);

// Set TTL for existing key
// PUT /api/v1/redis/ttl/:key
// Body: { "ttl": 3600 }
router.put("/ttl/:key", redisDataController.setTTL);

// Increment numeric value
// POST /api/v1/redis/increment/:key
// Body: { "increment": 1 }
router.post("/increment/:key", redisDataController.incrementValue);

// Get Redis connection info
// GET /api/v1/redis/info
router.get("/info", redisDataController.getRedisInfo);

module.exports = router;

/**
 * API DOCUMENTATION
 *
 * 1. STORE DATA
 *    POST /api/v1/redis/data
 *    Body: {
 *      "key": "user:123",
 *      "data": { "name": "John", "email": "john@example.com" },
 *      "ttl": 3600  // Optional: expires in 1 hour
 *    }
 *
 * 2. GET DATA
 *    GET /api/v1/redis/data/user:123
 *
 * 3. REMOVE DATA
 *    DELETE /api/v1/redis/data/user:123
 *
 * 4. CHECK IF KEY EXISTS
 *    GET /api/v1/redis/exists/user:123
 *
 * 5. GET MULTIPLE KEYS
 *    POST /api/v1/redis/data/multiple
 *    Body: {
 *      "keys": ["user:123", "user:456", "config:app"]
 *    }
 *
 * 6. REMOVE MULTIPLE KEYS
 *    DELETE /api/v1/redis/data/multiple
 *    Body: {
 *      "keys": ["user:123", "user:456"]
 *    }
 *
 * 7. GET KEYS BY PATTERN
 *    GET /api/v1/redis/keys?pattern=user:*
 *    GET /api/v1/redis/keys?pattern=*session*
 *
 * 8. SET TTL FOR EXISTING KEY
 *    PUT /api/v1/redis/ttl/user:123
 *    Body: {
 *      "ttl": 7200  // 2 hours
 *    }
 *
 * 9. INCREMENT COUNTER
 *    POST /api/v1/redis/increment/page_views
 *    Body: {
 *      "increment": 1  // Optional, defaults to 1
 *    }
 *
 * 10. GET REDIS INFO
 *     GET /api/v1/redis/info
 *
 * USAGE EXAMPLES:
 *
 * // Store user session data with 1 hour expiry
 * curl -X POST http://localhost:3000/api/v1/redis/data \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "key": "session:abc123",
 *     "data": {
 *       "userId": "user123",
 *       "loginTime": "2024-01-15T10:30:00Z",
 *       "permissions": ["read", "write"]
 *     },
 *     "ttl": 3600
 *   }'
 *
 * // Get user session data
 * curl http://localhost:3000/api/v1/redis/data/session:abc123
 *
 * // Remove user session
 * curl -X DELETE http://localhost:3000/api/v1/redis/data/session:abc123
 *
 * // Store permanent configuration
 * curl -X POST http://localhost:3000/api/v1/redis/data \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "key": "config:app",
 *     "data": {
 *       "theme": "dark",
 *       "language": "en",
 *       "notifications": true
 *     }
 *   }'
 *
 * // Get all user sessions
 * curl "http://localhost:3000/api/v1/redis/keys?pattern=session:*"
 *
 * // Increment page view counter
 * curl -X POST http://localhost:3000/api/v1/redis/increment/page_views \
 *   -H "Content-Type: application/json" \
 *   -d '{"increment": 1}'
 *
 * // Get multiple keys at once
 * curl -X POST http://localhost:3000/api/v1/redis/data/multiple \
 *   -H "Content-Type: application/json" \
 *   -d '{
 *     "keys": ["session:abc123", "config:app", "page_views"]
 *   }'
 */
