const express = require('express');
const router = express.Router();
const kbItemsController = require('../controllers/kbItems.controller');
const { authenticate } = require('../middleware/auth');

// Middleware to authenticate all kbItems routes
router.use(authenticate);

/**
 * @route POST /api/kb-items
 * @desc Create a new kbItem
 * @access Private
 */
router.post('/', kbItemsController.createKbItem);

/**
 * @route GET /api/kb-items
 * @desc Get kbItems with filtering and pagination
 * @access Private
 */
router.get('/', kbItemsController.getKbItems);

/**
 * @route GET /api/kb-items/:id
 * @desc Get kbItem by ID
 * @access Private
 */
router.get('/:id', kbItemsController.getKbItemById);

/**
 * @route PUT /api/kb-items/:id
 * @desc Update kbItem
 * @access Private
 */
router.put('/:id', kbItemsController.updateKbItem);

/**
 * @route DELETE /api/kb-items/:id
 * @desc Delete kbItem (soft delete)
 * @access Private
 */
router.delete('/:id', kbItemsController.deleteKbItem);

/**
 * @route GET /api/kb-items/organization/:organizationId
 * @desc Get kbItems by organization
 * @access Private
 */
router.get('/organization/:organizationId', kbItemsController.getKbItemsByOrganization);

/**
 * @route GET /api/kb-items/mechanic/:mechanicId
 * @desc Get kbItems by mechanic
 * @access Private
 */
router.get('/mechanic/:mechanicId', kbItemsController.getKbItemsByMechanic);

module.exports = router;
