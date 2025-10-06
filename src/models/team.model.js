const mongoose = require('mongoose');
const teamsSchema = require('../../db-models/mongo/schemas/teams');

// Create the model
const Team = mongoose.model('Team', teamsSchema);

module.exports = Team; 