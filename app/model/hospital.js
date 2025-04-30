// /models/hospital.js
const mongoose = require('mongoose');

const hospitalSchema = new mongoose.Schema({

    ownerName: { type: String, required: true },
    socialMediaLinks: { type: String, required: false },
    name: { type: String, required: false },
    email: { type: String, required: false },
    mobileNumber: { type: String, required: false },
    address: { type: String, required: false },
    latitude: { type: String, required: false },
    longitude: { type: String, required: false },

    create: { type: Date, default: Date.now },
    update: { type: Date, default: Date.now },
    delete: { type: Boolean, default: false },
});

const hospital = mongoose.model('hospital', hospitalSchema);

module.exports = hospital;