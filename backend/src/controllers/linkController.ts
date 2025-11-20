import { Response } from 'express';
import { nanoid } from 'nanoid';
import { supabase, supabaseAdmin } from '../config/supabase';
import { CreateLinkRequest, LogViewRequest } from '../types';
import { AuthenticatedRequest } from '../middleware/auth';

export const createShareLink = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const { documentId, expiresAt }: CreateLinkRequest = req.body;

    if (!documentId) {
      return res.status(400).json({ error: 'documentId is required' });
    }

    // Generate a unique link ID (12 characters, URL-safe)
    const linkId = nanoid(12);

    // Insert the share link into the database
    const { data, error } = await supabaseAdmin
      .from('share_links')
      .insert({
        document_id: documentId,
        link_id: linkId,
        created_by: req.user.id,
        expires_at: expiresAt || null
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating share link:', error);
      return res.status(500).json({ error: 'Failed to create share link' });
    }

    res.status(201).json({
      linkId: data.link_id,
      documentId: data.document_id,
      expiresAt: data.expires_at,
      createdBy: data.created_by,
      createdAt: data.created_at
    });
  } catch (error) {
    console.error('Error in createShareLink:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDocumentByLink = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { linkId } = req.params;

    if (!linkId) {
      return res.status(400).json({ error: 'linkId is required' });
    }

    // Get the share link (public access - no auth required)
    const { data: shareLink, error } = await supabase
      .from('share_links')
      .select('*')
      .eq('link_id', linkId)
      .single();

    if (error || !shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Check if the link has expired
    if (shareLink.expires_at && new Date(shareLink.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Share link has expired' });
    }

    // In a real implementation, you would fetch the actual document here
    // For now, we'll return the document_id
    res.json({
      documentId: shareLink.document_id,
      linkId: shareLink.link_id,
      expiresAt: shareLink.expires_at,
      createdAt: shareLink.created_at
    });
  } catch (error) {
    console.error('Error in getDocumentByLink:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const logLinkView = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { linkId } = req.params;
    const { ipAddress, userAgent }: LogViewRequest = req.body;

    if (!linkId) {
      return res.status(400).json({ error: 'linkId is required' });
    }

    // Verify the link exists
    const { data: shareLink, error: linkError } = await supabase
      .from('share_links')
      .select('link_id')
      .eq('link_id', linkId)
      .single();

    if (linkError || !shareLink) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    // Extract IP and user agent from request if not provided
    const forwardedFor = req.headers['x-forwarded-for'];
    const clientIp = ipAddress ||
                     req.ip ||
                     (typeof forwardedFor === 'string' ? forwardedFor : forwardedFor?.[0]) ||
                     'unknown';
    const clientUserAgent = userAgent || req.headers['user-agent'] || 'unknown';

    // Log the view
    const { data, error } = await supabase
      .from('share_link_logs')
      .insert({
        link_id: linkId,
        ip_address: clientIp,
        user_agent: clientUserAgent
      })
      .select()
      .single();

    if (error) {
      console.error('Error logging link view:', error);
      return res.status(500).json({ error: 'Failed to log view' });
    }

    res.status(201).json({
      logged: true,
      timestamp: data.timestamp
    });
  } catch (error) {
    console.error('Error in logLinkView:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getLinkStats = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { linkId } = req.params;

    if (!linkId) {
      return res.status(400).json({ error: 'linkId is required' });
    }

    // Get stats from the view
    const { data, error } = await supabase
      .from('share_link_stats')
      .select('*')
      .eq('link_id', linkId)
      .single();

    if (error || !data) {
      return res.status(404).json({ error: 'Share link not found' });
    }

    res.json({
      linkId: data.link_id,
      documentId: data.document_id,
      viewCount: data.view_count,
      lastOpened: data.last_opened,
      expiresAt: data.expires_at,
      createdAt: data.created_at
    });
  } catch (error) {
    console.error('Error in getLinkStats:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
