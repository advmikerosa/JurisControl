-- RLS Policies for All Tables
-- This script defines Row Level Security policies for the relevant tables in the JurisControl application.

-- Example RLS Policy for Users Table
CREATE POLICY user_select_policy
ON users
FOR SELECT
USING (user_id = current_user_id());

-- Example RLS Policy for Cases Table
CREATE POLICY case_select_policy
ON cases
FOR SELECT
USING (case_owner_id = current_user_id());

-- Example RLS Policy for Records Table
CREATE POLICY record_select_policy
ON records
FOR SELECT
USING (record_owner_id = current_user_id());

-- Add similar policies for other tables as necessary

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE records ENABLE ROW LEVEL SECURITY;

-- Log statement to verify RLS setup
RAISE NOTICE 'Row Level Security policies have been applied.';