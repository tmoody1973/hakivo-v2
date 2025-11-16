# Database Design

## Overview

The Hakivo database combines user management tables with comprehensive Congress.gov legislative data. Congressional data is **populated via external ingestion script** and queried directly from the cloud SQL database, eliminating the need for repeated Congress.gov API calls during normal operations.

## User & Application Tables

```sql
-- User Management
CREATE TABLE users (
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

CREATE TABLE user_preferences (
  user_id TEXT PRIMARY KEY,
  policy_interests TEXT NOT NULL,
  daily_briefing BOOLEAN DEFAULT TRUE,
  briefing_time TEXT,
  briefing_days TEXT,
  weekly_briefing BOOLEAN DEFAULT FALSE,
  weekly_briefing_day TEXT DEFAULT 'Monday',
  playback_speed REAL DEFAULT 1.0,
  autoplay BOOLEAN DEFAULT TRUE,
  email_notifications BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE tracked_bills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  congress INTEGER NOT NULL,
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  added_at INTEGER NOT NULL,
  views INTEGER DEFAULT 0,
  shares INTEGER DEFAULT 0,
  bookmarks INTEGER DEFAULT 0,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

-- Audio Briefings
CREATE TABLE briefs (
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
  listened BOOLEAN DEFAULT FALSE,
  progress INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  plays INTEGER DEFAULT 0,
  article_read BOOLEAN DEFAULT FALSE,
  article_read_time INTEGER,
  created_at INTEGER NOT NULL,
  completed_at INTEGER,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- RAG Chat System
CREATE TABLE chat_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  bill_id INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (bill_id) REFERENCES bills(id)
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- System Tables
CREATE TABLE api_usage_logs (
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

CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE password_reset_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE email_verification_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  used BOOLEAN DEFAULT FALSE,
  created_at INTEGER NOT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  reset_at INTEGER NOT NULL
);

CREATE TABLE district_cache (
  zip_code TEXT PRIMARY KEY,
  congressional_district TEXT NOT NULL,
  city TEXT,
  cached_at INTEGER NOT NULL
);
```

## Congress.gov Legislative Data Tables

**Note:** These tables are populated by external ingestion script that syncs data from Congress.gov API. All services query this local data instead of making API calls.

```sql
-- Core Congressional Tables
CREATE TABLE congresses (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  start_year INTEGER NOT NULL,
  end_year INTEGER NOT NULL
);

CREATE TABLE members (
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
  current_member BOOLEAN DEFAULT FALSE,

  -- Contact Information (from legislators-current.json terms array)
  phone TEXT,
  fax TEXT,
  contact_form TEXT,
  office TEXT,
  rss_url TEXT,

  -- Additional IDs (from legislators-current.json)
  thomas_id TEXT,
  govtrack_id INTEGER,
  opensecrets_id TEXT,
  fec_ids TEXT,
  cspan_id INTEGER,
  wikipedia_id TEXT,

  -- Social Media (from legislators-social-media.json)
  twitter TEXT,
  twitter_id TEXT,
  facebook TEXT,
  facebook_id TEXT,
  youtube TEXT,
  youtube_id TEXT,
  instagram TEXT,
  instagram_id TEXT,
  mastodon TEXT,

  -- Leadership (from legislators-current.json)
  leadership_title TEXT,
  leadership_start_date TEXT
);

CREATE TABLE bills (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL REFERENCES congresses(id),
  bill_type TEXT NOT NULL,
  bill_number INTEGER NOT NULL,
  title TEXT,
  origin_chamber TEXT,
  introduced_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  sponsor_bioguide_id TEXT REFERENCES members(bioguide_id),
  text TEXT,
  update_date INTEGER,
  UNIQUE(congress_id, bill_type, bill_number)
);

CREATE TABLE amendments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL REFERENCES congresses(id),
  amendment_type TEXT NOT NULL,
  amendment_number INTEGER NOT NULL,
  bill_id INTEGER REFERENCES bills(id),
  sponsor_bioguide_id TEXT REFERENCES members(bioguide_id),
  purpose TEXT,
  description TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  update_date INTEGER,
  UNIQUE(congress_id, amendment_type, amendment_number)
);

-- Committee Tables
CREATE TABLE committees (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  chamber TEXT,
  committee_code TEXT,
  url TEXT
);

CREATE TABLE committee_meetings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  committee_id TEXT REFERENCES committees(id),
  congress_id INTEGER REFERENCES congresses(id),
  meeting_date TEXT,
  meeting_time TEXT,
  location TEXT,
  title TEXT
);

CREATE TABLE committee_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER REFERENCES congresses(id),
  report_type TEXT,
  report_number INTEGER,
  title TEXT,
  committee_id TEXT REFERENCES committees(id),
  update_date INTEGER,
  UNIQUE(congress_id, report_type, report_number)
);

CREATE TABLE committee_prints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER REFERENCES congresses(id),
  chamber TEXT,
  print_number INTEGER,
  title TEXT,
  committee_id TEXT REFERENCES committees(id),
  update_date INTEGER
);

-- Voting and Actions Tables
CREATE TABLE actions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER REFERENCES bills(id),
  amendment_id INTEGER REFERENCES amendments(id),
  action_date TEXT NOT NULL,
  action_text TEXT NOT NULL,
  action_time TEXT,
  CHECK ((bill_id IS NOT NULL AND amendment_id IS NULL) OR (bill_id IS NULL AND amendment_id IS NOT NULL))
);

CREATE TABLE votes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER NOT NULL REFERENCES congresses(id),
  session INTEGER NOT NULL,
  vote_number INTEGER NOT NULL,
  bill_id INTEGER REFERENCES bills(id),
  vote_date TEXT,
  vote_question TEXT,
  vote_result TEXT,
  UNIQUE(congress_id, session, vote_number)
);

CREATE TABLE vote_members (
  vote_id INTEGER NOT NULL REFERENCES votes(id),
  member_bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
  vote_cast TEXT NOT NULL,
  PRIMARY KEY (vote_id, member_bioguide_id)
);

-- Other Legislative Tables
CREATE TABLE nominations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER REFERENCES congresses(id),
  nomination_number INTEGER,
  nominee_name TEXT,
  position TEXT,
  received_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  UNIQUE(congress_id, nomination_number)
);

CREATE TABLE treaties (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER REFERENCES congresses(id),
  treaty_number INTEGER,
  title TEXT,
  received_date TEXT,
  latest_action_date TEXT,
  latest_action_text TEXT,
  UNIQUE(congress_id, treaty_number)
);

CREATE TABLE communications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  congress_id INTEGER REFERENCES congresses(id),
  chamber TEXT NOT NULL,
  communication_type TEXT,
  communication_number INTEGER,
  title TEXT,
  received_date TEXT,
  UNIQUE(congress_id, chamber, communication_number)
);

-- Bill Relationship Tables
CREATE TABLE bill_committees (
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  committee_id TEXT NOT NULL REFERENCES committees(id),
  PRIMARY KEY (bill_id, committee_id)
);

CREATE TABLE bill_cosponsors (
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  member_bioguide_id TEXT NOT NULL REFERENCES members(bioguide_id),
  cosponsor_date TEXT,
  PRIMARY KEY (bill_id, member_bioguide_id)
);

CREATE TABLE related_bills (
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  related_bill_id INTEGER NOT NULL REFERENCES bills(id),
  relationship_type TEXT,
  PRIMARY KEY (bill_id, related_bill_id),
  CHECK (bill_id != related_bill_id)
);

CREATE TABLE subjects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE bill_subjects (
  bill_id INTEGER NOT NULL REFERENCES bills(id),
  subject_id INTEGER NOT NULL REFERENCES subjects(id),
  PRIMARY KEY (bill_id, subject_id)
);

CREATE TABLE laws (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  bill_id INTEGER REFERENCES bills(id),
  congress_id INTEGER NOT NULL REFERENCES congresses(id),
  law_type TEXT NOT NULL,
  law_number INTEGER NOT NULL,
  UNIQUE(congress_id, law_type, law_number)
);

-- Congressional Record Tables
CREATE TABLE congressional_record_issues (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  volume_number INTEGER NOT NULL,
  issue_number INTEGER NOT NULL,
  issue_date TEXT,
  congress_id INTEGER REFERENCES congresses(id),
  session_number INTEGER,
  UNIQUE(volume_number, issue_number)
);

CREATE TABLE congressional_record_articles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  record_issue_id INTEGER NOT NULL REFERENCES congressional_record_issues(id),
  title TEXT,
  article_type TEXT,
  start_page TEXT,
  end_page TEXT,
  content TEXT
);
```

## Indexes

```sql
-- User & Application Table Indexes
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_tracked_bills_user_id ON tracked_bills(user_id);
CREATE INDEX idx_tracked_bills_bill_id ON tracked_bills(bill_id);
CREATE INDEX idx_briefs_user_id ON briefs(user_id);
CREATE INDEX idx_briefs_date ON briefs(date);
CREATE INDEX idx_briefs_status ON briefs(status);
CREATE INDEX idx_chat_sessions_user_id ON chat_sessions(user_id);
CREATE INDEX idx_chat_sessions_bill_id ON chat_sessions(bill_id);
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_api_usage_logs_service ON api_usage_logs(service);
CREATE INDEX idx_api_usage_logs_created_at ON api_usage_logs(created_at);
CREATE INDEX idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_refresh_tokens_expires_at ON refresh_tokens(expires_at);
CREATE INDEX idx_password_reset_tokens_user_id ON password_reset_tokens(user_id);
CREATE INDEX idx_email_verification_tokens_user_id ON email_verification_tokens(user_id);

-- Congress.gov Data Indexes
CREATE INDEX idx_bills_congress ON bills(congress_id);
CREATE INDEX idx_bills_sponsor ON bills(sponsor_bioguide_id);
CREATE INDEX idx_bills_type ON bills(bill_type);
CREATE INDEX idx_bills_latest_action ON bills(latest_action_date);
CREATE INDEX idx_amendments_congress ON amendments(congress_id);
CREATE INDEX idx_amendments_bill ON amendments(bill_id);
CREATE INDEX idx_actions_bill ON actions(bill_id);
CREATE INDEX idx_actions_amendment ON actions(amendment_id);
CREATE INDEX idx_actions_date ON actions(action_date);
CREATE INDEX idx_votes_congress ON votes(congress_id);
CREATE INDEX idx_votes_bill ON votes(bill_id);
CREATE INDEX idx_vote_members_member ON vote_members(member_bioguide_id);
CREATE INDEX idx_bill_cosponsors_member ON bill_cosponsors(member_bioguide_id);
CREATE INDEX idx_bill_committees_committee ON bill_committees(committee_id);
CREATE INDEX idx_bill_subjects_subject ON bill_subjects(subject_id);
CREATE INDEX idx_congressional_record_volume ON congressional_record_issues(volume_number);
CREATE INDEX idx_congressional_record_date ON congressional_record_issues(issue_date);
CREATE INDEX idx_congressional_record_articles_issue ON congressional_record_articles(record_issue_id);
CREATE INDEX idx_members_state ON members(state);
CREATE INDEX idx_members_party ON members(party);
CREATE INDEX idx_members_current ON members(current_member);
```

## Foreign Key Relationships

### User & Application Tables
```
users ← user_preferences (user_id)
users ← tracked_bills (user_id)
users ← briefs (user_id)
users ← chat_sessions (user_id)
users ← refresh_tokens (user_id)
users ← password_reset_tokens (user_id)
users ← email_verification_tokens (user_id)
chat_sessions ← chat_messages (session_id)
bills ← tracked_bills (bill_id)
bills ← chat_sessions (bill_id)
```

### Congress.gov Legislative Data Tables
```
congresses ← bills (congress_id)
congresses ← amendments (congress_id)
congresses ← votes (congress_id)
congresses ← committee_meetings (congress_id)
congresses ← committee_reports (congress_id)
congresses ← committee_prints (congress_id)
congresses ← nominations (congress_id)
congresses ← treaties (congress_id)
congresses ← communications (congress_id)
congresses ← laws (congress_id)
congresses ← congressional_record_issues (congress_id)

members ← bills (sponsor_bioguide_id)
members ← amendments (sponsor_bioguide_id)
members ← bill_cosponsors (member_bioguide_id)
members ← vote_members (member_bioguide_id)

bills ← amendments (bill_id)
bills ← actions (bill_id)
bills ← votes (bill_id)
bills ← bill_committees (bill_id)
bills ← bill_cosponsors (bill_id)
bills ← related_bills (bill_id, related_bill_id)
bills ← bill_subjects (bill_id)
bills ← laws (bill_id)

amendments ← actions (amendment_id)

committees ← committee_meetings (committee_id)
committees ← committee_reports (committee_id)
committees ← committee_prints (committee_id)
committees ← bill_committees (committee_id)

votes ← vote_members (vote_id)

subjects ← bill_subjects (subject_id)

congressional_record_issues ← congressional_record_articles (record_issue_id)
```

## Data Population Strategy

The Congress.gov tables are populated via **external ingestion script** that:

1. **Initial Bulk Import**: Seeds database with current Congress data
   - Congresses: Current and recent (e.g., 118th, 117th, 116th)
   - Members: All current members + recent former members
   - Bills: All bills from current Congress
   - Votes, Actions, Committees, etc.

2. **Incremental Updates**: Scheduled sync (e.g., hourly or daily)
   - Checks Congress.gov API for updates since last sync
   - Uses `update_date` timestamps to identify changed records
   - Inserts new records, updates modified records
   - Stays within 5000 req/hour rate limit

3. **Selective Population**: Only sync data needed for frontend features
   - Priority: Bills, members, votes, actions
   - Optional: Congressional Record, nominations, treaties (if not used)
   - Reduces storage and sync time

This approach enables:
- **Fast queries**: Local SQL joins instead of API calls
- **Complex analytics**: Multi-table queries across all Congressional data
- **Offline capability**: App functions even if Congress.gov API is down
- **Cost reduction**: Minimize API calls, only sync deltas
