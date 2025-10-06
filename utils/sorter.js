const mongoose = require('mongoose');

/**
 * Fetches the most recent documents from a MongoDB collection
 * @param {mongoose.Model} model - Mongoose model
 * @param {Object} [options] - Query options
 * @param {number} [options.limit=10] - Number of documents to return
 * @param {Object} [options.query={}] - Additional query filters
 * @param {string} [options.sortField='createdAt'] - Field to sort by
 * @param {string} [options.sortOrder='desc'] - Sort order ('asc' or 'desc')
 * @returns {Promise<Array>} Array of recent documents
 */
async function getRecentDocuments(model, options = {}) {
    const {
        limit = 10,
        query = {},
        sortField = 'createdAt',
        sortOrder = 'desc'
    } = options;

    // Validate inputs
    if (!model || !model.find) {
        throw new Error('Invalid Mongoose model provided');
    }

    if (typeof limit !== 'number' || limit <= 0) {
        throw new Error('Limit must be a positive number');
    }

    // Create sort object
    const sort = {};
    sort[sortField] = sortOrder === 'asc' ? 1 : -1;

    try {
        const documents = await model.find(query)
            .sort(sort)
            .limit(limit)
            .exec();

        return documents;
    } catch (error) {
        console.error('Error fetching recent documents:', error);
        throw error;
    }
}

/**
 * EXAMPLE
 *
 * // Get 5 most recently updated products
 * const recentProducts = await getRecentDocuments(Product, {
 *   limit: 5,
 *   sortField: 'updatedAt'
 * });
 * */