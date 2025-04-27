const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const controller = require('./userController.js');
const validation = require('./userValidation.js');
const { validate } = require('../../helper/index.js');
const authenticate = require('../../middleware/auth.js');
// const authenticate = require('../../middleware/auth.js');

const app = express();
const router = express.Router();


const userProfile = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadPath = path.join(__dirname, '../uploads/user/profiles');
        if (!fs.existsSync(uploadPath)) {
            fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${Date.now()}${ext}`);
    }
});

const uploadProfile = multer({ storage: userProfile });

// Apply global middleware
router.use(express.json()); // Parses JSON requests
router.use(authenticate); // Global authentication middleware

// Define the register route
router.post('/addedituser', uploadProfile.single('profile'), validate(validation.addEditUser), controller.addEditUser);
router.post('/login', validate(validation.login), controller.login);
router.post('/userprofile', controller.userProfile);

module.exports = router;