const express = require('express');
const authRoutes = require('./auth.routes');
const departmentsRoutes = require('./departments.routes');
const unitsRoutes = require('./units.routes');
const groupsRoutes = require('./groups.routes');
const roleAssignmentsRoutes = require('./roleAssignments.routes');
const usersRoutes = require('./users.routes');
const applicationsRoutes = require('./applications.routes');
const portalRoutes = require('./portal.routes');

const router = express.Router();

router.use('/auth', authRoutes);
router.use('/departments', departmentsRoutes);
router.use('/units', unitsRoutes);
router.use('/groups', groupsRoutes);
router.use('/role-assignments', roleAssignmentsRoutes);
router.use('/users', usersRoutes);
router.use('/applications', applicationsRoutes);
router.use('/portal', portalRoutes);

module.exports = router;
