const express = require('express');
const controller = require('../controllers/group.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

router.get('/', asyncHandler(controller.list));
router.post('/', requirePermission('group.manage.scope'), asyncHandler(controller.create));
router.patch('/:id', requirePermission('group.manage.scope'), asyncHandler(controller.update));
router.get('/:id/vcf', requirePermission('group.view'), asyncHandler(controller.exportVcf));

module.exports = router;
