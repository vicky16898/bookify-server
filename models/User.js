const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    role: String,
    bookmarks: [
        {
            placeId: String,
            name: String,
            address: String,
            createdAt: { type: Date, default: Date.now }
        }
    ]
});

const UserModel = mongoose.model('User', UserSchema);

module.exports = UserModel;