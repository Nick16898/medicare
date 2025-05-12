const moment = require('moment');
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
const userModel = require('../../model/user');
const checkOutModel = require('../../model/checkout');
const mediaModel = require('../../model/media');

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
        let profile = req.files['profile'] || []
        let images = req.files['images'] || []
        
        // Check if a hospital with the same email already exists
        const existingHospital = await hospitalModel.findOne({ email });
        if (existingHospital) {
            return errorResponse(res, 'Hospital with this email already exists');
        }

        const hospitalData = { ownerName, socialMediaLinks, name, email, mobileNumber, address, latitude, longitude };
        if(profile.length != 0){
            hospitalData['profile'] = profile[0]['filename']
        }
        const newHospital = await hospitalModel.create(hospitalData);
        
        // image store
        for (let m = 0; m < images.length; m++) {
         await mediaModel.create({image:images[m]['filename'],type:'HOSPITAL',typeId:newHospital['_id']});
            
        }

        return successResponse(res, 'Hospital created successfully', newHospital);

    } catch (err) {
        console.error('Error creating hospital:', err);
        return errorResponse(res, 'Error creating hospital');
    }
};

// get hospitals
// const getHospitals = async (req, res) => {
//     try {
//         const { hospitalId, limit = 10, offset = 0 } = req.body;

//         const condition = { delete: false }; // Only active hospitals

//         if (hospitalId) {
//             condition._id = hospitalId;
//         }

//         const { data: hospitals, totalRecords } = await selectdatawithjoin({
//             Model: hospitalModel,
//             condition,
//             fields: 'ownerName socialMediaLinks name email mobileNumber address profile',
//             limit: parseInt(limit),
//             offset: parseInt(offset),
//             sortBy: { create: -1 }
//         });

//         return successResponse(res, 'Hospitals fetched successfully', {
//             totalRecords,
//             hospitals
//         });
//     } catch (error) {
//         console.error('Error fetching hospitals:', error);
//         return errorResponse(res, 'Error fetching hospitals');
//     }
// };

const getHospitals = async (req, res) => {
    try {
        const { hospitalId, latitude, longitude, distance = 10, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active hospitals

        if (hospitalId) {
            condition._id = hospitalId;
        }

        // If latitude and longitude are provided, use geolocation query
        if (latitude && longitude) {
            const hospitals = await hospitalModel.aggregate([
                {
                    $geoNear: {
                        near: { type: "Point", coordinates: [parseFloat(longitude), parseFloat(latitude)] },
                        distanceField: "distance",
                        maxDistance: parseFloat(distance) * 1000, // convert km to meters
                        spherical: true,
                        query: condition
                    }
                },
                { $sort: { distance: 1 } }, // nearest first
                { $skip: parseInt(offset) },
                { $limit: parseInt(limit) },
                {
                    $project: {
                        ownerName: 1,
                        socialMediaLinks: 1,
                        name: 1,
                        email: 1,
                        mobileNumber: 1,
                        address: 1,
                        profile: 1,
                        distance: 1
                    }
                }
            ]);

            const totalRecords = hospitals.length;

            return successResponse(res, 'Hospitals fetched successfully', {
                totalRecords,
                hospitals
            });
        } else {
            // fallback normal if lat/long not provided
            const { data: hospitals, totalRecords } = await selectdatawithjoin({
                Model: hospitalModel,
                condition,
                fields: 'ownerName socialMediaLinks name email mobileNumber address profile',
                limit: parseInt(limit),
                offset: parseInt(offset),
                sortBy: { create: -1 }
            });

            for (let h = 0; h < hospitals.length; h++) {
                
                let img = await mediaModel.find({delete:false,type:'HOSPITAL',typeId:hospitals[h]['_id']})
                hospitals[h]['media'] = img
            }

            return successResponse(res, 'Hospitals fetched successfully', {
                totalRecords,
                hospitals
            });
        }
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
// const addAppointment = async (req, res) => {
//     let userId = req.body.userId
//     let mobilenumber = req.body.mobilenumber
//     let fullName = req.body.fullName || ""
//     let doctorId = req.body.doctorId || ""
//     let hospitalId = req.body.hospitalId
//     let appointmentuserId = req.body.appointmentuserId || ""
//     let duration = req.body.duration || ""
//     let disease = req.body.disease || ""
//     let appointmentDate = req.body.appointmentDate || ""
//     let appointmentTime = req.body.appointmentTime || ""
//     let isEmergency = req.body.isEmergency || false

//     try {

//         if (!fullName) {
//             return errorResponse(res, 'Full name is required');
//         }
//         if (!mobilenumber) {
//             return errorResponse(res, 'Mobile number is required');
//         }

//         let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");

//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             // add usefr if not exist
//             let userField = {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             }
//             let user = await saveModel(userModel, userField);
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         let appointmentfield = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             create: new Date(),
//         };
//         let appointmentDetailfield = {
//             create: new Date(),
//             userId,
//             disease,
//             duration: durationData.data[0].value,
//             doctorId,
//             appointmentTime,
//             appointmentDate,
//             isEmergency,
//             ...(appointmentuserId && { appointmentuserId: appointmentuserId })
//         }

//         const savedAppointment = await saveModel(appointmentModel, appointmentfield);

//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         appointmentDetailfield.appointmentId = savedAppointment._id;
//         await saveModel(appointmentdetailModel, appointmentDetailfield);

//         return successResponse(res, 'Appointment created successfully', []);

//     } catch (error) {
//         console.error('Error adding appointment:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// }


// add appointment
const addAppointment = async (req, res) => {
    let userId = req.body.userId;
    let mobilenumber = req.body.mobilenumber;
    let fullName = req.body.fullName || "";
    let doctorId = req.body.doctorId || "";
    let hospitalId = req.body.hospitalId;
    let appointmentuserId = req.body.appointmentuserId || "";
    let duration = req.body.duration || "";
    let disease = req.body.disease || "";
    let appointmentDate = req.body.appointmentDate || "";
    let appointmentTime = req.body.appointmentTime || "";
    let isEmergency = req.body.isEmergency || false;

    try {
        // Validation
        if (!fullName) {
            return errorResponse(res, 'Full name is required');
        }
        if (!mobilenumber) {
            return errorResponse(res, 'Mobile number is required');
        }
        if (appointmentDate) {
                       return errorResponse(res, 'Appointment date is required');
        }

        // valide date format YYYY-MM-DD using Date
        if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
            return errorResponse(res, 'Invalid date format. Please use YYYY-MM-DD.');
        }


        let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");

        let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });

        if (!checkMobileNumber) {
            // Add user if not exist
            let userField = {
                fullName,
                mobileNumber: mobilenumber,
            };
            let user = await saveModel(userModel, userField);

            userId = user._id;
        } else {
            userId = checkMobileNumber._id;
        }
        // check doctor detail
        let checkDoc = await doctorModel.find({ delete: false, _id: doctorId, isAvailable: false })
        if (checkDoc.length == 0) {
            return errorResponse(res, 'Doctor is Not Available');
        }
        // Create appointment
        let appointmentfield = {
            userId,
            mobileNumber: mobilenumber,
            fullName,
            hospitalId,
            doctorId,
            create: new Date(),
        };
        const savedAppointment = await saveModel(appointmentModel, appointmentfield);

        if (!savedAppointment) {
            return errorResponse(res, 'Error creating appointment');
        }

        // Create appointment detail
        let appointmentDetailfield = {
            create: new Date(),
            userId,
            disease,
            duration: durationData.data[0]?.value || "",

            appointmentTime,
            appointmentDate,
            isEmergency,
            appointmentId: savedAppointment._id,
        };

        if (appointmentuserId) {
            appointmentDetailfield.appointmentuserId = appointmentuserId;
        }

        await saveModel(appointmentdetailModel, appointmentDetailfield);

        return successResponse(res, 'Appointment created successfully', []);
    } catch (error) {
        console.error('Error adding appointment:', error);
        return errorResponse(res, 'Error adding appointment');
    }
};

// const addAppointmentV2 = async (req, res) => {
//     let {
//         userId,
//         mobilenumber,
//         fullName = "",
//         doctorId = "",
//         hospitalId,
//         appointmentuserId = "",
//         duration = "",
//         disease = "",
//         appointmentDate = "",
//         appointmentTime = "",
//         isEmergency = false,
//     } = req.body;

//     try {
//         // 🛑 Validation: required fields
//         if (!fullName) return errorResponse(res, 'Full name is required');
//         if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
//         if (!appointmentDate || !appointmentTime) return errorResponse(res, 'Appointment date and time are required');

//         // ✅ Validate date format: YYYY-MM-DD
//         if (!/^\d{4}-\d{2}-\d{2}$/.test(appointmentDate)) {
//             return errorResponse(res, 'Invalid date format. Use YYYY-MM-DD');
//         }

//         // ✅ Validate time format: HH:mm:ss
//         if (!/^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.test(appointmentTime)) {
//             return errorResponse(res, 'Invalid time format. Use HH:mm:ss');
//         }

//         // ✅ Get duration value from settings
//         const durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
//         const finalDuration = parseInt(durationData.data[0]?.value || "30");

//         // ✅ Check if user exists
//         let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
//         if (!checkMobileNumber) {
//             let userField = {
//                 fullName,
//                 mobileNumber: mobilenumber,
//             };
//             let user = await saveModel(userModel, userField);
//             userId = user._id;
//         } else {
//             userId = checkMobileNumber._id;
//         }

//         // ✅ Parse requested appointment time
//         const newStartTime = new Date(`${appointmentDate}T${appointmentTime}`);
//         const newEndTime = new Date(newStartTime.getTime() + finalDuration * 60000);

//         // ✅ Fetch existing appointments for that doctor & date
//         const existingAppointments = await appointmentdetailModel.find({
//             appointmentDate,
//             doctorId,
//             delete: false,
//         });

//         const hasConflict = existingAppointments.some(existing => {
//             const existingStart = new Date(`${existing.appointmentDate}T${existing.appointmentTime}`);
//             const existingDuration = parseInt(existing.duration || "30");
//             const existingEnd = new Date(existingStart.getTime() + existingDuration * 60000);

//             return newStartTime < existingEnd && newEndTime > existingStart;
//         });

//         if (hasConflict) {
//             return errorResponse(res, 'This time slot is already booked for the doctor.');
//         }

//         // ✅ Create appointment
//         let appointmentField = {
//             userId,
//             mobileNumber: mobilenumber,
//             fullName,
//             hospitalId,
//             create: new Date(),
//         };

//         const savedAppointment = await saveModel(appointmentModel, appointmentField);
//         if (!savedAppointment) {
//             return errorResponse(res, 'Error creating appointment');
//         }

//         // ✅ Create appointment detail
//         let appointmentDetailField = {
//             create: new Date(),
//             userId,
//             disease,
//             duration: finalDuration.toString(),
//             doctorId,
//             appointmentTime,
//             appointmentDate,
//             isEmergency,
//             appointmentId: savedAppointment._id,
//         };

//         if (appointmentuserId) {
//             appointmentDetailField.appointmentuserId = appointmentuserId;
//         }

//         await saveModel(appointmentdetailModel, appointmentDetailField);

//         return successResponse(res, 'Appointment created successfully', []);
//     } catch (error) {
//         console.error('Error adding appointment:', error);
//         return errorResponse(res, 'Error adding appointment');
//     }
// };





// delete appointment

// controllers/appointmentController.js

// const userModel = require('../models/user');
// const appointmentModel = require('../models/appointment');
// const appointmentdetailModel = require('../models/appointmentdetail');
// const settingModel = require('../models/setting');
// const { saveModel, selectdatv2 } = require('../helpers/dbHelper');
// const { successResponse, errorResponse } = require('../helpers/responseHelper');

// controllers/appointmentController.js


const addAppointmentV2 = async (req, res) => {
    let {
        userId,
        mobilenumber,
        fullName = "",
        doctorId = "",
        hospitalId,
        appointmentuserId = "",
        disease = "",
        appointmentDate = "",
        appointmentTime = "",
        isEmergency = false
    } = req.body;

    try {
        // Validation
        if (!fullName) return errorResponse(res, 'Full name is required');
        if (!mobilenumber) return errorResponse(res, 'Mobile number is required');
        if (!appointmentDate || !appointmentTime || !doctorId) {
            return errorResponse(res, 'Doctor, appointment date, and time are required');
        }

        // Get duration from settings
        let durationData = await selectdatv2(settingModel, { key: "Duration" }, "value");
        let durationValue = parseInt(durationData?.data?.[0]?.value || "0");

        // Calculate time range
        const startTime = moment(`${appointmentDate} ${appointmentTime}`, "YYYY-MM-DD HH:mm");
        const endTime = moment(startTime).add(durationValue, 'minutes');

        // Check for overlapping appointments
        const overlappingAppointment = await appointmentdetailModel.findOne({
            doctorId,
            appointmentDate,
            delete: false,
            appointmentTime: {
                $gte: startTime.format("HH:mm"),
                $lt: endTime.format("HH:mm")
            }
        });

        if (overlappingAppointment) {
            return errorResponse(res, 'Selected time slot is already booked.');
        }

        // Check or create user
        let checkMobileNumber = await userModel.findOne({ mobileNumber: mobilenumber, delete: false });
        if (!checkMobileNumber) {
            const user = await saveModel(userModel, {
                fullName,
                mobileNumber: mobilenumber,
            });
            userId = user._id;
        } else {
            userId = checkMobileNumber._id;
        }

        // Create appointment
        const appointmentField = {
            userId,
            mobileNumber: mobilenumber,
            fullName,
            hospitalId,
            create: new Date()
        };
        const savedAppointment = await saveModel(appointmentModel, appointmentField);

        if (!savedAppointment) {
            return errorResponse(res, 'Error creating appointment');
        }

        // Build appointment detail data
        const appointmentDetailField = {
            userId,
            disease,
            doctorId,
            duration: `${durationValue}`,
            appointmentDate,
            appointmentTime,
            isEmergency,
            appointmentId: savedAppointment._id,
            create: new Date()
        };

        // Only add appointmentuserId if it's valid
        if (appointmentuserId && mongoose.Types.ObjectId.isValid(appointmentuserId)) {
            appointmentDetailField.appointmentuserId = appointmentuserId;
        }

        await saveModel(appointmentdetailModel, appointmentDetailField);

        return successResponse(res, 'Appointment created successfully', []);
    } catch (error) {
        console.error('Error in addAppointmentV2:', error);
        return errorResponse(res, 'Error adding appointment');
    }
};






const deleteAppointment = async (req, res) => {
    const { appointmentId } = req.body;
    try {
        if (!appointmentId) {
            return errorResponse(res, 'Appointment ID is required');
        }

        // Find the appointment and delete it
        const appointment = await appointmentModel.findById(appointmentId);
        if (!appointment) {
            return errorResponse(res, 'Appointment not found');
        }

        // Soft delete the appointment
        appointment.delete = true;
        await appointment.save();

        // delete appointment details where appointmentId is appointmentId
        await appointmentdetailModel.updateMany(
            { appointmentId },
            { $set: { delete: true } }
        );


        // Soft delete the appointment details
        await appointmentdetailModel.updateMany(
            { appointmentId },
            { $set: { delete: true } }
        );


        return successResponse(res, 'Appointment deleted successfully', []);

    } catch (error) {
        console.error('Error deleting appointment:', error);
        return errorResponse(res, 'Error deleting appointment');
    }
}

// get appointments with details
const getAppointmentsWithDetails = async (req, res) => {
    try {
        const { appointmentId } = req.query;

        // Get start of today (00:00:00)
        const startOfToday = moment().startOf('day').toDate();
        let appointmentFilter = {
            delete: false,
            appointmentDate: {
                $gte: startOfToday
            }
        };
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
                    select: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
                    populate: [
                        { path: 'userId', select: 'fullName email mobileNumber gender' },
                        { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
                        { path: 'hospitalId', select: 'name email mobileNumber address' }
                    ]
                }
            ],
            fields: "duration appointmentTime appointmentDate inTime outTime disease isEmergency delete",
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

const getAppointmentsData = async (req, res) => {
    try {
        const { appointmentId, limit = 10, offset = 0 } = req.query;

        const appointmentFilter = { delete: false };
        if (appointmentId) {
            appointmentFilter._id = appointmentId;
        }

        // 1. Fetch appointments (paginated)
        const { data: appointments, totalRecords } = await selectdatawithjoin({
            Model: appointmentModel,
            condition: appointmentFilter,
            fields: 'amount payableAmount create userId doctorId hospitalId mobileNumber fullName',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { _id: -1 }
        });

        // if (appointments.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'No appointments found',
        //     });
        // }

        // 2. Get all appointment IDs
        const appointmentIds = appointments.map(app => app._id);

        // 3. Fetch related details
        const { data: allDetails } = await selectdatawithjoin({
            Model: appointmentdetailModel,
            condition: {
                delete: false,
                appointmentId: { $in: appointmentIds }
            },
            fields: 'appointmentId duration appointmentTime appointmentDate inTime outTime disease isEmergency userId doctorId hospitalId',
            joinModel: [
                { path: 'userId', select: 'fullName email mobileNumber gender' },
                { path: 'doctorId', select: 'name email mobileNumber specializationId degreeId hospitalId appointmentCharge experience' },
                { path: 'hospitalId', select: 'name email mobileNumber address' }
            ],
            sortBy: { _id: -1 }
        });

        // 4. Group details by appointmentId
        const detailMap = {};
        allDetails.forEach(detail => {
            const appId = detail.appointmentId?.toString();
            if (!detailMap[appId]) detailMap[appId] = [];
            detailMap[appId].push(detail);
        });

        // 5. Merge appointment with its details
        const mergedAppointments = appointments.map(app => ({
            ...app.toObject(),
            appointmentDetails: detailMap[app._id.toString()] || []
        }));

        return res.status(200).json({
            success: true,
            message: 'Appointments fetched successfully',
            totalRecords,
            data: mergedAppointments
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

const getUserList = async (req, res) => {
    try {
        const { userId, stateId, cityId, limit = 10, offset = 0 } = req.body;

        const condition = { delete: false }; // Only active users

        if (userId) {
            condition._id = userId;
        }
        if (stateId) {
            condition.stateId = stateId;
        }
        if (cityId) {
            condition.cityId = cityId;
        }

        const { data: users, totalRecords } = await selectdatawithjoin({
            Model: userModel,
            condition,
            fields: 'fullName email mobileNumber gender address profile stateId cityId zipCode registerAppVersion registerOS registerDevice',
            limit: parseInt(limit),
            offset: parseInt(offset),
            sortBy: { create: -1 },
        });

        return successResponse(res, 'Users fetched successfully', {
            totalRecords,
            users
        }, true);
    } catch (error) {
        console.error('Error fetching users:', error);
        return errorResponse(res, 'Error fetching users');
    }
};

// edit appointment Details
const editAppointmentDetails = async (req, res) => {
    try {
        const {
            appointmentId,
            appointmentDate,
            appointmentTime,
            inTime,
            outTime,
            disease,
            isEmergency
        } = req.body;

        if (!appointmentId) {
            return res.status(400).json({
                success: false,
                message: 'appointmentId is required'
            });
        }

        // Find the appointmentDetail
        const appointmentDetail = await appointmentdetailModel.findOne({
            delete: false,
            appointmentId: appointmentId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Appointment detail not found');
        }



        // Update the record
        const updatedDetail = await appointmentdetailModel.findByIdAndUpdate(
            appointmentDetail._id,
            {
                $set: {
                    appointmentId,
                    appointmentDate,
                    appointmentTime,
                    inTime,
                    outTime,
                    disease,
                    isEmergency,
                    update: new Date()
                }
            },
            { new: true }
        );

        return successResponse(res, 'Appointment detail updated successfully', updatedDetail);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};


const checkoutDoctorUpdate = async (req, res) => {
    try {
        const { doctorId, type, reason } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'doctorId is required'
            });
        }

        // Find the doctor
        const appointmentDetail = await doctorModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }



        // Update the record
        if (type == "START") {
            let obj = { doctorId: doctorId, startTime: moment(), reason }
            await saveModel(checkOutModel, obj);

        } else if (type == "END") {

            let data = await checkOutModel.find({ doctorId: doctorId })
                .sort({ createdAt: -1 })  // sort newest first
                .limit(1);
            if (data.length != 0) {

                const updatedDetail = await checkOutModel.findByIdAndUpdate(
                    data[0]['_id'],
                    {
                        $set: {
                            endTime: new Date()
                        }
                    },
                    { new: true }
                );
            } else {
                return errorResponse(res, 'Doctor not found checkout entry');
            }
        }


        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

const doctorUpdateAvailable = async (req, res) => {
    try {
        const { doctorId, isAvailable=true } = req.body;

        if (!doctorId) {
            return res.status(400).json({
                success: false,
                message: 'doctorId is required'
            });
        }

        // Find the doctor
        const appointmentDetail = await doctorModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }

            const updatedDetail = await doctorModel.findByIdAndUpdate(
                doctorId,
                {
                    $set: {
                        isAvailable: isAvailable
                    }
                },
                { new: true }
            );

        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

const hospitalView = async (req, res) => {

    try {
        const { hospitalId,limit,offset,text } = req.body;

        // Find the doctor
        const appointmentDetail = await hospitalModel.findOne({
            delete: false,
            _id: doctorId
        });

        if (!appointmentDetail) {
            return errorResponse(res, 'Doctor detail not found');
        }

            const updatedDetail = await doctorModel.findByIdAndUpdate(
                doctorId,
                {
                    $set: {
                        isAvailable: isAvailable
                    }
                },
                { new: true }
            );

        return successResponse(res, 'successfully', []);

    } catch (error) {
        console.error('Error updating appointment detail:', error);
        return errorResponse(res, 'Error updating appointment detail');

    }
};

module.exports = {
    test,
    addEditAdmin,
    login,
    adminProfile,
    addAppointment,
    addAppointmentV2,
    addHospital,
    getHospitals,
    addDoctor,
    getDoctors,
    getAppointmentsWithDetails,
    addeditSetting,
    getSettings,
    updateAppointmentTimeByType,
    getUserList,
    deleteAppointment,
    getAppointmentsData,
    editAppointmentDetails,
    checkoutDoctorUpdate,
    doctorUpdateAvailable
}



// doctor pan unavailaba rese tyare mare appointment user ne notify karava na ane update karava na tena sedual