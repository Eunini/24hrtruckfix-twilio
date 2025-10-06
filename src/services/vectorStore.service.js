const { VectorStoreEntry } = require("../models");

class VectorStoreService {
  /**
   * Search for similar content in the vector store
   */
  async similaritySearch(organizationId, query, limit = 3) {
    try {
      // For now, return a simple search result
      // In a real implementation, this would use vector similarity search
      const results = await VectorStoreEntry.find({
        organizationId: organizationId,
        $text: { $search: query },
      })
        .limit(limit)
        .lean();

      return results.map((doc) => ({
        pageContent: doc.text,
        metadata: doc.metadata || {},
      }));
    } catch (error) {
      console.error("Error in vector store search:", error);
      return [];
    }
  }

  /**
   * Add content to the vector store
   */
  async addContent(organizationId, text, metadata = {}) {
    try {
      const entry = new VectorStoreEntry({
        text,
        metadata: { ...metadata, organizationId },
        organizationId,
        embedding: [], // In a real implementation, this would be generated
      });

      await entry.save();
      return entry;
    } catch (error) {
      console.error("Error adding content to vector store:", error);
      throw error;
    }
  }
}

const vectorStoreService = new VectorStoreService();

module.exports = { vectorStoreService };
