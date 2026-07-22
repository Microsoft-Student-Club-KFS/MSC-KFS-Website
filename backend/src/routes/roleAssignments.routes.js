const express = require('express');
const controller = require('../controllers/roleAssignment.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

router.get('/', requirePermission('role.view'), asyncHandler(controller.list));
router.post('/', requirePermission('role.assign.scope'), asyncHandler(controller.assign));
router.delete('/:id', requirePermission('role.assign.scope'), asyncHandler(controller.revoke));

module.exports = router;
