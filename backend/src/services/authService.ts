import { SupabaseClient, Session } from '@supabase/supabase-js';
import { supabaseAdmin } from '../config/supabase';

/**
 * Sign in user with email and password
 */
export const signIn = async (email: string, password: string, supabase: SupabaseClient = supabaseAdmin) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw new Error(error.message);
    return data;
  } catch (err) {
    throw err;
  }
};

/**
 * Sign out current user
 */
export const signOut = async (supabase: SupabaseClient = supabaseAdmin): Promise<{ message: string }> => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    return { message: 'User signed out successfully' };
  } catch (err) {
    throw err;
  }
};

/**
 * Check if current session is valid
 */
export const checkSession = async (supabase: SupabaseClient = supabaseAdmin): Promise<Session> => {
  try {
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    if (error) throw new Error(error.message);
    if (!session) {
      await signOut(supabase);
      throw new Error('No active session found. User signed out.');
    }
    return session;
  } catch (err) {
    throw err;
  }
};

/**
 * Verify user token and get user data
 */
export const verifyToken = async (token: string, supabase: SupabaseClient = supabaseAdmin) => {
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      throw new Error(error?.message || 'Invalid token');
    }

    return user;
  } catch (err) {
    throw err;
  }
};

/**
 * Refresh access token
 */
export const refreshAccessToken = async (refreshToken: string, supabase: SupabaseClient = supabaseAdmin) => {
  try {
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      throw new Error(error?.message || 'Failed to refresh token');
    }

    return data;
  } catch (err) {
    throw err;
  }
};
