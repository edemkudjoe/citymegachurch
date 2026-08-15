const { createClient } = require('@supabase/supabase-js');

// Service role key bypasses RLS — used only in serverless functions,
// never exposed to the frontend.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

module.exports = { supabase };
