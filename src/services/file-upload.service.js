require("dotenv").config();
const AWS = require("aws-sdk");
const multer = require("multer");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const { Document } = require("../models");

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_S3_SECRET_ACCESS_KEY,
  region: process.env.AWS_S3_BUCKET_REGION,
});

const s3 = new AWS.S3();
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME;

// Multer disk storage configuration
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "uploads/"); // Make sure this directory exists
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + "-" + uuidv4();
    cb(null, uniqueSuffix + path.extname(file.originalname));
  },
});

// File filter
const fileFilter = (req, file, cb) => {
  // Accept images, pdfs, csv, text files, and Microsoft Office documents
  const allowedMimeTypes = [
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

  const isAllowed = allowedMimeTypes.some((type) => {
    if (type instanceof RegExp) {
      return type.test(file.mimetype);
    }
    return file.mimetype === type;
  });

  if (isAllowed) {
    cb(null, true);
  } else {
    cb(new Error("Invalid file type"), false);
  }
};

// Multer upload configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Upload file to S3
const uploadFileToS3 = async (file) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: file.filename,
    Body: require("fs").createReadStream(file.path),
    ContentType: file.mimetype,
    ACL: "bucket-owner-full-control",
  };

  return await s3.upload(params).promise();
};

// Download file from S3
const downloadFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  return await s3.getObject(params).promise();
};

// Delete file from S3
const deleteFileFromS3 = async (key) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
  };

  return await s3.deleteObject(params).promise();
};

// Process CSV file
const processCSVFile = async (fileBuffer, options = {}) => {
  // Add CSV processing logic here if needed
  return {
    success: true,
    message: "CSV file processed successfully",
  };
};

// Generate pre-signed URL for S3 upload
const generatePresignedUrl = async (key, expirationSeconds = 3600) => {
  const params = {
    Bucket: BUCKET_NAME,
    Key: key,
    Expires: expirationSeconds,
  };

  return await s3.getSignedUrlPromise("getObject", params);
};

module.exports = {
  upload,
  uploadFileToS3,
  downloadFileFromS3,
  deleteFileFromS3,
  processCSVFile,
  generatePresignedUrl,
};
