const express = require("express");
const router = express.Router();
const { authenticate } = require("../middleware/auth");
const fileUploadController = require("../controllers/file-upload.controller");
const { upload } = require("../services/file-upload.service");

// Create uploads directory if it doesn't exist
const fs = require('fs');
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Direct file upload
router.post(
  "/upload",
  authenticate,
  upload.single('file'),
  fileUploadController.uploadFile
);

// CSV file upload
router.post(
  "/upload/csv",
  authenticate,
  upload.single('file'),
  fileUploadController.uploadCSV
);

// Get pre-signed URL for direct S3 upload
router.post(
  "/upload/url",
  authenticate,
  fileUploadController.getUploadURL
);

// File operations
router.get(
  "/files",
  authenticate,
  fileUploadController.listDocuments
);

router.get(
  "/files/:key",
  authenticate,
  fileUploadController.downloadFile
);

router.delete(
  "/files/:key",
  authenticate,
  fileUploadController.deleteFile
);

// Document management
router.get(
  "/documents",
  authenticate,
  fileUploadController.listDocuments
);

router.get(
  "/documents/:id",
  authenticate,
  fileUploadController.getDocument
);

router.delete(
  "/documents/:id",
  authenticate,
  fileUploadController.deleteDocument
);

module.exports = router;
