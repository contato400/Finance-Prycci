CREATE TABLE IF NOT EXISTS bills (
  id SERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  item_id UUID,
  pluggy_bill_id TEXT UNIQUE,
  institution_name TEXT,
  description TEXT,
  amount FLOAT,
  due_date DATE,
  status TEXT DEFAULT 'PENDING',
  bar_code TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bills_user ON bills(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_due ON bills(user_id, due_date);
