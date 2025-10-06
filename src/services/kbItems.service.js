const { KbItems } = require("../models");
const { generatePresignedUrl } = require("./file-upload.service");
const axios = require("axios");

class KbItemsService {
  /**
   * Create a new kbItem
   */
  async createKbItem(itemData) {
    try {
      const newKbItem = new KbItems(itemData);
      newKbItem.status = "pending";
      const savedKbItem = await newKbItem.save();
      console.log(savedKbItem);

      let url = "";
      if (newKbItem.type === "file") {
        url = await generatePresignedUrl(newKbItem.key);
      } else {
        url = newKbItem.key;
      }

      axios
        .post(
          "https://knowledge-base-tool.onrender.com/api/v1/kb/documents/upload-url",
          {
            url: url,
            metadata: {
              kb_item_id: savedKbItem._id,
              organizationId: newKbItem.organization,
              mechanicId: newKbItem.mechanic,
            },
          },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
        .then(async (res) => {
          console.log(res.data);
          savedKbItem.status = "active";
          await savedKbItem.save();
        })
        .catch(async (err) => {
          console.log(err);
          savedKbItem.status = "failed";
          await savedKbItem.save();
        });

      // Populate references
      await savedKbItem.populate([
        { path: "organization", select: "name" },
        { path: "mechanic", select: "name email" },
      ]);

      return savedKbItem;
    } catch (error) {
      throw new Error(`KbItem creation error: ${error.message}`);
    }
  }

  /**
   * Get kbItems with filtering and pagination
   */
  async getKbItems(filters = {}, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = -1,
      } = options;

      const query = { status: "active", ...filters };

      const paginateOptions = {
        page: parseInt(page),
        limit: parseInt(limit),
        sort: { [sortBy]: sortOrder },
        populate: [
          { path: "organization", select: "name" },
          { path: "mechanic", select: "name email" },
        ],
      };

      return await KbItems.paginate(query, paginateOptions);
    } catch (error) {
      throw new Error(`Error retrieving kbItems: ${error.message}`);
    }
  }

  /**
   * Get kbItem by ID
   */
  async getKbItemById(id) {
    try {
      const kbItem = await KbItems.findById(id).populate([
        { path: "organization", select: "name" },
        { path: "mechanic", select: "name email" },
      ]);

      if (!kbItem) {
        throw new Error("KbItem not found");
      }

      return kbItem;
    } catch (error) {
      throw new Error(`Error retrieving kbItem: ${error.message}`);
    }
  }

  /**
   * Update kbItem
   */
  async updateKbItem(id, updateData) {
    try {
      const updatedKbItem = await KbItems.findByIdAndUpdate(id, updateData, {
        new: true,
        runValidators: true,
      }).populate([
        { path: "organization", select: "name" },
        { path: "mechanic", select: "name email" },
      ]);

      if (!updatedKbItem) {
        throw new Error("KbItem not found");
      }

      return updatedKbItem;
    } catch (error) {
      throw new Error(`Error updating kbItem: ${error.message}`);
    }
  }

  /**
   * Delete kbItem (soft delete by setting status to deleted)
   */
  async deleteKbItem(id) {
    try {
      const deletedKbItem = await KbItems.findByIdAndUpdate(
        id,
        { status: "deleted" },
        { new: true }
      );

      if (!deletedKbItem) {
        throw new Error("KbItem not found");
      }

      axios
        .delete(
          "https://knowledge-base-tool.onrender.com/api/v1/kb/documents/" +
            deletedKbItem._id,
          { kb_item_id: deletedKbItem._id },
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        )
        .then(async (res) => {
          console.log(res.data);
          savedKbItem.status = "active";
          await savedKbItem.save();
        })
        .catch(async (err) => {
          console.log(err);
          savedKbItem.status = "failed";
          await savedKbItem.save();
        });

      return deletedKbItem;
    } catch (error) {
      throw new Error(`Error deleting kbItem: ${error.message}`);
    }
  }

  /**
   * Get kbItems by organization
   */
  async getKbItemsByOrganization(organizationId, options = {}) {
    try {
      const filters = { organization: organizationId };
      return await this.getKbItems(filters, options);
    } catch (error) {
      throw new Error(
        `Error retrieving organization kbItems: ${error.message}`
      );
    }
  }

  /**
   * Get kbItems by mechanic
   */
  async getKbItemsByMechanic(mechanicId, options = {}) {
    try {
      const filters = { mechanic: mechanicId };
      return await this.getKbItems(filters, options);
    } catch (error) {
      throw new Error(`Error retrieving mechanic kbItems: ${error.message}`);
    }
  }
}

module.exports = new KbItemsService();
