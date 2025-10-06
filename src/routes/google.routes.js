const { Router } = require("express");
const { GoogleController } = require("../controllers/google.controller");
const { authenticate } = require("../middleware/auth");

const googleRouter = Router();

// Google authentication routes
googleRouter.get("/calendar/", GoogleController.initiateAuth);
googleRouter.get("/callback/", authenticate, GoogleController.callBackAuth);

module.exports = googleRouter;
