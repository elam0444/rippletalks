import { Router } from 'express';
import { authenticateUser, requireAdmin } from '../middleware/auth';
import {
  getCompanyUsers,
  createUser,
  updateUserRole,
  deleteUser,
  getDashboardStats,
  getActivityLogs
} from '../controllers/adminController';

const router = Router();

// All admin routes require authentication AND admin role
router.use(authenticateUser, requireAdmin);

// User management
router.get('/users', getCompanyUsers);
router.post('/users', createUser);
router.patch('/users/:userId/role', updateUserRole);
router.delete('/users/:userId', deleteUser);

// Dashboard analytics
router.get('/dashboard/stats', getDashboardStats);
router.get('/dashboard/activity', getActivityLogs);

export default router;
