 /* ==========================================================================
   Supabase client config
   Fill in SUPABASE_URL and SUPABASE_ANON_KEY from your Supabase project:
   Project Settings -> API -> Project URL / anon public key.
   These two values are safe to expose in client-side code as long as you
   have Row Level Security (RLS) policies set on your tables (see the SQL
   in supabase-schema.sql).
   ========================================================================== */
const SUPABASE_URL = "https://thinxdaoqhecmuudsjjf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRoaW54ZGFvcWhlY211dWRzampmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg3NzA4MzksImV4cCI6MjEwNDM0NjgzOX0.JpHzaNV6FOMkm2QIqXeHm22PBnIzJpMAR4QfTWkhJME";

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
