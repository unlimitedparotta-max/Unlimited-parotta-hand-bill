const { createClient } = require("@supabase/supabase-js");

// Server-side uploads should use the service-role key so they work no
// matter what Row Level Security policies are set on the storage bucket.
// Falls back to the anon key if a service-role key isn't configured yet.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY
);

module.exports = supabase;
