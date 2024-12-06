const mongoose = require('mongoose');

const NearbyPlaceSchema = new mongoose.Schema({
    place_id: { type: String, required: true },    // ID of the place from the external API
    name: { type: String },        // Name of the place
    vicinity: { type: String },    // Location details of the place
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // Reference to the user who bookmarked this place
}, { timestamps: true });

const NearbyPlace = mongoose.model('NearbyPlace', NearbyPlaceSchema);
module.exports = NearbyPlace;
