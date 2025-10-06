const kbItemsService = require('../services/kbItems.service');

class KbItemsController {

  /**
   * Create a new kbItem
   */
  async createKbItem(req, res) {
    try {
      const { 
        type, 
        key, 
        title, 
        organization, 
        mechanic, 
        description, 
        tags 
      } = req.body;

      if (!type || !key || !title) {
        return res.status(400).json({
          success: false,
          message: 'type, key, and title are required'
        });
      }

      if (!organization && !mechanic) {
        return res.status(400).json({
          success: false,
          message: 'Either organization or mechanic must be provided'
        });
      }

      if (organization && mechanic) {
        return res.status(400).json({
          success: false,
          message: 'Cannot have both organization and mechanic'
        });
      }

      const itemData = {
        type,
        key,
        title,
        description: description || '',
        tags: tags ? (Array.isArray(tags) ? tags : tags.split(',')) : []
      };

      if (organization) {
        itemData.organization = organization;
      } else {
        itemData.mechanic = mechanic;
      }

      const kbItem = await kbItemsService.createKbItem(itemData);

      res.status(201).json({
        success: true,
        message: 'KbItem created successfully',
        data: kbItem
      });
    } catch (error) {
      console.error('Create kbItem error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get kbItems with filtering and pagination
   */
  async getKbItems(req, res) {
    try {
      const { 
        page = 1, 
        limit = 10, 
        type, 
        status = 'active',
        organization,
        mechanic,
        search,
        sort_by = 'createdAt',
        sort_order = 'desc'
      } = req.query;

      const filters = { status };
      
      if (type) filters.type = type;
      if (organization) filters.organization = organization;
      if (mechanic) filters.mechanic = mechanic;

      const options = { 
        page, 
        limit, 
        sortBy: sort_by, 
        sortOrder: sort_order === 'asc' ? 1 : -1 
      };

      const result = await kbItemsService.getKbItems(filters, options);

      res.status(200).json({
        success: true,
        message: 'KbItems retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get kbItems error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get kbItem by ID
   */
  async getKbItemById(req, res) {
    try {
      const { id } = req.params;
      const kbItem = await kbItemsService.getKbItemById(id);

      res.status(200).json({
        success: true,
        message: 'KbItem retrieved successfully',
        data: kbItem
      });
    } catch (error) {
      console.error('Get kbItem error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update kbItem
   */
  async updateKbItem(req, res) {
    try {
      const { id } = req.params;
      const updateData = req.body;

      const updatedKbItem = await kbItemsService.updateKbItem(id, updateData);

      res.status(200).json({
        success: true,
        message: 'KbItem updated successfully',
        data: updatedKbItem
      });
    } catch (error) {
      console.error('Update kbItem error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete kbItem
   */
  async deleteKbItem(req, res) {
    try {
      const { id } = req.params;
      const deletedKbItem = await kbItemsService.deleteKbItem(id);

      res.status(200).json({
        success: true,
        message: 'KbItem deleted successfully',
        data: deletedKbItem
      });
    } catch (error) {
      console.error('Delete kbItem error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get kbItems by organization
   */
  async getKbItemsByOrganization(req, res) {
    try {
      const { organizationId } = req.params;
      const { page = 1, limit = 10, sort_by = 'createdAt', sort_order = 'desc' } = req.query;

      const options = { 
        page, 
        limit, 
        sortBy: sort_by, 
        sortOrder: sort_order === 'asc' ? 1 : -1 
      };

      const result = await kbItemsService.getKbItemsByOrganization(organizationId, options);

      res.status(200).json({
        success: true,
        message: 'Organization kbItems retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get organization kbItems error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get kbItems by mechanic
   */
  async getKbItemsByMechanic(req, res) {
    try {
      const { mechanicId } = req.params;
      const { page = 1, limit = 10, sort_by = 'createdAt', sort_order = 'desc' } = req.query;

      const options = { 
        page, 
        limit, 
        sortBy: sort_by, 
        sortOrder: sort_order === 'asc' ? 1 : -1 
      };

      const result = await kbItemsService.getKbItemsByMechanic(mechanicId, options);

      res.status(200).json({
        success: true,
        message: 'Mechanic kbItems retrieved successfully',
        data: result
      });
    } catch (error) {
      console.error('Get mechanic kbItems error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

module.exports = new KbItemsController();
