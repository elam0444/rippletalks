-- ============================================
-- Row Level Security (RLS) Policies
-- For secure multi-tenant data access
-- ============================================

-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_link_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- Users Table Policies
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view own profile"
  ON users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON users FOR UPDATE
  USING (auth.uid() = id);

-- Admins can view all users in their company
CREATE POLICY "Admins can view company users"
  ON users FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- Companies Table Policies
-- ============================================

-- Users can view their own company
CREATE POLICY "Users can view own company"
  ON companies FOR SELECT
  USING (
    id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Admins can update their company
CREATE POLICY "Admins can update company"
  ON companies FOR UPDATE
  USING (
    id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- Documents Table Policies
-- ============================================

-- Users can view their own documents
CREATE POLICY "Users can view own documents"
  ON documents FOR SELECT
  USING (owner_id = auth.uid());

-- Users can view company documents
CREATE POLICY "Users can view company documents"
  ON documents FOR SELECT
  USING (
    company_id IN (SELECT company_id FROM users WHERE id = auth.uid())
  );

-- Users can view public documents
CREATE POLICY "Anyone can view public documents"
  ON documents FOR SELECT
  USING (is_public = true);

-- Users can create documents
CREATE POLICY "Users can create documents"
  ON documents FOR INSERT
  WITH CHECK (owner_id = auth.uid());

-- Users can update their own documents
CREATE POLICY "Users can update own documents"
  ON documents FOR UPDATE
  USING (owner_id = auth.uid());

-- Users can delete their own documents
CREATE POLICY "Users can delete own documents"
  ON documents FOR DELETE
  USING (owner_id = auth.uid());

-- ============================================
-- Share Links Table Policies
-- ============================================

-- Users can view share links for their documents
CREATE POLICY "Users can view own document links"
  ON share_links FOR SELECT
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

-- Users can create share links for their documents
CREATE POLICY "Users can create links for own documents"
  ON share_links FOR INSERT
  WITH CHECK (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

-- Users can update share links for their documents
CREATE POLICY "Users can update own document links"
  ON share_links FOR UPDATE
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

-- Users can delete share links for their documents
CREATE POLICY "Users can delete own document links"
  ON share_links FOR DELETE
  USING (
    document_id IN (SELECT id FROM documents WHERE owner_id = auth.uid())
  );

-- ============================================
-- Share Link Logs Table Policies
-- ============================================

-- Document owners can view logs for their share links
CREATE POLICY "Document owners can view link logs"
  ON share_link_logs FOR SELECT
  USING (
    link_id IN (
      SELECT sl.link_id
      FROM share_links sl
      JOIN documents d ON d.id = sl.document_id
      WHERE d.owner_id = auth.uid()
    )
  );

-- Allow anonymous inserts for tracking (public links)
CREATE POLICY "Anyone can create link logs"
  ON share_link_logs FOR INSERT
  WITH CHECK (true);

-- ============================================
-- Activity Logs Table Policies
-- ============================================

-- Users can view their own activity logs
CREATE POLICY "Users can view own activity"
  ON activity_logs FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view company activity logs
CREATE POLICY "Admins can view company activity"
  ON activity_logs FOR SELECT
  USING (
    company_id IN (
      SELECT company_id FROM users WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Allow system to create activity logs
CREATE POLICY "System can create activity logs"
  ON activity_logs FOR INSERT
  WITH CHECK (true);
