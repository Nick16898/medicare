const crypto = require('crypto');
const { errorResponse } = require('../helper');

// Replace this with your predefined 64-bit code or a dynamic validation method
const apitoken = '3667dfe4a#660$89c516%20ee63ed$2db0c3';

const authenticate = (req, res, next) => {
    try {
        const authHeader = req.headers['apitoken'];
        
        if (!authHeader) {
            return errorResponse(res, 'Authorization Token is missing');
        }

        // Validate the 64-bit code
        if (authHeader === apitoken) {
            return next(); // Authentication successful
        } else {
            return errorResponse(res, 'Invalid Authorization Token');
        }
    } catch (error) {
        console.error('Error in authentication middleware:', error);
        return errorResponse(res, 'Error in authentication middleware');
    }
};

module.exports = authenticate;
