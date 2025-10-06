const { Document } = require('../models');
const AWS = require('aws-sdk');
const path = require('path');

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.CLIENT_POLICY_DOC_UPLOAD_BUCKET;

exports.uploadDocument = async (fileBuffer, fileName, clientId, organizationId, documentType = 'general', knowledgebaseFlag = false) => {
  try {
    const randomName = (Math.random() + 1).toString(36).substring(5);
    const extension = path.extname(fileName) || ".txt";
    const key = `document-${randomName}${extension}`;
    const keyPath = `${fileName}`;

    await s3.upload({
      Bucket: BUCKET_NAME,
      Key: key,
      Body: fileBuffer,
      ContentType: 'application/octet-stream',
    }).promise();

    const newDocument = new Document({
      client_id: clientId,
      organization: organizationId,
      file_name: fileName,
      file_key: key,
      file_url: `https://${BUCKET_NAME}.s3.amazonaws.com/${key}`,
      file_type: extension.replace('.', ''),
      file_size: fileBuffer.length,
      document_type: documentType,
      title: fileName,
      status: 'active'
    });

    const preSignedUrl = s3.getSignedUrl("putObject", {
      Bucket: BUCKET_NAME,
      Key: keyPath,
      ACL: "bucket-owner-full-control",
    });

    const s3Url = s3.getSignedUrl("getObject", {
      Bucket: BUCKET_NAME,
      Key: keyPath,
      Expires: 3600,
      ResponseContentDisposition: `inline; filename="${fileName}"`,
    });

    const doc = await newDocument.save();

    return {
      preSignedUrl,
      keyName: fileName,
      s3Url,
      keyPath,
      fullPath: keyPath,
      knowledgebase: knowledgebaseFlag,
      document: doc
    };
  } catch (error) {
    throw new Error(`Document upload error: ${error.message}`);
  }
};

exports.getDocuments = async (filters = {}) => {
  try {
    const query = { status: 'active', ...filters };
    const documents = await Document.find(query)
      .populate('client_id', 'name email')
      .populate('organization', 'name')
      .sort({ createdAt: -1 });
    return documents;
  } catch (error) {
    throw new Error(`Error retrieving documents: ${error.message}`);
  }
};

exports.getDocumentsByClient = async (clientId, organizationId = null) => {
  try {
    const query = { 
      client_id: clientId, 
      status: 'active' 
    };
    
    if (organizationId) {
      query.organization = organizationId;
    }
    
    const documents = await Document.find(query)
      .populate('organization', 'name')
      .sort({ createdAt: -1 });
    return documents;
  } catch (error) {
    throw new Error(`Error retrieving client documents: ${error.message}`);
  }
};

exports.getDocumentsByOrganization = async (organizationId) => {
  try {
    const documents = await Document.find({ 
      organization: organizationId, 
      status: 'active' 
    })
      .populate('client_id', 'name email')
      .sort({ createdAt: -1 });
    return documents;
  } catch (error) {
    throw new Error(`Error retrieving organization documents: ${error.message}`);
  }
};

exports.updateDocument = async (documentId, updateData) => {
  try {
    const allowedUpdates = ['file_name', 'title', 'description', 'document_type', 'tags', 'access_level'];
    const filteredUpdates = {};
    
    Object.keys(updateData).forEach(key => {
      if (allowedUpdates.includes(key)) {
        filteredUpdates[key] = updateData[key];
      }
    });

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
};

exports.deleteDocument = async (documentId) => {
  try {
    // Soft delete by updating status
    const deletedDocument = await Document.findByIdAndUpdate(
      documentId,
      { status: 'deleted' },
      { new: true }
    );

    if (!deletedDocument) {
      throw new Error('Document not found');
    }

    return { message: 'Document deleted successfully' };
  } catch (error) {
    throw new Error(`Error deleting document: ${error.message}`);
  }
};

exports.getDocumentById = async (documentId) => {
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
}; 