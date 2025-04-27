const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const md5 = require('md5');
const userModel = require('../../model/user');
const { successResponse, errorResponse, saveModel, selectdata, selectdatv2, updateModel } = require('../../helper/index');

// POST route to create or edit an user
const addEditUser = async (req, res) => {
    let userId = req.body.userId || "";
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
    let registerAppVersion = req.body.registerAppVersion || "";
    let registerOS = req.body.registerOS || "";
    let registerDevice = req.body.registerDevice || "";

    try {
        let field = {
            fullName, mobileNumber, address, email, gender, stateId, cityId, zipCode,
            registerAppVersion, registerOS, registerDevice
        };
        if (profile) {
            field.profile = profile;
        }

        if (userId) {
            // Edit existing user
            let user = await userModel.findById(userId);
            if (!user) {
                return errorResponse(res, 'Usder not found');
            }

            // Check if email or mobile number already exists for another user
            let existingUser = await userModel.findOne({
                $or: [{ email }, { mobileNumber }],
                _id: { $ne: userId }
            });
            if (existingUser) {
                return errorResponse(res, 'User with this email or mobile number already exists');
            }

            field.update = new Date();
            const updatedUser = await updateModel(userModel, { _id: userId }, field);
            return successResponse(res, 'User updated successfully', updatedUser);
        } else {
            // Check if email or mobile number already exists
            let existingUser = await userModel.findOne({ $or: [{ email }, { mobileNumber }] });
            if (existingUser) {
                return errorResponse(res, 'User with this email or mobile number already exists');
            }

            // Hash the password using MD5
            field.password = md5(password);
            const savedUser = await saveModel(userModel, field);
            return successResponse(res, 'User created successfully', savedUser);
        }
    } catch (error) {
        console.error('Error creating/updating user:', error);
        return errorResponse(res, 'Error creating/updating user');
    }
}

// login 
const login = async (req, res) => {
    let loginField = req.body.loginField || "";
    let password = req.body.password || "";

    try {
        const user = await userModel.findOne({
            $or: [{ email: loginField }, { mobileNumber: loginField }],
            delete: false,
            password: md5(password)
        });
        if (!user) {
            return errorResponse(res, 'Invalid valide credentials');
        }

        return successResponse(res, 'Login successful', user);
    } catch (error) {
        console.error('Error logging in:', error);
        return errorResponse(res, 'Error logging in');
    }
}

// user profile
const userProfile = async (req, res) => {
    const userId = req.body.userId || "";
    const limit = req.body.limit || 0;
    const offset = req.body.offset || 0;
    const searchQuery = req.body.searchQuery || "";

    try {
        let field = `fullName email mobileNumber address profile`;
        let data = await selectdatv2(userModel, { _id: userId, delete: false }, field, limit, offset, field, searchQuery, { createdAt: -1 });
        if (data.length == 0) {
            return errorResponse(res, 'User not found');
        }
        return successResponse(res, 'User profile fetched successfully', data, true);
    } catch (error) {
        console.error('Error fetching user profile:', error);
        return errorResponse(res, 'Error fetching user profile');
    }
}


module.exports = {
    addEditUser,
    login,
    userProfile,
}