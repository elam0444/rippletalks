import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../config/supabase';
import * as authService from '../services/authService';

// Extend Express Request to include user data
export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email?: string;
    role?: string;
  };
}

/**
 * Authentication middleware for Supabase Auth
 * Validates JWT token from Authorization header or cookies
 * Attaches user data to request object
 */
export const authenticateUser = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
    } else if (req.cookies && req.cookies['sb-access-token']) {
      token = req.cookies['sb-access-token'];
    }

    if (!token) {
      res.status(401).json({
        error: 'Missing or invalid authorization. Expected: Bearer <token> or cookie'
      });
      return;
    }

    // Verify the JWT token with Supabase
    const user = await authService.verifyToken(token);

    if (!user) {
      res.status(401).json({
        error: 'Invalid or expired token'
      });
      return;
    }

    // Attach user data to request object
    req.user = {
      id: user.id,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error: any) {
    console.error('Authentication error:', error);
    res.status(401).json({
      error: 'Authentication required',
      details: error.message
    });
  }
};

/**
 * Require authentication middleware
 * Alias for authenticateUser for consistency with functional approach
 */
export const requireAuth = authenticateUser;

/**
 * Optional authentication middleware
 * Attaches user if token is present, but doesn't fail if missing
 */
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Extract token from Authorization header or cookie
    const authHeader = req.headers.authorization;
    let token: string | undefined;

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    } else if (req.cookies && req.cookies['sb-access-token']) {
      token = req.cookies['sb-access-token'];
    }

    if (!token) {
      return next(); // Continue without auth
    }

    // Try to verify token, but don't fail if invalid
    try {
      const user = await authService.verifyToken(token);

      if (user) {
        req.user = {
          id: user.id,
          email: user.email,
          role: user.role
        };
      }
    } catch (error) {
      // Silently ignore token verification errors
      console.debug('Optional auth token verification failed:', error);
    }

    next();
  } catch (error) {
    // Log error but don't fail the request
    console.error('Optional authentication error:', error);
    next();
  }
};

/**
 * Admin-only middleware
 * Requires authentication and admin role
 */
export const requireAdmin = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Fetch user role from database
    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', req.user.id)
      .single();

    if (error || !userData) {
      res.status(403).json({ error: 'Unable to verify user role' });
      return;
    }

    if (userData.role !== 'admin') {
      res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
      return;
    }

    // Update request with confirmed role
    req.user.role = userData.role;
    next();
  } catch (error: any) {
    console.error('Admin authorization error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
