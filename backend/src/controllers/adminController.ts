import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthenticatedRequest } from '../middleware/auth';

/**
 * Get all users in admin's company
 */
export const getCompanyUsers = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Get all users in the company
    const { data: users, error } = await supabaseAdmin
      .from('users')
      .select('id, email, role, created_at, updated_at')
      .eq('company_id', adminData.company_id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching users:', error);
      return res.status(500).json({ error: 'Failed to fetch users' });
    }

    res.json({ users });
  } catch (error) {
    console.error('Error in getCompanyUsers:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Create a new user in admin's company
 */
export const createUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { email, password, role = 'user' } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Create user in Supabase Auth
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError || !authData.user) {
      console.error('Error creating user:', authError);
      return res.status(500).json({
        error: 'Failed to create user',
        details: authError?.message
      });
    }

    // Add user to company in users table
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: authData.user.email,
        company_id: adminData.company_id,
        role: role
      });

    if (insertError) {
      // Rollback - delete auth user if database insert fails
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
      console.error('Error inserting user into database:', insertError);
      return res.status(500).json({ error: 'Failed to create user in database' });
    }

    res.status(201).json({
      user: {
        id: authData.user.id,
        email: authData.user.email,
        role: role,
        companyId: adminData.company_id
      }
    });
  } catch (error) {
    console.error('Error in createUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Update user role
 */
export const updateUserRole = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;
    const { role } = req.body;

    if (!role || !['admin', 'user'].includes(role)) {
      return res.status(400).json({ error: 'Valid role is required (admin or user)' });
    }

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Verify target user is in same company
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.company_id !== adminData.company_id) {
      return res.status(403).json({ error: 'Cannot modify users from other companies' });
    }

    // Update role
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ role })
      .eq('id', userId);

    if (updateError) {
      console.error('Error updating user role:', updateError);
      return res.status(500).json({ error: 'Failed to update user role' });
    }

    res.json({ message: 'User role updated successfully' });
  } catch (error) {
    console.error('Error in updateUserRole:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Delete a user
 */
export const deleteUser = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { userId } = req.params;

    // Prevent self-deletion
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete your own account' });
    }

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Verify target user is in same company
    const { data: targetUser, error: targetError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', userId)
      .single();

    if (targetError || !targetUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (targetUser.company_id !== adminData.company_id) {
      return res.status(403).json({ error: 'Cannot delete users from other companies' });
    }

    // Delete from auth
    const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);

    if (authError) {
      console.error('Error deleting user from auth:', authError);
      return res.status(500).json({ error: 'Failed to delete user' });
    }

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    console.error('Error in deleteUser:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get dashboard analytics
 */
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Get user count
    const { count: userCount, error: userCountError } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', adminData.company_id);

    // Get document count
    const { count: documentCount, error: docCountError } = await supabaseAdmin
      .from('documents')
      .select('*', { count: 'exact', head: true })
      .eq('company_id', adminData.company_id);

    // Get share link count
    const { data: shareLinks, error: linkError } = await supabaseAdmin
      .from('share_links')
      .select('link_id, document_id')
      .in('document_id',
        supabaseAdmin
          .from('documents')
          .select('id')
          .eq('company_id', adminData.company_id)
      );

    // Get total views
    const { data: totalViews, error: viewsError } = await supabaseAdmin
      .from('share_link_logs')
      .select('link_id')
      .in('link_id', shareLinks?.map(sl => sl.link_id) || []);

    if (userCountError || docCountError || linkError || viewsError) {
      console.error('Error fetching stats:', { userCountError, docCountError, linkError, viewsError });
      return res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }

    res.json({
      stats: {
        totalUsers: userCount || 0,
        totalDocuments: documentCount || 0,
        totalShareLinks: shareLinks?.length || 0,
        totalViews: totalViews?.length || 0
      }
    });
  } catch (error) {
    console.error('Error in getDashboardStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * Get recent activity logs for the company
 */
export const getActivityLogs = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const limit = parseInt(req.query.limit as string) || 50;
    const offset = parseInt(req.query.offset as string) || 0;

    // Get admin's company ID
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('company_id')
      .eq('id', req.user.id)
      .single();

    if (adminError || !adminData) {
      return res.status(500).json({ error: 'Failed to get admin info' });
    }

    // Get activity logs
    const { data: logs, error } = await supabaseAdmin
      .from('activity_logs')
      .select('*')
      .eq('company_id', adminData.company_id)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('Error fetching activity logs:', error);
      return res.status(500).json({ error: 'Failed to fetch activity logs' });
    }

    res.json({ logs });
  } catch (error) {
    console.error('Error in getActivityLogs:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
