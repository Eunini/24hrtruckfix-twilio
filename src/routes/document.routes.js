const express = require('express');
const router = express.Router();
const documentService = require('../services/document.service');
const { authenticate } = require('../middleware/auth');

// Middleware to authenticate all document routes
router.use(authenticate);

/**
 * @route GET /api/documents
 * @desc Get documents with filtering and pagination
 * @access Private
 */
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      document_type, 
      status = 'active',
      client_id,
      organization,
      search
    } = req.query;

    const filters = { status };
    
    if (document_type) filters.document_type = document_type;
    if (client_id) filters.client_id = client_id;
    if (organization) filters.organization = organization;

    const options = { page, limit };

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
});

/**
 * @route GET /api/documents/:id
 * @desc Get document by ID
 * @access Private
 */
router.get('/:id', async (req, res) => {
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
});

/**
 * @route PUT /api/documents/:id
 * @desc Update document metadata
 * @access Private
 */
router.put('/:id', async (req, res) => {
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
});

/**
 * @route DELETE /api/documents/:id
 * @desc Delete document (soft delete)
 * @access Private
 */
router.delete('/:id', async (req, res) => {
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
});

/**
 * @route GET /api/documents/client/:clientId
 * @desc Get documents by client ID
 * @access Private
 */
router.get('/client/:clientId', async (req, res) => {
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
});

/**
 * @route GET /api/documents/organization/:organizationId
 * @desc Get documents by organization ID
 * @access Private
 */
router.get('/organization/:organizationId', async (req, res) => {
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
});

/**
 * @route GET /api/documents/:id/download
 * @desc Generate presigned URL for document download
 * @access Private
 */
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    const { expires = 3600 } = req.query;

    const document = await documentService.getDocumentById(id);
    const url = await documentService.generatePresignedUrl(document.file_key, parseInt(expires));

    res.status(200).json({
      success: true,
      message: 'Download URL generated successfully',
      data: { url, expires_in: expires }
    });
  } catch (error) {
    console.error('Generate download URL error:', error);
    res.status(400).json({
      success: false,
      message: error.message
    });
  }
});

/**
 * @route GET /api/documents/stats
 * @desc Get document statistics
 * @access Private
 */
router.get('/stats', async (req, res) => {
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
});

module.exports = router; 