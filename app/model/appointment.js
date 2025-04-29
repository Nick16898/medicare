// /models/appointment.js
const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
    doctorId: { type: mongoose.Schema.Types.ObjectId, ref: 'doctor', required: false },
    hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: 'hospital', required: false },

    fullName: { type: String, required: false },
    mobileNumber: { type: String, required: false },

    amount: { type: String, required: false },
    payableAmount: { type: String, required: false },

    create: { type: Date, default: Date.now },
    update: { type: Date, default: Date.now },
    delete: { type: Boolean, default: false },
});

const appointment = mongoose.model('appointment', appointmentSchema);

module.exports = appointment;
