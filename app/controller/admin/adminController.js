const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const adminModel = require('../../model/admin');
const appointmentModel = require('../../model/appointment');
const appointmentdetailModel = require('../../model/appointmentdetail');
const hospitalModel = require('../../model/hospital');
const doctorModel = require('../../model/doctor');
const settingModel = require('../../model/setting');

const { successResponse, errorResponse, saveModel, selectdata, selectdatv2, updateModel, selectdatawithjoin } = require('../../helper/index');

const test = async (req, res) => {
    try {
        return successResponse(res, 'Test api call successfully', []);

    } catch (err) {
        console.log('Error in test:', err);
        return errorResponse(res, 'Error in test');
    }
}

// POST route to create or edit an admin
const addEditAdmin = async (req, res) => {
    let adminId = req.body.adminId || "";
    let fullName = req.body.fullName || "";
    let mobileNumber = req.body.mobileNumber || "";
    let gender = req.body.gender || "";
    let email = req.body.email || "";
    let address = req.body.address || "";
    let stateId = req.body.stateId || "";
    let cityId = req.body.cityId || "";
    let zipCode = req.body.zipCode || "";
    let password = req.body.password || "";
    let profile = req.file ? `profiles/${req.file.filefullName}` : req.body.profile || "";

    try {
        let field = {
            fullName, mobileNumber, address, email, gender, stateId, cityId, zipCode
        };
        if (profile) {
            field.profile = profile;
        }

        if (adminId) {
            // Edit existing admin
            let admin = await adminModel.findById(adminId);
            if (!admin) {
                return errorResponse(res, 'Admin not found');
            }

            // Check if email or mobile number already exists for another admin
            let existingAdmin = await adminModel.findOne({
                $or: [{ email }, { mobileNumber }],
                _id: { $ne: adminId }
            });
            if (existingAdmin) {
                return errorResponse(res, 'Admin with this email or mobile number already exists');
            }

            field.update = new Date();
            const updatedAdmin = await updateModel(adminModel, { _id: adminId }, field);
            return successResponse(res, 'Admin updated successfully', updatedAdmin);
        } else {
            // Check if email or mobile number already exists
            let existingAdmin = await adminModel.findOne({ $or: [{ email }, { mobileNumber }] });
            if (existingAdmin) {
                return errorResponse(res, 'Admin with this email or mobile number already exists');
            }

            // Hash the password using MD5
            field.password = md5(password);
            const savedAdmin = await saveModel(adminModel, field);
            return successResponse(res, 'Admin created successfully', savedAdmin);
        }
    } catch (error) {
        console.error('Error creating/updating admin:', error);
        return errorResponse(res, 'Error creating/updating admin');
    }
}

// login 
const login = async (req, res) => {
    let loginField = req.body.loginField || "";
    let password = req.body.password || "";

    try {
        const admin = await adminModel.findOne({
            $or: [{ email: loginField }, { mobileNumber: loginField }],
            delete: false,
            password: md5(password)
        });
        if (!admin) {
            return errorResponse(res, 'Invalid Valide credentials');
        }

        return successResponse(res, 'Login successful', admin);
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, 'Error logging in');
    }
}

// admin profile
const adminProfile = async (req, res) => {
    const adminId = req.body.adminId || "";
    const limit = req.body.limit || 0;
    const offset = req.body.offset || 0;
    const searchQuery = req.body.searchQuery || "";

    try {
        let field = `fullName email mobileNumber address profile`;
        let data = await selectdatv2(adminModel, { _id: adminId, delete: false }, field, limit, offset, field, searchQuery, { createdAt: -1 });
        if (data.length == 0) {
            return errorResponse(res, 'Admin not found');
        }
        return successResponse(res, 'Admin profile fetched successfully', data, true);
    } catch (error) {
        console.error('Error fetching admin profile:', error);
        return errorResponse(res, 'Error fetching admin profile');
    }
}

// add hostpital
const addHospital = async (req, res) => {
    try {
        const { ownerName, socialMediaLinks = '', name = '', email, mobileNumber = '', address = '', latitude = '', longitude = '' } = req.body;

        // Check if a hospital with the same email already exists
        const existingHospital = await hospitalModel.findOne({ email });
        if (existingHospital) {
            return errorResponse(res, 'Hospital with this email already exists');
        }

        const hospitalData = { ownerName, socialMediaLinks, name, email, mobileNumber, address, latitude, longitude };

        const newHospital = await hospitalModel.create(hospitalData);
        return successResponse(res, 'Hospital created successfully', newHospital);

    } catch (err) {
        console.error('Error creating hospital:', err);
        return errorResponse(res, 'Error creating hospital');
    }
};

// get hospitals
const getHospitals = async (req, res) => {
    try {
        const { hospitalId, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active hospitals

        if (hospitalId) {
            condition._id = hospitalId;
        }

        const { data: hospitals, totalRecords } = await selectdatawithjoin({
            Model: hospitalModel,
            condition,
            fields: 'ownerName socialMediaLinks name email mobileNumber address profile',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { create: -1 }
        });

        return successResponse(res, 'Hospitals fetched successfully', {
            totalRecords,
            hospitals
        });
    } catch (error) {
        console.error('Error fetching hospitals:', error);
        return errorResponse(res, 'Error fetching hospitals');
    }
};

// add doctor
const addDoctor = async (req, res) => {
    try {
        const {
            name,
            email,
            mobileNumber = "",
            specializationId = "",
            degreeId = "",
            hospitalId = "",
            address = "",
            appointmentCharge = "",
            experience = "",
            age,
            gender } = req.body;

        const profile = req.file ? `profiles/${req.file.filefullName}` : req.body.profile || "";

        if (!name || !email || !age || !gender) {
            return errorResponse(res, "Name, email, age, and gender are required");
        }

        const existingDoctor = await doctorModel.findOne({ email });
        if (existingDoctor) {
            return errorResponse(res, "Doctor with this email already exists");
        }

        const doctorData = {
            name,
            email,
            mobileNumber,
            specializationId,
            degreeId,
            hospitalId,
            address,
            appointmentCharge,
            experience,
            profile,
            age,
            gender
        };

        const newDoctor = await doctorModel.create(doctorData);
        return successResponse(res, "Doctor created successfully", newDoctor);

    } catch (err) {
        console.error("Error creating doctor:", err);
        return errorResponse(res, "Error creating doctor");
    }
};

// get doctors
const getDoctors = async (req, res) => {
    try {
        const { doctorId, hospitalId, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active doctors

        if (doctorId) {
            condition._id = doctorId;
        }
        if (hospitalId) {
            condition.hospitalId = hospitalId;
        }

        const { data: doctors, totalRecords } = await selectdatawithjoin({
            Model: doctorModel,
            condition,
            fields: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience profile age gender',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { create: -1 },
            joinModel: [
                { path: 'specializationId', select: 'name' },
                { path: 'degreeId', select: 'name' },
                { path: 'hospitalId', select: 'name email mobileNumber address' }
            ]
        });

        return successResponse(res, 'Doctors fetched successfully', {
            totalRecords,
            doctors
        });
    } catch (error) {
        console.error('Error fetching doctors:', error);
        return errorResponse(res, 'Error fetching doctors');
    }
};

// add appointment
const addAppointment = async (req, res) => {
    let userId = req.body.userId
    let doctorId = req.body.doctorId
    let hospitalId = req.body.hospitalId
    let appointmentuserId = req.body.appointmentuserId || ""
    let duration = req.body.duration || ""
    let disease = req.body.disease || ""
    let appointmentDate = req.body.appointmentDate || ""
    let appointmentTime = req.body.appointmentTime || ""
    let isEmergency = req.body.isEmergency

    try {

        let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
        // console.log('====================================');
        // console.log('durationData', durationData.data[0].value);
        // console.log('====================================');

        let appointmentfield = {
            userId,
            hospitalId,
        };
        let appointmentDetailfield = {
            userId,
            disease,
            duration: durationData.data[0].value,
            doctorId,
            appointmentTime,
            appointmentDate,
            isEmergency,
            appointmentuserId
        }

        const savedAppointment = await saveModel(appointmentModel, appointmentfield);

        if (!savedAppointment) {
            return errorResponse(res, 'Error creating appointment');
        }
        
        appointmentDetailfield.appointmentId = savedAppointment._id;
        await saveModel(appointmentdetailModel, appointmentDetailfield);

        return successResponse(res, 'Appointment created successfully', []);

    } catch (error) {
        console.error('Error adding appointment:', error);
        return errorResponse(res, 'Error adding appointment');
    }
}

// get appointments with details
const getAppointmentsWithDetails = async (req, res) => {
    try {
        const { appointmentId } = req.query;

        let appointmentFilter = { delete: false };
        if (appointmentId) {
            appointmentFilter._id = appointmentId;
        }

        // 1. Fetch appointmentDetails with populated appointment
        const { data: appointmentDetails } = await selectdatawithjoin({
            Model: appointmentdetailModel,
            condition: appointmentFilter,
            limit: 100,
            offset: 0,
            joinModel: [
                {
                    path: 'appointmentId',
                    select: 'amount payableAmount create userId doctorId hospitalId',
                    populate: [
                        { path: 'userId', select: 'fullName email mobileNumber gender' },
                        { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
                        { path: 'hospitalId', select: 'name email mobileNumber address' }
                    ]
                }
            ],
            fields: "duration appointmentTime appointmentDate inTime outTime disease isEmergency",
            sortBy: { '_id': -1 },
        });

        if (appointmentDetails.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No appointment details found',
            });
        }

        // 2. Group by appointmentId
        const groupedAppointments = {};

        appointmentDetails.forEach(detail => {
            const appointment = detail.appointmentId?._id?.toString();
            if (!appointment) return; // skip if no appointment linked

            if (!groupedAppointments[appointment]) {
                groupedAppointments[appointment] = {
                    ...detail.appointmentId?.toObject?.() || {},
                    appointmentDetails: []
                };
            }

            // push the appointment detail
            groupedAppointments[appointment].appointmentDetails.push({
                ...detail.toObject(),
                appointmentId: undefined // optional: remove extra data from detail
            });
        });

        const result = Object.values(groupedAppointments);

        // 3. Send success response
        return res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully',
            data: result
        });

    } catch (error) {
        console.error('Error fetching appointments:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while fetching appointments'
        });
    }
};

// add edit setting 
const addeditSetting = async (req, res) => {
    try {
        const { key, value } = req.body;

        if (!key || value === undefined) {
            return errorResponse(res, 'Key and value are required');
        }

        // Check if setting with given key already exists
        let setting = await settingModel.findOne({ key });

        if (setting) {
            // If exists, update it
            setting.value = value;
            await setting.save();
            return successResponse(res, 'Setting updated successfully', setting);
        } else {
            // If not exists, create new
            const newSetting = await settingModel.create({ key, value });
            return successResponse(res, 'Setting created successfully', newSetting);
        }

    } catch (error) {
        console.error('Error in addOrUpdateSetting:', error);
        return errorResponse(res, 'Error adding or updating setting');
    }
};

// get setting
const getSettings = async (req, res) => {
    try {
        const { key } = req.query;

        const condition = {};
        if (key) {
            condition.key = key;
        }

        // Using selectdatawithjoin function
        const { data: settings } = await selectdatawithjoin({
            Model: settingModel,
            condition,
            fields: 'key value', // Only select key and value
            sortBy: { create: -1 } // Latest settings first (optional)
        });

        return successResponse(res, 'Settings fetched successfully', settings);
    } catch (error) {
        console.error('Error fetching settings:', error);
        return errorResponse(res, 'Error fetching settings');
    }
};

// update appointment time by type
const updateAppointmentTimeByType = async (req, res) => {
    try {
        const { appointmentId, type, time } = req.body;

        if (!appointmentId || !type) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId and type ("in" or "out") are required'
            });
        }

        if (type !== 'in' && type !== 'out') {
            return res.status(400).json({
                success: false,
                message: 'Type must be either "in" or "out"'
            });
        }

        // Find the appointmentDetail
        const appointmentDetail = await appointmentdetailModel.findOne({
            _id: appointmentId,
            delete: false
        });

        if (!appointmentDetail) {
            return res.status(404).json({
                success: false,
                message: 'Appointment detail not found'
            });
        }

        // Prepare the time
        let finalTime = time;
        if (!finalTime) {
            finalTime = new Date().toLocaleTimeString('en-US', { hour12: false });
            // Example format: "14:45:00"
        }

        const updateFields = {
            update: new Date()
        };

        if (type === 'in') {
            updateFields.inTime = finalTime;
        } else if (type === 'out') {
            updateFields.outTime = finalTime;
        }

        // Update the record
        const updatedDetail = await appointmentdetailModel.findByIdAndUpdate(
            appointmentDetail._id,
            { $set: updateFields },
            { new: true }
        );

        return res.status(200).json({
            success: true,
            message: `Appointment ${type === 'in' ? 'start' : 'end'} time updated successfully`,
            data: updatedDetail
        });

    } catch (error) {
        console.error('Error updating appointment time:', error);
        return res.status(500).json({
            success: false,
            message: 'Something went wrong while updating appointment time'
        });
    }
};

module.exports = {
    test,
    addEditAdmin,
    login,
    adminProfile,
    addAppointment,
    addHospital,
    getHospitals,
    addDoctor,
    getDoctors,
    getAppointmentsWithDetails,
    addeditSetting,
    getSettings,
    updateAppointmentTimeByType
}



// doctor pan unavailaba rese tyare mare appointment user ne notify karava na ane update karava na tena sedual