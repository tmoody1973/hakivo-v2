-- C1 Chat tables for general AI assistant conversations
-- Unlike chat_sessions/chat_messages which are bill-specific,
-- these are for the general C1 chat interface

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

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_c1_chat_threads_user_id ON c1_chat_threads(user_id);
CREATE INDEX IF NOT EXISTS idx_c1_chat_threads_updated_at ON c1_chat_threads(updated_at);
CREATE INDEX IF NOT EXISTS idx_c1_chat_messages_thread_id ON c1_chat_messages(thread_id);
