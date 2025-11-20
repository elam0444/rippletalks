// ============================================
// Database Entity Types
// ============================================

export interface User {
  id: string;
  email: string;
  password_hash: string;
  first_name: string | null;
  last_name: string | null;
  company_id: string | null;
  role: 'admin' | 'user' | 'viewer';
  is_active: boolean;
  email_verified: boolean;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Company {
  id: string;
  name: string;
  logo_url: string | null;
  owner_user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  title: string;
  description: string | null;
  file_url: string | null;
  file_type: string | null;
  file_size: number | null;
  owner_id: string;
  company_id: string | null;
  folder_path: string;
  tags: string[];
  is_public: boolean;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface ShareLink {
  id: string;
  document_id: string;
  link_id: string;
  created_by: string | null;
  expires_at: string | null;
  password_hash: string | null;
  allow_download: boolean;
  require_email: boolean;
  max_views: number | null;
  created_at: string;
  updated_at: string;
}

export interface ShareLinkLog {
  id: string;
  link_id: string;
  timestamp: string;
  ip_address: string | null;
  user_agent: string | null;
  location: Record<string, any> | null;
  viewer_email: string | null;
  session_duration: number | null;
}

export interface ActivityLog {
  id: string;
  user_id: string | null;
  company_id: string | null;
  action: string;
  resource_type: string | null;
  resource_id: string | null;
  metadata: Record<string, any>;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ============================================
// View Types
// ============================================

export interface ShareLinkStats {
  id: string;
  document_id: string;
  link_id: string;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
  view_count: number;
  last_opened: string | null;
  unique_viewers: number;
}

export interface DocumentAnalytics {
  id: string;
  title: string;
  owner_id: string;
  company_id: string | null;
  created_at: string;
  total_shares: number;
  total_views: number;
  last_viewed: string | null;
}

// ============================================
// Request/Response DTOs
// ============================================

export interface CreateLinkRequest {
  documentId: string;
  expiresAt?: string;
  password?: string;
  allowDownload?: boolean;
  requireEmail?: boolean;
  maxViews?: number;
}

export interface LogViewRequest {
  ipAddress?: string;
  userAgent?: string;
  location?: Record<string, any>;
  viewerEmail?: string;
  sessionDuration?: number;
}

export interface CreateUserRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  companyId?: string;
}

export interface CreateCompanyRequest {
  name: string;
  logo_url?: string;
}

export interface CreateDocumentRequest {
  title: string;
  description?: string;
  fileUrl?: string;
  fileType?: string;
  fileSize?: number;
  folderPath?: string;
  tags?: string[];
  isPublic?: boolean;
}
