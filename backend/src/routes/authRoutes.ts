import { Router } from 'express';
import { authenticateUser, requireAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { signInSchema, refreshTokenSchema } from '../schemas/authSchema';
import {
  signIn,
  adminLogin,
  refreshToken,
  logout,
  signOut,
  getProfile,
  me,
  checkSession
} from '../controllers/authController';

const router = Router();

// POST /auth/signin - User sign in (with validation)
router.post('/signin', validate(signInSchema), signIn);

// POST /auth/admin/login - Admin login (with validation)
router.post('/admin/login', validate(signInSchema), adminLogin);

// POST /auth/refresh - Refresh access token (with validation)
router.post('/refresh', validate(refreshTokenSchema), refreshToken);

// POST /auth/logout - Logout (requires authentication)
router.post('/logout', authenticateUser, logout);

// POST /auth/signout - Sign out (alternative logout endpoint)
router.post('/signout', requireAuth, signOut);

// GET /auth/session - Check session validity
router.get('/session', checkSession);

// GET /auth/profile - Get current user profile (requires authentication)
router.get('/profile', authenticateUser, getProfile);

// GET /auth/me - Get current user info (requires authentication)
router.get('/me', requireAuth, me);

export default router;
