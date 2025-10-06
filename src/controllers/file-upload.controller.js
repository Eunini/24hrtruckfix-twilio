const {
  uploadFileToS3,
  downloadFileFromS3,
  deleteFileFromS3,
  processCSVFile,
  generatePresignedUrl,
  upload,
} = require("../services/file-upload.service");
const { HTTP_STATUS_CODES } = require("../helper");
const { Policy, Fleet, Mechanic, Document } = require("../models");
const fs = require("fs").promises;
const path = require("path");
const csv = require("csv-parser");

// Allowed file types (should match file-upload.service.js)
const ALLOWED_FILE_TYPES = [
  // Images
  /^image\//,
  // PDF
  "application/pdf",
  // CSV
  "text/csv",
  "application/vnd.ms-excel",
  // Text files
  "text/plain",
  // Microsoft Office documents
  "application/msword", // .doc
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document", // .docx
  "application/vnd.ms-powerpoint", // .ppt
  "application/vnd.openxmlformats-officedocument.presentationml.presentation", // .pptx
  "application/vnd.ms-excel", // .xls
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", // .xlsx
  "application/vnd.ms-office",
  "application/vnd.oasis.opendocument.text", // .odt
  "application/vnd.oasis.opendocument.spreadsheet", // .ods
  "application/rtf",
];

// Max file size (10MB)
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// Validate file type and size
const validateFile = (file) => {
  if (!file) {
    throw new Error("No file provided");
  }

  if (file.size > MAX_FILE_SIZE) {
    throw new Error(
      `File size exceeds ${MAX_FILE_SIZE / (1024 * 1024)}MB limit`
    );
  }

  if (!ALLOWED_FILE_TYPES.includes(file.mimetype)) {
    throw new Error(
      "Invalid file type. Allowed types: " + ALLOWED_FILE_TYPES.join(", ")
    );
  }

  return true;
};

// Upload file to S3
exports.uploadFile = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded",
      });
    }

    // Upload file to S3
    const result = await uploadFileToS3(req.file);

    // Delete local file after upload
    await fs.unlink(req.file.path);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "File uploaded successfully",
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        location: result.Location,
        key: result.Key,
      },
    });
  } catch (error) {
    // Delete local file if exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error("uploadFile error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Upload CSV file
exports.uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "No file uploaded",
      });
    }

    if (
      req.file.mimetype !== "text/csv" &&
      req.file.mimetype !== "application/vnd.ms-excel"
    ) {
      await fs.unlink(req.file.path);
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        message: "Invalid file type. Please upload a CSV file.",
        success: false,
      });
    }

    // Upload to S3
    const result = await uploadFileToS3(req.file);

    // Delete local file after upload
    await fs.unlink(req.file.path);

    // Save document to database
    const document = new Document({
      client_id: req.user.userId,
      organization: req.user.organizationId || req.user.role_id,
      file_name: req.file.originalname,
      file_key: result.Key,
      file_url: result.Location,
      file_type: req.file.mimetype,
      file_size: req.file.size,
      document_type: req.query.document_type || "general", // CSV files are typically general documents
      title: req.file.originalname,
      description: "CSV file upload",
      status: "active",
      access_level: "private",
    });

    // Set isAdmin if the user is a super admin or admin
    if (
      req.user.adminRole === "super_admin" ||
      req.user.adminRole === "admin"
    ) {
      document.isAdmin = true;
    }

    await document.save();

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "CSV file uploaded successfully",
      data: {
        filename: req.file.filename,
        originalname: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        location: result.Location,
      },
    });
  } catch (error) {
    // Delete local file if exists
    if (req.file) {
      await fs.unlink(req.file.path).catch(console.error);
    }

    console.error("uploadCSV error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate pre-signed URL for direct S3 upload
exports.getUploadURL = async (req, res) => {
  try {
    const { filename, contentType } = req.query;

    if (!filename || !contentType) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message: "Filename and content type are required",
      });
    }

    if (!ALLOWED_FILE_TYPES.includes(contentType)) {
      return res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
        success: false,
        message:
          "Invalid content type. Allowed types: " +
          ALLOWED_FILE_TYPES.join(", "),
      });
    }

    // const key = `uploads/${Date.now()}-${filename}`;
    const key = filename;
    const url = await generatePresignedUrl(key, 3600);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Upload URL generated successfully",
      data: { url, key },
    });
  } catch (error) {
    console.error("getUploadURL error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate upload URL for DNU files
exports.getDnuUploadURL = async (req, res) => {
  try {
    const key = `dnu/${Date.now()}-${req.query.filename || "file"}`;
    const url = await generatePresignedUrl(key, 3600);

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "DNU Upload URL generated successfully",
      url,
      key,
    });
  } catch (error) {
    console.error("getDnuUploadURL error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Get upload URL for CSV files
exports.getUploadUrl = async (req, res) => {
  try {
    const key = `csv/${Date.now()}-${req.query.filename || "file.csv"}`;
    const url = await generatePresignedUrl(key, 3600);

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "CSV Upload URL generated successfully",
      url,
      key,
    });
  } catch (error) {
    console.error("getUploadUrl error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// List all documents
exports.listDocuments = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      document_type,
      status = "active",
    } = req.query;

    const query = { status };

    if (document_type) {
      query.document_type = document_type;
    }

    query.organization = req.user.organization;

    const options = {
      page: parseInt(page),
      limit: parseInt(limit),
      sort: { createdAt: -1 },
      populate: [
        { path: "client_id", select: "name email" },
        { path: "organization", select: "name" },
      ],
    };

    const documents = await Document.paginate(query, options);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Documents retrieved successfully",
      data: documents,
    });
  } catch (error) {
    console.error("listDocuments error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Get a specific document
exports.getDocument = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the document by ID
    const document = await Document.findById(id);

    if (!document) {
      return res.status(HTTP_STATUS_CODES.NOT_FOUND).json({
        success: false,
        message: "Document not found",
      });
    }

    // Verify user has access to this organization

    console.log(
      document.organization.toString(),
      req.user.organizationId.toString()
    );
    if (
      document.organization.toString() !== req.user.organizationId.toString()
    ) {
      return res.status(HTTP_STATUS_CODES.FORBIDDEN).json({
        success: false,
        message:
          "Access denied: You do not have permission to access this document",
      });
    }

    // Generate presigned URL using the document's file_key
    const signedUrl = await generatePresignedUrl(document.file_key, 3600);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "Document URL generated successfully",
      data: {
        signedUrl,
      },
    });
  } catch (error) {
    console.error("getDocument error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete a document
exports.deleteDocument = async (req, res) => {
  try {
    const { id } = req.params;
    await deleteFileFromS3(id);

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Document deleted successfully",
    });
  } catch (error) {
    console.error("deleteDocument error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Download file
exports.downloadFile = async (req, res) => {
  try {
    const { key } = req.params;
    const file = await downloadFileFromS3(key);

    res.setHeader("Content-Type", file.ContentType);
    res.setHeader("Content-Disposition", `attachment; filename="${key}"`);
    res.send(file.Body);
  } catch (error) {
    console.error("downloadFile error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Delete file
exports.deleteFile = async (req, res) => {
  try {
    const { key } = req.params;
    await deleteFileFromS3(key);

    res.status(HTTP_STATUS_CODES.OK).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("deleteFile error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      success: false,
      message: error.message,
    });
  }
};

// Generate pre-signed URL for S3 file
exports.getSignedUrl = async (req, res) => {
  try {
    const { key } = req.params;
    const { expiresIn } = req.query;

    const url = await generatePresignedUrl(key, parseInt(expiresIn) || 3600);

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Pre-signed URL generated successfully",
      url,
    });
  } catch (error) {
    console.error("getSignedUrl error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};

// Get all documents
exports.getAllDocuments = async (req, res) => {
  try {
    const { status = "active", document_type, organization } = req.query;

    const query = { status };

    if (document_type) {
      query.document_type = document_type;
    }

    if (organization) {
      query.organization = organization;
    }

    const documents = await Document.find(query)
      .populate("client_id", "name email")
      .populate("organization", "name")
      .sort({ createdAt: -1 });

    res.status(HTTP_STATUS_CODES.OK).json({
      message: "Documents retrieved successfully",
      documents,
    });
  } catch (error) {
    console.error("getAllDocuments error:", error);
    res.status(HTTP_STATUS_CODES.BAD_REQUEST).json({
      message: error.message,
    });
  }
};
