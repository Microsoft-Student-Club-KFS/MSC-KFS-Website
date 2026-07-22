const express = require('express');
const controller = require('../controllers/unit.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

router.get('/', asyncHandler(controller.list));
router.post('/', requirePermission('unit.manage.scope'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('unit.manage.scope'), asyncHandler(controller.update));
router.delete('/:id', requirePermission('unit.manage.scope'), asyncHandler(controller.remove));

module.exports = router;
