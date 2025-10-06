const mongoose = require('mongoose');
const usersSubcontractorsSchema = require('../schemas/users-subcontractors');

// Create the model
const UserSubcontractor = mongoose.model('UserSubcontractor', usersSubcontractorsSchema);

module.exports = UserSubcontractor; 