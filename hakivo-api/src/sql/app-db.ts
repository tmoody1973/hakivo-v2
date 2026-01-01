/**
 * Database schema for app-db
 * This file contains all CREATE TABLE statements for the application database
 */

export const schema = `
-- Users table
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  zip_code TEXT,
  city TEXT,
  congressional_district TEXT,
  email_verified BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- User preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,
  briefing_time TEXT,
  briefing_days TEXT,
  playback_speed REAL DEFAULT 1.0,
  autoplay BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  state TEXT,
  district INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Tracked bills table
CREATE TABLE IF NOT EXISTS tracked_bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  title TEXT NOT NULL,
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Briefs table
CREATE TABLE IF NOT EXISTS briefs (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  date INTEGER NOT NULL,
  status TEXT NOT NULL,
  script TEXT,
  audio_url TEXT,
  duration INTEGER,
  file_size INTEGER,
  listened BOOLEAN DEFAULT FALSE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  plays INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat sessions table
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Chat messages table
CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- C1 Chat threads table (general AI assistant, not bill-specific)
CREATE TABLE IF NOT EXISTS c1_chat_threads (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- C1 Chat messages table
CREATE TABLE IF NOT EXISTS c1_chat_messages (
  id TEXT PRIMARY KEY,
  thread_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (thread_id) REFERENCES c1_chat_threads(id) ON DELETE CASCADE
);

-- Bill cache table
CREATE TABLE IF NOT EXISTS bill_cache (
  bill_id TEXT PRIMARY KEY,
  data TEXT NOT NULL,
  cached_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- API usage logs table
CREATE TABLE IF NOT EXISTS api_usage_logs (
  id TEXT PRIMARY KEY,
  service TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  tokens_used INTEGER,
  cost_usd REAL,
  response_time INTEGER,
  status INTEGER,
  error TEXT,
  created_at INTEGER NOT NULL
);

-- Refresh tokens table
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Password reset tokens table
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email verification tokens table
CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

-- Shared threads table (public share links for C1 conversations)
CREATE TABLE IF NOT EXISTS shared_threads (
  token TEXT PRIMARY KEY,
  thread_id TEXT,
  user_id TEXT,
  title TEXT NOT NULL,
  messages TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- District cache table
CREATE TABLE IF NOT EXISTS district_cache (
  zip_code TEXT PRIMARY KEY,
  congressional_district TEXT NOT NULL,
  city TEXT,
  cached_at INTEGER NOT NULL
);

-- Federal Register Documents table (main storage for all federal documents)
CREATE TABLE IF NOT EXISTS federal_documents (
  id TEXT PRIMARY KEY,
  document_number TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL,
  subtype TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  action TEXT,
  dates TEXT,
  effective_on TEXT,
  publication_date TEXT NOT NULL,
  agencies TEXT NOT NULL,
  agency_names TEXT NOT NULL,
  topics TEXT,
  significant INTEGER DEFAULT 0,
  cfr_references TEXT,
  docket_ids TEXT,
  html_url TEXT NOT NULL,
  pdf_url TEXT,
  full_text_xml_url TEXT,
  raw_text_url TEXT,
  page_length INTEGER DEFAULT 0,
  comments_close_on TEXT,
  comment_url TEXT,
  start_page INTEGER,
  end_page INTEGER,
  synced_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- Executive Orders table (detailed EO tracking with presidential info)
CREATE TABLE IF NOT EXISTS executive_orders (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  executive_order_number TEXT UNIQUE NOT NULL,
  president_name TEXT NOT NULL,
  president_identifier TEXT NOT NULL,
  signing_date TEXT,
  title TEXT NOT NULL,
  abstract TEXT,
  full_text TEXT,
  implementation_status TEXT DEFAULT 'active',
  implementation_notes TEXT,
  revoked_by TEXT,
  revokes TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES federal_documents(id) ON DELETE CASCADE
);

-- User Document Interests table (personalization and tracking)
CREATE TABLE IF NOT EXISTS user_federal_interests (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  document_id TEXT NOT NULL,
  interest_type TEXT NOT NULL,
  tracked_at INTEGER NOT NULL,
  notifications_enabled INTEGER DEFAULT 1,
  notes TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES federal_documents(id) ON DELETE CASCADE
);

-- Public Comment Opportunities table (track open comment periods)
CREATE TABLE IF NOT EXISTS comment_opportunities (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL,
  document_number TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT NOT NULL,
  comment_url TEXT,
  opens_on TEXT NOT NULL,
  closes_on TEXT NOT NULL,
  days_remaining INTEGER,
  total_comments INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  synced_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (document_id) REFERENCES federal_documents(id) ON DELETE CASCADE
);

-- User Comments table (track user-submitted comments)
CREATE TABLE IF NOT EXISTS user_comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  opportunity_id TEXT NOT NULL,
  comment_text TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  submitted_at INTEGER,
  confirmation_number TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (opportunity_id) REFERENCES comment_opportunities(id) ON DELETE CASCADE
);

-- Federal Agencies table (cache of agencies for filtering/display)
CREATE TABLE IF NOT EXISTS federal_agencies (
  id INTEGER PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  short_name TEXT,
  description TEXT,
  parent_id INTEGER,
  logo_url TEXT,
  recent_articles_url TEXT,
  synced_at INTEGER NOT NULL
);

-- User Agency Follows table (agencies user wants to track)
CREATE TABLE IF NOT EXISTS user_agency_follows (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  agency_id INTEGER NOT NULL,
  followed_at INTEGER NOT NULL,
  notifications_enabled INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (agency_id) REFERENCES federal_agencies(id) ON DELETE CASCADE
);

-- Federal Notifications table (federal-specific notifications)
CREATE TABLE IF NOT EXISTS federal_notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  document_id TEXT,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  priority TEXT DEFAULT 'normal',
  federal_data TEXT,
  action_url TEXT,
  read INTEGER DEFAULT 0,
  auto_dismiss_at INTEGER,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (document_id) REFERENCES federal_documents(id) ON DELETE SET NULL
);

-- Federal Sync Log table (track sync job history)
CREATE TABLE IF NOT EXISTS federal_sync_log (
  id TEXT PRIMARY KEY,
  sync_type TEXT NOT NULL,
  documents_fetched INTEGER DEFAULT 0,
  documents_stored INTEGER DEFAULT 0,
  notifications_created INTEGER DEFAULT 0,
  status TEXT NOT NULL,
  error_message TEXT,
  started_at INTEGER NOT NULL,
  completed_at INTEGER
);

-- Indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_tracked_bills_user_id ON tracked_bills(user_id);
CREATE INDEX IF NOT EXISTS idx_tracked_bills_bill_id ON tracked_bills(bill_id);
CREATE INDEX IF NOT EXISTS idx_briefs_user_id ON briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_date ON briefs(date);
CREATE INDEX IF NOT EXISTS idx_briefs_status ON briefs(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_bill_id ON chat_sessions(bill_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_c1_chat_threads_user_id ON c1_chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_c1_chat_threads_updated_at ON c1_chat_threads(updated_at);
CREATE INDEX IF NOT EXISTS idx_c1_chat_messages_thread_id ON c1_chat_messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_bill_cache_expires_at ON bill_cache(expires_at);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_service ON api_usage_logs(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_shared_threads_expires_at ON shared_threads(expires_at);

-- Federal Register indexes
CREATE INDEX IF NOT EXISTS idx_federal_documents_document_number ON federal_documents(document_number);
CREATE INDEX IF NOT EXISTS idx_federal_documents_type ON federal_documents(type);
CREATE INDEX IF NOT EXISTS idx_federal_documents_publication_date ON federal_documents(publication_date);
CREATE INDEX IF NOT EXISTS idx_federal_documents_significant ON federal_documents(significant);
CREATE INDEX IF NOT EXISTS idx_federal_documents_synced_at ON federal_documents(synced_at);
CREATE INDEX IF NOT EXISTS idx_executive_orders_eo_number ON executive_orders(executive_order_number);
CREATE INDEX IF NOT EXISTS idx_executive_orders_president ON executive_orders(president_identifier);
CREATE INDEX IF NOT EXISTS idx_executive_orders_status ON executive_orders(implementation_status);
CREATE INDEX IF NOT EXISTS idx_user_federal_interests_user_id ON user_federal_interests(user_id);
CREATE INDEX IF NOT EXISTS idx_user_federal_interests_document_id ON user_federal_interests(document_id);
CREATE INDEX IF NOT EXISTS idx_comment_opportunities_closes_on ON comment_opportunities(closes_on);
CREATE INDEX IF NOT EXISTS idx_comment_opportunities_status ON comment_opportunities(status);
CREATE INDEX IF NOT EXISTS idx_user_comments_user_id ON user_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_user_comments_status ON user_comments(status);
CREATE INDEX IF NOT EXISTS idx_federal_agencies_slug ON federal_agencies(slug);
CREATE INDEX IF NOT EXISTS idx_user_agency_follows_user_id ON user_agency_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_federal_notifications_user_id ON federal_notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_federal_notifications_type ON federal_notifications(notification_type);
CREATE INDEX IF NOT EXISTS idx_federal_notifications_read ON federal_notifications(read);
CREATE INDEX IF NOT EXISTS idx_federal_sync_log_status ON federal_sync_log(status);
CREATE INDEX IF NOT EXISTS idx_federal_sync_log_started_at ON federal_sync_log(started_at);
`;

export const tables = [
  'users',
  'user_preferences',
  'tracked_bills',
  'briefs',
  'chat_sessions',
  'chat_messages',
  'c1_chat_threads',
  'c1_chat_messages',
  'bill_cache',
  'api_usage_logs',
  'refresh_tokens',
  'password_reset_tokens',
  'email_verification_tokens',
  'rate_limits',
  'district_cache',
  'shared_threads',
  // Federal Register tables
  'federal_documents',
  'executive_orders',
  'user_federal_interests',
  'comment_opportunities',
  'user_comments',
  'federal_agencies',
  'user_agency_follows',
  'federal_notifications',
  'federal_sync_log'
];
