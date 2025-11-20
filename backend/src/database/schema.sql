-- ============================================
-- RippleTalk Database Schema (Supabase/PostgreSQL)
-- Converted from MongoDB Atlas design
-- ============================================

-- Users Table
-- Stores user account information
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  company_id UUID,
  role TEXT DEFAULT 'user', -- 'admin', 'user', 'viewer'
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  last_login TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Companies Table
-- Stores company/organization information
CREATE TABLE IF NOT EXISTS companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  logo_url TEXT,
  owner_user_id UUID NOT NULL, -- References auth.users in Supabase Auth
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Documents Table
-- Stores document metadata and content references
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  file_url TEXT, -- URL to file in storage (e.g., Supabase Storage)
  file_type TEXT, -- pdf, docx, pptx, etc.
  file_size INTEGER, -- in bytes
  owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  folder_path TEXT DEFAULT '/',
  tags TEXT[] DEFAULT '{}',
  is_public BOOLEAN DEFAULT false,
  version INTEGER DEFAULT 1,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Share Links Table
-- Stores shareable links for documents (DocSend-style)
CREATE TABLE IF NOT EXISTS share_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  link_id TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  expires_at TIMESTAMP WITH TIME ZONE,
  password_hash TEXT, -- Optional password protection
  allow_download BOOLEAN DEFAULT true,
  require_email BOOLEAN DEFAULT false,
  max_views INTEGER, -- Optional view limit
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Share Link Logs Table
-- Tracks all opens/views of shared links
CREATE TABLE IF NOT EXISTS share_link_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id TEXT NOT NULL REFERENCES share_links(link_id) ON DELETE CASCADE,
  timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  location JSONB, -- Store geolocation data
  viewer_email TEXT, -- If require_email is enabled
  session_duration INTEGER -- in seconds
);

-- Invited Viewers Table
-- Track people that admins invite/share links with
CREATE TABLE IF NOT EXISTS invited_viewers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  name TEXT,
  notes TEXT, -- Admin's notes about this viewer
  invited_by UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  tags TEXT[] DEFAULT '{}', -- e.g., ['VIP', 'Press', 'Sponsor']
  first_shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_shared_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  total_shares INTEGER DEFAULT 0, -- How many times admin shared with them
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(email, company_id) -- One viewer record per email per company
);

-- Activity Logs Table
-- General activity tracking for audit trail
CREATE TABLE IF NOT EXISTS activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  company_id UUID REFERENCES companies(id) ON DELETE SET NULL,
  action TEXT NOT NULL, -- 'document.created', 'link.shared', 'user.login', etc.
  resource_type TEXT, -- 'document', 'link', 'user', etc.
  resource_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================
-- Indexes for Performance
-- ============================================

-- Users indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_company_id ON users(company_id);

-- Companies indexes
CREATE INDEX IF NOT EXISTS idx_companies_owner_user_id ON companies(owner_user_id);

-- Documents indexes
CREATE INDEX IF NOT EXISTS idx_documents_owner_id ON documents(owner_id);
CREATE INDEX IF NOT EXISTS idx_documents_company_id ON documents(company_id);
CREATE INDEX IF NOT EXISTS idx_documents_created_at ON documents(created_at DESC);

-- Share Links indexes
CREATE INDEX IF NOT EXISTS idx_share_links_link_id ON share_links(link_id);
CREATE INDEX IF NOT EXISTS idx_share_links_document_id ON share_links(document_id);
CREATE INDEX IF NOT EXISTS idx_share_links_created_by ON share_links(created_by);

-- Share Link Logs indexes
CREATE INDEX IF NOT EXISTS idx_share_link_logs_link_id ON share_link_logs(link_id);
CREATE INDEX IF NOT EXISTS idx_share_link_logs_timestamp ON share_link_logs(timestamp DESC);

-- Activity Logs indexes
CREATE INDEX IF NOT EXISTS idx_activity_logs_user_id ON activity_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_company_id ON activity_logs(company_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action ON activity_logs(action);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created_at ON activity_logs(created_at DESC);

-- ============================================
-- Views for Analytics
-- ============================================

-- Share Link Statistics View
CREATE OR REPLACE VIEW share_link_stats AS
SELECT
  sl.id,
  sl.document_id,
  sl.link_id,
  sl.expires_at,
  sl.created_at,
  sl.created_by,
  COUNT(sll.id) as view_count,
  MAX(sll.timestamp) as last_opened,
  COUNT(DISTINCT sll.ip_address) as unique_viewers
FROM share_links sl
LEFT JOIN share_link_logs sll ON sl.link_id = sll.link_id
GROUP BY sl.id, sl.document_id, sl.link_id, sl.expires_at, sl.created_at, sl.created_by;

-- Document Analytics View
CREATE OR REPLACE VIEW document_analytics AS
SELECT
  d.id,
  d.title,
  d.owner_id,
  d.company_id,
  d.created_at,
  COUNT(DISTINCT sl.id) as total_shares,
  COALESCE(SUM(sls.view_count), 0) as total_views,
  MAX(sls.last_opened) as last_viewed
FROM documents d
LEFT JOIN share_links sl ON d.id = sl.document_id
LEFT JOIN share_link_stats sls ON sl.link_id = sls.link_id
GROUP BY d.id, d.title, d.owner_id, d.company_id, d.created_at;

-- ============================================
-- Triggers for updated_at timestamps
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_documents_updated_at BEFORE UPDATE ON documents
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_share_links_updated_at BEFORE UPDATE ON share_links
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
