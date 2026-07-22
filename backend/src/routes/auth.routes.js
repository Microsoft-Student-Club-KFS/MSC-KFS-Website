const express = require('express');
const authController = require('../controllers/auth.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.post('/login', asyncHandler(authController.login));
router.get('/me', asyncHandler(authenticate), asyncHandler(loadPermissions), asyncHandler(authController.me));

module.exports = router;
