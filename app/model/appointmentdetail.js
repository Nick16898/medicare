// /models/appointmentdetail.js
const mongoose = require('mongoose');

const appointmentdetailSchema = new mongoose.Schema({
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
    appointmentuserId: { type: mongoose.Schema.Types.ObjectId, ref: 'user', required: false },
    appointmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'appointment', required: false },
    diseaseId: { type: mongoose.Schema.Types.ObjectId, ref: 'disease', required: false },

    duration: { type: String, required: false },
    appointmentDate: { type: String, required: false },
    appointmentTime: { type: String, required: false },
    inTime: { type: String, required: false },
    outTime: { type: String, required: false },
    
    disease: { type: String, required: false },
    isEmergency: { type: Boolean, default: false },

    amount: { type: String, required: false },
    payableAmount: { type: String, required: false },

    create: { type: Date, default: Date.now },
    update: { type: Date, default: Date.now },
    delete: { type: Boolean, default: false },
});

const appointmentdetail = mongoose.model('appointmentdetail', appointmentdetailSchema);

module.exports = appointmentdetail;
