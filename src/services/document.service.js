const { Document } = require('../models');
const AWS = require('aws-sdk');
const path = require('path');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.CLIENT_POLICY_DOC_UPLOAD_BUCKET || process.env.AWS_S3_BUCKET_NAME;

class DocumentService {
  
  /**
   * Upload a document to S3 and save metadata to database
   */
  async uploadDocument(fileBuffer, fileName, clientId, organizationId, options = {}) {
    try {
      const {
        documentType = 'general',
        title = fileName,
        description = '',
        accessLevel = 'private',
        tags = []
      } = options;

      // Generate unique file key
      const randomName = (Math.random() + 1).toString(36).substring(5);
      const extension = path.extname(fileName) || ".txt";
      const fileKey = `document-${randomName}${extension}`;

      // Upload to S3
      const uploadResult = await s3.upload({
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Body: fileBuffer,
        ContentType: 'application/octet-stream',
      }).promise();

      // Create document record
      const newDocument = new Document({
        client_id: clientId,
        organization: organizationId,
        file_name: fileName,
        file_key: fileKey,
        file_url: uploadResult.Location,
        file_type: extension.replace('.', ''),
        file_size: fileBuffer.length,
        document_type: documentType,
        title: title,
        description: description,
        status: 'active',
        access_level: accessLevel,
        tags: tags
      });

      const savedDocument = await newDocument.save();
      
      // Populate references
      await savedDocument.populate([
        { path: 'client_id', select: 'name email' },
        { path: 'organization', select: 'name' }
      ]);

      return savedDocument;
    } catch (error) {
      throw new Error(`Document upload error: ${error.message}`);
    }
  }

  /**
   * Get documents with filtering and pagination
   */
  async getDocuments(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = 'createdAt',
        sortOrder = -1
      } = options;

      const query = { status: 'active', ...filters };

      const paginateOptions = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder },
        populate: [
          { path: 'client_id', select: 'name email' },
          { path: 'organization', select: 'name' }
        ]
      };

      return await Document.paginate(query, paginateOptions);
    } catch (error) {
      throw new Error(`Error retrieving documents: ${error.message}`);
    }
  }

  /**
   * Get documents by client ID
   */
  async getDocumentsByClient(clientId, organizationId = null, options = {}) {
    try {
      const filters = { client_id: clientId };
      
      if (organizationId) {
        filters.organization = organizationId;
      }

      return await this.getDocuments(filters, options);
    } catch (error) {
      throw new Error(`Error retrieving client documents: ${error.message}`);
    }
  }

  /**
   * Get documents by organization
   */
  async getDocumentsByOrganization(organizationId, options = {}) {
    try {
      const filters = { organization: organizationId };
      return await this.getDocuments(filters, options);
    } catch (error) {
      throw new Error(`Error retrieving organization documents: ${error.message}`);
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(documentId) {
    try {
      const document = await Document.findById(documentId)
        .populate('client_id', 'name email')
        .populate('organization', 'name');
      
      if (!document || document.status === 'deleted') {
        throw new Error('Document not found');
      }
      
      return document;
    } catch (error) {
      throw new Error(`Error retrieving document: ${error.message}`);
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(documentId, updateData, userId = null) {
    try {
      // Validate allowed updates
      const allowedUpdates = ['file_name', 'title', 'description', 'document_type', 'tags', 'access_level'];
      const filteredUpdates = {};
      
      Object.keys(updateData).forEach(key => {
        if (allowedUpdates.includes(key)) {
          filteredUpdates[key] = updateData[key];
        }
      });

      // Check permissions if userId provided
      if (userId) {
        const document = await Document.findById(documentId);
        if (!document) {
          throw new Error('Document not found');
        }
        
        // Add permission check logic here if needed
      }

      const updatedDocument = await Document.findByIdAndUpdate(
        documentId,
        filteredUpdates,
        { new: true }
      ).populate('client_id', 'name email').populate('organization', 'name');

      if (!updatedDocument) {
        throw new Error('Document not found');
      }

      return updatedDocument;
    } catch (error) {
      throw new Error(`Error updating document: ${error.message}`);
    }
  }

  /**
   * Soft delete document
   */
  async deleteDocument(documentId, userId = null) {
    try {
      // Check permissions if userId provided
      if (userId) {
        const document = await Document.findById(documentId);
        if (!document) {
          throw new Error('Document not found');
        }
        
        // Add permission check logic here if needed
      }

      const deletedDocument = await Document.findByIdAndUpdate(
        documentId,
        { status: 'deleted' },
        { new: true }
      );

      if (!deletedDocument) {
        throw new Error('Document not found');
      }

      return { message: 'Document deleted successfully', document: deletedDocument };
    } catch (error) {
      throw new Error(`Error deleting document: ${error.message}`);
    }
  }

  /**
   * Generate pre-signed URL for document access
   */
  async generatePresignedUrl(fileKey, expiresIn = 3600) {
    try {
      const url = s3.getSignedUrl("getObject", {
        Bucket: BUCKET_NAME,
        Key: fileKey,
        Expires: expiresIn,
      });

      return url;
    } catch (error) {
      throw new Error(`Error generating presigned URL: ${error.message}`);
    }
  }

  /**
   * Search documents by text
   */
  async searchDocuments(searchTerm, filters = {}, options = {}) {
    try {
      const searchQuery = {
        status: 'active',
        $or: [
          { file_name: { $regex: searchTerm, $options: 'i' } },
          { title: { $regex: searchTerm, $options: 'i' } },
          { description: { $regex: searchTerm, $options: 'i' } },
          { tags: { $in: [new RegExp(searchTerm, 'i')] } }
        ],
        ...filters
      };

      return await this.getDocuments(searchQuery, options);
    } catch (error) {
      throw new Error(`Error searching documents: ${error.message}`);
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(organizationId = null) {
    try {
      const matchStage = { status: 'active' };
      if (organizationId) {
        matchStage.organization = organizationId;
      }

      const stats = await Document.aggregate([
        { $match: matchStage },
        {
          $group: {
            _id: '$document_type',
            count: { $sum: 1 },
            totalSize: { $sum: '$file_size' }
          }
        }
      ]);

      const totalDocuments = await Document.countDocuments(matchStage);

      return {
        totalDocuments,
        byType: stats,
        totalSize: stats.reduce((sum, stat) => sum + stat.totalSize, 0)
      };
    } catch (error) {
      throw new Error(`Error getting document statistics: ${error.message}`);
    }
  }
}

module.exports = new DocumentService(); 