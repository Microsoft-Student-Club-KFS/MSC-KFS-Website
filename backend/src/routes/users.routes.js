const express = require('express');
const controller = require('../controllers/user.controller');
const authenticate = require('../middleware/authenticate');
const { loadPermissions, requirePermission } = require('../middleware/authorize');
const asyncHandler = require('../utils/asyncHandler');

const router = express.Router();

router.use(asyncHandler(authenticate), asyncHandler(loadPermissions));

// Searching users is only needed when assigning a role to someone, so it
// is gated behind the same permission as making an assignment.
router.get('/search', requirePermission('role.assign.scope'), asyncHandler(controller.search));

// Full user management (creating accounts, listing everyone) is restricted
// to whoever holds user.view.all / user.view.scope / member.view.scope.
router.get('/', (req, res, next) => {
  const hasPermission = req.user.permissions && (
    req.user.permissions.has('user.view.all') ||
    req.user.permissions.has('user.view.scope') ||
    req.user.permissions.has('member.view.scope')
  );
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
}, asyncHandler(controller.list));

// Accounts can be created by anyone holding user.manage.all
router.post('/', requirePermission('user.manage.all'), asyncHandler(controller.create));

// Allow update/delete if the user has user.manage.all OR member.manage.scope
router.patch('/:id', (req, res, next) => {
  const hasPermission = req.user.permissions && (
    req.user.permissions.has('user.manage.all') ||
    req.user.permissions.has('member.manage.scope')
  );
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
}, asyncHandler(controller.update));

router.delete('/:id', (req, res, next) => {
  const hasPermission = req.user.permissions && (
    req.user.permissions.has('user.manage.all') ||
    req.user.permissions.has('member.manage.scope')
  );
  if (!hasPermission) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
}, asyncHandler(controller.remove));

router.get('/:id/roles', requirePermission('user.manage.all'), asyncHandler(controller.getUserRoles));

module.exports = router;
