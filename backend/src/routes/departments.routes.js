const express = require('express');
const controller = require('../controllers/department.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

// Viewing the department list is open to any signed-in user; it is the
// club's org chart, not sensitive data.
router.get('/', asyncHandler(controller.list));

router.post('/', requirePermission('department.manage'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('department.manage'), asyncHandler(controller.update));

module.exports = router;
