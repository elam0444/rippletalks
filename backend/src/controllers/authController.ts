import { Request, Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';
import * as authService from '../services/authService';

/**
 * Sign in user - Validates credentials and returns session token
 */
export const signIn = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'Email and password are required.',
      });
      return;
    }

    const authData = await authService.signIn(email, password);

    if (!authData?.session) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Fetch user role and company from users table
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      res.status(500).json({ error: 'Failed to fetch user data' });
      return;
    }

    // Fetch company name if user has a company
    let companyName = null;
    if (userData.company_id) {
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', userData.company_id)
        .single();
      companyName = companyData?.name;
    }

    // Set the access token in a secure cookie
    res.cookie('sb-access-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    });

    // Optionally set refresh token in a secure cookie
    if (authData.session.refresh_token) {
      res.cookie('sb-refresh-token', authData.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
    }

    res.status(200).json({
      message: 'User signed in successfully.',
      accessToken: authData.session.access_token,
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userData.role,
        company: {
          id: userData.company_id,
          name: companyName,
        },
      },
    });
  } catch (err: any) {
    console.error('Sign in error:', err);
    res.status(400).json({
      error: err.message,
    });
  }
};

/**
 * Admin login - Validates credentials and returns session token (admin only)
 */
export const adminLogin = async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    // Sign in with Supabase Auth
    const authData = await authService.signIn(email, password);

    if (!authData?.session) {
      res.status(401).json({
        error: 'Invalid credentials',
      });
      return;
    }

    // Verify user is an admin
    const { data: userData, error: userError } = await supabaseAdmin
      .from('users')
      .select('role, company_id')
      .eq('id', authData.user.id)
      .single();

    if (userError || !userData) {
      res.status(500).json({ error: 'Failed to verify user role' });
      return;
    }

    if (userData.role !== 'admin') {
      res.status(403).json({ error: 'Access denied. Admin privileges required.' });
      return;
    }

    // Set the access token in a secure cookie
    res.cookie('sb-access-token', authData.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    });

    // Return session data
    res.json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: userData.role,
        companyId: userData.company_id,
      },
      session: {
        accessToken: authData.session.access_token,
        refreshToken: authData.session.refresh_token,
        expiresAt: authData.session.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Admin login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Refresh access token
 */
export const refreshToken = async (req: Request, res: Response): Promise<void> => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token is required' });
      return;
    }

    const data = await authService.refreshAccessToken(refreshToken);

    if (!data.session) {
      res.status(401).json({
        error: 'Invalid refresh token',
      });
      return;
    }

    // Update cookies with new tokens
    res.cookie('sb-access-token', data.session.access_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 1000, // 1 hour
      path: '/',
    });

    if (data.session.refresh_token) {
      res.cookie('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
        path: '/',
      });
    }

    res.json({
      message: 'Token refreshed successfully',
      session: {
        accessToken: data.session.access_token,
        refreshToken: data.session.refresh_token,
        expiresAt: data.session.expires_at,
      },
    });
  } catch (error: any) {
    console.error('Token refresh error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Logout - Invalidate session
 */
export const logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(400).json({ error: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);

    // Sign out with Supabase
    const { error } = await supabaseAdmin.auth.admin.signOut(token);

    if (error) {
      console.error('Logout error:', error);
      // Don't fail on logout errors - token might already be invalid
    }

    // Clear cookies
    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.clearCookie('sb-access-token', cookieOptions);
    res.clearCookie('sb-refresh-token', cookieOptions);

    res.json({ message: 'Logged out successfully' });
  } catch (error: any) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Sign out - Alternative logout endpoint
 */
export const signOut = async (_req: Request, res: Response): Promise<void> => {
  try {
    await authService.signOut();

    const cookieOptions = {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      path: '/',
    };

    res.clearCookie('sb-access-token', cookieOptions);
    res.clearCookie('sb-refresh-token', cookieOptions);

    res.status(200).json({
      message: 'User signed out successfully.',
    });
  } catch (err: any) {
    res.status(400).json({
      error: err.message,
    });
  }
};

/**
 * Get current user profile
 */
export const getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_id, created_at, updated_at')
      .eq('id', req.user.id)
      .single();

    if (error || !userData) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    // Fetch company name if user has a company
    let companyName = null;
    if (userData.company_id) {
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', userData.company_id)
        .single();
      companyName = companyData?.name;
    }

    res.json({
      user: {
        id: userData.id,
        email: userData.email,
        role: userData.role,
        company: {
          id: userData.company_id,
          name: companyName,
        },
        createdAt: userData.created_at,
        updatedAt: userData.updated_at,
      },
    });
  } catch (error: any) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get current user info (me endpoint)
 */
export const me = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }

    const { data: userData, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, company_id')
      .eq('id', req.user.id)
      .single();

    if (error || !userData) {
      res.status(404).json({ error: 'User profile not found' });
      return;
    }

    // Fetch company name if user has a company
    let companyName = null;
    if (userData.company_id) {
      const { data: companyData } = await supabaseAdmin
        .from('companies')
        .select('name')
        .eq('id', userData.company_id)
        .single();
      companyName = companyData?.name;
    }

    res.status(200).json({
      id: userData.id,
      email: userData.email,
      role: userData.role,
      company: {
        id: userData.company_id,
        name: companyName,
      },
    });
  } catch (err: any) {
    res.status(401).json({
      error: err.message,
    });
  }
};

/**
 * Check session validity
 */
export const checkSession = async (_req: Request, res: Response): Promise<void> => {
  try {
    const session = await authService.checkSession();
    res.status(200).json({
      message: 'Session is valid',
      session,
    });
  } catch (err: any) {
    res.status(401).json({
      error: err.message,
    });
  }
};
