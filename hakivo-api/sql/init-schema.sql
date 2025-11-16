-- ============================================================================
-- Hakivo API Database Schema
-- ============================================================================
-- This schema includes user management tables and comprehensive Congress.gov
-- legislative data tables. Congressional data is populated via external
-- ingestion script.
-- ============================================================================

-- ============================================================================
-- USER & APPLICATION TABLES
-- ============================================================================

-- User Management
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT,
  first_name TEXT,
  last_name TEXT,
  zip_code TEXT,
  city TEXT,
  congressional_district TEXT,
  email_verified INTEGER DEFAULT 0,
  onboarding_completed INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,
  daily_briefing INTEGER DEFAULT 1,
  briefing_time TEXT,
  briefing_days TEXT,
  weekly_briefing INTEGER DEFAULT 0,
  weekly_briefing_day TEXT DEFAULT 'Monday',
  playback_speed REAL DEFAULT 1.0,
  autoplay INTEGER DEFAULT 1,
  email_notifications INTEGER DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Bill Tracking (using bill_tracking for consistency with services)
CREATE TABLE IF NOT EXISTS bill_tracking (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Audio Briefings
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
  article TEXT,
  article_word_count INTEGER,
  listened INTEGER DEFAULT 0,
  progress INTEGER DEFAULT 0,
  completed INTEGER DEFAULT 0,
  plays INTEGER DEFAULT 0,
  article_read INTEGER DEFAULT 0,
  article_read_time INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RAG Chat System
CREATE TABLE IF NOT EXISTS chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- System Tables
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

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used INTEGER DEFAULT 0,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS district_cache (
  zip_code TEXT PRIMARY KEY,
  congressional_district TEXT NOT NULL,
  city TEXT,
  cached_at INTEGER NOT NULL
);

-- ============================================================================
-- CONGRESS.GOV LEGISLATIVE DATA TABLES
-- ============================================================================
-- Note: These tables are populated by external ingestion script

-- Core Congressional Tables
CREATE TABLE IF NOT EXISTS congresses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS members (
  bioguide_id TEXT PRIMARY KEY,
  first_name TEXT,
  middle_name TEXT,
  last_name TEXT,
  official_full_name TEXT,
  party TEXT,
  state TEXT,
  district INTEGER,
  senate_class INTEGER,
  senate_rank TEXT,
  url TEXT,
  birthday TEXT,
  gender TEXT,
  birth_year INTEGER,
  death_year INTEGER,
  current_member INTEGER DEFAULT 0,

  -- Contact Information
  phone TEXT,
  fax TEXT,
  contact_form TEXT,
  office TEXT,
  rss_url TEXT,

  -- Additional IDs
  thomas_id TEXT,
  govtrack_id INTEGER,
  opensecrets_id TEXT,
  fec_ids TEXT,
  cspan_id INTEGER,
  wikipedia_id TEXT,

  -- Social Media
  twitter TEXT,
  twitter_id TEXT,
  facebook TEXT,
  facebook_id TEXT,
  youtube TEXT,
  youtube_id TEXT,
  instagram TEXT,
  instagram_id TEXT,
  mastodon TEXT,

  -- Leadership
  leadership_title TEXT,
  leadership_start_date TEXT
);

CREATE TABLE IF NOT EXISTS bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  title TEXT,
  origin_chamber TEXT,
  introduced_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  sponsor_bioguide_id TEXT,
  text TEXT,
  update_date INTEGER,
  UNIQUE(congress_id, bill_type, bill_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id),
  FOREIGN KEY (sponsor_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE TABLE IF NOT EXISTS amendments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL,
  amendment_type TEXT NOT NULL,
  amendment_number INTEGER NOT NULL,
  bill_id INTEGER,
  sponsor_bioguide_id TEXT,
  purpose TEXT,
  description TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  update_date INTEGER,
  UNIQUE(congress_id, amendment_type, amendment_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (sponsor_bioguide_id) REFERENCES members(bioguide_id)
);

-- Committee Tables
CREATE TABLE IF NOT EXISTS committees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chamber TEXT,
  committee_code TEXT,
  url TEXT
);

CREATE TABLE IF NOT EXISTS committee_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  committee_id TEXT,
  congress_id INTEGER,
  meeting_date TEXT,
  meeting_time TEXT,
  location TEXT,
  title TEXT,
  FOREIGN KEY (committee_id) REFERENCES committees(id),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

CREATE TABLE IF NOT EXISTS committee_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER,
  report_type TEXT,
  report_number INTEGER,
  title TEXT,
  committee_id TEXT,
  update_date INTEGER,
  UNIQUE(congress_id, report_type, report_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id),
  FOREIGN KEY (committee_id) REFERENCES committees(id)
);

CREATE TABLE IF NOT EXISTS committee_prints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER,
  chamber TEXT,
  print_number INTEGER,
  title TEXT,
  committee_id TEXT,
  update_date INTEGER,
  FOREIGN KEY (congress_id) REFERENCES congresses(id),
  FOREIGN KEY (committee_id) REFERENCES committees(id)
);

-- Voting and Actions Tables
CREATE TABLE IF NOT EXISTS bill_actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER,
  action_date TEXT NOT NULL,
  action_text TEXT NOT NULL,
  action_time TEXT,
  action_type TEXT,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL,
  session INTEGER NOT NULL,
  vote_number INTEGER NOT NULL,
  bill_id INTEGER,
  vote_date TEXT,
  vote_question TEXT,
  vote_result TEXT,
  UNIQUE(congress_id, session, vote_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id),
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS vote_members (
  vote_id INTEGER NOT NULL,
  member_bioguide_id TEXT NOT NULL,
  vote_cast TEXT NOT NULL,
  PRIMARY KEY (vote_id, member_bioguide_id),
  FOREIGN KEY (vote_id) REFERENCES votes(id),
  FOREIGN KEY (member_bioguide_id) REFERENCES members(bioguide_id)
);

-- Other Legislative Tables
CREATE TABLE IF NOT EXISTS nominations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER,
  nomination_number INTEGER,
  nominee_name TEXT,
  position TEXT,
  received_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  UNIQUE(congress_id, nomination_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

CREATE TABLE IF NOT EXISTS treaties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER,
  treaty_number INTEGER,
  title TEXT,
  received_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  UNIQUE(congress_id, treaty_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

CREATE TABLE IF NOT EXISTS communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER,
  chamber TEXT NOT NULL,
  communication_type TEXT,
  communication_number INTEGER,
  title TEXT,
  received_date TEXT,
  UNIQUE(congress_id, chamber, communication_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

-- Bill Relationship Tables
CREATE TABLE IF NOT EXISTS bill_committees (
  bill_id INTEGER NOT NULL,
  committee_id TEXT NOT NULL,
  PRIMARY KEY (bill_id, committee_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (committee_id) REFERENCES committees(id)
);

CREATE TABLE IF NOT EXISTS bill_cosponsors (
  bill_id INTEGER NOT NULL,
  member_bioguide_id TEXT NOT NULL,
  cosponsor_date TEXT,
  PRIMARY KEY (bill_id, member_bioguide_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (member_bioguide_id) REFERENCES members(bioguide_id)
);

CREATE TABLE IF NOT EXISTS related_bills (
  bill_id INTEGER NOT NULL,
  related_bill_id INTEGER NOT NULL,
  relationship_type TEXT,
  PRIMARY KEY (bill_id, related_bill_id),
  CHECK (bill_id != related_bill_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (related_bill_id) REFERENCES bills(id)
);

CREATE TABLE IF NOT EXISTS subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS bill_subjects (
  bill_id INTEGER NOT NULL,
  subject_id INTEGER NOT NULL,
  PRIMARY KEY (bill_id, subject_id),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (subject_id) REFERENCES subjects(id)
);

CREATE TABLE IF NOT EXISTS laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER,
  congress_id INTEGER NOT NULL,
  law_type TEXT NOT NULL,
  law_number INTEGER NOT NULL,
  UNIQUE(congress_id, law_type, law_number),
  FOREIGN KEY (bill_id) REFERENCES bills(id),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

-- Congressional Record Tables
CREATE TABLE IF NOT EXISTS congressional_record_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_number INTEGER NOT NULL,
  issue_number INTEGER NOT NULL,
  issue_date TEXT,
  congress_id INTEGER,
  session_number INTEGER,
  UNIQUE(volume_number, issue_number),
  FOREIGN KEY (congress_id) REFERENCES congresses(id)
);

CREATE TABLE IF NOT EXISTS congressional_record_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_issue_id INTEGER NOT NULL,
  title TEXT,
  article_type TEXT,
  start_page TEXT,
  end_page TEXT,
  content TEXT,
  FOREIGN KEY (record_issue_id) REFERENCES congressional_record_issues(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- User & Application Table Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_bill_tracking_user_id ON bill_tracking(user_id);
CREATE INDEX IF NOT EXISTS idx_bill_tracking_bill_id ON bill_tracking(bill_id);
CREATE INDEX IF NOT EXISTS idx_briefs_user_id ON briefs(user_id);
CREATE INDEX IF NOT EXISTS idx_briefs_date ON briefs(date);
CREATE INDEX IF NOT EXISTS idx_briefs_status ON briefs(status);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_sessions_bill_id ON chat_sessions(bill_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_service ON api_usage_logs(service);
CREATE INDEX IF NOT EXISTS idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Congress.gov Data Indexes
CREATE INDEX IF NOT EXISTS idx_bills_congress ON bills(congress_id);
CREATE INDEX IF NOT EXISTS idx_bills_sponsor ON bills(sponsor_bioguide_id);
CREATE INDEX IF NOT EXISTS idx_bills_type ON bills(bill_type);
CREATE INDEX IF NOT EXISTS idx_bills_latest_action ON bills(latest_action_date);
CREATE INDEX IF NOT EXISTS idx_amendments_congress ON amendments(congress_id);
CREATE INDEX IF NOT EXISTS idx_amendments_bill ON amendments(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_bill ON bill_actions(bill_id);
CREATE INDEX IF NOT EXISTS idx_bill_actions_date ON bill_actions(action_date);
CREATE INDEX IF NOT EXISTS idx_votes_congress ON votes(congress_id);
CREATE INDEX IF NOT EXISTS idx_votes_bill ON votes(bill_id);
CREATE INDEX IF NOT EXISTS idx_vote_members_member ON vote_members(member_bioguide_id);
CREATE INDEX IF NOT EXISTS idx_bill_cosponsors_member ON bill_cosponsors(member_bioguide_id);
CREATE INDEX IF NOT EXISTS idx_bill_committees_committee ON bill_committees(committee_id);
CREATE INDEX IF NOT EXISTS idx_bill_subjects_subject ON bill_subjects(subject_id);
CREATE INDEX IF NOT EXISTS idx_congressional_record_volume ON congressional_record_issues(volume_number);
CREATE INDEX IF NOT EXISTS idx_congressional_record_date ON congressional_record_issues(issue_date);
CREATE INDEX IF NOT EXISTS idx_congressional_record_articles_issue ON congressional_record_articles(record_issue_id);
CREATE INDEX IF NOT EXISTS idx_members_state ON members(state);
CREATE INDEX IF NOT EXISTS idx_members_party ON members(party);
CREATE INDEX IF NOT EXISTS idx_members_current ON members(current_member);
