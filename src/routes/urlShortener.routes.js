const express = require("express");
const router = express.Router();
const urlShortenerController = require("../controllers/urlShortener.controller");

// URL shortener redirect endpoint
router.get("/dev/urlShortner/:linkId", urlShortenerController.redirectToUrl);

module.exports = router;
