const documentService = require('../services/document.service');
const multer = require('multer');
const path = require('path');

// Configure multer for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB limit
  },
  fileFilter: (req, file, cb) => {
    // Allow all file types for now, can be restricted later
    cb(null, true);
  }
});

class DocumentController {

  /**
   * Upload a new document
   */
  async uploadDocument(req, res) {
    try {
      const { 
        client_id, 
        organization, 
        document_type = 'general',
        title,
        description,
        access_level = 'private',
        tags
      } = req.body;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'No file uploaded'
        });
      }

      if (!client_id || !organization) {
        return res.status(400).json({
          success: false,
          message: 'client_id and organization are required'
        });
      }

      const options = {
        documentType: document_type,
        title: title || req.file.originalname,
        description: description || '',
        accessLevel: access_level,
        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : []
      };

      const document = await documentService.uploadDocument(
        req.file.buffer,
        req.file.originalname,
        client_id,
        organization,
        options
      );

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get documents with filtering and pagination
   */
  async getDocuments(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        document_type, 
        status = 'active',
        client_id,
        organization,
        search,
        sort_by = 'createdAt',
        sort_order = 'desc'
      } = req.query;

      const filters = { status };
      
      if (document_type) filters.document_type = document_type;
      if (client_id) filters.client_id = client_id;
      if (organization) filters.organization = organization;

      const options = { 
        page, 
        limit,
        sortBy: sort_by,
        sortOrder: sort_order === 'desc' ? -1 : 1
      };

      let result;
      if (search) {
        result = await documentService.searchDocuments(search, filters, options);
      } else {
        result = await documentService.getDocuments(filters, options);
      }

      res.status(200).json({
        success: true,
        message: 'Documents retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get documents error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get document by ID
   */
  async getDocumentById(req, res) {
    try {
      const { id } = req.params;
      const document = await documentService.getDocumentById(id);

      res.status(200).json({
        success: true,
        message: 'Document retrieved successfully',
        data: document
      });
    } catch (error) {
      console.error('Get document error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update document metadata
   */
  async updateDocument(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;
      const userId = req.user?.userId;

      const updatedDocument = await documentService.updateDocument(id, updateData, userId);

      res.status(200).json({
        success: true,
        message: 'Document updated successfully',
        data: updatedDocument
      });
    } catch (error) {
      console.error('Update document error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete document (soft delete)
   */
  async deleteDocument(req, res) {
    try {
      const { id } = req.params;
      const userId = req.user?.userId;

      const result = await documentService.deleteDocument(id, userId);

      res.status(200).json({
        success: true,
        message: result.message
      });
    } catch (error) {
      console.error('Delete document error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get documents by client ID
   */
  async getDocumentsByClient(req, res) {
    try {
      const { clientId } = req.params;
      const { page = 1, limit = 10, organization } = req.query;

      const options = { page, limit };
      const documents = await documentService.getDocumentsByClient(clientId, organization, options);

      res.status(200).json({
        success: true,
        message: 'Client documents retrieved successfully',
        data: documents
      });
    } catch (error) {
      console.error('Get client documents error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get documents by organization ID
   */
  async getDocumentsByOrganization(req, res) {
    try {
      const { organizationId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const options = { page, limit };
      const documents = await documentService.getDocumentsByOrganization(organizationId, options);

      res.status(200).json({
        success: true,
        message: 'Organization documents retrieved successfully',
        data: documents
      });
    } catch (error) {
      console.error('Get organization documents error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Generate presigned URL for document download
   */
  async generateDownloadUrl(req, res) {
    try {
      const { id } = req.params;
      const { expires = 3600 } = req.query;

      const document = await documentService.getDocumentById(id);
      const url = await documentService.generatePresignedUrl(document.file_key, parseInt(expires));

      res.status(200).json({
        success: true,
        message: 'Download URL generated successfully',
        data: { 
          url, 
          expires_in: expires,
          file_name: document.file_name,
          file_type: document.file_type
        }
      });
    } catch (error) {
      console.error('Generate download URL error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get document statistics
   */
  async getDocumentStats(req, res) {
    try {
      const { organization } = req.query;
      const stats = await documentService.getDocumentStats(organization);

      res.status(200).json({
        success: true,
        message: 'Document statistics retrieved successfully',
        data: stats
      });
    } catch (error) {
      console.error('Get document stats error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search documents
   */
  async searchDocuments(req, res) {
    try {
      const { 
        q: searchTerm, 
        page = 1, 
        limit = 10,
        document_type,
        organization,
        client_id
      } = req.query;

      if (!searchTerm) {
        return res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
      }

      const filters = {};
      if (document_type) filters.document_type = document_type;
      if (organization) filters.organization = organization;
      if (client_id) filters.client_id = client_id;

      const options = { page, limit };
      const result = await documentService.searchDocuments(searchTerm, filters, options);

      res.status(200).json({
        success: true,
        message: 'Search completed successfully',
        data: result
      });
    } catch (error) {
      console.error('Search documents error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

// Export controller instance and upload middleware
const documentController = new DocumentController();

module.exports = {
  documentController,
  uploadMiddleware: upload.single('file')
}; 